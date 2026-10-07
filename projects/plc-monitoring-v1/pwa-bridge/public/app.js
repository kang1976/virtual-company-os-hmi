'use strict';
// Design Ref: docs/02-design/design.md §6 — PLC 실시간 데이터는 절대 캐시하지 않고 항상 서버에서 조회
// 화면 구성: docs/01-plan/mobile-screen-plan.md — S1(홈=네비게이션 셸+연결상태) / S2(모니터링=태그)

// 앱(JS) 버전. service-worker.js 의 CACHE_NAME 과 함께 올린다.
const APP_VERSION = 'v28';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => showAppVersion());
}

const state = {
  user: null, offset: 0, limit: 50, search: '', total: 0, monLoaded: false, tab: 'home',
  config: { plcHost: '', plcPort: 0, pollIntervalMs: 3000 },
  deviceInfo: null,
};
const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || res.statusText), { status: res.status, body });
  return body;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** 앱바·로그인·설정에 "현재 브라우저가 실제로 실행 중인 버전"을 표시.
 *  JS 버전과 서비스워커 캐시 버전을 함께 보여줘 캐시가 낡았는지 즉시 확인 가능. */
async function showAppVersion() {
  let sw = '?';
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      const k = keys.find((n) => n.indexOf('plc-control-static-') === 0);
      if (k) sw = k.replace('plc-control-static-', '');
    }
  } catch { /* private mode 등 */ }
  const mismatch = sw !== '?' && sw !== APP_VERSION;
  const av = $('app-ver'); if (av) { av.textContent = mismatch ? `JS ${APP_VERSION}≠SW ${sw}` : APP_VERSION; av.classList.toggle('stale', mismatch); }
  const full = `JS ${APP_VERSION} · SW ${sw}`;
  const lv = $('login-ver'); if (lv) lv.textContent = full;
  const af = $('app-ver-full'); if (af) af.textContent = full;
}
showAppVersion();

/* ────────── 설정 및 테마 관리 ────────── */
function applyTheme(theme) {
  const valid = ['cyber', 'dark', 'light'].includes(theme) ? theme : 'cyber';
  document.documentElement.setAttribute('data-theme', valid);
  localStorage.setItem('pwa_theme', valid);
  document.querySelectorAll('#seg-theme button').forEach((b) => {
    b.classList.toggle('active', b.dataset.theme === valid);
  });
}

function applyFontSize(size) {
  const s = ['15', '16', '18'].includes(String(size)) ? String(size) : '16';
  document.documentElement.style.fontSize = s + 'px';
  localStorage.setItem('pwa_fs', s);
  document.querySelectorAll('#seg-fs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.fs === s);
  });
}

// 앱 시작 시 테마/글자크기 즉시 적용 (로그인 화면 포함)
applyTheme(localStorage.getItem('pwa_theme') || 'cyber');
applyFontSize(localStorage.getItem('pwa_fs') || '16');

let wakeLockObj = null;
async function setWakeLock(enabled) {
  if (enabled && 'wakeLock' in navigator) {
    try {
      wakeLockObj = await navigator.wakeLock.request('screen');
    } catch { wakeLockObj = null; }
  } else if (wakeLockObj) {
    try { await wakeLockObj.release(); } catch {}
    wakeLockObj = null;
  }
}

function initSettings() {
  const theme = localStorage.getItem('pwa_theme') || 'cyber';
  applyTheme(theme);
  const fs = localStorage.getItem('pwa_fs') || '16';
  applyFontSize(fs);

  const sh = $('settings-host');
  if (sh) sh.textContent = location.host;

  // 이벤트 리스너 중복 방지 플래그
  if (initSettings.bound) return;
  initSettings.bound = true;

  const segTheme = $('seg-theme');
  if (segTheme) {
    segTheme.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-theme]');
      if (btn) applyTheme(btn.dataset.theme);
    });
  }

  const segFs = $('seg-fs');
  if (segFs) {
    segFs.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-fs]');
      if (btn) applyFontSize(btn.dataset.fs);
    });
  }

  const chkWake = $('chk-wakelock');
  if (chkWake) {
    chkWake.addEventListener('change', (e) => {
      setWakeLock(e.target.checked);
    });
  }
}

/* ────────── 세션 / 화면 전환 ────────── */

async function checkSession() {
  try {
    const { user } = await api('/api/me');
    showApp(user);
  } catch {
    showLogin();
  }
}

function showLogin() {
  stopMonPolling();
  stopHomePolling();
  stopTrendPolling();
  $('login-view').classList.remove('hidden');
  $('app-view').classList.add('hidden');
}

function showApp(user) {
  state.user = user;
  state.monLoaded = false;
  $('login-view').classList.add('hidden');
  $('app-view').classList.remove('hidden');
  $('user-name').textContent = user.name;
  $('user-role').textContent = user.role;
  initSettings();
  loadConfig().finally(() => switchTab('home'));
}

async function loadConfig() {
  try {
    state.config = await api('/api/config');
    $('home-poll').textContent = state.config.pollIntervalMs + 'ms';
  } catch { /* 기본값 유지 */ }
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('login-error').textContent = '';
  try {
    const { user } = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ loginId: $('loginId').value, password: $('password').value }),
    });
    showApp(user);
  } catch (err) {
    $('login-error').textContent = err.message;
  }
});

$('logout-btn').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  showLogin();
});

/* ────────── 탭 바 ────────── */

const TABS = ['home', 'mon', 'trend', 'gms', 'settings'];

function switchTab(name) {
  if (!TABS.includes(name)) return;
  state.tab = name;
  TABS.forEach((t) => $('tab-' + t).classList.toggle('hidden', t !== name));
  document.querySelectorAll('.tabbtn').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  window.scrollTo(0, 0);

  if (name === 'home') {
    loadHome();
    startHomePolling();
  } else {
    stopHomePolling();
  }
  if (name === 'mon') {
    if (!state.monLoaded) { state.monLoaded = true; loadTags(); }
    startMonPolling();
  } else {
    stopMonPolling();
  }
  if (name === 'trend') {
    if (!state.trendInit) { state.trendInit = true; initTrend(); }
    enterTrend();
  } else {
    stopTrendPolling();
  }
}

/* 홈 탭이 보이는 동안 연결 상태·서버 응답 시간을 주기적으로 갱신 */
let homePollTimer = null;
function startHomePolling() {
  if (homePollTimer) return;
  homePollTimer = setInterval(loadHome, state.config.pollIntervalMs || 3000);
}
function stopHomePolling() {
  clearInterval(homePollTimer);
  homePollTimer = null;
}
function restartHomePolling() {
  stopHomePolling();
  if (state.tab === 'home') startHomePolling();
}

