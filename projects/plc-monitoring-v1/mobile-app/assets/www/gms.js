function toast(message, kind = '') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast show ${kind}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.className = 'toast';
  }, 2500);
}

// ── 시각 표기를 UTC('Z')가 아니라 PC 시계 그대로(한국 시간)로 통일한다(사용자 지적 -
// 작업이력 등에 찍히는 시각이 실제 PC 시간보다 9시간 느리게 보임). Date의 로컬 게터
// (getFullYear 등)는 이 PC의 OS 시간대를 그대로 따르므로, 한국 시간대로 맞춰진 PC에서는
// UTC 변환 없이 그대로 쓰면 된다. 서버 쪽 src/timeUtils.js와 형식을 맞춰야 work_log.ts 등과
// 문자열 부등호 비교(기간 필터)가 시간순으로 맞게 정렬된다. 클래식 스크립트의 최상위 함수라
// 동적 import()로 불러오는 Univer 그리드 위젯에서도(toast()와 동일하게) 그대로 호출 가능. ──
function localTimePad(n, len = 2) {
  return String(n).padStart(len, '0');
}
function formatLocalIso(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${localTimePad(d.getMonth() + 1)}-${localTimePad(d.getDate())}T${localTimePad(d.getHours())}:${localTimePad(d.getMinutes())}:${localTimePad(d.getSeconds())}.${localTimePad(d.getMilliseconds(), 3)}+09:00`;
}
function nowLocalFilenameStamp() {
  const d = new Date();
  return `${d.getFullYear()}${localTimePad(d.getMonth() + 1)}${localTimePad(d.getDate())}${localTimePad(d.getHours())}${localTimePad(d.getMinutes())}`;
}

// ── Univer 그리드 위젯(TREND/USER/작업이력/에러사항/설정모드) 지연 로딩 - 예전엔 gms.html이
// 이 5개를 <script type="module">로 전부 즉시 불러왔는데, 위젯 하나당 번들이 13MB(대부분
// 안 쓰는 다국어 로케일)라 조작화면을 열 때마다 약 65MB를 내려받고 파싱해서 체감 부하가
// 컸다(콘솔의 "redi를 여러 번 로드했다" 경고도 이 중복 로딩의 증상이었다). 이제 각 화면을
// 실제로 처음 열 때만(그 화면의 initGmsXGrid를 부르기 직전) dynamic import()로 불러온다 -
// Promise를 캐싱해서 같은 화면을 여러 번 열어도 한 번만 로드된다. ──
const gmsWidgetModulePromises = {};
function loadGmsWidgetModule(key, path) {
  if (!gmsWidgetModulePromises[key]) gmsWidgetModulePromises[key] = import(path);
  return gmsWidgetModulePromises[key];
}
window.loadGmsWidgetModule = loadGmsWidgetModule;

/** File 객체를 base64 문자열로 읽는다(data URL 접두어는 잘라냄) - TREND "기록 불러오기"에서 사용
    (monitoring.js의 동명 함수와 동일). */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** 파일 Blob을 저장한다(가능하면 "다른 이름으로 저장" 창) - monitoring.js의 동명 함수와 동일. */
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
      if (e && e.name === 'AbortError') throw e;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Content-Disposition 헤더에서 서버가 정한 파일명을 뽑아낸다. 못 찾으면 fallback을 쓴다. */
function filenameFromResponse(res, fallback) {
  const cd = res.headers.get('content-disposition') || '';
  const star = cd.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) return decodeURIComponent(star[1]);
  const plain = cd.match(/filename="?([^";]+)"?/i);
  if (plain) return plain[1];
  return fallback;
}

/** 서버 내보내기 응답을 fetch로 받아 Save As(가능하면)로 저장한다 - monitoring.js와 동일. */
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
    // "다른 이름으로 저장" 대화상자에서 취소를 누르면 여기로 온다 - 예전엔 아무 표시 없이
    // 조용히 끝나서 "내보내기를 눌렀는데 아무 반응이 없다/저장이 안 된다"처럼 보였다
    // (요청사항 - 실패인지 취소인지 구분이 안 되던 문제). 이제 명시적으로 알려준다.
    if (e && e.name === 'AbortError') {
      toast('저장을 취소했습니다.', '');
      return false;
    }
    toast('내보내기 실패: ' + e.message, 'err');
    return false;
  }
}

/** 우클릭 메뉴의 "내보내기 → PNG": 캔버스를 그대로 이미지로 저장(창 선택) - monitoring.js와 동일. */
async function exportChartPngPicker(canvas, filenameBase) {
  const dataUrl = canvas.toDataURL('image/png');
  const blob = await (await fetch(dataUrl)).blob();
  await saveBlobWithPicker(blob, `${filenameBase}_${Date.now()}.png`, 'image/png');
}

function csvEscapeClient(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** {timestamps, columns} 페이로드를 CSV 문자열로 만든다(monitoring.js와 동일 형식). */
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

/** 우클릭 메뉴의 "내보내기 → CSV": 차트 데이터를 CSV로 저장(창 선택) - monitoring.js와 동일. */
async function exportChartCsvPicker(payload, filenameBase) {
  if (!payload) { toast('내보낼 데이터가 없습니다.', 'err'); return; }
  const csv = buildCsvFromPayload(payload);
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  await saveBlobWithPicker(blob, `${filenameBase}_${Date.now()}.csv`, 'text/csv');
}

/** 우클릭 메뉴의 "내보내기 → PDF": 캔버스 이미지를 서버에서 PDF 한 페이지로 감싸 저장(창 선택) -
    /api/trend/chart/export-pdf(범용 엔드포인트)를 monitoring.js와 그대로 공유한다. */
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

// ── 트렌드 차트 우클릭 메뉴 (PyQtGraph 우클릭 메뉴 구조: 전체보기/X축/Y축/마우스모드/플롯옵션/
// 내보내기) - monitoring.html의 Total 차트/개별 팝업과 동일한 메뉴가 뜨도록 그대로 이식했다.
// makeGmsCtxItem/closeGmsCtxMenu는 Total 캔버스와 각 개별 팝업이 공통으로 쓰는 헬퍼. ──
let gmsCurrentCtxMenu = null;
function closeGmsCtxMenu() {
  if (gmsCurrentCtxMenu) { gmsCurrentCtxMenu.remove(); gmsCurrentCtxMenu = null; }
}
function setGmsCtxMenu(el) { gmsCurrentCtxMenu = el; }
function makeGmsCtxItem(label, opts = {}) {
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
      closeGmsCtxMenu();
    });
  }
  return div;
}
function makeGmsCtxSep() {
  const div = document.createElement('div');
  div.className = 'ctx-sep';
  return div;
}
document.addEventListener('click', closeGmsCtxMenu);

// ── 장비 선택 화면에서 넘어온 unit id - 이 화면의 밸브 목록/폴링/쓰기가 모두 이 장비 기준이다.
// 장비 선택 없이 이 페이지에 바로 들어오면(예: 즐겨찾기) 무엇을 봐야 할지 알 수 없으므로
// 선택 화면으로 돌려보낸다. mode(모니터링/Operation)도 같은 이유로 장비 선택 화면의 모드
// 선택 팝업을 반드시 거치게 한다 - 없거나 알 수 없는 값이면 역시 되돌려보낸다. ──
const selectedUnitId = new URLSearchParams(window.location.search).get('unit');
const gmsModeParam = new URLSearchParams(window.location.search).get('mode');
const gmsMode = gmsModeParam === 'operation' ? 'operation' : (gmsModeParam === 'monitor' ? 'monitor' : null);
if (!selectedUnitId || !gmsMode) {
  window.location.replace('/gms-select.html');
}
// gms-editor.js(뒤에 로드됨)가 맵 편집 기능 자체를 켤지 말지 판단하는 데 쓴다.
window.__gmsOperationMode = gmsMode === 'operation';
(function showSelectedUnit() {
  const el = document.getElementById('unitLabel');
  if (selectedUnitId && el) el.textContent = `— ${selectedUnitId}`;
  const modeEl = document.getElementById('modeLabel');
  if (modeEl && gmsMode) {
    modeEl.textContent = gmsMode === 'operation' ? 'Operation Mode' : '모니터링 Mode';
    modeEl.classList.toggle('operation', gmsMode === 'operation');
    modeEl.classList.toggle('monitor', gmsMode !== 'operation');
  }
})();

/** 모니터링 모드에서 밸브 조작 등 Operation 전용 동작을 막을 때 공통으로 쓰는 가드. */
function requireOperationMode(actionLabel) {
  if (window.__gmsOperationMode) return true;
  toast(`모니터링 모드에서는 ${actionLabel}을(를) 할 수 없습니다.`, 'err');
  return false;
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

// ── PLC 연결/폴링 제어는 장비 선택 화면(gms-select.html)으로 옮겨졌다. 이 화면은 그 화면에서
// 이미 연결·시작해둔 값을 읽기만 한다(연결 상태에 따라 헤더의 CPU 정보 정도만 갱신). ──
const cpuInfo = document.getElementById('cpuInfo');
function updateCpuInfoFromStatus(status) {
  if (!status) return;
  if (status.controllerInfo && status.controllerInfo.model) {
    const v = status.controllerInfo.version ? ` (Ver. ${status.controllerInfo.version})` : '';
    cpuInfo.textContent = `— ${status.controllerInfo.model}${v}`;
    const fwEl = document.getElementById('eqPlcFw');
    if (fwEl) fwEl.textContent = status.controllerInfo.version || '-';
  } else if (!status.connected) {
    cpuInfo.textContent = '— 연결 전';
    const fwEl = document.getElementById('eqPlcFw');
    if (fwEl) fwEl.textContent = '-';
  } else {
    cpuInfo.textContent = '— CPU 정보 확인 중...';
  }
}
fetch('/api/gms/conn-status').then((r) => r.json()).then((d) => { if (d.ok) updateCpuInfoFromStatus(d.status); }).catch(() => {});

// ── 밸브 목록 / 배관도 렌더링 ──
// (수동 밸브 제어 좌측 패널은 폐지 - 밸브 조작은 조작화면의 "수동밸브 조작" 화면으로
// 일원화됐다. 밸브 태그는 이제 배관도화면과 조작화면이 동일한 이름을 공유한다.)
let valves = [];
let pts = [];
const valveLayer = document.getElementById('valveLayer');
const ptLayer = document.getElementById('ptLayer');
const lastValueByTag = {}; // tag -> { cmd, fb }
const lastPtByTag = {}; // tag -> number|null

/** fb(피드백)가 있으면 그걸 실제 상태로 쓰고, 명령/피드백 불일치면 fault 상태로 표시한다. */
function valveStateClass(v) {
  if (!v || (v.cmd === null && v.fb === null)) return 'state-unknown';
  const fb = v.fb === null || v.fb === undefined ? v.cmd : v.fb;
  if (v.cmd !== null && v.fb !== null && v.cmd !== v.fb) return 'state-fault';
  return fb ? 'state-open' : 'state-closed';
}

function valveStateLabel(v) {
  const cls = valveStateClass(v);
  if (cls === 'state-fault') return { text: '불일치', badge: 'fault' };
  if (cls === 'state-open') return { text: 'OPEN', badge: 'open' };
  if (cls === 'state-closed') return { text: 'CLOSED', badge: 'closed' };
  return { text: '-', badge: '' };
}

/** 배관도 위 밸브 심볼(bowtie) 하나를 SVG <g>로 만든다. */
function buildValveSvg(v) {
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');
  g.setAttribute('class', 'gms-valve state-unknown');
  g.setAttribute('transform', `translate(${v.x},${v.y})`);
  g.dataset.tag = v.tag;

  const body = document.createElementNS(ns, 'path');
  // 표준 P&ID 밸브 기호(bowtie) - 배관도 SVG상 이 밸브가 놓인 배관 방향(v.dir)에 맞춰
  // 가로 배관이면 좌우로, 세로 배관이면 상하로 마주보는 삼각형 쌍을 그린다.
  const d = v.dir === 'v'
    ? 'M-8,-12 L0,0 L8,-12 Z M-8,12 L0,0 L8,12 Z'
    : 'M-12,-8 L0,0 L-12,8 Z M12,-8 L0,0 L12,8 Z';
  body.setAttribute('d', d);
  body.setAttribute('class', 'body');
  g.appendChild(body);

  // 라벨 위치는 원본 배관도(SK_M15_GC_PID.svg)에서 이 밸브에 손으로 맞춰뒀던 위치를 그대로
  // 옮겨온 값(labelDx/labelDy/labelAnchor) - 없으면 기본값(밸브 위 중앙)으로 대체한다.
  const tagText = document.createElementNS(ns, 'text');
  tagText.setAttribute('class', 'valve-tag');
  tagText.setAttribute('x', String(v.labelDx ?? 0));
  tagText.setAttribute('y', String(v.labelDy ?? -14));
  tagText.style.textAnchor = v.labelAnchor || 'middle';
  tagText.textContent = v.tag;
  g.appendChild(tagText);

  g.addEventListener('click', () => requestValveAction(v.tag));
  return g;
}

/** tag가 히터(M/H·J/H·L/H_2nd) 태그인지 판단한다 - HEATER_GRID_LAYOUT은 파일 뒤쪽에서
 * 정의되지만, 이 함수는 페이지 로드 후(비동기 콜백 안에서)에만 호출되므로 문제없다. */
function isHeaterTag(tag) {
  return typeof HEATER_GRID_LAYOUT !== 'undefined'
    && HEATER_GRID_LAYOUT.some((h) => (h.common ? tag === h.key : tag === `${h.key}_A` || tag === `${h.key}_B`));
}

/** 배관도 위 히터 아이콘 - 수동 On/Off 토글박스 + SSR 출력신호(흰 원) + 코일(지그재그, 장식) +
 * 온도 표시(값 박스)를 한 데 묶는다. 밸브와 같은 클릭/상태(class) 체계를 재사용한다
 * (gms-valve 대신 gms-heater, state-open=ON/state-closed=OFF). 온도 값은 이 히터와 같은
 * 이름의 PT 항목(unit1.json pts[])을 그대로 읽어온다 - ptLayer에 별도로 안 그리므로
 * renderPts()가 이 태그는 건너뛴다(중복 표시 방지). */
function buildHeaterSvg(v) {
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');
  g.setAttribute('class', 'gms-heater state-unknown');
  g.setAttribute('transform', `translate(${v.x},${v.y})`);
  g.dataset.tag = v.tag;

  // 참고 이미지처럼 라벨/토글/SSR/코일/온도표시를 전부 테두리 하나(block)로 묶는다 -
  // 각 부품을 따로 그리던 전 버전과 달리, 이제 밸브 조작 화면의 밸브 격자 버튼처럼 히터
  // 하나 = 시각적으로 한 덩어리가 되도록 바깥 테두리 사각형을 가장 먼저 그린다.
  const block = document.createElementNS(ns, 'rect');
  block.setAttribute('class', 'heater-block-border');
  block.setAttribute('x', '-38');
  block.setAttribute('y', '-26');
  block.setAttribute('width', '80');
  block.setAttribute('height', '64');
  block.setAttribute('rx', '3');
  g.appendChild(block);

  // 태그 라벨 - 다른 요소처럼 바깥에 따로 두지 않고 블럭 왼쪽 위 안에 포함한다.
  const tagText = document.createElementNS(ns, 'text');
  tagText.setAttribute('class', 'heater-tag');
  tagText.setAttribute('x', '-33');
  tagText.setAttribute('y', '-6');
  tagText.textContent = v.tag;
  g.appendChild(tagText);

  const toggleBox = document.createElementNS(ns, 'rect');
  toggleBox.setAttribute('class', 'heater-toggle-box');
  toggleBox.setAttribute('x', '-2');
  toggleBox.setAttribute('y', '-16');
  toggleBox.setAttribute('width', '20');
  toggleBox.setAttribute('height', '20');
  toggleBox.setAttribute('rx', '2');
  g.appendChild(toggleBox);

  const toggleText = document.createElementNS(ns, 'text');
  toggleText.setAttribute('class', 'heater-toggle-text');
  toggleText.setAttribute('x', '8');
  toggleText.setAttribute('y', '-3');
  toggleText.textContent = 'OFF';
  g.appendChild(toggleText);

  // SSR(Solid State Relay) 출력신호 표시 - 흰 원, ON일 때만 강조 테두리.
  const ssr = document.createElementNS(ns, 'circle');
  ssr.setAttribute('class', 'heater-ssr');
  ssr.setAttribute('cx', '29');
  ssr.setAttribute('cy', '-6');
  ssr.setAttribute('r', '7');
  g.appendChild(ssr);

  // 코일(전열선) 지그재그 - 순수 장식, 상태와 무관.
  const coil = document.createElementNS(ns, 'path');
  coil.setAttribute('class', 'heater-coil');
  coil.setAttribute('d', 'M36,-13 L41,-9.5 L36,-6 L41,-2.5 L36,1');
  g.appendChild(coil);

  // 온도 표시(값 박스) - 블럭 아래쪽에 폭을 채워서, PT 값 박스와 동일 스타일 재사용.
  const box = document.createElementNS(ns, 'rect');
  box.setAttribute('class', 'gms-pt-box');
  box.setAttribute('x', '-33');
  box.setAttribute('y', '9');
  box.setAttribute('width', '66');
  box.setAttribute('height', '21');
  g.appendChild(box);
  const value = document.createElementNS(ns, 'text');
  value.setAttribute('class', 'gms-pt-value');
  value.setAttribute('x', '0');
  value.setAttribute('y', '25');
  value.textContent = '--';
  g.appendChild(value);
  ptValueTextRefs[v.tag] = value; // applyGmsPts()가 같은 태그명의 PT 값을 그대로 채워준다

  g.addEventListener('click', () => requestValveAction(v.tag));
  return g;
}

const ptValueTextRefs = {}; // tag -> <text class="gms-pt-value">

function renderDiagram() {
  valveLayer.innerHTML = '';
  // ptValueTextRefs는 여기서 초기화한다(renderDiagram이 항상 renderPts보다 먼저 호출되는
  // 관례를 이용) - 히터 아이콘이 자기 태그로 등록해두는 값을 renderPts()가 지우지 않도록.
  for (const k of Object.keys(ptValueTextRefs)) delete ptValueTextRefs[k];
  // x/y가 없는 밸브(예: AG_A/AG_B - 배관도상 실제 위치가 없어 수동 밸브 조작 격자에서만
  // 조작한다)는 배관도에 그리지 않는다. 상태 조회/쓰기(requestValveAction, lastValueByTag)는
  // valves 배열에 그대로 있으므로 격자 버튼 쪽은 정상 동작한다.
  valves
    .filter((v) => v.x !== undefined && v.y !== undefined)
    // 히터는 PT/Weight/Heater 사용 옵션의 대상이라 미적용이면 배관도에서 아예 뺀다(요청사항).
    // 일반 밸브는 이 옵션의 대상이 아니므로 그대로 그린다.
    .filter((v) => !isHeaterTag(v.tag) || isAnalogTagEnabled(v.tag))
    .forEach((v) => valveLayer.appendChild(isHeaterTag(v.tag) ? buildHeaterSvg(v) : buildValveSvg(v)));
  if (typeof renderGspPipeLayers === 'function') renderGspPipeLayers();
}


/** 배관도 위 PT(압력 트랜스미터) 표시(라벨 + 값 박스) 하나를 SVG <g>로 만든다. */
function buildPtSvg(p) {
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');
  g.setAttribute('class', 'gms-pt' + (p.alert ? ' alert' : ''));
  g.setAttribute('transform', `translate(${p.x},${p.y})`);
  g.dataset.tag = p.tag;

  // 값 박스는 원점 중심에 고정(밸브 심볼처럼 배관 위치에 맞춰 놓는 기준점).
  const box = document.createElementNS(ns, 'rect');
  box.setAttribute('class', 'gms-pt-box');
  box.setAttribute('x', '-19');
  box.setAttribute('y', '-10');
  box.setAttribute('width', '38');
  box.setAttribute('height', '20');
  g.appendChild(box);

  const value = document.createElementNS(ns, 'text');
  value.setAttribute('class', 'gms-pt-value');
  value.setAttribute('x', '0');
  value.setAttribute('y', '5');
  value.textContent = '--';
  g.appendChild(value);
  ptValueTextRefs[p.tag] = value;

  // 명칭(태그) 라벨 위치 - 밸브 태그와 동일하게 labelDx/labelDy/labelAnchor로 커스터마이즈
  // 가능. 기본값은 "값 박스 아래, 왼쪽 정렬"(박스 왼쪽 모서리 x=-19에 맞춤).
  const label = document.createElementNS(ns, 'text');
  label.setAttribute('class', 'gms-pt-label');
  label.setAttribute('x', String(p.labelDx ?? -19));
  label.setAttribute('y', String(p.labelDy ?? 24));
  label.style.textAnchor = p.labelAnchor || 'start';
  label.textContent = p.label || p.tag;
  g.appendChild(label);

  return g;
}

function renderPts() {
  if (!ptLayer) return;
  ptLayer.innerHTML = '';
  // ptValueTextRefs 초기화는 renderDiagram()에서 이미 했다(그 안에서 히터 아이콘의 값
  // 텍스트를 먼저 등록해두므로 여기서 또 지우면 안 된다). 히터 태그는 자기 아이콘 안에
  // 온도 값을 이미 표시하고 있으니 ptLayer에 중복으로 그리지 않는다.
  pts.forEach((p) => { if (!isHeaterTag(p.tag) && isAnalogTagEnabled(p.tag)) ptLayer.appendChild(buildPtSvg(p)); });
}

/** PT/Weight 표시 자릿수 - "조정모드 > 압력조정" 화면(gms-pt-calibration.js의
    decimalsForType)과 반드시 동일하게 유지한다(VT=3, 그 외(PT/Weight)=2) - 배관도/GMS
    TREND 등 이 값을 보여주는 모든 곳이 조정모드와 같은 자릿수를 쓰도록 통일한 것.
    ptCalibrationRows에 없는 태그(M/H·J/H 등 온도류)는 gmsValves pts[].decimals로 폴백한다. */
function ptDisplayDecimals(tag, fallbackPt) {
  const calRow = ptCalibrationRows.find((r) => r.tag === tag);
  if (calRow) return calRow.type === 'VT' ? 3 : 2;
  return fallbackPt ? (fallbackPt.decimals || 0) : 0;
}

function applyGmsPts(ptValues) {
  for (const [tag, num] of Object.entries(ptValues || {})) {
    lastPtByTag[tag] = num;
    const el = ptValueTextRefs[tag];
    if (!el) continue;
    const p = pts.find((x) => x.tag === tag);
    const decimals = ptDisplayDecimals(tag, p);
    el.textContent = num === null || num === undefined ? '--' : num.toFixed(decimals);
  }
  if (gmsTrendOpen) gmsTrendOnLiveValues(ptValues);
  // 서브시퀀스 엔진(gms-sub-sequence-runner.js)이 나중에 로드되므로 함수 존재 여부를
  // 매번 확인한다 - Pumping 화면의 "현재값"(HPT 실시간 표시)을 PT가 새로 들어올 때마다
  // 갱신한다(사용자 요청 - "현재값은 hpt값을 계속 실시간으로 보여주면 됩니다").
  if (typeof subSeqRefreshLiveCaptures === 'function') subSeqRefreshLiveCaptures();
  if (typeof window.updateGspPressureCheckReadouts === 'function') window.updateGspPressureCheckReadouts();
}

// ═══════════════════════════════════════════════════════════════════════════
// GMS TREND 화면 - 각 시퀀스 화면의 "TREND" 버튼(~10곳, Operation.js)이 여는 공용 화면.
// 옆(monitoring.html) 트렌드 모니터링과 같은 느낌(직접 캔버스 라인차트)이지만, GMS는
// 태그가 unit1.json의 pts 15개로 고정이라 범용 변수 관리자 없이 체크박스 목록으로
// 간단하게 만들었다. 데이터 소스는 별도 로그(src/gmsHistory.js pt_samples/pt_samples_1m,
// /api/gms/history/pt-trend) - 메인 앱 트렌드 로그와는 완전히 분리되어 있다.
// 열기/닫기(이전화면 복귀)는 Operation.js의 showGmsTrend()/trendBackBtn이 담당하고,
// 여기서는 window.openGmsTrend()/closeGmsTrend()로 그 진입점만 제공한다. ──
const gmsTrendCanvas = document.getElementById('gmsTrendCanvas');
const gmsTrendCtx = gmsTrendCanvas.getContext('2d');
const gmsZoomRect = document.getElementById('gmsZoomRect');
// ── 개별 트렌드 모드 - monitoring.html의 #monChartGrid/openPopups와 동일한 구조. 태그마다
// 미니 카드+캔버스를 따로 두고(gmsMiniChartRefs), 클릭하면 큰 팝업(gmsTrendOpenPopups)이 뜬다. ──
const gmsTrendMiniGrid = document.getElementById('gmsTrendMiniGrid');
const gmsMiniChartRefs = {}; // tag -> { canvas, ctx, valueEl }
const gmsTrendOpenPopups = new Map(); // tag -> { draw, close, popup }
let gmsPopupZIndexCounter = 2500;
const TREND_COLORS = [
  '#e63946', '#2a9d8f', '#457b9d', '#f4a261', '#8338ec', '#06d6a0', '#ef476f', '#118ab2',
  '#ffd166', '#3a86ff', '#c9184a', '#6a994e', '#9b5de5', '#00bbf9', '#f15bb5',
];
let gmsTrendOpen = false;
let gmsTrendTagListReady = false;
const gmsTrendSelected = new Set(); // 체크된 태그
const gmsTrendSeries = {}; // tag -> [{ts, value}] (ms 오름차순)
let gmsTrendRedrawTimer = null;
// ── 조작화면 툴바(개별/Total, Auto Fit, Y Set, X Set, 범위 설정) - monitoring.html의
// chart-toolbar(개별 트렌드/Total 트렌드/Auto Fit/Y min·max·Set/구간(초)·X Set/시작·종료·
// 범위 설정)와 동일한 조작 개념을 그대로 옮겨왔다. ──
let gmsTrendDisplayMode = 'total'; // 'total' | 'individual'
let gmsTrendYMode = 'auto'; // 'auto' | 'manual'
let gmsTrendXMode = 'window'; // 'window'(실시간 최근 N초) | 'manual'(시작~종료 고정 구간)
let gmsTrendManualMin = null; // gmsTrendXMode==='manual'일 때 절대 시각(ms)
let gmsTrendManualMax = null;
// ── 폴링주기/시작/일시정지/정지 - monitoring.html의 실행 툴바와 동일한 개념. GMS는 PT 값이
// WS로 항상 들어오고 서버 로그(gmsHistory.js)도 이 상태와 무관하게 항상 쌓이지만, 이 상태는
// "지금 화면 그래프에 기록할지"와 "그리드/차트가 실시간을 따라갈지"를 제어한다. ──
let gmsTrendRunStatus = 'running'; // 'running' | 'paused' | 'stopped'
let gmsTrendPollIntervalMs = 1000;
let gmsTrendLastSampleAt = 0;
let gmsTrendFrozenAt = null; // 일시정지/정지 시점의 now() 고정(계속 흐르지 않게)
const gmsTrendLatestValues = {}; // tag -> 최신 표시값(문자열) - 그리드 값(C열)에 매 틱 반영
// ── Total 캔버스 휠 확대/드래그 팬·줌/호버 툴팁/우클릭 메뉴 - monitoring.html의 monChart와
// 동일한 조작감을 그대로 이식했다(handleGmsChartWheel/Mousedown 등, drawGmsTrendTotal 참고). ──
let gmsMouseMode = 'pan'; // 'pan' | 'zoom' - PyQtGraph의 Mouse Mode와 동일한 개념
let gmsShowGrid = true;
let gmsHoverX = null; // 캔버스 내 마우스 X좌표(없으면 null)
let gmsXOffsetMs = 0; // 패닝으로 인한 오프셋 - 0이면 실시간(지금)을 오른쪽 끝으로 추적
let gmsLastPlot = null; // { padding, plotW, xMin, xMax } - 패닝/줌의 pixel↔time 변환용
let gmsDragState = null; // { mode, startPx, startOffsetMs }

function gmsEpochToDatetimeLocal(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Total/개별 차트가 공통으로 쓰는 X축 범위(ms) - window(실시간) 또는 manual(범위 설정) 모드. */
function computeGmsTrendXRange() {
  if (gmsTrendXMode === 'manual' && gmsTrendManualMin != null && gmsTrendManualMax != null) {
    return { xMin: gmsTrendManualMin, xMax: gmsTrendManualMax };
  }
  const rangeSec = Number(document.getElementById('trendRangeSec')?.value) || 60;
  const liveNow = gmsTrendRunStatus === 'running' ? Date.now() : (gmsTrendFrozenAt !== null ? gmsTrendFrozenAt : Date.now());
  const now = liveNow - gmsXOffsetMs;
  return { xMin: now - rangeSec * 1000, xMax: now };
}

/** 실시간 추적으로 되돌린다(패닝/줌으로 벗어난 뒤 "자동" 선택 시) - monitoring.html의 resetToLive와 동일. */
function resetGmsTrendToLive() {
  gmsXOffsetMs = 0;
  gmsTrendXMode = 'window';
}

/** 시작/일시정지/정지 전환 - monitoring.html의 applyStatusTransition과 동일한 규칙:
    정지 상태에서 새로 시작할 때만 그래프를 비우고(일시정지 후 재개는 이어서 그림),
    실행 중이 아니게 되는 순간의 시각을 고정해 X축이 계속 흐르지 않게 한다. */
function setGmsTrendRunStatus(next) {
  const wasRunning = gmsTrendRunStatus === 'running';
  const wasStopped = gmsTrendRunStatus === 'stopped';
  if (next !== 'running' && wasRunning) gmsTrendFrozenAt = Date.now();
  else if (next === 'running') gmsTrendFrozenAt = null;
  if (next === 'running' && wasStopped) {
    for (const tag of Object.keys(gmsTrendSeries)) gmsTrendSeries[tag] = [];
    gmsTrendLastSampleAt = 0;
  }
  gmsTrendRunStatus = next;
  const startBtn = document.getElementById('trendRunStartBtn');
  const pauseBtn = document.getElementById('trendRunPauseBtn');
  const stopBtn = document.getElementById('trendRunStopBtn');
  if (startBtn) startBtn.disabled = next === 'running';
  if (pauseBtn) pauseBtn.disabled = next !== 'running';
  if (stopBtn) stopBtn.disabled = next === 'stopped';
  drawGmsTrendChart();
}

function trendColorFor(tag) {
  const idx = pts.findIndex((p) => p.tag === tag);
  return TREND_COLORS[idx >= 0 ? idx % TREND_COLORS.length : 0];
}

/** #gmsTrendGridContainer(TREND.html 프래그먼트, Operation.js가 fetch로 주입)에 Univer 태그
    체크리스트(선택/태그/태그설명/현재값 4열, gms-trend-widget.js)를 마운트하고 pts 15개로
    초기 채운다. 태그설명은 기존 체크박스 목록의 p.label을 그대로 옮긴다.
    스크립트가 module이라 로드 타이밍이 늦을 수 있어 window.initGmsTrendGrid가 아직 없으면
    잠깐 재시도한다. 선택 상태는 매 틱(drawGmsTrendChart)마다 그리드에서 폴링해 동기화한다
    (syncGmsTrendSelectionFromGrid) - Univer 셀 편집 이벤트를 직접 걸지 않아 더 단순하다. */
function populateGmsTrendTagList() {
  const container = document.getElementById('gmsTrendGridContainer');
  if (!container) return; // 프래그먼트가 아직 로드 전이면 다음 openGmsTrend() 호출 때 재시도
  gmsTrendTagListReady = true;
  // OPTION 탭에서 미적용 처리한 PT/Weight/Heater는 TREND 태그 목록에도 안 뜨게 한다(요청사항).
  const enabledPts = pts.filter((p) => isAnalogTagEnabled(p.tag));
  enabledPts.forEach((p) => gmsTrendSelected.add(p.tag));
  const tags = enabledPts.map((p) => p.tag);
  const descByTag = {};
  enabledPts.forEach((p) => { descByTag[p.tag] = p.label || ''; });
  loadGmsWidgetModule('trend', './gms-trend-grid/gms-trend-widget.js');
  const tryInit = () => {
    if (window.initGmsTrendGrid) window.initGmsTrendGrid('gmsTrendGridContainer', tags, descByTag);
    else setTimeout(tryInit, 100);
  };
  tryInit();
}

/** Univer 그리드(선택 A열)의 체크 상태를 gmsTrendSelected와 동기화한다 - 체크박스 클릭을
    직접 이벤트로 잡는 대신, drawGmsTrendChart()가 매 틱마다 호출해서 폴링한다. */
function syncGmsTrendSelectionFromGrid() {
  if (!window.gmsTrendGridApi) return;
  const current = new Set(window.gmsTrendGridApi.getSelectedTags());
  let changed = false;
  const added = [];
  for (const tag of current) {
    if (!gmsTrendSelected.has(tag)) { gmsTrendSelected.add(tag); added.push(tag); changed = true; }
  }
  for (const tag of [...gmsTrendSelected]) {
    if (!current.has(tag)) { gmsTrendSelected.delete(tag); changed = true; }
  }
  if (!changed) return;
  if (gmsTrendDisplayMode === 'individual') rebuildGmsTrendMiniCards([...gmsTrendSelected]);
  if (added.length > 0) loadGmsTrendHistory(added);
}

/** 선택된(또는 지정된) 태그들의 과거 구간을 서버(별도 PT 로그)에서 받아와 시리즈 캐시를 채운다. */
async function loadGmsTrendHistory(tags) {
  const { xMin, xMax } = computeGmsTrendXRange();
  const from = new Date(xMin);
  const to = new Date(xMax);
  await Promise.all(tags.map(async (tag) => {
    try {
      const params = new URLSearchParams({
        unit: selectedUnitId, tag, from: from.toISOString(), to: to.toISOString(), res: 'raw',
      });
      const res = await fetch(`/api/gms/history/pt-trend?${params}`);
      const data = await res.json();
      if (!data.ok) return;
      gmsTrendSeries[tag] = data.rows.map((r) => ({ ts: r.ts, value: r.value }));
    } catch (e) { /* 조회 실패해도 실시간 값은 계속 쌓이니 무시 */ }
  }));
  drawGmsTrendChart();
}

/** "기록 내보내기" - 지금 버퍼에 있는(선택 여부와 무관하게 데이터가 남아있는) 모든 태그를
    {timestamps, columns} 형태로 만든다. 컬럼 라벨은 태그명 그대로 써서, 다시 불러올 때
    변수 정의 없이도 태그로 되돌려 매칭할 수 있게 한다(buildHistoryExportPayload와 동일 모양). */
function buildGmsTrendExportPayload() {
  const tags = Object.keys(gmsTrendSeries).filter((tag) => gmsTrendSeries[tag] && gmsTrendSeries[tag].length > 0);
  if (tags.length === 0) return null;
  const tSet = new Set();
  tags.forEach((tag) => gmsTrendSeries[tag].forEach((pt) => tSet.add(pt.ts)));
  const timestamps = Array.from(tSet).sort((a, b) => a - b);
  const columns = tags.map((tag) => {
    const map = new Map(gmsTrendSeries[tag].map((pt) => [pt.ts, pt.value]));
    return { label: tag, values: timestamps.map((t) => (map.has(t) ? map.get(t) : '')) };
  });
  return { timestamps, columns };
}

/** 단일 태그(개별 팝업)용 {timestamps, columns} 페이로드 - buildGmsTrendExportPayload와 동일한 모양. */
function buildGmsTrendSingleExportPayload(tag) {
  const buf = gmsTrendSeries[tag];
  if (!buf || buf.length === 0) return null;
  return {
    timestamps: buf.map((pt) => pt.ts),
    columns: [{ label: tag, values: buf.map((pt) => pt.value) }],
  };
}

/** WS로 들어오는 실시간 PT 값을 선택된 태그의 시리즈에 이어붙인다(applyGmsPts에서 호출).
    최신 표시값(gmsTrendLatestValues)은 실행 상태와 무관하게 항상 갱신되지만(그리드에 참고용
    현재값 표시), 그래프에 실제로 점을 남기는 것은 "시작" 상태 + 폴링주기 간격일 때만이다. */
function gmsTrendOnLiveValues(ptValues) {
  const now = Date.now();
  const shouldSample = gmsTrendRunStatus === 'running' && (now - gmsTrendLastSampleAt >= gmsTrendPollIntervalMs);
  for (const [tag, num] of Object.entries(ptValues || {})) {
    const p = pts.find((x) => x.tag === tag);
    gmsTrendLatestValues[tag] = num === null || num === undefined ? '--' : num.toFixed(ptDisplayDecimals(tag, p));
    if (!shouldSample || !gmsTrendSelected.has(tag) || num === null || num === undefined) continue;
    const series = gmsTrendSeries[tag] || (gmsTrendSeries[tag] = []);
    series.push({ ts: now, value: num });
  }
  if (shouldSample) gmsTrendLastSampleAt = now;
  drawGmsTrendChart();
}

/** Y축 범위 - Auto Fit이면 보이는 구간의 실제 값에서 계산, 아니면 Y min/max 입력값(수동, Y Set). */
function gmsTrendComputeYRange(series) {
  if (gmsTrendYMode === 'auto') {
    const vals = series.map((pt) => pt.value);
    if (vals.length === 0) return { yMin: 0, yMax: 100 };
    let yMin = Math.min(...vals), yMax = Math.max(...vals);
    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    const margin = (yMax - yMin) * 0.15;
    return { yMin: yMin - margin, yMax: yMax + margin };
  }
  let yMin = Number(document.getElementById('trendYMin')?.value) || 0;
  let yMax = Number(document.getElementById('trendYMax')?.value) || 100;
  if (yMax <= yMin) yMax = yMin + 1;
  return { yMin, yMax };
}

/** Total 트렌드 모드 - 선택된 태그를 전부 한 그래프에 겹쳐 그린다. 휠 확대/드래그 팬·줌/호버
    툴팁이 쓰는 gmsLastPlot(pixel↔time 변환)도 여기서 매 프레임 갱신한다(monitoring.html의
    drawMonChart와 동일한 구조). */
function drawGmsTrendTotal(ctx, w, h, tags, xMin, xMax, gridColor, textColor) {
  const padL = 50, padR = 16, padT = 16, padB = 26;
  const plotW = Math.max(1, w - padL - padR);
  const plotH = Math.max(1, h - padT - padB);
  gmsLastPlot = { padding: { left: padL, right: padR, top: padT, bottom: padB }, plotW, xMin, xMax };
  const allSeries = tags.flatMap((tag) => (gmsTrendSeries[tag] || []).filter((pt) => pt.ts >= xMin - 2000 && pt.ts <= xMax + 2000));
  const { yMin, yMax } = gmsTrendComputeYRange(allSeries);
  if (gmsTrendYMode === 'auto') {
    const yMinInput = document.getElementById('trendYMin');
    const yMaxInput = document.getElementById('trendYMax');
    if (yMinInput && document.activeElement !== yMinInput) yMinInput.value = Math.round(yMin);
    if (yMaxInput && document.activeElement !== yMaxInput) yMaxInput.value = Math.round(yMax);
  }
  ctx.strokeStyle = gridColor; ctx.fillStyle = textColor; ctx.font = '11px sans-serif'; ctx.lineWidth = 1;
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const y = padT + (plotH * i) / yTicks;
    const val = yMax - ((yMax - yMin) * i) / yTicks;
    if (gmsShowGrid) { ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke(); }
    ctx.fillText(val.toFixed(0), 4, y + 3);
  }
  const xTicks = 6;
  for (let i = 0; i <= xTicks; i++) {
    const x = padL + (plotW * i) / xTicks;
    const t = new Date(xMin + ((xMax - xMin) * i) / xTicks);
    const label = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`;
    if (gmsShowGrid) { ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke(); }
    ctx.fillText(label, x - 18, padT + plotH + 16);
  }
  const xFor = (ts) => padL + ((ts - xMin) / (xMax - xMin || 1)) * plotW;
  const yFor = (v) => padT + plotH - ((Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin || 1)) * plotH;
  const pixToX = (px) => xMin + ((px - padL) / plotW) * (xMax - xMin);
  tags.forEach((tag) => {
    const series = (gmsTrendSeries[tag] || []).filter((pt) => pt.ts >= xMin - 2000 && pt.ts <= xMax + 2000);
    if (series.length < 1) return;
    ctx.strokeStyle = trendColorFor(tag);
    ctx.lineWidth = 2;
    ctx.beginPath();
    series.forEach((pt, i) => {
      const x = xFor(pt.ts), y = yFor(pt.value);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });

  // 범례 (좌측 상단) - monitoring.html의 drawMonChart와 동일.
  let legendY = padT + 4;
  ctx.font = '11px sans-serif';
  tags.forEach((tag) => {
    ctx.fillStyle = trendColorFor(tag);
    ctx.fillRect(padL + 4, legendY, 10, 3);
    ctx.fillStyle = textColor;
    ctx.fillText(tag, padL + 18, legendY + 5);
    legendY += 14;
  });

  // 마우스 호버 시 크로스헤어 + 값 툴팁 - monitoring.html의 drawMonChart와 동일.
  if (gmsHoverX !== null && gmsHoverX >= padL && gmsHoverX <= w - padR && tags.length > 0) {
    const hoverT = pixToX(gmsHoverX);
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(gmsHoverX, padT);
    ctx.lineTo(gmsHoverX, padT + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    const d = new Date(hoverT);
    const timeLabel = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    const lines = [timeLabel];
    tags.forEach((tag) => {
      const series = gmsTrendSeries[tag] || [];
      if (series.length === 0) return;
      let nearest = series[0];
      let bestDiff = Math.abs(series[0].ts - hoverT);
      for (const p of series) {
        const diff = Math.abs(p.ts - hoverT);
        if (diff < bestDiff) { bestDiff = diff; nearest = p; }
      }
      lines.push(`${tag}: ${nearest.value.toFixed(2)}`);
    });
    ctx.font = 'bold 11px sans-serif';
    const boxW = 200;
    const boxH = 14 + lines.length * 14;
    let boxX = gmsHoverX + 10;
    if (boxX + boxW > w) boxX = gmsHoverX - boxW - 10;
    const boxY = padT + 4;
    const css = getComputedStyle(document.documentElement);
    ctx.fillStyle = css.getPropertyValue('--panel').trim() || '#fff';
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle = textColor;
    lines.forEach((line, i) => {
      ctx.font = i === 0 ? 'bold 11px sans-serif' : '11px sans-serif';
      ctx.fillText(line, boxX + 8, boxY + 14 + i * 14);
    });
  }
}

/** 개별 트렌드 모드 - 선택된 태그마다 미니 카드+캔버스를 새로 만든다(monitoring.html의
    rebuildIndividualCharts와 동일). 선택이 바뀔 때(체크박스 토글)마다 다시 호출된다. */
function rebuildGmsTrendMiniCards(tags) {
  gmsTrendMiniGrid.innerHTML = '';
  for (const k of Object.keys(gmsMiniChartRefs)) delete gmsMiniChartRefs[k];
  tags.forEach((tag) => {
    const p = pts.find((x) => x.tag === tag);
    const card = document.createElement('div');
    card.className = 'gms-trend-mini-card';

    const title = document.createElement('div');
    title.className = 'gms-trend-mini-title';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = p && p.label ? `${tag} (${p.label})` : tag;
    nameSpan.style.color = trendColorFor(tag);
    title.appendChild(nameSpan);
    card.appendChild(title);

    const valueSpan = document.createElement('span');
    valueSpan.className = 'gms-trend-mini-value';
    valueSpan.textContent = '-';
    card.appendChild(valueSpan);

    const canvas = document.createElement('canvas');
    canvas.title = '클릭하면 이 태그만 크게 보기';
    canvas.addEventListener('click', () => openOrFocusGmsTrendPopup(tag));
    card.appendChild(canvas);

    gmsTrendMiniGrid.appendChild(card);
    gmsMiniChartRefs[tag] = { canvas, ctx: canvas.getContext('2d'), valueEl: valueSpan };
  });
}

/** 개별 트렌드 모드의 미니 카드들을 그린다 - 태그마다 자기 값 범위에 맞춰 Y축을 자동으로 맞춘다
    (monitoring.html의 drawIndividualCharts와 동일). */
function drawGmsTrendMiniCards(tags, xMin, xMax) {
  const style = getComputedStyle(document.documentElement);
  const textColor = style.getPropertyValue('--muted').trim() || '#888';
  tags.forEach((tag) => {
    const ref = gmsMiniChartRefs[tag];
    if (!ref) return;
    const rect = ref.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    if (ref.canvas.width !== rect.width || ref.canvas.height !== rect.height) {
      ref.canvas.width = Math.max(1, Math.floor(rect.width));
      ref.canvas.height = Math.max(1, Math.floor(rect.height));
    }
    const ctx = ref.ctx;
    const w = ref.canvas.width, h = ref.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const buf = (gmsTrendSeries[tag] || []).filter((pt) => pt.ts >= xMin && pt.ts <= xMax);
    if (buf.length > 1) {
      let yMin = Math.min(...buf.map((pt) => pt.value));
      let yMax = Math.max(...buf.map((pt) => pt.value));
      if (yMin === yMax) { yMin -= 1; yMax += 1; }
      const margin = (yMax - yMin) * 0.15;
      yMin -= margin; yMax += margin;
      const pad = 3;
      const xFor = (ts) => pad + ((ts - xMin) / (xMax - xMin || 1)) * (w - pad * 2);
      const yFor = (v) => pad + (h - pad * 2) - ((v - yMin) / (yMax - yMin || 1)) * (h - pad * 2);
      ctx.strokeStyle = trendColorFor(tag);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      buf.forEach((pt, i) => {
        const x = xFor(pt.ts), y = yFor(pt.value);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    } else {
      ctx.fillStyle = textColor;
      ctx.font = '11px sans-serif';
      ctx.fillText('데이터 없음', 6, h / 2);
    }

    const last = buf.length > 0 ? buf[buf.length - 1].value : null;
    const p = pts.find((x) => x.tag === tag);
    ref.valueEl.textContent = last === null ? '-' : Number(last).toFixed(ptDisplayDecimals(tag, p));
  });
}

/** 이미 열려있으면 앞으로 가져오고, 없으면 새로 만든다(monitoring.html의 openOrFocusPopup과 동일). */
function openOrFocusGmsTrendPopup(tag) {
  const existing = gmsTrendOpenPopups.get(tag);
  if (existing) {
    existing.popup.style.zIndex = String(++gmsPopupZIndexCounter);
    return;
  }
  createGmsTrendPopup(tag);
}

/** 개별 트렌드 미니 차트 클릭 시 뜨는 팝업 - 시작/일시정지/정지, Auto Fit, Y/X 범위 설정을
    독립적으로 가지며 드래그 이동/크기 조절이 가능하다(monitoring.html의 createChartPopup 참고). */
function createGmsTrendPopup(tag) {
  const state = {
    yMode: 'auto', // 'auto' | 'manual'
    xMode: 'window', // 'window' | 'manual'
    xWindowSec: Number(document.getElementById('trendRangeSec')?.value) || 60,
    xOffsetMs: 0,
    xManualMin: null,
    xManualMax: null,
    mouseMode: 'pan', // 'pan' | 'zoom'
    showGrid: true,
    viewStatus: 'running', // 'running' | 'paused' | 'stopped' - 이 팝업만의 재생 상태
    frozenAt: null,
    lastPlot: null,
    hoverX: null,
    dragState: null,
  };

  const popup = document.createElement('div');
  popup.className = 'gms-chart-popup';
  const offset = (gmsTrendOpenPopups.size % 8) * 28;
  popup.style.top = (80 + offset) + 'px';
  popup.style.left = `calc(50% + ${offset}px)`;
  popup.style.transform = 'translateX(-50%)';
  popup.style.zIndex = String(++gmsPopupZIndexCounter);
  popup.innerHTML = `
    <div class="gms-chart-popup-header">
      <span class="gms-popup-title"></span>
      <button class="gp-close" title="닫기">✕</button>
    </div>
    <div class="gms-popup-toolbar">
      <button class="gp-start primary">▶ 시작</button>
      <button class="gp-pause">⏸ 일시정지</button>
      <button class="gp-stop danger">⏹ 정지</button>
      <button class="gp-autofit">Auto Fit</button>
      <label>Y min <input type="number" class="gp-ymin" value="0" /></label>
      <label>Y max <input type="number" class="gp-ymax" value="100" /></label>
      <button class="gp-yset">Y Set</button>
      <label>구간(초) <input type="number" class="gp-xwindow" value="${state.xWindowSec}" min="10" step="10" /></label>
      <button class="gp-xset">X Set</button>
      <label>시작 <input type="datetime-local" class="gp-xmin" step="1" /></label>
      <label>종료 <input type="datetime-local" class="gp-xmax" step="1" /></label>
      <button class="gp-xrangeset">범위 설정</button>
    </div>
    <div class="gms-chart-popup-canvas-wrap"><canvas></canvas><div class="zoom-rect"></div></div>
  `;
  document.body.appendChild(popup);

  const canvas = popup.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const zoomRect = popup.querySelector('.zoom-rect');
  const titleEl = popup.querySelector('.gms-popup-title');
  const closeBtn = popup.querySelector('.gp-close');
  const startBtn = popup.querySelector('.gp-start');
  const pauseBtn = popup.querySelector('.gp-pause');
  const stopBtn = popup.querySelector('.gp-stop');
  const autoFitBtn = popup.querySelector('.gp-autofit');
  const yMinInput = popup.querySelector('.gp-ymin');
  const yMaxInput = popup.querySelector('.gp-ymax');
  const ySetBtn = popup.querySelector('.gp-yset');
  const xWindowInput = popup.querySelector('.gp-xwindow');
  const xSetBtn = popup.querySelector('.gp-xset');
  const xMinInput = popup.querySelector('.gp-xmin');
  const xMaxInput = popup.querySelector('.gp-xmax');
  const xRangeSetBtn = popup.querySelector('.gp-xrangeset');

  function currentPt() { return pts.find((p) => p.tag === tag); }
  function popupTitle() { const p = currentPt(); return p && p.label ? `${tag} (${p.label})` : tag; }
  titleEl.textContent = popupTitle();

  function computeRange() {
    if (state.xMode === 'manual' && state.xManualMin != null && state.xManualMax != null) {
      return { xMin: state.xManualMin, xMax: state.xManualMax };
    }
    const liveNow = state.viewStatus === 'running' ? Date.now() : (state.frozenAt !== null ? state.frozenAt : Date.now());
    const now = liveNow - state.xOffsetMs;
    return { xMin: now - state.xWindowSec * 1000, xMax: now };
  }

  function resetToLive() {
    state.xOffsetMs = 0;
    state.xMode = 'window';
  }

  function setViewStatus(next) {
    const wasRunning = state.viewStatus === 'running';
    if (next !== 'running' && wasRunning) state.frozenAt = Date.now();
    else if (next === 'running') { state.frozenAt = null; state.xOffsetMs = 0; }
    state.viewStatus = next;
    startBtn.disabled = next === 'running';
    pauseBtn.disabled = next !== 'running';
    stopBtn.disabled = next === 'stopped';
  }
  setViewStatus('running');

  function draw() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = Math.max(1, Math.floor(rect.width));
      canvas.height = Math.max(1, Math.floor(rect.height));
    }
    const w = canvas.width, h = canvas.height;
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
    if (document.activeElement !== xMinInput) xMinInput.value = gmsEpochToDatetimeLocal(xMin);
    if (document.activeElement !== xMaxInput) xMaxInput.value = gmsEpochToDatetimeLocal(xMax);

    const buf = (gmsTrendSeries[tag] || []).filter((pt) => pt.ts >= xMin && pt.ts <= xMax);

    let yMin, yMax;
    if (state.yMode === 'auto') {
      if (buf.length === 0) { yMin = 0; yMax = 100; } else {
        const vals = buf.map((pt) => pt.value);
        yMin = Math.min(...vals); yMax = Math.max(...vals);
        if (yMin === yMax) { yMin -= 1; yMax += 1; }
        const margin = (yMax - yMin) * 0.15;
        yMin -= margin; yMax += margin;
      }
      if (document.activeElement !== yMinInput) yMinInput.value = Math.round(yMin);
      if (document.activeElement !== yMaxInput) yMaxInput.value = Math.round(yMax);
    } else {
      yMin = Number(yMinInput.value) || 0;
      yMax = Number(yMaxInput.value) || 100;
      if (yMax <= yMin) yMax = yMin + 1;
    }

    const xFor = (t) => padding.left + ((t - xMin) / (xMax - xMin || 1)) * plotW;
    const yFor = (v) => padding.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;
    const pixToX = (px) => xMin + ((px - padding.left) / plotW) * (xMax - xMin);

    ctx.strokeStyle = gridColor; ctx.fillStyle = textColor; ctx.font = '10px sans-serif'; ctx.lineWidth = 1;
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const v = yMin + ((yMax - yMin) * i) / yTicks;
      const y = yFor(v);
      if (state.showGrid) { ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(w - padding.right, y); ctx.stroke(); }
      ctx.fillText(v.toFixed(1), 2, y + 3);
    }
    const xTicks = 4;
    for (let i = 0; i <= xTicks; i++) {
      const t = xMin + ((xMax - xMin) * i) / xTicks;
      const x = xFor(t);
      if (state.showGrid) { ctx.beginPath(); ctx.moveTo(x, padding.top); ctx.lineTo(x, h - padding.bottom); ctx.stroke(); }
      const d = new Date(t);
      ctx.fillText(`${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`, x - 12, h - 6);
    }

    if (buf.length > 0) {
      ctx.strokeStyle = trendColorFor(tag);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      buf.forEach((pt, i) => {
        const x = xFor(pt.ts), y = yFor(pt.value);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
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
      let bestDiff = Math.abs(buf[0].ts - hoverT);
      for (const p of buf) {
        const diff = Math.abs(p.ts - hoverT);
        if (diff < bestDiff) { bestDiff = diff; nearest = p; }
      }

      const d = new Date(hoverT);
      const timeLabel = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      const valText = nearest.value.toFixed(2);
      ctx.font = 'bold 11px sans-serif';
      const boxW = 200;
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
      ctx.fillText(`${popupTitle()}: ${valText}`, boxX + 8, boxY + 28);
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
    popup.style.zIndex = String(++gmsPopupZIndexCounter);
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
    if (!xMinInput.value || !xMaxInput.value) { toast('시작/종료 시각을 모두 입력하세요.', 'err'); return; }
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
  stopBtn.addEventListener('click', () => setViewStatus('stopped'));

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    closeGmsCtxMenu();
    const mouseModeSub = [
      makeGmsCtxItem('팬 (드래그로 이동)', { checkable: true, checked: state.mouseMode === 'pan', onClick: () => { state.mouseMode = 'pan'; } }),
      makeGmsCtxItem('확대 (드래그로 영역 선택)', { checkable: true, checked: state.mouseMode === 'zoom', onClick: () => { state.mouseMode = 'zoom'; } }),
    ];
    const plotOptionsSub = [
      makeGmsCtxItem('격자 표시', { checkable: true, checked: state.showGrid, onClick: () => { state.showGrid = !state.showGrid; draw(); } }),
    ];
    const menuEl = document.createElement('div');
    menuEl.className = 'ctx-menu';
    menuEl.appendChild(makeGmsCtxItem('전체 보기', {
      onClick: () => {
        const buf = gmsTrendSeries[tag] || [];
        if (buf.length > 0) {
          state.xManualMin = buf[0].ts;
          state.xManualMax = buf[buf.length - 1].ts;
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
    menuEl.appendChild(makeGmsCtxItem('마우스 모드', { hasSub: true, subItems: mouseModeSub }));
    menuEl.appendChild(makeGmsCtxItem('플롯 옵션', { hasSub: true, subItems: plotOptionsSub }));
    const exportSub = [
      makeGmsCtxItem('PNG...', { onClick: () => exportChartPngPicker(canvas, `GMS_Trend_Chart_${tag}`) }),
      makeGmsCtxItem('CSV...', { onClick: () => exportChartCsvPicker(buildGmsTrendSingleExportPayload(tag), `GMS_Trend_Chart_${tag}`) }),
      makeGmsCtxItem('PDF...', { onClick: () => exportChartPdfPicker(canvas, `GMS_Trend_Chart_${tag}`, popupTitle()) }),
    ];
    menuEl.appendChild(makeGmsCtxItem('내보내기', { hasSub: true, subItems: exportSub }));
    document.body.appendChild(menuEl);
    setGmsCtxMenu(menuEl);
    const menuRect = menuEl.getBoundingClientRect();
    let x = e.clientX;
    let y = e.clientY;
    if (x + menuRect.width > window.innerWidth) x = window.innerWidth - menuRect.width - 8;
    if (y + menuRect.height > window.innerHeight) y = window.innerHeight - menuRect.height - 8;
    menuEl.style.left = x + 'px';
    menuEl.style.top = y + 'px';
  });

  const header = popup.querySelector('.gms-chart-popup-header');
  let dragging = false, dragOffX = 0, dragOffY = 0;
  function onHeaderDown(e) {
    if (e.target.closest('button')) return;
    popup.style.zIndex = String(++gmsPopupZIndexCounter);
    dragging = true;
    const r = popup.getBoundingClientRect();
    dragOffX = e.clientX - r.left;
    dragOffY = e.clientY - r.top;
    popup.style.left = r.left + 'px';
    popup.style.top = r.top + 'px';
    popup.style.transform = 'none';
  }
  function onHeaderMoveDrag(e) {
    if (!dragging) return;
    popup.style.left = (e.clientX - dragOffX) + 'px';
    popup.style.top = (e.clientY - dragOffY) + 'px';
  }
  function onHeaderUp() { dragging = false; }
  header.addEventListener('mousedown', onHeaderDown);
  window.addEventListener('mousemove', onHeaderMoveDrag);
  window.addEventListener('mouseup', onHeaderUp);

  function close() {
    window.removeEventListener('mousemove', onWindowMousemove);
    window.removeEventListener('mouseup', onWindowMouseup);
    window.removeEventListener('mousemove', onHeaderMoveDrag);
    window.removeEventListener('mouseup', onHeaderUp);
    popup.remove();
    gmsTrendOpenPopups.delete(tag);
  }
  closeBtn.addEventListener('click', close);

  draw();
  gmsTrendOpenPopups.set(tag, { draw, close, popup });
}

function closeAllGmsTrendPopups() {
  for (const { close } of Array.from(gmsTrendOpenPopups.values())) close();
}

/** 캔버스(Total) 또는 미니 카드 그리드(개별)에 선택된 태그들을 그린다 - 트렌드 툴바의
    개별/Total 모드에 따라 분기. 열려있는 개별 팝업들도 매 틱마다 함께 갱신한다. */
function drawGmsTrendChart() {
  if (!gmsTrendOpen) return;
  syncGmsTrendSelectionFromGrid();
  if (window.gmsTrendGridApi) window.gmsTrendGridApi.applyValues(gmsTrendLatestValues);
  const { xMin, xMax } = computeGmsTrendXRange();
  const xMinInput = document.getElementById('trendXMinInput');
  const xMaxInput = document.getElementById('trendXMaxInput');
  if (xMinInput && document.activeElement !== xMinInput) xMinInput.value = gmsEpochToDatetimeLocal(xMin);
  if (xMaxInput && document.activeElement !== xMaxInput) xMaxInput.value = gmsEpochToDatetimeLocal(xMax);

  const tags = [...gmsTrendSelected];

  if (gmsTrendDisplayMode === 'individual') {
    drawGmsTrendMiniCards(tags, xMin, xMax);
  } else {
    const rect = gmsTrendCanvas.getBoundingClientRect();
    if (gmsTrendCanvas.width !== rect.width || gmsTrendCanvas.height !== rect.height) {
      gmsTrendCanvas.width = Math.max(1, Math.floor(rect.width));
      gmsTrendCanvas.height = Math.max(1, Math.floor(rect.height));
    }
    const w = gmsTrendCanvas.width, h = gmsTrendCanvas.height;
    const ctx = gmsTrendCtx;
    ctx.clearRect(0, 0, w, h);
    const css = getComputedStyle(document.documentElement);
    const gridColor = css.getPropertyValue('--panel-border').trim() || '#d8dee5';
    const textColor = css.getPropertyValue('--muted').trim() || '#5b6672';
    ctx.fillStyle = css.getPropertyValue('--panel').trim() || '#fff';
    ctx.fillRect(0, 0, w, h);
    drawGmsTrendTotal(ctx, w, h, tags, xMin, xMax, gridColor, textColor);
  }

  for (const ctrl of gmsTrendOpenPopups.values()) ctrl.draw();

  // 오래된 포인트 정리(메모리 계속 쌓이지 않게) - window(실시간) 모드에서만. manual(범위 설정)
  // 구간은 고정된 과거 조회 결과라 흐르는 시간 기준 정리 대상이 아니다.
  if (gmsTrendXMode === 'window') {
    const rangeSec = Number(document.getElementById('trendRangeSec')?.value) || 60;
    const cutoff = Date.now() - rangeSec * 2000;
    Object.keys(gmsTrendSeries).forEach((tag) => {
      gmsTrendSeries[tag] = (gmsTrendSeries[tag] || []).filter((pt) => pt.ts >= cutoff);
    });
  }
}

// ── Total 캔버스 휠 확대/드래그 팬·줌/우클릭 메뉴 - monitoring.html의 monChart와 동일한
// 조작감(handleChartWheel/Mousedown/handleChartContextMenu)을 그대로 이식했다. ──
function handleGmsChartWheel(e) {
  e.preventDefault();
  gmsTrendXMode = 'window';
  const rangeInput = document.getElementById('trendRangeSec');
  const factor = e.deltaY > 0 ? 1.2 : 1 / 1.2;
  const newSec = Math.min(3600, Math.max(5, Math.round((Number(rangeInput?.value) || 60) * factor)));
  if (rangeInput) rangeInput.value = newSec;
  drawGmsTrendChart();
}
gmsTrendCanvas.addEventListener('wheel', handleGmsChartWheel, { passive: false });

function handleGmsChartMousedown(e) {
  if (e.button !== 0 || !gmsLastPlot || gmsTrendDisplayMode !== 'total') return;
  gmsTrendXMode = 'window';
  const rect = gmsTrendCanvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  gmsDragState = { mode: gmsMouseMode, startPx: px, startOffsetMs: gmsXOffsetMs };
  if (gmsMouseMode === 'zoom') {
    gmsZoomRect.style.display = 'block';
    gmsZoomRect.style.left = px + 'px';
    gmsZoomRect.style.top = '0px';
    gmsZoomRect.style.width = '0px';
    gmsZoomRect.style.height = rect.height + 'px';
  }
}
gmsTrendCanvas.addEventListener('mousedown', handleGmsChartMousedown);

window.addEventListener('mousemove', (e) => {
  if (!gmsTrendOpen || gmsTrendDisplayMode !== 'total') return;
  const rect = gmsTrendCanvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  if (gmsDragState && gmsLastPlot) {
    if (gmsDragState.mode === 'pan') {
      const msPerPx = (gmsLastPlot.xMax - gmsLastPlot.xMin) / gmsLastPlot.plotW;
      const deltaPx = px - gmsDragState.startPx;
      gmsXOffsetMs = Math.max(0, gmsDragState.startOffsetMs - deltaPx * msPerPx);
      drawGmsTrendChart();
    } else if (gmsDragState.mode === 'zoom') {
      const left = Math.min(gmsDragState.startPx, px);
      const width = Math.abs(px - gmsDragState.startPx);
      gmsZoomRect.style.left = left + 'px';
      gmsZoomRect.style.width = width + 'px';
    }
    return;
  }
  const py = e.clientY - rect.top;
  if (px >= 0 && px <= rect.width && py >= 0 && py <= rect.height) {
    gmsHoverX = px;
    drawGmsTrendChart();
  } else if (gmsHoverX !== null) {
    gmsHoverX = null;
    drawGmsTrendChart();
  }
});

window.addEventListener('mouseup', (e) => {
  if (!gmsDragState) return;
  if (gmsDragState.mode === 'zoom' && gmsLastPlot) {
    const rect = gmsTrendCanvas.getBoundingClientRect();
    const px = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const t1 = gmsLastPlot.xMin + ((gmsDragState.startPx - gmsLastPlot.padding.left) / gmsLastPlot.plotW) * (gmsLastPlot.xMax - gmsLastPlot.xMin);
    const t2 = gmsLastPlot.xMin + ((px - gmsLastPlot.padding.left) / gmsLastPlot.plotW) * (gmsLastPlot.xMax - gmsLastPlot.xMin);
    const tMin = Math.min(t1, t2), tMax = Math.max(t1, t2);
    const spanSec = (tMax - tMin) / 1000;
    if (spanSec >= 1) {
      const now = gmsTrendFrozenAt !== null ? gmsTrendFrozenAt : Date.now();
      const rangeInput = document.getElementById('trendRangeSec');
      const newSec = Math.min(3600, Math.max(5, Math.round(spanSec)));
      if (rangeInput) rangeInput.value = newSec;
      gmsXOffsetMs = Math.max(0, now - tMax);
    }
    gmsZoomRect.style.display = 'none';
  }
  gmsDragState = null;
  drawGmsTrendChart();
});

gmsTrendCanvas.addEventListener('mouseleave', () => {
  if (!gmsDragState) gmsHoverX = null;
  drawGmsTrendChart();
});

/** Total 캔버스 우클릭 메뉴 - monitoring.html의 handleChartContextMenu와 동일한 구성
    (전체보기/X축/Y축/마우스모드/플롯옵션/내보내기). */
function handleGmsChartContextMenu(e) {
  e.preventDefault();
  closeGmsCtxMenu();

  function viewAllGmsTotal() {
    const tags = [...gmsTrendSelected];
    let minT = Infinity, maxT = -Infinity;
    tags.forEach((tag) => (gmsTrendSeries[tag] || []).forEach((p) => {
      if (p.ts < minT) minT = p.ts;
      if (p.ts > maxT) maxT = p.ts;
    }));
    gmsTrendYMode = 'auto';
    if (Number.isFinite(minT) && Number.isFinite(maxT) && maxT > minT) {
      gmsTrendManualMin = minT;
      gmsTrendManualMax = maxT;
      gmsTrendXMode = 'manual';
    } else {
      const rangeInput = document.getElementById('trendRangeSec');
      if (rangeInput) rangeInput.value = 60;
      resetGmsTrendToLive();
    }
    drawGmsTrendChart();
  }

  const xAxisSub = [
    makeGmsCtxItem('자동 (실시간 추적)', { onClick: () => { resetGmsTrendToLive(); drawGmsTrendChart(); } }),
    makeGmsCtxItem('직접 설정... (구간)', {
      onClick: () => {
        const rangeInput = document.getElementById('trendRangeSec');
        const v = window.prompt('X축 표시 구간(초)을 입력하세요.', rangeInput?.value || '60');
        const sec = Number(v);
        if (Number.isFinite(sec) && sec > 0) {
          gmsTrendXMode = 'window';
          if (rangeInput) rangeInput.value = Math.min(3600, Math.max(5, Math.round(sec)));
          drawGmsTrendChart();
        }
      },
    }),
  ];
  const yAxisSub = [
    makeGmsCtxItem('자동 범위', { onClick: () => { gmsTrendYMode = 'auto'; drawGmsTrendChart(); } }),
    makeGmsCtxItem('직접 설정...', {
      onClick: () => {
        const yMinInput = document.getElementById('trendYMin');
        const yMaxInput = document.getElementById('trendYMax');
        const vMin = window.prompt('Y축 최소값을 입력하세요.', yMinInput?.value || '0');
        const vMax = window.prompt('Y축 최대값을 입력하세요.', yMaxInput?.value || '100');
        if (vMin !== null && vMax !== null && Number(vMax) > Number(vMin)) {
          if (yMinInput) yMinInput.value = Number(vMin);
          if (yMaxInput) yMaxInput.value = Number(vMax);
          gmsTrendYMode = 'manual';
          drawGmsTrendChart();
        }
      },
    }),
  ];
  const mouseModeSub = [
    makeGmsCtxItem('팬 (드래그로 이동)', { checkable: true, checked: gmsMouseMode === 'pan', onClick: () => { gmsMouseMode = 'pan'; } }),
    makeGmsCtxItem('확대 (드래그로 영역 선택)', { checkable: true, checked: gmsMouseMode === 'zoom', onClick: () => { gmsMouseMode = 'zoom'; } }),
  ];
  const plotOptionsSub = [
    makeGmsCtxItem('격자 표시', { checkable: true, checked: gmsShowGrid, onClick: () => { gmsShowGrid = !gmsShowGrid; drawGmsTrendChart(); } }),
  ];
  const exportSub = [
    makeGmsCtxItem('PNG...', { onClick: () => exportChartPngPicker(gmsTrendCanvas, 'GMS_Trend_Chart_Total') }),
    makeGmsCtxItem('CSV...', { onClick: () => exportChartCsvPicker(buildGmsTrendExportPayload(), 'GMS_Trend_Chart_Total') }),
    makeGmsCtxItem('PDF...', { onClick: () => exportChartPdfPicker(gmsTrendCanvas, 'GMS_Trend_Chart_Total', 'GMS Total 트렌드') }),
  ];

  const menuEl = document.createElement('div');
  menuEl.className = 'ctx-menu';
  menuEl.appendChild(makeGmsCtxItem('전체 보기', { onClick: viewAllGmsTotal }));
  menuEl.appendChild(makeGmsCtxItem('X축', { hasSub: true, subItems: xAxisSub }));
  menuEl.appendChild(makeGmsCtxItem('Y축', { hasSub: true, subItems: yAxisSub }));
  menuEl.appendChild(makeGmsCtxItem('마우스 모드', { hasSub: true, subItems: mouseModeSub }));
  menuEl.appendChild(makeGmsCtxSep());
  menuEl.appendChild(makeGmsCtxItem('플롯 옵션', { hasSub: true, subItems: plotOptionsSub }));
  menuEl.appendChild(makeGmsCtxItem('내보내기', { hasSub: true, subItems: exportSub }));
  document.body.appendChild(menuEl);
  setGmsCtxMenu(menuEl);

  const menuRect = menuEl.getBoundingClientRect();
  let x = e.clientX;
  let y = e.clientY;
  if (x + menuRect.width > window.innerWidth) x = window.innerWidth - menuRect.width - 8;
  if (y + menuRect.height > window.innerHeight) y = window.innerHeight - menuRect.height - 8;
  menuEl.style.left = x + 'px';
  menuEl.style.top = y + 'px';
}
gmsTrendCanvas.addEventListener('contextmenu', handleGmsChartContextMenu);

/** Operation.js의 showGmsTrend()가 부른다 - 배관도(SVG)를 숨기고 캔버스를 보여준다. */
window.openGmsTrend = function openGmsTrend() {
  if (!gmsTrendTagListReady) populateGmsTrendTagList();
  gmsTrendOpen = true;
  document.getElementById('gmsSvg').hidden = true;
  gmsTrendCanvas.hidden = gmsTrendDisplayMode === 'individual';
  gmsTrendMiniGrid.hidden = gmsTrendDisplayMode !== 'individual';
  if (gmsTrendDisplayMode === 'individual') rebuildGmsTrendMiniCards([...gmsTrendSelected]);
  loadGmsTrendHistory([...gmsTrendSelected]);
  if (gmsTrendRedrawTimer) clearInterval(gmsTrendRedrawTimer);
  gmsTrendRedrawTimer = setInterval(drawGmsTrendChart, 1000);
  ['trendYMin', 'trendYMax'].forEach((id) => {
    const el = document.getElementById(id);
    if (el && !el.dataset.wired) { el.dataset.wired = '1'; el.addEventListener('change', drawGmsTrendChart); }
  });

  const modeIndividualBtn = document.getElementById('trendModeIndividualBtn');
  const modeTotalBtn = document.getElementById('trendModeTotalBtn');
  function setGmsTrendDisplayMode(mode) {
    gmsTrendDisplayMode = mode;
    modeTotalBtn?.classList.toggle('primary', mode === 'total');
    modeIndividualBtn?.classList.toggle('primary', mode === 'individual');
    gmsTrendCanvas.hidden = mode === 'individual';
    gmsTrendMiniGrid.hidden = mode !== 'individual';
    if (mode === 'individual') rebuildGmsTrendMiniCards([...gmsTrendSelected]);
    else closeAllGmsTrendPopups();
    drawGmsTrendChart();
  }
  if (modeIndividualBtn && !modeIndividualBtn.dataset.wired) {
    modeIndividualBtn.dataset.wired = '1';
    modeIndividualBtn.addEventListener('click', () => setGmsTrendDisplayMode('individual'));
  }
  if (modeTotalBtn && !modeTotalBtn.dataset.wired) {
    modeTotalBtn.dataset.wired = '1';
    modeTotalBtn.addEventListener('click', () => setGmsTrendDisplayMode('total'));
  }

  const autoFitBtn = document.getElementById('trendAutoFitBtn');
  if (autoFitBtn && !autoFitBtn.dataset.wired) {
    autoFitBtn.dataset.wired = '1';
    autoFitBtn.addEventListener('click', () => { gmsTrendYMode = 'auto'; drawGmsTrendChart(); });
  }
  const ySetBtn = document.getElementById('trendYSetBtn');
  if (ySetBtn && !ySetBtn.dataset.wired) {
    ySetBtn.dataset.wired = '1';
    ySetBtn.addEventListener('click', () => { gmsTrendYMode = 'manual'; drawGmsTrendChart(); });
  }
  const xSetBtn = document.getElementById('trendXSetBtn');
  if (xSetBtn && !xSetBtn.dataset.wired) {
    xSetBtn.dataset.wired = '1';
    xSetBtn.addEventListener('click', () => {
      gmsTrendXMode = 'window';
      gmsTrendManualMin = null;
      gmsTrendManualMax = null;
      loadGmsTrendHistory([...gmsTrendSelected]);
    });
  }
  const xRangeSetBtn = document.getElementById('trendXRangeSetBtn');
  if (xRangeSetBtn && !xRangeSetBtn.dataset.wired) {
    xRangeSetBtn.dataset.wired = '1';
    xRangeSetBtn.addEventListener('click', () => {
      const minInput = document.getElementById('trendXMinInput');
      const maxInput = document.getElementById('trendXMaxInput');
      if (!minInput.value || !maxInput.value) { toast('시작/종료 시각을 모두 입력하세요.', 'err'); return; }
      const minMs = new Date(minInput.value).getTime();
      const maxMs = new Date(maxInput.value).getTime();
      if (!Number.isFinite(minMs) || !Number.isFinite(maxMs) || maxMs <= minMs) {
        toast('종료 시각이 시작 시각보다 커야 합니다.', 'err');
        return;
      }
      gmsTrendManualMin = minMs;
      gmsTrendManualMax = maxMs;
      gmsTrendXMode = 'manual';
      loadGmsTrendHistory([...gmsTrendSelected]);
    });
  }

  // ── 폴링주기/시작/일시정지/정지 ──
  const pollIntervalInput = document.getElementById('trendPollIntervalInput');
  const runStartBtn = document.getElementById('trendRunStartBtn');
  const runPauseBtn = document.getElementById('trendRunPauseBtn');
  const runStopBtn = document.getElementById('trendRunStopBtn');
  if (runStartBtn && !runStartBtn.dataset.wired) {
    runStartBtn.dataset.wired = '1';
    runStartBtn.addEventListener('click', () => {
      gmsTrendPollIntervalMs = Number(pollIntervalInput?.value) || 1000;
      setGmsTrendRunStatus('running');
    });
  }
  if (runPauseBtn && !runPauseBtn.dataset.wired) {
    runPauseBtn.dataset.wired = '1';
    runPauseBtn.addEventListener('click', () => setGmsTrendRunStatus('paused'));
  }
  if (runStopBtn && !runStopBtn.dataset.wired) {
    runStopBtn.dataset.wired = '1';
    runStopBtn.addEventListener('click', () => setGmsTrendRunStatus('stopped'));
  }
  // 화면 재방문 시에도 버튼 disabled 상태를 현재 gmsTrendRunStatus와 맞춘다.
  if (runStartBtn) runStartBtn.disabled = gmsTrendRunStatus === 'running';
  if (runPauseBtn) runPauseBtn.disabled = gmsTrendRunStatus !== 'running';
  if (runStopBtn) runStopBtn.disabled = gmsTrendRunStatus === 'stopped';

  // ── 기록(시간별 값) Excel 내보내기/불러오기 - 서버의 범용 엔드포인트(/api/trend/history/*)를
  // 그대로 재사용한다(payload가 {timestamps, columns} 형태라 변수 정의와 무관하게 동작). ──
  const historyExportBtn = document.getElementById('trendHistoryExportBtn');
  if (historyExportBtn && !historyExportBtn.dataset.wired) {
    historyExportBtn.dataset.wired = '1';
    historyExportBtn.addEventListener('click', async () => {
      const payload = buildGmsTrendExportPayload();
      if (!payload) { toast('내보낼 기록이 없습니다. 먼저 시작해서 데이터를 모아주세요.', 'err'); return; }
      await fetchAndSave(
        '/api/trend/history/export',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
        `GMS_Trend_${Date.now()}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    });
  }
  const historyImportBtn = document.getElementById('trendHistoryImportBtn');
  const historyImportFile = document.getElementById('trendHistoryImportFile');
  if (historyImportBtn && !historyImportBtn.dataset.wired) {
    historyImportBtn.dataset.wired = '1';
    historyImportBtn.addEventListener('click', () => { historyImportFile.value = ''; historyImportFile.click(); });
  }
  if (historyImportFile && !historyImportFile.dataset.wired) {
    historyImportFile.dataset.wired = '1';
    historyImportFile.addEventListener('change', async () => {
      const file = historyImportFile.files && historyImportFile.files[0];
      if (!file) return;
      try {
        const fileBase64 = await fileToBase64(file);
        const res = await fetch('/api/trend/history/import', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileBase64 }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || '불러오기 실패');
        if (data.columns.length === 0) { toast('불러온 파일에 데이터가 없습니다.', 'err'); return; }
        // 내보내기 때 컬럼 라벨을 태그명 그대로 썼으므로(buildGmsTrendExportPayload) 그대로
        // gmsTrendSeries 키로 되돌려 채운다. 매칭 안 되는 라벨은 그냥 별도 키로 남는다.
        for (const tag of Object.keys(gmsTrendSeries)) delete gmsTrendSeries[tag];
        data.columns.forEach((c) => {
          gmsTrendSeries[c.label] = [];
          data.timestamps.forEach((t, i) => {
            const raw = c.values[i];
            const v = raw === '' || raw === undefined || raw === null ? null : Number(raw);
            if (v !== null && Number.isFinite(v)) gmsTrendSeries[c.label].push({ ts: t, value: v });
          });
        });
        if (data.timestamps.length > 0) {
          gmsTrendManualMin = data.timestamps[0];
          gmsTrendManualMax = data.timestamps[data.timestamps.length - 1];
          gmsTrendXMode = 'manual';
        }
        setGmsTrendRunStatus('stopped');
        if (gmsTrendDisplayMode === 'individual') rebuildGmsTrendMiniCards([...gmsTrendSelected]);
        drawGmsTrendChart();
        toast(`기록 ${data.timestamps.length}개 시점 불러옴`, 'ok');
      } catch (e) {
        toast('기록 불러오기 실패: ' + e.message, 'err');
      }
    });
  }
};
/** Operation.js의 trendBackBtn 핸들러가 부른다 - 캔버스를 숨기고 배관도(SVG)를 되돌린다. */
window.closeGmsTrend = function closeGmsTrend() {
  gmsTrendOpen = false;
  document.getElementById('gmsSvg').hidden = false;
  gmsTrendCanvas.hidden = true;
  gmsTrendMiniGrid.hidden = true;
  closeAllGmsTrendPopups();
  if (gmsTrendRedrawTimer) { clearInterval(gmsTrendRedrawTimer); gmsTrendRedrawTimer = null; }
};

// ── 밸브 개폐 요청 - 커스텀 확인 모달(브라우저 기본 confirm()은 동기 실행이라 떠 있는 동안
// 점멸 애니메이션이 멈춘다. 요청사항: 확인창이 떠 있는 동안 배관도화면+조작화면 양쪽에서
// 해당 밸브가 0.5초 간격 점멸)을 띄우고, 확인을 누르면 실제로 쓴다. ──
const valveConfirmModal = document.getElementById('valveConfirmModal');
const valveConfirmTitle = document.getElementById('valveConfirmTitle');
const valveConfirmMessage = document.getElementById('valveConfirmMessage');
let valveConfirmPendingTag = null;
let valveConfirmPendingValue = null;

// 배관도화면(SVG)과 조작화면(격자 버튼) 점멸을 CSS 애니메이션 두 개로 각각 따로 돌렸더니
// 시작 시점이 미묘하게 어긋나 동시에 안 움직이는 문제가 있었다. 하나의 JS 인터벌이 두
// 요소의 클래스를 같은 틱에서 동시에 토글하도록 바꿔서 완전히 동기화한다.
let valveBlinkTimer = null;
function setValveBlink(tag, on) {
  if (valveBlinkTimer) { clearInterval(valveBlinkTimer); valveBlinkTimer = null; }
  const svgEl = valveLayer.querySelector(`[data-tag="${CSS.escape(tag)}"]`);
  const gridBtns = document.querySelectorAll(`.valve-grid-btn[data-tag="${CSS.escape(tag)}"]`);
  if (!on) {
    if (svgEl) svgEl.classList.remove('blinking', 'blink-on');
    gridBtns.forEach((b) => b.classList.remove('blinking', 'blink-on'));
    return;
  }
  if (svgEl) svgEl.classList.add('blinking');
  gridBtns.forEach((b) => b.classList.add('blinking'));
  let phaseOn = true;
  const applyPhase = () => {
    if (svgEl) svgEl.classList.toggle('blink-on', phaseOn);
    gridBtns.forEach((b) => b.classList.toggle('blink-on', phaseOn));
  };
  applyPhase();
  valveBlinkTimer = setInterval(() => { phaseOn = !phaseOn; applyPhase(); }, 500);
}

/** 밸브 개폐 요청 - forceValue를 안 주면 현재 상태의 반대값으로 토글한다. */
function requestValveAction(tag, forceValue) {
  if (window.__gmsEditorActive) return; // 편집 모드에서는 클릭=선택이지 밸브 조작이 아니다
  if (!requireOperationMode('밸브 조작')) return;
  const v = valves.find((x) => x.tag === tag);
  if (!v) return;
  const cur = lastValueByTag[tag];
  const curOpen = cur ? (cur.fb === null || cur.fb === undefined ? cur.cmd : cur.fb) : false;
  const nextValue = forceValue !== undefined ? forceValue : !curOpen;
  valveConfirmPendingTag = tag;
  valveConfirmPendingValue = nextValue;
  // 히터 태그(M/H_A 등)는 밸브가 아니므로 확인 문구를 "VALVE OPEN/CLOSE"가 아니라
  // "히터 ON/OFF"로 다르게 보여준다(실제 개폐 로직은 동일, isHeaterTag()만 다르게 판단).
  const isHeater = isHeaterTag(tag);
  valveConfirmTitle.textContent = isHeater ? '히터 확인' : '밸브 확인';
  valveConfirmMessage.textContent = isHeater
    ? `${tag}${v.label ? ` (${v.label})` : ''} 히터를 ${nextValue ? 'ON' : 'OFF'} 하시겠습니까?`
    : `${tag}${v.label ? ` (${v.label})` : ''} VALVE를 ${nextValue ? 'OPEN' : 'CLOSE'} 하시겠습니까?`;
  setValveBlink(tag, true);
  valveConfirmModal.hidden = false;
}
document.getElementById('valveConfirmYesBtn').addEventListener('click', () => {
  const tag = valveConfirmPendingTag;
  const value = valveConfirmPendingValue;
  setValveBlink(tag, false);
  valveConfirmModal.hidden = true;
  fetch('/api/gms/valve/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag, value }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (!data.ok) { toast(`${tag} 쓰기 실패: ` + data.error, 'err'); return; }
      toast(`${tag} ${value ? 'OPEN' : 'CLOSE'} 명령 전송됨`, 'ok');
      // 실제 fb는 다음 폴링에서 갱신되지만, 폴링이 꺼져 있거나 주기가 길면 그때까지 화면이
      // 옛 상태 그대로 남아 있어서 "같은 밸브를 다시 눌러도 계속 OPEN하겠습니까만 나온다"는
      // 문제가 있었다. 쓰기 성공 즉시 낙관적으로 반영해 다음 클릭부터 방향이 바로 바뀌게 한다
      // (진짜 fb와 다르면 다음 폴링에서 자동으로 정정됨 - state-fault로 잠깐 보일 수 있음).
      applyGmsValues({ [tag]: { cmd: value, fb: value } });
    })
    .catch((e) => toast(`${tag} 쓰기 실패: ` + e.message, 'err'));
});
document.getElementById('valveConfirmNoBtn').addEventListener('click', () => {
  setValveBlink(valveConfirmPendingTag, false);
  valveConfirmModal.hidden = true;
});

function applyGmsValues(values) {
  for (const [tag, v] of Object.entries(values || {})) {
    lastValueByTag[tag] = v;
    const stateClass = valveStateClass(v);
    const g = valveLayer.querySelector(`[data-tag="${CSS.escape(tag)}"]`);
    if (g) {
      g.classList.remove('state-open', 'state-closed', 'state-fault', 'state-unknown');
      g.classList.add(stateClass);
      // 히터 아이콘이면 토글박스 글자(ON/OFF)도 상태에 맞춰 갱신한다.
      const toggleText = g.querySelector('.heater-toggle-text');
      if (toggleText) toggleText.textContent = stateClass === 'state-open' ? 'ON' : 'OFF';
    }
    // 수동밸브 조작 화면(조작화면)의 격자 버튼도 같은 상태 클래스를 반영한다.
    document.querySelectorAll(`.valve-grid-btn[data-tag="${CSS.escape(tag)}"]`).forEach((btn) => {
      btn.classList.remove('state-open', 'state-closed', 'state-fault', 'state-unknown');
      btn.classList.add(stateClass);
    });
  }
}

async function fetchValves() {
  try {
    const res = await fetch(`/api/gms/valves?unit=${encodeURIComponent(selectedUnitId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.valves)) {
        valves = data.valves;
        pts = data.pts || [];
        renderDiagram();
        renderPts();
        return;
      }
    }
  } catch (e) {}

  try {
    const res2 = await fetch(`data/gmsValves/${encodeURIComponent(selectedUnitId || 'unit1')}.json`);
    if (res2.ok) {
      const data2 = await res2.json();
      valves = data2.valves || [];
      pts = data2.pts || [];
      renderDiagram();
      renderPts();
      return;
    }
  } catch (e2) {}

  try {
    const res3 = await fetch('data/gmsValves/unit1.json');
    if (res3.ok) {
      const data3 = await res3.json();
      valves = data3.valves || [];
      pts = data3.pts || [];
      renderDiagram();
      renderPts();
    }
  } catch (e3) {}
}
fetchValves();

async function fillEquipmentInfo() {
  try {
    const res = await fetch('/api/gms/equipment');
    if (res.ok) {
      const data = await res.json();
      const eq = (data.equipment || []).find((e) => e.id === selectedUnitId);
      if (eq) {
        document.getElementById('eqGasName').textContent = eq.name || '-';
        document.getElementById('eqCode').textContent = eq.id || '-';
        return;
      }
    }
  } catch (e) {}

  try {
    const res2 = await fetch('data/gmsEquipment.json');
    if (res2.ok) {
      const data2 = await res2.json();
      const eq2 = (data2.equipment || []).find((e) => e.id === selectedUnitId);
      if (eq2) {
        document.getElementById('eqGasName').textContent = eq2.name || '-';
        document.getElementById('eqCode').textContent = eq2.id || '-';
        return;
      }
    }
  } catch (e2) {}

  document.getElementById('eqGasName').textContent = 'GMS Unit #1 (M16 GC)';
  document.getElementById('eqCode').textContent = 'unit1';
}
fillEquipmentInfo();

// ── 우측 패널 탭 전환(CONFIG/OPTION/ALARM/SHUT-DOWN) - ROOM은 탭이 아니라 장비 선택
// 화면으로 이동하는 링크라 별도 처리 없음(<a href>). ──
const tabSwitchBtns = document.querySelectorAll('.tab-switch-btn[data-tab]');
const tabPanels = document.querySelectorAll('.tab-panel[data-tab-panel]');
tabSwitchBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabSwitchBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    tabPanels.forEach((p) => { p.hidden = p.dataset.tabPanel !== btn.dataset.tab; });
    // "진행 메뉴" 탭이 아닌 다른 탭(CONFIG/OPTION/ALARM/USER/SHUT-DOWN)으로 넘어가면
    // 작업이력 화면의 "배관도 숨김 + 전체 폭" 상태를 되돌린다 - 이 탭들은
    // showProgressScreen()을 거치지 않고 여기서 바로 화면을 바꾸므로, 그 함수에 둔
    // 자동 복원(작업이력이 아닌 다른 progressScreens로 넘어갈 때 되돌리는 로직)이 미치지
    // 않는다.
    if (btn.dataset.tab !== 'progress' && window.setWorkLogFullWidth) window.setWorkLogFullWidth(false);
    // USER 탭은 기본 hidden이라 처음 열 때만 Univer 그리드를 마운트한다(hidden 컨테이너에
    // 마운트하면 크기가 0이 되므로) - gms-user-widget.js가 mounted 플래그로 중복 마운트를
    // 막아주니 클릭할 때마다 불러도 안전하다. hidden 해제 직후 바로 마운트하면 브라우저가
    // 아직 레이아웃을 다시 계산하기 전이라(hidden→visible 반영 전) Univer가 컨테이너
    // 크기를 0에 가깝게 읽어서 그리드가 작게 굳어버리는 문제가 있었다 - offsetHeight를
    // 한 번 읽어 강제로 리플로우시킨 뒤, 그 다음 프레임에 마운트해서 실제 레이아웃이
    // 반영된 크기를 읽도록 한다.
    if (btn.dataset.tab === 'user') {
      const container = document.getElementById('gmsUserGridContainer');
      void container.offsetHeight; // 강제 리플로우
      // requestAnimationFrame은 브라우저 탭이 백그라운드(비가시 상태)일 때 아예 실행이
      // 미뤄질 수 있어(가시 탭에서는 문제없지만) setTimeout(0)을 대신 쓴다 - 리플로우는
      // 이미 위에서 동기로 강제했으니 다음 매크로태스크에서 마운트하면 충분하다.
      loadGmsWidgetModule('user', './gms-user-grid/gms-user-widget.js').then(() => {
        setTimeout(() => window.initGmsUserGrid('gmsUserGridContainer'), 0);
      });
    }
  });
});

/** Item/Status 예시 그리드 행을 만든다 - 실제 항목/값은 후속 작업에서 Univer 그리드로 교체 예정. */
function fillPlaceholderGrid(tbodyId, rows) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = rows.map(([item, status]) =>
    `<tr><td>${item}</td><td style="color:var(--muted);">${status}</td></tr>`
  ).join('');
}
fillPlaceholderGrid('alarmTableBody', [
  ['예시 알람 1', '정상'], ['예시 알람 2', '정상'], ['예시 알람 3', '정상'],
]);

// ── 옵션 그리드 - "수동조작 상태 유지 옵션": 수동밸브 조작 화면에서 "취소"를 누를 때
// 열린 밸브/히터가 있으면 매번 유지/CLOSE를 묻던 것을, 이 옵션을 "적용"으로 켜두면 묻지
// 않고 항상 상태를 그대로 유지한 채 나가게 한다("미적용"이면 기존처럼 매번 확인).
// On/Off 대신 적용/미적용으로 표시하고, status 칸의 버튼을 누를 때마다 뒤집힌다(인버터). ──
let manualStateHoldOption = false;
try { manualStateHoldOption = localStorage.getItem('gmsManualStateHoldOption') === '1'; } catch (e) { /* 무시 */ }

// ── "VT 사용 옵션": 실린더 교환 자동 진행 중 -L(감압시험) 다음에 -VT(VT 감압시험, 고진공
// Pumping) 단계를 거칠지 여부. "적용"이면 -VT를 거쳐 2P로, "미적용"이면 -L에서 바로 2P로
// 넘어간다(Operation.js의 exchangePressureTestRunBtn 참고). 교환전 조작화면 전체의 -VT
// 배지(.step-badge-lg[data-vt-badge])도 이 옵션에 맞춰 보이거나 숨겨진다. ──
let vtUseOption = false;
try { vtUseOption = localStorage.getItem('gmsVtUseOption') === '1'; } catch (e) { /* 무시 */ }
function applyVtBadgeVisibility() {
  document.querySelectorAll('.step-badge-lg[data-vt-badge]').forEach((el) => {
    el.style.display = vtUseOption ? '' : 'none';
  });
}

// ── "조정모드 시퀀스 1" 옵션: 서브시퀀스 엑셀의 Alarm Monitoring 열에서 예약 태그
// "조정모드시퀀스1"로 참조하는 ON/OFF 스위치(public/gms-sub-sequence-runner.js의
// SUB_SEQ_OPTION_TAGS 참고) - PLC 신호가 아니라 이 화면에서 조작자가 직접 켜고 끄는 값이다.
// 그 스위치를 참조하는 Step에서 "적용"(ON)이면 조건이 참으로 평가되어 Next Step으로,
// "미적용"(OFF)이면 거짓으로 평가되어 Alarm Goto(있으면 가벼운 이동)로 분기한다 - 예:
// AdjustMode_v1의 Step "7A"(진공 조건을 확인하는 Step 7 바로 다음)가 이 옵션을 참조해 켜져
// 있으면 Step 14로, 꺼져 있으면 평소처럼 Step 8로 진행한다(Step 데이터의 remarks 참고). ──
let adjustSeq1Option = false;
try { adjustSeq1Option = localStorage.getItem('gmsAdjustSeq1Option') === '1'; } catch (e) { /* 무시 */ }

// ── "Bypass 사용 옵션": 용기교체(CC) 완료 후 Status "Bypass" 화면(배관 By-pass 체크)이
// 실제로 동작할지 여부. "적용"이면 Bypass 시퀀스(1P_2차측Purge 진행 → HPIV 또는 PNBV+PIV →
// NPT/HPT 진공 유지 확인)를 실제로 거친 뒤 3P로, "미적용"이면 CYLINDER_STEP_ORDER에서
// Bypass Status 자체를 건너뛴다(-VT/vtUseOption과 동일한 런타임 스킵 패턴,
// Operation.js의 nextStatusIndexAfter 참고). +L(가압시험) 화면도 이 옵션을 그대로 참조해서
// Bypass가 이미 HPIV/PGII를 열어뒀는지 여부에 따라 시작 지점이 갈린다(TASK.md 2026-08-09
// 지시 참고). ──
let bypassUseOption = false;
try { bypassUseOption = localStorage.getItem('gmsBypassUseOption') === '1'; } catch (e) { /* 무시 */ }

// ── "고압 HE Leak check 라인 유무 옵션": Bypass 시퀀스 진행 중 밸브 분기 - "적용"이면
// HPIV(고압 He Leak check 라인)를 열고, "미적용"이면 PNBV→PIV 순서로 연다(TASK.md
// 2026-08-09 지시). ──
let highPressureHeLeakCheckOption = false;
try { highPressureHeLeakCheckOption = localStorage.getItem('gmsHighPressureHeLeakCheckOption') === '1'; } catch (e) { /* 무시 */ }

// ── "가압시험 완료후 Puls Vent 옵션": +L(가압시험) 시퀀스가 정상 완료된 뒤, 다음 Status
// (4P 또는 -VT)로 넘어가기 전에 Puls Vent 서브시퀀스(ns='puls', Puls_v1.json)를 한 번 더
// 거칠지 여부(TASK.md 2026-08-09 지시). ──
let postPressureTestPulseVentOption = false;
try { postPressureTestPulseVentOption = localStorage.getItem('gmsPostPressureTestPulseVentOption') === '1'; } catch (e) { /* 무시 */ }

// ── "1P 서브시퀀스 사용 여부" 옵션 - 실린더 교환 자동 진행 중 Status "1P" 구간을 이루는
// 4개 화면(1-2차측 Vent Mode/2차측 Purge/Pumping/1차측 Purge, Operation.js의
// CYL_EXCHANGE_PURGE_STEPS 키와 동일)을 각각 켜고 끌 수 있다. "적용"된 것만 정해진 순서
// 그대로 이어져서 진행하고, "미적용"은 건너뛴다(밸브/타이머 없이 화면 자체가 안 뜬다) -
// Operation.js의 firstEnabledOnePStageKey/nextEnabledOnePStageKey가 이 값을 참조해
// 다음 진입 화면을 계산한다. PASSWORD_GATE_DEFS와 동일하게 localStorage 기반(기본값 전부
// "적용" - 기존 4단계 전체 진행 동작과 동일하게 유지). ──
const ONE_P_SUBSEQ_DEFS = [
  { key: 'onePAutoRun', label: '1-2차측 Vent Mode', storageKey: 'gmsOneP_onePAutoRun_UseOption' },
  { key: 'onePPurgeAutoRun', label: '2차측 Purge', storageKey: 'gmsOneP_onePPurgeAutoRun_UseOption' },
  { key: 'onePPumpingAutoRun', label: 'Pumping', storageKey: 'gmsOneP_onePPumpingAutoRun_UseOption' },
  { key: 'onePPrimaryPurgeAutoRun', label: '1차측 Purge', storageKey: 'gmsOneP_onePPrimaryPurgeAutoRun_UseOption' },
];
const onePSubseqOptions = {};
ONE_P_SUBSEQ_DEFS.forEach((def) => {
  let v = true; // 기본값 "적용"
  try {
    const stored = localStorage.getItem(def.storageKey);
    if (stored !== null) v = stored === '1';
  } catch (e) { /* 무시 */ }
  onePSubseqOptions[def.key] = v;
});
/** Operation.js가 1P 구간 진입/체이닝 시점에 이 화면(key)이 켜져 있는지 물을 때 쓴다. */
function onePSubseqEnabled(key) {
  return onePSubseqOptions[key] !== false;
}

// ── 조작화면에서 PASSWORD를 묻는 지점 전체(진입/진행 지점 + 취소 재확인 지점) - 지점마다
// 개별로 "적용"(현재처럼 PASSWORD 확인 후 진행)/"미적용"(PASSWORD 없이 바로 다음 동작으로
// 진행)을 켜고 끌 수 있다. key는 Operation.js의 passwordCancelTarget 값과 그대로
// 대응한다(passwordGateEnabled(key), proceedPastPasswordGate() 참고). ──
const PASSWORD_GATE_DEFS = [
  { key: 'mainMenu', label: '유지보수 진입 비밀번호', storageKey: 'gmsPwGateMainMenu' },
  { key: 'cylinderExchange', label: '실린더 교환 진입 비밀번호', storageKey: 'gmsPwGateCylinderExchange' },
  { key: 'cylinderExchangeDone', label: '용기교체 진입 비밀번호', storageKey: 'gmsPwGateCylinderExchangeDone' },
  { key: 'cylReplaceDone', label: '교환후 진입 비밀번호', storageKey: 'gmsPwGateCylReplaceDone' },
  { key: 'exchangeFourthPurgeDone', label: '퍼지완료 진입 비밀번호', storageKey: 'gmsPwGateExchangeFourthPurgeDone' },
  { key: 'manualValve', label: '수동밸브 조작 취소 비밀번호', storageKey: 'gmsPwGateManualValve' },
  { key: 'heater', label: '히터 조작 취소 비밀번호', storageKey: 'gmsPwGateHeater' },
  { key: 'cylinderLockCheck', label: '교환전 취소 비밀번호', storageKey: 'gmsPwGateCylinderLockCheck' },
  { key: 'cylReplace', label: '용기교체 취소 비밀번호', storageKey: 'gmsPwGateCylReplace' },
  { key: 'exchangeAfterCancel', label: '교환후 취소 비밀번호', storageKey: 'gmsPwGateExchangeAfterCancel' },
  { key: 'postPcCancel', label: '퍼지완료 이후 취소 비밀번호', storageKey: 'gmsPwGatePostPcCancel' },
  { key: 'statusJump', label: 'Status Jump 비밀번호', storageKey: 'gmsPwGateStatusJump' },
  { key: 'gasSupplyEntry', label: '가스공급 진입 비밀번호', storageKey: 'gmsPwGateGasSupplyEntry' },
  { key: 'gasSupplyPauseEntry', label: '일시정지 진입 비밀번호', storageKey: 'gmsPwGateGasSupplyPauseEntry' },
  { key: 'gasSupplyStopEntry', label: '공급중지 진입 비밀번호', storageKey: 'gmsPwGateGasSupplyStopEntry' },
  { key: 'gasSupplyForceChangeEntry', label: '강제교체 진입 비밀번호', storageKey: 'gmsPwGateGasSupplyForceChangeEntry' },
  { key: 'adjustMode', label: '조정모드 진입 비밀번호', storageKey: 'gmsPwGateAdjustMode' },
  { key: 'lineVent', label: 'Line Vent 진입 비밀번호', storageKey: 'gmsPwGateLineVent' },
  { key: 'auxMaintenanceMode', label: '보조메뉴 유지보수모드 진입 비밀번호', storageKey: 'gmsPwGateAuxMaintenanceMode' },
];
const passwordGateOptions = {};
PASSWORD_GATE_DEFS.forEach((def) => {
  let v = true; // 기본값 "적용" - 기존 동작(항상 PASSWORD 확인)과 동일하게 유지.
  try {
    const stored = localStorage.getItem(def.storageKey);
    if (stored !== null) v = stored === '1';
  } catch (e) { /* 무시 */ }
  passwordGateOptions[def.key] = v;
});
/** Operation.js가 각 진입 지점에서 PASSWORD를 물을지 판단할 때 쓴다. */
function passwordGateEnabled(key) {
  return passwordGateOptions[key] !== false;
}

// ── "GC Type 옵션": 2B2P(적용)면 A/B 양측이 각자 독립적으로 가스공급을 만들 수 있다(기존
// 동작 - 포트가 두 개라는 뜻). 2B1P(미적용)면 포트가 하나뿐이라는 뜻이라, 가스공급준비
// 완료 화면의 "확인"을 눌렀을 때 반대 측이 이미 가스공급 중(Service)이면 이 측은 진행하지
// 못하고 조작화면이 반대 측 가스공급 화면으로 바뀐다(Operation.js의
// gasSupplyReadyConfirmBtn 참고). 다른 옵션들과 달리 버튼 글자 자체가 적용/미적용이
// 아니라 모드 이름(2B2P/2B1P)이다. ──
let gcTypeOption = true; // 기본값 2B2P(적용) - 기존 동작(양측 모두 독립적으로 가능)과 동일하게 유지.
try {
  const storedGcType = localStorage.getItem('gmsGcTypeOption');
  if (storedGcType !== null) gcTypeOption = storedGcType === '1';
} catch (e) { /* 무시 */ }

// ── Main 시퀀스(CYLINDER STEP STATUS) 순서/적용 - GMS관련 사진/Main Sequence.csv의 16행을
// 기본값으로 삼는 15개 고유 타입(대표심볼 기준, -VT는 교환전/교환후 공용 타입 하나). 순서
// 자체(같은 타입 중복 포함)와 타입별 적용/미적용은 여러 사람이 봐야 하는 설비 설정이라
// PASSWORD_GATE_DEFS처럼 localStorage가 아니라 서버(/api/gms/main-sequence)에 저장한다 -
// mainSequenceOrder/mainSequenceEnabledTypes는 loadMainSequenceConfig()가 채운다.
// gms-sequence-editor.js(별도 파일)가 이 상태를 드래그 편집 UI로 노출한다. ──
const MAIN_SEQUENCE_TYPE_DEFS = [
  { type: 'IDLE', korLabel: '준비전', engLabel: 'IDLE' },
  { type: 'Puls', korLabel: '잔류가스 제거(Puls Vent)', engLabel: 'Removal Gas' },
  { type: '1P', korLabel: '교환전 1차 배관 청소', engLabel: '1ST PRE PURGE' },
  { type: '-L', korLabel: '교환전 PT 감압 시험', engLabel: 'PT PRE VACUUM DECAY CHECK' },
  { type: '-VT', korLabel: 'VT 감압 시험(교환전/교환후 공용)', engLabel: 'VT-LEAK CHECK' },
  { type: '2P', korLabel: '교환전 2차 배관 청소', engLabel: '2ND PRE PURGE' },
  { type: 'CC', korLabel: '실린더 교체', engLabel: 'CYLINDER CHANGE' },
  { type: 'Bypass', korLabel: '배관 By-pass 체크', engLabel: 'Part By-pass check' },
  { type: '+L', korLabel: '교환후 가압 시험', engLabel: 'POST PRESSURE DECAY CHECK' },
  { type: '3P', korLabel: '교환후 1차 배관 청소', engLabel: '1ST POST PURGE' },
  { type: '4P', korLabel: '교환후 2차 배관 청소', engLabel: '2ND POST PURGE' },
  { type: 'PC', korLabel: '퍼지 완료', engLabel: 'PURGE COMPLETE' },
  { type: 'RGV', korLabel: 'Real Gas Vent', engLabel: 'PROCESS GAS VENT' },
  { type: 'GSP', korLabel: '가스공급 진행', engLabel: 'GAS SUPPLY PREPARATION' },
  { type: 'READY', korLabel: '공급 준비', engLabel: 'STANDBY' },
  { type: 'Service', korLabel: '가스 공급', engLabel: 'GAS SUPPLY' },
];
let mainSequenceOrder = []; // [{id, type}, ...] - 서버에서 로드되기 전까지 비어있다.
let mainSequenceEnabledTypes = {}; // { [type]: boolean }
/** Operation.js가 CYLINDER_STEP_ORDER를 다시 계산할 때 부른다 - 여기 정의하지 않고
    Operation.js에 두는 이유는 CYLINDER_STEP_ORDER/cylinderCurrentStepIndex 등 관련 상태가
    전부 그 파일에 있기 때문(gms.js는 순서 "데이터"만 들고 있는다). */
async function loadMainSequenceConfig() {
  try {
    const res = await fetch('/api/gms/main-sequence');
    const data = await res.json();
    if (data.ok) {
      mainSequenceOrder = data.order;
      mainSequenceEnabledTypes = data.enabledTypes;
    }
  } catch (e) { /* 실패해도 Operation.js가 하드코딩 기본값으로 폴백한다 */ }
  if (window.rebuildCylinderStepOrder) window.rebuildCylinderStepOrder();
}
loadMainSequenceConfig();

// ── PT/Weight 아날로그 교정(캘리브레이션) 데이터 - "조정모드 > 압력조정" 화면
// (public/gms-pt-calibration.js)이 편집한다. 서버(data/gmsPtCalibration.json)에 저장 -
// mainSequenceOrder와 동일한 이유로 localStorage가 아니라 서버에 둔다(설비 사양). ──
let ptCalibrationRows = [];
async function loadPtCalibrationConfig() {
  try {
    const res = await fetch('/api/gms/pt-calibration');
    const data = await res.json();
    if (data.ok) ptCalibrationRows = data.rows;
  } catch (e) { /* 실패해도 gms-pt-calibration.js가 빈 배열로 시작해서 재시도 가능 */ }
}
loadPtCalibrationConfig();

// ── PT/Weight/Heater 사용 옵션(OPTION 탭) - 미적용 태그는 배관도/PT 교정 표/TREND 태그
// 목록/히터 조작 화면에서 전부 제외된다(요청사항). PT 교정과 동일한 이유로 서버에 저장
// (data/gmsAnalogEnableConfig.json). 태그 목록을 아직 못 불러온 시작 시점에는 전부 사용
// 중인 것으로 본다(기본값 true) - 그래야 데이터 로드가 늦어도 기존 화면이 갑자기 텅 비어
// 보이는 일이 없다. ──
let analogEnableConfig = [];
// tag('M/H_A' 등)에 '/' 등 CSS id로 쓰기 애매한 문자가 있어 DOM id 생성용으로 치환한다.
function analogEnableDomId(tag) {
  return tag.replace(/[^A-Za-z0-9_]/g, '_');
}
async function loadAnalogEnableConfig() {
  try {
    const res = await fetch('/api/gms/analog-enable');
    const data = await res.json();
    if (data.ok) analogEnableConfig = data.rows;
  } catch (e) { /* 실패해도 기본값(전부 사용)으로 계속 동작 */ }
  // 이 설정은 배관도/PT 표/TREND 목록이 이미 다른(더 빠른) 타이밍에 한 번 그려진 뒤에
  // 도착할 수 있으므로, 도착 즉시 다시 그려서 반영한다.
  if (typeof renderDiagram === 'function' && typeof renderPts === 'function' && valves.length) {
    renderDiagram();
    renderPts();
  }
  if (typeof populateGmsTrendTagList === 'function') populateGmsTrendTagList();
  // OPTION 탭 표는 이 fetch보다 먼저 그려질 수 있으므로(빈 목록 상태로), 도착하면 다시 그린다.
  if (typeof renderOptionTable === 'function') renderOptionTable();
}
loadAnalogEnableConfig();
/** tag가 OPTION 탭에서 "적용"(사용) 상태인지 - 아직 설정을 모르는 태그(목록에 없음)는
    기본으로 사용 중인 것으로 본다(신규 태그가 이유 없이 사라지지 않도록 - 안전한 기본값). */
function isAnalogTagEnabled(tag) {
  const row = analogEnableConfig.find((r) => r.tag === tag);
  return !row || row.enabled !== false;
}
window.isAnalogTagEnabled = isAnalogTagEnabled;

// ── 설정모드 A/B 화면(그리드+키패드)의 "옵션" 열이 참조하는 레지스트리 - 새 옵션 목록을 따로
// 만들지 않고 이미 OPTION 탭에 있는 토글들을 문자열 키로 그대로 조회한다(요청사항: "기존
// OPTION 토글 재사용"). SUB_SEQ_OPTION_TAGS(gms-sub-sequence-runner.js)와 같은 "키 → getter"
// 레지스트리 패턴 - 새 토글이 생기면 이 표에 한 줄만 추가하면 된다. 설정값 행의 `option` 필드가
// 여기 없는 키를 가리키면(오타 등) 안전하게 "항상 표시"로 처리한다(다른 옵션 매칭 실패 시의
// 관례와 동일 - 조용히 숨어버리는 것보다 낫다). ──
const CONFIG_OPTION_LOOKUP = {
  '수동조작상태유지': () => manualStateHoldOption,
  'VT사용': () => vtUseOption,
  '조정모드시퀀스1': () => adjustSeq1Option,
  'GCType2B2P': () => gcTypeOption,
  'Bypass사용': () => bypassUseOption,
  '고압HELeakCheck': () => highPressureHeLeakCheckOption,
  '가압시험후PulsVent': () => postPressureTestPulseVentOption,
};
function isConfigOptionVisible(optionKey) {
  const key = String(optionKey || '').trim();
  if (!key) return true; // 옵션 미지정 - 항상 표시
  if (CONFIG_OPTION_LOOKUP[key]) return !!CONFIG_OPTION_LOOKUP[key]();
  if (typeof passwordGateEnabled === 'function' && PASSWORD_GATE_DEFS.some((d) => d.key === key)) {
    return passwordGateEnabled(key);
  }
  if (typeof isAnalogTagEnabled === 'function' && analogEnableConfig.some((r) => r.tag === key)) {
    return isAnalogTagEnabled(key);
  }
  return true; // 알 수 없는 키 - 조용히 숨기지 않고 표시
}
window.isConfigOptionVisible = isConfigOptionVisible;

// ── USER 등록(작업자 계정) 목록 - PASSWORD 화면(Operation.js)이 입력한 4자리를 여기서
// 찾아서 인증한다("작업자 100명이 각자 Password를 쓸 수 있도록"의 실제 연동). USER 탭의
// Univer 그리드(gms-user-widget.js)가 저장하면 이 목록도 다시 불러와야 방금 등록한 계정이
// 바로 인증에 반영된다 - saveUsers 성공 시 gms-user-widget.js가 이 함수를 호출한다. ──
let gmsUsersList = [];
async function loadGmsUsersConfig() {
  try {
    const res = await fetch('/api/gms/users');
    const data = await res.json();
    if (data.ok) gmsUsersList = data.users;
  } catch (e) { /* 실패해도 기존 목록(또는 빈 배열)으로 유지, 재시도 가능 */ }
}
loadGmsUsersConfig();
window.reloadGmsUsersConfig = loadGmsUsersConfig;

// ── 작업이력 메시지 설정 - Operation.js의 logWorkAction(buttonId, side)이 버튼ID로 이
// 목록에서 표시 문구를 찾는다("USER 탭"의 계정 목록과 동일한 로드 패턴). ──
let workLogMessages = [];
async function loadWorkLogMessagesConfig() {
  try {
    const res = await fetch('/api/gms/worklog-messages');
    const data = await res.json();
    if (data.ok) workLogMessages = data.messages;
  } catch (e) { /* 실패해도 buttonId를 그대로 문구로 써서 동작은 계속된다 */ }
}
loadWorkLogMessagesConfig();
window.reloadWorkLogMessagesConfig = loadWorkLogMessagesConfig;

// ── 화면 제목 설정 - "작업이력" 그리드 A열("HTML화면")에 찍히는 문구. Operation.js의
// showProgressScreen(screenKey, 제목) 호출들이 하드코딩 대신 screenTitleFor()로 이 목록을
// 조회한다(작업이력 메시지 설정과 동일한 엑셀 편집 패턴 - "화면 제목 설정" 화면 참고). ──
let screenTitles = [];
async function loadScreenTitlesConfig() {
  try {
    const res = await fetch('/api/gms/screen-titles');
    const data = await res.json();
    if (data.ok) screenTitles = data.titles;
  } catch (e) { /* 실패해도 각 화면의 기본 문구(하드코딩된 fallback)로 계속 동작한다 */ }
}
loadScreenTitlesConfig();
window.reloadScreenTitlesConfig = loadScreenTitlesConfig;

function renderOptionTable() {
  const tbody = document.getElementById('optionTableBody');
  tbody.innerHTML = '<tr><td>수동조작 상태 유지 옵션</td>'
    + '<td><button type="button" id="manualStateHoldToggleBtn" style="font-size:12px;padding:3px 10px;"></button></td></tr>'
    + '<tr><td>VT 사용 옵션</td>'
    + '<td><button type="button" id="vtUseToggleBtn" style="font-size:12px;padding:3px 10px;"></button></td></tr>'
    + '<tr><td>GC Type</td>'
    + '<td><button type="button" id="gcTypeToggleBtn" style="font-size:12px;padding:3px 10px;"></button></td></tr>'
    + '<tr><td>조정모드 시퀀스 1 (서브시퀀스 Step 7A 분기용)</td>'
    + '<td><button type="button" id="adjustSeq1ToggleBtn" style="font-size:12px;padding:3px 10px;"></button></td></tr>'
    + '<tr><td>Bypass 사용 옵션 (배관 By-pass 체크 Status)</td>'
    + '<td><button type="button" id="bypassUseToggleBtn" style="font-size:12px;padding:3px 10px;"></button></td></tr>'
    + '<tr><td>고압 HE Leak check 라인 유무 (Bypass 밸브 분기)</td>'
    + '<td><button type="button" id="highPressureHeLeakCheckToggleBtn" style="font-size:12px;padding:3px 10px;"></button></td></tr>'
    + '<tr><td>가압시험 완료후 Puls Vent</td>'
    + '<td><button type="button" id="postPressureTestPulseVentToggleBtn" style="font-size:12px;padding:3px 10px;"></button></td></tr>'
    + '<tr><td>Main 시퀀스 순서</td>'
    + '<td><button type="button" id="mainSequenceEditBtn" class="primary" style="font-size:12px;padding:3px 10px;">편집</button></td></tr>'
    + PASSWORD_GATE_DEFS.map((def) => `<tr><td>${def.label}</td>`
      + `<td><button type="button" id="pwGateToggleBtn_${def.key}" data-gate-key="${def.key}" style="font-size:12px;padding:3px 10px;"></button></td></tr>`).join('')
    + '<tr><td colspan="2" style="text-align:left;padding-top:10px;font-weight:bold;">1P 서브시퀀스 사용 여부(적용된 것만 순서대로 진행)</td></tr>'
    + ONE_P_SUBSEQ_DEFS.map((def) => `<tr><td>${def.label}</td>`
      + `<td><button type="button" id="onePSubseqToggleBtn_${def.key}" data-onep-key="${def.key}" style="font-size:12px;padding:3px 10px;"></button></td></tr>`).join('')
    + '<tr><td colspan="2" style="text-align:left;padding-top:10px;font-weight:bold;">아날로그 채널 사용 여부 (PT/Weight/Heater)</td></tr>'
    + analogEnableConfig.map((row) => `<tr><td>${row.tag} (${row.category})</td>`
      + `<td><button type="button" id="analogEnableToggleBtn_${analogEnableDomId(row.tag)}" data-tag="${row.tag}" style="font-size:12px;padding:3px 10px;"></button></td></tr>`).join('');
  document.getElementById('mainSequenceEditBtn').addEventListener('click', () => {
    if (window.openMainSequenceEditor) window.openMainSequenceEditor();
  });
  const btn = document.getElementById('manualStateHoldToggleBtn');
  const syncBtn = () => {
    btn.textContent = manualStateHoldOption ? '적용' : '미적용';
    btn.classList.toggle('primary', manualStateHoldOption);
  };
  syncBtn();
  btn.addEventListener('click', () => {
    manualStateHoldOption = !manualStateHoldOption;
    try { localStorage.setItem('gmsManualStateHoldOption', manualStateHoldOption ? '1' : '0'); } catch (e) { /* 무시 */ }
    syncBtn();
  });

  const vtBtn = document.getElementById('vtUseToggleBtn');
  const syncVtBtn = () => {
    vtBtn.textContent = vtUseOption ? '적용' : '미적용';
    vtBtn.classList.toggle('primary', vtUseOption);
  };
  syncVtBtn();
  vtBtn.addEventListener('click', () => {
    vtUseOption = !vtUseOption;
    try { localStorage.setItem('gmsVtUseOption', vtUseOption ? '1' : '0'); } catch (e) { /* 무시 */ }
    syncVtBtn();
    applyVtBadgeVisibility();
  });

  const gcTypeBtn = document.getElementById('gcTypeToggleBtn');
  const syncGcTypeBtn = () => {
    gcTypeBtn.textContent = gcTypeOption ? '2B2P' : '2B1P';
    gcTypeBtn.classList.toggle('primary', gcTypeOption);
  };
  syncGcTypeBtn();
  gcTypeBtn.addEventListener('click', () => {
    gcTypeOption = !gcTypeOption;
    try { localStorage.setItem('gmsGcTypeOption', gcTypeOption ? '1' : '0'); } catch (e) { /* 무시 */ }
    syncGcTypeBtn();
  });

  const adjustSeq1Btn = document.getElementById('adjustSeq1ToggleBtn');
  const syncAdjustSeq1Btn = () => {
    adjustSeq1Btn.textContent = adjustSeq1Option ? '적용' : '미적용';
    adjustSeq1Btn.classList.toggle('primary', adjustSeq1Option);
  };
  syncAdjustSeq1Btn();
  adjustSeq1Btn.addEventListener('click', () => {
    adjustSeq1Option = !adjustSeq1Option;
    try { localStorage.setItem('gmsAdjustSeq1Option', adjustSeq1Option ? '1' : '0'); } catch (e) { /* 무시 */ }
    syncAdjustSeq1Btn();
  });

  const bypassUseBtn = document.getElementById('bypassUseToggleBtn');
  const syncBypassUseBtn = () => {
    bypassUseBtn.textContent = bypassUseOption ? '적용' : '미적용';
    bypassUseBtn.classList.toggle('primary', bypassUseOption);
  };
  syncBypassUseBtn();
  bypassUseBtn.addEventListener('click', () => {
    bypassUseOption = !bypassUseOption;
    try { localStorage.setItem('gmsBypassUseOption', bypassUseOption ? '1' : '0'); } catch (e) { /* 무시 */ }
    syncBypassUseBtn();
  });

  const heLeakBtn = document.getElementById('highPressureHeLeakCheckToggleBtn');
  const syncHeLeakBtn = () => {
    heLeakBtn.textContent = highPressureHeLeakCheckOption ? '적용' : '미적용';
    heLeakBtn.classList.toggle('primary', highPressureHeLeakCheckOption);
  };
  syncHeLeakBtn();
  heLeakBtn.addEventListener('click', () => {
    highPressureHeLeakCheckOption = !highPressureHeLeakCheckOption;
    try { localStorage.setItem('gmsHighPressureHeLeakCheckOption', highPressureHeLeakCheckOption ? '1' : '0'); } catch (e) { /* 무시 */ }
    syncHeLeakBtn();
  });

  const postPtPulseVentBtn = document.getElementById('postPressureTestPulseVentToggleBtn');
  const syncPostPtPulseVentBtn = () => {
    postPtPulseVentBtn.textContent = postPressureTestPulseVentOption ? '적용' : '미적용';
    postPtPulseVentBtn.classList.toggle('primary', postPressureTestPulseVentOption);
  };
  syncPostPtPulseVentBtn();
  postPtPulseVentBtn.addEventListener('click', () => {
    postPressureTestPulseVentOption = !postPressureTestPulseVentOption;
    try { localStorage.setItem('gmsPostPressureTestPulseVentOption', postPressureTestPulseVentOption ? '1' : '0'); } catch (e) { /* 무시 */ }
    syncPostPtPulseVentBtn();
  });

  ONE_P_SUBSEQ_DEFS.forEach((def) => {
    const onePBtn = document.getElementById(`onePSubseqToggleBtn_${def.key}`);
    const syncOnePBtn = () => {
      onePBtn.textContent = onePSubseqOptions[def.key] ? '적용' : '미적용';
      onePBtn.classList.toggle('primary', onePSubseqOptions[def.key]);
    };
    syncOnePBtn();
    onePBtn.addEventListener('click', () => {
      onePSubseqOptions[def.key] = !onePSubseqOptions[def.key];
      try { localStorage.setItem(def.storageKey, onePSubseqOptions[def.key] ? '1' : '0'); } catch (e) { /* 무시 */ }
      syncOnePBtn();
    });
  });

  PASSWORD_GATE_DEFS.forEach((def) => {
    const gateBtn = document.getElementById(`pwGateToggleBtn_${def.key}`);
    const syncGateBtn = () => {
      gateBtn.textContent = passwordGateOptions[def.key] ? '적용' : '미적용';
      gateBtn.classList.toggle('primary', passwordGateOptions[def.key]);
    };
    syncGateBtn();
    gateBtn.addEventListener('click', () => {
      passwordGateOptions[def.key] = !passwordGateOptions[def.key];
      try { localStorage.setItem(def.storageKey, passwordGateOptions[def.key] ? '1' : '0'); } catch (e) { /* 무시 */ }
      syncGateBtn();
    });
  });

  analogEnableConfig.forEach((row) => {
    const rowBtn = document.getElementById(`analogEnableToggleBtn_${analogEnableDomId(row.tag)}`);
    const syncRowBtn = () => {
      rowBtn.textContent = row.enabled !== false ? '적용' : '미적용';
      rowBtn.classList.toggle('primary', row.enabled !== false);
    };
    syncRowBtn();
    rowBtn.addEventListener('click', async () => {
      const prevEnabled = row.enabled;
      row.enabled = row.enabled === false;
      syncRowBtn();
      try {
        const res = await fetch('/api/gms/analog-enable', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: analogEnableConfig }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || '저장 실패');
        toast(`${row.tag} ${row.enabled !== false ? '적용' : '미적용'}으로 저장됨`, 'ok');
        if (typeof renderDiagram === 'function') renderDiagram();
        if (typeof renderPts === 'function') renderPts();
        if (typeof populateGmsTrendTagList === 'function') populateGmsTrendTagList();
      } catch (e) {
        row.enabled = prevEnabled;
        syncRowBtn();
        toast('저장 실패: ' + e.message, 'err');
      }
    });
  });

  // 마우스로 열 너비 조절(요청사항) - thead는 정적 마크업이라 표당 한 번만 연결하면 되므로,
  // renderOptionTable()이 반복 호출돼도(예: 데이터 도착 시 다시 그리기) 중복으로 핸들이
  // 쌓이지 않게 dataset 플래그로 막는다.
  const optionTableEl = document.getElementById('gmsOptionTable');
  if (optionTableEl && !optionTableEl.dataset.colResizeWired) {
    optionTableEl.dataset.colResizeWired = '1';
    initColumnResize(optionTableEl);
  }
}
renderOptionTable();

// SHUT-DOWN: 임시 조치 - 실제 시퀀스 로직은 아직 없으니(뼈대), 지금은 상태(OPEN/점멸 중/
// FAULT/UNKNOWN)에 상관없이 배관도의 모든 밸브·히터(unit1.json valves[]에 히터 태그도 함께
// 들어있음)를 강제로 OFF하고, A/B 양쪽 Cylinder step status를 전부 IDLE로 되돌린 뒤(기존
// resetCylinderStepStatus() - "취소" 흐름과 동일한 초기화 로직 재사용) 조작화면을 초기
// 화면(진행 메뉴)으로 되돌리는 것으로 "전부 초기화"를 흉내낸다. TREND 화면이 열려있던
// 중이면(왼쪽 배관도가 #gmsSvg 대신 #gmsTrendCanvas로 바뀐 상태) showProgressRoot()가
// 오른쪽 진행 메뉴만 되돌리고 왼쪽은 그대로 두므로, closeGmsTrend()도 같이 불러 배관도까지
// 원상 복귀시킨다(TREND가 안 열려있었으면 closeGmsTrend()는 아무 것도 하지 않아 안전).
document.getElementById('shutdownTriggerBtn').addEventListener('click', () => {
  if (!requireOperationMode('SHUT-DOWN')) return;
  // 확인 팝업이 떠서 점멸 중이던 밸브가 있으면 그 대기 상태부터 취소한다 - SHUT-DOWN이 개별
  // 확인보다 우선한다.
  if (!valveConfirmModal.hidden) {
    setValveBlink(valveConfirmPendingTag, false);
    valveConfirmModal.hidden = true;
    valveConfirmPendingTag = null;
    valveConfirmPendingValue = null;
  }
  const allTags = valves.map((v) => v.tag);
  const finish = () => {
    resetCylinderStepStatus(); // A/B 둘 다 Cylinder step status를 IDLE로 되돌린다
    if (window.closeGmsTrend) window.closeGmsTrend(); // TREND 화면이 열려있었으면 배관도로 복귀
    showProgressRoot();
    const progressTabBtn = document.querySelector('.tab-switch-btn[data-tab="progress"]');
    if (progressTabBtn) progressTabBtn.click(); // 진행 메뉴 탭으로 화면도 같이 되돌린다
  };
  if (!allTags.length) {
    toast('SHUT-DOWN: 밸브 없음 - 초기 화면으로 되돌립니다.', '');
    finish();
    return;
  }
  Promise.all(allTags.map((tag) => fetch('/api/gms/valve/write', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag, value: false }),
  }).then((r) => r.json()).then((d) => {
    if (d.ok) applyGmsValues({ [tag]: { cmd: false, fb: false } });
    return d;
  }).catch((e) => ({ ok: false, error: e.message }))))
    .then((results) => {
      const failed = results.filter((r) => !r.ok);
      if (failed.length) toast(`SHUT-DOWN: 일부 밸브 CLOSE 실패(${failed.length}/${allTags.length}건)`, 'err');
      else toast(`SHUT-DOWN: 밸브 ${allTags.length}개 전부 강제 CLOSE 완료, 초기 화면으로 되돌립니다.`, 'ok');
    })
    .finally(finish);
});

// ── 조작화면(진행 메뉴 → 메인 메뉴 → PASSWORD → 유지보수 메뉴 → 각 하위 화면) 전용 로직은
// public/Operation.js로 분리했다("버튼을 누르면 어느 화면으로 이동하는가"만 다루는 부분).
// gms.html에서 이 파일 다음, gms-editor.js 이전에 로드된다. Operation.js는 여기서 정의한
// valves/lastValueByTag/valveStateClass/requestValveAction/applyGmsValues/toast/
// requireOperationMode/manualStateHoldOption을 그대로 가져다 쓰고, 거꾸로 아래 SHUT-DOWN
// 핸들러는 Operation.js가 정의하는 showProgressRoot()를 가져다 쓴다(둘 다 클릭 이벤트로만
// 실행되므로 <script> 로드 순서만 지키면 실행 순서 문제는 없다). ──
// ── 조작화면(진행 메뉴 → 메인 메뉴 → PASSWORD → 유지보수 메뉴 → 각 하위 화면) 전용 로직은
// public/Operation.js로 분리했다("버튼을 누르면 어느 화면으로 이동하는가"만 다루는 부분).
// gms.html에서 이 파일 다음, gms-editor.js 이전에 로드된다. Operation.js는 여기서 정의한
// valves/lastValueByTag/valveStateClass/requestValveAction/applyGmsValues/toast/
// requireOperationMode/manualStateHoldOption을 그대로 가져다 쓰고, 거꾸로 아래 SHUT-DOWN
// 핸들러는 Operation.js가 정의하는 showProgressRoot()를 가져다 쓴다(둘 다 클릭 이벤트로만
// 실행되므로 <script> 로드 순서만 지키면 실행 순서 문제는 없다). ──

// ── 상단 상태 바의 "etc" 버튼(비상정지/강제/PM/SETUP) ──
// 비상정지/강제는 아직 뼈대만(준비 중 토스트). PM/SETUP은 뼈대가 아니라 실제 상태를 보여주는
// 램프다(클릭하면 편의상 보조 메뉴의 "유지보수모드" 화면으로 바로 안내한다 - 값을 직접
// 바꾸지는 않는다, 실제 변경은 그 화면에서 PASSWORD를 통과해야 한다).
document.querySelectorAll('.etc-btn:not([data-etc="pm"]):not([data-etc="setup"])').forEach((btn) => {
  btn.addEventListener('click', () => {
    toast(`"${btn.textContent.trim()}" 기능은 아직 준비 중입니다.`, '');
  });
});
document.querySelector('.etc-btn[data-etc="pm"]')?.addEventListener('click', () => {
  if (window.requestAuxMaintenanceMode) window.requestAuxMaintenanceMode('etcPmBtn');
});
document.querySelector('.etc-btn[data-etc="setup"]')?.addEventListener('click', () => {
  if (window.requestAuxMaintenanceMode) window.requestAuxMaintenanceMode('etcSetupBtn');
});

// ── 보조 메뉴 "유지보수모드"(기존 조작화면의 유지보수 메뉴와는 별개) - PM Mode/Set-up Mode.
// PM Mode: shutdown 알람센서 Test 중 실제로 장비가 shutdown 되지 않게 하는 목적. Set-up
// Mode: GMS 모니터링이 상위로 올리는 통신 프로토콜 중 Alarm 항목을 차단하는 목적(둘 다
// 실제 인터락 로직은 아직 없음 - 뼈대). 서버(gmsState)가 진짜 값을 들고 있고, 여기 두
// 변수는 그 값의 화면 표시용 사본이다(웹소켓 gmsMaintenanceMode로 모든 클라이언트가 함께
// 갱신됨 - 어느 화면에서 켰든 배관도 램프가 즉시 반영된다). ──
let pmModeActive = false;
let setupModeActive = false;
function applyMaintenanceModeState(state) {
  if (!state) return;
  pmModeActive = !!state.pmMode;
  setupModeActive = !!state.setupMode;
  const pmLamp = document.getElementById('pmModeLamp');
  const setupLamp = document.getElementById('setupModeLamp');
  if (pmLamp) pmLamp.classList.toggle('active', pmModeActive);
  if (setupLamp) setupLamp.classList.toggle('active', setupModeActive);
  document.querySelector('.etc-btn[data-etc="pm"]')?.classList.toggle('lamp-on', pmModeActive);
  document.querySelector('.etc-btn[data-etc="setup"]')?.classList.toggle('lamp-on', setupModeActive);
}
async function loadMaintenanceModeState() {
  try {
    const res = await fetch('/api/gms/maintenance-mode');
    const data = await res.json();
    if (data.ok) applyMaintenanceModeState(data);
  } catch (e) { /* 실패해도 기본값(둘 다 미적용)으로 유지, 웹소켓이 나중에 갱신 가능 */ }
}
loadMaintenanceModeState();

// ── 하단 이력 패널: 알람 이력 / Live Events (서버 SQLite 이력 API + WS 실시간 갱신) ──
const alarmHistoryBody = document.getElementById('alarmHistoryBody');
const liveEventsBody = document.getElementById('liveEventsBody');

function fmtTs(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

async function loadAlarms() {
  try {
    const params = new URLSearchParams({ unit: selectedUnitId, limit: '100' });
    const grade = document.getElementById('alarmGradeFilter').value;
    const q = document.getElementById('alarmSearch').value.trim();
    if (grade) params.set('grade', grade);
    if (q) params.set('q', q);
    if (document.getElementById('alarmActiveOnly').checked) params.set('active', '1');
    const data = await (await fetch(`/api/gms/history/alarms?${params}`)).json();
    if (!data.ok) return;
    if (!data.rows.length) {
      alarmHistoryBody.innerHTML = '<tr class="empty-row"><td colspan="4">알람 없음</td></tr>';
      return;
    }
    alarmHistoryBody.innerHTML = data.rows.map((r) => `
      <tr class="${r.cleared_at ? 'alarm-cleared' : ''}">
        <td>${fmtTs(r.raised_at)}</td>
        <td><span class="grade-badge g${r.grade}">${r.grade}등급</span></td>
        <td>${escapeHtml(r.message)}</td>
        <td>${r.cleared_at ? fmtTs(r.cleared_at) : '<b style="color:var(--error);">활성</b>'}</td>
      </tr>`).join('');
  } catch (e) { /* 이력 조회 실패는 조용히 - 폴링/배관도 동작에 영향 없음 */ }
}

async function loadEvents() {
  try {
    const params = new URLSearchParams({ unit: selectedUnitId, limit: '100' });
    const grade = document.getElementById('eventGradeFilter').value;
    const q = document.getElementById('eventSearch').value.trim();
    if (grade) params.set('grade', grade);
    if (q) params.set('q', q);
    const data = await (await fetch(`/api/gms/history/events?${params}`)).json();
    if (!data.ok) return;
    if (!data.rows.length) {
      liveEventsBody.innerHTML = '<tr class="empty-row"><td colspan="3">이벤트 없음</td></tr>';
      return;
    }
    liveEventsBody.innerHTML = data.rows.map((r) => `
      <tr>
        <td>${fmtTs(r.ts)}</td>
        <td><span class="grade-badge ${r.grade.toLowerCase()}">${r.grade}</span></td>
        <td>${escapeHtml(r.message)}</td>
      </tr>`).join('');
  } catch (e) { /* 무시 */ }
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
const loadAlarmsDebounced = debounce(loadAlarms, 300);
const loadEventsDebounced = debounce(loadEvents, 300);

['alarmGradeFilter', 'alarmActiveOnly'].forEach((id) => document.getElementById(id).addEventListener('change', loadAlarms));
document.getElementById('alarmSearch').addEventListener('input', loadAlarmsDebounced);
document.getElementById('eventGradeFilter').addEventListener('change', loadEvents);
document.getElementById('eventSearch').addEventListener('input', loadEventsDebounced);

function exportHistory(type) {
  const params = new URLSearchParams({ type, unit: selectedUnitId });
  window.open(`/api/gms/history/export?${params}`, '_blank');
}
document.getElementById('alarmExportBtn').addEventListener('click', () => exportHistory('alarms'));
document.getElementById('eventExportBtn').addEventListener('click', () => exportHistory('events'));
document.getElementById('worklogExportBtn').addEventListener('click', () => exportHistory('worklog'));

loadAlarms();
loadEvents();

// ── 서버(Node) 연결 램프 - 사용자 요청("서버가 켜져 있는지 꺼져있는지 확인할 수 있는 lamp") -
// WebSocket이 붙어 있으면 켜짐(초록/고정), 끊기면 꺼짐(빨강/점멸)으로 표시한다. PLC 연결
// 여부를 보여주는 #cpuInfo(updateCpuInfoFromStatus)와는 별개 - 이건 브라우저가 서버 자체에
// 붙어 있는지만 본다. ──
function setServerConnLampState(connected) {
  const lamp = document.getElementById('serverConnLamp');
  const label = document.getElementById('serverConnLabel');
  if (lamp) lamp.classList.toggle('connected', connected);
  if (label) label.textContent = connected ? '서버 연결됨' : '서버 연결 끊김';
}

// ── WebSocket - 밸브 값 갱신과 헤더 CPU 정보만 구독한다(연결/폴링 제어는 장비 선택 화면 담당) ──
let ws;
function connectWs() {
  if (location.protocol === 'file:' || !location.host) return;
  try {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);
    ws.onopen = () => setServerConnLampState(true);
    ws.onmessage = (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch (e) { return; }
      if (msg.type === 'gmsConnStatus') updateCpuInfoFromStatus(msg.payload);
      else if (msg.type === 'gmsValues') {
        applyGmsValues(msg.payload.values);
        applyGmsPts(msg.payload.pts);
        // 압력조정 저장(자동 ZERO 반영 포함)이 다른 탭/자동진행에서 일어났을 때도, 이미 열려있는
        // ptCalibrationRows 캐시와 압력조정 표(gms-pt-calibration.js)가 새로고침 없이 갱신되도록.
        if (Array.isArray(msg.payload.ptCalibrationRows)) {
          ptCalibrationRows = msg.payload.ptCalibrationRows;
          if (typeof window.refreshPressureAdjustScreen === 'function') window.refreshPressureAdjustScreen();
        }
      }
      // 알람 발생/해제는 기존 행 갱신(해제 시각)이 필요해서 목록을 다시 읽는다(디바운스).
      else if (msg.type === 'gmsAlarm') loadAlarmsDebounced();
      else if (msg.type === 'gmsEvent') loadEventsDebounced();
      else if (msg.type === 'gmsMaintenanceMode') applyMaintenanceModeState(msg.payload);
    };
    ws.onclose = () => { setServerConnLampState(false); setTimeout(connectWs, 1000); };
  } catch (e) {}
}
setServerConnLampState(false); // 최초 연결 전 초기 상태
connectWs();

// ── 초기 로드 - 이미 폴링 중이었다면 최신 값을 바로 채워 넣는다 ──
if (location.protocol !== 'file:') {
  fetch('/api/gms/status').then((r) => r.json()).then((d) => {
    if (d.ok && d.values) applyGmsValues(d.values);
    if (d.ok && d.pts) applyGmsPts(d.pts);
  }).catch(() => {});
}

// ── 좌/우 패널 폭 조절 (드래그 스플리터) - monitoring.js의 트렌드/변수목록 스플리터와 동일 패턴 ──
function initHSplitter({ splitterId, panelSelector, storageKey, growLeft }) {
  const splitter = document.getElementById(splitterId);
  const panel = document.querySelector(panelSelector);
  if (!splitter || !panel) return;

  const savedWidth = Number(localStorage.getItem(storageKey));
  if (Number.isFinite(savedWidth) && savedWidth > 0) {
    panel.style.flexBasis = savedWidth + 'px';
  }

  let dragging = false;
  let startX = 0;
  let startWidth = 0;
  splitter.addEventListener('mousedown', (e) => {
    dragging = true;
    splitter.classList.add('dragging');
    startX = e.clientX;
    startWidth = panel.getBoundingClientRect().width;
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const rawDelta = e.clientX - startX;
    const delta = growLeft ? rawDelta : -rawDelta; // 스플리터를 바깥쪽으로 끌면 그 옆 패널이 넓어짐
    const maxWidth = window.innerWidth * 0.6;
    const newWidth = Math.min(Math.max(startWidth + delta, 220), maxWidth);
    panel.style.flexBasis = newWidth + 'px';
    localStorage.setItem(storageKey, String(newWidth));
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    splitter.classList.remove('dragging');
    document.body.style.userSelect = '';
  });
}
initHSplitter({ splitterId: 'rightSplitter', panelSelector: '.op-panel', storageKey: 'gmsOpPanelWidth', growLeft: false });
// Equipment Info / BAR CODE·IP ADDR 사이 폭 조절 - BAR CODE 박스가 스플리터 오른쪽에 있으므로
// op-panel(rightSplitter)과 같은 방향(growLeft:false). 양쪽 스플리터 모두 같은 패널
// (.equip-io-box)을 조절하므로 storageKey를 공유해서 어느 쪽을 끌어도 하나의 값으로 저장된다.
initHSplitter({ splitterId: 'equipMidSplitter', panelSelector: '.equip-io-box', storageKey: 'gmsEquipIoBoxWidth', growLeft: false });
// BAR CODE·IP ADDR / Cylinder Step Status 사이 폭 조절 - 이번엔 패널이 스플리터 왼쪽에
// 있으므로 growLeft:true.
initHSplitter({ splitterId: 'equipRightSplitter', panelSelector: '.equip-io-box', storageKey: 'gmsEquipIoBoxWidth', growLeft: true });


// ══════════════════════════════════════════════════════════════
// GMS 화면 최대화 v3 통합 핸들러
// ① 상단 바 자동 숨김 (핸들 클릭 토글)
// ② 3단 커튼 슬라이드 (EQ Info / BAR CODE 각각 독립 토글, localStorage 저장)
// ③ 우측 op-panel 접기/펼치기
// ④ 전체화면 버튼 (CYL STEP 헤더)
// ══════════════════════════════════════════════════════════════
(function initScreenMaximize() {

  // ── ① 상단 바 자동 숨김 ──
  const equipBar   = document.getElementById('equipStatusBarV2');
  const handle     = document.getElementById('equipBarHandle');
  const handleLbl  = document.getElementById('equipBarHandleLabel');

  if (handle && equipBar) {
    // localStorage에서 저장된 숨김 상태 복원
    const barHidden = localStorage.getItem('gmsEquipBarHidden') === '1';
    if (barHidden) {
      equipBar.classList.add('collapsed');
      handleLbl.textContent = '▼ 펼치기';
    }

    handle.addEventListener('click', () => {
      const isCollapsed = equipBar.classList.toggle('collapsed');
      handleLbl.textContent = isCollapsed ? '▼ 펼치기' : '▲ 접기';
      localStorage.setItem('gmsEquipBarHidden', isCollapsed ? '1' : '0');
    });
  }

  // ── ② 3단 커튼 슬라이드 ──
  // 커튼 패널 설정: [버튼ID, 패널ID, localStorage키]
  const curtains = [
    ['curtainBtn1', 'curtainPanel1', 'gmsCurtain1Open'],
    ['curtainBtn2', 'curtainPanel2', 'gmsCurtain2Open'],
  ];

  curtains.forEach(([btnId, panelId, storageKey]) => {
    const btn   = document.getElementById(btnId);
    const panel = document.getElementById(panelId);
    if (!btn || !panel) return;

    // 저장된 상태 복원
    const wasOpen = localStorage.getItem(storageKey) === '1';
    if (wasOpen) {
      panel.classList.add('open');
      btn.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }

    btn.addEventListener('click', () => {
      const isOpen = panel.classList.toggle('open');
      btn.classList.toggle('open', isOpen);
      btn.setAttribute('aria-expanded', String(isOpen));
      localStorage.setItem(storageKey, isOpen ? '1' : '0');
    });
  });

  // ── ③ 우측 op-panel 접기/펼치기 ──
  const collapseBtn   = document.getElementById('opPanelCollapseBtn');
  const opPanel       = document.getElementById('opPanel');
  const rightSplitter = document.getElementById('rightSplitter');

  if (collapseBtn && opPanel) {
    // localStorage에서 접힘 상태 복원
    const panelCollapsed = localStorage.getItem('gmsOpPanelCollapsed') === '1';
    if (panelCollapsed) {
      opPanel.classList.add('panel-collapsed');
      rightSplitter && rightSplitter.classList.add('panel-collapsed');
      collapseBtn.textContent  = '▶ 패널';
      collapseBtn.setAttribute('aria-expanded', 'false');
      collapseBtn.classList.add('active');
    }

    collapseBtn.addEventListener('click', () => {
      const isNowCollapsed = opPanel.classList.toggle('panel-collapsed');
      rightSplitter && rightSplitter.classList.toggle('panel-collapsed', isNowCollapsed);
      collapseBtn.textContent = isNowCollapsed ? '▶ 패널' : '◀ 패널';
      collapseBtn.setAttribute('aria-expanded', String(!isNowCollapsed));
      collapseBtn.classList.toggle('active', isNowCollapsed);
      localStorage.setItem('gmsOpPanelCollapsed', isNowCollapsed ? '1' : '0');
    });
  }

  // ── ④ 전체화면 버튼 (CYL STEP 헤더용, 기존 fullscreenToggleBtn 로직 공유) ──
  const fsBtn2 = document.getElementById('fullscreenToggleBtn2');
  if (fsBtn2) {
    function updateFs2Btn() {
      const isFull = !!document.fullscreenElement;
      fsBtn2.textContent = isFull ? '⛶ 복원' : '⛶';
      fsBtn2.classList.toggle('active', isFull);
      fsBtn2.title = isFull ? '전체 화면 해제 (F11)' : '전체 화면 전환 (F11)';
    }
    fsBtn2.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
    document.addEventListener('fullscreenchange', updateFs2Btn);
    updateFs2Btn();
  }

})();


(function initEquipStatusSplitter() {
  const splitter = document.getElementById('equipStatusSplitter');
  const box = document.querySelector('.equip-status-bar') || document.querySelector('.equip-status-bar-v2');
  if (!splitter || !box) return;
  const STORAGE_KEY = 'gmsEquipStatusBarHeight';

  const MIN_HEIGHT = 112; // A Side + B Side + etc + 탭 메뉴가 모두 온전히 보이는 최소 안전 높이 (이 이하로는 줄어들지 않고 멈춤)
  const savedHeight = Number(localStorage.getItem(STORAGE_KEY));
  if (Number.isFinite(savedHeight) && savedHeight > 0) {
    const safeH = Math.max(savedHeight, MIN_HEIGHT);
    box.style.flexBasis = safeH + 'px';
    box.style.height = safeH + 'px';
  } else {
    box.style.flexBasis = MIN_HEIGHT + 'px';
    box.style.height = MIN_HEIGHT + 'px';
  }

  let dragging = false;
  let startY = 0;
  let startHeight = 0;
  splitter.addEventListener('mousedown', (e) => {
    dragging = true;
    splitter.classList.add('dragging');
    startY = e.clientY;
    startHeight = box.getBoundingClientRect().height;
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const delta = e.clientY - startY;
    const maxHeight = window.innerHeight * 0.6;
    const newHeight = Math.min(Math.max(startHeight + delta, MIN_HEIGHT), maxHeight);
    box.style.flexBasis = newHeight + 'px';
    box.style.height = newHeight + 'px';
    localStorage.setItem(STORAGE_KEY, String(newHeight));
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    splitter.classList.remove('dragging');
    document.body.style.userSelect = '';
  });
})();

// ── 전체 화면 전환 버튼 (F11 토글) ──
(function initFullscreenToggle() {
  const btn = document.getElementById('fullscreenToggleBtn');
  if (!btn) return;
  function updateBtn() {
    const isFull = !!document.fullscreenElement;
    btn.textContent = isFull ? '🗗 창 모드' : '⛶ 전체 화면';
    btn.title = isFull ? '창 모드로 복귀 (Esc / F11)' : '전체 화면 전환 (F11)';
    btn.classList.toggle('active', isFull);
  }
  btn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => toast('전체화면 전환 실패: ' + e.message, 'err'));
    } else {
      document.exitFullscreen().catch((e) => toast('전체화면 종료 실패: ' + e.message, 'err'));
    }
  });
  document.addEventListener('fullscreenchange', updateBtn);
  updateBtn();
})();

