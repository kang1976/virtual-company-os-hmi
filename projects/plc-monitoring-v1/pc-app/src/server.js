'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const { WebSocketServer } = require('ws');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { createPlcSession } = require('./plcSession');
const { nowLocalIso, nowLocalStamp } = require('./timeUtils');
const {
  loadVariables,
  loadExtraHeaders,
  loadLayout,
  saveVariablesToFile,
  saveSnapshotFile,
  buildCompareReport,
  createGridManager,
  areaNameToCode,
  areaNameToBitCode,
} = require('./gridManager');
const { getAreaList } = require('./memoryAreas');
const { wordCountFor, decodeValue, encodeValue, parseAddress, formatAddress } = require('./dataTypes');
const {
  loadTrendVariables,
  saveTrendVariablesToFile,
  createTrendManager,
  saveSingleSeriesLog,
} = require('./trendManager');
const {
  loadGmsValves,
  saveGmsValvesToFile,
  loadGmsPts,
  loadGmsEquipment,
  saveGmsEquipmentToFile,
  loadGmsMainSequence,
  saveGmsMainSequenceToFile,
  MAIN_SEQUENCE_TYPE_DEFS,
  listGmsSubSequences,
  loadGmsSubSequence,
  saveGmsSubSequenceToFile,
  SUB_SEQ_FIXED_COLUMNS,
  SUB_SEQ_TRAILING_COLUMNS,
  SUB_SEQ_ADVANCE_ACK,
  buildSubSequenceWorkbook,
  loadGmsSubSequenceSelection,
  saveGmsSubSequenceSelectionToFile,
  loadGmsSubSequenceConfig,
  saveGmsSubSequenceConfigToFile,
  loadGmsPtCalibration,
  saveGmsPtCalibrationToFile,
  computeCalibratedCurrentValue,
  loadGmsAnalogEnableConfig,
  saveGmsAnalogEnableConfigToFile,
  loadGmsUsers,
  saveGmsUsersToFile,
  loadGmsWorkLogMessages,
  saveGmsWorkLogMessagesToFile,
  loadGmsScreenTitles,
  saveGmsScreenTitlesToFile,
  createGmsManager,
} = require('./gmsManager');
const gmsHistory = require('./gmsHistory');
const { parseVariablesXlsx, parseVariablesAny } = require('./excelImport');
const { loadNxTags, saveNxTags } = require('./nxTags');
const finsCommands = require('./finsCommands');
const {
  loadSettings,
  saveSettings,
  resetSettings,
  loadLogo,
  resolveSnapshotDir,
  filePrefix,
} = require('./settingsManager');

const PORT = process.env.PORT || 3000;
const MAX_LOG_ENTRIES = 500;
const MIN_INTERVAL_MS = 1;
const MAX_INTERVAL_MS = 60 * 60 * 1000; // 60분
// 0104(Multiple Memory Area Read) 한 번에 실을 수 있는 항목 개수 상한.
// 128개를 한 번에 요청했을 때 PLC가 0x2108 에러로 거부하는 것을 확인했기 때문에,
// 큰 그룹은 이 크기로 잘라서 여러 번 나눠 요청한다. (필요시 실측하며 값 조정 가능)
const MAX_ITEMS_PER_READ = 32;

function chunkItems(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Content-Disposition 헤더에 파일명을 안전하게 싣는다. 파일명에 한글 등 non-ASCII 문자가
 * 있으면 raw 헤더 값으로 그대로 넣었을 때 Node가 "Invalid character in header content"로
 * 예외를 던지므로(예: filePrefix 설정을 한글로 지정한 경우, 리포트 파일명에 한글을 직접 쓴
 * 경우), RFC 5987 filename*=UTF-8''... 인코딩 형식을 함께 보낸다. filename=""에는 ASCII로
 * 정제한 폴백을 넣어 filename*을 지원하지 않는 아주 오래된 클라이언트에서도 깨지지 않게 한다.
 */
function setDownloadFilename(res, filename) {
  const asciiFallback = filename.replace(/[^\x20-\x7e]/g, '_');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
  );
}

// ── 메모리 탐색기: "활성 뷰" 하나만 폴링한다 ──
// 예전에는 D/H/W/CIO/E0~E3 8개 영역을 항상 동시에(각 128워드) 폴링했지만, 그러면
// "영역 전체 주소"까지 브라우징하기엔 부하가 너무 크다. 화면에서 탭으로 영역 하나를
// 선택하면 그 영역의 한 페이지(pageSize개 값)만 폴링하는 방식으로 바꾼다.
//
// 시작주소/페이지크기/데이터타입/길이는 영역(D/H/W/CIO/E0..)마다 독립적으로 기억한다 -
// 탭을 옮겨도, 다른 화면에 갔다 이 화면으로 돌아와도(서버가 세션 내내 들고 있으므로) 그
// 영역에서 마지막으로 쓰던 설정 그대로 복원된다. currentAreaKey는 지금 폴링 중인 영역.
function defaultAreaView() {
  return { startAddr: 0, pageSize: 128, dataType: 'WORD', length: 1 };
}
const areaViews = { D: defaultAreaView() };
let currentAreaKey = 'D';
function getActiveView() {
  if (!areaViews[currentAreaKey]) areaViews[currentAreaKey] = defaultAreaView();
  return { area: currentAreaKey, ...areaViews[currentAreaKey] };
}

/** 활성 뷰를 FINS 읽기 항목(items)으로 펼친다. BOOL 표시 모드도 워드째로 읽어서
 *  프론트엔드가 16비트로 펼쳐 보여준다(비트 변수 하나가 아니라 "이 워드를 비트로
 *  펼쳐서 보여줘"라는 뜻이므로, 주소당 비트 16개를 따로 읽는 것보다 훨씬 효율적). */
function buildViewItems(view) {
  const wordCount = wordCountFor(view.dataType, view.length);
  const area = areaNameToCode(view.area);
  const items = [];
  for (let i = 0; i < view.pageSize; i++) {
    const baseAddr = view.startAddr + i * wordCount;
    for (let w = 0; w < wordCount; w++) {
      items.push({ label: `${i}#${w}`, area, addr: baseAddr + w, bit: 0 });
    }
  }
  return items;
}

// ── CSV 데이터 기록 (연결~연결해제 구간, 활성 뷰가 바뀔 때마다 새 파일로 이어서 기록) ──
// A열: yyyy-mm-dd hh:mm:ss.000 형식 타임스탬프, B열부터: 현재 보이는 페이지의 값들.
// 데이터가 실제로 계속 갱신되는지(모니터링이 멈춘 건 아닌지) 눈으로/엑셀로 확인하기 위한 용도.
const defaultCsvDir = path.join(__dirname, '..', 'logs', 'csv');
if (!fs.existsSync(defaultCsvDir)) fs.mkdirSync(defaultCsvDir, { recursive: true });

let csvStream = null;
let csvFilePath = null;

function pad(n, len = 2) {
  return String(n).padStart(len, '0');
}

function formatTimestamp(d) {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
  );
}

/** 내보내기 파일명에 붙이는 타임스탬프 - "YYYYMMDD_HHmmss" 형식(예: 20260803_202930).
    이전엔 파일명에 Date.now()(밀리초 epoch, 예: 1785756470726)를 그대로 붙였는데, 사람이
    읽을 수 없는 숫자라 사용자가 혼란스러워했다. formatTimestamp()의 "-"/":"/" " 조합은
    Windows 파일명에 쓸 수 없는 문자(":")가 섞여 있어 그대로는 못 쓰고, 별도로 파일명
    안전한 포맷을 둔다. */
function filenameTimestamp(d = new Date()) {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function viewLabels(view) {
  const wordCount = wordCountFor(view.dataType, view.length);
  const labels = [];
  for (let i = 0; i < view.pageSize; i++) {
    labels.push(`${view.area}${view.startAddr + i * wordCount}`);
  }
  return labels;
}

function startCsvLogging() {
  const stamp = formatTimestamp(new Date()).replace(/[: ]/g, '-');
  // 저장 폴더/파일명 접두사는 설정(설정 페이지)에서 지정할 수 있고, 미지정 시 기본 logs/csv + 'SNAP'.
  const dir = resolveSnapshotDir(defaultCsvDir);
  csvFilePath = path.join(dir, `${filePrefix('SNAP')}_${stamp}.csv`);
  csvStream = fs.createWriteStream(csvFilePath, { flags: 'a' });
  csvStream.write(['Timestamp', ...viewLabels(getActiveView())].join(',') + '\n');
  mainSession.pushLog('SYSTEM', `CSV 데이터 기록 시작: ${csvFilePath}`, null);
}

function stopCsvLogging() {
  if (!csvStream) return;
  const finishedPath = csvFilePath;
  csvStream.end();
  csvStream = null;
  csvFilePath = null;
  mainSession.pushLog('SYSTEM', `CSV 데이터 기록 종료: ${finishedPath}`, null);
}

/** 활성 뷰가 바뀌었을 때, 폴링 중이면 CSV 파일 헤더가 새 뷰와 어긋나지 않도록 새로 시작한다 */
function restartCsvLoggingIfPolling() {
  if (!csvStream) return;
  stopCsvLogging();
  startCsvLogging();
}

function writeCsvRow(cells) {
  if (!csvStream) return;
  const row = [
    formatTimestamp(new Date()),
    ...cells.map((c) => (c.value === undefined || c.value === null ? '' : c.value)),
  ].join(',');
  csvStream.write(row + '\n');
}

// ── 로그 & 상태 관리 ──
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const logStamp = nowLocalStamp();
const mainLogFile = path.join(logDir, `session_main_${logStamp}.log`);
const gridLogFile = path.join(logDir, `session_grid_${logStamp}.log`);
const trendLogFile = path.join(logDir, `session_trend_${logStamp}.log`);
const gmsLogFile = path.join(logDir, `session_gms_${logStamp}.log`);

// ── WebSocket 브로드캐스트 ──
let wss = null;
function broadcast(obj) {
  if (!wss) return;
  const data = JSON.stringify(obj);
  for (const ws of wss.clients) {
    if (ws.readyState === 1) ws.send(data);
  }
}

// ── 연결 세션 (메인 대시보드 / 그리드 화면이 각자 독립된 USB/UDP/TCP 연결을 가짐) ──
const state = {
  lastUpdate: null,
  lastError: null, // 폴링 사이클 중 발생한 마지막 읽기 에러 (연결 자체는 유지된 채로 발생 가능)
  pollIntervalMs: 1000,
  cells: [], // [{ addr, value }, ...] - 현재 활성 영역(getActiveView()) 기준 마지막으로 읽은 값
};

const mainSession = createPlcSession({
  broadcast,
  logFile: mainLogFile,
  maxLogEntries: MAX_LOG_ENTRIES,
  wsTypes: { log: 'log', counters: 'counters', logsCleared: 'logsCleared' },
  stopDependents: () => stopPolling(),
});

// gridManager/trendManager가 각자 세션의 client를 참조해야 하므로 먼저 선언해두고, 아래에서 생성한다.
let gridManager;
const gridSession = createPlcSession({
  broadcast,
  logFile: gridLogFile,
  maxLogEntries: MAX_LOG_ENTRIES,
  wsTypes: { log: 'gridConnLog', counters: 'gridConnCounters', logsCleared: 'gridConnLogsCleared' },
  stopDependents: () => gridManager && gridManager.stop(),
});

let trendManager;
const trendSession = createPlcSession({
  broadcast,
  logFile: trendLogFile,
  maxLogEntries: MAX_LOG_ENTRIES,
  wsTypes: { log: 'trendConnLog', counters: 'trendConnCounters', logsCleared: 'trendConnLogsCleared' },
  stopDependents: () => trendManager && trendManager.stop(),
});

let gmsManager;
const gmsSession = createPlcSession({
  broadcast,
  logFile: gmsLogFile,
  maxLogEntries: MAX_LOG_ENTRIES,
  wsTypes: { log: 'gmsConnLog', counters: 'gmsConnCounters', logsCleared: 'gmsConnLogsCleared' },
  stopDependents: () => gmsManager && gmsManager.stop(),
});

/**
 * 네 화면(메인/그리드/트렌드/GMS)은 각자 독립된 연결을 유지한다 - 화면을 전환했다 돌아와도
 * 폴링이 계속되도록, 한 화면에서 연결한다고 다른 화면 연결을 끊지 않는다.
 * 단, USB는 물리적으로 한 번에 하나의 프로세스만 장치를 열 수 있어 동시 연결이 안 되므로,
 * 이번에 USB로 연결하려는 경우에 한해 "다른 화면 중 USB로 연결된 것"만 먼저 끊는다.
 * (UDP/TCP는 서로 다른 화면이 각자 네트워크 소켓을 열 뿐이라 동시 연결에 아무 문제 없음)
 */
/** plcSession.connect()와 동일한 규칙으로 body.type을 'USB'/'UDP'/'TCP'로 정규화한다. */
function normalizeConnType(body) {
  const rawType = String((body && body.type) || 'USB').toUpperCase();
  return rawType === 'UDP' || rawType === 'TCP' ? rawType : 'USB';
}

function disconnectOtherSessions(except, requestedType) {
  if (requestedType !== 'USB') return;
  const others = [
    { session: mainSession, connStatusType: 'status', getMerged: getStatus },
    { session: gridSession, connStatusType: 'gridConnStatus', getMerged: () => gridSession.getStatus() },
    { session: trendSession, connStatusType: 'trendConnStatus', getMerged: () => trendSession.getStatus() },
    { session: gmsSession, connStatusType: 'gmsConnStatus', getMerged: () => gmsSession.getStatus() },
  ];
  for (const o of others) {
    if (o.session === except) continue;
    const st = o.session.getStatus();
    if (st.connected && st.connectionType === 'USB') {
      o.session.disconnect();
      broadcast({ type: o.connStatusType, payload: o.getMerged() });
    }
  }
}

let mainConsecutiveCycleErrors = 0;
const MAIN_RECONNECT_AFTER_CYCLES = 2;

async function pollOnce(manual = false) {
  const view = getActiveView();
  const client = mainSession.getClient();
  const items = buildViewItems(view);
  const chunks = chunkItems(items, MAX_ITEMS_PER_READ);
  const rawByItemLabel = {};
  let anySuccess = false;
  let lastErr = null;

  // 청크 단위로 순차 요청 - 한번에 몰아서 보내지 않고 하나씩 완료 후 다음 청크 진행
  for (const chunk of chunks) {
    // manual(수동 1회 읽기)이 아닌 자동 폴링 루프에서만: 도중에 정지/일시정지/연결
    // 해제되면 즉시 중단한다. manual 호출(뷰 설정 변경 시 1회 갱신)은 폴링 상태와
    // 무관하게 끝까지 읽어야 하므로 이 가드를 적용하지 않는다.
    if (!manual && pollStatus !== 'running') break;
    try {
      const results = await client.readItems(chunk);
      results.forEach((r, idx) => {
        rawByItemLabel[chunk[idx].label] = r.value;
      });
      anySuccess = true;
      mainSession.recordRecvSuccess();
    } catch (err) {
      lastErr = err;
      mainSession.pushLog('ERROR', `[${view.area}] ${err.message}`, null);
    }
  }

  const wordCount = wordCountFor(view.dataType, view.length);
  const cells = [];
  for (let i = 0; i < view.pageSize; i++) {
    const words = [];
    for (let w = 0; w < wordCount; w++) words.push(rawByItemLabel[`${i}#${w}`]);
    const addr = view.startAddr + i * wordCount;
    // BOOL 표시 모드는 워드 원본값을 그대로 두고 프론트가 16비트로 펼쳐서 보여준다.
    const value = view.dataType === 'BOOL'
      ? (words[0] === undefined || words[0] === null ? null : words[0] & 0xffff)
      : decodeValue(view.dataType, words, 0);
    cells.push({ addr, value });
  }

  if (anySuccess) {
    state.cells = cells;
    state.lastUpdate = nowLocalIso();
    mainConsecutiveCycleErrors = 0;
  } else if (chunks.length > 0) {
    mainConsecutiveCycleErrors += 1;
    if (mainConsecutiveCycleErrors >= MAIN_RECONNECT_AFTER_CYCLES) {
      mainConsecutiveCycleErrors = 0;
      try {
        await mainSession.reconnectClient();
      } catch (err) {
        mainSession.pushLog('ERROR', `[자동 재연결 실패] ${err.message}`, null);
      }
    }
  }
  state.lastError = lastErr ? lastErr.message : null;
  writeCsvRow(cells); // 성공/실패 여부와 상관없이 사이클마다 한 줄 기록 (멈춤 여부 확인용)
  broadcast({
    type: 'memoryValues',
    payload: { area: view.area, startAddr: view.startAddr, dataType: view.dataType, cells, lastUpdate: state.lastUpdate },
  });
  broadcast({ type: 'status', payload: getStatus() });
}

// 메모리 값 폴링은 연결과 별개로 사용자가 명시적으로 시작/일시정지/정지한다(그리드·트렌드
// 화면과 동일한 방식) - 연결만 해서는 자동으로 읽기 시작하지 않는다.
let pollStatus = 'stopped'; // 'stopped' | 'running' | 'paused'
let pollTimer = null;

async function pollLoop() {
  if (pollStatus !== 'running') return;
  const startedAt = Date.now();
  try {
    await pollOnce();
  } catch (e) {
    // pollOnce 내부에서 이미 로그 처리함
  }
  if (pollStatus !== 'running') return;
  const elapsed = Date.now() - startedAt;
  const wait = Math.max(0, state.pollIntervalMs - elapsed);
  pollTimer = setTimeout(pollLoop, wait);
}

function startPolling(intervalMs) {
  if (intervalMs && Number.isFinite(intervalMs) && intervalMs >= MIN_INTERVAL_MS && intervalMs <= MAX_INTERVAL_MS) {
    state.pollIntervalMs = intervalMs;
  }
  if (pollStatus === 'running') return;
  const wasStopped = pollStatus === 'stopped';
  pollStatus = 'running';
  // 완전히 정지된 상태에서 새로 시작할 때만 CSV 파일을 새로 연다. 일시정지 뒤 재개할 때는
  // 이미 열려 있는 파일에 이어서 기록한다(정지가 아니므로 파일을 끊지 않음).
  if (wasStopped) startCsvLogging();
  pollLoop();
}

function pausePolling() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  if (pollStatus === 'running') pollStatus = 'paused';
}