document.querySelectorAll('.tabbtn').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
document.querySelectorAll('.tile').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.goto)));

/* ────────── 홈 (S1) — 연결 상태 ────────── */

$('home-refresh').addEventListener('click', loadHome);

async function loadHome() {
  const isAdmin = state.user && state.user.role === 'ADMIN';
  $('home-link-btn').classList.toggle('hidden', !isAdmin);
  const started = performance.now();
  try {
    const { connected, host, port, enabled } = await api('/api/device/status');
    const ms = Math.round(performance.now() - started);
    const addr = host + ':' + port;
    let label, color, dot;
    if (enabled === false) { label = '연결 해제됨 (수동)'; color = '#9ca3af'; dot = 'offline'; }
    else if (connected) { label = '연결됨'; color = '#22c55e'; dot = 'online'; }
    else { label = '연결 시도 중…'; color = '#fbbf24'; dot = 'offline'; }
    $('home-conn-state').textContent = label;
    $('home-conn-state').style.color = color;
    $('home-host').textContent = addr;
    $('home-latency').textContent = ms + ' ms';
    $('settings-host').textContent = addr;
    $('conn-dot').className = 'conn-dot ' + dot;
    $('home-link-btn').textContent = enabled === false ? 'PLC 연결' : 'PLC 연결 해제';
    state.plcEnabled = enabled !== false;
  } catch {
    $('home-conn-state').textContent = '확인 실패';
    $('home-conn-state').style.color = '#ef4444';
    $('home-latency').textContent = '—';
    $('conn-dot').className = 'conn-dot offline';
  }
  $('home-cpu-model').textContent = (state.deviceInfo && state.deviceInfo.controller && state.deviceInfo.controller.model) || '보기';
  $('home-poll').textContent = state.config.pollIntervalMs + 'ms';
}

$('home-link-btn').addEventListener('click', () => {
  const disconnecting = state.plcEnabled !== false;
  const doIt = async () => {
    try {
      await api('/api/device/link', { method: 'POST', body: JSON.stringify({ enabled: !disconnecting }) });
      loadHome();
    } catch (err) {
      alert('오류: ' + err.message);
    }
  };
  if (disconnecting) {
    showConfirmModal(doIt, {
      title: 'PLC 연결 해제',
      detail: 'PLC와의 연결을 끊습니다. 태그 값·상태 모니터링이 중단되며, 다시 연결하기 전까지 재접속하지 않습니다.',
      warn: '',
      okText: '연결 해제',
    });
  } else {
    doIt();
  }
});

/* ────────── CPU · 펌웨어 상세 (기존 PC 'CPU 정보' 화면) ────────── */

$('open-cpu-info').addEventListener('click', openDetailView);
$('detail-back').addEventListener('click', () => {
  stopDetailTimers();
  clockSync = null;
  $('detail-view').classList.add('hidden');
});
$('detail-refresh').addEventListener('click', loadDeviceInfo);

let clockTicker = null;
let detailRefreshTimer = null;
let clockSync = null; // { base: Date, at: ms }

function stopDetailTimers() {
  clearInterval(clockTicker); clockTicker = null;
  clearInterval(detailRefreshTimer); detailRefreshTimer = null;
}

function pad2(n) { return String(n).padStart(2, '0'); }

function tickClock() {
  if (!clockSync) return;
  const t = new Date(clockSync.base.getTime() + (Date.now() - clockSync.at));
  const dow = ['일', '월', '화', '수', '목', '금', '토'][t.getDay()];
  $('d-clock').textContent =
    `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())} ` +
    `${pad2(t.getHours())}:${pad2(t.getMinutes())}:${pad2(t.getSeconds())} (${dow})`;
}

function openDetailView() {
  const isAdmin = state.user && state.user.role === 'ADMIN';
  document.querySelectorAll('#detail-view .admin-only').forEach((el) => el.classList.toggle('hidden', !isAdmin));
  document.querySelectorAll('#detail-view .non-admin-only').forEach((el) => el.classList.toggle('hidden', isAdmin));
  $('detail-view').classList.remove('hidden');
  loadDeviceInfo();
  stopDetailTimers();
  clockTicker = setInterval(tickClock, 1000);          // 시계는 매초 부드럽게
  detailRefreshTimer = setInterval(loadDeviceInfo, 20000); // 상태/에러는 20초마다 재조회
}

document.querySelectorAll('#d-mode-card .mode-btns button').forEach((b) => {
  b.addEventListener('click', () => openDangerModal({ kind: 'mode', mode: b.dataset.mode }));
});
$('d-clock-set').addEventListener('click', () => openDangerModal({ kind: 'clock' }));

/* 위험 조작 확인창 — 사유 + 비밀번호 필수 (운전 모드 변경 / 시계 설정) */
function openDangerModal(op) {
  const isProgram = op.kind === 'mode' && op.mode === 'PROGRAM';
  $('dg-title').textContent =
    op.kind === 'clock' ? 'PLC 시계를 PC 시각으로 설정' : `운전 모드를 ${op.mode} 으로 변경`;
  $('dg-warn').textContent = isProgram
    ? '⚠️ PROGRAM 모드는 PLC 프로그램을 정지시킵니다. 가스캐비닛 안전 시스템 동작이 멈춥니다. 정말 실행하려면 사유와 비밀번호를 입력하세요.'
    : '⚠️ 이 조작은 실제 PLC에 즉시 반영됩니다. 사유와 비밀번호를 입력하세요.';
  $('dg-warn').style.color = isProgram ? '#ef4444' : '';
  $('dg-reason').value = '';
  $('dg-password').value = '';
  $('dg-error').textContent = '';
  $('danger-modal').classList.remove('hidden');

  const close = () => {
    $('danger-modal').classList.add('hidden');
    $('dg-exec').onclick = null;
    $('dg-cancel').onclick = null;
  };
  $('dg-cancel').onclick = close;
  $('dg-exec').onclick = async () => {
    const reason = $('dg-reason').value.trim();
    const password = $('dg-password').value;
    if (reason.length < 5) { $('dg-error').textContent = '사유를 5자 이상 입력하세요.'; return; }
    if (!password) { $('dg-error').textContent = '비밀번호를 입력하세요.'; return; }
    try {
      const path = op.kind === 'clock' ? '/api/device/clock' : '/api/device/mode';
      const body = op.kind === 'clock' ? { reason, password } : { mode: op.mode, reason, password };
      await api(path, { method: 'POST', body: JSON.stringify(body) });
      close();
      alert('실행되었습니다.');
      loadDeviceInfo();
    } catch (err) {
      $('dg-error').textContent = err.message;
    }
  };
}