// ── Univer 그리드 컨테이너 높이 조절(아래로 끌면 커짐) - initEquipStatusSplitter와 동일
// 패턴을 여러 그리드(USER 탭/작업이력)가 공용으로 쓸 수 있게 함수로 뽑았다. flex:1 1 400px
// 인라인 스타일을 드래그로 덮어쓴다. 크기가 바뀔 때마다 resize 이벤트를 쏴서 각 위젯의
// ResizeObserver가 Univer 내부 캔버스를 다시 맞추게 한다. ──
function initGridHeightResizer({ splitterId, boxId, storageKey }) {
  const splitter = document.getElementById(splitterId);
  const box = document.getElementById(boxId);
  if (!splitter || !box) return;

  // gms.html의 인라인 min-height:400px는 "탭/화면을 처음 열었을 때 최소한 이 정도는
  // 보이게" 하려는 기본값일 뿐이다 - 사용자가 드래그로 그보다 작게 줄이려 해도 이
  // min-height가 남아있으면 실제 렌더링 높이가 400px에 묶여버린다. 드래그 가능한
  // 최소값(200px)과 맞춰서 최초 한 번 낮춰둔다.
  box.style.minHeight = '200px';

  const savedHeight = Number(localStorage.getItem(storageKey));
  if (Number.isFinite(savedHeight) && savedHeight > 0) {
    box.style.flex = 'none';
    box.style.height = savedHeight + 'px';
  }

  // 마우스 드래그와 터치 드래그를 같은 로직으로 처리한다(PAD/휴대폰처럼 마우스가 없는
  // 환경도 고려해달라는 요청사항 - clientY만 이벤트 종류에 따라 다르게 뽑아온다).
  let dragging = false;
  let startY = 0;
  let startHeight = 0;
  const clientYOf = (e) => (e.touches && e.touches.length ? e.touches[0].clientY : e.clientY);
  const onStart = (e) => {
    dragging = true;
    splitter.classList.add('dragging');
    startY = clientYOf(e);
    startHeight = box.getBoundingClientRect().height;
    document.body.style.userSelect = 'none';
  };
  const onMove = (e) => {
    if (!dragging) return;
    const delta = clientYOf(e) - startY;
    const maxHeight = window.innerHeight * 0.85;
    const newHeight = Math.min(Math.max(startHeight + delta, 200), maxHeight);
    box.style.flex = 'none';
    box.style.height = newHeight + 'px';
    localStorage.setItem(storageKey, String(newHeight));
    window.dispatchEvent(new Event('resize'));
    if (e.touches) e.preventDefault(); // 터치 드래그 중 페이지 자체가 스크롤되는 것을 막는다
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    splitter.classList.remove('dragging');
    document.body.style.userSelect = '';
  };
  splitter.addEventListener('mousedown', onStart);
  splitter.addEventListener('touchstart', onStart, { passive: true });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mouseup', onEnd);
  window.addEventListener('touchend', onEnd);
}
initGridHeightResizer({ splitterId: 'gmsUserGridResizeHandle', boxId: 'gmsUserGridContainer', storageKey: 'gmsUserGridHeight' });

