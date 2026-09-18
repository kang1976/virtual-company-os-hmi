function toast(message, kind = '') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast show ${kind}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.className = 'toast';
  }, 2500);
}

// 그리드 페이지(grid-app)의 DATA_TYPES와 동일한 목록. 순수 HTML/JS라 빌드 스텝이 없어서
// 별도 모듈 공유 대신 짧은 배열 리터럴을 그대로 복사해 쓴다.
const DATA_TYPES = [
  'INT', 'WORD', 'DINT', 'LINT', 'UINT', 'UDINT', 'ULINT',
  'UBCD', 'UDBCD', 'ULBCD', 'DWORD', 'LWORD', 'REAL', 'LREAL', 'STRING', 'BOOL',
];
// src/dataTypes.js의 TYPE_WORD_COUNT와 동일 - 데이터타입 하나당 몇 워드를 쓰는지
// (페이지 이동/주소 범위 계산에만 필요, 실제 값 디코딩은 서버가 해서 보내줌)
const TYPE_WORD_COUNT = {
  BOOL: 1, INT: 1, UINT: 1, WORD: 1, UBCD: 1,
  DINT: 2, UDINT: 2, DWORD: 2, UDBCD: 2, REAL: 2,
  LINT: 4, ULINT: 4, LWORD: 4, ULBCD: 4, LREAL: 4,
};
function wordCountFor(dataType, length) {
  if (dataType === 'STRING') return Math.max(1, Number(length) || 1);
  return TYPE_WORD_COUNT[dataType] || 1;
}

const valueGrid = document.getElementById('valueGrid');
const bitTableWrap = document.getElementById('bitTableWrap');
const bitTable = document.getElementById('bitTable');
const viewSummary = document.getElementById('viewSummary');
const areaTabs = document.getElementById('areaTabs');
const startAddrInput = document.getElementById('startAddrInput');
const pageSizeInput = document.getElementById('pageSizeInput');
const dataTypeSelect = document.getElementById('dataTypeSelect');
const stringLengthGroup = document.getElementById('stringLengthGroup');
const stringLengthInput = document.getElementById('stringLengthInput');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const applyMemoryBtn = document.getElementById('applyMemoryBtn');
const exportMemoryBtn = document.getElementById('exportMemoryBtn');
const fillAllInput = document.getElementById('fillAllInput');
const fillAllBtn = document.getElementById('fillAllBtn');
const logList = document.getElementById('logList');
const statusPill = document.getElementById('statusPill');
const statusText = document.getElementById('statusText');
const cpuInfo = document.getElementById('cpuInfo');
const lastUpdateEl = document.getElementById('lastUpdate');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const plcSeriesSelect = document.getElementById('plcSeriesSelect');
const connType = document.getElementById('connType');
const connHost = document.getElementById('connHost');
const connPort = document.getElementById('connPort');
const intervalInput = document.getElementById('intervalInput');
const pollStartBtn = document.getElementById('pollStartBtn');
const pollPauseBtn = document.getElementById('pollPauseBtn');
const pollStopBtn = document.getElementById('pollStopBtn');
const pollStatusText = document.getElementById('pollStatusText');
const cntSend = document.getElementById('cntSend');
const cntRecv = document.getElementById('cntRecv');
const cntErr = document.getElementById('cntErr');
const cntLatency = document.getElementById('cntLatency');
const resetCountersBtn = document.getElementById('resetCountersBtn');
const themeSelect = document.getElementById('themeSelect');
const clearLogBtn = document.getElementById('clearLogBtn');
const errorLogBtn = document.getElementById('errorLogBtn');
const errorLogSummary = document.getElementById('errorLogSummary');
const errorLogList = document.getElementById('errorLogList');

// ── 메모리 탐색기 상태 ──
// 서버(activeView)와 같은 모양을 클라이언트에도 두고, 탭/시작주소/페이지크기/데이터타입/길이가
// 바뀔 때마다 /api/memory/view로 서버에 반영한다. 실제 값 디코딩(BOOL 제외)은 서버가 해서 보내준다.
let clientView = { area: 'D', startAddr: 0, pageSize: 128, dataType: 'WORD', length: 1 };
let areaList = []; // [{key, label, maxWords}, ...] - /api/memory/areas 응답
const cellRefs = {}; // addr -> { cellEl, valueEl, inputEl } (일반/STRING 모드)
const editedCells = new Map(); // addr -> 새 값 (일반/STRING 모드에서 사용자가 입력한 값)
const editedBits = new Map(); // `${addr}_${bit}` -> 0|1 (BOOL 모드에서 토글한 비트)

function populateDataTypeSelect() {
  dataTypeSelect.innerHTML = '';
  for (const t of DATA_TYPES) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    dataTypeSelect.appendChild(opt);
  }
  dataTypeSelect.value = clientView.dataType;
}
populateDataTypeSelect();

function renderAreaTabs() {
  areaTabs.innerHTML = '';
  for (const a of areaList) {
    const btn = document.createElement('button');
    btn.textContent = a.label;
    btn.className = a.key === clientView.area ? 'active' : '';
    btn.addEventListener('click', () => {
      if (a.key === clientView.area) return;
      // 영역만 보내고 시작주소/페이지크기/타입은 보내지 않는다 - 그래야 서버가 그 영역에서
      // 마지막으로 쓰던 설정을 그대로 복원해준다(다른 영역의 설정으로 덮어쓰지 않도록).
      sendAreaChange(a.key);
    });
    areaTabs.appendChild(btn);
  }
}

async function fetchAreas() {
  try {
    const res = await fetch('/api/memory/areas');
    const data = await res.json();
    if (!data.ok) return;
    areaList = data.areas;
    if (data.view) {
      clientView = data.view;
      dataTypeSelect.value = clientView.dataType;
      startAddrInput.value = clientView.startAddr;
      pageSizeInput.value = clientView.pageSize;
      stringLengthInput.value = clientView.length;
      updateStringLengthVisibility();
    }
    renderAreaTabs();
  } catch (e) {
    /* 연결 전에는 실패할 수 있음 - 무시 */
  }
}

