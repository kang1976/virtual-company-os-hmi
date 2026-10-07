function toast(message, kind = '') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast show ${kind}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.className = 'toast';
  }, 2500);
}

/** File 객체를 base64 문자열로 읽는다 (data URL 접두어는 잘라냄) - 기록(history) Excel 불러오기에서 사용 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * 파일 Blob을 저장한다. Chrome/Edge(File System Access API 지원)에서는 실제 "다른 이름으로
 * 저장" 창이 떠서 폴더/파일명을 직접 고를 수 있고, 미지원 브라우저에서는 기존처럼 앵커
 * 다운로드로 대체된다(브라우저 기본 다운로드 폴더로 저장됨). 그리드/트렌드 그리드 위젯과 동일한 방식.
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

/** Content-Disposition 헤더에서 서버가 정한 파일명을 뽑아낸다(한글 등 UTF-8 형식 우선). 못 찾으면 fallback을 쓴다. */
function filenameFromResponse(res, fallback) {
  const cd = res.headers.get('content-disposition') || '';
  const star = cd.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) return decodeURIComponent(star[1]);
  const plain = cd.match(/filename="?([^";]+)"?/i);
  if (plain) return plain[1];
  return fallback;
}

/** 서버 POST/GET 내보내기 응답을 fetch로 받아 Save As(가능하면)로 저장한다. */
async function fetchAndSave(url, options, fallbackName, mimeType) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast('내보내기 실패: ' + (err.error || res.statusText), 'err');
      return false;
    }
    const blob = await res.blob();
    const suggestedName = filenameFromResponse(res, fallbackName);
    await saveBlobWithPicker(blob, suggestedName, mimeType);
    toast('저장 완료', 'ok');
    return true;
  } catch (e) {
    if (e && e.name === 'AbortError') return false; // 사용자가 저장 창을 취소함
    toast('내보내기 실패: ' + e.message, 'err');
    return false;
  }
}

function escapeAttr(s) {
  return String(s === undefined || s === null ? '' : s).replace(/"/g, '&quot;');
}

// ── 테마 ──
const themeSelect = document.getElementById('themeSelect');
function applyTheme(t) {
  // 표준 테마를 고르면 사용자 지정 테마 흔적(속성/스타일/모드)을 지운다.
  document.documentElement.removeAttribute('data-custom-theme');
  const customEl = document.getElementById('__customTheme');
  if (customEl) customEl.textContent = '';
  localStorage.removeItem('plcThemeMode');
  document.documentElement.dataset.theme = t;
  localStorage.setItem('plcTheme', t);
  if (themeSelect) themeSelect.value = t;
}
// 사용자 지정 테마가 활성이면 인라인 스크립트가 이미 적용했으니 드롭다운 표시값만 맞춘다.
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
  if (e.key === 'Escape') helpModal.classList.remove('show');
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
    const delta = startY - e.clientY;
    const maxHeight = window.innerHeight * 0.7;
    const newHeight = Math.min(Math.max(startHeight + delta, 80), maxHeight);
    logPanel.style.flexBasis = newHeight + 'px';
    logPanel.style.height = newHeight + 'px';
    localStorage.setItem(STORAGE_KEY, String(newHeight));
    if (typeof redrawChart === 'function') redrawChart();
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    splitter.classList.remove('dragging');
    document.body.style.userSelect = '';
  });
})();

// ── 연결 UI (이 화면만의 독립된 연결 - 다른 화면과 상호 배타적) ──
const plcSeriesSelect = document.getElementById('plcSeriesSelect');
const connType = document.getElementById('connType');
const connHost = document.getElementById('connHost');
const connPort = document.getElementById('connPort');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const statusPill = document.getElementById('statusPill');
const statusText = document.getElementById('statusText');
const cpuInfo = document.getElementById('cpuInfo');
const cntSend = document.getElementById('cntSend');
const cntRecv = document.getElementById('cntRecv');
const cntErr = document.getElementById('cntErr');
const cntLatency = document.getElementById('cntLatency');
const resetCountersBtn = document.getElementById('resetCountersBtn');

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
function applySeriesConstraints() {
  const isNx = plcSeriesSelect.value === 'NX';
  if (connTypeUsbOption) connTypeUsbOption.hidden = isNx;
  if (isNx && connType.value === 'USB') connType.value = 'UDP';
  updateConnFieldsVisibility();
}
plcSeriesSelect.addEventListener('change', applySeriesConstraints);
applySeriesConstraints();

let isPlcConnected = false;
function setConnStatus(status) {
  if (!status) return;
  const wasConnected = isPlcConnected;
  isPlcConnected = !!status.connected;
  // 실제 PLC에 연결되면 오프라인 재생 데이터는 의미가 없어지므로 정리한다.
  if (isPlcConnected && !wasConnected && typeof clearOfflineData === 'function') clearOfflineData();
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
  if (status.connectionType && document.activeElement !== connType) connType.value = status.connectionType;
  if (status.connectionParams && document.activeElement !== connHost) connHost.value = status.connectionParams.host || '';
  if (status.connectionParams && document.activeElement !== connPort) connPort.value = status.connectionParams.port || 9600;
  if (status.counters) setCounters({ ...status.counters, latencyMs: status.latencyMs });

  if (status.controllerInfo && status.controllerInfo.model) {
    const v = status.controllerInfo.version ? ` (Ver. ${status.controllerInfo.version})` : '';
    cpuInfo.textContent = `— ${status.controllerInfo.model}${v}`;
  } else if (!status.connected) {
    cpuInfo.textContent = '— 연결 전';
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

async function fetchConnStatus() {
  try {
    const res = await fetch('/api/trend/conn-status');
    const data = await res.json();
    if (data.ok) setConnStatus(data.status);
  } catch (e) {
    statusPill.classList.remove('connected');
    statusPill.classList.add('error');
    statusText.textContent = '상태 조회 실패';
  }
}

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
    const data = await postJsonWithTimeout('/api/trend/connect', body);
    if (!data.ok) {
      alert('연결 실패: ' + data.error);
    }
  } catch (e) {
    alert('연결 요청이 응답하지 않습니다(타임아웃). 네트워크 상태를 확인하고 다시 시도하세요.');
  } finally {
    // 성공/실패/타임아웃 어떤 경우든 서버의 실제 상태로 화면을 강제 재동기화한다.
    // (이걸 안 하면, 만에 하나 WebSocket 브로드캐스트를 놓쳤을 때 버튼이 disabled인 채로
    // 멈춰 "새로고침해야만 풀리는" 상태가 될 수 있다.)
    await fetchConnStatus();
  }
});

disconnectBtn.addEventListener('click', async () => {
  await fetch('/api/trend/disconnect', { method: 'POST' });
});

resetCountersBtn.addEventListener('click', async () => {
  await fetch('/api/trend/counters/reset', { method: 'POST' });
});

// ── 지연시간 트렌드 팝업 (다른 두 페이지와 동일 구현) ──
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

const trend = { status: 'stopped', samples: [] };