async function loadDeviceInfo() {
  const setTxt = (id, v) => { $(id).textContent = v; };
  setTxt('d-model', '조회 중…');
  try {
    const info = await api('/api/device/info');
    state.deviceInfo = info;

    const c = info.controller;
    setTxt('d-model', c ? c.model : (info.controllerError || '조회 실패'));
    setTxt('d-version', c ? c.version : '—');
    setTxt('d-transport', `${info.transport} (${info.host}:${info.port})`);

    const s = info.status;
    if (s) {
      setTxt('d-run', s.runText);
      $('d-mode').textContent = s.modeText;
      $('d-mode').className = 'risk-badge' + (s.modeText === 'RUN' ? '' : ' caution');
      setTxt('d-fatal', s.hasFatal ? s.fatalHex : '없음');
      setTxt('d-nonfatal', s.hasNonFatal ? s.nonFatalHex : '없음');
      setTxt('d-fal', s.falCode ? '0x' + s.falCode.toString(16).padStart(4, '0') + (s.falText ? ' · ' + s.falText : '') : '없음');
      setTxt('d-errmsg', s.errorMessage || '없음');
    } else {
      ['d-run', 'd-fatal', 'd-nonfatal', 'd-fal', 'd-errmsg'].forEach((id) => setTxt(id, '조회 실패'));
      $('d-mode').textContent = '—';
    }

    if (info.clock) {
      const k = info.clock;
      clockSync = { base: new Date(k.year, k.month - 1, k.day, k.hour, k.minute, k.second), at: Date.now() };
      tickClock();
    } else {
      clockSync = null;
      setTxt('d-clock', info.clockError || '조회 실패');
    }

    const mem = c && c.memory;
    $('d-memory-card').style.display = mem && mem.areas ? '' : 'none';
    if (mem && mem.areas) {
      $('d-memory').innerHTML = mem.areas
        .map((a) => `<div class="mem-row"><span>${escapeHtml(a.label)}</span><span class="mono">${a.value.toLocaleString()} ${escapeHtml(a.unit)}</span></div>`)
        .join('');
    }
  } catch (err) {
    setTxt('d-model', '조회 실패: ' + err.message);
  }
}

/* ────────── 연결 설정 (PLC 주소 / 포트 / 폴링 주기) ────────── */

$('open-config').addEventListener('click', openConfigModal);

async function openConfigModal() {
  const isAdmin = state.user && state.user.role === 'ADMIN';
  $('cfg-error').textContent = '';
  // 항상 서버에서 최신 설정을 다시 읽어 채운다(로컬 state가 오래됐을 수 있음)
  ['cfg-host', 'cfg-port', 'cfg-poll'].forEach((id) => { $(id).value = ''; $(id).disabled = true; });
  $('cfg-note').textContent = '불러오는 중…';
  $('config-modal').classList.remove('hidden');

  try {
    state.config = await api('/api/config');
  } catch {
    $('cfg-note').textContent = '설정을 불러오지 못했습니다.';
  }
  $('cfg-host').value = state.config.plcHost || '';
  $('cfg-port').value = state.config.plcPort || '';
  $('cfg-poll').value = state.config.pollIntervalMs || '';
  ['cfg-host', 'cfg-port', 'cfg-poll'].forEach((id) => ($(id).disabled = !isAdmin));
  $('cfg-note').textContent = isAdmin
    ? 'PLC 주소·포트를 바꾸면 저장 즉시 재연결합니다.'
    : '변경은 ADMIN만 가능합니다.';

  const close = () => {
    $('config-modal').classList.add('hidden');
    $('cfg-save').onclick = null;
    $('cfg-cancel').onclick = null;
  };
  $('cfg-cancel').onclick = close;
  $('cfg-save').onclick = async () => {
    if (!isAdmin) return close();
    // 값이 있는 필드만 전송(빈 필드가 서버 값을 덮어쓰지 않도록)
    const body = {};
    const host = $('cfg-host').value.trim();
    const port = $('cfg-port').value.trim();
    const poll = $('cfg-poll').value.trim();
    if (host) body.plcHost = host;
    if (port) body.plcPort = port;
    if (poll) body.pollIntervalMs = poll;
    try {
      const next = await api('/api/config', { method: 'PATCH', body: JSON.stringify(body) });
      state.config = next;
      close();
      restartMonPolling();
      restartHomePolling();
      restartTrendPolling();
      loadHome();
      if (next.reconnecting) alert('PLC 재연결 중입니다. 잠시 후 홈에서 연결 상태를 확인하세요.');
    } catch (err) {
      $('cfg-error').textContent = err.message;
    }
  };
}

/* ────────── 모니터링 (S2) — 태그 ────────── */

let searchTimer = null;
$('search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = $('search').value;
    state.offset = 0;
    loadTags();
  }, 300);
});

$('prev-page').addEventListener('click', () => {
  state.offset = Math.max(0, state.offset - state.limit);
  loadTags();
});
$('next-page').addEventListener('click', () => {
  if (state.offset + state.limit < state.total) {
    state.offset += state.limit;
    loadTags();
  }
});