function updateStringLengthVisibility() {
  stringLengthGroup.style.display = dataTypeSelect.value === 'STRING' ? 'flex' : 'none';
}
dataTypeSelect.addEventListener('change', updateStringLengthVisibility);

/** /api/memory/view에 POST하고, 성공하면 응답으로 받은 뷰로 화면을 갱신하는 공통 처리 */
async function postViewChange(body) {
  try {
    const res = await fetch('/api/memory/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) {
      toast('뷰 변경 실패: ' + data.error, 'err');
      return;
    }
    clientView = data.view;
    editedCells.clear();
    editedBits.clear();
    startAddrInput.value = clientView.startAddr;
    pageSizeInput.value = clientView.pageSize;
    dataTypeSelect.value = clientView.dataType;
    stringLengthInput.value = clientView.length;
    updateStringLengthVisibility();
    renderAreaTabs();
  } catch (e) {
    toast('뷰 변경 실패: ' + e.message, 'err');
  }
}

/** 같은 영역 내에서 주소/타입/길이/페이지크기 등 일부만 바꿀 때 - 현재 영역 컨텍스트를 유지한 채 보낸다 */
async function sendViewChange(patch) {
  await postViewChange({ ...clientView, ...patch });
}

/** 다른 영역 탭으로 전환할 때 - 그 영역에서 마지막으로 쓰던 설정을 서버가 그대로 복원해준다 */
async function sendAreaChange(areaKey) {
  await postViewChange({ area: areaKey });
}

dataTypeSelect.addEventListener('change', () => {
  const length = dataTypeSelect.value === 'STRING' ? Number(stringLengthInput.value) || 8 : 1;
  sendViewChange({ dataType: dataTypeSelect.value, length });
});
stringLengthInput.addEventListener('change', () => {
  sendViewChange({ length: Number(stringLengthInput.value) || 8 });
});
pageSizeInput.addEventListener('change', () => {
  sendViewChange({ pageSize: Number(pageSizeInput.value) || 128 });
});
startAddrInput.addEventListener('change', () => {
  sendViewChange({ startAddr: Number(startAddrInput.value) || 0 });
});
prevPageBtn.addEventListener('click', () => {
  const wordCount = wordCountFor(clientView.dataType, clientView.length);
  const delta = clientView.pageSize * wordCount;
  const next = Math.max(0, clientView.startAddr - delta);
  sendViewChange({ startAddr: next });
});
nextPageBtn.addEventListener('click', () => {
  const wordCount = wordCountFor(clientView.dataType, clientView.length);
  const delta = clientView.pageSize * wordCount;
  const area = areaList.find((a) => a.key === clientView.area);
  const maxStart = area ? Math.max(0, area.maxWords - delta) : clientView.startAddr + delta;
  const next = Math.min(maxStart, clientView.startAddr + delta);
  sendViewChange({ startAddr: next });
});

// 폴링마다(초당 여러 번) 그리드를 통째로 다시 그리면, 사용자가 "설정값" 입력창에
// 타이핑 중이던 내용/포커스가 그때마다 사라져서 값을 입력하기 사실상 불가능했다
// (연결을 끊어야만 입력이 됐던 이유). 같은 뷰(영역/시작주소/개수/타입)를 보고 있는
// 동안에는 기존 DOM(입력창 포함)을 그대로 두고 현재값 텍스트만 갱신한다.
let lastValueGridKey = null;

/** 일반/STRING 모드: 라벨+값+설정값 입력 한 칸짜리 카드 그리드 */
function renderValueGrid(cells, viewKey) {
  bitTableWrap.style.display = 'none';
  valueGrid.style.display = 'grid';

  if (viewKey !== lastValueGridKey) {
    // 뷰 자체가 바뀐 경우(탭/페이지/타입 변경)에만 전체를 다시 그린다.
    valueGrid.innerHTML = '';
    for (const key of Object.keys(cellRefs)) delete cellRefs[key];

    for (const c of cells) {
      const label = `${clientView.area}${c.addr}`;
      const cell = document.createElement('div');
      cell.className = 'value-cell';
      cell.innerHTML =
        `<div class="label">${label}</div><div class="value"></div>` +
        `<input class="setval" type="text" placeholder="설정값" />`;
      valueGrid.appendChild(cell);
      const input = cell.querySelector('input.setval');
      input.addEventListener('input', () => {
        if (input.value === '') {
          editedCells.delete(c.addr);
          cell.classList.remove('edited');
        } else {
          editedCells.set(c.addr, input.value);
          cell.classList.add('edited');
        }
      });
      cellRefs[c.addr] = { cellEl: cell, valueEl: cell.querySelector('.value'), inputEl: input };
    }
    lastValueGridKey = viewKey;
  }

  // 값 텍스트만 갱신 - 입력창(및 사용자가 타이핑 중인 내용)은 건드리지 않는다.
  for (const c of cells) {
    const ref = cellRefs[c.addr];
    if (!ref) continue;
    const text = c.value === null || c.value === undefined ? 'N/A' : String(c.value);
    if (ref.valueEl.textContent !== text) ref.valueEl.textContent = text;
  }
}

/** BOOL 모드: 워드 하나를 bit15~bit0 + Hex로 펼친 표 (CX-Programmer 메모리 뷰 참고) */
function renderBitTable(cells) {
  valueGrid.style.display = 'none';
  bitTableWrap.style.display = 'block';

  const bitCols = Array.from({ length: 16 }, (_, i) => 15 - i);
  let html = '<thead><tr><th></th>' + bitCols.map((b) => `<th>${b}</th>`).join('') + '<th>Hex</th></tr></thead><tbody>';
  for (const c of cells) {
    const label = `${clientView.area}${c.addr}`;
    const word = c.value === null || c.value === undefined ? null : c.value & 0xffff;
    html += `<tr><td class="addr-label">${label}</td>`;
    for (const b of bitCols) {
      const edited = editedBits.has(`${c.addr}_${b}`);
      const on = edited ? editedBits.get(`${c.addr}_${b}`) === 1 : word !== null && (word >> b) & 1;
      html += `<td class="bit-cell${on ? ' on' : ''}${edited ? ' edited' : ''}" data-addr="${c.addr}" data-bit="${b}">${word === null ? '-' : (on ? 1 : 0)}</td>`;
    }
    html += `<td class="hex-col">${word === null ? '-' : '0x' + word.toString(16).toUpperCase().padStart(4, '0')}</td></tr>`;
  }
  html += '</tbody>';
  bitTable.innerHTML = html;

  bitTable.querySelectorAll('td.bit-cell').forEach((td) => {
    td.addEventListener('click', () => {
      const addr = Number(td.dataset.addr);
      const bit = Number(td.dataset.bit);
      const key = `${addr}_${bit}`;
      const current = td.classList.contains('on') ? 1 : 0;
      const next = current ? 0 : 1;
      editedBits.set(key, next);
      td.classList.toggle('on', next === 1);
      td.classList.add('edited');
      td.textContent = String(next);
    });
  });
}