function setTrendStatus(status) {
  trend.status = status;
  trendStartBtn.disabled = status === 'running';
  trendPauseBtn.disabled = status !== 'running';
  trendStopBtn.disabled = status === 'stopped';
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
    if (yMin === yMax) { yMin -= 1; yMax += 1; }
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

setInterval(() => {
  if (trend.status === 'running' && trendPopup.style.display !== 'none') drawTrend();
}, 500);

cntLatency.addEventListener('click', () => {
  if (trendPopup.style.display === 'none') {
    trendPopup.style.display = 'block';
    setTrendStatus('running');
    drawTrend();
  } else {
    setTrendStatus(trend.status === 'running' ? 'paused' : 'running');
  }
});
trendCloseBtn.addEventListener('click', () => {
  trendPopup.style.display = 'none';
});
(function makeTrendPopupDraggable() {
  const handle = trendPopup.querySelector('.trend-header');
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;
  handle.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    dragging = true;
    const rect = trendPopup.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
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

// ── 영역/주소/타입 선택 및 변수 추가/삭제/저장/불러오기 버튼은 grid-app/src/trend-widget.js
// (Univer 그리드 위젯, #trendGridContainer)가 직접 소유한다. 여기서는 위젯이 노출하는
// window.trendGridApi를 통해 값 반영/시작·종료값 캡처만 요청한다.

// ── 변수 목록 (그리드 위젯과 동기화되는 로컬 캐시 - 차트 범례/팝업이 참조) ──
// 오프라인 재생 모드에서는 이 배열이 불러온 기록 파일의 컬럼 정의로 임시 대체되므로
// (아래 "오프라인 재생" 절 참고), 그리드 위젯과의 동기화는 오프라인 모드가 아닐 때만 한다.
let variables = [];
const lastKnownValues = {}; // index -> 마지막으로 수신한 현재값 (폴링 정지 후에도 유지 - 종료값 캡처용)
let monStatus = 'stopped';
// 시작 버튼을 누른 순간 캡처(시작값 = 현재값)를 아직 못 끝냈다는 표시.
// 클릭 즉시 캡처하지 않고 항상 "이번 실행에서 새로 도착하는 첫 값"을 기다렸다가 캡처한다
// (applyIncomingValues에서 처리) - 정지 상태에서 남아있던 예전 현재값을 클릭 즉시 그대로
// 복사해버리면, 재시작할 때 시작값이 이번 구간과 무관한 예전 값으로 훅 넘어가는 문제가 있었다.
// 그리드 위젯이 아직 변수 목록을 다 못 불러온 상태(window.trendGridApi 없음)에서 시작을
// 누른 경우에도, 위젯이 준비된 뒤(trendGridReady) 또는 첫 값이 도착한 뒤 캡처하도록 미룬다.
let pendingStartCapture = false;
function tryCaptureStart() {
  if (!pendingStartCapture || offlineData) return;
  if (!window.trendGridApi) return; // 위젯이 아직 변수 목록을 불러오는 중 - 나중에 재시도
  const hasAnyCurrentValue = Object.values(lastKnownValues).some((v) => typeof v === 'number');
  if (!hasAnyCurrentValue) return; // 아직 값을 한 번도 못 받음 - 나중에 재시도
  window.trendGridApi.captureStart();
  pendingStartCapture = false;
}

/** 그리드 위젯(trend-widget.js)의 현재 변수 목록을 로컬 캐시로 가져온다 (차트 범례 등에서 사용). */
function syncVariablesFromGrid() {
  if (typeof offlineData !== 'undefined' && offlineData) return; // 오프라인 재생 중에는 건드리지 않음
  if (!window.trendGridApi) return;
  variables = window.trendGridApi.getVariables();
  // "차트" 체크박스는 위젯(시트) 쪽에서 바뀌므로, 값이 갱신될 때마다 여기서 미니 차트
  // 목록도 함께 다시 그려서(변수 추가/삭제/차트 토글이 즉시 반영되도록) 동기화한다.
  if (typeof rebuildIndividualCharts === 'function' && monDisplayMode === 'individual') rebuildIndividualCharts();
}
window.addEventListener('trendGridReady', () => {
  syncVariablesFromGrid();
  tryCaptureStart(); // 위젯 로딩이 늦어져서 값 수신이 먼저 끝났던 경우, 이제 캡처를 마무리한다.
  if (typeof restoreOpenPopups === 'function') restoreOpenPopups();
});

function labelFor(v) {
  // 오프라인으로 불러온 기록은 영역/주소 개념이 없고 Excel 헤더 텍스트만 있으므로 그걸 그대로 쓴다.
  if (v.offline) return v.label;
  return `${v.area}${v.address}${v.dataType === 'BOOL' && v.bit ? '.' + v.bit : ''}`;
}

/** 범례/팝업 제목 등에서 쓰는 "주소(그리드 설명)" 형식 - 설명이 없으면 주소만 표시한다. */
function labelWithDescription(v) {
  const base = labelFor(v);
  return v.description ? `${base} (${v.description})` : base;
}

/**
 * 폴링 상태(running/paused/stopped) 전환 처리 - 실제 서버(WS 'trendStatus')와
 * 오프라인 재생(모의 시작/일시정지/정지) 양쪽에서 공통으로 쓴다.
 */
function applyStatusTransition(nextStatus, intervalMs) {
  const wasRunning = monStatus === 'running';
  const wasStopped = monStatus === 'stopped';
  setMonStatusUI(nextStatus);
  if (intervalMs) monIntervalInput.value = intervalMs;

  // 일시정지/정지로 바뀌는 순간의 시각을 고정해서 그 이후로는 시간(X)축이 계속 흘러가지
  // 않고 멈춘 것처럼 보이게 한다. 다시 시작하면 고정을 풀고 실시간 추적으로 되돌아간다.
  if (nextStatus !== 'running' && wasRunning) {
    frozenNowAt = Date.now();
  } else if (nextStatus === 'running') {
    frozenNowAt = null;
    monXOffsetMs = 0;
  }

  if (nextStatus === 'running' && !wasRunning) {
    // 시작 버튼을 누른 시점에는 캡처하지 않고, 이번 시작 이후 새로 도착하는 첫 값을
    // 시작값으로 캡처한다(applyIncomingValues에서 처리). 정지 상태에서 남아있던 현재값을
    // 클릭 즉시 그대로 복사하면, 재시작 시 예전 값이 시작값으로 훅 넘어가 버리는 문제가
    // 있었다 - 반드시 "이번 실행의" 첫 값이어야 한다. 캐시(lastKnownValues)도 비워서,
    // 일부 변수만 먼저 도착했을 때 나머지 변수가 예전 값으로 오판되지 않게 한다.
    for (const k of Object.keys(lastKnownValues)) delete lastKnownValues[k];
    pendingStartCapture = true;
    // 그래프 버퍼는 "정지 상태에서 완전히 새로 시작"할 때만 비운다(일시정지 후 재개는
    // 이어서 그려야 하므로 비우지 않음). 예전에는 "정지" 시점에 비웠는데, 그러면 정지
    // 직후 "기록 내보내기"를 누를 데이터가 하나도 안 남아 있는 문제가 있었다 - 정지해도
    // 버퍼는 남겨두고, 다음에 새로 시작할 때 비로소 비운다.
    if (wasStopped) seriesBuffers = {};
  }
  if (nextStatus === 'stopped') {
    // 값이 한 번도 안 온 채로 정지된 경우(예: 시작 직후 바로 정지) 다음 시작 때까지
    // 캡처 대기 상태가 남아있지 않도록 정리한다.
    pendingStartCapture = false;
    // 정지 시점의 현재값을 종료값 열로 복사한다. 시작값-종료값 변화량이 기준범위 안인지의
    // 판정(비교판정)은 이 시점에 자동으로 계산하지 않고, "⚖ 비교판정" 버튼을 눌렀을 때만 한다.
    if (!offlineData && window.trendGridApi) window.trendGridApi.captureEnd();
    monReadCount.textContent = '0';
    monErrCount.textContent = '0';
    monLastRead.textContent = '-';
  }
  monStatus = nextStatus;
}

/**
 * 값 한 사이클(timestamp + {index: value}) 적용 - 실제 서버(WS 'trendValues')와
 * 오프라인 재생 양쪽에서 공통으로 쓴다.
 */
function applyIncomingValues(t, values) {
  for (const [key, value] of Object.entries(values)) {
    const idx = Number(key);
    lastKnownValues[idx] = value;
    if (!seriesBuffers[idx]) seriesBuffers[idx] = [];
    seriesBuffers[idx].push({ t, v: value });
    if (seriesBuffers[idx].length > MAX_POINTS_PER_SERIES) seriesBuffers[idx].shift();
  }
  // 오프라인 재생 중에는 재생 데이터의 인덱스가 불러온 기록 파일의 컬럼 순서일 뿐 실제
  // 변수 목록 그리드의 행과 대응하지 않으므로 그리드에는 반영하지 않는다.
  if (!offlineData && window.trendGridApi) {
    window.trendGridApi.applyValues(values);
  }
  tryCaptureStart(); // 캡처가 밀려 있었다면(값이 방금 처음 도착) 여기서 마무리한다.
  syncVariablesFromGrid();
  monReadCount.textContent = String(Number(monReadCount.textContent) + 1);
  monLastRead.textContent = new Date(t).toLocaleTimeString('ko-KR');
}

/**
 * 다른 화면에 갔다가 트렌드 화면으로 돌아오면(또는 새로고침) 서버가 들고 있던 최근 기록을
 * 받아서 그래프를 그대로 복원한다. applyIncomingValues와 달리 시작값 캡처 등 "새로 시작"
 * 관련 로직은 건드리지 않고 순수하게 버퍼만 채운다.
 */
function restoreValueHistory(history) {
  if (!Array.isArray(history) || history.length === 0) return;
  seriesBuffers = {};
  history.forEach(({ t, values }) => {
    for (const [key, value] of Object.entries(values)) {
      const idx = Number(key);
      lastKnownValues[idx] = value;
      if (!seriesBuffers[idx]) seriesBuffers[idx] = [];
      seriesBuffers[idx].push({ t, v: value });
    }
  });
  const last = history[history.length - 1];
  if (window.trendGridApi) window.trendGridApi.applyValues(last.values);
  syncVariablesFromGrid();
  monReadCount.textContent = String(history.length);
  monLastRead.textContent = new Date(last.t).toLocaleTimeString('ko-KR');
  redrawChart();
}

// 변수 추가/삭제/전체선택/전체해제/전체삭제/저장/비교판정/초기화/Excel 불러오기·내보내기는
// grid-app/src/trend-widget.js가 #trendGridContainer 안에서 직접 처리한다(위 window.trendGridApi
// 동기화 로직 참고).

// ── 폴링 시작/일시정지/정지 ──
const monIntervalInput = document.getElementById('monIntervalInput');
const monStartBtn = document.getElementById('monStartBtn');
const monPauseBtn = document.getElementById('monPauseBtn');
const monStopBtn = document.getElementById('monStopBtn');
const monReadCount = document.getElementById('monReadCount');
const monErrCount = document.getElementById('monErrCount');
const monLastRead = document.getElementById('monLastRead');
const monLastError = document.getElementById('monLastError');

function setMonStatusUI(status) {
  monStartBtn.disabled = status === 'running';
  monPauseBtn.disabled = status !== 'running';
  monStopBtn.disabled = status === 'stopped';
  monPauseBtn.classList.toggle('paused', status === 'paused');
}
setMonStatusUI('stopped');

// ── 오프라인 재생 (연결 없이, 불러온 기록 데이터를 시간 순서대로 재생) ──
const monOfflineBadge = document.getElementById('monOfflineBadge');
let offlineData = null; // { timestamps: [...], columns: [{label, values}] } - 불러온 전체 기록
let offlinePlaybackIndex = 0;
let offlinePlaybackTimer = null;

function clearOfflineData() {
  if (offlinePlaybackTimer) {
    clearInterval(offlinePlaybackTimer);
    offlinePlaybackTimer = null;
  }
  offlineData = null;
  offlinePlaybackIndex = 0;
  monOfflineBadge.style.display = 'none';
}

/** 불러온 기록 전체를 한 번에 그래프 버퍼에 채운다 - 불러오자마자(재생 없이도) 전체 그래프를 볼 수 있게 한다. */
function loadOfflineDataIntoBuffers() {
  seriesBuffers = {};
  if (!offlineData) return;
  offlineData.columns.forEach((c, idx) => {
    seriesBuffers[idx] = [];
    offlineData.timestamps.forEach((t, i) => {
      const raw = c.values[i];
      const v = raw === '' || raw === undefined || raw === null ? null : Number(raw);
      if (v !== null && Number.isFinite(v)) seriesBuffers[idx].push({ t, v });
    });
  });
}

function stepOfflinePlayback() {
  if (!offlineData || offlinePlaybackIndex >= offlineData.timestamps.length) {
    monStopBtn.click();
    return;
  }
  const t = offlineData.timestamps[offlinePlaybackIndex];
  const values = {};
  offlineData.columns.forEach((c, idx) => {
    const raw = c.values[offlinePlaybackIndex];
    values[idx] = raw === '' || raw === undefined || raw === null ? null : Number(raw);
  });
  applyIncomingValues(t, values);
  offlinePlaybackIndex += 1;
}

monStartBtn.addEventListener('click', async () => {
  if (!isPlcConnected) {
    if (!offlineData) {
      toast('먼저 "📈 기록 불러오기"로 저장된 데이터를 불러오세요.', 'err');
      return;
    }
    const ms = Number(monIntervalInput.value) || 1000;
    // 일시정지가 아니라 처음 시작하는 것이면, 정적으로 보여주던 전체 그래프를 비우고
    // 시뮬레이션처럼 처음부터 하나씩 다시 그려나간다.
    if (monStatus !== 'paused') {
      offlinePlaybackIndex = 0;
      seriesBuffers = {};
    }
    applyStatusTransition('running', ms);
    if (offlinePlaybackTimer) clearInterval(offlinePlaybackTimer);
    offlinePlaybackTimer = setInterval(stepOfflinePlayback, ms);
    return;
  }
  try {
    // 변수 목록 저장은 그리드 위젯(trend-widget.js)의 "💾 변수 목록 저장" 버튼이 전담한다.
    // 여기서 monitoring.js의 로컬 캐시(variables)를 다시 저장하면, 그 캐시가 아직
    // 동기화되지 않은 시점(예: 방금 새로고침 직후)에 빈 목록으로 덮어쓸 위험이 있다.
    const ms = Number(monIntervalInput.value) || 1000;
    const startRes = await fetch('/api/trend/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intervalMs: ms }),
    });
    const data = await startRes.json();
    if (!data.ok) toast('시작 실패: ' + data.error, 'err');
  } catch (e) {
    toast('시작 실패: ' + e.message, 'err');
  }
});
monPauseBtn.addEventListener('click', async () => {
  if (!isPlcConnected) {
    if (offlinePlaybackTimer) {
      clearInterval(offlinePlaybackTimer);
      offlinePlaybackTimer = null;
    }
    applyStatusTransition('paused');
    return;
  }
  await fetch('/api/trend/pause', { method: 'POST' });
});
monStopBtn.addEventListener('click', async () => {
  if (!isPlcConnected) {
    if (offlinePlaybackTimer) {
      clearInterval(offlinePlaybackTimer);
      offlinePlaybackTimer = null;
    }
    offlinePlaybackIndex = 0;
    applyStatusTransition('stopped');
    // applyStatusTransition이 비워버린 그래프를, 정지 후에는 다시 불러온 기록 전체 보기로 되돌린다.
    loadOfflineDataIntoBuffers();
    redrawChart();
    return;
  }
  await fetch('/api/trend/stop', { method: 'POST' });
});

// ── 기록(시간별 값) Excel 내보내기/불러오기 - 연결 없이도 과거 트렌드를 볼 수 있게 한다 ──
function buildHistoryExportPayload() {
  const indexes = Object.keys(seriesBuffers).map(Number).filter((idx) => seriesBuffers[idx] && seriesBuffers[idx].length > 0);
  if (indexes.length === 0) return null;
  const tSet = new Set();
  indexes.forEach((idx) => seriesBuffers[idx].forEach((p) => tSet.add(p.t)));
  const timestamps = Array.from(tSet).sort((a, b) => a - b);
  const columns = indexes.map((idx) => {
    const map = new Map(seriesBuffers[idx].map((p) => [p.t, p.v]));
    return { label: labelFor(variables[idx]), values: timestamps.map((t) => (map.has(t) ? map.get(t) : '')) };
  });
  return { timestamps, columns };
}

/** 단일 시리즈(개별 미니 차트)용 {timestamps, columns} 페이로드 - buildHistoryExportPayload와 동일한 모양. */
function buildSingleSeriesExportPayload(seriesIndex) {
  const buf = seriesBuffers[seriesIndex];
  if (!buf || buf.length === 0) return null;
  return {
    timestamps: buf.map((p) => p.t),
    columns: [{ label: labelFor(variables[seriesIndex]), values: buf.map((p) => p.v) }],
  };
}

function csvEscapeClient(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** {timestamps, columns} 페이로드를 CSV 문자열로 만든다(서버 trendManager.js의 CSV 형식과 동일). */
function buildCsvFromPayload({ timestamps, columns }) {
  const header = ['시간', ...columns.map((c) => c.label)];
  const rows = [header];
  timestamps.forEach((t, i) => {
    const row = [new Date(t).toLocaleString('ko-KR')];
    columns.forEach((c) => row.push(c.values[i] === undefined || c.values[i] === null ? '' : c.values[i]));
    rows.push(row);
  });
  return rows.map((r) => r.map(csvEscapeClient).join(',')).join('\n');
}

/** 우클릭 메뉴의 "내보내기 → PNG": 캔버스를 그대로 이미지로 저장(창 선택). */
async function exportChartPngPicker(canvas, filenameBase) {
  const dataUrl = canvas.toDataURL('image/png');
  const blob = await (await fetch(dataUrl)).blob();
  await saveBlobWithPicker(blob, `${filenameBase}_${Date.now()}.png`, 'image/png');
}

/** 우클릭 메뉴의 "내보내기 → CSV": 차트 데이터를 CSV로 저장(창 선택). */
async function exportChartCsvPicker(payload, filenameBase) {
  if (!payload) {
    toast('내보낼 데이터가 없습니다.', 'err');
    return;
  }
  const csv = buildCsvFromPayload(payload);
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  await saveBlobWithPicker(blob, `${filenameBase}_${Date.now()}.csv`, 'text/csv');
}

/** 우클릭 메뉴의 "내보내기 → PDF": 캔버스 이미지를 서버에서 PDF 한 페이지로 감싸 저장(창 선택). */
async function exportChartPdfPicker(canvas, filenameBase, title) {
  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1] || '';
  await fetchAndSave(
    '/api/trend/chart/export-pdf',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: base64, title }) },
    `${filenameBase}_${Date.now()}.pdf`,
    'application/pdf'
  );
}