async function loadTags() {
  const params = new URLSearchParams({ search: state.search, limit: state.limit, offset: state.offset });
  const { tags, total } = await api('/api/tags?' + params.toString());
  state.total = total;
  $('tag-total').textContent = total;
  $('tag-shown').textContent = tags.length;

  if (!tags.length) {
    $('tag-list').innerHTML = `<div class="tag-empty">${
      state.search ? '검색 결과가 없습니다.' : '등록된 태그가 없습니다.<br>태그 심볼↔주소 매핑표 도착 후 표시됩니다.'
    }</div>`;
    $('pager').classList.add('hidden');
    return;
  }

  const isAdmin = state.user && state.user.role === 'ADMIN';

  $('tag-list').innerHTML = tags
    .map((t) => {
      const risk = escapeHtml(t.risk_level || '');
      const writable = t.access !== 'read';
      const id = escapeHtml(t.tag_id);
      const addressed = !!(t.address && t.area_type);
      const addrLabel = addressed
        ? escapeHtml(t.area_type + ':' + t.address + (t.bit_index != null ? '.' + t.bit_index : ''))
        : '주소 미배정';
      const valueCell = addressed
        ? `<span class="tag-card-value" data-tag-id="${id}" data-addr="1">…</span>`
        : `<span class="hint">${isAdmin ? '주소 배정 →' : '주소 미배정'}</span>`;
      return `
      <div class="tag-card">
        <div class="tag-card-symbol">${escapeHtml(t.symbol)}</div>
        ${t.description ? `<div class="tag-card-desc">${escapeHtml(t.description)}</div>` : ''}
        <div class="tag-card-foot">
          <span class="risk-badge ${risk}">${risk || '—'}</span>
          <span class="tag-card-addr ${isAdmin ? 'editable' : ''}" data-tag-id="${id}" data-symbol="${escapeHtml(t.symbol)}"
                data-area="${escapeHtml(t.area_type || '')}" data-num="${escapeHtml(t.address || '')}" data-bit="${t.bit_index != null ? t.bit_index : ''}" data-dtype="${escapeHtml(t.data_type || '')}" data-desc="${escapeHtml(t.description || '')}">${addrLabel}</span>
          ${valueCell}
          ${writable ? `<button data-tag-id="${id}" data-symbol="${escapeHtml(t.symbol)}" class="write-btn">쓰기</button>` : ''}
        </div>
      </div>`;
    })
    .join('');

  document.querySelectorAll('.write-btn').forEach((btn) => {
    btn.addEventListener('click', () => openValueModal(btn.dataset.tagId, btn.dataset.symbol));
  });
  if (isAdmin) {
    document.querySelectorAll('.tag-card-addr.editable').forEach((el) => {
      el.addEventListener('click', () => openAddrModal(el.dataset));
    });
  }
  refreshValues();

  const from = state.offset + 1;
  const to = state.offset + tags.length;
  $('page-info').textContent = `${from}-${to} / ${total}`;
  $('prev-page').disabled = state.offset === 0;
  $('next-page').disabled = to >= total;
  $('pager').classList.remove('hidden');
}

/* 실시간 값 폴링 — 모니터링 탭에 있을 때만, 주소 배정된 태그만 (design.md §6: 캐시 없음) */

let monPollTimer = null;

function startMonPolling() {
  if (monPollTimer) return;
  refreshValues();
  monPollTimer = setInterval(refreshValues, state.config.pollIntervalMs || 3000);
}
function stopMonPolling() {
  clearInterval(monPollTimer);
  monPollTimer = null;
}
function restartMonPolling() {
  stopMonPolling();
  if (state.tab === 'mon') startMonPolling();
}

async function refreshValues() {
  const cells = document.querySelectorAll('.tag-card-value[data-addr="1"]');
  if (!cells.length) return;
  let ok = 0;
  for (const cell of cells) {
    try {
      const r = await api('/api/tags/' + cell.dataset.tagId + '/value');
      cell.textContent = String(r.value);
      cell.classList.remove('stale');
      // 값이 같아도 갱신됐음을 보이게 깜빡임
      cell.classList.remove('flash');
      void cell.offsetWidth;
      cell.classList.add('flash');
      ok++;
    } catch (err) {
      cell.textContent = err.status === 503 ? 'PLC 끊김' : '—';
      cell.classList.add('stale');
    }
  }
  const t = new Date();
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');
  const ss = String(t.getSeconds()).padStart(2, '0');
  const ps = $('poll-status');
  if (ps) ps.textContent = `갱신 ${hh}:${mm}:${ss} (${ok}개)`;
}

/* 태그 편집 모달 (ADMIN) — 심볼·설명 + PLC 주소 */

function openAddrModal(ds) {
  $('addr-tag').textContent = ds.tagId;
  $('addr-symbol').value = ds.symbol || '';
  $('addr-desc').value = ds.desc || '';
  $('addr-area').value = ds.area || '';
  $('addr-num').value = ds.num || '';
  const dtypeAlias = { UINT16: 'UINT', INT16: 'INT', HEX: 'WORD' };
  const dtRaw = (ds.dtype || '').toUpperCase();
  $('addr-dtype').value = dtypeAlias[dtRaw] || (dtRaw && dtRaw !== 'BOOL' ? dtRaw : 'UINT');
  $('addr-bit').value = ds.bit || '';
  $('addr-error').textContent = '';
  $('addr-modal').classList.remove('hidden');

  const close = () => {
    $('addr-modal').classList.add('hidden');
    $('addr-save').onclick = null;
    $('addr-cancel').onclick = null;
  };
  $('addr-cancel').onclick = close;
  $('addr-save').onclick = async () => {
    const sym = $('addr-symbol').value.trim();
    if (!sym) { $('addr-error').textContent = '심볼(이름)은 비울 수 없습니다.'; return; }
    try {
      if (sym !== ds.symbol || $('addr-desc').value.trim() !== (ds.desc || '')) {
        await api('/api/tags/' + ds.tagId, {
          method: 'PATCH',
          body: JSON.stringify({ symbol: sym, description: $('addr-desc').value.trim() }),
        });
      }
      await api('/api/tags/' + ds.tagId + '/address', {
        method: 'PATCH',
        body: JSON.stringify({
          areaType: $('addr-area').value,
          address: $('addr-num').value.trim(),
          dataType: $('addr-dtype').value,
          bitIndex: $('addr-bit').value.trim(),
        }),
      });
      close();
      loadTags();
    } catch (err) {
      $('addr-error').textContent = err.message;
    }
  };
}

/* 값 쓰기: 값 입력 모달 → /api/command → (409면) 2단계 확인 모달 */

function openValueModal(tagId, symbol) {
  $('write-tag').textContent = symbol;
  $('write-value').value = '';
  $('write-error').textContent = '';
  $('write-modal').classList.remove('hidden');
  setTimeout(() => $('write-value').focus(), 50);

  const close = () => {
    $('write-modal').classList.add('hidden');
    $('write-next').onclick = null;
    $('write-cancel').onclick = null;
  };
  $('write-cancel').onclick = close;
  $('write-next').onclick = async () => {
    const value = $('write-value').value.trim();
    if (value === '') { $('write-error').textContent = '값을 입력하세요.'; return; }
    try {
      const result = await api('/api/command', { method: 'POST', body: JSON.stringify({ tagId, value }) });
      close();
      if (!result.requiresConfirmation) alert('실행되었습니다.');
    } catch (err) {
      if (err.status !== 409) { $('write-error').textContent = err.message; return; }
      // 409 = 위험명령 2단계 확인 필요 (Design Ref: design.md §4)
      close();
      const { confirmToken, commandId } = err.body;
      showConfirmModal(async () => {
        try {
          await api(`/api/command/${commandId}/confirm`, { method: 'POST', body: JSON.stringify({ confirmToken }) });
          alert('실행되었습니다.');
        } catch (e2) {
          alert('실행 실패: ' + e2.message);
        }
      });
    }
  };
}

