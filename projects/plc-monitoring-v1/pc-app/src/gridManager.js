'use strict';

const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { AREA_CODES, emAreaCode } = require('./usbFinsClient');
const { wordCountFor, decodeValue, encodeValue, formatAddress } = require('./dataTypes');
const { loadSettings, loadLogo, filePrefix, reconnectPolicy, resolveSnapshotDir } = require('./settingsManager');
const { nowLocalIso } = require('./timeUtils');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const VARIABLES_FILE = path.join(dataDir, 'variables.json');
const defaultSnapshotDir = path.join(__dirname, '..', 'logs', 'snapshots');
if (!fs.existsSync(defaultSnapshotDir)) fs.mkdirSync(defaultSnapshotDir, { recursive: true });

const MAX_ITEMS_PER_READ = 32; // server.js와 동일한 기준으로 청크 분할

/**
 * Content-Disposition에 파일명을 안전하게 싣는다(RFC 5987). 파일명(특히 사용자가 설정한
 * filePrefix)에 한글이 섞이면 raw 헤더 값으로 그대로 넣었을 때 Node가 예외를 던지므로
 * (server.js의 setDownloadFilename과 동일한 이유 - 모듈 순환 참조를 피하려 여기 따로 둔다),
 * ASCII 폴백 + filename*=UTF-8'' 인코딩을 함께 보낸다.
 */
function setDownloadFilename(res, filename) {
  const asciiFallback = filename.replace(/[^\x20-\x7e]/g, '_');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
  );
}

/** 'D','H','W','CIO','E0'~'E24' 같은 문자열을 FINS 영역 코드로 변환 */
function areaNameToCode(name) {
  const key = String(name || '').trim().toUpperCase();
  if (AREA_CODES[key] !== undefined) return AREA_CODES[key];
  const m = key.match(/^E(\d{1,2})$/);
  if (m) {
    const bank = Number(m[1]);
    return emAreaCode(bank);
  }
  throw new Error(`알 수 없는 영역: "${name}" (D/H/W/CIO/E0~E24 형식이어야 합니다)`);
}

/**
 * 비트 단위 접근용 FINS 영역 코드로 변환.
 * Omron 공식 매뉴얼 기준, 비트 영역 코드는 항상 "워드 영역 코드 - 0x80" 이다.
 * (예: D 워드=0x82→비트=0x02, CIO 워드=0xB0→비트=0x30, W 워드=0xB1→비트=0x31,
 *      H 워드=0xB2→비트=0x32, EM뱅크n 워드=0xA0+n→비트=0x20+n 등)
 * 워드 영역 코드에 그대로 bit 필드만 얹어서 보내면 일부 영역/비트에서만 우연히
 * 동작하고 나머지는 실패하는 원인이 되므로, BOOL 타입은 반드시 이 코드를 써야 한다.
 */
function areaNameToBitCode(name) {
  return areaNameToCode(name) - 0x80;
}

// ── 변수 목록 파일 저장/로드 ──
function loadVariables() {
  try {
    if (!fs.existsSync(VARIABLES_FILE)) return [];
    const raw = fs.readFileSync(VARIABLES_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.variables) ? data.variables : [];
  } catch (e) {
    return [];
  }
}

/** 사용자가 그리드에 자유롭게 추가한 열(예: "비고")의 헤더 이름 목록. L열(비교판정) 다음부터. */
function loadExtraHeaders() {
  try {
    if (!fs.existsSync(VARIABLES_FILE)) return [];
    const raw = fs.readFileSync(VARIABLES_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.extraHeaders) ? data.extraHeaders : [];
  } catch (e) {
    return [];
  }
}

/** 저장해둔 시트 서식(열 너비/행 높이). 없으면 null. */
function loadLayout() {
  try {
    if (!fs.existsSync(VARIABLES_FILE)) return null;
    const raw = fs.readFileSync(VARIABLES_FILE, 'utf8');
    const data = JSON.parse(raw);
    return data.layout && typeof data.layout === 'object' ? data.layout : null;
  } catch (e) {
    return null;
  }
}

function saveVariablesToFile(variables, extraHeaders, layout) {
  fs.writeFileSync(
    VARIABLES_FILE,
    JSON.stringify(
      { variables, extraHeaders: extraHeaders || [], layout: layout || null, savedAt: nowLocalIso() },
      null,
      2
    )
  );
}

