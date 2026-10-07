'use strict';

/**
 * 모든 페이지 공통 - 서버 설정(/api/settings)을 불러와 클라이언트에 적용한다.
 *  - 테마(라이트/다크/오렌지/사용자 지정) 적용 및 localStorage 동기화
 *  - 테이블 폰트 크기(--table-font-size)
 *  - 화면 기본 배율(Ctrl+휠 배율과 동일한 localStorage 값)
 *  - 연결 툴바 기본값(PLC 종류/방식/IP/포트) 프리필
 * 설정 페이지(settings.js)도 이 파일의 window.__theme 헬퍼를 재사용해 실시간 미리보기를 한다.
 */
(function () {
  // 사용자 지정 테마에서 덮어쓸 수 있는 CSS 변수 목록(-- 제외). 설정 페이지의 색상 편집기와 짝을 이룬다.
  var THEME_VARS = [
    'bg', 'panel', 'panel-border', 'text', 'muted',
    'accent', 'accent-dim', 'warn', 'error', 'input-bg', 'bg-alt',
  ];

  function customStyleEl() {
    var el = document.getElementById('__customTheme');
    if (!el) {
      el = document.createElement('style');
      el.id = '__customTheme';
      (document.head || document.documentElement).appendChild(el);
    }
    return el;
  }

  // 사용자 지정 테마 적용: 바탕(fallback) 테마를 깔고 그 위에 지정한 변수만 덮어쓴다.
  function applyCustom(fallback, vars) {
    document.documentElement.dataset.theme = fallback === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-custom-theme', '1');
    var decls = THEME_VARS
      .filter(function (k) { return vars && vars[k]; })
      .map(function (k) { return '--' + k + ':' + vars[k]; })
      .join(';');
    customStyleEl().textContent = ':root[data-custom-theme]{' + decls + '}';
  }

  // 표준 테마 적용: 사용자 지정 흔적을 지우고 data-theme만 설정.
  function applyStandard(base) {
    document.documentElement.removeAttribute('data-custom-theme');
    var el = document.getElementById('__customTheme');
    if (el) el.textContent = '';
    document.documentElement.dataset.theme = base || 'light';
  }

  // theme = { base, customFallback, custom } (서버 설정 구조)
  function applyTheme(theme) {
    if (!theme) return;
    if (theme.base === 'custom') {
      applyCustom(theme.customFallback || 'light', theme.custom || {});
      localStorage.setItem('plcThemeMode', 'custom');
      localStorage.setItem('plcCustomTheme', JSON.stringify({ fallback: theme.customFallback || 'light', vars: theme.custom || {} }));
    } else {
      applyStandard(theme.base || 'light');
      localStorage.removeItem('plcThemeMode');
      localStorage.setItem('plcTheme', theme.base || 'light');
    }
  }

  function applyDisplay(display) {
    if (!display) return;
    var px = Number(display.tableFontSize);
    if (Number.isFinite(px) && px >= 8 && px <= 40) {
      document.documentElement.style.setProperty('--table-font-size', px + 'px');
    }
  }

  // 테이블/값 표시에 --table-font-size가 실제로 반영되도록 공통 규칙을 주입한다.
  // (각 페이지 CSS를 건드리지 않고, 존재하지 않는 선택자는 자연히 무시된다.)
  function injectFontRule() {
    if (document.getElementById('__tableFontRule')) return;
    var s = document.createElement('style');
    s.id = '__tableFontRule';
    s.textContent =
      '.value-cell .value{font-size:var(--table-font-size,16px);}' +
      '#varTable td,#varTable th{font-size:var(--table-font-size,12px);}' +
      '#nxTagTable td{font-size:var(--table-font-size,14px);}' +
      '.log-list,#logList{font-size:var(--table-font-size,12px);}';
    (document.head || document.documentElement).appendChild(s);
  }

  // 연결 툴바 기본값 프리필 - 사용자가 아직 아무것도 안 바꾼 초기 상태에서만 채운다.
  function prefillConnection(conn) {
    if (!conn) return;
    var series = document.getElementById('plcSeriesSelect');
    var host = document.getElementById('connHost');
    var port = document.getElementById('connPort');
    var type = document.getElementById('connType');
    if (series && conn.defaultSeries) series.value = conn.defaultSeries;
    if (host && conn.defaultIp && !host.value) host.value = conn.defaultIp;
    if (type && conn.finsProtocol) type.value = conn.finsProtocol;
    if (port) {
      var isNx = series && series.value === 'NX';
      var mode = isNx ? conn.njPortMode : conn.cjPortMode;
      var p = isNx ? conn.njPort : conn.cjPort;
      if (mode === 'custom' && p) port.value = p;
      else port.value = isNx ? (conn.njPort || 44818) : (conn.cjPort || 9600);
    }
  }

  // 다른 스크립트(설정 페이지)에서 쓰도록 헬퍼 노출
  window.__theme = { THEME_VARS: THEME_VARS, applyTheme: applyTheme, applyCustom: applyCustom, applyStandard: applyStandard };
  window.__applyDisplay = applyDisplay;

  // 서버 설정을 불러와 적용. 실패해도 페이지는 그대로 동작(로컬 테마/배율 유지).
  function load() {
    injectFontRule();
    fetch('/api/settings')
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) return;
        var s = res.settings;
        window.__appSettings = s;
        // 테마는 이 브라우저에 로컬 선택(헤더 드롭다운/설정 저장으로 남긴 localStorage)이 없을 때만
        // 서버 기본값으로 적용한다. 로컬 선택이 있으면 인라인 스크립트가 이미 적용했으므로 건드리지 않는다
        // (그래야 헤더에서 바꾼 테마가 페이지를 옮겨도 유지된다).
        if (!localStorage.getItem('plcThemeMode') && !localStorage.getItem('plcTheme')) {
          applyTheme(s.theme);
          // 헤더 테마 드롭다운 표시값도 맞춘다(사용자 지정이면 바탕 테마로).
          var sel = document.getElementById('themeSelect');
          if (sel) sel.value = s.theme.base === 'custom' ? (s.theme.customFallback || 'light') : (s.theme.base || 'light');
        }
        applyDisplay(s.display);
        prefillConnection(s.connection);
        // 화면 기본 배율: 사용자가 이 브라우저에서 배율을 바꾼 적이 없을 때만 서버 기본값 적용
        if (localStorage.getItem('plcUiZoom') === null && s.zoom && window.__setUiZoom) {
          window.__setUiZoom(Number(s.zoom) || 1);
        }
      })
      .catch(function () { /* 서버 미응답 시 무시 */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();

  // ── 공통 전체 화면 / 창 모드 버튼 바인딩 ──
  function initFullscreenToggle() {
    var btn = document.getElementById('fullscreenToggleBtn');
    if (!btn || btn.__bound) return;
    btn.__bound = true;
    function updateBtn() {
      var isFull = !!document.fullscreenElement;
      btn.textContent = isFull ? '🗗 창 모드' : '⛶ 전체 화면';
      btn.title = isFull ? '창 모드로 복귀 (Esc / F11)' : '전체 화면 전환 (F11)';
      btn.classList.toggle('active', isFull);
    }
    btn.addEventListener('click', function () {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(function (e) { console.warn('전체화면 전환 실패:', e); });
      } else {
        document.exitFullscreen().catch(function (e) { console.warn('전체화면 종료 실패:', e); });
      }
    });
    document.addEventListener('fullscreenchange', updateBtn);
    updateBtn();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFullscreenToggle);
  } else {
    initFullscreenToggle();
  }

})();