function showConfirmModal(onConfirm, opts = {}) {
  $('confirm-title').textContent = opts.title || '정말 실행하시겠습니까?';
  $('confirm-detail').textContent = opts.detail || '';
  $('confirm-warn').textContent = opts.warn != null ? opts.warn : '이 조작은 실제 설비에 즉시 반영됩니다.';
  $('confirm-warn').style.display = $('confirm-warn').textContent ? '' : 'none';
  $('confirm-ok').textContent = opts.okText || '실행';
  $('confirm-modal').classList.remove('hidden');
  const cleanup = () => {
    $('confirm-modal').classList.add('hidden');
    $('confirm-ok').onclick = null;
    $('confirm-cancel').onclick = null;
  };
  $('confirm-ok').onclick = () => { cleanup(); onConfirm(); };
  $('confirm-cancel').onclick = cleanup;
}

/* ────────── 설정 (S5) ────────── */

function lsGet(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

function initSettings() {
  const theme = lsGet('plcTheme', 'dark');
  const fs = lsGet('plcFontSize', '16');
  applyTheme(theme);
  applyFontSize(fs);

  $('seg-theme').querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => applyTheme(b.dataset.theme, true));
  });
  $('seg-fs').querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => applyFontSize(b.dataset.fs, true));
  });
  $('chk-wakelock').addEventListener('change', (e) => setWakeLock(e.target.checked));
}

function markSeg(segId, attr, value) {
  $(segId).querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset[attr] === String(value));
  });
}

function applyTheme(theme, save) {
  if (theme !== 'light' && theme !== 'dark') theme = 'dark';
  document.documentElement.dataset.theme = theme;
  markSeg('seg-theme', 'theme', theme);
  if (save) lsSet('plcTheme', theme);
}

function applyFontSize(px, save) {
  const n = parseInt(px, 10) || 16;
  document.documentElement.style.setProperty('--fs-base', n + 'px');
  markSeg('seg-fs', 'fs', n);
  if (save) lsSet('plcFontSize', String(n));
}

/* 화면 항상 켜기 — 모니터링 중 화면 꺼짐 방지. 탭이 백그라운드 갔다 오면 재획득 필요 */
let wakeLock = null;
let wakeLockWanted = false;

async function setWakeLock(on) {
  wakeLockWanted = on;
  if (!('wakeLock' in navigator)) {
    if (on) alert('이 브라우저는 화면 항상 켜기를 지원하지 않습니다.');
    $('chk-wakelock').checked = false;
    wakeLockWanted = false;
    return;
  }
  if (on) {
    try { wakeLock = await navigator.wakeLock.request('screen'); }
    catch { wakeLockWanted = false; $('chk-wakelock').checked = false; }
  } else if (wakeLock) {
    try { await wakeLock.release(); } catch {}
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (wakeLockWanted && document.visibilityState === 'visible' && !wakeLock) setWakeLock(true);
});

/* ────────── 트렌드 (S3) — 서버 기록 기반 + 터치 줌/팬 ────────── */
// 변수 = 메모리 주소 스펙. 서버가 1초마다 기록(72시간). 이 화면은 저장 샘플을 조회해 SVG로 표시.
// 상호작용: 한 손가락 드래그=좌우 이동, 두 손가락=확대/축소, "전체 보기"=실시간 복귀.

let trendData = null;
let trendDispTimer = null;
let trendResizeBound = false;
let trendLogging = true;
let trendView = { spanSec: 300, toMs: null };      // toMs null = 실시간(오른쪽 끝 = 지금)
let trendY = { mode: 'auto', lo: null, hi: null };
let trendFetchPending = false;
let trendGesturing = false;   // 드래그/핀치 진행 중 — 빈 상태 문구 억제 + 연속 재조회
let trendGeom = null;         // { W,H,padL,padR,padT,padB,t0,t1,vMin,vMax } — drawTrend가 채움
let crosshairActive = false;  // 꾹 누르기 십자선 표시 중
let crossPx = { x: 0, y: 0 }; // 십자선 위치(px)

function initTrend() {
  $('ts-area').innerHTML = $('addr-area').innerHTML;
  const blank = $('ts-area').querySelector('option[value=""]');
  if (blank) blank.remove();
  $('ts-area').value = 'D';
  $('ts-dtype').innerHTML = $('addr-dtype').innerHTML;
  $('ts-dtype').value = 'UINT';

  trendView.spanSec = Number($('trend-window').value) || 300;
  $('trend-window').addEventListener('change', () => {
    trendView = { spanSec: Number($('trend-window').value) || 300, toMs: null };
    trendDisplayTick(true);
  });
  $('trend-add').addEventListener('click', openTrendAdd);
  $('ts-cancel').addEventListener('click', () => $('trend-add-modal').classList.add('hidden'));
  $('ts-save').addEventListener('click', trendAddSave);
  $('trend-log-toggle').addEventListener('click', toggleTrendLogging);
  $('trend-export').addEventListener('click', () => {
    // 설치형(standalone) PWA에서 location.href 변경은 앱 화면을 날릴 수 있어 앵커 다운로드 사용
    const a = document.createElement('a');
    a.href = '/api/trend/export.csv';
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
  $('trend-png').addEventListener('click', exportTrendPng);
  $('trend-import-btn').addEventListener('click', () => $('trend-import-file').click());
  $('trend-import-file').addEventListener('change', trendImportFile);
  $('trend-full').addEventListener('click', () => {
    trendView = { spanSec: Number($('trend-window').value) || 300, toMs: null };
    trendDisplayTick(true);
  });
  $('trend-axis').addEventListener('click', openAxisModal);
  $('trend-axis-cancel').addEventListener('click', () => $('trend-axis-modal').classList.add('hidden'));
  $('trend-axis-ok').addEventListener('click', applyAxisModal);
  $('ty-mode').querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => {
      $('ty-mode').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      $('ty-fixed-row').classList.toggle('hidden', b.dataset.ym !== 'fixed');
    })
  );
  bindTrendGestures();

  if (!trendResizeBound) {
    trendResizeBound = true;
    let rt = null;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (state.tab === 'trend') drawTrend(); }, 150); });
  }
}