function renderMemoryValues(payload) {
  clientView.area = payload.area;
  clientView.startAddr = payload.startAddr;
  clientView.dataType = payload.dataType;
  const wordCount = wordCountFor(payload.dataType, clientView.length);
  viewSummary.textContent = `${payload.area} ${payload.startAddr}~${payload.startAddr + payload.cells.length * wordCount - 1}`;

  if (payload.dataType === 'BOOL') {
    renderBitTable(payload.cells);
  } else {
    const viewKey = `${payload.area}|${payload.startAddr}|${payload.cells.length}|${payload.dataType}`;
    renderValueGrid(payload.cells, viewKey);
  }
  if (payload.lastUpdate) {
    lastUpdateEl.textContent = new Date(payload.lastUpdate).toLocaleTimeString('ko-KR');
  }
}

applyMemoryBtn.addEventListener('click', async () => {
  let cells;
  if (clientView.dataType === 'BOOL') {
    if (editedBits.size === 0) {
      toast('편집한 비트가 없습니다.', 'err');
      return;
    }
    cells = [...editedBits.entries()].map(([key, value]) => {
      const [addr, bit] = key.split('_').map(Number);
      return { addr, bit, value };
    });
  } else {
    if (editedCells.size === 0) {
      toast('편집한 값이 없습니다.', 'err');
      return;
    }
    cells = [...editedCells.entries()].map(([addr, value]) => ({ addr, value }));
  }

  try {
    const res = await fetch('/api/memory/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ area: clientView.area, dataType: clientView.dataType, length: clientView.length, cells }),
    });
    const data = await res.json();
    if (!data.ok) {
      toast('쓰기 실패: ' + data.error, 'err');
      return;
    }
    const failed = data.results.filter((r) => !r.ok);
    if (failed.length > 0) {
      toast(`${failed.length}개 실패: ${failed[0].error}`, 'err');
    } else {
      toast(`${data.results.length}개 값 적용 완료`, 'ok');
      editedCells.clear();
      editedBits.clear();
    }
  } catch (e) {
    toast('쓰기 실패: ' + e.message, 'err');
  }
});

// ── "전체 채우기": 현재 화면에 보이는 모든 칸의 설정값 입력을 한 번에 채운다 ──
// 실제 PLC 쓰기는 하지 않는다 - 입력칸만 채워두고, 검토 후 [값 적용(쓰기)]을 눌러야 실제로 써진다.
fillAllBtn.addEventListener('click', () => {
  const raw = fillAllInput.value.trim() === '' ? '0' : fillAllInput.value.trim();
  if (clientView.dataType === 'BOOL') {
    const on = raw !== '0' && raw.toLowerCase() !== 'false' ? 1 : 0;
    const cells = bitTable.querySelectorAll('td.bit-cell');
    if (cells.length === 0) { toast('채울 칸이 없습니다. 먼저 값을 읽어오세요.', 'err'); return; }
    cells.forEach((td) => {
      const addr = Number(td.dataset.addr);
      const bit = Number(td.dataset.bit);
      editedBits.set(`${addr}_${bit}`, on);
      td.classList.toggle('on', on === 1);
      td.classList.add('edited');
      td.textContent = String(on);
    });
    toast(`${cells.length}개 비트를 ${on}(으)로 채웠습니다. [값 적용(쓰기)]을 눌러야 실제로 반영됩니다.`, 'ok');
  } else {
    const addrs = Object.keys(cellRefs);
    if (addrs.length === 0) { toast('채울 칸이 없습니다. 먼저 값을 읽어오세요.', 'err'); return; }
    addrs.forEach((addr) => {
      const ref = cellRefs[addr];
      ref.inputEl.value = raw;
      editedCells.set(Number(addr), raw);
      ref.cellEl.classList.add('edited');
    });
    toast(`${addrs.length}개 칸을 "${raw}"(으)로 채웠습니다. [값 적용(쓰기)]을 눌러야 실제로 반영됩니다.`, 'ok');
  }
});

/** Content-Disposition 헤더에서 서버가 정한 파일명을 뽑아낸다. 못 찾으면 fallback을 쓴다. */
function filenameFromResponse(res, fallback) {
  const cd = res.headers.get('content-disposition') || '';
  const m = cd.match(/filename="?([^";]+)"?/i);
  return m ? decodeURIComponent(m[1]) : fallback;
}

/**
 * 파일 Blob을 저장한다. Chrome/Edge(File System Access API 지원)에서는 실제 "다른 이름으로
 * 저장" 창이 떠서 폴더/파일명을 직접 고를 수 있고, 미지원 브라우저(Firefox 등)에서는 기존처럼
 * 앵커 다운로드로 대체된다(브라우저 기본 다운로드 폴더로 저장됨).
 */
async function saveBlobWithPicker(blob, suggestedName, mimeType) {
  if (window.showSaveFilePicker) {
    try {
      const ext = suggestedName.slice(suggestedName.lastIndexOf('.'));
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: ext.slice(1).toUpperCase() + ' 파일', accept: { [mimeType]: [ext] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') throw e; // 사용자가 저장 창을 취소함
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
}

exportMemoryBtn.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/memory/export/xlsx');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast('내보내기 실패: ' + (err.error || res.statusText), 'err');
      return;
    }
    const blob = await res.blob();
    const suggestedName = filenameFromResponse(res, `MEM_${clientView.area}_${Date.now()}.xlsx`);
    await saveBlobWithPicker(blob, suggestedName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    toast('저장 완료', 'ok');
  } catch (e) {
    if (e && e.name === 'AbortError') return; // 사용자가 저장 창을 취소함
    toast('내보내기 실패: ' + e.message, 'err');
  }
});

