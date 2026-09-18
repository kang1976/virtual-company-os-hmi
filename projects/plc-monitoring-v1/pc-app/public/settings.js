'use strict';

// 설정 페이지 로직: /api/settings 를 불러와 폼에 채우고, 테마를 실시간 미리보기하며, 저장/초기화한다.

const $ = (id) => document.getElementById(id);

// 테마: 6개 프리셋 중 클릭 한 번으로 선택 (Windows 테마 설정처럼 단순하게).
// 예전의 "사용자 지정"(11개 색상 개별 편집 + 팔레트 팝업) 방식은 선택하기 번거롭다는 피드백으로 제거했다.
const THEME_PRESETS = ['light', 'dark', 'orange', 'blue', 'green', 'gray'];
let currentTheme = 'light';

function selectTheme(name, applyLive) {
  if (!THEME_PRESETS.includes(name)) name = 'light';
  currentTheme = name;
  document.querySelectorAll('.theme-swatch').forEach((btn) => {
    const isActive = btn.dataset.theme === name;
    btn.classList.toggle('active', isActive);
    const circle = btn.querySelector('.sw-circle');
    if (circle) circle.textContent = isActive ? '✓' : '';
  });
  const sel = $('themeSelect');
  if (sel) sel.value = name;
  if (applyLive) window.__theme.applyStandard(name);
}

// ── 폼 채우기 / 수집 ──
function populate(s) {
  $('variablesDir').value = s.general.variablesDir || '';
  $('snapshotDir').value = s.general.snapshotDir || '';
  $('filePrefix').value = s.general.filePrefix || '';
  $('filePrefixPreview').textContent = s.general.filePrefix || 'SNAP';

  $('defaultSeries').value = s.connection.defaultSeries || 'CJ';
  $('finsProtocol').value = s.connection.finsProtocol || 'UDP';
  $('finsNode').value = s.connection.finsNode == null ? 'auto' : s.connection.finsNode;
  $('defaultIp').value = s.connection.defaultIp || '';
  setRadio('cjPortMode', s.connection.cjPortMode || 'default');
  $('cjPort').value = s.connection.cjPort || 9600;
  setRadio('njPortMode', s.connection.njPortMode || 'default');
  $('njPort').value = s.connection.njPort || 44818;
  $('reconnectIntervalSec').value = s.connection.reconnectIntervalSec ?? 5;
  $('maxRetries').value = s.connection.maxRetries ?? 10;
  syncPortEnable();

  $('pdfTitlePrefix').value = s.report.pdfTitlePrefix || '';
  $('pdfTitlePreview').textContent = s.report.pdfTitlePrefix || '';
  setLogo(s.report.companyLogo || '');

  $('tableFontSize').value = s.display.tableFontSize || 13;
  $('zoomPct').value = Math.round((Number(s.zoom) || 1) * 100);

  // 예전 "사용자 지정" 테마가 저장돼 있던 경우, 그 바탕(customFallback)으로 대체해 보여준다.
  const base = s.theme.base === 'custom' ? (s.theme.customFallback || 'light') : (s.theme.base || 'light');
  selectTheme(base, false); // 로드 시엔 이미 인라인 스크립트가 적용해뒀으니 다시 적용하지 않음
}

function collect() {
  const nodeRaw = $('finsNode').value.trim();
  return {
    general: {
      variablesDir: $('variablesDir').value.trim(),
      snapshotDir: $('snapshotDir').value.trim(),
      filePrefix: $('filePrefix').value.trim(),
    },
    connection: {
      defaultSeries: $('defaultSeries').value,
      finsProtocol: $('finsProtocol').value,
      finsNode: nodeRaw === '' || nodeRaw.toLowerCase() === 'auto' ? 'auto' : (Number(nodeRaw) || 'auto'),
      defaultIp: $('defaultIp').value.trim(),
      cjPortMode: getRadio('cjPortMode'),
      cjPort: Number($('cjPort').value) || 9600,
      njPortMode: getRadio('njPortMode'),
      njPort: Number($('njPort').value) || 44818,
      reconnectIntervalSec: Number($('reconnectIntervalSec').value) || 0,
      maxRetries: Number($('maxRetries').value) || 0,
    },
    report: {
      companyLogo: $('logoPreview').dataset.dataurl || '',
      pdfTitlePrefix: $('pdfTitlePrefix').value,
    },
    display: {
      tableFontSize: Number($('tableFontSize').value) || 13,
    },
    theme: {
      base: currentTheme,
      customFallback: 'light',
      custom: {},
    },
    zoom: (Number($('zoomPct').value) || 100) / 100,
  };
}

function setRadio(name, val) {
  document.querySelectorAll(`input[name="${name}"]`).forEach((r) => { r.checked = r.value === val; });
}
function getRadio(name) {
  const c = document.querySelector(`input[name="${name}"]:checked`);
  return c ? c.value : 'default';
}
function syncPortEnable() {
  $('cjPort').disabled = getRadio('cjPortMode') !== 'custom';
  $('njPort').disabled = getRadio('njPortMode') !== 'custom';
}