function enterTrend() {
  const isAdmin = state.user && state.user.role === 'ADMIN';
  document.querySelectorAll('#tab-trend .admin-only').forEach((el) => el.classList.toggle('hidden', !isAdmin));
  hideCrosshair();
  trendDisplayTick(true);
  stopTrendPolling();
  trendDispTimer = setInterval(() => trendDisplayTick(false), 2000);
}
function stopTrendPolling() { clearInterval(trendDispTimer); trendDispTimer = null; }
function restartTrendPolling() {}

/** 샘플만 재조회(가벼움). trendFetchPending 으로 자체 스로틀.
 *  light=true 면 범례 갱신 생략. 제스처 중에는 강제 호출만 허용(트랜스폼 팬을 방해하지 않도록). */
async function fetchTrendSamples(force, light) {
  if (trendGesturing && !force) return;
  if (trendFetchPending && !force) return;
  trendFetchPending = true;
  try {
    const to = trendView.toMs != null ? `&to=${Math.round(trendView.toMs)}` : '';
    const r = await api(`/api/trend/samples?window=${Math.round(trendView.spanSec)}&max=700${to}`);
    trendData = r;
    drawTrend();
    if (!light) renderTrendLegend();
  } catch { /* 다음 tick */ }
  finally { trendFetchPending = false; }
}

async function trendDisplayTick(force) {
  await fetchTrendSamples(force);
  try {
    const st = await api('/api/trend/status');
    trendLogging = st.logging;
    $('trend-log-toggle').textContent = st.logging ? '🔴 기록 중' : '⏸ 기록 정지';
    const hrs = st.oldestTs ? ((Date.now() - st.oldestTs) / 3600000) : 0;
    $('trend-status').textContent =
      `변수 ${st.seriesCount}/${st.maxSeries} · 저장 ${st.sampleCount.toLocaleString()}건` +
      (st.oldestTs ? ` · 최장 ${hrs.toFixed(1)}시간` : '') +
      ` · 1초 간격, 최대 ${st.retentionHours}시간 보관` +
      (trendView.toMs != null ? ' · ⏸ 과거 구간 보는 중' : '');
  } catch {}
}

function renderTrendLegend() {
  const isAdmin = state.user && state.user.role === 'ADMIN';
  const series = (trendData && trendData.series) || [];
  $('trend-legend').innerHTML = series
    .map((s) => {
      const pts = (trendData.points && trendData.points[s.series_id]) || [];
      const last = pts.length ? pts[pts.length - 1][1] : null;
      return `<div class="lg-row">
        <span class="lg-dot" style="background:${s.color}"></span>
        <span class="lg-sym">${escapeHtml(s.label)}<br><span class="mono" style="font-size:.72rem;color:var(--text-dim)">${escapeHtml(s.area_type + ':' + s.address + (s.bit_index != null ? '.' + s.bit_index : '') + ' ' + s.data_type)}</span></span>
        <span class="lg-val">${escapeHtml(fmtNum(last))}</span>
        ${isAdmin ? `<button class="lg-x" data-id="${s.series_id}">✕</button>` : ''}
      </div>`;
    })
    .join('');
  $('trend-legend').querySelectorAll('.lg-x').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('이 변수와 저장된 기록을 삭제합니다.')) return;
      await api('/api/trend/series/' + b.dataset.id, { method: 'DELETE' });
      trendDisplayTick(true);
    })
  );
}

/* 현재 도메인(시간축 범위) — 뷰 상태 기준 */
function trendDomain() {
  const now = (trendData && trendData.now) || Date.now();
  const spanMs = trendView.spanSec * 1000;
  const right = trendView.toMs != null ? trendView.toMs : now;
  return { t0: right - spanMs, t1: right, spanMs, now };
}