fetchAreas();

let lastKnownCpuModel = null;

function setStatus(status) {
  statusPill.classList.remove('connected', 'error');
  if (status.connected) {
    statusPill.classList.add('connected');
    if ((status.connectionType === 'UDP' || status.connectionType === 'TCP') && status.connectionParams) {
      statusText.textContent = `${status.connectionType} 연결됨 (${status.connectionParams.host}:${status.connectionParams.port})`;
    } else {
      statusText.textContent = 'USB 연결됨';
    }
    connectBtn.disabled = true;
    disconnectBtn.disabled = false;
    connType.disabled = true;
  } else if (status.lastError) {
    statusPill.classList.add('error');
    statusText.textContent = '오류: ' + status.lastError;
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
    connType.disabled = false;
  } else {
    statusText.textContent = '연결 안 됨';
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
    connType.disabled = false;
  }
  updateConnFieldsVisibility();
  if (status.connectionType && document.activeElement !== connType) {
    connType.value = status.connectionType;
  }
  if (status.connectionParams && document.activeElement !== connHost) {
    connHost.value = status.connectionParams.host || '';
  }
  if (status.connectionParams && document.activeElement !== connPort) {
    connPort.value = status.connectionParams.port || 9600;
  }
  if (status.pollIntervalMs != null && document.activeElement !== intervalInput) {
    intervalInput.value = status.pollIntervalMs;
  }
  // 값 읽기 시작/일시정지/정지 버튼 상태 - 연결 여부 + 폴링 상태(stopped/running/paused)에 따라 결정.
  // NX 시리즈는 영역+주소 폴링이 없어(태그 조회 별도 UI 사용) 항상 비활성화한다.
  const isNx = status.plcSeries === 'NX';
  const pollStatus = status.pollStatus || 'stopped';
  if (!status.connected || isNx) {
    pollStartBtn.disabled = true;
    pollPauseBtn.disabled = true;
    pollStopBtn.disabled = true;
    pollStatusText.textContent = isNx ? 'NX는 태그 조회 사용' : '연결 필요';
  } else {
    pollStartBtn.disabled = pollStatus === 'running';
    pollPauseBtn.disabled = pollStatus !== 'running';
    pollStopBtn.disabled = pollStatus === 'stopped';
    pollStatusText.textContent = pollStatus === 'running' ? '읽는 중' : pollStatus === 'paused' ? '일시정지됨' : '정지됨';
  }
  // status.latencyMs는 counters와 별개 최상위 필드라, status.counters만 넘기면
  // (매 폴링 사이클마다 오는) status 브로드캐스트가 지연시간을 계속 지워서
  // 방금 counters 메시지로 반영된 값이 화면에서 바로 "—"로 깜빡이는 버그가 있었다.
  if (status.counters) setCounters({ ...status.counters, latencyMs: status.latencyMs });

  if (status.controllerInfo && status.controllerInfo.model) {
    const v = status.controllerInfo.version ? ` (Ver. ${status.controllerInfo.version})` : '';
    cpuInfo.textContent = `— ${status.controllerInfo.model}${v}`;
    // CPU 모델에 따라 EM 뱅크 개수가 다르므로, 새로 확인된 모델이면 탭 목록을 다시 불러온다.
    if (lastKnownCpuModel !== status.controllerInfo.model) {
      lastKnownCpuModel = status.controllerInfo.model;
      fetchAreas();
    }
  } else if (!status.connected) {
    cpuInfo.textContent = '— 연결 전';
    lastKnownCpuModel = null;
  } else {
    cpuInfo.textContent = '— CPU 정보 확인 중...';
  }
}

function setCounters(c) {
  cntSend.textContent = c.send;
  cntRecv.textContent = c.recvSuccess;
  cntErr.textContent = c.recvError;
  cntLatency.textContent = c.latencyMs != null ? c.latencyMs + 'ms' : '—';
  trendPush(c.latencyMs);
}

// ── 지연시간 트렌드 팝업 ──
// 지연 숫자는 폴링마다(초당 여러 번) 바뀌어서 눈으로 읽기 어려우므로, 값을 눌러
// 최근 N초 구간의 변화를 선 그래프로 보여준다. 별도 라이브러리 없이 캔버스로 직접 그린다.
const trendPopup = document.getElementById('trendPopup');
const trendCanvas = document.getElementById('trendCanvas');
const trendCtx = trendCanvas.getContext('2d');
const trendStartBtn = document.getElementById('trendStartBtn');
const trendPauseBtn = document.getElementById('trendPauseBtn');
const trendStopBtn = document.getElementById('trendStopBtn');
const trendCloseBtn = document.getElementById('trendCloseBtn');
const trendYAutoChk = document.getElementById('trendYAutoChk');
const trendYMinInput = document.getElementById('trendYMinInput');
const trendYMaxInput = document.getElementById('trendYMaxInput');
const trendWindowInput = document.getElementById('trendWindowInput');

const trend = { status: 'stopped', samples: [] }; // status: 'stopped' | 'running' | 'paused'

function setTrendStatus(status) {
  trend.status = status;
  trendStartBtn.disabled = status === 'running';
  trendPauseBtn.disabled = status !== 'running';
  trendStopBtn.disabled = status === 'stopped';
  trendPauseBtn.classList.toggle('paused', status === 'paused');
}
setTrendStatus('stopped');

function trendPush(value) {
  if (trend.status !== 'running' || value === null || value === undefined) return;
  trend.samples.push({ t: Date.now(), v: value });
  const windowMs = (Number(trendWindowInput.value) || 60) * 1000;
  const cutoff = Date.now() - windowMs;
  while (trend.samples.length > 0 && trend.samples[0].t < cutoff) trend.samples.shift();
  if (trendPopup.style.display !== 'none') drawTrend();
}