document.getElementById('monHistoryExportBtn').addEventListener('click', async () => {
  const payload = buildHistoryExportPayload();
  if (!payload) {
    toast('내보낼 기록이 없습니다. 먼저 시작해서 데이터를 모아주세요.', 'err');
    return;
  }
  await fetchAndSave(
    '/api/trend/history/export',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    `DATA_Trend_${Date.now()}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
});

const monHistoryImportFile = document.getElementById('monHistoryImportFile');
document.getElementById('monHistoryImportBtn').addEventListener('click', () => {
  monHistoryImportFile.value = '';
  monHistoryImportFile.click();
});
monHistoryImportFile.addEventListener('change', async () => {
  const file = monHistoryImportFile.files && monHistoryImportFile.files[0];
  if (!file) return;
  try {
    const fileBase64 = await fileToBase64(file);
    const res = await fetch('/api/trend/history/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileBase64 }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || '불러오기 실패');
    if (data.columns.length === 0) {
      toast('불러온 파일에 데이터가 없습니다.', 'err');
      return;
    }
    // 재생 중이었다면 먼저 멈춘다
    if (offlinePlaybackTimer) {
      clearInterval(offlinePlaybackTimer);
      offlinePlaybackTimer = null;
    }
    offlineData = { timestamps: data.timestamps, columns: data.columns };
    offlinePlaybackIndex = 0;
    monOfflineBadge.style.display = '';
    variables = data.columns.map((c) => ({
      offline: true, label: c.label, chart: true, dataType: 'WORD',
      description: '', tolerance: '', startValue: '', endValue: '', compareValue: '',
    }));
    for (const k of Object.keys(lastKnownValues)) delete lastKnownValues[k];
    monReadCount.textContent = '0';
    monErrCount.textContent = '0';
    monLastRead.textContent = '-';
    setMonStatusUI('stopped');
    monStatus = 'stopped';
    // 불러오자마자(재생하지 않아도) 전체 그래프를 바로 볼 수 있도록 전체 구간을 채워서 그린다.
    loadOfflineDataIntoBuffers();
    if (data.timestamps.length > 0) {
      monXManualMin = data.timestamps[0];
      monXManualMax = data.timestamps[data.timestamps.length - 1];
      monXMode = 'manual';
      monYMode = 'auto';
    }
    if (typeof rebuildIndividualCharts === 'function') rebuildIndividualCharts();
    redrawChart();
    toast(`기록 ${data.timestamps.length}개 시점, 변수 ${data.columns.length}개 불러옴 (오프라인 재생 준비됨)`, 'ok');
  } catch (e) {
    toast('기록 불러오기 실패: ' + e.message, 'err');
  }
});

// ── 다중 계열 트렌드 차트 (휠 확대/축소 + 마우스 호버 툴팁 + 우클릭 메뉴 포함) ──
const monChart = document.getElementById('monChart');
const monChartWrap = document.getElementById('monChartWrap');
const monZoomRect = document.getElementById('monZoomRect');
const monCtx = monChart.getContext('2d');
const monAutoFitBtn = document.getElementById('monAutoFitBtn');
const monYMinInput = document.getElementById('monYMinInput');
const monYMaxInput = document.getElementById('monYMaxInput');
const monYSetBtn = document.getElementById('monYSetBtn');
const monXWindowInput = document.getElementById('monXWindowInput');
const monXSetBtn = document.getElementById('monXSetBtn');

// ── 개별 트렌드 미니 차트 클릭 시 뜨는 팝업들 - 여러 개를 동시에 띄울 수 있고,
// 팝업마다 Total 트렌드와 동일한 기능(휠 확대/축소, 드래그 팬/줌, 호버 툴팁, 우클릭 메뉴,
// Auto Fit/Y/X 범위 설정, 시작/일시정지/정지)을 각자 독립적으로 갖는다. ──
const openPopups = new Map(); // seriesIndex -> { draw, close, popup }
let popupZIndexCounter = 2500;

/** 이미 열려있으면 앞으로 가져오고, 없으면 새로 만든다. */
function openOrFocusPopup(seriesIndex) {
  const existing = openPopups.get(seriesIndex);
  if (existing) {
    existing.popup.style.zIndex = String(++popupZIndexCounter);
    return;
  }
  createChartPopup(seriesIndex);
}

function createChartPopup(seriesIndex, savedState) {
  const state = {
    yMode: 'auto', // 'auto' | 'manual'
    xMode: 'window', // 'window' | 'manual'
    xWindowSec: 60,
    xOffsetMs: 0,
    xManualMin: null,
    xManualMax: null,
    mouseMode: 'pan', // 'pan' | 'zoom'
    showGrid: true,
    viewStatus: 'running', // 이 팝업 화면만의 재생 상태(실제 폴링과 무관 - 시간축을 따라갈지/멈출지)
    frozenAt: null,
    lastPlot: null,
    hoverX: null,
    dragState: null,
  };
  if (savedState) {
    Object.assign(state, {
      yMode: savedState.yMode ?? state.yMode,
      xMode: savedState.xMode ?? state.xMode,
      xWindowSec: savedState.xWindowSec ?? state.xWindowSec,
      xOffsetMs: savedState.xOffsetMs ?? state.xOffsetMs,
      xManualMin: savedState.xManualMin ?? state.xManualMin,
      xManualMax: savedState.xManualMax ?? state.xManualMax,
      mouseMode: savedState.mouseMode ?? state.mouseMode,
      showGrid: savedState.showGrid ?? state.showGrid,
    });
  }

  const popup = document.createElement('div');
  popup.className = 'chart-popup';
  popup.style.display = 'flex';
  if (savedState && savedState.left && savedState.top) {
    popup.style.left = savedState.left;
    popup.style.top = savedState.top;
  } else {
    const offset = (openPopups.size % 8) * 28;
    popup.style.top = (80 + offset) + 'px';
    popup.style.left = `calc(50% + ${offset}px)`;
    popup.style.transform = 'translateX(-50%)';
  }
  if (savedState && savedState.width && savedState.height) {
    popup.style.width = savedState.width;
    popup.style.height = savedState.height;
  }
  popup.style.zIndex = String(++popupZIndexCounter);
  popup.innerHTML = `
    <div class="chart-popup-header">
      <span class="chart-popup-title"></span>
      <button class="cp-close" title="닫기">✕</button>
    </div>
    <div class="chart-toolbar">
      <button class="cp-start primary">▶ 시작</button>
      <button class="cp-pause">⏸ 일시정지</button>
      <button class="cp-stop danger">⏹ 정지</button>
      <div class="sep"></div>
      <button class="cp-autofit">Auto Fit</button>
      <label>Y min <input type="number" class="cp-ymin" value="0" /></label>
      <label>Y max <input type="number" class="cp-ymax" value="100" /></label>
      <button class="cp-yset">Y Set</button>
      <div class="sep"></div>
      <label>구간(초) <input type="number" class="cp-xwindow" value="60" min="5" max="3600" /></label>
      <button class="cp-xset">X Set</button>
      <label>시작 <input type="datetime-local" class="cp-xmin" step="1" /></label>
      <label>종료 <input type="datetime-local" class="cp-xmax" step="1" /></label>
      <button class="cp-xrangeset">범위 설정</button>
    </div>
    <div class="chart-popup-canvas-wrap">
      <canvas></canvas>
      <div class="zoom-rect"></div>
    </div>
  `;
  document.body.appendChild(popup);

  const canvas = popup.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const zoomRect = popup.querySelector('.zoom-rect');
  const titleEl = popup.querySelector('.chart-popup-title');
  const closeBtn = popup.querySelector('.cp-close');
  const startBtn = popup.querySelector('.cp-start');
  const pauseBtn = popup.querySelector('.cp-pause');
  const stopBtn = popup.querySelector('.cp-stop');
  const autoFitBtn = popup.querySelector('.cp-autofit');
  const yMinInput = popup.querySelector('.cp-ymin');
  const yMaxInput = popup.querySelector('.cp-ymax');
  const ySetBtn = popup.querySelector('.cp-yset');
  const xWindowInput = popup.querySelector('.cp-xwindow');
  const xSetBtn = popup.querySelector('.cp-xset');
  const xMinInput = popup.querySelector('.cp-xmin');
  const xMaxInput = popup.querySelector('.cp-xmax');
  const xRangeSetBtn = popup.querySelector('.cp-xrangeset');

  xWindowInput.value = state.xWindowSec;
  if (savedState) {
    if (savedState.yMin != null) yMinInput.value = savedState.yMin;
    if (savedState.yMax != null) yMaxInput.value = savedState.yMax;
  }

  function currentVariable() {
    return variables[seriesIndex] || { label: '(삭제됨)', offline: true };
  }
  titleEl.textContent = labelWithDescription(currentVariable());

  function computeRange() {
    if (state.xMode === 'manual' && state.xManualMin != null && state.xManualMax != null) {
      return { xMin: state.xManualMin, xMax: state.xManualMax };
    }
    const liveNow = state.viewStatus === 'running' ? Date.now() : (state.frozenAt !== null ? state.frozenAt : Date.now());
    const now = liveNow - state.xOffsetMs;
    return { xMin: now - state.xWindowSec * 1000, xMax: now };
  }

  function setViewStatus(next) {
    const wasRunning = state.viewStatus === 'running';
    if (next !== 'running' && wasRunning) state.frozenAt = Date.now();
    else if (next === 'running') {
      state.frozenAt = null;
      state.xOffsetMs = 0;
    }
    state.viewStatus = next;
    startBtn.disabled = next === 'running';
    pauseBtn.disabled = next !== 'running';
    stopBtn.disabled = next === 'stopped';
    pauseBtn.classList.toggle('paused', next === 'paused');
  }
  if (savedState && savedState.viewStatus) {
    // 저장된 재생 상태를 그대로 복원 - setViewStatus의 "새로 시작" 부수효과(xOffsetMs 초기화 등)를
    // 거치지 않고 상태만 직접 맞춘다(복원한 xOffsetMs/frozenAt을 덮어쓰지 않기 위해).
    state.viewStatus = savedState.viewStatus;
    state.frozenAt = savedState.frozenAt ?? null;
    startBtn.disabled = state.viewStatus === 'running';
    pauseBtn.disabled = state.viewStatus !== 'running';
    stopBtn.disabled = state.viewStatus === 'stopped';
    pauseBtn.classList.toggle('paused', state.viewStatus === 'paused');
  } else {
    setViewStatus('running');
  }

  function draw() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = Math.max(1, Math.floor(rect.width));
      canvas.height = Math.max(1, Math.floor(rect.height));
    }
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const style = getComputedStyle(document.documentElement);
    const gridColor = style.getPropertyValue('--panel-border').trim() || '#ccc';
    const textColor = style.getPropertyValue('--muted').trim() || '#888';
    const panelColor = style.getPropertyValue('--panel').trim() || '#fff';

    const padding = { left: 50, right: 14, top: 14, bottom: 24 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;
    if (plotW <= 0 || plotH <= 0) return;

    const { xMin, xMax } = computeRange();
    state.lastPlot = { padding, plotW, xMin, xMax };
    if (document.activeElement !== xMinInput) xMinInput.value = epochToDatetimeLocal(xMin);
    if (document.activeElement !== xMaxInput) xMaxInput.value = epochToDatetimeLocal(xMax);

    const buf = (seriesBuffers[seriesIndex] || []).filter((p) => p.t >= xMin && p.t <= xMax && typeof p.v === 'number');

    let yMin;
    let yMax;
    if (state.yMode === 'auto') {
      if (buf.length === 0) {
        yMin = 0;
        yMax = 100;
      } else {
        const vals = buf.map((p) => p.v);
        yMin = Math.min(...vals);
        yMax = Math.max(...vals);
        if (yMin === yMax) { yMin -= 1; yMax += 1; }
        const margin = (yMax - yMin) * 0.15;
        yMin -= margin;
        yMax += margin;
      }
      yMinInput.value = Math.round(yMin);
      yMaxInput.value = Math.round(yMax);
    } else {
      yMin = Number(yMinInput.value) || 0;
      yMax = Number(yMaxInput.value) || 100;
      if (yMax <= yMin) yMax = yMin + 1;
    }

    const xPix = (t) => padding.left + ((t - xMin) / (xMax - xMin)) * plotW;
    const yPix = (v) => padding.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
    const pixToX = (px) => xMin + ((px - padding.left) / plotW) * (xMax - xMin);

    ctx.strokeStyle = gridColor;
    ctx.fillStyle = textColor;
    ctx.font = '10px sans-serif';
    ctx.lineWidth = 1;
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const v = yMin + ((yMax - yMin) * i) / yTicks;
      const y = yPix(v);
      if (state.showGrid) {
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();
      }
      ctx.fillText(v.toFixed(1), 2, y + 3);
    }
    const xTicks = 4;
    for (let i = 0; i <= xTicks; i++) {
      const t = xMin + ((xMax - xMin) * i) / xTicks;
      const x = xPix(t);
      if (state.showGrid) {
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, h - padding.bottom);
        ctx.stroke();
      }
      const d = new Date(t);
      ctx.fillText(`${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`, x - 12, h - 6);
    }

    if (buf.length > 0) {
      ctx.strokeStyle = seriesColor(seriesIndex);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      buf.forEach((p, i) => {
        const x = xPix(p.t);
        const y = yPix(p.v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    if (state.hoverX !== null && state.hoverX >= padding.left && state.hoverX <= w - padding.right && buf.length > 0) {
      const hoverT = pixToX(state.hoverX);
      ctx.strokeStyle = textColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(state.hoverX, padding.top);
      ctx.lineTo(state.hoverX, h - padding.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      let nearest = buf[0];
      let bestDiff = Math.abs(buf[0].t - hoverT);
      for (const p of buf) {
        const diff = Math.abs(p.t - hoverT);
        if (diff < bestDiff) { bestDiff = diff; nearest = p; }
      }

      const d = new Date(hoverT);
      const timeLabel = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      const valText = typeof nearest.v === 'number' ? nearest.v.toFixed(2) : String(nearest.v);
      ctx.font = 'bold 11px sans-serif';
      const boxW = 220;
      const boxH = 34;
      let boxX = state.hoverX + 10;
      if (boxX + boxW > w) boxX = state.hoverX - boxW - 10;
      const boxY = padding.top + 4;
      ctx.fillStyle = panelColor;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeRect(boxX, boxY, boxW, boxH);
      ctx.fillStyle = textColor;
      ctx.fillText(timeLabel, boxX + 8, boxY + 14);
      ctx.font = '11px sans-serif';
      ctx.fillText(`${labelWithDescription(currentVariable())}: ${valText}`, boxX + 8, boxY + 28);
    }
  }

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    state.xMode = 'window';
    const factor = e.deltaY > 0 ? 1.2 : 1 / 1.2;
    state.xWindowSec = Math.min(3600, Math.max(5, Math.round(state.xWindowSec * factor)));
    xWindowInput.value = state.xWindowSec;
    draw();
  }, { passive: false });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !state.lastPlot) return;
    popup.style.zIndex = String(++popupZIndexCounter);
    state.xMode = 'window';
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    state.dragState = { mode: state.mouseMode, startPx: px, startOffsetMs: state.xOffsetMs };
    if (state.mouseMode === 'zoom') {
      zoomRect.style.display = 'block';
      zoomRect.style.left = px + 'px';
      zoomRect.style.top = '0px';
      zoomRect.style.width = '0px';
      zoomRect.style.height = rect.height + 'px';
    }
  });

  function onWindowMousemove(e) {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    if (state.dragState && state.lastPlot) {
      if (state.dragState.mode === 'pan') {
        const msPerPx = (state.lastPlot.xMax - state.lastPlot.xMin) / state.lastPlot.plotW;
        const deltaPx = px - state.dragState.startPx;
        state.xOffsetMs = Math.max(0, state.dragState.startOffsetMs - deltaPx * msPerPx);
        draw();
      } else if (state.dragState.mode === 'zoom') {
        const left = Math.min(state.dragState.startPx, px);
        const width = Math.abs(px - state.dragState.startPx);
        zoomRect.style.left = left + 'px';
        zoomRect.style.width = width + 'px';
      }
      return;
    }
    const py = e.clientY - rect.top;
    if (px >= 0 && px <= rect.width && py >= 0 && py <= rect.height) {
      state.hoverX = px;
      draw();
    } else if (state.hoverX !== null) {
      state.hoverX = null;
      draw();
    }
  }
  window.addEventListener('mousemove', onWindowMousemove);

  function onWindowMouseup(e) {
    if (!state.dragState) return;
    if (state.dragState.mode === 'zoom' && state.lastPlot) {
      const rect = canvas.getBoundingClientRect();
      const px = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const t1 = state.lastPlot.xMin + ((state.dragState.startPx - state.lastPlot.padding.left) / state.lastPlot.plotW) * (state.lastPlot.xMax - state.lastPlot.xMin);
      const t2 = state.lastPlot.xMin + ((px - state.lastPlot.padding.left) / state.lastPlot.plotW) * (state.lastPlot.xMax - state.lastPlot.xMin);
      const tMin = Math.min(t1, t2);
      const tMax = Math.max(t1, t2);
      const spanSec = (tMax - tMin) / 1000;
      if (spanSec >= 1) {
        const now = state.frozenAt !== null ? state.frozenAt : Date.now();
        state.xWindowSec = Math.min(3600, Math.max(5, Math.round(spanSec)));
        xWindowInput.value = state.xWindowSec;
        state.xOffsetMs = Math.max(0, now - tMax);
      }
      zoomRect.style.display = 'none';
    }
    state.dragState = null;
    draw();
  }
  window.addEventListener('mouseup', onWindowMouseup);

  canvas.addEventListener('mouseleave', () => {
    if (!state.dragState) state.hoverX = null;
    draw();
  });

  autoFitBtn.addEventListener('click', () => { state.yMode = 'auto'; draw(); });
  ySetBtn.addEventListener('click', () => { state.yMode = 'manual'; draw(); });
  xSetBtn.addEventListener('click', () => {
    state.xMode = 'window';
    state.xWindowSec = Number(xWindowInput.value) || 60;
    state.xOffsetMs = 0;
    draw();
  });
  xRangeSetBtn.addEventListener('click', () => {
    if (!xMinInput.value || !xMaxInput.value) {
      toast('시작/종료 시각을 모두 입력하세요.', 'err');
      return;
    }
    const minMs = new Date(xMinInput.value).getTime();
    const maxMs = new Date(xMaxInput.value).getTime();
    if (!Number.isFinite(minMs) || !Number.isFinite(maxMs) || maxMs <= minMs) {
      toast('종료 시각이 시작 시각보다 커야 합니다.', 'err');
      return;
    }
    state.xManualMin = minMs;
    state.xManualMax = maxMs;
    state.xMode = 'manual';
    draw();
  });

  startBtn.addEventListener('click', () => setViewStatus('running'));
  pauseBtn.addEventListener('click', () => setViewStatus('paused'));
  stopBtn.addEventListener('click', async () => {
    setViewStatus('stopped');
    // 이 팝업에서 "정지"를 누른 순간, 이 변수 하나만의 지금까지 쌓인 기록을 로그 파일로 남긴다
    // (Total 저장과는 별개 - 전체 트렌드를 한꺼번에 정지할 때만 Total 파일이 저장된다).
    const buf = seriesBuffers[seriesIndex] || [];
    if (buf.length === 0) return;
    try {
      const res = await fetch('/api/trend/history/save-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: labelFor(currentVariable()),
          description: currentVariable().description || '',
          timestamps: buf.map((p) => p.t),
          values: buf.map((p) => p.v),
        }),
      });
      const data = await res.json();
      if (data.ok) toast(`"${labelWithDescription(currentVariable())}" 기록 저장됨: ${data.fileName}`, 'ok');
      else toast('개별 기록 저장 실패: ' + data.error, 'err');
    } catch (e) {
      toast('개별 기록 저장 실패: ' + e.message, 'err');
    }
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    closeCtxMenu();
    const mouseModeSub = [
      makeItem('팬 (드래그로 이동)', { checkable: true, checked: state.mouseMode === 'pan', onClick: () => { state.mouseMode = 'pan'; } }),
      makeItem('확대 (드래그로 영역 선택)', { checkable: true, checked: state.mouseMode === 'zoom', onClick: () => { state.mouseMode = 'zoom'; } }),
    ];
    const plotOptionsSub = [
      makeItem('격자 표시', { checkable: true, checked: state.showGrid, onClick: () => { state.showGrid = !state.showGrid; draw(); } }),
    ];
    const menuEl = document.createElement('div');
    menuEl.className = 'ctx-menu';
    menuEl.appendChild(makeItem('전체 보기', {
      onClick: () => {
        const buf = seriesBuffers[seriesIndex] || [];
        if (buf.length > 0) {
          state.xManualMin = buf[0].t;
          state.xManualMax = buf[buf.length - 1].t;
          state.xMode = 'manual';
        } else {
          state.xWindowSec = 60;
          state.xMode = 'window';
          state.xOffsetMs = 0;
        }
        state.yMode = 'auto';
        draw();
      },
    }));
    menuEl.appendChild(makeItem('마우스 모드', { hasSub: true, subItems: mouseModeSub }));
    menuEl.appendChild(makeItem('플롯 옵션', { hasSub: true, subItems: plotOptionsSub }));
    const exportSub = [
      makeItem('PNG...', { onClick: () => exportChartPngPicker(canvas, `DATA_Trend_Chart_${labelFor(currentVariable())}`) }),
      makeItem('CSV...', { onClick: () => exportChartCsvPicker(buildSingleSeriesExportPayload(seriesIndex), `DATA_Trend_Chart_${labelFor(currentVariable())}`) }),
      makeItem('PDF...', { onClick: () => exportChartPdfPicker(canvas, `DATA_Trend_Chart_${labelFor(currentVariable())}`, labelWithDescription(currentVariable())) }),
    ];
    menuEl.appendChild(makeItem('내보내기', { hasSub: true, subItems: exportSub }));
    document.body.appendChild(menuEl);
    setCtxMenu(menuEl);
    const menuRect = menuEl.getBoundingClientRect();
    let x = e.clientX;
    let y = e.clientY;
    if (x + menuRect.width > window.innerWidth) x = window.innerWidth - menuRect.width - 8;
    if (y + menuRect.height > window.innerHeight) y = window.innerHeight - menuRect.height - 8;
    menuEl.style.left = x + 'px';
    menuEl.style.top = y + 'px';
  });

  const header = popup.querySelector('.chart-popup-header');
  let dragging = false;
  let dragOffX = 0;
  let dragOffY = 0;
  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    popup.style.zIndex = String(++popupZIndexCounter);
    dragging = true;
    const r = popup.getBoundingClientRect();
    dragOffX = e.clientX - r.left;
    dragOffY = e.clientY - r.top;
    popup.style.left = r.left + 'px';
    popup.style.top = r.top + 'px';
    popup.style.transform = 'none';
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    popup.style.left = (e.clientX - dragOffX) + 'px';
    popup.style.top = (e.clientY - dragOffY) + 'px';
  });
  window.addEventListener('mouseup', () => { dragging = false; });

  function getState() {
    const rect = popup.getBoundingClientRect();
    return {
      yMode: state.yMode,
      yMin: Number(yMinInput.value) || 0,
      yMax: Number(yMaxInput.value) || 100,
      xMode: state.xMode,
      xWindowSec: state.xWindowSec,
      xOffsetMs: state.xOffsetMs,
      xManualMin: state.xManualMin,
      xManualMax: state.xManualMax,
      mouseMode: state.mouseMode,
      showGrid: state.showGrid,
      viewStatus: state.viewStatus,
      frozenAt: state.frozenAt,
      left: rect.left + 'px',
      top: rect.top + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px',
    };
  }

  function close() {
    window.removeEventListener('mousemove', onWindowMousemove);
    window.removeEventListener('mouseup', onWindowMouseup);
    popup.remove();
    openPopups.delete(seriesIndex);
    persistPopupsState();
  }
  closeBtn.addEventListener('click', close);

  draw();
  openPopups.set(seriesIndex, { draw, close, popup, getState });
  persistPopupsState();
}

function closeAllPopups() {
  for (const { close } of Array.from(openPopups.values())) close();
}

// 다른 화면으로 이동했다가 돌아와도(또는 새로고침) 열려있던 개별 트렌드 팝업들이 각자의
// 설정(Y/X 범위, 마우스 모드, 재생 상태, 위치/크기)까지 그대로 복원되도록 localStorage에 저장한다.
const POPUP_STATE_KEY = 'plcTrendPopupsState';
function persistPopupsState() {
  const arr = [];
  for (const [idx, ctrl] of openPopups.entries()) {
    arr.push({ idx, state: ctrl.getState() });
  }
  try {
    localStorage.setItem(POPUP_STATE_KEY, JSON.stringify(arr));
  } catch (e) {
    /* localStorage 용량 초과 등은 무시 */
  }
}
function restoreOpenPopups() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(POPUP_STATE_KEY) || '[]');
  } catch (e) {
    saved = [];
  }
  if (!Array.isArray(saved) || saved.length === 0) return;
  saved.forEach(({ idx, state }) => {
    if (typeof idx === 'number' && idx >= 0 && idx < variables.length) createChartPopup(idx, state);
  });
}
// 열려있는 팝업의 드래그 이동/휠 확대 등은 그때그때 다 저장하기보다, 주기적으로 스냅샷을 남긴다.
setInterval(persistPopupsState, 2000);

// ── Total(하나로 겹쳐 표시) / 개별(변수마다 미니 차트) 표시 모드 ──
const monModeIndividualBtn = document.getElementById('monModeIndividualBtn');
const monModeTotalBtn = document.getElementById('monModeTotalBtn');
const monChartGrid = document.getElementById('monChartGrid');
const DISPLAY_MODE_KEY = 'plcTrendDisplayMode';
let monDisplayMode = 'total'; // 'total' | 'individual'
const miniChartRefs = {}; // index -> { canvas, ctx, valueEl }

function setMonDisplayMode(mode, skipPersist) {
  monDisplayMode = mode;
  monModeTotalBtn.classList.toggle('primary', mode === 'total');
  monModeIndividualBtn.classList.toggle('primary', mode === 'individual');
  monChartWrap.style.display = mode === 'total' ? '' : 'none';
  monChartGrid.style.display = mode === 'individual' ? 'grid' : 'none';
  if (mode === 'total') closeAllPopups();
  if (mode === 'individual') rebuildIndividualCharts();
  if (!skipPersist) localStorage.setItem(DISPLAY_MODE_KEY, mode);
  redrawChart();
}
monModeTotalBtn.addEventListener('click', () => setMonDisplayMode('total'));
monModeIndividualBtn.addEventListener('click', () => setMonDisplayMode('individual'));
// 다른 화면에 갔다가 돌아왔을 때 개별/Total 중 마지막으로 보던 모드를 그대로 이어간다.
if (localStorage.getItem(DISPLAY_MODE_KEY) === 'individual') setMonDisplayMode('individual', true);

/** 변수 목록이 바뀔 때마다(추가/삭제/불러오기 등) 개별 모드용 미니 카드+캔버스를 다시 만든다. */
function rebuildIndividualCharts() {
  monChartGrid.innerHTML = '';
  for (const k of Object.keys(miniChartRefs)) delete miniChartRefs[k];
  variables.forEach((v, idx) => {
    if (v.chart === false) return;
    const card = document.createElement('div');
    card.className = 'mon-mini-card';

    const title = document.createElement('div');
    title.className = 'mon-mini-title';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = labelWithDescription(v);
    nameSpan.style.color = seriesColor(idx);
    title.appendChild(nameSpan);
    card.appendChild(title);

    const valueSpan = document.createElement('span');
    valueSpan.className = 'mon-mini-value';
    valueSpan.textContent = '-';
    card.appendChild(valueSpan);

    const canvas = document.createElement('canvas');
    canvas.style.cursor = 'pointer';
    canvas.title = '클릭하면 이 변수만 크게 보기(Total 트렌드와 동일하게 확대/이동/우클릭 메뉴 사용 가능)';
    canvas.addEventListener('click', () => openOrFocusPopup(idx));
    card.appendChild(canvas);
    monChartGrid.appendChild(card);
    miniChartRefs[idx] = { canvas, ctx: canvas.getContext('2d'), valueEl: valueSpan };
  });
}

/** 개별 모드의 미니 차트들을 그린다 - 변수마다 자기 값 범위에 맞춰 Y축을 자동으로 맞춘다(첨부 이미지 스타일). */
function drawIndividualCharts() {
  if (monDisplayMode !== 'individual') return;
  const { xMin, xMax } = computeXRange();
  const style = getComputedStyle(document.documentElement);
  const textColor = style.getPropertyValue('--muted').trim() || '#888';

  for (const idxStr of Object.keys(miniChartRefs)) {
    const idx = Number(idxStr);
    const ref = miniChartRefs[idx];
    const rect = ref.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (ref.canvas.width !== rect.width || ref.canvas.height !== rect.height) {
      ref.canvas.width = Math.max(1, Math.floor(rect.width));
      ref.canvas.height = Math.max(1, Math.floor(rect.height));
    }
    const ctx = ref.ctx;
    const w = ref.canvas.width;
    const h = ref.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const buf = (seriesBuffers[idx] || []).filter((p) => p.t >= xMin && p.t <= xMax && typeof p.v === 'number');
    if (buf.length > 1) {
      let yMin = Math.min(...buf.map((p) => p.v));
      let yMax = Math.max(...buf.map((p) => p.v));
      if (yMin === yMax) { yMin -= 1; yMax += 1; }
      const margin = (yMax - yMin) * 0.15;
      yMin -= margin;
      yMax += margin;

      const pad = 3;
      const xPix = (t) => pad + ((t - xMin) / (xMax - xMin || 1)) * (w - pad * 2);
      const yPix = (v) => pad + (h - pad * 2) - ((v - yMin) / (yMax - yMin || 1)) * (h - pad * 2);

      ctx.strokeStyle = seriesColor(idx);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      buf.forEach((p, i) => {
        const x = xPix(p.t);
        const y = yPix(p.v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    } else {
      ctx.fillStyle = textColor;
      ctx.font = '11px sans-serif';
      ctx.fillText('데이터 없음', 6, h / 2);
    }

    const last = buf.length > 0 ? buf[buf.length - 1].v : null;
    ref.valueEl.textContent = last === null ? '-' : typeof last === 'number' ? last.toFixed(2) : String(last);
  }
}

let seriesBuffers = {}; // index -> [{t, v}, ...]
let monYMode = 'auto'; // 'auto' | 'manual'
let monXWindowSec = 60;
let monXOffsetMs = 0; // 0이면 실시간(현재 시각)을 오른쪽 끝으로 추적, 0보다 크면 그만큼 과거를 보고 있음(패닝/줌 결과)
let monXMode = 'window'; // 'window'(구간(초) 기준 상대 구간) | 'manual'(시작~종료 시각 직접 입력)
let monXManualMin = null; // monXMode==='manual'일 때 사용하는 절대 시각(ms)
let monXManualMax = null;
let monMouseMode = 'pan'; // 'pan' | 'zoom' - PyQtGraph의 Mouse Mode와 동일한 개념
let monShowGrid = true;
const SERIES_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#16a085', '#8e44ad'];
const MAX_POINTS_PER_SERIES = 3600; // 메모리 상한 (약 1시간 @1초 간격)
let hoverX = null; // 캔버스 내 마우스 X좌표 (없으면 null)

// 일시정지/정지 중에는 시간(X)축이 "지금"을 계속 따라가며 진행되면 안 되므로,
// running이 아닌 상태로 바뀐 시점의 시각을 고정해두고 그 시각을 오른쪽 끝 기준으로 그린다.
let frozenNowAt = null;

// 패닝/사각형 줌 계산에 pixel↔time 변환이 필요해서, 매 렌더링 시점의 스케일을 기억해둔다.
let lastPlot = null; // { padding, plotW, xMin, xMax }

function seriesColor(index) {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

function resetToLive() {
  monXOffsetMs = 0;
  monXMode = 'window';
}

/** Total/개별 차트가 공통으로 쓰는 X축 범위(ms) 계산 - 상대 구간(window) 또는 직접입력(manual) 모드를 반영한다. */
function computeXRange() {
  if (monXMode === 'manual' && monXManualMin != null && monXManualMax != null) {
    return { xMin: monXManualMin, xMax: monXManualMax };
  }
  const liveNow = monStatus === 'running' ? Date.now() : (frozenNowAt !== null ? frozenNowAt : Date.now());
  const now = liveNow - monXOffsetMs;
  return { xMin: now - monXWindowSec * 1000, xMax: now };
}

function epochToDatetimeLocal(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 현재 활성 표시 모드(Total/개별)에 맞는 차트를 다시 그리고, 열려있는 팝업들도 각자 함께 갱신한다. */
function redrawChart() {
  if (monDisplayMode === 'total') drawMonChart();
  else drawIndividualCharts();
  for (const { draw } of openPopups.values()) draw();
}

monAutoFitBtn.addEventListener('click', () => {
  monYMode = 'auto';
  redrawChart();
});
monYSetBtn.addEventListener('click', () => {
  monYMode = 'manual';
  redrawChart();
});
monXSetBtn.addEventListener('click', () => {
  monXWindowSec = Number(monXWindowInput.value) || 60;
  resetToLive();
  redrawChart();
});

const monXMinInput = document.getElementById('monXMinInput');
const monXMaxInput = document.getElementById('monXMaxInput');
document.getElementById('monXRangeSetBtn').addEventListener('click', () => {
  if (!monXMinInput.value || !monXMaxInput.value) {
    toast('시작/종료 시각을 모두 입력하세요.', 'err');
    return;
  }
  const minMs = new Date(monXMinInput.value).getTime();
  const maxMs = new Date(monXMaxInput.value).getTime();
  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs) || maxMs <= minMs) {
    toast('종료 시각이 시작 시각보다 커야 합니다.', 'err');
    return;
  }
  monXManualMin = minMs;
  monXManualMax = maxMs;
  monXMode = 'manual';
  redrawChart();
});

// 마우스 휠로 확대/축소 - 아래로 굴리면 축소(구간 넓어짐), 위로 굴리면 확대(구간 좁아짐)
function handleChartWheel(e) {
  e.preventDefault();
  monXMode = 'window';
  const factor = e.deltaY > 0 ? 1.2 : 1 / 1.2;
  monXWindowSec = Math.min(3600, Math.max(5, Math.round(monXWindowSec * factor)));
  monXWindowInput.value = monXWindowSec;
  redrawChart();
}
monChart.addEventListener('wheel', handleChartWheel, { passive: false });

// ── 좌클릭 드래그: 마우스 모드에 따라 패닝(이동) 또는 사각형 확대 ──
let dragState = null; // { mode, startPx, startOffsetMs }

function handleChartMousedown(e) {
  if (e.button !== 0 || !lastPlot) return;
  monXMode = 'window';
  const rect = monChart.getBoundingClientRect();
  const px = e.clientX - rect.left;
  dragState = { mode: monMouseMode, startPx: px, startOffsetMs: monXOffsetMs };
  if (monMouseMode === 'zoom') {
    monZoomRect.style.display = 'block';
    monZoomRect.style.left = px + 'px';
    monZoomRect.style.top = '0px';
    monZoomRect.style.width = '0px';
    monZoomRect.style.height = rect.height + 'px';
  }
}
monChart.addEventListener('mousedown', handleChartMousedown);

window.addEventListener('mousemove', (e) => {
  const rect = monChart.getBoundingClientRect();
  const px = e.clientX - rect.left;

  if (dragState && lastPlot) {
    if (dragState.mode === 'pan') {
      const msPerPx = (lastPlot.xMax - lastPlot.xMin) / lastPlot.plotW;
      const deltaPx = px - dragState.startPx;
      // 오른쪽으로 끌면(deltaPx>0) 과거로 이동(offset 증가), 왼쪽으로 끌면 최신 쪽으로 이동
      monXOffsetMs = Math.max(0, dragState.startOffsetMs - deltaPx * msPerPx);
      redrawChart();
    } else if (dragState.mode === 'zoom') {
      const left = Math.min(dragState.startPx, px);
      const width = Math.abs(px - dragState.startPx);
      monZoomRect.style.left = left + 'px';
      monZoomRect.style.width = width + 'px';
    }
    return;
  }

  const py = e.clientY - rect.top;
  if (px >= 0 && px <= rect.width && py >= 0 && py <= rect.height) {
    hoverX = px;
    redrawChart();
  } else if (hoverX !== null) {
    hoverX = null;
    redrawChart();
  }
});

window.addEventListener('mouseup', (e) => {
  if (!dragState) return;
  if (dragState.mode === 'zoom' && lastPlot) {
    const rect = monChart.getBoundingClientRect();
    const px = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const t1 = lastPlot.xMin + ((dragState.startPx - lastPlot.padding.left) / lastPlot.plotW) * (lastPlot.xMax - lastPlot.xMin);
    const t2 = lastPlot.xMin + ((px - lastPlot.padding.left) / lastPlot.plotW) * (lastPlot.xMax - lastPlot.xMin);
    const tMin = Math.min(t1, t2);
    const tMax = Math.max(t1, t2);
    const spanSec = (tMax - tMin) / 1000;
    if (spanSec >= 1) {
      const now = frozenNowAt !== null ? frozenNowAt : Date.now();
      monXWindowSec = Math.min(3600, Math.max(5, Math.round(spanSec)));
      monXWindowInput.value = monXWindowSec;
      monXOffsetMs = Math.max(0, now - tMax);
    }
    monZoomRect.style.display = 'none';
  }
  dragState = null;
  redrawChart();
});

function handleChartMouseleave() {
  if (!dragState) hoverX = null;
  redrawChart();
}
monChart.addEventListener('mouseleave', handleChartMouseleave);

function drawMonChart() {
  const canvas = monChart;
  const ctx = monCtx;
  // 레이아웃이 바뀔 수 있으니 실제 표시 크기에 맞춰 캔버스 해상도를 갱신한다.
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  if (canvas.width !== rect.width || canvas.height !== rect.height) {
    canvas.width = Math.max(1, Math.floor(rect.width));
    canvas.height = Math.max(1, Math.floor(rect.height));
  }
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const style = getComputedStyle(document.documentElement);
  const gridColor = style.getPropertyValue('--panel-border').trim() || '#ccc';
  const textColor = style.getPropertyValue('--muted').trim() || '#888';
  const panelColor = style.getPropertyValue('--panel').trim() || '#fff';

  const padding = { left: 50, right: 14, top: 14, bottom: 24 };
  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;
  if (plotW <= 0 || plotH <= 0) return;

  // 일시정지/정지 중에는 frozenNowAt(멈춘 시점)을 기준으로 그려서 시간축이 계속 흘러가지 않게 한다.
  const { xMin, xMax } = computeXRange();
  lastPlot = { padding, plotW, xMin, xMax };
  // 직접입력 필드에는 지금 실제로 그려지고 있는 구간을 반영해둔다(입력 중이면 건드리지 않음).
  if (document.activeElement !== monXMinInput) monXMinInput.value = epochToDatetimeLocal(xMin);
  if (document.activeElement !== monXMaxInput) monXMaxInput.value = epochToDatetimeLocal(xMax);

  const visibleIndexes = variables
    .map((v, idx) => idx)
    .filter((idx) => variables[idx].chart !== false && seriesBuffers[idx]);

  let yMin;
  let yMax;
  if (monYMode === 'auto') {
    let allVals = [];
    for (const idx of visibleIndexes) {
      const buf = seriesBuffers[idx] || [];
      for (const p of buf) {
        if (p.t >= xMin && p.t <= xMax && typeof p.v === 'number') allVals.push(p.v);
      }
    }
    if (allVals.length === 0) {
      yMin = 0;
      yMax = 100;
    } else {
      yMin = Math.min(...allVals);
      yMax = Math.max(...allVals);
      if (yMin === yMax) { yMin -= 1; yMax += 1; }
      const margin = (yMax - yMin) * 0.15;
      yMin -= margin;
      yMax += margin;
    }
    monYMinInput.value = Math.round(yMin);
    monYMaxInput.value = Math.round(yMax);
  } else {
    yMin = Number(monYMinInput.value) || 0;
    yMax = Number(monYMaxInput.value) || 100;
    if (yMax <= yMin) yMax = yMin + 1;
  }

  const xPix = (t) => padding.left + ((t - xMin) / (xMax - xMin)) * plotW;
  const yPix = (v) => padding.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const pixToX = (px) => xMin + ((px - padding.left) / plotW) * (xMax - xMin);

  // 그리드/Y축 라벨
  ctx.strokeStyle = gridColor;
  ctx.fillStyle = textColor;
  ctx.font = '10px sans-serif';
  ctx.lineWidth = 1;
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const v = yMin + ((yMax - yMin) * i) / yTicks;
    const y = yPix(v);
    if (monShowGrid) {
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
    }
    ctx.fillText(v.toFixed(1), 2, y + 3);
  }
  // X축 시간 라벨 (양 끝 + 중간)
  const xTicks = 4;
  for (let i = 0; i <= xTicks; i++) {
    const t = xMin + ((xMax - xMin) * i) / xTicks;
    const x = xPix(t);
    if (monShowGrid) {
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, h - padding.bottom);
      ctx.stroke();
    }
    const d = new Date(t);
    const label = `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    ctx.fillText(label, x - 12, h - 6);
  }

  // 계열별 라인
  for (const idx of visibleIndexes) {
    const buf = (seriesBuffers[idx] || []).filter((p) => p.t >= xMin && p.t <= xMax && typeof p.v === 'number');
    if (buf.length === 0) continue;
    ctx.strokeStyle = seriesColor(idx);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    buf.forEach((p, i) => {
      const x = xPix(p.t);
      const y = yPix(p.v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // 범례 (좌측 상단)
  let legendY = padding.top + 4;
  ctx.font = '11px sans-serif';
  for (const idx of visibleIndexes) {
    const v = variables[idx];
    ctx.fillStyle = seriesColor(idx);
    ctx.fillRect(padding.left + 4, legendY, 10, 3);
    ctx.fillStyle = textColor;
    ctx.fillText(labelWithDescription(v), padding.left + 18, legendY + 5);
    legendY += 14;
  }

  // 마우스 호버 시 크로스헤어 + 값 툴팁
  if (hoverX !== null && hoverX >= padding.left && hoverX <= w - padding.right && visibleIndexes.length > 0) {
    const hoverT = pixToX(hoverX);

    ctx.strokeStyle = textColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(hoverX, padding.top);
    ctx.lineTo(hoverX, h - padding.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    const rows = [];
    for (const idx of visibleIndexes) {
      const buf = seriesBuffers[idx] || [];
      if (buf.length === 0) continue;
      // hoverT에 가장 가까운 점을 찾는다 (정렬된 시계열이므로 선형 탐색으로 충분)
      let nearest = buf[0];
      let bestDiff = Math.abs(buf[0].t - hoverT);
      for (const p of buf) {
        const diff = Math.abs(p.t - hoverT);
        if (diff < bestDiff) { bestDiff = diff; nearest = p; }
      }
      rows.push({ label: labelWithDescription(variables[idx]), value: nearest.v, color: seriesColor(idx) });
    }

    if (rows.length > 0) {
      const d = new Date(hoverT);
      const timeLabel = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      ctx.font = 'bold 11px sans-serif';
      const lineHeight = 15;
      const boxW = 220;
      const boxH = lineHeight * (rows.length + 1) + 8;
      let boxX = hoverX + 10;
      if (boxX + boxW > w) boxX = hoverX - boxW - 10;
      let boxY = padding.top + 4;

      ctx.fillStyle = panelColor;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.fillStyle = textColor;
      ctx.fillText(timeLabel, boxX + 8, boxY + lineHeight);
      ctx.font = '11px sans-serif';
      rows.forEach((r, i) => {
        const y = boxY + lineHeight * (i + 2);
        ctx.fillStyle = r.color;
        ctx.fillRect(boxX + 8, y - 8, 8, 8);
        ctx.fillStyle = textColor;
        const valText = typeof r.value === 'number' ? r.value.toFixed(2) : String(r.value);
        ctx.fillText(`${r.label}: ${valText}`, boxX + 20, y);
      });
    }
  }
}

setInterval(redrawChart, 500);
window.addEventListener('resize', redrawChart);

// ── 트렌드/변수 목록 패널 폭 조절 (드래그 스플리터) ──
(function initSplitter() {
  const splitter = document.getElementById('monSplitter');
  const sidebar = document.querySelector('main .sidebar-panel');
  const STORAGE_KEY = 'plcMonSplitterWidth';

  // 페이지를 옮겼다 돌아와도(새로고침 포함) 마지막으로 조절한 폭을 그대로 유지한다.
  const savedWidth = Number(localStorage.getItem(STORAGE_KEY));
  if (Number.isFinite(savedWidth) && savedWidth > 0) {
    sidebar.style.flexBasis = savedWidth + 'px';
  }

  let dragging = false;
  let startX = 0;
  let startWidth = 0;
  splitter.addEventListener('mousedown', (e) => {
    dragging = true;
    splitter.classList.add('dragging');
    startX = e.clientX;
    startWidth = sidebar.getBoundingClientRect().width;
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const delta = startX - e.clientX; // 왼쪽으로 끌면(delta>0) 사이드바(변수 목록)가 넓어짐
    const maxWidth = window.innerWidth * 0.7;
    const newWidth = Math.min(Math.max(startWidth + delta, 280), maxWidth);
    sidebar.style.flexBasis = newWidth + 'px';
    localStorage.setItem(STORAGE_KEY, String(newWidth));
    redrawChart();
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    splitter.classList.remove('dragging');
    document.body.style.userSelect = '';
  });
})();

// ── 트렌드 차트 우클릭 메뉴 (PyQtGraph의 우클릭 메뉴 구조: 전체보기/X축/Y축/마우스모드/옵션/내보내기) ──
// makeItem/makeSep/closeCtxMenu는 Total 차트와 각 팝업이 공통으로 쓰는 헬퍼라 모듈 최상위에 둔다.
let currentCtxMenu = null;
function closeCtxMenu() {
  if (currentCtxMenu) {
    currentCtxMenu.remove();
    currentCtxMenu = null;
  }
}
function setCtxMenu(el) {
  currentCtxMenu = el;
}
function makeItem(label, opts = {}) {
  const div = document.createElement('div');
  div.className = 'ctx-item' + (opts.hasSub ? ' has-sub' : '');
  if (opts.checkable) {
    const chk = document.createElement('span');
    chk.className = 'chk';
    chk.textContent = opts.checked ? '✓' : '';
    div.appendChild(chk);
  }
  const labelSpan = document.createElement('span');
  labelSpan.textContent = label;
  div.appendChild(labelSpan);
  if (opts.hasSub) {
    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '▸';
    div.appendChild(arrow);
    const sub = document.createElement('div');
    sub.className = 'ctx-submenu';
    opts.subItems.forEach((el) => sub.appendChild(el));
    div.appendChild(sub);
  }
  if (opts.onClick) {
    div.addEventListener('click', (e) => {
      e.stopPropagation();
      opts.onClick();
      closeCtxMenu();
    });
  }
  return div;
}
function makeSep() {
  const div = document.createElement('div');
  div.className = 'ctx-sep';
  return div;
}

(function initChartContextMenu() {
  function viewAll() {
    const visibleIndexes = variables
      .map((v, idx) => idx)
      .filter((idx) => variables[idx].chart !== false && seriesBuffers[idx] && seriesBuffers[idx].length > 0);
    let minT = Infinity;
    let maxT = -Infinity;
    for (const idx of visibleIndexes) {
      for (const p of seriesBuffers[idx]) {
        if (p.t < minT) minT = p.t;
        if (p.t > maxT) maxT = p.t;
      }
    }
    monYMode = 'auto';
    // 오프라인으로 불러온 과거 기록처럼 "지금"과 무관한 데이터도 정확히 전체 범위를 보여주도록,
    // 실시간 추적(resetToLive)이 아니라 실제 데이터의 최소~최대 시각을 직접입력 범위로 고정한다.
    if (Number.isFinite(minT) && Number.isFinite(maxT) && maxT > minT) {
      monXManualMin = minT;
      monXManualMax = maxT;
      monXMode = 'manual';
    } else {
      monXWindowSec = 60;
      resetToLive();
    }
    redrawChart();
  }

  function requireTotalMode() {
    if (monDisplayMode !== 'total') {
      toast('내보내기는 Total 트렌드 모드에서만 가능합니다.', 'err');
      return false;
    }
    return true;
  }
  function exportChartPngTotal() {
    if (!requireTotalMode()) return;
    exportChartPngPicker(monChart, 'DATA_Trend_Chart_Total');
  }
  function exportChartCsvTotal() {
    if (!requireTotalMode()) return;
    exportChartCsvPicker(buildHistoryExportPayload(), 'DATA_Trend_Chart_Total');
  }
  function exportChartPdfTotal() {
    if (!requireTotalMode()) return;
    exportChartPdfPicker(monChart, 'DATA_Trend_Chart_Total', 'Total 트렌드');
  }

  function handleChartContextMenu(e) {
    e.preventDefault();
    closeCtxMenu();

    const xAxisSub = [
      makeItem('자동 (실시간 추적)', { onClick: () => { resetToLive(); redrawChart(); } }),
      makeItem('직접 설정... (구간)', {
        onClick: () => {
          const v = window.prompt('X축 표시 구간(초)을 입력하세요.', String(monXWindowSec));
          const sec = Number(v);
          if (Number.isFinite(sec) && sec > 0) {
            monXMode = 'window';
            monXWindowSec = Math.min(3600, Math.max(5, Math.round(sec)));
            monXWindowInput.value = monXWindowSec;
            redrawChart();
          }
        },
      }),
    ];
    const yAxisSub = [
      makeItem('자동 범위', { onClick: () => { monYMode = 'auto'; redrawChart(); } }),
      makeItem('직접 설정...', {
        onClick: () => {
          const vMin = window.prompt('Y축 최소값을 입력하세요.', monYMinInput.value);
          const vMax = window.prompt('Y축 최대값을 입력하세요.', monYMaxInput.value);
          if (vMin !== null && vMax !== null && Number(vMax) > Number(vMin)) {
            monYMinInput.value = Number(vMin);
            monYMaxInput.value = Number(vMax);
            monYMode = 'manual';
            redrawChart();
          }
        },
      }),
    ];
    const mouseModeSub = [
      makeItem('팬 (드래그로 이동)', {
        checkable: true, checked: monMouseMode === 'pan',
        onClick: () => { monMouseMode = 'pan'; },
      }),
      makeItem('확대 (드래그로 영역 선택)', {
        checkable: true, checked: monMouseMode === 'zoom',
        onClick: () => { monMouseMode = 'zoom'; },
      }),
    ];
    const plotOptionsSub = [
      makeItem('격자 표시', {
        checkable: true, checked: monShowGrid,
        onClick: () => { monShowGrid = !monShowGrid; drawMonChart(); },
      }),
    ];

    const menuEl = document.createElement('div');
    menuEl.className = 'ctx-menu';
    menuEl.appendChild(makeItem('전체 보기', { onClick: viewAll }));
    menuEl.appendChild(makeItem('X축', { hasSub: true, subItems: xAxisSub }));
    menuEl.appendChild(makeItem('Y축', { hasSub: true, subItems: yAxisSub }));
    menuEl.appendChild(makeItem('마우스 모드', { hasSub: true, subItems: mouseModeSub }));
    menuEl.appendChild(makeSep());
    menuEl.appendChild(makeItem('플롯 옵션', { hasSub: true, subItems: plotOptionsSub }));
    const exportSubTotal = [
      makeItem('PNG...', { onClick: exportChartPngTotal }),
      makeItem('CSV...', { onClick: exportChartCsvTotal }),
      makeItem('PDF...', { onClick: exportChartPdfTotal }),
    ];
    menuEl.appendChild(makeItem('내보내기', { hasSub: true, subItems: exportSubTotal }));
    document.body.appendChild(menuEl);
    setCtxMenu(menuEl);

    // 화면 밖으로 나가지 않도록 위치 보정
    const menuRect = menuEl.getBoundingClientRect();
    let x = e.clientX;
    let y = e.clientY;
    if (x + menuRect.width > window.innerWidth) x = window.innerWidth - menuRect.width - 8;
    if (y + menuRect.height > window.innerHeight) y = window.innerHeight - menuRect.height - 8;
    menuEl.style.left = x + 'px';
    menuEl.style.top = y + 'px';
  }
  monChart.addEventListener('contextmenu', handleChartContextMenu);

  document.addEventListener('click', closeCtxMenu);
  // 주의: 'scroll' 캡처 리스너로 메뉴를 닫으면, 트렌드 실행 중 통신 이력 패널이 새 로그가
  // 올 때마다 자동 스크롤(logList.scrollTop 갱신)하면서 발생시키는 scroll 이벤트까지 잡혀
  // 메뉴를 열자마자(정확히는 다음 통신 사이클마다) 닫혀버리는 문제가 있어 제거했다.
  window.addEventListener('resize', closeCtxMenu);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCtxMenu();
  });
})();

// ── 통신 이력 패널 (변수 관리 그리드 페이지와 동일 디자인/동작) ──
const logList = document.getElementById('logList');
const clearLogBtn = document.getElementById('clearLogBtn');
const filterErrorBtn = document.getElementById('filterErrorBtn');

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

filterErrorBtn.addEventListener('click', () => {
  errorOnlyFilter = !errorOnlyFilter;
  filterErrorBtn.classList.toggle('active', errorOnlyFilter);
  filterErrorBtn.textContent = errorOnlyFilter ? '🔴 전체 보기' : '🔴 에러만 보기';
  renderAllLogs();
});

clearLogBtn.addEventListener('click', async () => {
  allLogs = [];
  logList.innerHTML = '';
  await fetch('/api/trend/logs/clear', { method: 'POST' });
});

// ── WebSocket ──
let ws;
function connectWs() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.onmessage = (evt) => {
    let msg;
    try {
      msg = JSON.parse(evt.data);
    } catch (e) {
      return;
    }
    if (msg.type === 'trendConnStatus') {
      setConnStatus(msg.payload);
    } else if (msg.type === 'trendConnCounters') {
      setCounters(msg.payload);
    } else if (msg.type === 'trendConnLog') {
      appendLog(msg.payload);
    } else if (msg.type === 'trendConnLogHistory') {
      msg.payload.forEach(appendLog);
    } else if (msg.type === 'trendValuesHistory') {
      restoreValueHistory(msg.payload);
    } else if (msg.type === 'trendConnLogsCleared') {
      allLogs = [];
      logList.innerHTML = '';
    } else if (msg.type === 'trendStatus') {
      applyStatusTransition(msg.payload.status, msg.payload.intervalMs);
    } else if (msg.type === 'trendValues') {
      applyIncomingValues(msg.payload.t, msg.payload.values);
    }
  };
  ws.onclose = () => setTimeout(connectWs, 1000);
}
connectWs();

fetchConnStatus();
setInterval(fetchConnStatus, 5000); // 혹시 브로드캐스트를 놓쳐도 5초마다 보정
fetch('/api/trend/status')
  .then((r) => r.json())
  .then((d) => {
    if (d.ok) {
      setMonStatusUI(d.status);
      monStatus = d.status;
      if (d.intervalMs) monIntervalInput.value = d.intervalMs;
    }
  })
  .catch(() => {});