function setLogo(dataUrl) {
  const img = $('logoPreview');
  if (dataUrl) {
    img.src = dataUrl;
    img.dataset.dataurl = dataUrl;
    img.style.display = '';
    $('logoClearBtn').style.display = '';
  } else {
    img.removeAttribute('src');
    img.dataset.dataurl = '';
    img.style.display = 'none';
    $('logoClearBtn').style.display = 'none';
  }
}

// ── PC 상태 확인 ──
function runCheck() {
  const box = $('checkResult');
  box.innerHTML = '<div class="hint">검사 중…</div>';
  fetch('/api/settings/check')
    .then((r) => r.json())
    .then((res) => {
      box.innerHTML = '';
      (res.checks || []).forEach((c) => {
        const d = document.createElement('div');
        d.className = 'check-item ' + (c.ok ? 'ok' : 'bad');
        d.innerHTML = `<span class="dot"></span><span class="nm">${c.name}</span><span>${c.detail || (c.ok ? '정상' : '실패')}</span>`;
        box.appendChild(d);
      });
    })
    .catch((e) => { box.innerHTML = `<div class="pv-err">검사 실패: ${e.message}</div>`; });
}

// ── 저장 / 초기화 ──
function toast(msg, isErr) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  setTimeout(() => { t.className = 'toast'; }, 2200);
}

function persistClientSide(s) {
  // 테마/폰트/배율을 localStorage에 반영해 다른 페이지에서도 즉시 적용되게 한다.
  window.__theme.applyTheme(s.theme);
  window.__applyDisplay(s.display);
  if (window.__setUiZoom) window.__setUiZoom(Number(s.zoom) || 1);
}

function save() {
  const s = collect();
  $('saveBtn').disabled = true;
  fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings: s }),
  })
    .then((r) => r.json())
    .then((res) => {
      $('saveBtn').disabled = false;
      if (!res.ok) { toast('저장 실패: ' + (res.error || ''), true); return; }
      persistClientSide(res.settings);
      populate(res.settings);
      toast('설정이 저장되었습니다.');
    })
    .catch((e) => { $('saveBtn').disabled = false; toast('저장 실패: ' + e.message, true); });
}

function reset() {
  if (!confirm('모든 설정을 기본값으로 되돌릴까요?')) return;
  fetch('/api/settings/reset', { method: 'POST' })
    .then((r) => r.json())
    .then((res) => {
      persistClientSide(res.settings);
      populate(res.settings);
      toast('기본값으로 초기화되었습니다.');
    })
    .catch((e) => toast('초기화 실패: ' + e.message, true));
}

// ── 초기화(이벤트 바인딩) ──
function init() {
  // 테마 스와치 클릭 → 즉시 적용(미리보기), 저장은 [저장] 버튼을 눌러야 반영됨
  document.querySelectorAll('.theme-swatch').forEach((btn) => {
    btn.addEventListener('click', () => selectTheme(btn.dataset.theme, true));
  });

  // 헤더 테마 드롭다운(빠른 전환) - 스와치와 상태를 동기화
  const headerTheme = $('themeSelect');
  let initial;
  if (localStorage.getItem('plcThemeMode') === 'custom') {
    try { initial = JSON.parse(localStorage.getItem('plcCustomTheme') || '{}').fallback === 'dark' ? 'dark' : 'light'; } catch (e) { initial = 'light'; }
  } else {
    initial = document.documentElement.dataset.theme || 'light';
  }
  selectTheme(initial, false);
  if (headerTheme) headerTheme.addEventListener('change', () => selectTheme(headerTheme.value, true));

  // 실시간 미리보기 프리뷰 텍스트
  $('filePrefix').addEventListener('input', () => { $('filePrefixPreview').textContent = $('filePrefix').value || 'SNAP'; });
  $('pdfTitlePrefix').addEventListener('input', () => { $('pdfTitlePreview').textContent = $('pdfTitlePrefix').value; });
  $('tableFontSize').addEventListener('change', () => window.__applyDisplay({ tableFontSize: Number($('tableFontSize').value) }));
  $('defaultSeries').addEventListener('change', syncPortEnable);
  document.querySelectorAll('input[name="cjPortMode"],input[name="njPortMode"]').forEach((r) => r.addEventListener('change', syncPortEnable));

  // 로고
  $('logoBrowseBtn').addEventListener('click', () => $('logoFile').click());
  $('logoFile').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result);
    reader.readAsDataURL(file);
  });
  $('logoClearBtn').addEventListener('click', () => setLogo(''));

  $('checkBtn').addEventListener('click', runCheck);
  $('saveBtn').addEventListener('click', save);
  $('resetBtn').addEventListener('click', reset);

  // 설정 로드
  fetch('/api/settings')
    .then((r) => r.json())
    .then((res) => { if (res && res.ok) populate(res.settings); })
    .catch(() => {});
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