function drawTrend() {
  const svg = $('trend-svg');
  const wrap = $('trend-chart-wrap');
  const W = wrap.clientWidth || 320;
  const H = wrap.clientHeight || 240;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const series = (trendData && trendData.series) || [];
  const anyPts = series.some((s) => ((trendData.points || {})[s.series_id] || []).length);
  // 제스처 중에는 빈 상태 문구를 띄우지 않음(재조회가 곧 채움) — 깜빡임 방지
  $('trend-empty').style.display = (anyPts || trendGesturing) ? 'none' : 'flex';
  if (!anyPts) { svg.innerHTML = ''; trendGeom = null; hideCrosshair(); return; }

  const padL = 46, padR = 8, padT = 8, padB = 20;
  const { t0, t1 } = trendDomain();

  let vMin = Infinity, vMax = -Infinity;
  if (trendY.mode === 'fixed' && trendY.lo != null && trendY.hi != null && trendY.lo < trendY.hi) {
    vMin = trendY.lo; vMax = trendY.hi;
  } else {
    for (const s of series) {
      for (const p of (trendData.points[s.series_id] || [])) {
        if (p[1] == null || p[0] < t0 || p[0] > t1) continue;
        if (p[1] < vMin) vMin = p[1];
        if (p[1] > vMax) vMax = p[1];
      }
    }
    if (!Number.isFinite(vMin)) { svg.innerHTML = ''; trendGeom = null; hideCrosshair(); return; }
    if (vMin === vMax) { vMin -= 1; vMax += 1; }
    const gap = (vMax - vMin) * 0.08;
    vMin -= gap; vMax += gap;
  }

  const x = (t) => padL + ((t - t0) / (t1 - t0)) * (W - padL - padR);
  const y = (v) => padT + (1 - (v - vMin) / (vMax - vMin)) * (H - padT - padB);

  let g = `<rect x="0" y="0" width="${W}" height="${H}" fill="var(--surface)"/>`;
  for (let i = 0; i <= 4; i++) {
    const yy = padT + (i / 4) * (H - padT - padB);
    const vv = vMax - (i / 4) * (vMax - vMin);
    g += `<line class="trend-grid-line" x1="${padL}" y1="${yy.toFixed(1)}" x2="${W - padR}" y2="${yy.toFixed(1)}"/>`;
    g += `<text class="trend-axis-text" x="${padL - 4}" y="${(yy + 3).toFixed(1)}" text-anchor="end">${fmtNum(vv)}</text>`;
  }
  for (let i = 0; i <= 2; i++) {
    const xx = padL + (i / 2) * (W - padL - padR);
    const tt = t0 + (i / 2) * (t1 - t0);
    g += `<text class="trend-axis-text" x="${xx.toFixed(1)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}">${clockLabel(tt)}</text>`;
  }
  for (const s of series) {
    const pts = (trendData.points[s.series_id] || [])
      .filter((p) => p[1] != null)
      .map((p) => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`)
      .join(' ');
    if (pts) g += `<polyline class="trend-series" stroke="${s.color}" points="${pts}"/>`;
  }
  svg.innerHTML = g;
  // 십자선/제스처가 px↔시간·값 변환에 쓰는 현재 플롯 기하
  trendGeom = { W, H, padL, padR, padT, padB, t0, t1, vMin, vMax };
  if (crosshairActive) drawCrosshair();
}

/* px ↔ 시간/값 변환 (trendGeom 기준) */
function trendPxToTime(px) {
  const g = trendGeom; if (!g) return null;
  const f = (px - g.padL) / (g.W - g.padL - g.padR);
  return g.t0 + Math.min(1, Math.max(0, f)) * (g.t1 - g.t0);
}
function trendPxToVal(py) {
  const g = trendGeom; if (!g) return null;
  const f = (py - g.padT) / (g.H - g.padT - g.padB);
  return g.vMax - Math.min(1, Math.max(0, f)) * (g.vMax - g.vMin);
}
function valueAtTime(sid, t) {
  const arr = (trendData && trendData.points && trendData.points[sid]) || [];
  if (!arr.length) return null;
  let best = null, bd = Infinity;
  for (const p of arr) {
    if (p[1] == null) continue;
    const d = Math.abs(p[0] - t);
    if (d < bd) { bd = d; best = p; }
  }
  return best ? best[1] : null;
}

/* ── 십자선 (꾹 누르기) ── */
function showCrosshair(px, py) {
  if (!trendGeom) return;
  crosshairActive = true;
  crossPx = { x: px, y: py };
  $('trend-cross').classList.remove('hidden');
  drawCrosshair();
}
function hideCrosshair() {
  crosshairActive = false;
  const el = $('trend-cross');
  if (el) el.classList.add('hidden');
}
function clockLabelDate(ms) {
  const d = new Date(ms); const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function drawCrosshair() {
  const g = trendGeom; if (!g || !crosshairActive) return;
  const box = $('trend-cross');
  const px = Math.min(g.W - g.padR, Math.max(g.padL, crossPx.x));
  const py = Math.min(g.H - g.padB, Math.max(g.padT, crossPx.y));
  box.querySelector('.tc-vline').style.left = px.toFixed(1) + 'px';
  box.querySelector('.tc-hline').style.top = py.toFixed(1) + 'px';
  const t = trendPxToTime(px);
  const v = trendPxToVal(py);
  const series = (trendData && trendData.series) || [];
  const tLabel = (g.t1 - g.t0) > 86400000 ? clockLabelDate(t) : clockLabel(t);
  let html = `<div class="tc-t">${tLabel}</div>`;
  html += `<div class="tc-row"><span class="tc-t">Y</span>&nbsp;${escapeHtml(fmtNum(v))}</div>`;
  for (const s of series) {
    const sv = valueAtTime(s.series_id, t);
    html += `<div class="tc-row"><span class="tc-dot" style="background:${s.color}"></span>${escapeHtml(s.label)}:&nbsp;<b>${escapeHtml(fmtNum(sv))}</b></div>`;
  }
  const label = box.querySelector('.tc-label');
  label.innerHTML = html;
  // 라벨은 손가락 반대쪽에 (화면 밖 방지)
  if (px < g.W / 2) { label.style.left = Math.min(px + 12, g.W - 140).toFixed(0) + 'px'; label.style.right = 'auto'; }
  else { label.style.right = Math.min(g.W - px + 12, g.W - 140).toFixed(0) + 'px'; label.style.left = 'auto'; }
}

function clockLabel(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function fmtNum(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString();
  return (Math.round(n * 100) / 100).toString();
}

/* ── 터치 제스처: 1손가락 팬 / 2손가락 핀치 줌 ── */
const PAN_GAIN = 2;   // 화면폭 전체 드래그 = 현재 창의 2배 이동(절반 스와이프 = 창 1개). 5분 창이면 절반 5분·전체 10분

function bindTrendGestures() {
  const svg = $('trend-svg');
  let mode = null;          // 'pan' | 'pinch' | 'cross'
  let panX0 = 0, panY0 = 0, right0 = 0;
  let gapX0 = 0, gapY0 = 0, span0 = 0, centerT0 = 0, vLo0 = 0, vHi0 = 0, centerV0 = null;
  let lpTimer = null;

  const rectW = () => $('trend-chart-wrap').clientWidth || 320;
  const clearTransform = () => { svg.style.transform = ''; svg.style.willChange = ''; };
  const cancelLP = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };

  svg.addEventListener('touchstart', (e) => {
    const d = trendDomain();
    trendGesturing = true;
    const r = svg.getBoundingClientRect();
    if (e.touches.length === 1) {
      mode = 'pan';
      panX0 = e.touches[0].clientX; panY0 = e.touches[0].clientY;
      right0 = trendView.toMs != null ? trendView.toMs : d.now;
      svg.style.willChange = 'transform';
      // 제자리에서 350ms 누르고 있으면 → 십자선
      const lx = panX0 - r.left, ly = panY0 - r.top;
      cancelLP();
      lpTimer = setTimeout(() => { lpTimer = null; mode = 'cross'; clearTransform(); showCrosshair(lx, ly); }, 350);
    } else if (e.touches.length === 2) {
      cancelLP();
      mode = 'pinch';
      clearTransform();
      hideCrosshair();
      gapX0 = Math.max(1, Math.abs(e.touches[0].clientX - e.touches[1].clientX));
      gapY0 = Math.max(1, Math.abs(e.touches[0].clientY - e.touches[1].clientY));
      span0 = trendView.spanSec;
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
      const frac = Math.min(1, Math.max(0, (mx - 46) / (r.width - 54)));
      centerT0 = d.t0 + frac * (d.t1 - d.t0);
      if (trendGeom) { vLo0 = trendGeom.vMin; vHi0 = trendGeom.vMax; centerV0 = trendPxToVal(my); }
      else { vLo0 = vHi0 = 0; centerV0 = null; }
    }
  }, { passive: true });

  svg.addEventListener('touchmove', (e) => {
    if (mode === 'cross' && e.touches.length >= 1) {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      crossPx = { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
      drawCrosshair();
      return;
    }
    if (mode === 'pan' && e.touches.length === 1) {
      const dx = e.touches[0].clientX - panX0;
      const dy = e.touches[0].clientY - panY0;
      if (lpTimer) {                                  // 아직 꾹 누르기 후보
        if (Math.hypot(dx, dy) > 8) cancelLP();       // 움직이면 팬 확정
        else return;                                  // 미세 떨림 무시
      }
      e.preventDefault();
      const now = (trendData && trendData.now) || Date.now();
      const dtMs = -(dx / rectW()) * (trendView.spanSec * 1000) * PAN_GAIN;
      const newRight = right0 + dtMs;
      trendView.toMs = newRight >= now ? null : newRight;
      const w = rectW();
      svg.style.transform = `translateX(${(dx * PAN_GAIN * (w - 54) / w).toFixed(1)}px)`;
    } else if (mode === 'pinch' && e.touches.length === 2) {
      e.preventDefault();
      const gxN = Math.max(1, Math.abs(e.touches[0].clientX - e.touches[1].clientX));
      const gyN = Math.max(1, Math.abs(e.touches[0].clientY - e.touches[1].clientY));
      const sx = gxN / gapX0;   // >1 = 가로로 벌림 = 시간축 확대
      const sy = gyN / gapY0;   // >1 = 세로로 벌림 = 값축 확대
      const now = (trendData && trendData.now) || Date.now();
      const r = svg.getBoundingClientRect();
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
      if (Math.abs(sx - 1) > 0.01) {
        const newSpan = Math.min(259200, Math.max(10, span0 / sx));
        trendView.spanSec = newSpan;
        const frac = Math.min(1, Math.max(0, (mx - 46) / (r.width - 54)));
        const newRight = centerT0 + (1 - frac) * newSpan * 1000;
        trendView.toMs = newRight >= now ? null : newRight;
      }
      if (centerV0 != null && Math.abs(sy - 1) > 0.02) {
        const half = Math.max(1e-6, ((vHi0 - vLo0) / 2) / sy);
        trendY = { mode: 'fixed', lo: centerV0 - half, hi: centerV0 + half };
      }
      svg.style.transform =
        `translate(${(mx * (1 - sx)).toFixed(1)}px, ${(my * (1 - sy)).toFixed(1)}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
      svg.style.willChange = 'transform';
    }
  }, { passive: false });

  const endGesture = (e) => {
    if (!mode) return;
    if (e.type !== 'touchcancel' && e.touches.length > 0) return;
    cancelLP();
    const wasCross = mode === 'cross';
    mode = null;
    trendGesturing = false;
    clearTransform();
    if (wasCross) { hideCrosshair(); return; }   // 십자선은 데이터 변경 없음 — 재조회 불필요
    trendDisplayTick(true);                       // 새 도메인/범위로 실데이터 재조회·재렌더
  };
  svg.addEventListener('touchend', endGesture);
  svg.addEventListener('touchcancel', endGesture);
}