function stopPolling() {
  const wasActive = pollStatus !== 'stopped';
  pollStatus = 'stopped';
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  if (wasActive) stopCsvLogging();
}

function getStatus() {
  const sessionStatus = mainSession.getStatus();
  return {
    ...sessionStatus,
    // 연결된 상태에서는 폴링 사이클의 마지막 읽기 에러를, 연결이 끊긴 상태에서는
    // 연결 시도 자체가 실패한 이유(sessionStatus.lastError)를 보여준다.
    lastError: sessionStatus.connected ? state.lastError : sessionStatus.lastError,
    lastUpdate: state.lastUpdate,
    pollIntervalMs: state.pollIntervalMs,
    pollStatus,
    csvFilePath: csvStream ? csvFilePath : null,
  };
}

// ── HTTP API ──
const app = express();

// GMS 배관도(P&ID)를 public/gms.html에 하드코딩하지 않고 public/gms-diagram.svg로 분리해서,
// 매 요청마다 그 파일을 새로 읽어 gms.html의 <!--GMS_DIAGRAM_SVG--> 자리에 그대로 끼워
// 넣는다. Boxy SVG 등 외부 에디터로 gms-diagram.svg만 열어 고쳐 저장하면(서버 재시작 없이)
// 브라우저 새로고침만으로 바로 반영된다 - express.static보다 먼저 등록해야 이 라우트가
// gms.html 요청을 가로챈다.
app.get('/gms.html', (req, res) => {
  try {
    const htmlPath = path.join(__dirname, '..', 'public', 'gms.html');
    const svgPath = path.join(__dirname, '..', 'public', 'gms-diagram.svg');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const svg = fs.readFileSync(svgPath, 'utf8');
    res.type('html').send(html.replace('<!--GMS_DIAGRAM_SVG-->', svg));
  } catch (err) {
    res.status(500).type('text/plain').send('gms.html 렌더링 실패: ' + err.message);
  }
});

app.use(express.static(path.join(__dirname, '..', 'public')));
// 기본 100kb 제한으로는 base64로 인코딩한 Excel 파일 업로드(/api/*/variables/import)가
// 잘릴 수 있어서 넉넉히 늘림.
app.use(express.json({ limit: '10mb' }));

