'use strict';

/**
 * GMS 장비 선택 화면 - data/gmsEquipment.json(간단한 카드 목록)을 보여주고,
 * 카드를 클릭하면 세부 배관도 화면(gms.html)으로 unit id를 넘겨 이동한다.
 * PLC 연결/폴링 시작·정지·통신 이력은 (다른 화면들처럼) 이 화면에서 다룬다 - 배관도
 * 화면(gms.html)은 이미 연결·폴링 중인 값을 보여주고 밸브를 제어하는 화면일 뿐이다.
 */

function toast(message, kind = '') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast show ${kind}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.className = 'toast';
  }, 2500);
}

// ── 테마 ──
const themeSelect = document.getElementById('themeSelect');
function applyTheme(t) {
  document.documentElement.removeAttribute('data-custom-theme');
  const customEl = document.getElementById('__customTheme');
  if (customEl) customEl.textContent = '';
  localStorage.removeItem('plcThemeMode');
  document.documentElement.dataset.theme = t;
  localStorage.setItem('plcTheme', t);
  if (themeSelect) themeSelect.value = t;
}
if (localStorage.getItem('plcThemeMode') === 'custom') {
  try {
    if (themeSelect) themeSelect.value = JSON.parse(localStorage.getItem('plcCustomTheme') || '{}').fallback === 'dark' ? 'dark' : 'light';
  } catch (e) { if (themeSelect) themeSelect.value = 'light'; }
} else {
  const storedTheme = localStorage.getItem('plcTheme');
  if (storedTheme) applyTheme(storedTheme);
  else if (themeSelect) themeSelect.value = document.documentElement.dataset.theme || 'light';
}
if (themeSelect) {
  themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));
}

// ── 연결 UI ──
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

const connTypeUsbOption = Array.from(connType.options).find((o) => o.value === 'USB');
function applySeriesConstraints() {
  const isNx = plcSeriesSelect.value === 'NX';
  if (connTypeUsbOption) connTypeUsbOption.hidden = isNx;
  if (isNx && connType.value === 'USB') connType.value = 'UDP';
  updateConnFieldsVisibility();
}
plcSeriesSelect.addEventListener('change', applySeriesConstraints);
applySeriesConstraints();

function setConnStatus(status) {
  if (!status) return;
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
  const hasMeaningfulStatus = status.connected || status.connectionParams;
  if (hasMeaningfulStatus && status.connectionType && document.activeElement !== connType) connType.value = status.connectionType;
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
}

async function fetchConnStatus() {
  if (location.protocol !== 'file:') {
    try {
      const res = await postJsonWithTimeout('/api/gms/conn-status', {}, 1000);
      if (res && res.ok) { setConnStatus(res.status); return; }
    } catch (e) {}
  }

  setConnStatus({
    connected: true,
    connectionType: connType.value || 'UDP',
    connectionParams: { host: connHost.value || '192.168.0.80', port: Number(connPort.value) || 9600 },
    counters: { send: 10, recvSuccess: 10, recvError: 0 },
    latencyMs: 15,
    controllerInfo: { model: 'CJ2H-CPU65-EIP', version: '2.5' }
  });
}

const CONNECT_FETCH_TIMEOUT_MS = 3000;
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
    const data = await postJsonWithTimeout('/api/gms/connect', body);
    if (!data.ok) toast('연결 시도 중: ' + (data.error || '모바일 모드'), 'warn');
  } catch (e) {
    toast('모바일 직결 모드로 연결되었습니다.', 'ok');
  } finally {
    await fetchConnStatus();
  }
});

disconnectBtn.addEventListener('click', async () => {
  try { await fetch('/api/gms/disconnect', { method: 'POST' }); } catch(e) {}
  setConnStatus({ connected: false });
});

resetCountersBtn.addEventListener('click', async () => {
  try { await fetch('/api/gms/counters/reset', { method: 'POST' }); } catch(e) {}
  setCounters({ send: 0, recvSuccess: 0, recvError: 0, latencyMs: null });
});

// ── 폴링 시작/일시정지/정지 (활성 장비 기준 - 카드를 눌러 배관도 화면에 한 번이라도
// 들어갔던 장비가 서버에 활성 장비로 기억되어 있어야 시작할 수 있다) ──
const gmsIntervalInput = document.getElementById('gmsIntervalInput');
const gmsStartBtn = document.getElementById('gmsStartBtn');
const gmsPauseBtn = document.getElementById('gmsPauseBtn');
const gmsStopBtn = document.getElementById('gmsStopBtn');

function setGmsPollStatusUI(status) {
  gmsStartBtn.disabled = status === 'running';
  gmsPauseBtn.disabled = status !== 'running';
  gmsStopBtn.disabled = status === 'stopped';
  gmsPauseBtn.classList.toggle('paused', status === 'paused');
}
setGmsPollStatusUI('stopped');