/** 표 헤더(th) 오른쪽 끝에 드래그 핸들을 붙여 마우스로 열 너비를 조절할 수 있게 한다(요청사항 -
    CONFIG/OPTION 표). table-layout:fixed인 표에서 th 너비만 바꾸면 그 열의 td들도 함께
    따라간다. gms-pt-calibration.js가 원래 자기 표 하나에만 쓰던 로직을 여러 표(CONFIG/OPTION)
    에서 재사용할 수 있게 공용 함수로 뺐다. thead가 정적 마크업이라(다시 그려지지 않음) 표당
    한 번만 부르면 된다 - 중복 호출 방지는 호출부 책임(dataset 플래그 등).*/
function initColumnResize(table) {
  if (!table) return;
  table.querySelectorAll('thead th').forEach((th) => {
    const handle = document.createElement('span');
    handle.className = 'col-resize-handle';
    th.appendChild(handle);
    let startX = 0;
    let startWidth = 0;
    const onMouseMove = (e) => {
      th.style.width = `${Math.max(30, startWidth + (e.clientX - startX))}px`;
    };
    const onMouseUp = () => {
      handle.classList.remove('resizing');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startX = e.clientX;
      startWidth = th.offsetWidth;
      handle.classList.add('resizing');
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}
// 작업이력 화면(#gmsWorkLogGridContainer)은 USER 탭과 달리 OPERATION_SCREEN_FILES가 늦게
// fetch로 주입하는 fragment 안에 있어서, 여기(gms.js 최상단 실행 시점)엔 아직 DOM에 없다 -
// gms-worklog-widget.js가 마운트할 때(컨테이너가 실제로 존재할 때) window.initGridHeightResizer
// 를 직접 불러서 연결한다(classic script의 최상위 함수라 다른 스크립트에서도 접근 가능).

// ── 배관도 영역 / 하단(알람이력·Live Events) 높이 조절 (드래그 스플리터) -
// monitoring.js의 통신 이력 높이 스플리터와 동일 패턴. ──
(function initBottomSplitter() {
  const splitter = document.getElementById('bottomSplitter');
  const bottomPanels = document.querySelector('.bottom-panels');
  if (!splitter || !bottomPanels) return;
  const STORAGE_KEY = 'gmsBottomPanelsHeight';

  const savedHeight = Number(localStorage.getItem(STORAGE_KEY));
  if (Number.isFinite(savedHeight) && savedHeight > 0) {
    bottomPanels.style.flexBasis = savedHeight + 'px';
    bottomPanels.style.height = savedHeight + 'px';
  }

  let dragging = false;
  let startY = 0;
  let startHeight = 0;
  splitter.addEventListener('mousedown', (e) => {
    dragging = true;
    splitter.classList.add('dragging');
    startY = e.clientY;
    startHeight = bottomPanels.getBoundingClientRect().height;
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const delta = startY - e.clientY;
    const maxHeight = window.innerHeight * 0.7;
    const newHeight = Math.min(Math.max(startHeight + delta, 80), maxHeight);
    bottomPanels.style.flexBasis = newHeight + 'px';
    bottomPanels.style.height = newHeight + 'px';
    localStorage.setItem(STORAGE_KEY, String(newHeight));
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    splitter.classList.remove('dragging');
    document.body.style.userSelect = '';
  });
})();