app.post('/api/connect', async (req, res) => {
  try {
    // USB로 연결하려는 경우에만, 다른 화면 중 USB로 연결된 것을 먼저 끊는다(물리적 제약).
    disconnectOtherSessions(mainSession, normalizeConnType(req.body));
    await mainSession.connect(req.body || {});
    // 연결만으로는 값 읽기를 자동 시작하지 않는다 - 화면의 [▶ 시작]을 눌러야 폴링이 시작된다
    // (그리드/트렌드 화면과 동일한 동작 방식).
    broadcast({ type: 'status', payload: getStatus() });
    res.json({ ok: true, status: getStatus() });
  } catch (err) {
    broadcast({ type: 'status', payload: getStatus() });
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/disconnect', (req, res) => {
  mainSession.disconnect();
  broadcast({ type: 'status', payload: getStatus() });
  res.json({ ok: true, status: getStatus() });
});

app.post('/api/interval', (req, res) => {
  const ms = Number(req.body && req.body.ms);
  if (!Number.isFinite(ms) || ms < MIN_INTERVAL_MS || ms > MAX_INTERVAL_MS) {
    return res.status(400).json({
      ok: false,
      error: `주기는 ${MIN_INTERVAL_MS}ms ~ ${MAX_INTERVAL_MS}ms(60분) 범위여야 합니다.`,
    });
  }
  state.pollIntervalMs = ms;
  mainSession.pushLog('SYSTEM', `폴링 주기 변경: ${ms}ms`, null);
  broadcast({ type: 'status', payload: getStatus() });
  res.json({ ok: true, status: getStatus() });
});

// 메모리 값 읽기 시작/일시정지/정지 - 연결과 별개로 사용자가 명시적으로 조작한다
// (그리드/트렌드 화면의 ▶시작/⏸일시정지/⏹정지와 동일한 방식).
app.post('/api/poll/start', (req, res) => {
  if (!mainSession.getStatus().connected) {
    return res.status(400).json({ ok: false, error: 'PLC에 먼저 연결해야 값 읽기를 시작할 수 있습니다.' });
  }
  if (mainSession.getStatus().plcSeries === 'NX') {
    return res.status(400).json({ ok: false, error: 'NX 시리즈는 영역+주소 방식이 아니라 태그 조회를 사용합니다.' });
  }
  const ms = req.body && req.body.intervalMs !== undefined ? Number(req.body.intervalMs) : undefined;
  if (ms !== undefined && (!Number.isFinite(ms) || ms < MIN_INTERVAL_MS || ms > MAX_INTERVAL_MS)) {
    return res.status(400).json({ ok: false, error: `주기는 ${MIN_INTERVAL_MS}ms ~ ${MAX_INTERVAL_MS}ms(60분) 범위여야 합니다.` });
  }
  startPolling(ms);
  mainSession.pushLog('SYSTEM', `값 읽기 시작 (주기 ${state.pollIntervalMs}ms)`, null);
  broadcast({ type: 'status', payload: getStatus() });
  res.json({ ok: true, status: getStatus() });
});

app.post('/api/poll/pause', (req, res) => {
  pausePolling();
  mainSession.pushLog('SYSTEM', '값 읽기 일시정지', null);
  broadcast({ type: 'status', payload: getStatus() });
  res.json({ ok: true, status: getStatus() });
});

app.post('/api/poll/stop', (req, res) => {
  stopPolling();
  mainSession.pushLog('SYSTEM', '값 읽기 정지', null);
  broadcast({ type: 'status', payload: getStatus() });
  res.json({ ok: true, status: getStatus() });
});

// "쓰기 테스트" 패널의 영역 드롭다운도 /api/memory/areas와 동일한 동적 목록을 쓴다
// (CPU 모델에 따른 EM 뱅크 수가 항상 일치하도록).
app.get('/api/writable-areas', (req, res) => {
  const model = mainSession.getStatus().controllerInfo && mainSession.getStatus().controllerInfo.model;
  const areas = getAreaList(model).map((a) => ({ label: a.key, area: areaNameToCode(a.key) }));
  res.json({ areas });
});

// ── NX/NJ 시리즈 태그 조회/쓰기 (CJ의 영역+주소 대신 태그 이름으로 접근) ──
app.get('/api/nx/tags', (req, res) => {
  res.json({ ok: true, tags: loadNxTags() });
});

app.post('/api/nx/tags', (req, res) => {
  const tags = Array.isArray(req.body && req.body.tags) ? req.body.tags : null;
  if (!tags) return res.status(400).json({ ok: false, error: 'tags 배열이 필요합니다.' });
  saveNxTags(tags);
  res.json({ ok: true, count: tags.length });
});

app.post('/api/nx/tags/read', async (req, res) => {
  const tagNames = Array.isArray(req.body && req.body.tagNames)
    ? req.body.tagNames
    : loadNxTags().map((t) => t.name);
  const status = mainSession.getStatus();
  if (!status.connected || status.plcSeries !== 'NX') {
    return res.status(400).json({ ok: false, error: 'NX 시리즈로 연결되어 있어야 태그를 읽을 수 있습니다.' });
  }
  if (tagNames.length === 0) return res.json({ ok: true, results: [] });
  try {
    const client = mainSession.getClient();
    const results = await client.readTags(tagNames);
    mainSession.recordRecvSuccess();
    res.json({ ok: true, results });
  } catch (err) {
    mainSession.pushLog('ERROR', 'NX 태그 읽기 실패: ' + err.message, null);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/nx/tags/write', async (req, res) => {
  const { tag, value, dataType } = req.body || {};
  if (!tag) return res.status(400).json({ ok: false, error: 'tag가 필요합니다.' });
  const status = mainSession.getStatus();
  if (!status.connected || status.plcSeries !== 'NX') {
    return res.status(400).json({ ok: false, error: 'NX 시리즈로 연결되어 있어야 태그에 쓸 수 있습니다.' });
  }
  try {
    const client = mainSession.getClient();
    await client.writeTag(tag, value, dataType);
    res.json({ ok: true });
  } catch (err) {
    mainSession.pushLog('ERROR', 'NX 태그 쓰기 실패: ' + err.message, null);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/memory/areas', (req, res) => {
  const model = mainSession.getStatus().controllerInfo && mainSession.getStatus().controllerInfo.model;
  res.json({ ok: true, areas: getAreaList(model), view: getActiveView() });
});

// body.area만 보내면(다른 필드 생략) 그 영역에서 마지막으로 쓰던 설정을 그대로 복원한다 -
// 영역 탭 전환은 이 방식으로, 같은 영역 내에서 주소/타입/페이지크기를 바꿀 때는 body에
// 해당 필드를 함께 보내면 된다.
app.post('/api/memory/view', (req, res) => {
  const body = req.body || {};
  const model = mainSession.getStatus().controllerInfo && mainSession.getStatus().controllerInfo.model;
  const areaList = getAreaList(model);
  const areaKey = String(body.area || currentAreaKey).toUpperCase();
  const areaInfo = areaList.find((a) => a.key === areaKey);
  if (!areaInfo) {
    return res.status(400).json({ ok: false, error: `알 수 없는 영역: ${areaKey}` });
  }

  const prev = areaViews[areaKey] || defaultAreaView();
  const dataType = body.dataType ? String(body.dataType).toUpperCase() : prev.dataType;
  const length = body.length !== undefined ? Number(body.length) : prev.length;
  const pageSize = body.pageSize !== undefined ? Number(body.pageSize) : prev.pageSize;
  const startAddr = body.startAddr !== undefined ? Number(body.startAddr) : prev.startAddr;

  if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 512) {
    return res.status(400).json({ ok: false, error: '페이지 크기는 1~512 사이여야 합니다.' });
  }
  if (!Number.isFinite(startAddr) || startAddr < 0) {
    return res.status(400).json({ ok: false, error: '시작 주소가 올바르지 않습니다.' });
  }
  const wordCount = wordCountFor(dataType, length);
  const totalWords = pageSize * wordCount;
  if (startAddr + totalWords > areaInfo.maxWords) {
    return res.status(400).json({
      ok: false,
      error: `주소 범위가 ${areaInfo.label} 최대 크기(${areaInfo.maxWords}워드)를 벗어납니다.`,
    });
  }

  areaViews[areaKey] = { startAddr, pageSize, dataType, length };
  currentAreaKey = areaKey;
  restartCsvLoggingIfPolling();
  // 연결 전(또는 태그 기반이라 폴링이 없는 NX 연결 중)에 영역 탭만 바꿔도 ERROR 로그가
  // 쌓이지 않도록 CJ로 연결된 상태일 때만 즉시 한 번 읽어서 화면을 갱신한다. 폴링이
  // 일시정지/정지 상태여도 시작주소/페이지크기/데이터타입을 바꾸면 그 최종 설정 그대로
  // 화면에 반영되어야 하므로 pollStatus 조건 없이 항상 수동 1회 읽기를 수행한다.
  const viewStatus = mainSession.getStatus();
  if (viewStatus.connected && viewStatus.plcSeries !== 'NX') {
    pollOnce(true).catch(() => {}); // pollOnce 내부에서 이미 에러 로그 처리함
  }
  res.json({ ok: true, view: getActiveView() });
});

app.post('/api/memory/write', async (req, res) => {
  const body = req.body || {};
  const area = String(body.area || '').toUpperCase();
  const dataType = String(body.dataType || 'WORD').toUpperCase();
  const length = body.length !== undefined ? Number(body.length) : 1;
  const cells = Array.isArray(body.cells) ? body.cells : null;
  if (!area || !cells) {
    return res.status(400).json({ ok: false, error: 'area/cells가 필요합니다.' });
  }

  const client = mainSession.getClient();
  const results = [];
  for (const cell of cells) {
    try {
      if (dataType === 'BOOL') {
        // BOOL 표시 모드에서 편집한 비트 하나만 바꾼다 (그리드의 BOOL 쓰기와 동일하게
        // 워드 전체를 덮어쓰지 않고 writeBit()으로 나머지 비트는 보존).
        const bitArea = areaNameToBitCode(area);
        const bitOn = cell.value === true || cell.value === 1 || cell.value === '1';
        await client.writeBit(bitArea, cell.addr, cell.bit || 0, bitOn);
      } else {
        const wordArea = areaNameToCode(area);
        const wordCount = wordCountFor(dataType, length);
        const words = encodeValue(dataType, cell.value, wordCount);
        for (let i = 0; i < words.length; i++) {
          await client.writeWord(wordArea, cell.addr + i, words[i] & 0xffff);
        }
      }
      results.push({ addr: cell.addr, bit: cell.bit, ok: true });
    } catch (err) {
      results.push({ addr: cell.addr, bit: cell.bit, ok: false, error: err.message });
    }
  }
  res.json({ ok: true, results });
});

/** 영역 키(D/H/W/CIO/E0..)를 파일명에 쓰는 표기(DM/H/W/CIO/EM0..)로 변환 */
function areaFileLabel(areaKey) {
  if (areaKey === 'D') return 'DM';
  return areaKey; // H/W/CIO/E0.. 는 그대로(EM뱅크는 EM0, EM1..처럼 뱅크 번호를 유지해 구분)
}

app.get('/api/memory/export/xlsx', async (req, res) => {
  try {
    const view = getActiveView();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('메모리 값');
    ws.addRow(['영역', view.area]);
    ws.addRow(['시작 주소', view.startAddr]);
    ws.addRow(['데이터 타입', view.dataType]);
    ws.addRow([]);
    ws.addRow(['주소', '값']).font = { bold: true };
    for (const cell of state.cells) {
      ws.addRow([`${view.area}${cell.addr}`, cell.value === null || cell.value === undefined ? '' : cell.value]);
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setDownloadFilename(res, `MEM_${areaFileLabel(view.area)}_${filenameTimestamp()}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    mainSession.pushLog('ERROR', '메모리 내보내기 실패: ' + err.message, null);
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/counters/reset', (req, res) => {
  mainSession.resetCounters();
  res.json({ ok: true, counters: mainSession.getStatus().counters });
});

app.post('/api/logs/clear', (req, res) => {
  mainSession.clearLogs();
  res.json({ ok: true });
});

app.post('/api/write', async (req, res) => {
  const { area, addr, value } = req.body || {};
  const areaNum = Number(area);
  const addrNum = Number(addr);
  const valueNum = Number(value);

  if (!Number.isFinite(areaNum) || !Number.isFinite(addrNum) || !Number.isFinite(valueNum)) {
    return res.status(400).json({ ok: false, error: 'area/addr/value는 숫자여야 합니다.' });
  }
  if (addrNum < 0 || addrNum > 0xffff) {
    return res.status(400).json({ ok: false, error: '주소 범위가 올바르지 않습니다 (0~65535).' });
  }
  if (valueNum < 0 || valueNum > 0xffff) {
    return res.status(400).json({ ok: false, error: '값 범위가 올바르지 않습니다 (0~65535).' });
  }
  try {
    await mainSession.getClient().writeWord(areaNum, addrNum, valueNum);
    res.json({ ok: true });
  } catch (err) {
    mainSession.pushLog('ERROR', '쓰기 실패: ' + err.message, null);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/error-log', async (req, res) => {
  if (!mainSession.getStatus().connected) {
    return res.status(400).json({ ok: false, error: '연결되어 있지 않습니다.' });
  }
  const start = req.query.start !== undefined ? Number(req.query.start) : 0;
  const count = req.query.count !== undefined ? Number(req.query.count) : 20;
  try {
    const result = await mainSession.getClient().readErrorLog({ start, count });
    mainSession.pushLog(
      result.currentCount > 0 ? 'WARN' : 'SYSTEM',
      `에러 로그 조회: 현재 ${result.currentCount}개 저장됨 (최대 ${result.maxRecords}개, 이번 응답 ${result.returnedCount}개)`,
      null
    );
    res.json({ ok: true, result });
  } catch (err) {
    mainSession.pushLog('ERROR', '에러 로그 조회 실패: ' + err.message, null);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── 변수 관리 그리드 (Univer 기반, /grid 페이지) ──
gridManager = createGridManager({
  getClient: () => gridSession.getClient(),
  broadcast,
  pushLog: gridSession.pushLog,
  recordRecvSuccess: gridSession.recordRecvSuccess,
  reconnectClient: () => gridSession.reconnectClient(),
});

app.get('/api/variables', (req, res) => {
  res.json({ ok: true, variables: loadVariables(), extraHeaders: loadExtraHeaders(), layout: loadLayout() });
});

app.post('/api/variables', (req, res) => {
  const variables = Array.isArray(req.body && req.body.variables) ? req.body.variables : null;
  const extraHeaders = Array.isArray(req.body && req.body.extraHeaders) ? req.body.extraHeaders : [];
  const layout = req.body && req.body.layout && typeof req.body.layout === 'object' ? req.body.layout : null;
  if (!variables) {
    return res.status(400).json({ ok: false, error: 'variables 배열이 필요합니다.' });
  }
  try {
    saveVariablesToFile(variables, extraHeaders, layout);
    gridSession.pushLog('SYSTEM', `그리드 변수 목록 저장됨 (${variables.length}개)`, null);
    res.json({ ok: true, count: variables.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 그리드의 exportXlsx가 쓰는 열 이름(변수명/영역/주소/타입/길이(STRING)/설명(코멘트)/현재값)과
// 그대로 맞춰서, 내보낸 파일을 그대로 다시 불러올 수 있게 한다.
// xlsx/xlsm/xlsb/xls/csv를 모두 지원하는 SheetJS 기반 범용 파서(parseVariablesAny) 사용 -
// 파일 확장자와 무관하게 실제 파일 시그니처로 형식을 판별한다.
app.post('/api/variables/import', async (req, res) => {
  const fileBase64 = req.body && req.body.fileBase64;
  if (!fileBase64) {
    return res.status(400).json({ ok: false, error: 'fileBase64가 필요합니다.' });
  }
  try {
    const buffer = Buffer.from(fileBase64, 'base64');
    const { rows, extraHeaders } = parseVariablesAny(
      buffer,
      {
        '변수명': 'label', '영역': 'area', '주소': 'addressRaw', '타입': 'dataType',
        '길이(STRING)': 'length', '설명(코멘트)': 'description',
      },
      ['현재값', '설정값(쓰기)', 'Snapshots(Start)', 'Snapshots(End)', '비교판정']
    );
    const variables = rows
      .map((r) => {
        const { address, bit } = parseAddress(r.addressRaw);
        const v = {
          label: String(r.label || '').trim(),
          area: String(r.area || '').trim().toUpperCase(),
          address,
          bit,
          dataType: String(r.dataType || 'WORD').trim().toUpperCase(),
          length: Number(r.length) || 1,
          description: r.description ? String(r.description) : '',
        };
        if (Object.keys(r.extra).length > 0) v.extra = r.extra;
        return v;
      })
      .filter((v) => v.label && v.area);
    gridSession.pushLog('SYSTEM', `Excel에서 변수 ${variables.length}개 불러옴`, null);
    res.json({ ok: true, variables, extraHeaders });
  } catch (err) {
    gridSession.pushLog('ERROR', 'Excel 불러오기 실패: ' + err.message, null);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/variables/export/xlsx', async (req, res) => {
  try {
    await gridManager.exportXlsx(res);
  } catch (err) {
    gridSession.pushLog('ERROR', 'Excel 내보내기 실패: ' + err.message, null);
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/variables/export/pdf', (req, res) => {
  try {
    gridManager.exportPdf(res);
  } catch (err) {
    gridSession.pushLog('ERROR', 'PDF 내보내기 실패: ' + err.message, null);
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message });
  }
});

// "📸 스냅샷" 버튼 - 현재 그리드 상태를 설정된 스냅샷 폴더에 xlsx로 저장 (감사 기록용)
app.post('/api/variables/snapshot', async (req, res) => {
  const rows = Array.isArray(req.body && req.body.rows) ? req.body.rows : null;
  if (!rows) {
    return res.status(400).json({ ok: false, error: 'rows 배열이 필요합니다.' });
  }
  try {
    const filePath = await saveSnapshotFile(rows);
    gridSession.pushLog('SYSTEM', `스냅샷 저장됨: ${filePath}`, null);
    res.json({ ok: true, filePath });
  } catch (err) {
    gridSession.pushLog('ERROR', '스냅샷 저장 실패: ' + err.message, null);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// "⚖ 비교판정" 결과 리포트를 xlsx/pdf로 만들어 그대로 응답 바디에 실어 보낸다.
// (저장 위치는 클라이언트가 Save As 다이얼로그로 고르므로 서버는 디스크에 쓰지 않는다.)
app.post('/api/variables/compare-report', async (req, res) => {
  const summary = req.body && req.body.summary;
  const format = req.body && req.body.format === 'pdf' ? 'pdf' : 'xlsx';
  if (!summary || !Array.isArray(summary.items)) {
    return res.status(400).json({ ok: false, error: 'summary가 필요합니다.' });
  }
  try {
    const buf = await buildCompareReport(summary, format);
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
    } else {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }
    setDownloadFilename(res, `${filePrefix('SNAP')}_비교_결과_Report_${filenameTimestamp()}.${format}`);
    res.end(buf);
  } catch (err) {
    gridSession.pushLog('ERROR', '비교 결과 리포트 생성 실패: ' + err.message, null);
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/grid/connect', async (req, res) => {
  try {
    // USB로 연결하려는 경우에만, 다른 화면 중 USB로 연결된 것을 먼저 끊는다(물리적 제약).
    disconnectOtherSessions(gridSession, normalizeConnType(req.body));
    const status = await gridSession.connect(req.body || {});
    broadcast({ type: 'gridConnStatus', payload: status });
    res.json({ ok: true, status });
  } catch (err) {
    broadcast({ type: 'gridConnStatus', payload: gridSession.getStatus() });
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/grid/disconnect', (req, res) => {
  gridSession.disconnect();
  broadcast({ type: 'gridConnStatus', payload: gridSession.getStatus() });
  res.json({ ok: true, status: gridSession.getStatus() });
});

app.post('/api/grid/counters/reset', (req, res) => {
  gridSession.resetCounters();
  res.json({ ok: true, counters: gridSession.getStatus().counters });
});

app.post('/api/grid/logs/clear', (req, res) => {
  gridSession.clearLogs();
  res.json({ ok: true });
});

app.get('/api/grid/conn-status', (req, res) => {
  res.json({ ok: true, status: gridSession.getStatus(), logs: gridSession.getRecentLogs(100) });
});

/** grid/trend start의 intervalMs를 /api/interval과 동일한 범위로 검증. 미지정(undefined)이면 통과. */
function validateIntervalMs(intervalMs) {
  if (intervalMs === undefined || intervalMs === null || intervalMs === '') return null;
  const ms = Number(intervalMs);
  if (!Number.isFinite(ms) || ms < MIN_INTERVAL_MS || ms > MAX_INTERVAL_MS) {
    return `주기는 ${MIN_INTERVAL_MS}ms ~ ${MAX_INTERVAL_MS}ms(60분) 범위여야 합니다.`;
  }
  return null;
}

app.post('/api/grid/start', (req, res) => {
  const intervalMs = req.body && req.body.intervalMs;
  const intervalError = validateIntervalMs(intervalMs);
  if (intervalError) return res.status(400).json({ ok: false, error: intervalError });
  try {
    gridManager.start(intervalMs);
    res.json({ ok: true, status: gridManager.getStatus() });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/grid/pause', (req, res) => {
  gridManager.pause();
  res.json({ ok: true, status: gridManager.getStatus() });
});

app.post('/api/grid/stop', (req, res) => {
  gridManager.stop();
  res.json({ ok: true, status: gridManager.getStatus() });
});

app.post('/api/grid/write', async (req, res) => {
  const rows = Array.isArray(req.body && req.body.rows) ? req.body.rows : null;
  if (!rows) {
    return res.status(400).json({ ok: false, error: 'rows 배열이 필요합니다.' });
  }
  try {
    const results = await gridManager.writeVariables(rows);
    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/grid/status', (req, res) => {
  res.json({ ok: true, ...gridManager.getStatus() });
});

// ── 트렌드 모니터링 (/monitoring.html 페이지) ──
trendManager = createTrendManager({
  getClient: () => trendSession.getClient(),
  broadcast,
  pushLog: trendSession.pushLog,
  recordRecvSuccess: trendSession.recordRecvSuccess,
  reconnectClient: () => trendSession.reconnectClient(),
});

app.get('/api/trend/variables', (req, res) => {
  res.json({ ok: true, variables: loadTrendVariables() });
});

app.post('/api/trend/variables', (req, res) => {
  const variables = Array.isArray(req.body && req.body.variables) ? req.body.variables : null;
  if (!variables) {
    return res.status(400).json({ ok: false, error: 'variables 배열이 필요합니다.' });
  }
  try {
    saveTrendVariablesToFile(variables);
    trendSession.pushLog('SYSTEM', `트렌드 변수 목록 저장됨 (${variables.length}개)`, null);
    res.json({ ok: true, count: variables.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/trend/variables/export/xlsx', async (req, res) => {
  try {
    const variables = loadTrendVariables();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('트렌드 변수 목록');
    ws.columns = [
      { header: '영역', key: 'area', width: 10 },
      { header: '주소', key: 'address', width: 12 },
      { header: '타입', key: 'dataType', width: 10 },
      { header: '설명', key: 'description', width: 20 },
      { header: '허용오차(±)', key: 'tolerance', width: 14 },
      { header: '시작값', key: 'startValue', width: 14 },
      { header: '종료값', key: 'endValue', width: 14 },
      { header: '비교값', key: 'compareValue', width: 14 },
    ];
    ws.getRow(1).font = { bold: true };
    variables.forEach((v) => {
      ws.addRow({
        area: v.area,
        address: formatAddress(v.address, v.bit, v.dataType),
        dataType: v.dataType,
        description: v.description || '',
        tolerance: v.tolerance ?? '',
        startValue: v.startValue ?? '',
        endValue: v.endValue ?? '',
        compareValue: v.compareValue ?? '',
      });
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setDownloadFilename(res, `${filePrefix('SNAP')}_Trend_비교_${filenameTimestamp()}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    trendSession.pushLog('ERROR', 'Excel 내보내기 실패: ' + err.message, null);
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message });
  }
});

// 그리드용 import와 헤더-필드 매핑표만 다를 뿐 동일한 parseVariablesXlsx를 재사용한다.
app.post('/api/trend/variables/import', async (req, res) => {
  const fileBase64 = req.body && req.body.fileBase64;
  if (!fileBase64) {
    return res.status(400).json({ ok: false, error: 'fileBase64가 필요합니다.' });
  }
  try {
    const buffer = Buffer.from(fileBase64, 'base64');
    const { rows } = await parseVariablesXlsx(
      buffer,
      {
        '영역': 'area', '주소': 'addressRaw', '타입': 'dataType', '설명': 'description',
        '허용오차(±)': 'tolerance',
        '시작값': 'startValue', '종료값': 'endValue', '비교값': 'compareValue',
      },
      []
    );
    const variables = rows
      .map((r) => {
        const { address, bit } = parseAddress(r.addressRaw);
        return {
          area: String(r.area || '').trim().toUpperCase(),
          address,
          bit,
          dataType: String(r.dataType || 'WORD').trim().toUpperCase(),
          length: 1,
          chart: true,
          description: r.description || '',
          tolerance: r.tolerance ?? '',
          startValue: r.startValue ?? '',
          endValue: r.endValue ?? '',
          compareValue: r.compareValue ?? '',
        };
      })
      .filter((v) => v.area);
    trendSession.pushLog('SYSTEM', `Excel에서 트렌드 변수 ${variables.length}개 불러옴`, null);
    res.json({ ok: true, variables });
  } catch (err) {
    trendSession.pushLog('ERROR', 'Excel 불러오기 실패: ' + err.message, null);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 개별 트렌드 팝업에서 "정지"를 누르면 그 변수 하나만의 시계열을 로그 파일로 남긴다
// (Total 저장은 실제 폴링 정지 시 서버가 자동으로 하고, 개별 저장은 이 엔드포인트로 따로 한다).
app.post('/api/trend/history/save-single', (req, res) => {
  const { label, description, timestamps, values } = req.body || {};
  if (!label || !Array.isArray(timestamps) || !Array.isArray(values)) {
    return res.status(400).json({ ok: false, error: 'label/timestamps/values가 필요합니다.' });
  }
  try {
    const fileName = saveSingleSeriesLog({ label, description, timestamps, values });
    if (!fileName) return res.status(400).json({ ok: false, error: '저장할 기록이 없습니다.' });
    res.json({ ok: true, fileName });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 변수 "정의"(영역/주소/타입 등)가 아니라 실제로 화면에 그려진 시간별 값(시계열) 자체를
// Excel로 내보내고/불러와서, 연결 없이도(오프라인) 과거 트렌드를 다시 볼 수 있게 한다.
// 형식: 1행 헤더 = 시간 + 각 변수 라벨, 이후 각 행 = 그 시각의 값들 (넓은 표 형식).
app.post('/api/trend/history/export', async (req, res) => {
  const timestamps = Array.isArray(req.body && req.body.timestamps) ? req.body.timestamps : null;
  const columns = Array.isArray(req.body && req.body.columns) ? req.body.columns : null;
  if (!timestamps || !columns) {
    return res.status(400).json({ ok: false, error: 'timestamps/columns가 필요합니다.' });
  }
  try {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('트렌드 기록');
    ws.columns = [
      { header: '시간', key: 't', width: 22 },
      ...columns.map((c, i) => ({ header: c.label, key: `c${i}`, width: 16 })),
    ];
    ws.getRow(1).font = { bold: true };
    timestamps.forEach((t, rowIdx) => {
      const row = { t: new Date(t) };
      columns.forEach((c, i) => {
        row[`c${i}`] = c.values[rowIdx] === undefined || c.values[rowIdx] === null ? '' : c.values[rowIdx];
      });
      ws.addRow(row);
    });
    ws.getColumn('t').numFmt = 'yyyy-mm-dd hh:mm:ss';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setDownloadFilename(res, `${filePrefix('SNAP')}_Trend_${filenameTimestamp()}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    trendSession.pushLog('ERROR', '트렌드 기록 내보내기 실패: ' + err.message, null);
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message });
  }
});

// 트렌드 차트(캔버스)를 PNG로 캡처해 보내주면 PDF 한 페이지에 담아 돌려준다.
// 우클릭 메뉴의 "내보내기" - PNG는 클라이언트가 canvas.toDataURL로 직접 저장하고,
// PDF만 이미지 임베딩이 필요해 서버(pdfkit)를 거친다.
app.post('/api/trend/chart/export-pdf', (req, res) => {
  const imageBase64 = req.body && req.body.imageBase64;
  const title = (req.body && req.body.title) || '트렌드 차트';
  if (!imageBase64) {
    return res.status(400).json({ ok: false, error: 'imageBase64가 필요합니다.' });
  }
  try {
    const imgBuffer = Buffer.from(imageBase64, 'base64');
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    setDownloadFilename(res, `${filePrefix('SNAP')}_Trend_Chart_${filenameTimestamp()}.pdf`);
    doc.pipe(res);

    let koreanFontAvailable = false;
    const candidateFonts = ['C:\\Windows\\Fonts\\malgun.ttf', '/usr/share/fonts/truetype/nanum/NanumGothic.ttf'];
    for (const fontPath of candidateFonts) {
      try {
        if (fs.existsSync(fontPath)) {
          doc.registerFont('Korean', fontPath);
          doc.font('Korean');
          koreanFontAvailable = true;
          break;
        }
      } catch (e) { /* ignore */ }
    }
    doc.fontSize(14).text(koreanFontAvailable ? title : 'Trend Chart', { align: 'left' });
    doc.moveDown(0.5);
    const availW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const availH = doc.page.height - doc.page.margins.top - doc.page.margins.bottom - 30;
    doc.image(imgBuffer, doc.page.margins.left, doc.y, { fit: [availW, availH] });
    doc.end();
  } catch (err) {
    trendSession.pushLog('ERROR', '트렌드 차트 PDF 내보내기 실패: ' + err.message, null);
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/trend/history/import', async (req, res) => {
  const fileBase64 = req.body && req.body.fileBase64;
  if (!fileBase64) {
    return res.status(400).json({ ok: false, error: 'fileBase64가 필요합니다.' });
  }
  try {
    const buffer = Buffer.from(fileBase64, 'base64');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    if (!ws) return res.json({ ok: true, timestamps: [], columns: [] });

    const headerRow = ws.getRow(1);
    const labels = []; // colNumber(2..) -> label
    headerRow.eachCell((cell, colNumber) => {
      if (colNumber === 1) return; // 시간 열
      labels[colNumber] = String(cell.value === null || cell.value === undefined ? '' : cell.value).trim();
    });

    const timestamps = [];
    const valuesByCol = {}; // colNumber -> array
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const tCell = row.getCell(1).value;
      let t;
      if (tCell instanceof Date) t = tCell.getTime();
      else t = new Date(tCell).getTime();
      if (!Number.isFinite(t)) return;
      timestamps.push(t);
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber === 1) return;
        if (!valuesByCol[colNumber]) valuesByCol[colNumber] = [];
        const v = cell.value;
        valuesByCol[colNumber].push(v === null || v === undefined ? '' : v);
      });
    });

    const columns = Object.keys(valuesByCol)
      .map(Number)
      .sort((a, b) => a - b)
      .map((colNumber) => ({ label: labels[colNumber] || `열${colNumber}`, values: valuesByCol[colNumber] }));

    res.json({ ok: true, timestamps, columns });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/trend/areas', (req, res) => {
  const model = trendSession.getStatus().controllerInfo && trendSession.getStatus().controllerInfo.model;
  res.json({ ok: true, areas: getAreaList(model) });
});

app.post('/api/trend/connect', async (req, res) => {
  try {
    // USB로 연결하려는 경우에만, 다른 화면 중 USB로 연결된 것을 먼저 끊는다(물리적 제약).
    disconnectOtherSessions(trendSession, normalizeConnType(req.body));
    const status = await trendSession.connect(req.body || {});
    broadcast({ type: 'trendConnStatus', payload: status });
    res.json({ ok: true, status });
  } catch (err) {
    broadcast({ type: 'trendConnStatus', payload: trendSession.getStatus() });
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/trend/disconnect', (req, res) => {
  trendSession.disconnect();
  broadcast({ type: 'trendConnStatus', payload: trendSession.getStatus() });
  res.json({ ok: true, status: trendSession.getStatus() });
});

app.post('/api/trend/counters/reset', (req, res) => {
  trendSession.resetCounters();
  res.json({ ok: true, counters: trendSession.getStatus().counters });
});

app.post('/api/trend/logs/clear', (req, res) => {
  trendSession.clearLogs();
  res.json({ ok: true });
});

app.get('/api/trend/conn-status', (req, res) => {
  res.json({ ok: true, status: trendSession.getStatus(), logs: trendSession.getRecentLogs(100) });
});

app.post('/api/trend/start', (req, res) => {
  const intervalMs = req.body && req.body.intervalMs;
  const intervalError = validateIntervalMs(intervalMs);
  if (intervalError) return res.status(400).json({ ok: false, error: intervalError });
  try {
    trendManager.start(intervalMs);
    res.json({ ok: true, status: trendManager.getStatus() });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/trend/pause', (req, res) => {
  trendManager.pause();
  res.json({ ok: true, status: trendManager.getStatus() });
});

app.post('/api/trend/stop', (req, res) => {
  trendManager.stop();
  res.json({ ok: true, status: trendManager.getStatus() });
});

app.get('/api/trend/status', (req, res) => {
  res.json({ ok: true, ...trendManager.getStatus() });
});

// ── GMS(Gas Monitoring System) - /gms.html 페이지 ──
// 이 매니저는 배관도를 전혀 모른다 - 장비(가스캐비닛)별 밸브 태그/PLC 주소
// (data/gmsValves/<unitId>.json)만 다룬다.
gmsManager = createGmsManager({
  getClient: () => gmsSession.getClient(),
  broadcast,
  pushLog: gmsSession.pushLog,
  recordRecvSuccess: gmsSession.recordRecvSuccess,
  reconnectClient: () => gmsSession.reconnectClient(),
});

// 장비 선택 화면에서 넘어온 unitId 기준으로 그 장비의 밸브 목록을 읽는다. 이 호출 자체가
// "지금부터 이 장비를 본다"는 신호이기도 해서, 폴링/쓰기가 참조할 활성 장비도 함께 갱신한다.
app.get('/api/gms/valves', (req, res) => {
  const unitId = req.query.unit;
  if (!unitId) {
    return res.status(400).json({ ok: false, error: 'unit 쿼리 파라미터가 필요합니다.' });
  }
  try {
    const valves = loadGmsValves(unitId);
    const pts = loadGmsPts(unitId);
    gmsManager.setActiveUnit(unitId);
    res.json({ ok: true, valves, pts });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// 장비 선택 화면(장비 목록 카드) 전용 - 배관도 밸브 목록과는 별개의 간단한 목록.
app.get('/api/gms/equipment', (req, res) => {
  res.json({ ok: true, equipment: loadGmsEquipment() });
});

app.post('/api/gms/equipment', (req, res) => {
  const equipment = Array.isArray(req.body && req.body.equipment) ? req.body.equipment : null;
  if (!equipment) {
    return res.status(400).json({ ok: false, error: 'equipment 배열이 필요합니다.' });
  }
  try {
    saveGmsEquipmentToFile(equipment);
    res.json({ ok: true, count: equipment.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Main 시퀀스(CYLINDER STEP STATUS) 순서/적용 설정 - 장비 구분 없이 전역 파일 하나로 관리한다
// (equipment와 동일한 패턴). order는 {id,type} 인스턴스 배열(같은 type이 여러 번 가능),
// enabledTypes는 type별 적용/미적용.
app.get('/api/gms/main-sequence', (req, res) => {
  res.json({ ok: true, ...loadGmsMainSequence() });
});

app.post('/api/gms/main-sequence', (req, res) => {
  const order = Array.isArray(req.body && req.body.order) ? req.body.order : null;
  const enabledTypes = req.body && typeof req.body.enabledTypes === 'object' ? req.body.enabledTypes : null;
  if (!order || !enabledTypes) {
    return res.status(400).json({ ok: false, error: 'order 배열과 enabledTypes 객체가 필요합니다.' });
  }
  try {
    saveGmsMainSequenceToFile(order, enabledTypes);
    res.json({ ok: true, count: order.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Main 시퀀스를 엑셀로 내보낸다 - 편집기가 지금 화면에 갖고 있는(아직 저장 전일 수도 있는)
// order/enabledTypes를 그대로 받아서 내보낸다("보이는 대로 내보내기" - 저장 여부와 무관).
// 열 구성은 원본 Main Sequence.csv(대표심볼/KOR/ENG)와 최대한 비슷하게 맞춰서 누구나 엑셀에서
// 바로 알아볼 수 있게 하고, 적용 열만 추가한다. No. 열은 참고용 표시일 뿐 실제 순서는 행
// 순서(위→아래)로 정해진다 - 엑셀에서 행을 옮기면 그대로 순서가 바뀐다.
app.post('/api/gms/main-sequence/export/xlsx', async (req, res) => {
  const order = Array.isArray(req.body && req.body.order) ? req.body.order : null;
  const enabledTypes = req.body && typeof req.body.enabledTypes === 'object' ? req.body.enabledTypes : {};
  if (!order) {
    return res.status(400).json({ ok: false, error: 'order 배열이 필요합니다.' });
  }
  try {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Main 시퀀스');
    ws.columns = [
      { header: 'No.', key: 'no', width: 6 },
      { header: '대표심볼', key: 'type', width: 12 },
      { header: 'KOR', key: 'kor', width: 30 },
      { header: 'ENG', key: 'eng', width: 30 },
      { header: '적용', key: 'enabled', width: 8 },
    ];
    ws.getRow(1).font = { bold: true };
    order.forEach((inst, i) => {
      const def = MAIN_SEQUENCE_TYPE_DEFS.find((d) => d.type === inst.type);
      ws.addRow({
        no: i + 1,
        type: inst.type,
        kor: def ? def.korLabel : '',
        eng: def ? def.engLabel : '',
        enabled: enabledTypes[inst.type] === false ? 'N' : 'Y',
      });
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setDownloadFilename(res, `${filePrefix('GMS')}_MainSequence_${filenameTimestamp()}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message });
  }
});

// Main 시퀀스를 엑셀에서 불러온다 - "대표심볼" 열만 필수(알려진 15개 타입 중 하나여야 함,
// 같은 타입이 여러 행에 반복돼도 됨 - 중복이 곧 "그 위치에 한 번 더" 라는 뜻). "적용" 열은
// 있으면 Y/N(대소문자 무관, "예"/"아니오"도 허용)으로 타입별 적용 여부를 정하고, 없으면 전부
// 적용으로 본다. 서버 파일에는 곧바로 저장하지 않는다 - 편집기의 작업용 사본(workingOrder/
// workingEnabled)에만 반영되고, 사용자가 편집기의 "저장"을 눌러야 실제 반영된다(기존 흐름과
// 동일 - 실수로 잘못된 파일을 불러와도 "취소"로 되돌릴 수 있다).
app.post('/api/gms/main-sequence/import/xlsx', async (req, res) => {
  const fileBase64 = req.body && req.body.fileBase64;
  if (!fileBase64) {
    return res.status(400).json({ ok: false, error: 'fileBase64가 필요합니다.' });
  }
  try {
    const buffer = Buffer.from(fileBase64, 'base64');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    if (!ws) return res.json({ ok: true, order: [], enabledTypes: {}, warnings: ['시트를 찾을 수 없습니다.'] });

    let typeCol = -1;
    let enabledCol = -1;
    ws.getRow(1).eachCell((cell, colNumber) => {
      const text = String(cell.value === null || cell.value === undefined ? '' : cell.value).trim();
      if (text === '대표심볼') typeCol = colNumber;
      else if (text === '적용') enabledCol = colNumber;
    });
    if (typeCol === -1) {
      return res.json({ ok: false, error: '"대표심볼" 열을 찾을 수 없습니다(내보내기 파일 양식을 확인하세요).' });
    }

    const knownTypes = new Set(MAIN_SEQUENCE_TYPE_DEFS.map((d) => d.type));
    const YES = new Set(['Y', 'YES', '예', '적용', 'TRUE', '1', 'O']);
    const NO = new Set(['N', 'NO', '아니오', '미적용', 'FALSE', '0', 'X']);

    const order = [];
    const enabledTypes = {};
    const warnings = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rawType = row.getCell(typeCol).value;
      const type = String(rawType === null || rawType === undefined ? '' : rawType).trim();
      if (!type) return; // 빈 행은 조용히 건너뜀
      if (!knownTypes.has(type)) {
        warnings.push(`행 ${rowNumber}: 알 수 없는 대표심볼 "${type}" - 무시했습니다.`);
        return;
      }
      order.push({ id: `seq_${Date.now()}_${rowNumber}_${Math.random().toString(36).slice(2, 7)}`, type });
      if (enabledCol !== -1) {
        const rawEnabled = row.getCell(enabledCol).value;
        const text = String(rawEnabled === null || rawEnabled === undefined ? '' : rawEnabled).trim().toUpperCase();
        if (YES.has(text)) enabledTypes[type] = true;
        else if (NO.has(text)) enabledTypes[type] = false;
        // 그 외(빈 칸 등)는 아래에서 기본값(true)으로 채운다.
      }
    });
    if (order.length === 0) {
      return res.json({ ok: false, error: '가져올 수 있는 유효한 행이 없습니다.' });
    }
    // 적용 열이 없거나 비어있던 타입은 기본값 true(적용)로 채운다 - MAIN_SEQUENCE_DEFAULT_ENABLED_TYPES와
    // 동일한 방침(원인 불명으로 미적용 처리되는 일이 없도록).
    Array.from(new Set(order.map((s) => s.type))).forEach((type) => {
      if (!(type in enabledTypes)) enabledTypes[type] = true;
    });

    res.json({ ok: true, order, enabledTypes, warnings });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 서브시퀀스(Sub Sequence) - Main Step 하나(예: 조정모드) 안에서 벨브를 열고 닫으며 진행하는
// 상세 Step 목록. 서브시퀀스 하나당 파일 하나(data/gmsSubSequences/<id>.json)로 관리하고,
// mainStepType별로 어떤 서브시퀀스 id를 쓸지는 별도 선택 매핑 파일에 저장한다.
app.get('/api/gms/sub-sequences', (req, res) => {
  res.json({ ok: true, items: listGmsSubSequences() });
});

app.get('/api/gms/sub-sequences/:id', (req, res) => {
  try {
    const data = loadGmsSubSequence(req.params.id);
    if (!data) return res.status(404).json({ ok: false, error: '서브시퀀스를 찾을 수 없습니다.' });
    res.json({ ok: true, ...data });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/gms/sub-sequences/:id', (req, res) => {
  const { id: _ignoredId, ...data } = req.body || {};
  try {
    saveGmsSubSequenceToFile(req.params.id, data);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.get('/api/gms/sub-sequence-selection', (req, res) => {
  res.json({ ok: true, selection: loadGmsSubSequenceSelection() });
});

app.post('/api/gms/sub-sequence-selection', (req, res) => {
  const selection = req.body && typeof req.body.selection === 'object' ? req.body.selection : null;
  if (!selection) {
    return res.status(400).json({ ok: false, error: 'selection 객체가 필요합니다.' });
  }
  try {
    saveGmsSubSequenceSelectionToFile(selection);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// CONFIG 탭(gms.html 상단 탭 바) - 서브시퀀스 조건 판단에 쓰는 설정값(예: 진공하한치)을
// 조작자가 직접 입력/수정한다. 장비 구분 없이 전역 파일 하나로 관리(Main 시퀀스와 동일 패턴).
app.get('/api/gms/sub-sequence-config', (req, res) => {
  res.json({ ok: true, ...loadGmsSubSequenceConfig() });
});

app.post('/api/gms/sub-sequence-config', (req, res) => {
  const rows = Array.isArray(req.body && req.body.rows) ? req.body.rows : null;
  if (!rows) {
    return res.status(400).json({ ok: false, error: 'rows 배열이 필요합니다.' });
  }
  try {
    saveGmsSubSequenceConfigToFile(rows);
    res.json({ ok: true, count: rows.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// CONFIG 값 엑셀 왕복 - 서버가 지금 들고 있는 값을 그대로 내보내고(클라이언트가 화면에서
// 아직 저장 안 한 편집 중인 값이 있어도 그건 무시 - "서버에 실제로 저장된 값" 기준),
// 불러오기는 sub-sequences import(요청사항: "행 추가하면 바로 엑셀시트에 반영해서 바로
// 프로그램에 반영")와 동일하게 서버가 즉시 파일까지 저장한다 - 클라이언트가 따로 "저장"을
// 누를 필요 없다.
app.get('/api/gms/sub-sequence-config/export/xlsx', async (req, res) => {
  try {
    const { rows } = loadGmsSubSequenceConfig();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('CONFIG');
    ws.columns = [
      { header: '구분', key: 'group', width: 12 },
      { header: '설정명', key: 'name', width: 20 },
      { header: 'ID', key: 'id', width: 20 },
      { header: '값', key: 'value', width: 14 },
      { header: '단위', key: 'unit', width: 10 },
      { header: '설명', key: 'desc', width: 50 },
      // 설정모드 A/B 화면(그리드+키패드)이 쓰는 4열 - 기존 6열 뒤에 추가한 것이라 옛 CONFIG
      // 엑셀 파일(이 4열이 없는)을 다시 불러와도 아래 import 라우트가 optional로 처리한다.
      { header: '측(A/B/공통)', key: 'side', width: 12 },
      { header: '최소값', key: 'min', width: 12 },
      { header: '최대값', key: 'max', width: 12 },
      { header: '인터락', key: 'interlock', width: 26 },
      { header: '옵션', key: 'option', width: 18 },
    ];
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => ws.addRow({
      group: r.group || '', name: r.name || '', id: r.id || '', value: r.value, unit: r.unit || '', desc: r.desc || '',
      side: r.side || '', min: r.min === 0 ? 0 : (r.min || ''), max: r.max === 0 ? 0 : (r.max || ''),
      interlock: r.interlock || '', option: r.option || '',
    }));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setDownloadFilename(res, `${filePrefix('GMS')}_CONFIG_${filenameTimestamp()}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/gms/sub-sequence-config/import/xlsx', async (req, res) => {
  const fileBase64 = req.body && req.body.fileBase64;
  if (!fileBase64) {
    return res.status(400).json({ ok: false, error: 'fileBase64가 필요합니다.' });
  }
  try {
    const buffer = Buffer.from(fileBase64, 'base64');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    if (!ws) return res.json({ ok: false, error: '시트를 찾을 수 없습니다.' });

    const colByHeader = {};
    ws.getRow(1).eachCell((cell, colNumber) => {
      const text = String(cell.value === null || cell.value === undefined ? '' : cell.value).trim();
      if (text) colByHeader[text] = colNumber;
    });
    const required = ['구분', '설정명', 'ID', '값', '단위', '설명'];
    const missing = required.filter((h) => !colByHeader[h]);
    if (missing.length) {
      return res.json({ ok: false, error: `열을 찾을 수 없습니다: ${missing.join(', ')} (내보내기 파일 양식을 확인하세요).` });
    }

    const rows = [];
    const warnings = [];
    const seenIds = new Set();
    // 측/최소값/최대값/인터락/옵션은 설정모드 A/B 화면을 위해 나중에 추가된 열이라, 옛 CONFIG
    // 엑셀(이 열들이 없는 파일)도 그대로 불러와지도록 optional로 취급한다(required 목록에 없음).
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const cellText = (col) => {
        const colNumber = colByHeader[col];
        if (!colNumber) return '';
        const raw = row.getCell(colNumber).value;
        const normalized = (raw && typeof raw === 'object' && !Array.isArray(raw) && 'result' in raw) ? raw.result : raw;
        return normalized === null || normalized === undefined ? '' : String(normalized).trim();
      };
      const id = cellText('ID');
      const name = cellText('설정명');
      if (!id && !name) return; // 빈 행은 조용히 건너뜀
      if (id && seenIds.has(id)) {
        warnings.push(`행 ${rowNumber}: ID "${id}"가 중복되어 있습니다 - 서브시퀀스 조건식이 어느 쪽을 참조할지 알 수 없으니 확인하세요.`);
      }
      if (id) seenIds.add(id);
      const valueRaw = cellText('값');
      const valueNum = Number(valueRaw);
      const minRaw = cellText('최소값');
      const maxRaw = cellText('최대값');
      const minNum = Number(minRaw);
      const maxNum = Number(maxRaw);
      const side = cellText('측(A/B/공통)');
      if (side && !['A', 'B', 'common'].includes(side)) {
        warnings.push(`행 ${rowNumber}: 측 값 "${side}"을(를) 알 수 없습니다(A/B/common만 가능) - 빈 값으로 처리합니다.`);
      }
      rows.push({
        group: cellText('구분'), name, id, value: valueRaw !== '' && Number.isFinite(valueNum) ? valueNum : valueRaw,
        unit: cellText('단위'), desc: cellText('설명'),
        side: ['A', 'B', 'common'].includes(side) ? side : '',
        min: minRaw !== '' && Number.isFinite(minNum) ? minNum : '',
        max: maxRaw !== '' && Number.isFinite(maxNum) ? maxNum : '',
        interlock: cellText('인터락'), option: cellText('옵션'),
      });
    });
    if (rows.length === 0) {
      return res.json({ ok: false, error: '가져올 수 있는 유효한 행이 없습니다.' });
    }

    saveGmsSubSequenceConfigToFile(rows);
    res.json({ ok: true, rows, warnings });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 서브시퀀스 엑셀 열 구성(SUB_SEQ_FIXED_COLUMNS/TRAILING_COLUMNS/sanitizeSheetName/
// excelColLetter/buildSubSequenceWorkbook)은 gmsManager.js로 옮겼다 - 자동 백업 로직
// (saveGmsSubSequenceToFile)도 같은 워크북 빌더를 써야 export와 백업 파일 포맷이 갈라지지
// 않는다. nextStep/alarmGoto/cycle/conditionOp/earlyPass 등 각 열의 의미는 그쪽 정의부
// 주석과 public/gms-sub-sequence-runner.js의 실행 로직을 참고.

// 서브시퀀스 엑셀 내보내기 - 실제 엔지니어링 문서(Purge_Sequence_GC_2022_07.xlsx)와 같은
// 다단 헤더 형식(그룹행 2개 + 실제 열이름행)으로 내보낸다. 밸브 열은 이 서브시퀀스의
// valveTags 배열 순서 그대로, 열이름 자체가 밸브 태그명이다(O=Open, C=Close, 공백=이전 상태
// 유지, O+n/C+n=화면 진입 후 n초 뒤 적용 - 용기교체(CC) applyCcStepValves 전용 문법).
app.get('/api/gms/sub-sequences/:id/export/xlsx', async (req, res) => {
  try {
    const data = loadGmsSubSequence(req.params.id);
    if (!data) return res.status(404).json({ ok: false, error: '서브시퀀스를 찾을 수 없습니다.' });
    const wb = buildSubSequenceWorkbook(req.params.id, data);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setDownloadFilename(res, `${filePrefix('GMS')}_SubSequence_${req.params.id}_${filenameTimestamp()}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message });
  }
});

// 서브시퀀스 엑셀 불러오기 - 워크북의 시트마다 하나의 서브시퀀스로 보고, 시트명을 그대로
// 서브시퀀스 id로 써서 곧바로 저장한다("엑셀 시트만 수정하면 바로 시퀀스가 수정된다" 요청에
// 따라, Main 시퀀스 가져오기와 달리 별도 "저장" 단계 없이 검증을 통과한 시트는 즉시 저장한다).
// Row4를 헤더 행으로 보고 "S/No."/"Operations" 등 고정 열이름으로 열 위치를 찾으며, 고정
// 열이름에 속하지 않는 나머지 열은 전부 밸브 태그 열로 취급한다(열이름 = 밸브 태그명).
app.post('/api/gms/sub-sequences/import/xlsx', async (req, res) => {
  const fileBase64 = req.body && req.body.fileBase64;
  if (!fileBase64) {
    return res.status(400).json({ ok: false, error: 'fileBase64가 필요합니다.' });
  }
  try {
    const buffer = Buffer.from(fileBase64, 'base64');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    if (wb.worksheets.length === 0) {
      return res.json({ ok: true, saved: [], skipped: [{ sheet: null, error: '시트가 없습니다.' }] });
    }

    const fixedHeaderKeys = {};
    [...SUB_SEQ_FIXED_COLUMNS, ...SUB_SEQ_TRAILING_COLUMNS].forEach((c) => { fixedHeaderKeys[c.header] = c.key; });
    // 예전에 내보낸 파일과의 하위호환 - 열 이름을 "비교대상(CONFIG ID)" → "설정명(비교대상ID)"로
    // 바꿨지만, 이미 내보내진 옛 파일을 다시 불러올 때도 같은 conditionValue 열로 인식해야
    // 밸브 태그 열로 잘못 분류되지 않는다.
    fixedHeaderKeys['비교대상(CONFIG ID)'] = 'conditionValue';

    const saved = [];
    const skipped = [];
    for (const ws of wb.worksheets) {
      const headerRow = ws.getRow(4);
      const colKeyByNumber = {}; // colNumber -> {kind:'fixed', key} | {kind:'valve', tag}
      let sNoCol = -1;
      headerRow.eachCell((cell, colNumber) => {
        const text = String(cell.value === null || cell.value === undefined ? '' : cell.value).trim();
        if (!text) return;
        if (fixedHeaderKeys[text]) {
          colKeyByNumber[colNumber] = { kind: 'fixed', key: fixedHeaderKeys[text] };
          if (fixedHeaderKeys[text] === 'no') sNoCol = colNumber;
        } else {
          colKeyByNumber[colNumber] = { kind: 'valve', tag: text };
        }
      });
      if (sNoCol === -1) {
        skipped.push({ sheet: ws.name, error: '"S/No." 열을 찾을 수 없습니다(Row4 헤더 형식을 확인하세요).' });
        continue;
      }

      const steps = [];
      ws.eachRow((row, rowNumber) => {
        if (rowNumber < 5) return;
        const sNoVal = row.getCell(sNoCol).value;
        const no = String(sNoVal === null || sNoVal === undefined ? '' : sNoVal).trim();
        if (!no) return; // 빈 S/No.는 건너뜀
        const step = { no, valves: {} };
        Object.entries(colKeyByNumber).forEach(([colNumber, info]) => {
          const raw = row.getCell(Number(colNumber)).value;
          // Acc,Time (Sec)처럼 수식이 들어간 셀은 ExcelJS가 { formula, result } 객체로
          // 돌려준다(엑셀/LibreOffice로 한 번 열어 계산한 뒤 저장된 파일이면 result에 실제
          // 계산값이 들어있다) - 평범한 문자열/숫자처럼 다루려면 result만 꺼내 써야 한다.
          const normalized = (raw && typeof raw === 'object' && !Array.isArray(raw) && 'result' in raw) ? raw.result : raw;
          const text = normalized === null || normalized === undefined ? '' : normalized;
          if (info.kind === 'valve') {
            // "O"/"C"(즉시) 외에 "O+2"/"C+4"처럼 "+n" 접미사(화면 진입 후 n초 뒤 적용)도
            // 허용한다 - 용기교체(CC) applyCcStepValves가 쓰는 순차 개폐 지연 문법
            // (docs/GMS_AUTO_SEQUENCE_HANDOFF.md 11.6). 다른 서브시퀀스는 항상 순수 "O"/"C"만
            // 내보내므로 이 확장이 기존 값에는 영향을 주지 않는다.
            const v = String(text).trim().toUpperCase();
            if (/^[OC](\+\d+)?$/.test(v)) step.valves[info.tag] = v;
          } else if (info.key === 'advance') {
            const t = String(text).trim();
            step.advance = SUB_SEQ_ADVANCE_ACK.has(t) ? 'ack' : 'auto';
          } else if (info.key === 'mainStep' || info.key === 'subStep') {
            const n = Number(text);
            step[info.key] = Number.isFinite(n) ? n : '';
          } else {
            step[info.key] = typeof text === 'string' ? text.trim() : text;
          }
        });
        if (step.advance === undefined) step.advance = 'auto';
        steps.push(step);
      });
      if (steps.length === 0) {
        skipped.push({ sheet: ws.name, error: '가져올 수 있는 유효한 행이 없습니다.' });
        continue;
      }

      const valveTags = [];
      Object.values(colKeyByNumber).forEach((info) => {
        if (info.kind === 'valve' && !valveTags.includes(info.tag)) valveTags.push(info.tag);
      });

      try {
        const id = req.body.sheetToId && req.body.sheetToId[ws.name] ? req.body.sheetToId[ws.name] : ws.name;
        const existing = loadGmsSubSequence(id) || {};
        saveGmsSubSequenceToFile(id, {
          label: existing.label || ws.name,
          mainStepType: existing.mainStepType || '',
          unitId: existing.unitId || '',
          notes: existing.notes || '',
          valveTags,
          steps,
        });
        saved.push(id);
      } catch (err) {
        skipped.push({ sheet: ws.name, error: err.message });
      }
    }

    res.json({ ok: true, saved, skipped });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PT/Weight 아날로그 교정(캘리브레이션) - "조정모드 > 압력조정" 화면이 쓴다. 장비 구분 없이
// 전역 파일 하나로 관리한다(Main 시퀀스와 동일한 패턴).
app.get('/api/gms/pt-calibration', (req, res) => {
  res.json({ ok: true, ...loadGmsPtCalibration() });
});

app.post('/api/gms/pt-calibration', (req, res) => {
  const rows = Array.isArray(req.body && req.body.rows) ? req.body.rows : null;
  if (!rows) {
    return res.status(400).json({ ok: false, error: 'rows 배열이 필요합니다.' });
  }
  try {
    saveGmsPtCalibrationToFile(rows);
    // 폴링(pollOnce)이 안 도는 동안 저장하면 브로드캐스트만으로는 "지금 붙어있는" 클라이언트만
    // 갱신되고, 서버 메모리(gmsState.ptValues)엔 반영이 안 남는다 - 그 상태로 서버가 재시작되거나
    // 새 클라이언트가 접속하면 다시 예전 값(또는 빈 값)을 보게 된다. 폴링 상태와 무관하게 항상
    // 서버 메모리도 같이 갱신해서 "최종값이 계속 표시"되도록 한다.
    gmsManager.refreshPtValuesFromCalibration(rows);
    // 배관도/트렌드/조정모드 표시는 폴링 사이클(pollOnce)의 gmsValues 브로드캐스트를 받아야
    // 갱신되는데, 폴링이 정지 상태면(가상 알람 테스트처럼 VPT 등을 손으로 바꿔보고 싶을 때
    // 특히 흔함) 저장해도 화면에 반영될 길이 없었다 - 밸브 write 즉시 브로드캐스트와 동일한
    // 이유로, 저장한 값 기준 "현재값"을 즉시 계산해서 내보낸다(다음 폴링 사이클이 와도 같은
    // 공식으로 다시 계산하므로 덮어쓰기 문제는 없음).
    const pts = {};
    rows.forEach((row) => { if (row && row.tag) pts[row.tag] = computeCalibratedCurrentValue(row); });
    // ptCalibrationRows도 함께 실어 보낸다 - 배관도는 pts(계산된 현재값)만 있으면 되지만,
    // 압력조정 표는 offset/analogValue 등 원본 열까지 표시해야 해서 pts만으론 부족하다(다른
    // 클라이언트/탭이 지금 압력조정 화면을 보고 있어도 새로고침 없이 값이 갱신되도록).
    broadcast({ type: 'gmsValues', payload: { pts, ptCalibrationRows: rows } });
    res.json({ ok: true, count: rows.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PT/Weight/Heater 사용 옵션(OPTION 탭) - 미적용 태그는 배관도/PT 교정 표/작업이력 그리드/
// TREND 태그 목록/히터 조작 화면 전부에서 제외된다(클라이언트 각자가 이 목록을 읽어서
// 걸러낸다). 장비 구분 없이 전역 파일 하나로 관리(PT 교정과 동일한 패턴).
app.get('/api/gms/analog-enable', (req, res) => {
  res.json({ ok: true, ...loadGmsAnalogEnableConfig() });
});

app.post('/api/gms/analog-enable', (req, res) => {
  const rows = Array.isArray(req.body && req.body.rows) ? req.body.rows : null;
  if (!rows) {
    return res.status(400).json({ ok: false, error: 'rows 배열이 필요합니다.' });
  }
  try {
    saveGmsAnalogEnableConfigToFile(rows);
    res.json({ ok: true, count: rows.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// USER 등록(작업자 계정) - CONFIG↔OPTION 사이 "USER" 탭의 Univer 그리드가 쓴다. 장비 구분
// 없이 전역 파일 하나로 관리한다(Main 시퀀스와 동일한 패턴).
app.get('/api/gms/users', (req, res) => {
  res.json({ ok: true, users: loadGmsUsers() });
});

app.post('/api/gms/users', (req, res) => {
  const users = Array.isArray(req.body && req.body.users) ? req.body.users : null;
  if (!users) {
    return res.status(400).json({ ok: false, error: 'users 배열이 필요합니다.' });
  }
  try {
    saveGmsUsersToFile(users);
    res.json({ ok: true, count: users.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

const GMS_USER_ROLES = ['MASTER', 'SUPERVISOR', 'USER'];

// USER 목록을 엑셀로 내보낸다 - 편집기가 지금 화면에 갖고 있는(아직 저장 전일 수도 있는)
// users를 그대로 받아서 내보낸다("보이는 대로 내보내기"). Password 열은 "0854"처럼 0으로
// 시작하는 값이 흔해서 텍스트 서식("@")으로 고정해야 엑셀에서 다시 열어도 선행 0이
// 유지된다.
app.post('/api/gms/users/export/xlsx', async (req, res) => {
  const users = Array.isArray(req.body && req.body.users) ? req.body.users : null;
  if (!users) {
    return res.status(400).json({ ok: false, error: 'users 배열이 필요합니다.' });
  }
  try {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('USER 등록');
    ws.columns = [
      { header: 'No.', key: 'no', width: 6 },
      { header: '성명', key: 'name', width: 14 },
      { header: 'Password', key: 'password', width: 12 },
      { header: '권한', key: 'role', width: 14 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getColumn('password').numFmt = '@';
    users.forEach((u, i) => {
      ws.addRow({ no: i + 1, name: u.name, password: String(u.password || ''), role: u.role });
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setDownloadFilename(res, `${filePrefix('GMS')}_USER_${filenameTimestamp()}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message });
  }
});

// USER 목록을 엑셀에서 불러온다 - "성명"과 "Password" 열이 필수. "권한" 열이 없거나
// MASTER/SUPERVISOR/USER가 아니면 기본값 USER로 채운다(경고만 남기고 막지는 않음 - 나중에
// 그리드에서 드롭다운으로 바로 고칠 수 있으므로). Password는 숫자로 읽혀서 선행 0이
// 지워졌을 수 있으므로(예: 854) 4자리로 0을 채워 되돌린다. 서버 파일에는 곧바로 저장하지
// 않는다 - 그리드의 작업용 사본에만 반영되고, "저장"을 눌러야 실제 반영된다.
app.post('/api/gms/users/import/xlsx', async (req, res) => {
  const fileBase64 = req.body && req.body.fileBase64;
  if (!fileBase64) {
    return res.status(400).json({ ok: false, error: 'fileBase64가 필요합니다.' });
  }
  try {
    const buffer = Buffer.from(fileBase64, 'base64');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    if (!ws) return res.json({ ok: true, users: [], warnings: ['시트를 찾을 수 없습니다.'] });

    let nameCol = -1;
    let passwordCol = -1;
    let roleCol = -1;
    ws.getRow(1).eachCell((cell, colNumber) => {
      const text = String(cell.value === null || cell.value === undefined ? '' : cell.value).trim();
      if (text === '성명') nameCol = colNumber;
      else if (text === 'Password') passwordCol = colNumber;
      else if (text === '권한') roleCol = colNumber;
    });
    if (nameCol === -1 || passwordCol === -1) {
      return res.json({ ok: false, error: '"성명"과 "Password" 열을 찾을 수 없습니다(내보내기 파일 양식을 확인하세요).' });
    }

    const users = [];
    const warnings = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rawName = row.getCell(nameCol).value;
      const name = String(rawName === null || rawName === undefined ? '' : rawName).trim();
      if (!name) return; // 빈 행은 조용히 건너뜀
      const rawPassword = row.getCell(passwordCol).value;
      const password = String(rawPassword === null || rawPassword === undefined ? '' : rawPassword).trim().padStart(4, '0');
      if (!/^\d{4}$/.test(password)) {
        warnings.push(`행 ${rowNumber}(${name}): Password "${password}"이(가) 4자리 숫자가 아니라 그대로 두었습니다 - 확인이 필요합니다.`);
      }
      let role = roleCol !== -1 ? String(row.getCell(roleCol).value || '').trim().toUpperCase() : '';
      if (!GMS_USER_ROLES.includes(role)) {
        if (role) warnings.push(`행 ${rowNumber}(${name}): 권한 "${role}"은(는) 알 수 없어 USER로 채웠습니다.`);
        role = 'USER';
      }
      users.push({ id: `user_${String(users.length + 1).padStart(3, '0')}`, name, password, role });
    });
    if (users.length === 0) {
      return res.json({ ok: false, error: '가져올 수 있는 유효한 행이 없습니다.' });
    }
    res.json({ ok: true, users, warnings });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── 작업이력 메시지 설정 - "조작화면 Key 조작 할 때" 남길 문구를 버튼ID별로 관리한다.
// 코드 수정 없이 문구만 나중에 고칠 수 있도록 JSON 파일 + 엑셀 왕복 둘 다 지원한다
// (Main 시퀀스 편집기와 동일한 패턴).
app.get('/api/gms/worklog-messages', (req, res) => {
  res.json({ ok: true, messages: loadGmsWorkLogMessages() });
});

app.post('/api/gms/worklog-messages', (req, res) => {
  const messages = Array.isArray(req.body && req.body.messages) ? req.body.messages : null;
  if (!messages) {
    return res.status(400).json({ ok: false, error: 'messages 배열이 필요합니다.' });
  }
  try {
    saveGmsWorkLogMessagesToFile(messages);
    res.json({ ok: true, count: messages.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/gms/worklog-messages/export/xlsx', async (req, res) => {
  const messages = Array.isArray(req.body && req.body.messages) ? req.body.messages : null;
  if (!messages) {
    return res.status(400).json({ ok: false, error: 'messages 배열이 필요합니다.' });
  }
  try {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('작업이력 메시지 설정');
    ws.columns = [
      { header: '버튼ID', key: 'buttonId', width: 34 },
      { header: '메시지', key: 'message', width: 40 },
    ];
    ws.getRow(1).font = { bold: true };
    messages.forEach((m) => ws.addRow({ buttonId: m.buttonId, message: m.message }));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setDownloadFilename(res, `${filePrefix('GMS')}_작업이력메시지_${filenameTimestamp()}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/gms/worklog-messages/import/xlsx', async (req, res) => {
  const fileBase64 = req.body && req.body.fileBase64;
  if (!fileBase64) {
    return res.status(400).json({ ok: false, error: 'fileBase64가 필요합니다.' });
  }
  try {
    const buffer = Buffer.from(fileBase64, 'base64');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    if (!ws) return res.json({ ok: true, messages: [], warnings: ['시트를 찾을 수 없습니다.'] });

    let idCol = -1;
    let msgCol = -1;
    ws.getRow(1).eachCell((cell, colNumber) => {
      const text = String(cell.value === null || cell.value === undefined ? '' : cell.value).trim();
      if (text === '버튼ID') idCol = colNumber;
      else if (text === '메시지') msgCol = colNumber;
    });
    if (idCol === -1 || msgCol === -1) {
      return res.json({ ok: false, error: '"버튼ID"와 "메시지" 열을 찾을 수 없습니다(내보내기 파일 양식을 확인하세요).' });
    }

    const messages = [];
    const warnings = [];
    const seen = new Set();
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const buttonId = String(row.getCell(idCol).value || '').trim();
      if (!buttonId) return; // 빈 행은 조용히 건너뜀
      const message = String(row.getCell(msgCol).value || '').trim();
      if (seen.has(buttonId)) {
        warnings.push(`행 ${rowNumber}: 버튼ID "${buttonId}"가 중복되어 있습니다 - 마지막 값으로 덮어씁니다.`);
        const idx = messages.findIndex((m) => m.buttonId === buttonId);
        if (idx !== -1) messages[idx] = { buttonId, message };
        return;
      }
      seen.add(buttonId);
      messages.push({ buttonId, message });
    });
    if (messages.length === 0) {
      return res.json({ ok: false, error: '가져올 수 있는 유효한 행이 없습니다.' });
    }
    res.json({ ok: true, messages, warnings });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── 화면 제목 설정 - "작업이력" 그리드 A열("HTML화면")에 찍히는 문구를 screenKey별로
// 관리한다. 위 작업이력 메시지 설정과 완전히 동일한 패턴(JSON 파일 + 엑셀 왕복). ──
app.get('/api/gms/screen-titles', (req, res) => {
  res.json({ ok: true, titles: loadGmsScreenTitles() });
});

app.post('/api/gms/screen-titles', (req, res) => {
  const titles = Array.isArray(req.body && req.body.titles) ? req.body.titles : null;
  if (!titles) {
    return res.status(400).json({ ok: false, error: 'titles 배열이 필요합니다.' });
  }
  try {
    saveGmsScreenTitlesToFile(titles);
    res.json({ ok: true, count: titles.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/gms/screen-titles/export/xlsx', async (req, res) => {
  const titles = Array.isArray(req.body && req.body.titles) ? req.body.titles : null;
  if (!titles) {
    return res.status(400).json({ ok: false, error: 'titles 배열이 필요합니다.' });
  }
  try {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('화면 제목 설정');
    ws.columns = [
      { header: '화면key', key: 'screenKey', width: 34 },
      { header: '제목', key: 'title', width: 40 },
    ];
    ws.getRow(1).font = { bold: true };
    titles.forEach((t) => ws.addRow({ screenKey: t.screenKey, title: t.title }));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setDownloadFilename(res, `${filePrefix('GMS')}_화면제목_${filenameTimestamp()}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/gms/screen-titles/import/xlsx', async (req, res) => {
  const fileBase64 = req.body && req.body.fileBase64;
  if (!fileBase64) {
    return res.status(400).json({ ok: false, error: 'fileBase64가 필요합니다.' });
  }
  try {
    const buffer = Buffer.from(fileBase64, 'base64');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    if (!ws) return res.json({ ok: true, titles: [], warnings: ['시트를 찾을 수 없습니다.'] });

    let keyCol = -1;
    let titleCol = -1;
    ws.getRow(1).eachCell((cell, colNumber) => {
      const text = String(cell.value === null || cell.value === undefined ? '' : cell.value).trim();
      if (text === '화면key') keyCol = colNumber;
      else if (text === '제목') titleCol = colNumber;
    });
    if (keyCol === -1 || titleCol === -1) {
      return res.json({ ok: false, error: '"화면key"와 "제목" 열을 찾을 수 없습니다(내보내기 파일 양식을 확인하세요).' });
    }

    const titles = [];
    const warnings = [];
    const seen = new Set();
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const screenKey = String(row.getCell(keyCol).value || '').trim();
      if (!screenKey) return; // 빈 행은 조용히 건너뜀
      const title = String(row.getCell(titleCol).value || '').trim();
      if (seen.has(screenKey)) {
        warnings.push(`행 ${rowNumber}: 화면key "${screenKey}"가 중복되어 있습니다 - 마지막 값으로 덮어씁니다.`);
        const idx = titles.findIndex((t) => t.screenKey === screenKey);
        if (idx !== -1) titles[idx] = { screenKey, title };
        return;
      }
      seen.add(screenKey);
      titles.push({ screenKey, title });
    });
    if (titles.length === 0) {
      return res.json({ ok: false, error: '가져올 수 있는 유효한 행이 없습니다.' });
    }
    res.json({ ok: true, titles, warnings });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── 작업이력(work_log) 기록/조회 - 조작화면(Operation.js)의 logWorkAction()이 실행/확인
// 버튼을 누를 때마다 기록하고, "작업이력" 화면(gms-worklog-widget.js)이 조회한다. ──
app.post('/api/gms/worklog', (req, res) => {
  const body = req.body || {};
  if (!body.action) {
    return res.status(400).json({ ok: false, error: 'action이 필요합니다.' });
  }
  try {
    gmsHistory.recordOperatorAction(body.unitId, {
      action: body.action,
      side: body.side,
      detail: body.detail,
      operatorName: body.operatorName,
      operatorRole: body.operatorRole,
      analogSnapshot: body.analogSnapshot,
      screenKey: body.screenKey,
      screenTitle: body.screenTitle,
      statusLabel: body.statusLabel,
      buttonLabel: body.buttonLabel,
      subSeqId: body.subSeqId,
      subSeqStepNo: body.subSeqStepNo,
      subSeqElapsedSec: body.subSeqElapsedSec,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/gms/worklog', (req, res) => {
  try {
    const { unit, from, to, limit } = req.query;
    const result = gmsHistory.queryOperatorActions({ unitId: unit, from, to, limit });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 클릭 당시 실제로 화면에 보이던 버튼 문구(buttonLabel)를 큰따옴표로 보여준다 - "정확하게
// 어떤 것을 눌렀는지 사람이 알 수 있도록" 요청. buttonLabel이 없는(배지 클릭처럼 buttonId가
// 실제 DOM id가 아니었거나, 이 열이 추가되기 전 기록인) 경우만 buttonId 접미사로 추측한
// 한글(실행/확인/취소 등)로 대체한다 - gms-worklog-widget.js의 formatActionKey()와 동일한
// 규칙(그리드 화면 표시와 엑셀 내보내기가 같은 형식을 쓰도록).
const WORK_LOG_ACTION_TYPE_SUFFIX_LABELS = [
  ['ReturnBtn', '복귀'],
  ['ConfirmBtn', '확인'],
  ['CancelBtn', '취소'],
  ['ExecuteBtn', '실행'],
  ['RunBtn', '실행'],
];
function formatWorkLogActionKey(buttonId, buttonLabel) {
  if (!buttonId && !buttonLabel) return '';
  if (buttonLabel) {
    if (buttonLabel.startsWith('[Main ') || buttonLabel.startsWith('[')) {
      return buttonLabel;
    }
    return `"${buttonLabel}" (${buttonId})`;
  }
  const hit = WORK_LOG_ACTION_TYPE_SUFFIX_LABELS.find(([suffix]) => buttonId.endsWith(suffix));
  const label = hit ? hit[1] : '조작';
  return `${label}(${buttonId}) key`;
}

// 작업이력을 엑셀로 내보낸다 - 웹 그리드 화면과 컬럼 순서를 100% 동일하게 일치시킨다.
app.get('/api/gms/worklog/export/xlsx', async (req, res) => {
  try {
    const { unit, from, to, limit } = req.query;
    const { rows } = gmsHistory.queryOperatorActions({ unitId: unit, from, to, limit: limit || 2000 });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('작업이력');
    const ANALOG_TAGS = [
      'VT', 'VPT', 'FPT', 'L/H_2nd',
      'LPT_A', 'LPT_B', 'NPT_A', 'NPT_B', 'HPT_A', 'HPT_B', 'WI_A', 'WI_B', 'M/H_A', 'M/H_B', 'J/H_A', 'J/H_B',
    ];
    // 웹 그리드(gms-worklog-widget.js)의 HEADER와 1:1 완벽 일치:
    // ['구분', 'HTML화면', '조작 Key', '측', '시각', '조작자', '권한', '자동진행 Step', '자동진행 누적(초)', ...ANALOG_TAGS]
    ws.columns = [
      { header: '구분', key: 'kind', width: 10 },
      { header: 'HTML화면', key: 'screen', width: 20 },
      { header: '조작 Key', key: 'action', width: 50 },
      { header: '측', key: 'side', width: 14 },
      { header: '시각', key: 'ts', width: 22 },
      { header: '조작자', key: 'operator', width: 12 },
      { header: '권한', key: 'role', width: 12 },
      { header: '자동진행 Step', key: 'subSeqStep', width: 14 },
      { header: '자동진행 누적(초)', key: 'subSeqElapsed', width: 18 },
      ...ANALOG_TAGS.map((t) => ({ header: t, key: t, width: 10 })),
    ];
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => {
      let snap = {};
      try { snap = r.analog_snapshot ? JSON.parse(r.analog_snapshot) : {}; } catch (e) { /* 무시 */ }
      const row = {
        kind: r.sub_seq_id ? '자동진행' : '터치키',
        screen: r.screen_title || '',
        action: formatWorkLogActionKey(r.action, r.button_label),
        side: r.side ? `[${r.side}]` : '공통',
        ts: r.ts,
        operator: r.operator_name || '',
        role: r.operator_role || '',
        subSeqStep: r.sub_seq_step_no || '',
        subSeqElapsed: r.sub_seq_elapsed_sec != null ? r.sub_seq_elapsed_sec : '',
      };
      ANALOG_TAGS.forEach((t) => { row[t] = snap[t] === undefined || snap[t] === null ? '' : snap[t]; });
      ws.addRow(row);
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setDownloadFilename(res, `${filePrefix('GMS')}_작업이력_${filenameTimestamp()}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message });
  }
});

// "에러 사항" 화면 - 서브시퀀스가 실제 Alarm Seq. 동작(초기화/이어서재진행/SHUTDOWN)을 수행할
// 때만 gms-sub-sequence-runner.js가 기록한다(Alarm Goto로 가볍게 이동하는 반복문/Option 분기는
// 알람이 아니므로 기록하지 않음 - 요청사항). work_log와 화면 구조는 같지만(작업이력 화면을
// 그대로 본떠 만듦) 완전히 별개의 DB 테이블(error_log)을 쓴다.
app.post('/api/gms/errorlog', (req, res) => {
  const body = req.body || {};
  try {
    gmsHistory.recordErrorLog(body.unitId, {
      side: body.side,
      mainStepType: body.mainStepType,
      subSeqId: body.subSeqId,
      subSeqStepNo: body.subSeqStepNo,
      subSeqElapsedSec: body.subSeqElapsedSec,
      alarmSeqCode: body.alarmSeqCode,
      alarmMessage: body.alarmMessage,
      operatorName: body.operatorName,
      operatorRole: body.operatorRole,
      analogSnapshot: body.analogSnapshot,
      screenKey: body.screenKey,
      screenTitle: body.screenTitle,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/gms/errorlog', (req, res) => {
  try {
    const { unit, from, to, limit } = req.query;
    const result = gmsHistory.queryErrorLog({ unitId: unit, from, to, limit });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/gms/errorlog/export/xlsx', async (req, res) => {
  try {
    const { unit, from, to, limit } = req.query;
    const { rows } = gmsHistory.queryErrorLog({ unitId: unit, from, to, limit: limit || 2000 });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('에러사항');
    const ANALOG_TAGS = [
      'VT', 'VPT', 'FPT', 'L/H_2nd',
      'LPT_A', 'LPT_B', 'NPT_A', 'NPT_B', 'HPT_A', 'HPT_B', 'MPT_A', 'MPT_B', 'WI_A', 'WI_B', 'M/H_A', 'M/H_B', 'J/H_A', 'J/H_B',
    ];
    ws.columns = [
      { header: '시각', key: 'ts', width: 22 },
      { header: 'HTML화면', key: 'screen', width: 20 },
      { header: 'Step', key: 'step', width: 10 },
      { header: '측', key: 'side', width: 10 },
      { header: '조작자', key: 'operator', width: 12 },
      { header: '권한', key: 'role', width: 12 },
      { header: 'Alarm Seq.', key: 'alarmSeq', width: 12 },
      { header: '알람 메시지', key: 'alarmMessage', width: 30 },
      { header: '누적시간(초)', key: 'elapsed', width: 14 },
      ...ANALOG_TAGS.map((t) => ({ header: t, key: t, width: 10 })),
    ];
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => {
      let snap = {};
      try { snap = r.analog_snapshot ? JSON.parse(r.analog_snapshot) : {}; } catch (e) { /* 무시 */ }
      const row = {
        ts: r.ts, screen: r.screen_title || '', step: r.sub_seq_step_no || '', side: r.side || '공통',
        operator: r.operator_name || '', role: r.operator_role || '',
        alarmSeq: r.alarm_seq_code != null ? r.alarm_seq_code : '', alarmMessage: r.alarm_message || '',
        elapsed: r.sub_seq_elapsed_sec != null ? r.sub_seq_elapsed_sec : '',
      };
      ANALOG_TAGS.forEach((t) => { row[t] = snap[t] === undefined || snap[t] === null ? '' : snap[t]; });
      ws.addRow(row);
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setDownloadFilename(res, `${filePrefix('GMS')}_에러사항_${filenameTimestamp()}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/gms/valves', (req, res) => {
  const unitId = req.query.unit;
  const valves = Array.isArray(req.body && req.body.valves) ? req.body.valves : null;
  // 맵 에디터는 pts(아날로그 표시)도 함께 저장한다. 안 넘기면 기존 값 보존.
  const pts = Array.isArray(req.body && req.body.pts) ? req.body.pts : undefined;
  if (!unitId) {
    return res.status(400).json({ ok: false, error: 'unit 쿼리 파라미터가 필요합니다.' });
  }
  if (!valves) {
    return res.status(400).json({ ok: false, error: 'valves 배열이 필요합니다.' });
  }
  try {
    saveGmsValvesToFile(unitId, valves, pts);
    gmsSession.pushLog('SYSTEM', `GMS 맵 저장됨 (${unitId}, 밸브 ${valves.length}개${pts ? `, PT ${pts.length}개` : ''})`, null);
    gmsHistory.recordWork(unitId, 'MAP_SAVE', null, `밸브 ${valves.length}개${pts ? `, PT ${pts.length}개` : ''}`, 'OK');
    res.json({ ok: true, count: valves.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/gms/connect', async (req, res) => {
  try {
    disconnectOtherSessions(gmsSession, normalizeConnType(req.body));
    const status = await gmsSession.connect(req.body || {});
    broadcast({ type: 'gmsConnStatus', payload: status });
    gmsHistory.recordWork(null, 'CONNECT', null, normalizeConnType(req.body), 'OK');
    res.json({ ok: true, status });
  } catch (err) {
    broadcast({ type: 'gmsConnStatus', payload: gmsSession.getStatus() });
    gmsHistory.recordWork(null, 'CONNECT', null, normalizeConnType(req.body), `FAIL: ${err.message}`);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/gms/disconnect', (req, res) => {
  gmsSession.disconnect();
  broadcast({ type: 'gmsConnStatus', payload: gmsSession.getStatus() });
  gmsHistory.recordWork(null, 'DISCONNECT', null, null, 'OK');
  res.json({ ok: true, status: gmsSession.getStatus() });
});

app.post('/api/gms/counters/reset', (req, res) => {
  gmsSession.resetCounters();
  res.json({ ok: true, counters: gmsSession.getStatus().counters });
});

app.post('/api/gms/logs/clear', (req, res) => {
  gmsSession.clearLogs();
  res.json({ ok: true });
});

app.get('/api/gms/conn-status', (req, res) => {
  res.json({ ok: true, status: gmsSession.getStatus(), logs: gmsSession.getRecentLogs(100) });
});

app.post('/api/gms/start', (req, res) => {
  const intervalMs = req.body && req.body.intervalMs;
  const intervalError = validateIntervalMs(intervalMs);
  if (intervalError) return res.status(400).json({ ok: false, error: intervalError });
  try {
    gmsManager.start(intervalMs);
    res.json({ ok: true, status: gmsManager.getStatus() });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/gms/pause', (req, res) => {
  gmsManager.pause();
  res.json({ ok: true, status: gmsManager.getStatus() });
});

app.post('/api/gms/stop', (req, res) => {
  gmsManager.stop();
  res.json({ ok: true, status: gmsManager.getStatus() });
});

app.get('/api/gms/status', (req, res) => {
  res.json({ ok: true, ...gmsManager.getStatus(), values: gmsManager.getValues(), pts: gmsManager.getPtValues() });
});

// 보조 메뉴 "유지보수모드"(기존 조작화면 유지보수 메뉴와는 별개) - PM Mode/Set-up Mode
// 상태 조회/변경. 페이지 로드 시 초기값 조회, 켜고 끌 때 POST(웹소켓으로 전 클라이언트에
// 즉시 브로드캐스트되어 배관도 램프가 함께 갱신된다 - Operation.js/gms.js 참고).
app.get('/api/gms/maintenance-mode', (req, res) => {
  res.json({ ok: true, ...gmsManager.getMaintenanceMode() });
});
app.post('/api/gms/maintenance-mode', (req, res) => {
  const { mode, active } = req.body || {};
  if (mode !== 'pm' && mode !== 'setup') {
    return res.status(400).json({ ok: false, error: 'mode는 "pm" 또는 "setup"이어야 합니다.' });
  }
  try {
    const state = gmsManager.setMaintenanceMode(mode, !!active);
    res.json({ ok: true, ...state });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// 밸브 1개 개폐 명령 - 배관도 클릭 또는 오퍼레이션 화면의 수동 밸브 목록에서 호출.
// 확인 팝업은 클라이언트 쪽 책임이고, 여기서는 실제 비트 쓰기만 수행한다.
app.post('/api/gms/valve/write', async (req, res) => {
  const { tag, value } = req.body || {};
  if (!tag) {
    return res.status(400).json({ ok: false, error: 'tag가 필요합니다.' });
  }
  try {
    await gmsManager.writeValve(tag, value === true || value === 1 || value === '1');
    res.json({ ok: true });
  } catch (err) {
    gmsSession.pushLog('ERROR', `밸브 쓰기 실패: ${err.message}`, null);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GMS 데이터 이력 조회/내보내기 (src/gmsHistory.js) ──────────────────────
// 하단 알람 이력/Live Events 패널과 조작 이력 조회가 사용한다. 필터는 쿼리 파라미터로.

app.get('/api/gms/history/alarms', (req, res) => {
  try {
    const { unit, from, to, grade, q, active, limit, offset } = req.query;
    res.json({ ok: true, ...gmsHistory.queryAlarms({ unitId: unit, from, to, grade, q, activeOnly: active === '1', limit, offset }) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/gms/history/events', (req, res) => {
  try {
    const { unit, from, to, grade, q, limit, offset } = req.query;
    res.json({ ok: true, ...gmsHistory.queryEvents({ unitId: unit, from, to, grade, q, limit, offset }) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/gms/history/worklog', (req, res) => {
  try {
    const { unit, from, to, action, q, limit, offset } = req.query;
    res.json({ ok: true, ...gmsHistory.queryWorkLog({ unitId: unit, from, to, action, q, limit, offset }) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/gms/history/pt-trend', (req, res) => {
  try {
    const { unit, tag, from, to, res: resolution, limit } = req.query;
    if (!unit || !tag) return res.status(400).json({ ok: false, error: 'unit과 tag가 필요합니다.' });
    res.json({ ok: true, rows: gmsHistory.queryPtTrend({ unitId: unit, tag, from, to, res: resolution || 'auto', limit }) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// type=alarms|events|worklog 이력을 엑셀로 내려받는다.
app.get('/api/gms/history/export', async (req, res) => {
  try {
    const { type, unit, from, to } = req.query;
    const defs = {
      alarms: {
        title: '알람이력',
        columns: [
          { header: '발생 시각', key: 'raised_at', width: 24 },
          { header: '해제 시각', key: 'cleared_at', width: 24 },
          { header: '장비', key: 'unit_id', width: 10 },
          { header: '태그', key: 'tag', width: 14 },
          { header: '등급', key: 'grade', width: 8 },
          { header: '메시지', key: 'message', width: 50 },
        ],
        fetch: () => gmsHistory.queryAlarms({ unitId: unit, from, to, limit: 1000 }).rows,
      },
      events: {
        title: 'LiveEvents',
        columns: [
          { header: '시각', key: 'ts', width: 24 },
          { header: '장비', key: 'unit_id', width: 10 },
          { header: '등급', key: 'grade', width: 10 },
          { header: '메시지', key: 'message', width: 60 },
        ],
        fetch: () => gmsHistory.queryEvents({ unitId: unit, from, to, limit: 1000 }).rows,
      },
      worklog: {
        title: '작업이력',
        columns: [
          { header: '시각', key: 'ts', width: 24 },
          { header: '장비', key: 'unit_id', width: 10 },
          { header: '동작', key: 'action', width: 16 },
          { header: '대상', key: 'target', width: 14 },
          { header: '내용', key: 'detail', width: 20 },
          { header: '결과', key: 'result', width: 30 },
        ],
        fetch: () => gmsHistory.queryWorkLog({ unitId: unit, from, to, limit: 1000 }).rows,
      },
    };
    const def = defs[type];
    if (!def) return res.status(400).json({ ok: false, error: 'type은 alarms|events|worklog 중 하나여야 합니다.' });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(def.title);
    ws.columns = def.columns;
    ws.getRow(1).font = { bold: true };
    def.fetch().forEach((row) => ws.addRow(row));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setDownloadFilename(res, `${filePrefix('GMS')}_${def.title}_${filenameTimestamp()}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json({ status: getStatus(), view: getActiveView(), cells: state.cells, logs: mainSession.getRecentLogs(100) });
});

// ── 앱 설정 (설정 페이지) ──
app.get('/api/settings', (req, res) => {
  const settings = loadSettings();
  // 클라이언트 미리보기용으로 저장된 로고를 data URL로 복원해 함께 내려준다.
  const logo = loadLogo();
  if (logo) settings.report.companyLogo = `data:${logo.mime};base64,${logo.buffer.toString('base64')}`;
  res.json({ ok: true, settings });
});

app.post('/api/settings', (req, res) => {
  try {
    const saved = saveSettings(req.body && req.body.settings ? req.body.settings : req.body);
    // 저장 직후에도 로고 data URL을 복원해서 돌려준다(클라이언트가 그대로 미리보기 유지).
    const logo = loadLogo();
    if (logo) saved.report.companyLogo = `data:${logo.mime};base64,${logo.buffer.toString('base64')}`;
    res.json({ ok: true, settings: saved });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/settings/reset', (req, res) => {
  res.json({ ok: true, settings: resetSettings() });
});

// PC 상태 확인: 이 앱은 Omron CX-Server가 아니라 자체 FINS 스택으로 통신하므로,
// 예시 화면의 "CX-Server 검출" 대신 이 앱에 실제로 의미 있는 항목(서버 실행/USB 드라이버)을 점검한다.
app.get('/api/settings/check', (req, res) => {
  const checks = [];
  checks.push({ name: '모니터링 서버', ok: true, detail: `정상 실행 중 (포트 ${PORT})` });

  let usbOk = false;
  let usbDetail = '';
  try {
    const usb = require('usb');
    const list = usb.getDeviceList ? usb.getDeviceList() : [];
    usbOk = true;
    usbDetail = `USB 드라이버 정상 (인식된 장치 ${list.length}개)`;
  } catch (err) {
    usbOk = false;
    usbDetail = 'USB 모듈을 불러올 수 없습니다: ' + err.message;
  }
  checks.push({ name: 'USB(WinUSB) 드라이버', ok: usbOk, detail: usbDetail });

  const allOk = checks.every((c) => c.ok);
  res.json({ ok: true, allOk, checks });
});

// ── PLC 세부 정보 (CPU 정보 클릭 → 팝업) ──
// 세 화면(메인/그리드/트렌드)이 각자 독립된 세션을 가지므로, 각 세션별로 동일한 라우트를
// prefix만 바꿔 등록한다. CJ(FINS)만 상세 지원하고 NX(CIP)는 기본 정보(모델/버전)만 돌려준다.
function registerPlcInfoRoutes(prefix, getSession) {
  // 상세 조회: 모델/버전/메모리 + CPU 운전상태/모드/에러 + 시계 + 최근 에러로그
  app.get(`${prefix}/plc/details`, async (req, res) => {
    const session = getSession();
    const st = session.getStatus();
    if (!st.connected) return res.status(400).json({ ok: false, error: '연결되어 있지 않습니다.' });
    const base = {
      series: st.plcSeries,
      connection: { type: st.connectionType, params: st.connectionParams },
      controllerInfo: st.controllerInfo,
      counters: st.counters,
      latencyMs: st.latencyMs,
    };
    if (st.plcSeries === 'NX') {
      // NX(EtherNet/IP-CIP)는 FINS 명령이 없어 접속 시 읽어둔 기본 정보만 제공한다.
      return res.json({ ok: true, supported: false, ...base });
    }
    const client = session.getClient();
    try {
      const controller = await finsCommands.readControllerFull(client);
      const status = await finsCommands.readCpuStatus(client);
      let clock = null;
      try { clock = await finsCommands.readClock(client); } catch (e) { /* 시계 미지원 CPU면 생략 */ }
      let errorLog = null;
      try { errorLog = await client.readErrorLog({ start: 0, count: 10 }); } catch (e) { /* 생략 */ }
      res.json({ ok: true, supported: true, ...base, controller, status, clock, errorLog });
    } catch (err) {
      session.pushLog('ERROR', 'PLC 세부 정보 조회 실패: ' + err.message, null);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get(`${prefix}/plc/clock`, async (req, res) => {
    const session = getSession();
    const st = session.getStatus();
    if (!st.connected) return res.status(400).json({ ok: false, error: '연결되어 있지 않습니다.' });
    if (st.plcSeries === 'NX') return res.status(400).json({ ok: false, error: '시계 기능은 CJ 시리즈(FINS)에서만 지원됩니다.' });
    try {
      res.json({ ok: true, clock: await finsCommands.readClock(session.getClient()) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // 시계 설정: body { fromPc:true } 또는 { year, month, day, hour, minute, second }
  app.post(`${prefix}/plc/clock`, async (req, res) => {
    const session = getSession();
    const st = session.getStatus();
    if (!st.connected) return res.status(400).json({ ok: false, error: '연결되어 있지 않습니다.' });
    if (st.plcSeries === 'NX') return res.status(400).json({ ok: false, error: '시계 설정은 CJ 시리즈(FINS)에서만 지원됩니다.' });
    const body = req.body || {};
    let dt;
    if (body.fromPc) {
      const d = new Date();
      dt = { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds() };
    } else {
      dt = body;
    }
    const nums = [dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second].map(Number);
    if (!nums.every((v) => Number.isFinite(v))) {
      return res.status(400).json({ ok: false, error: '년/월/일/시/분/초가 모두 필요합니다.' });
    }
    try {
      await finsCommands.writeClock(session.getClient(), dt);
      session.pushLog('SYSTEM', `PLC 시계 설정: ${dt.year}-${dt.month}-${dt.day} ${dt.hour}:${dt.minute}:${dt.second}`, null);
      res.json({ ok: true, clock: await finsCommands.readClock(session.getClient()) });
    } catch (err) {
      session.pushLog('ERROR', 'PLC 시계 설정 실패: ' + err.message, null);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // 운전 모드 변경: body { mode: 'RUN' | 'MONITOR' | 'PROGRAM' }
  app.post(`${prefix}/plc/mode`, async (req, res) => {
    const session = getSession();
    const st = session.getStatus();
    if (!st.connected) return res.status(400).json({ ok: false, error: '연결되어 있지 않습니다.' });
    if (st.plcSeries === 'NX') return res.status(400).json({ ok: false, error: '운전 모드 변경은 CJ 시리즈(FINS)에서만 지원됩니다.' });
    const mode = String((req.body && req.body.mode) || '').toUpperCase();
    if (!['RUN', 'MONITOR', 'PROGRAM'].includes(mode)) {
      return res.status(400).json({ ok: false, error: 'mode는 RUN/MONITOR/PROGRAM 중 하나여야 합니다.' });
    }
    try {
      await finsCommands.setCpuMode(session.getClient(), mode);
      session.pushLog('SYSTEM', `PLC 운전 모드 변경: ${mode}`, null);
      const status = await finsCommands.readCpuStatus(session.getClient());
      res.json({ ok: true, status });
    } catch (err) {
      session.pushLog('ERROR', 'PLC 운전 모드 변경 실패: ' + err.message, null);
      res.status(500).json({ ok: false, error: err.message });
    }
  });
}
registerPlcInfoRoutes('/api', () => mainSession);
registerPlcInfoRoutes('/api/grid', () => gridSession);
registerPlcInfoRoutes('/api/trend', () => trendSession);
registerPlcInfoRoutes('/api/gms', () => gmsSession);

gmsHistory.init(); // GMS 데이터 이력 DB(data/gms-history.db) 준비 - 테이블 생성/보존 정리 타이머 시작

const server = app.listen(PORT, () => {
  console.log(`PLC 모니터링 서버 실행 중: http://localhost:${PORT}`);
  console.log(`로그 파일: ${mainLogFile} / ${gridLogFile}`);
});

wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'status', payload: getStatus() }));
  ws.send(JSON.stringify({
    type: 'memoryValues',
    payload: { area: getActiveView().area, startAddr: getActiveView().startAddr, dataType: getActiveView().dataType, cells: state.cells, lastUpdate: state.lastUpdate },
  }));
  ws.send(JSON.stringify({ type: 'logHistory', payload: mainSession.getRecentLogs(100) }));
  ws.send(JSON.stringify({ type: 'gridStatus', payload: gridManager.getStatus() }));
  ws.send(JSON.stringify({ type: 'gridConnStatus', payload: gridSession.getStatus() }));
  ws.send(JSON.stringify({ type: 'gridConnLogHistory', payload: gridSession.getRecentLogs(100) }));
  ws.send(JSON.stringify({ type: 'trendStatus', payload: trendManager.getStatus() }));
  ws.send(JSON.stringify({ type: 'trendConnStatus', payload: trendSession.getStatus() }));
  ws.send(JSON.stringify({ type: 'trendConnLogHistory', payload: trendSession.getRecentLogs(100) }));
  // 트렌드 화면을 다른 화면으로 옮겼다 돌아와도 그동안 쌓인 그래프가 그대로 보이도록,
  // 서버가 들고 있던 최근 값 기록을 새로 접속한 클라이언트에게 통째로 넘겨준다.
  ws.send(JSON.stringify({ type: 'trendValuesHistory', payload: trendManager.getValueHistory() }));
  ws.send(JSON.stringify({ type: 'gmsStatus', payload: gmsManager.getStatus() }));
  ws.send(JSON.stringify({ type: 'gmsConnStatus', payload: gmsSession.getStatus() }));
  ws.send(JSON.stringify({ type: 'gmsConnLogHistory', payload: gmsSession.getRecentLogs(100) }));
  ws.send(JSON.stringify({ type: 'gmsValues', payload: { values: gmsManager.getValues(), pts: gmsManager.getPtValues(), lastUpdate: null } }));
});

process.on('SIGINT', () => {
  gridManager.stop();
  trendManager.stop();
  gmsManager.stop();
  stopPolling();
  mainSession.getClient().disconnect();
  gridSession.getClient().disconnect();
  trendSession.getClient().disconnect();
  gmsSession.getClient().disconnect();
  gmsHistory.close();
  process.exit(0);
});