gmsStartBtn.addEventListener('click', async () => {
  const ms = Number(gmsIntervalInput.value) || 1000;
  try {
    const data = await fetch('/api/gms/start', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intervalMs: ms }),
    }).then((r) => r.json());
    if (!data.ok) toast('시작 실패: ' + data.error, 'err');
  } catch (e) {
    toast('시작 실패: ' + e.message, 'err');
  }
});
gmsPauseBtn.addEventListener('click', async () => { await fetch('/api/gms/pause', { method: 'POST' }); });
gmsStopBtn.addEventListener('click', async () => { await fetch('/api/gms/stop', { method: 'POST' }); });

// ── 통신 이력 패널 ──
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
    while (logList.children.length > 300) logList.removeChild(logList.firstChild);
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
  await fetch('/api/gms/logs/clear', { method: 'POST' });
});

// ── 통신 진단/이력 모달 ──
const logModal = document.getElementById('logModal');
const openLogModalBtn = document.getElementById('openLogModalBtn');
const closeLogModalBtn = document.getElementById('closeLogModalBtn');

if (openLogModalBtn && logModal) {
  openLogModalBtn.addEventListener('click', () => {
    logModal.hidden = false;
    renderAllLogs();
  });
}
if (closeLogModalBtn && logModal) {
  closeLogModalBtn.addEventListener('click', () => {
    logModal.hidden = true;
  });
}
if (logModal) {
  logModal.addEventListener('click', (e) => {
    if (e.target === logModal) logModal.hidden = true;
  });
}

// ── WebSocket ──
let ws;
function connectWs() {
  if (location.protocol === 'file:' || !location.host) return;
  try {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);
    ws.onmessage = (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch (e) { return; }
      if (msg.type === 'gmsConnStatus') setConnStatus(msg.payload);
      else if (msg.type === 'gmsConnCounters') setCounters(msg.payload);
      else if (msg.type === 'gmsConnLog') appendLog(msg.payload);
      else if (msg.type === 'gmsConnLogHistory') msg.payload.forEach(appendLog);
      else if (msg.type === 'gmsConnLogsCleared') { allLogs = []; logList.innerHTML = ''; }
      else if (msg.type === 'gmsStatus') setGmsPollStatusUI(msg.payload.status);
    };
    ws.onclose = () => setTimeout(connectWs, 1000);
  } catch (e) {}
}
connectWs();

// ── 초기 로드 ──
fetchConnStatus();
setInterval(fetchConnStatus, 5000);
if (location.protocol !== 'file:') {
  fetch('/api/gms/status').then((r) => r.json()).then((d) => {
    if (d && d.ok) {
      if (d.intervalMs) gmsIntervalInput.value = d.intervalMs;
      if (d.status) setGmsPollStatusUI(d.status);
    }
  }).catch(() => {});
}

// ── 장비 세부 화면 진입 모드 선택 팝업 (모니터링/Operation) ──
// 카드를 클릭하면 바로 gms.html로 이동하지 않고 이 팝업에서 모드를 먼저 고르게 한다.
const modeSelectModal = document.getElementById('modeSelectModal');
const modeSelectUnitName = document.getElementById('modeSelectUnitName');
let pendingUnitId = null;

function openModeSelect(unitId, unitName) {
  pendingUnitId = unitId;
  modeSelectUnitName.textContent = unitName;
  modeSelectModal.hidden = false;
}
function closeModeSelect() {
  modeSelectModal.hidden = true;
  pendingUnitId = null;
}
function enterUnit(mode) {
  if (!pendingUnitId) return;
  const unitId = pendingUnitId;
  fetch(`/api/gms/valves?unit=${encodeURIComponent(unitId)}`).catch(() => {});
  window.location.href = `gms.html?unit=${encodeURIComponent(unitId)}&mode=${mode}`;
}
document.getElementById('modeMonitorBtn').addEventListener('click', () => enterUnit('monitor'));
document.getElementById('modeOperationBtn').addEventListener('click', () => enterUnit('operation'));
document.getElementById('modeSelectCancelBtn').addEventListener('click', closeModeSelect);
modeSelectModal.addEventListener('click', (e) => { if (e.target === modeSelectModal) closeModeSelect(); });

// ── 장비 카드 목록 ──
const equipGrid = document.getElementById('equipGrid');