/* ── 축 설정 모달 ── */
function openAxisModal() {
  $('tx-min').value = (trendView.spanSec / 60).toString();
  const fixed = trendY.mode === 'fixed';
  $('ty-mode').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.ym === (fixed ? 'fixed' : 'auto')));
  $('ty-fixed-row').classList.toggle('hidden', !fixed);
  $('ty-lo').value = trendY.lo != null ? trendY.lo : '';
  $('ty-hi').value = trendY.hi != null ? trendY.hi : '';
  $('trend-axis-error').textContent = '';
  $('trend-axis-modal').classList.remove('hidden');
}
function applyAxisModal() {
  const minutes = parseFloat($('tx-min').value);
  if (Number.isFinite(minutes) && minutes > 0) {
    trendView.spanSec = Math.min(259200, Math.max(10, minutes * 60));
  }
  const fixed = $('ty-mode').querySelector('button.active')?.dataset.ym === 'fixed';
  if (fixed) {
    const lo = parseFloat($('ty-lo').value), hi = parseFloat($('ty-hi').value);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo >= hi) {
      $('trend-axis-error').textContent = 'Y 최소 < 최대 로 입력하세요.';
      return;
    }
    trendY = { mode: 'fixed', lo, hi };
  } else {
    trendY = { mode: 'auto', lo: null, hi: null };
  }
  $('trend-axis-modal').classList.add('hidden');
  trendDisplayTick(true);
}

/* ── PNG 저장 ── */
function exportTrendPng() {
  const svg = $('trend-svg');
  const wrap = $('trend-chart-wrap');
  const W = wrap.clientWidth || 320, H = wrap.clientHeight || 240;
  const cs = getComputedStyle(document.body);
  const surface = cs.getPropertyValue('--surface').trim() || '#111827';
  const border = cs.getPropertyValue('--border').trim() || '#1f2937';
  const dim = cs.getPropertyValue('--text-dim').trim() || '#9ca3af';
  const inner = svg.innerHTML
    .replace(/fill="var\(--surface\)"/g, `fill="${surface}"`)
    .replace(/class="trend-grid-line"/g, `stroke="${border}" stroke-width="1"`)
    .replace(/class="trend-axis-text"/g, `fill="${dim}" font-size="10" font-family="sans-serif"`)
    .replace(/class="trend-series"/g, 'fill="none" stroke-width="1.6"');
  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${inner}</svg>`;
  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const c = document.createElement('canvas');
    c.width = W * scale; c.height = H * scale;
    const ctx = c.getContext('2d');
    ctx.fillStyle = surface; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    c.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'trend_' + new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '') + '.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  };
  img.onerror = () => alert('PNG 변환 실패');
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
}

/* ── 변수 추가 ── */
function openTrendAdd() {
  $('ts-label').value = '';
  $('ts-num').value = '';
  $('ts-bit').value = '';
  $('ts-error').textContent = '';
  $('trend-add-modal').classList.remove('hidden');
}
async function trendAddSave() {
  try {
    await api('/api/trend/series', {
      method: 'POST',
      body: JSON.stringify({
        label: $('ts-label').value.trim(),
        areaType: $('ts-area').value,
        address: $('ts-num').value.trim(),
        dataType: $('ts-dtype').value,
        bitIndex: $('ts-bit').value.trim(),
      }),
    });
    $('trend-add-modal').classList.add('hidden');
    trendDisplayTick(true);
  } catch (err) {
    $('ts-error').textContent = err.message;
  }
}

async function toggleTrendLogging() {
  try {
    const r = await api('/api/trend/logging', { method: 'POST', body: JSON.stringify({ enabled: !trendLogging }) });
    trendLogging = r.logging;
    trendDisplayTick(true);
  } catch (err) { alert('오류: ' + err.message); }
}

async function trendImportFile(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const r = await api('/api/trend/import', { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: text });
    alert(`가져오기 완료: 시리즈 ${r.series}개, 샘플 ${r.importedSamples.toLocaleString()}건`);
    trendDisplayTick(true);
  } catch (err) {
    alert('가져오기 실패: ' + err.message);
  }
}
checkSession();