function chunkItems(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * 변수 목록을 FINS 읽기 항목(items)으로 펼치고,
 * 각 변수가 items 배열의 어느 구간에 해당하는지 매핑 정보를 함께 반환한다.
 *
 * 항목/결과 매칭 키는 변수의 표시 이름(label)이 아니라 variables 배열 내 위치(index)를 쓴다.
 * label은 사용자가 자유롭게(중복 가능하게) 입력하는 텍스트라서, 예를 들어 "변수추가" 버튼으로
 * 만든 기본값 "NEW_VAR"가 여러 행에 그대로 남아 있으면 label을 키로 쓸 경우 서로 다른 행의
 * 값이 같은 키에 겹쳐 써져 마지막 행 값만 남고 나머지 행은 갱신되지 않는 문제가 있었다.
 */
function buildReadPlan(variables) {
  const items = [];
  const plan = []; // { variable, index, startIdx, wordCount }
  variables.forEach((v, index) => {
    let area;
    try {
      // BOOL은 비트 전용 영역 코드를 써야 실제 비트값이 정상적으로 읽힘
      area = v.dataType === 'BOOL' ? areaNameToBitCode(v.area) : areaNameToCode(v.area);
    } catch (e) {
      plan.push({ variable: v, index, startIdx: -1, wordCount: 0, error: e.message });
      return;
    }
    const wordCount = wordCountFor(v.dataType, v.length);
    const startIdx = items.length;
    for (let i = 0; i < wordCount; i++) {
      items.push({ label: `${index}#${i}`, area, addr: v.address + i, bit: v.bit || 0 });
    }
    plan.push({ variable: v, index, startIdx, wordCount });
  });
  return { items, plan };
}

// 한 폴링 사이클의 모든 청크가 연속으로 이 횟수만큼 실패하면 자동 재연결을 시도한다.
const RECONNECT_AFTER_CYCLES = 2;

function createGridManager({ getClient, broadcast, pushLog, recordRecvSuccess, reconnectClient }) {
  // ── 폴링 상태 관리 ──
  // 인스턴스마다 독립된 상태를 가진다 - 다중 PLC 세션(세션 레지스트리)에서 매니저를
  // 여러 개 만들 수 있도록 모듈 레벨이 아니라 팩토리 안에 둔다.
  const gridState = {
    status: 'stopped', // 'stopped' | 'running' | 'paused'
    intervalMs: 1000,
    timer: null,
    values: {}, // { index(문자열): decodedValue }
    consecutiveCycleErrors: 0,
    reconnectAttempts: 0, // 연속 자동 재연결 시도 횟수 (성공 시 0으로 리셋)
    lastReconnectAt: 0, // 마지막 재연결 시도 시각(ms) - 설정된 간격만큼 벌어졌을 때만 재시도
  };

  // 설정(자동 재연결 간격/최대 시도)을 반영한 자동 복구. 간격이 안 지났거나 최대 시도를
  // 넘으면 건너뛴다(maxRetries=0이면 무제한).
  async function tryAutoReconnect() {
    if (!reconnectClient) return;
    const { intervalMs, maxRetries } = reconnectPolicy();
    const now = Date.now();
    if (now - gridState.lastReconnectAt < intervalMs) return; // 아직 재시도 간격 안 됨
    if (maxRetries > 0 && gridState.reconnectAttempts >= maxRetries) {
      if (gridState.reconnectAttempts === maxRetries) {
        pushLog('WARN', `[그리드] 자동 재연결 최대 시도(${maxRetries}회) 초과 - 자동 복구를 멈춥니다. 수동으로 다시 연결하세요.`, null);
        gridState.reconnectAttempts += 1; // 경고를 한 번만 남기도록
      }
      return;
    }
    gridState.lastReconnectAt = now;
    gridState.reconnectAttempts += 1;
    try {
      await reconnectClient();
      pushLog('SYSTEM', `[그리드] 자동 재연결 시도 ${gridState.reconnectAttempts}회`, null);
    } catch (err) {
      pushLog('ERROR', `[그리드] 자동 재연결 실패(${gridState.reconnectAttempts}회): ${err.message}`, null);
    }
  }

  async function pollOnce(variables) {
    const { items, plan } = buildReadPlan(variables);
    const client = getClient();
    const rawByItemLabel = {};
    const chunks = chunkItems(items, MAX_ITEMS_PER_READ);
    let anySuccess = false;

    for (const chunk of chunks) {
      if (gridState.status !== 'running') break;
      try {
        const results = await client.readItems(chunk);
        results.forEach((r, idx) => {
          rawByItemLabel[chunk[idx].label] = r.value;
        });
        recordRecvSuccess();
        anySuccess = true;
      } catch (err) {
        pushLog('ERROR', `[그리드] 읽기 실패: ${err.message}`, null);
      }
    }

    // 통신이 몇 사이클 연속으로 전부 실패하면(예: 정지 후 재시작 시 USB/소켓이 응답 불능 상태로
    // 굳어버리는 경우) 사용자가 수동으로 하던 "연결 해제 후 재연결"을 자동으로 수행한다.
    if (chunks.length > 0) {
      if (anySuccess) {
        gridState.consecutiveCycleErrors = 0;
        gridState.reconnectAttempts = 0; // 통신이 살아나면 재연결 시도 카운터도 리셋
      } else {
        gridState.consecutiveCycleErrors += 1;
        if (gridState.consecutiveCycleErrors >= RECONNECT_AFTER_CYCLES && reconnectClient) {
          gridState.consecutiveCycleErrors = 0;
          await tryAutoReconnect();
        }
      }
    }

    // values는 label이 아니라 variables 배열 내 index(문자열)를 키로 쓴다 - buildReadPlan 주석 참고
    const values = {};
    for (const p of plan) {
      if (p.error) {
        values[p.index] = null;
        continue;
      }
      const words = [];
      for (let i = 0; i < p.wordCount; i++) {
        words.push(rawByItemLabel[`${p.index}#${i}`]);
      }
      values[p.index] = decodeValue(p.variable.dataType, words, p.variable.bit);
    }

    gridState.values = { ...gridState.values, ...values };
    broadcast({ type: 'gridValues', payload: { values, lastUpdate: nowLocalIso() } });
  }

  async function loopStep() {
    if (gridState.status !== 'running') return;
    const variables = loadVariables();
    const startedAt = Date.now();
    try {
      await pollOnce(variables);
    } catch (e) {
      pushLog('ERROR', '[그리드] 폴링 오류: ' + e.message, null);
    }
    if (gridState.status !== 'running') return;
    const elapsed = Date.now() - startedAt;
    const wait = Math.max(0, gridState.intervalMs - elapsed);
    gridState.timer = setTimeout(loopStep, wait);
  }

  function start(intervalMs) {
    const client = getClient();
    if (!client || !client.connected) {
      throw new Error('PLC에 먼저 연결해야 그리드 폴링을 시작할 수 있습니다.');
    }
    if (intervalMs) gridState.intervalMs = intervalMs;
    if (gridState.timer) clearTimeout(gridState.timer);
    gridState.status = 'running';
    gridState.reconnectAttempts = 0; // 새로 시작하면 자동 재연결 카운터 초기화
    gridState.lastReconnectAt = 0;
    pushLog('SYSTEM', `[그리드] 폴링 시작 (주기 ${gridState.intervalMs}ms)`, null);
    broadcast({ type: 'gridStatus', payload: { status: gridState.status, intervalMs: gridState.intervalMs } });
    loopStep();
  }

  function pause() {
    if (gridState.timer) {
      clearTimeout(gridState.timer);
      gridState.timer = null;
    }
    gridState.status = 'paused';
    pushLog('SYSTEM', '[그리드] 폴링 일시정지', null);
    broadcast({ type: 'gridStatus', payload: { status: gridState.status, intervalMs: gridState.intervalMs } });
  }

  function stop() {
    if (gridState.timer) {
      clearTimeout(gridState.timer);
      gridState.timer = null;
    }
    gridState.status = 'stopped';
    pushLog('SYSTEM', '[그리드] 폴링 정지', null);
    broadcast({ type: 'gridStatus', payload: { status: gridState.status, intervalMs: gridState.intervalMs } });
  }

  function getStatus() {
    return { status: gridState.status, intervalMs: gridState.intervalMs };
  }

  function getValues() {
    return gridState.values;
  }

  /**
   * 변수 하나에 값을 씀. BOOL은 워드 전체를 덮어쓰면 다른 비트가 같이 바뀌므로
   * 현재 워드를 먼저 읽어(Read) 해당 비트만 바꾼 뒤 다시 쓰는(Modify-Write) 방식 사용.
   * 그 외 타입은 필요한 워드 수만큼 순서대로 씀.
   */
  async function writeVariable(variable, rawValue) {
    const client = getClient();
    if (!client || !client.connected) {
      throw new Error('PLC에 연결되어 있지 않습니다.');
    }

    if (variable.dataType === 'BOOL') {
      // 비트 전용 영역 코드 + writeBit()으로 그 비트만 바뀌고 나머지 비트는 PLC가 그대로 보존한다.
      const bitArea = areaNameToBitCode(variable.area);
      const bitOn = rawValue === true || rawValue === 1 || rawValue === '1' || String(rawValue).toLowerCase() === 'true';
      await client.writeBit(bitArea, variable.address, variable.bit || 0, bitOn);
      return;
    }

    const area = areaNameToCode(variable.area);
    const wordCount = wordCountFor(variable.dataType, variable.length);
    const words = encodeValue(variable.dataType, rawValue, wordCount);
    for (let i = 0; i < words.length; i++) {
      await client.writeWord(area, variable.address + i, words[i] & 0xffff);
    }
  }

  /** rows: [{ label, area, address, bit, dataType, length, value }] - value가 있는 행만 씀 */
  async function writeVariables(rows) {
    const results = [];
    for (const row of rows) {
      if (row.value === undefined || row.value === null || row.value === '') continue;
      try {
        await writeVariable(row, row.value);
        results.push({ label: row.label, ok: true });
        // 실제 와이어 이벤트(SEND/RECV)는 writeVariable 내부의 writeWord/writeBit가 이미 로깅했으므로,
        // 이 줄은 사람이 읽을 요약일 뿐이다. 'SEND'로 남기면 카운터가 중복 집계되고, 지연시간 계산용
        // lastSendAt이 잘못 갱신되어 다음 실제 요청의 지연시간이 틀어진다.
        pushLog('SYSTEM', `[그리드 쓰기] ${row.label} = ${row.value}`, null);
      } catch (err) {
        results.push({ label: row.label, ok: false, error: err.message });
        pushLog('ERROR', `[그리드 쓰기] ${row.label} 실패: ${err.message}`, null);
      }
    }
    return results;
  }

  // ── Excel 내보내기 ──
  async function exportXlsx(res) {
    const variables = loadVariables();
    const extraHeaders = loadExtraHeaders();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('변수 목록');
    ws.columns = [
      { header: '변수명', key: 'label', width: 20 },
      { header: '영역', key: 'area', width: 12 },
      { header: '주소', key: 'address', width: 12 },
      { header: '타입', key: 'dataType', width: 10 },
      { header: '길이(STRING)', key: 'length', width: 12 },
      { header: '설명(코멘트)', key: 'description', width: 24 },
      { header: '현재값', key: 'value', width: 16 },
      ...extraHeaders.map((h, i) => ({ header: h, key: `extra${i}`, width: 16 })),
    ];
    ws.getRow(1).font = { bold: true };
    variables.forEach((v, index) => {
      const row = {
        label: v.label,
        area: v.area,
        address: formatAddress(v.address, v.bit, v.dataType),
        dataType: v.dataType,
        length: v.length || '',
        description: v.description || '',
        value: gridState.values[index] ?? '',
      };
      extraHeaders.forEach((h, i) => {
        row[`extra${i}`] = (v.extra && v.extra[h]) || '';
      });
      ws.addRow(row);
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setDownloadFilename(res, `${filePrefix('SNAP')}_Recipe_${Date.now()}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  }

  // ── PDF 내보내기 ──
  function exportPdf(res) {
    const variables = loadVariables();
    const extraHeaders = loadExtraHeaders();
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

    // 한글 폰트가 시스템에 있으면 사용 (Windows 기본: 맑은 고딕). 없으면 기본 폰트로 진행
    // (기본 폰트는 한글을 표시하지 못하므로, 필요하면 실제 배포 환경에 폰트를 추가하세요)
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
      } catch (e) {
        /* ignore */
      }
    }

    res.setHeader('Content-Type', 'application/pdf');
    setDownloadFilename(res, `${filePrefix('SNAP')}_variables_${Date.now()}.pdf`);
    doc.pipe(res);

    // 설정 페이지에서 등록한 회사 로고가 있으면 우측 상단에 넣는다(문서 제목 접두사도 설정값 사용).
    const settings = loadSettings();
    const logo = loadLogo();
    if (logo) {
      try {
        const logoW = 120;
        doc.image(logo.buffer, doc.page.width - doc.page.margins.right - logoW, doc.page.margins.top, { fit: [logoW, 46] });
      } catch (e) {
        /* 지원하지 않는 이미지 형식이면 무시하고 진행 */
      }
    }

    const titlePrefix = (settings.report && settings.report.pdfTitlePrefix) || '';
    const baseTitle = koreanFontAvailable ? '변수 목록' : 'Variable List';
    doc.fontSize(16).text(titlePrefix + baseTitle, { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#666').text(new Date().toLocaleString('ko-KR'));
    doc.moveDown(1);

    const headers = (koreanFontAvailable
      ? ['변수명', '영역', '주소', '타입', '길이', '설명', '현재값']
      : ['Label', 'Area', 'Addr', 'Type', 'Len', 'Description', 'Value']
    ).concat(extraHeaders);
    const colWidths = [110, 50, 60, 60, 40, 140, 110].concat(extraHeaders.map(() => 100));
    const startX = doc.page.margins.left;
    let y = doc.y;

    doc.fontSize(10).fillColor('#000');
    function drawRow(cells, bold) {
      let x = startX;
      cells.forEach((cell, i) => {
        doc.text(String(cell), x, y, { width: colWidths[i], continued: false });
        x += colWidths[i];
      });
      y += 18;
      if (y > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
        y = doc.page.margins.top;
      }
    }

    drawRow(headers, true);
    doc.moveTo(startX, y).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y).strokeColor('#999').stroke();
    y += 4;

    variables.forEach((v, index) => {
      drawRow([
        v.label,
        v.area,
        formatAddress(v.address, v.bit, v.dataType),
        v.dataType,
        v.length || '',
        v.description || '',
        gridState.values[index] ?? '',
        ...extraHeaders.map((h) => (v.extra && v.extra[h]) || ''),
      ]);
    });

    doc.end();
  }

  return { start, pause, stop, getStatus, getValues, exportXlsx, exportPdf, writeVariables };
}

/** "YYYYMMDD_HHmmss" 형식 타임스탬프 (파일명용) */
function fileStamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/**
 * "📸 스냅샷" 버튼 - 현재 그리드 상태(변수+현재값+설명+Snapshots Start/End)를 xlsx 파일로
 * 설정된 스냅샷 폴더에 저장한다. 시트에 값 자체는 클라이언트가 이미 Start/End 열에 복사해뒀고,
 * 여기서는 그 스냅샷 시점의 전체 상태를 감사(audit) 기록으로 남기는 역할만 한다.
 * @param {Array<{label,area,addr,dataType,description,value,snapStart,snapEnd}>} rows
 * @returns {Promise<string>} 저장된 파일 경로
 */
async function saveSnapshotFile(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('스냅샷');
  ws.columns = [
    { header: '변수명', key: 'label', width: 20 },
    { header: '영역', key: 'area', width: 10 },
    { header: '주소', key: 'addr', width: 12 },
    { header: '타입', key: 'dataType', width: 10 },
    { header: '설명(코멘트)', key: 'description', width: 24 },
    { header: '현재값', key: 'value', width: 14 },
    { header: 'Snapshots(Start)', key: 'snapStart', width: 16 },
    { header: 'Snapshots(End)', key: 'snapEnd', width: 16 },
  ];
  ws.getRow(1).font = { bold: true };
  (rows || []).forEach((r) => ws.addRow(r));

  const dir = resolveSnapshotDir(defaultSnapshotDir);
  const fileName = `${filePrefix('SNAP')}_Snapshots__${fileStamp()}.xlsx`;
  const filePath = path.join(dir, fileName);
  await wb.xlsx.writeFile(filePath);
  return filePath;
}

/**
 * "⚖ 비교판정" 결과 요약을 Excel 또는 PDF로 만들어 Buffer로 반환한다(저장 위치는 클라이언트가
 * Save As로 고르므로, 서버는 디스크에 쓰지 않고 응답 바디로 그대로 돌려준다).
 * @param {{total,okCount,ngCount,matchPct,items:[{label,description,snapStart,snapEnd,result}]}} summary
 * @param {'xlsx'|'pdf'} format
 */
async function buildCompareReport(summary, format) {
  if (format === 'pdf') {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

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

      const settings = loadSettings();
      const logo = loadLogo();
      if (logo) {
        try {
          const logoW = 120;
          doc.image(logo.buffer, doc.page.width - doc.page.margins.right - logoW, doc.page.margins.top, { fit: [logoW, 46] });
        } catch (e) { /* ignore */ }
      }
      const titlePrefix = (settings.report && settings.report.pdfTitlePrefix) || '';
      doc.fontSize(16).text(titlePrefix + (koreanFontAvailable ? '비교판정 결과 리포트' : 'Comparison Report'), { align: 'left' });
      doc.moveDown(0.3);
      doc.fontSize(9).fillColor('#666').text(new Date().toLocaleString('ko-KR'));
      doc.moveDown(1);

      doc.fontSize(11).fillColor('#000');
      doc.text(
        (koreanFontAvailable
          ? `비교 항목: ${summary.total}개  |  일치율: ${summary.matchPct}%  |  OK: ${summary.okCount}개  |  NG: ${summary.ngCount}개`
          : `Compared: ${summary.total}  |  Match: ${summary.matchPct}%  |  OK: ${summary.okCount}  |  NG: ${summary.ngCount}`)
      );
      doc.moveDown(1);

      const ngItems = (summary.items || []).filter((i) => i.result === 'NG');
      const headers = koreanFontAvailable ? ['변수명', 'Start', 'End', '설명'] : ['Label', 'Start', 'End', 'Description'];
      const colWidths = [130, 90, 90, 200];
      const startX = doc.page.margins.left;
      let y = doc.y;
      function drawRow(cells, opts = {}) {
        let x = startX;
        cells.forEach((cell, i) => {
          doc.fillColor(opts.color || '#000').text(String(cell), x, y, { width: colWidths[i] });
          x += colWidths[i];
        });
        y += 18;
        if (y > doc.page.height - doc.page.margins.bottom - 20) {
          doc.addPage();
          y = doc.page.margins.top;
        }
      }
      doc.fontSize(10);
      if (ngItems.length > 0) {
        doc.fontSize(12).fillColor('#000').text(koreanFontAvailable ? 'NG 항목' : 'NG Items', startX, y);
        y += 20;
        doc.fontSize(10);
        drawRow(headers);
        doc.moveTo(startX, y).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y).strokeColor('#999').stroke();
        y += 4;
        ngItems.forEach((item) => {
          drawRow([item.label, item.snapStart ?? '', item.snapEnd ?? '', item.description || ''], { color: '#c23c3c' });
        });
      } else {
        doc.fontSize(11).fillColor('#1a9b5c').text(koreanFontAvailable ? 'NG 항목이 없습니다 (전체 일치)' : 'No NG items (all matched)');
      }
      doc.end();
    });
  }

  // xlsx
  const wb = new ExcelJS.Workbook();
  const summarySheet = wb.addWorksheet('요약');
  summarySheet.columns = [{ header: '항목', key: 'k', width: 20 }, { header: '값', key: 'v', width: 20 }];
  summarySheet.getRow(1).font = { bold: true };
  summarySheet.addRows([
    { k: '비교 항목 수', v: summary.total },
    { k: '일치율(%)', v: summary.matchPct },
    { k: 'OK', v: summary.okCount },
    { k: 'NG', v: summary.ngCount },
  ]);

  const itemSheet = wb.addWorksheet('상세');
  itemSheet.columns = [
    { header: '변수명', key: 'label', width: 20 },
    { header: 'Snapshots(Start)', key: 'snapStart', width: 16 },
    { header: 'Snapshots(End)', key: 'snapEnd', width: 16 },
    { header: '판정', key: 'result', width: 10 },
    { header: '설명(코멘트)', key: 'description', width: 30 },
  ];
  itemSheet.getRow(1).font = { bold: true };
  (summary.items || []).forEach((item) => {
    const row = itemSheet.addRow(item);
    if (item.result === 'NG') {
      row.getCell('result').font = { color: { argb: 'FFC23C3C' }, bold: true };
    }
  });

  return wb.xlsx.writeBuffer();
}

module.exports = {
  areaNameToCode,
  areaNameToBitCode,
  loadVariables,
  loadExtraHeaders,
  loadLayout,
  saveVariablesToFile,
  saveSnapshotFile,
  buildCompareReport,
  createGridManager,
};