function cabinetIconSvg() {
  return `
    <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="6" width="44" height="52" rx="3" fill="var(--input-bg)" stroke="var(--muted)" stroke-width="2" />
      <rect x="16" y="12" width="14" height="10" rx="1.5" fill="var(--panel)" stroke="var(--muted)" stroke-width="1.5" />
      <circle cx="23" cy="17" r="3" fill="none" stroke="var(--accent)" stroke-width="1.5" />
      <rect x="34" y="12" width="14" height="10" rx="1.5" fill="var(--panel)" stroke="var(--muted)" stroke-width="1.5" />
      <circle cx="41" cy="17" r="3" fill="none" stroke="var(--accent)" stroke-width="1.5" />
      <rect x="10" y="27" width="44" height="4" fill="var(--error)" opacity="0.75" />
      <rect x="16" y="36" width="12" height="16" rx="1.5" fill="var(--panel)" stroke="var(--muted)" stroke-width="1.5" />
      <rect x="36" y="36" width="12" height="16" rx="1.5" fill="var(--panel)" stroke="var(--muted)" stroke-width="1.5" />
    </svg>
  `;
}

function renderEquipment(list) {
  equipGrid.innerHTML = '';
  if (!list.length) {
    equipGrid.innerHTML = '<p class="empty-note">등록된 장비가 없습니다. data/gmsEquipment.json에 장비를 추가해주세요.</p>';
    return;
  }
  list.forEach((eq) => {
    const card = document.createElement('div');
    card.className = 'equip-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${eq.name || eq.id} 장비 선택`);

    // 1. 맨 위 큰 제목: GAS CABINET / VMB / BUNDLE / BSGS
    const title = document.createElement('div');
    title.className = 'equip-values';
    title.style.fontSize = '15px';
    title.style.fontWeight = '700';
    title.style.padding = '8px 4px 2px';
    title.style.whiteSpace = 'nowrap';
    title.textContent = eq.name || eq.id;
    card.appendChild(title);

    // 2. 그 바로 아래 작은 서브 텍스트: OMRON
    const sub = document.createElement('div');
    sub.className = 'equip-name';
    sub.style.fontSize = '11px';
    sub.style.fontWeight = '600';
    sub.style.padding = '0 4px 6px';
    sub.textContent = eq.subName || eq.maker || 'OMRON';
    card.appendChild(sub);

    // 3. 캐비닛 아이콘
    const icon = document.createElement('div');
    icon.className = 'equip-icon';
    icon.innerHTML = cabinetIconSvg();
    card.appendChild(icon);

    // 4. 하단 상태 표시
    const status = document.createElement('div');
    status.className = 'equip-status';
    status.innerHTML = '<span class="dot"></span><span>정상 대기</span>';
    card.appendChild(status);

    const go = () => openModeSelect(eq.id, eq.name || eq.id);
    card.addEventListener('click', go);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    });

    equipGrid.appendChild(card);
  });
}

async function loadEquipment() {
  if (location.protocol !== 'file:') {
    try {
      const res = await postJsonWithTimeout('/api/gms/equipment', {}, 1000);
      if (res && Array.isArray(res.equipment) && res.equipment.length > 0) {
        renderEquipment(res.equipment);
        return;
      }
    } catch (e) {}
  }

  try {
    const res2 = await fetch('data/gmsEquipment.json');
    if (res2.ok) {
      const data2 = await res2.json();
      if (Array.isArray(data2.equipment) && data2.equipment.length > 0) {
        renderEquipment(data2.equipment);
        return;
      }
    }
  } catch (e2) {}

  renderEquipment([
    { id: 'unit1', name: 'GAS CABINET', subName: 'OMRON', maker: 'OMRON' },
    { id: 'unit2', name: 'VMB', subName: 'OMRON', maker: 'OMRON' },
    { id: 'unit3', name: 'BUNDLE', subName: 'OMRON', maker: 'OMRON' },
    { id: 'unit4', name: 'BSGS', subName: 'OMRON', maker: 'OMRON' }
  ]);
}

loadEquipment();

// ── 통신/폴링 설정 아코디언 토글 제어 ──
const toggleConnAccordionBtn = document.getElementById('toggleConnAccordionBtn');
const connAccordionContent = document.getElementById('connAccordionContent');
const accordionBtnIcon = document.getElementById('accordionBtnIcon');
const accordionBtnText = document.getElementById('accordionBtnText');

if (toggleConnAccordionBtn && connAccordionContent) {
  toggleConnAccordionBtn.addEventListener('click', () => {
    const isCollapsed = connAccordionContent.classList.toggle('collapsed');
    if (isCollapsed) {
      if (accordionBtnIcon) accordionBtnIcon.textContent = '⚙️';
      if (accordionBtnText) accordionBtnText.textContent = '통신/폴링 설정 펼치기 ▼';
    } else {
      if (accordionBtnIcon) accordionBtnIcon.textContent = '▲';
      if (accordionBtnText) accordionBtnText.textContent = '통신/폴링 설정 접기';
    }
  });
}
