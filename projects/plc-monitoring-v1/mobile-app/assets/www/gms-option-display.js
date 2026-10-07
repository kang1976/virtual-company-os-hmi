'use strict';

/**
 * OPTION DISPLAY 화면 - 보조 메뉴의 "OPTION DISPLAY" 버튼으로 들어온다(Operation.js의
 * auxMenuOptionDisplayBtn/showProgressOptionDisplay). CONFIG↔OPTION 탭의 OPTION 탭
 * (gms.js의 renderOptionTable)이 들고 있는 전역 상태를 그대로 읽어서 읽기 전용으로
 * 보여준다 - 이 화면에는 값을 바꾸는 컨트롤이 하나도 없다(요청사항: "변경권한은 없음").
 * gms.js/Operation.js 다음에 로드해야 한다(PASSWORD_GATE_DEFS, passwordGateOptions,
 * manualStateHoldOption, vtUseOption, gcTypeOption, mainSequenceOrder,
 * mainSequenceEnabledTypes, MAIN_SEQUENCE_TYPE_DEFS를 그대로 가져다 쓴다 - 옵션 값의
 * 출처가 두 군데로 갈라지면 안 되므로 별도 데이터를 새로 두지 않는다).
 *
 * OPTION DISPLAY.html은 Operation.js의 loadOperationScreens()가 늦게 주입하는 fragment라
 * 이 스크립트 로드 시점엔 아직 DOM에 없을 수 있다 - gms-pt-calibration.js와 동일하게
 * showProgressOptionDisplay가 처음 호출될 때(=이미 주입 완료된 뒤) wireOnceOptionDisplay()로
 * 한 번만 연결하고, renderOptionDisplay()는 화면을 열 때마다 다시 그린다. 함수 이름을
 * 파일마다 겹치는 "wireOnce" 대신 구체적으로 짓는다 - 이 프로젝트의 모든 화면 스크립트가
 * classic <script>(모듈 아님)라 최상위 function 선언이 전부 같은 전역 스코프를 공유해서,
 * 같은 이름을 쓰면 나중에 로드된 파일의 정의가 먼저 로드된 파일의 정의를 조용히 덮어쓴다
 * (실제로 gms-pt-calibration.js와 이 파일이 똑같이 "wireOnce"를 쓰다가 이 파일이 나중에
 * 로드되면서 압력조정 화면의 키패드/저장 버튼이 전혀 연결되지 않는 버그가 있었다).
 */

function renderOptionRow(label, statusText) {
  return `<tr><td>${label}</td><td>${statusText}</td></tr>`;
}

function renderOptionDisplay() {
  const basicBody = document.getElementById('optionDisplayBasicBody');
  const gateBody = document.getElementById('optionDisplayGateBody');
  const chipRow = document.getElementById('optionDisplayMainSequenceChips');
  if (!basicBody || !gateBody || !chipRow) return;

  basicBody.innerHTML = [
    renderOptionRow('수동조작 상태 유지 옵션', manualStateHoldOption ? '적용' : '미적용'),
    renderOptionRow('VT 사용 옵션', vtUseOption ? '적용' : '미적용'),
    renderOptionRow('GC Type', gcTypeOption ? '2B2P' : '2B1P'),
  ].join('');

  gateBody.innerHTML = PASSWORD_GATE_DEFS.map((def) =>
    renderOptionRow(def.label, passwordGateOptions[def.key] ? '적용' : '미적용')
  ).join('');

  // Main 시퀀스 순서 - 편집기(gms-sequence-editor.js)와 같은 데이터(mainSequenceOrder/
  // mainSequenceEnabledTypes)를 그대로 읽어서 순서대로 칩으로 나열한다. 미적용 타입은
  // 흐리게+취소선으로 표시한다(실제 자동 진행에서 건너뛰는 것과 같은 의미이므로).
  if (!Array.isArray(mainSequenceOrder) || mainSequenceOrder.length === 0) {
    chipRow.innerHTML = '<span style="color:var(--muted); font-size:12px;">불러오는 중...</span>';
  } else {
    chipRow.innerHTML = mainSequenceOrder.map((item, idx) => {
      const def = MAIN_SEQUENCE_TYPE_DEFS.find((d) => d.type === item.type);
      const label = def ? def.korLabel : item.type;
      const enabled = mainSequenceEnabledTypes[item.type] !== false;
      const arrow = idx < mainSequenceOrder.length - 1 ? '<span class="arrow">→</span>' : '';
      return `<span class="option-display-chip${enabled ? '' : ' disabled'}">${item.type} · ${label}</span>${arrow}`;
    }).join('');
  }
}
window.renderOptionDisplay = renderOptionDisplay;

function wireOnceOptionDisplay() {
  const refreshBtn = document.getElementById('optionDisplayRefreshBtn');
  if (!refreshBtn || refreshBtn.dataset.wired) return;
  refreshBtn.dataset.wired = '1';

  refreshBtn.addEventListener('click', async () => {
    if (typeof logWorkAction === 'function') logWorkAction('optionDisplayRefreshBtn', progressCurrentSide);
    // Main 시퀀스는 서버(설비 사양) 저장값이라 새로고침 때 다시 조회한다 - 다른 세션에서
    // 방금 바꿨을 수도 있으므로. 나머지(수동조작 유지/VT/GC Type/PASSWORD 게이트)는
    // localStorage 기반이라 이미 항상 최신값이지만 함께 다시 그린다.
    if (typeof loadMainSequenceConfig === 'function') await loadMainSequenceConfig();
    renderOptionDisplay();
    toast('OPTION 값을 새로고침했습니다.', 'ok');
  });

  document.getElementById('optionDisplayCloseBtn')?.addEventListener('click', () => {
    if (typeof logWorkAction === 'function') logWorkAction('optionDisplayCloseBtn', progressCurrentSide);
    showProgressRoot();
  });
}
window.wireOptionDisplayOnce = wireOnceOptionDisplay;