function drawTrend() {
  const w = trendCanvas.width;
  const h = trendCanvas.height;
  trendCtx.clearRect(0, 0, w, h);

  const style = getComputedStyle(document.documentElement);
  const gridColor = style.getPropertyValue('--panel-border').trim() || '#ccc';
  const textColor = style.getPropertyValue('--muted').trim() || '#888';
  const lineColor = style.getPropertyValue('--accent').trim() || '#3ddc84';

  const padding = { left: 46, right: 12, top: 10, bottom: 20 };
  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;

  const windowMs = (Number(trendWindowInput.value) || 60) * 1000;
  const now = Date.now();
  const xMin = now - windowMs;
  const xMax = now;

  const values = trend.samples.map((s) => s.v);
  let yMin, yMax;
  if (trendYAutoChk.checked) {
    yMin = values.length ? Math.min(...values) : 0;
    yMax = values.length ? Math.max(...values) : 10;
    if (yMin === yMax) {
      yMin -= 1;
      yMax += 1;
    }
    const margin = (yMax - yMin) * 0.15;
    yMin -= margin;
    yMax += margin;
  } else {
    yMin = Number(trendYMinInput.value) || 0;
    yMax = Number(trendYMaxInput.value) || 100;
    if (yMax <= yMin) yMax = yMin + 1;
  }

  const xPix = (t) => padding.left + ((t - xMin) / (xMax - xMin)) * plotW;
  const yPix = (v) => padding.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  trendCtx.strokeStyle = gridColor;
  trendCtx.fillStyle = textColor;
  trendCtx.font = '10px sans-serif';
  trendCtx.lineWidth = 1;
  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const v = yMin + ((yMax - yMin) * i) / yTicks;
    const y = yPix(v);
    trendCtx.beginPath();
    trendCtx.moveTo(padding.left, y);
    trendCtx.lineTo(w - padding.right, y);
    trendCtx.stroke();
    trendCtx.fillText(Math.round(v) + 'ms', 2, y + 3);
  }

  if (trend.samples.length > 1) {
    trendCtx.strokeStyle = lineColor;
    trendCtx.lineWidth = 1.5;
    trendCtx.beginPath();
    trend.samples.forEach((s, i) => {
      const x = xPix(s.t);
      const y = yPix(s.v);
      if (i === 0) trendCtx.moveTo(x, y);
      else trendCtx.lineTo(x, y);
    });
    trendCtx.stroke();
  }

  if (trend.samples.length > 0) {
    const last = trend.samples[trend.samples.length - 1];
    trendCtx.fillStyle = lineColor;
    trendCtx.font = 'bold 12px sans-serif';
    trendCtx.fillText(`${last.v}ms`, w - padding.right - 42, padding.top + 12);
  }
}

// running 상태에서는 새 데이터가 없어도 시간축이 계속 흘러야 하므로 주기적으로 다시 그린다
setInterval(() => {
  if (trend.status === 'running' && trendPopup.style.display !== 'none') drawTrend();
}, 500);

cntLatency.addEventListener('click', () => {
  if (trendPopup.style.display === 'none') {
    trendPopup.style.display = 'block';
    setTrendStatus('running');
    drawTrend();
  } else {
    // 팝업이 이미 열려 있으면 클릭할 때마다 기록 실행/일시정지를 토글한다
    setTrendStatus(trend.status === 'running' ? 'paused' : 'running');
  }
});
trendCloseBtn.addEventListener('click', () => {
  trendPopup.style.display = 'none';
});

// ── 팝업 드래그 이동 (헤더를 잡고 끌기) ──
(function makeTrendPopupDraggable() {
  const handle = trendPopup.querySelector('.trend-header');
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  handle.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return; // 닫기 버튼 클릭은 드래그로 취급하지 않음
    dragging = true;
    const rect = trendPopup.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    // 처음엔 right로 위치가 잡혀 있으니, 드래그 시작 시 left/top 기준으로 전환한다
    trendPopup.style.right = 'auto';
    trendPopup.style.left = rect.left + 'px';
    trendPopup.style.top = rect.top + 'px';
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    trendPopup.style.left = e.clientX - offsetX + 'px';
    trendPopup.style.top = e.clientY - offsetY + 'px';
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
  });
})();

trendStartBtn.addEventListener('click', () => setTrendStatus('running'));
trendPauseBtn.addEventListener('click', () => setTrendStatus('paused'));
trendStopBtn.addEventListener('click', () => {
  setTrendStatus('stopped');
  trend.samples = [];
  drawTrend();
});
trendYAutoChk.addEventListener('change', () => {
  trendYMinInput.disabled = trendYAutoChk.checked;
  trendYMaxInput.disabled = trendYAutoChk.checked;
  drawTrend();
});
trendYMinInput.addEventListener('change', drawTrend);
trendYMaxInput.addEventListener('change', drawTrend);
trendWindowInput.addEventListener('change', drawTrend);

function applyTheme(t) {
  // 표준 테마를 고르면 사용자 지정 테마 흔적(속성/스타일/모드)을 지운다.
  document.documentElement.removeAttribute('data-custom-theme');
  var customEl = document.getElementById('__customTheme');
  if (customEl) customEl.textContent = '';
  localStorage.removeItem('plcThemeMode');
  document.documentElement.dataset.theme = t;
  localStorage.setItem('plcTheme', t);
  if (themeSelect) themeSelect.value = t;
}
// 사용자 지정 테마가 활성일 때는 인라인 스크립트가 이미 적용했으므로 다시 applyTheme를 부르지
// 않는다(부르면 사용자 지정 색을 지워버린다). 드롭다운 표시값만 바탕 테마로 맞춘다.
if (localStorage.getItem('plcThemeMode') === 'custom') {
  try {
    if (themeSelect) themeSelect.value = JSON.parse(localStorage.getItem('plcCustomTheme') || '{}').fallback === 'dark' ? 'dark' : 'light';
  } catch (e) { if (themeSelect) themeSelect.value = 'light'; }
} else {
  // 로컬에 저장된 테마가 있으면 그것을, 없으면(신규 브라우저) localStorage를 건드리지 않고
  // appSettings.js가 서버 기본 테마를 적용하도록 드롭다운 표시값만 맞춘다.
  const storedTheme = localStorage.getItem('plcTheme');
  if (storedTheme) applyTheme(storedTheme);
  else if (themeSelect) themeSelect.value = document.documentElement.dataset.theme || 'light';
}
if (themeSelect) {
  themeSelect.addEventListener('change', () => {
    applyTheme(themeSelect.value);
  });
}

// ── 헤더 시계 (제목/CPU 정보 오른쪽) ──
(function initClock() {
  const clockEl = document.getElementById('clockDisplay');
  if (!clockEl) return;
  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
  function render() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ampm = d.getHours() < 12 ? 'AM' : 'PM';
    const hour12 = d.getHours() % 12 || 12;
    clockEl.textContent =
      `${d.getFullYear()}년 ${pad(d.getMonth() + 1)}월 ${pad(d.getDate())}일 ${WEEKDAYS[d.getDay()]}요일 ` +
      `${ampm} ${pad(hour12)}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  render();
  setInterval(render, 1000);
})();

// ── 사용 방법(Operation Manual) 모달 ──
const helpBtn = document.getElementById('helpBtn');
const helpModal = document.getElementById('helpModal');
const helpCloseBtn = document.getElementById('helpCloseBtn');
helpBtn.addEventListener('click', () => helpModal.classList.add('show'));
helpCloseBtn.addEventListener('click', () => helpModal.classList.remove('show'));
helpModal.querySelector('.help-modal-backdrop').addEventListener('click', () => helpModal.classList.remove('show'));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    helpModal.classList.remove('show');
  }
});

// ── 통신 이력 패널 높이 조절 (드래그 스플리터) ──
(function initLogSplitter() {
  const splitter = document.getElementById('logSplitter');
  const logPanel = document.querySelector('.log-panel');
  const STORAGE_KEY = 'plcLogPanelHeight';

  // 페이지를 옮겼다 돌아와도(새로고침 포함) 마지막으로 조절한 높이를 그대로 유지한다.
  const savedHeight = Number(localStorage.getItem(STORAGE_KEY));
  if (Number.isFinite(savedHeight) && savedHeight > 0) {
    logPanel.style.flexBasis = savedHeight + 'px';
    logPanel.style.height = savedHeight + 'px';
  }

  let dragging = false;
  let startY = 0;
  let startHeight = 0;
  splitter.addEventListener('mousedown', (e) => {
    dragging = true;
    splitter.classList.add('dragging');
    startY = e.clientY;
    startHeight = logPanel.getBoundingClientRect().height;
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const delta = startY - e.clientY; // 위로 끌면(delta>0) 로그 패널이 커짐
    const maxHeight = window.innerHeight * 0.7;
    const newHeight = Math.min(Math.max(startHeight + delta, 80), maxHeight);
    logPanel.style.flexBasis = newHeight + 'px';
    logPanel.style.height = newHeight + 'px';
    localStorage.setItem(STORAGE_KEY, String(newHeight));
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    splitter.classList.remove('dragging');
    document.body.style.userSelect = '';
  });
})();

// ── 통신 이력 / PLC 에러 로그 폭 조절 (드래그 스플리터) ──
(function initErrorLogSplitter() {
  const splitter = document.getElementById('errorLogSplitter');
  const errorLogCol = document.getElementById('errorLogCol');
  const STORAGE_KEY = 'plcErrorLogColWidth';

  const savedWidth = Number(localStorage.getItem(STORAGE_KEY));
  if (Number.isFinite(savedWidth) && savedWidth > 0) {
    errorLogCol.style.flexBasis = savedWidth + 'px';
  }

  let dragging = false;
  let startX = 0;
  let startWidth = 0;
  splitter.addEventListener('mousedown', (e) => {
    dragging = true;
    splitter.classList.add('dragging');
    startX = e.clientX;
    startWidth = errorLogCol.getBoundingClientRect().width;
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const delta = startX - e.clientX; // 왼쪽으로 끌면(delta>0) PLC 에러 로그가 넓어짐
    const maxWidth = window.innerWidth * 0.7;
    const newWidth = Math.min(Math.max(startWidth + delta, 200), maxWidth);
    errorLogCol.style.flexBasis = newWidth + 'px';
    localStorage.setItem(STORAGE_KEY, String(newWidth));
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    splitter.classList.remove('dragging');
    document.body.style.userSelect = '';
  });
})();

let allLogs = [];
let errorOnlyFilter = false;

function renderLogEntry(entry) {
  const div = document.createElement('div');
  div.className = `log-entry ${entry.direction}`;
  const time = new Date(entry.time).toLocaleTimeString('ko-KR');
  div.innerHTML = `<span class="time">[${time}]</span> <span class="tag">${entry.direction}</span>${entry.message}` +
    (entry.hex ? `<span class="hex">${entry.hex}</span>` : '');
  logList.appendChild(div);
}

function renderAllLogs() {
  logList.innerHTML = '';
  const toShow = errorOnlyFilter ? allLogs.filter((e) => e.direction === 'ERROR') : allLogs;
  toShow.slice(-300).forEach(renderLogEntry);
  logList.scrollTop = logList.scrollHeight;
}

function appendLog(entry) {
  allLogs.push(entry);
  if (allLogs.length > 1000) allLogs.shift();
  if (!errorOnlyFilter || entry.direction === 'ERROR') {
    renderLogEntry(entry);
    logList.scrollTop = logList.scrollHeight;
    while (logList.children.length > 300) {
      logList.removeChild(logList.firstChild);
    }
  }
}

const filterErrorBtn = document.getElementById('filterErrorBtn');
filterErrorBtn.addEventListener('click', () => {
  errorOnlyFilter = !errorOnlyFilter;
  filterErrorBtn.classList.toggle('active', errorOnlyFilter);
  filterErrorBtn.textContent = errorOnlyFilter ? '🔴 전체 보기' : '🔴 에러만 보기';
  renderAllLogs();
});

function updateConnFieldsVisibility() {
  const needsHost = connType.value === 'UDP' || connType.value === 'TCP';
  connHost.disabled = !needsHost || connectBtn.disabled;
  connPort.disabled = !needsHost || connectBtn.disabled;
  connHost.placeholder = needsHost ? 'PLC IP (예: 192.168.0.80)' : 'USB는 IP 불필요';
}
connType.addEventListener('change', updateConnFieldsVisibility);
updateConnFieldsVisibility();

// NX 시리즈는 USB(CJ 전용 프로토콜)로 연결할 수 없고 반드시 Ethernet(UDP/TCP)로만 연결하므로,
// NX를 선택하면 USB 옵션을 감춰서 잘못된 조합을 아예 고를 수 없게 한다.
const connTypeUsbOption = Array.from(connType.options).find((o) => o.value === 'USB');
// CJ는 영역+주소 기반 화면(area-tabs/sub-toolbar/실시간 값 그리드/쓰기테스트/에러로그)을 쓰고,
// NX는 태그 이름 기반 화면(nxToolbar/nxMain)을 쓰므로, 시리즈를 바꾸면 해당 화면 묶음을 통째로 전환한다.
const cjToolbars = document.getElementById('cjToolbars');
const nxToolbar = document.getElementById('nxToolbar');
const cjMain = document.querySelector('#content-area > main:not(#nxMain)');
const nxMain = document.getElementById('nxMain');
function applySeriesConstraints() {
  const isNx = plcSeriesSelect.value === 'NX';
  if (connTypeUsbOption) connTypeUsbOption.hidden = isNx;
  if (isNx && connType.value === 'USB') connType.value = 'UDP';
  updateConnFieldsVisibility();
  cjToolbars.style.display = isNx ? 'none' : '';
  nxToolbar.style.display = isNx ? '' : 'none';
  cjMain.style.display = isNx ? 'none' : '';
  nxMain.style.display = isNx ? '' : 'none';
}
plcSeriesSelect.addEventListener('change', applySeriesConstraints);
applySeriesConstraints();

// ── NX 태그 목록 관리 (영역+주소 대신 태그 이름으로 접근) ──
const nxTagNameInput = document.getElementById('nxTagNameInput');
const nxTagTypeSelect = document.getElementById('nxTagTypeSelect');
const nxTagAddBtn = document.getElementById('nxTagAddBtn');
const nxTagTableBody = document.getElementById('nxTagTableBody');
const nxReadAllBtn = document.getElementById('nxReadAllBtn');
const nxTagsSaveBtn = document.getElementById('nxTagsSaveBtn');
const nxAutoPollBtn = document.getElementById('nxAutoPollBtn');
const nxPollIntervalInput = document.getElementById('nxPollIntervalInput');

const NX_CIP_TYPES = ['BOOL', 'SINT', 'INT', 'DINT', 'LINT', 'USINT', 'UINT', 'UDINT', 'ULINT', 'REAL', 'LREAL', 'BYTE', 'WORD', 'DWORD', 'LWORD'];
for (const t of NX_CIP_TYPES) {
  const opt = document.createElement('option');
  opt.value = t;
  opt.textContent = t;
  if (t === 'DINT') opt.selected = true;
  nxTagTypeSelect.appendChild(opt);
}

let nxTags = []; // [{ name, dataType }]
const nxRowRefs = {}; // name -> { curTd, writeInput }

function renderNxTagTable() {
  nxTagTableBody.innerHTML = '';
  for (const k of Object.keys(nxRowRefs)) delete nxRowRefs[k];
  nxTags.forEach((t) => {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.textContent = t.name;
    tr.appendChild(nameTd);

    const typeTd = document.createElement('td');
    typeTd.textContent = t.dataType;
    tr.appendChild(typeTd);

    const curTd = document.createElement('td');
    curTd.textContent = '-';
    tr.appendChild(curTd);

    const writeTd = document.createElement('td');
    const writeInput = document.createElement('input');
    writeInput.type = 'text';
    writeTd.appendChild(writeInput);
    tr.appendChild(writeTd);

    const actionTd = document.createElement('td');
    actionTd.style.whiteSpace = 'nowrap';
    const writeBtn = document.createElement('button');
    writeBtn.textContent = '쓰기';
    writeBtn.style.fontSize = '12px';
    writeBtn.style.padding = '3px 8px';
    writeBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/nx/tags/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag: t.name, value: writeInput.value, dataType: t.dataType }),
        });
        const data = await res.json();
        if (data.ok) toast(`"${t.name}" 쓰기 완료`, 'ok');
        else toast('쓰기 실패: ' + data.error, 'err');
      } catch (e) {
        toast('쓰기 실패: ' + e.message, 'err');
      }
    });
    const delBtn = document.createElement('button');
    delBtn.textContent = '✕';
    delBtn.style.fontSize = '12px';
    delBtn.style.padding = '3px 8px';
    delBtn.style.marginLeft = '4px';
    delBtn.addEventListener('click', () => {
      nxTags = nxTags.filter((x) => x !== t);
      renderNxTagTable();
    });
    actionTd.appendChild(writeBtn);
    actionTd.appendChild(delBtn);
    tr.appendChild(actionTd);

    nxTagTableBody.appendChild(tr);
    nxRowRefs[t.name] = { curTd, writeInput };
  });
}

nxTagAddBtn.addEventListener('click', () => {
  const name = nxTagNameInput.value.trim();
  if (!name) {
    toast('태그 이름을 입력하세요.', 'err');
    return;
  }
  if (nxTags.some((t) => t.name === name)) {
    toast('이미 목록에 있는 태그입니다.', 'err');
    return;
  }
  nxTags.push({ name, dataType: nxTagTypeSelect.value });
  nxTagNameInput.value = '';
  renderNxTagTable();
});

async function nxReadAll() {
  if (nxTags.length === 0) return;
  try {
    const res = await fetch('/api/nx/tags/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagNames: nxTags.map((t) => t.name) }),
    });
    const data = await res.json();
    if (!data.ok) {
      toast('태그 조회 실패: ' + data.error, 'err');
      return;
    }
    data.results.forEach((r) => {
      const ref = nxRowRefs[r.tagName];
      if (!ref) return;
      ref.curTd.textContent = r.error ? `오류: ${r.error}` : String(r.value);
    });
  } catch (e) {
    toast('태그 조회 실패: ' + e.message, 'err');
  }
}
nxReadAllBtn.addEventListener('click', nxReadAll);

nxTagsSaveBtn.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/nx/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: nxTags }),
    });
    const data = await res.json();
    if (data.ok) toast(`태그 ${data.count}개 저장 완료`, 'ok');
    else toast('저장 실패: ' + data.error, 'err');
  } catch (e) {
    toast('저장 실패: ' + e.message, 'err');
  }
});

let nxAutoPollTimer = null;
nxAutoPollBtn.addEventListener('click', () => {
  if (nxAutoPollTimer) {
    clearInterval(nxAutoPollTimer);
    nxAutoPollTimer = null;
    nxAutoPollBtn.textContent = '▶ 자동 조회 시작';
    nxAutoPollBtn.classList.remove('paused');
  } else {
    const ms = Number(nxPollIntervalInput.value) || 1000;
    nxAutoPollTimer = setInterval(nxReadAll, ms);
    nxAutoPollBtn.textContent = '⏸ 자동 조회 중지';
    nxAutoPollBtn.classList.add('paused');
  }
});

// 초기 로드 시 저장된 NX 태그 목록 자동 불러오기
(async function initNxTags() {
  try {
    const res = await fetch('/api/nx/tags');
    const data = await res.json();
    if (data.ok && data.tags.length > 0) {
      nxTags = data.tags;
      renderNxTagTable();
    }
  } catch (e) {
    /* 무시 */
  }
})();
function connectWs() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.type === 'status') setStatus(msg.payload);
    else if (msg.type === 'memoryValues') renderMemoryValues(msg.payload);
    else if (msg.type === 'log') appendLog(msg.payload);
    else if (msg.type === 'logHistory') msg.payload.forEach(appendLog);
    else if (msg.type === 'counters') setCounters(msg.payload);
    else if (msg.type === 'logsCleared') { allLogs = []; logList.innerHTML = ''; }
  };
  ws.onclose = () => setTimeout(connectWs, 1000);
}
connectWs();

// 연결 요청이 응답 없이 무한정 걸리지 않도록 클라이언트 쪽에서도 타임아웃을 둔다
// (서버 쪽 타임아웃(8초)보다 여유 있게 잡아, 서버가 보내는 실제 에러 메시지를 먼저 받는다).
const CONNECT_FETCH_TIMEOUT_MS = 12000;
async function postJsonWithTimeout(url, body, timeoutMs = CONNECT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

connectBtn.addEventListener('click', async () => {
  const type = connType.value;
  const body = { type, series: plcSeriesSelect.value };

  if (type === 'UDP' || type === 'TCP') {
    const host = connHost.value.trim();
    if (!host) {
      alert(`${type} 연결에는 PLC IP 주소를 입력해야 합니다.`);
      return;
    }
    body.host = host;
    body.port = connPort.value ? Number(connPort.value) : 9600;
  }

  connectBtn.disabled = true;
  try {
    const data = await postJsonWithTimeout('/api/connect', body);
    if (!data.ok) {
      alert('연결 실패: ' + data.error);
    }
  } catch (e) {
    alert('연결 요청이 응답하지 않습니다(타임아웃). 네트워크 상태를 확인하고 다시 시도하세요.');
  } finally {
    // 성공/실패/타임아웃 어떤 경우든 서버의 실제 상태로 화면을 강제 재동기화한다.
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data && data.status) setStatus(data.status);
    } catch (e) { /* ignore */ }
  }
});

disconnectBtn.addEventListener('click', async () => {
  await fetch('/api/disconnect', { method: 'POST' });
});

// ── 값 읽기 시작/일시정지/정지 (연결과 별개 - 그리드/트렌드 화면과 동일한 방식) ──
pollStartBtn.addEventListener('click', async () => {
  const intervalMs = Number(intervalInput.value) || 1000;
  const res = await fetch('/api/poll/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intervalMs }),
  });
  const data = await res.json();
  if (!data.ok) alert('시작 실패: ' + data.error);
});
pollPauseBtn.addEventListener('click', async () => {
  await fetch('/api/poll/pause', { method: 'POST' });
});
pollStopBtn.addEventListener('click', async () => {
  await fetch('/api/poll/stop', { method: 'POST' });
});

resetCountersBtn.addEventListener('click', async () => {
  await fetch('/api/counters/reset', { method: 'POST' });
});

clearLogBtn.addEventListener('click', async () => {
  allLogs = [];
  logList.innerHTML = ''; // 서버 응답을 기다리지 않고 즉시 화면부터 비움
  await fetch('/api/logs/clear', { method: 'POST' });
});

errorLogBtn.addEventListener('click', async () => {
  errorLogSummary.textContent = '조회 중...';
  errorLogSummary.className = 'write-status';
  errorLogList.innerHTML = '';
  try {
    const res = await fetch('/api/error-log');
    const data = await res.json();
    if (!data.ok) {
      errorLogSummary.textContent = '❌ ' + data.error;
      errorLogSummary.className = 'write-status err';
      return;
    }
    const { maxRecords, currentCount, returnedCount, records } = data.result;
    errorLogSummary.textContent = `현재 저장된 에러 ${currentCount}개 (최대 ${maxRecords}개) / 이번 조회 ${returnedCount}개`;
    errorLogSummary.className = currentCount > 0 ? 'write-status err' : 'write-status ok';

    if (!records || records.length === 0) {
      errorLogList.innerHTML = '<div style="color:var(--muted);padding:4px 0;">기록된 에러 없음</div>';
    } else {
      errorLogList.innerHTML = records
        .map(
          (r) =>
            `<div style="padding:4px 0;border-bottom:1px solid var(--panel-border);">` +
            `<span style="color:var(--error);font-weight:700;">0x${r.code.toString(16).padStart(4, '0')}</span> ` +
            `${r.description} ` +
            `<span style="color:var(--muted);">(${r.time})</span>` +
            `</div>`
        )
        .join('');
    }
  } catch (e) {
    errorLogSummary.textContent = '❌ ' + e.message;
    errorLogSummary.className = 'write-status err';
  }
});

