'use strict';

/**
 * GMS 조작화면(진행 메뉴 → 메인 메뉴 → PASSWORD → 유지보수 메뉴 → 각 하위 화면) 전용
 * 스크립트 - "버튼을 누르면 어느 화면으로 이동하는가"를 다루는 부분만 gms.js에서 분리했다.
 * 배관도(P&ID) 렌더링, 밸브/PT 값 갱신, 연결·폴링, 알람/이력 같은 나머지는 계속 gms.js가
 * 맡는다. 이 파일은 gms.js가 만들어둔 아래 전역을 그대로 가져다 쓴다(gms.html에서 반드시
 * gms.js 다음, gms-editor.js 이전에 로드해야 한다):
 *   - valves, lastValueByTag, valveStateClass, requestValveAction, applyGmsValues
 *   - toast, requireOperationMode, manualStateHoldOption
 * 반대로 gms.js의 SHUT-DOWN 버튼 핸들러는 이 파일이 정의하는 showProgressRoot()를 가져다
 * 쓴다 - 두 파일 다 클릭 이벤트로만 실행되므로 <script> 로드 순서만 지키면 실행 순서는
 * 문제되지 않는다.
 */

// ── 진행 메뉴(A 진행/B 진행 → [X] 메인 메뉴 → 유지 보수 → PASSWORD) - 순간정전/유지보수
// 매뉴얼의 화면 흐름(초기 화면 → "A/B 진행" → "[X] 메인 메뉴" → 가스공급/실린더 교환/
// 유지보수/TREND → [유지 보수는] Password 입력 → 유지보수 메뉴)을 그대로 따른다.
// 화면 전환/자릿수 입력만 실제로 동작하고, 그 안의 개별 메뉴 동작·비밀번호 검증은 아직 뼈대뿐이다.
//
// 화면별 마크업은 더 이상 gms.html에 없다 - `OPERATION HTML/` 폴더에 화면 하나당 파일 하나로
// 분리되어 있다(진행 메뉴.html/메인 메뉴.html/PASSWORD.html/유지보수 메뉴.html/수동 밸브
// 조작.html/히터 조작.html/Maintenance Purge.html). 아래 7개 컨테이너는 gms.html에는 빈
// 채로 있고, loadOperationScreens()가 페이지 로드 시 그 파일들을 fetch해서 채워 넣는다.
// 버튼 이벤트는 자식 요소가 실제로 존재해야 연결할 수 있으므로 wireOperationScreens()에
// 모아뒀다가 fetch가 끝난 뒤에만 호출한다. ──
const progressHeader = document.getElementById('progressHeader');
const progressRootBody = document.getElementById('progressRootBody');
const progressMainMenuBody = document.getElementById('progressMainMenuBody');
const progressPasswordBody = document.getElementById('progressPasswordBody');
const progressMaintenanceMenuBody = document.getElementById('progressMaintenanceMenuBody');
const progressManualValveBody = document.getElementById('progressManualValveBody');
const progressHeaterBody = document.getElementById('progressHeaterBody');
const progressMaintenancePurgeBody = document.getElementById('progressMaintenancePurgeBody');
const progressPipeCleanBody = document.getElementById('progressPipeCleanBody');
const progressLeakTestBody = document.getElementById('progressLeakTestBody');
const progressVtTestBody = document.getElementById('progressVtTestBody');
const progressPtTestBody = document.getElementById('progressPtTestBody');
const progressPressureTestBody = document.getElementById('progressPressureTestBody');
const progressBarcodeCheckBody = document.getElementById('progressBarcodeCheckBody');
const progressCylinderLockCheckBody = document.getElementById('progressCylinderLockCheckBody');
const progressPulsAutoRunBody = document.getElementById('progressPulsAutoRunBody');
const progressOnePAutoRunBody = document.getElementById('progressOnePAutoRunBody');
const progressExchangePressureTestBody = document.getElementById('progressExchangePressureTestBody');
const progressExchangeVtTestBody = document.getElementById('progressExchangeVtTestBody');
const progressExchangeSecondPurgeBody = document.getElementById('progressExchangeSecondPurgeBody');
const progressCylReplaceCheckBody = document.getElementById('progressCylReplaceCheckBody');
const progressCylReplaceValveOpenBody = document.getElementById('progressCylReplaceValveOpenBody');
const progressCylReplaceAutoGuardOpenBody = document.getElementById('progressCylReplaceAutoGuardOpenBody');
const progressCylReplaceSwapBody = document.getElementById('progressCylReplaceSwapBody');
const progressCylReplaceGasNameBody = document.getElementById('progressCylReplaceGasNameBody');
const progressCylReplaceAutoGuardCloseBody = document.getElementById('progressCylReplaceAutoGuardCloseBody');
const progressExchangeAfterPressureTestBody = document.getElementById('progressExchangeAfterPressureTestBody');
const progressExchangeAfterPulsBody = document.getElementById('progressExchangeAfterPulsBody');
const progressExchangeThirdPurgeBody = document.getElementById('progressExchangeThirdPurgeBody');
const progressExchangeAfterVtTestBody = document.getElementById('progressExchangeAfterVtTestBody');
const progressExchangeFourthPurgeBody = document.getElementById('progressExchangeFourthPurgeBody');
const progressExchangePurgeCompleteBody = document.getElementById('progressExchangePurgeCompleteBody');
const progressCylReplaceForcePurgeBody = document.getElementById('progressCylReplaceForcePurgeBody');
const progressGasSupplyPressureCheckBody = document.getElementById('progressGasSupplyPressureCheckBody');
const progressGasSupplyValveShutterBody = document.getElementById('progressGasSupplyValveShutterBody');
const progressGasSupplyRegulatorCloseBody = document.getElementById('progressGasSupplyRegulatorCloseBody');
const progressGasSupplyCylinderOpenBody = document.getElementById('progressGasSupplyCylinderOpenBody');
const progressGasSupplyRegulatorAdjustBody = document.getElementById('progressGasSupplyRegulatorAdjustBody');
const progressGasSupplyPmvOpenBody = document.getElementById('progressGasSupplyPmvOpenBody');
const progressGasSupplyReadyBody = document.getElementById('progressGasSupplyReadyBody');
const progressGasSupplyActiveBody = document.getElementById('progressGasSupplyActiveBody');
const progressGasSupplyConfirmActionBody = document.getElementById('progressGasSupplyConfirmActionBody');
const progressTrendBody = document.getElementById('progressTrendBody');
const progressAdjustModeBody = document.getElementById('progressAdjustModeBody');
// 조정모드 화면의 "압력조정" 버튼으로 들어가는 PT/Weight 교정 표 화면(public/gms-pt-calibration.js).
const progressPressureAdjustBody = document.getElementById('progressPressureAdjustBody');
// 보조 메뉴의 "작업이력" 버튼으로 들어가는 조작 이력 표 화면(public/gms-worklog-widget.js).
const progressWorkLogBody = document.getElementById('progressWorkLogBody');
// 보조 메뉴의 "에러사항" 버튼으로 들어가는, 서브시퀀스 실제 알람만 모아 보는 표 화면
// (public/gms-errorlog-widget.js) - 작업이력과 화면 구조는 같지만 DB는 별개(error_log).
const progressErrorLogBody = document.getElementById('progressErrorLogBody');
// 보조 메뉴의 "설정모드 A/B" 버튼으로 들어가는, CONFIG 탭 설정값을 side/OPTION으로 걸러서
// 키패드로 편집하는 화면(public/gms-configmode-widget.js + gms-configmode-tab.js).
const progressConfigModeBody = document.getElementById('progressConfigModeBody');
// 보조 메뉴의 "OPTION DISPLAY" 버튼으로 들어가는 OPTION 탭 읽기 전용 표시 화면
// (public/gms-option-display.js).
const progressOptionDisplayBody = document.getElementById('progressOptionDisplayBody');
// 보조 메뉴의 "유지보수모드" 버튼으로 들어가는 PM Mode/Set-up Mode 화면 - 기존 조작화면의
// "유지 보수"(메인 메뉴 → 수동밸브조작 등)와는 완전히 다른 화면이다.
const progressAuxMaintenanceModeBody = document.getElementById('progressAuxMaintenanceModeBody');
// Main Sequence.csv에는 있지만 화면이 없던 3단계(Puls/Bypass/RGV) - Main 시퀀스 편집기용.
const progressSequencePulsBody = document.getElementById('progressSequencePulsBody');
const progressSequenceBypassBody = document.getElementById('progressSequenceBypassBody');
const progressSequenceRgvBody = document.getElementById('progressSequenceRgvBody');

// ── 보조 메뉴 팝업 - 진행 메뉴/메인 메뉴/PC/가스공급 중 화면의 "보조 메뉴" 버튼이 공용으로
// 연다. 팝업 자체(#auxMenuModal)는 gms.html에 항상 존재하는 정적 마크업이라(다른 화면들과
// 달리 fragment로 늦게 주입되지 않음) 여기서 바로 wiring한다. "유지보수모드"만 실제로
// 기존 유지보수 메뉴로 이동하고(메인 메뉴의 "유지 보수"와 동일하게 PASSWORD 게이트 포함),
// 나머지 8개는 아직 구현 전이라 안내 토스트만 띄운다. ──
const auxMenuModal = document.getElementById('auxMenuModal');
function openAuxMenu() { auxMenuModal.hidden = false; }
function closeAuxMenu() { auxMenuModal.hidden = true; }
document.getElementById('auxMenuCancelBtn').addEventListener('click', closeAuxMenu);
document.querySelectorAll('.aux-menu-btn[data-aux]').forEach((btn) => {
  btn.addEventListener('click', () => {
    closeAuxMenu();
    toast(`${btn.dataset.aux}는 아직 준비 중입니다.`, '');
  });
});
// ── 보조 메뉴 "유지보수모드" - 기존 조작화면의 "유지 보수"(메인 메뉴 → 수동밸브조작/
// 바코드체크/Maintenance Purge, gateKey 'mainMenu')와는 완전히 다른 화면이다("보조 화면의
// 유지보수모드는 기존 조작화면의 유지보수와는 메뉴가 틀립니다" 요청) - PASSWORD(게이트
// 'auxMaintenanceMode') 통과 후 PM Mode/Set-up Mode를 적용/미적용 하는 화면으로 간다.
// window.requestAuxMaintenanceMode로 노출해서 gms.js의 etc 행 PM/SETUP 램프 클릭에서도
// 같은 진입점을 쓴다. ──
function renderAuxMaintenanceModeScreen() {
  const pmBtn = document.getElementById('pmModeToggleBtn');
  const setupBtn = document.getElementById('setupModeToggleBtn');
  if (pmBtn) {
    pmBtn.textContent = pmModeActive ? '적용' : '미적용';
    pmBtn.classList.toggle('primary', pmModeActive);
  }
  if (setupBtn) {
    setupBtn.textContent = setupModeActive ? '적용' : '미적용';
    setupBtn.classList.toggle('primary', setupModeActive);
  }
}
async function toggleMaintenanceMode(mode) {
  const nextActive = mode === 'pm' ? !pmModeActive : !setupModeActive;
  try {
    const res = await fetch('/api/gms/maintenance-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, active: nextActive }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || '변경 실패');
    // 서버가 웹소켓(gmsMaintenanceMode)으로도 방송하지만, 방금 이 화면에서 누른 결과를
    // 기다리지 않고 바로 반영하기 위해 applyMaintenanceModeState도 직접 호출한다.
    if (window.applyMaintenanceModeState) window.applyMaintenanceModeState(data);
    // 어느 방향으로 눌렀는지(적용 vs 미적용)에 따라 buttonId를 다르게 남겨야 작업이력에서
    // 구분된다(logWorkAction은 buttonId 하나당 고정 문구만 찾으므로).
    const buttonId = mode === 'pm'
      ? (nextActive ? 'pmModeOnBtn' : 'pmModeOffBtn')
      : (nextActive ? 'setupModeOnBtn' : 'setupModeOffBtn');
    logWorkAction(buttonId, null);
    renderAuxMaintenanceModeScreen();
  } catch (e) {
    toast('변경 실패: ' + e.message, 'err');
  }
}
function showProgressAuxMaintenanceMode() {
  showProgressScreen('auxMaintenanceMode', screenTitleFor('auxMaintenanceMode', '유지보수모드'));
  renderAuxMaintenanceModeScreen();
}
window.requestAuxMaintenanceMode = function requestAuxMaintenanceMode(buttonId) {
  logWorkAction(buttonId || 'auxMenuMaintenanceBtn', progressCurrentSide);
  closeAuxMenu();
  proceedPastPasswordGate('auxMaintenanceMode', showProgressAuxMaintenanceMode);
};
document.getElementById('auxMenuMaintenanceBtn').addEventListener('click', () => {
  window.requestAuxMaintenanceMode('auxMenuMaintenanceBtn');
});

// ── 압력 조정 모드 - 보조 메뉴의 "조정모드 A/B"가 PASSWORD 게이트(adjustMode)를 거쳐 여는
// 진짜 화면(유지보수 메뉴와 동일하게 팝업이 아니라 화면 전환). TREND(trendPrevScreen)와
// 같은 방식으로 들어오기 직전 화면을 기억해뒀다가 "확인"/"취소"에서 그 화면으로 되돌아간다.
// 인터락: 그 side의 Status가 Service(가스공급 중)이면 애초에 진입 자체를 막는다 - 공급
// 중에는 압력 조정이 안전하지 않기 때문(요청사항). 화면 자체(버튼 wiring)는 fragment로
// 늦게 주입되므로 wireOperationScreens()에서 연결한다. ──
// proceedPastPasswordGate()는 게이트가 켜져있으면 PASSWORD 화면으로 넘어가면서 directAction
// 클로저를 버린다(실제 진입은 passwordConfirmBtn 핸들러의 gateKey 분기가 담당) - 그래서
// side를 클로저가 아니라 이 변수로 넘겨야 한다(다른 게이트들의 관례와 동일).
let adjustModePrevScreen = null;
let pendingAdjustModeSide = null;
function requestAdjustMode(side) {
  if (CYLINDER_STEP_ORDER[cylinderCurrentStepIndex[side]] === 'Service') {
    closeAuxMenu();
    toast(`[${side}] 가스공급 중에는 조정모드에 진입할 수 없습니다(인터락).`, 'err');
    return;
  }
  const currentEntry = Object.entries(progressScreens).find(([, el]) => el.style.display === '');
  adjustModePrevScreen = { name: currentEntry ? currentEntry[0] : 'root', header: progressHeader.textContent };
  pendingAdjustModeSide = side;
  closeAuxMenu();
  proceedPastPasswordGate('adjustMode', () => showProgressAdjustMode(side));
}
function showProgressAdjustMode(side) {
  // progressCurrentSide를 여기서 반드시 갱신해야 한다 - 이전엔 헤더 문구에만 side를 썼을 뿐
  // 전역 progressCurrentSide는 그대로 둬서, 예를 들어 A측 화면을 보다가 보조 메뉴의
  // "조정모드 B"를 누르면 헤더는 "[B] 압력 조정 모드"로 바뀌어도 progressCurrentSide는
  // 여전히 'A'로 남아 있었다(이 화면 자체는 side를 매개변수로만 받아 문제없었지만, 다음
  // 화면인 압력조정이 progressCurrentSide를 읽어 B측 태그를 보여줘야 하는데 A측을 보여주는
  // 버그로 이어졌다).
  progressCurrentSide = side;
  if (window.stopSubSequenceRunner) window.stopSubSequenceRunner(); // 화면을 (다시) 들어올 때는 항상 대기 상태(idle 패널)로 보여준다
  showProgressScreen('adjustMode', sideScreenTitle('adjustMode', '압력 조정 모드', side));
}
function exitAdjustMode() {
  if (adjustModePrevScreen) {
    showProgressScreen(adjustModePrevScreen.name, adjustModePrevScreen.header);
    if (adjustModePrevScreen.name === 'gasSupplyPressureCheck' && typeof updateGspPressureCheckReadouts === 'function') {
      updateGspPressureCheckReadouts();
    }
    adjustModePrevScreen = null;
  } else {
    showProgressRoot();
  }
}
// ── 설정모드 A/B - 보조 메뉴에서 PASSWORD 게이트 없이 바로 여는 화면(작업이력/에러사항과 동일 -
// 조정모드와 달리 인터락/게이트가 필요하다는 요청이 없었음). 버튼 2개가 화면 1개를 공유하고
// side를 명시적으로 넘기는 것은 조정모드 A/B와 동일한 패턴(progressCurrentSide를 여기서
// 갱신해야 하는 이유도 동일 - showProgressAdjustMode의 주석 참고). ──
let configModePrevScreen = null;
function requestConfigMode(side) {
  const currentEntry = Object.entries(progressScreens).find(([, el]) => el.style.display === '');
  configModePrevScreen = { name: currentEntry ? currentEntry[0] : 'root', header: progressHeader.textContent };
  closeAuxMenu();
  showProgressConfigMode(side);
}
function showProgressConfigMode(side) {
  progressCurrentSide = side;
  showProgressScreen('configMode', sideScreenTitle('configMode', '설정모드', side));
  window.loadGmsWidgetModule('configmode', './gms-configmode-grid/gms-configmode-widget.js').then(() => {
    window.initGmsConfigModeGrid('gmsConfigModeGridContainer', side).then(() => {
      if (window.wireGmsConfigModeKeypad) window.wireGmsConfigModeKeypad();
    });
  });
}
function exitConfigMode() {
  if (configModePrevScreen) {
    showProgressScreen(configModePrevScreen.name, configModePrevScreen.header);
    configModePrevScreen = null;
  } else {
    showProgressRoot();
  }
}
document.getElementById('auxMenuConfigModeABtn').addEventListener('click', () => {
  logWorkAction('auxMenuConfigModeABtn', 'A');
  requestConfigMode('A');
});
document.getElementById('auxMenuConfigModeBBtn').addEventListener('click', () => {
  logWorkAction('auxMenuConfigModeBBtn', 'B');
  requestConfigMode('B');
});

document.getElementById('auxMenuAdjustABtn').addEventListener('click', () => {
  logWorkAction('auxMenuAdjustABtn', 'A');
  requestAdjustMode('A');
});
document.getElementById('auxMenuAdjustBBtn').addEventListener('click', () => {
  logWorkAction('auxMenuAdjustBBtn', 'B');
  requestAdjustMode('B');
});

// ── 작업이력 - 보조 메뉴의 "작업이력" 버튼이 여는 화면(팝업 아님, 유지보수/조정모드와 동일한
// 진짜 화면 전환). 조회 전용이라 별도 PASSWORD 게이트는 두지 않는다. 그리드
// (grid-app/src/gms-worklog-widget.js)는 USER 탭과 같은 이유로 처음 열 때만 마운트한다
// (hidden 컨테이너에 바로 마운트하면 크기가 0이 되는 문제 - gms.js 참고). ──
function showProgressWorkLog() {
  showProgressScreen('workLog', screenTitleFor('workLog', '작업이력'));
  const workLogContainer = document.getElementById('gmsWorkLogGridContainer');
  void workLogContainer.offsetHeight; // 강제 리플로우
  window.loadGmsWidgetModule('worklog', './gms-worklog-grid/gms-worklog-widget.js').then(() => {
    setTimeout(() => window.initGmsWorkLogGrid('gmsWorkLogGridContainer'), 0);
  });
}
document.getElementById('auxMenuWorkLogBtn').addEventListener('click', () => {
  logWorkAction('auxMenuWorkLogBtn', progressCurrentSide);
  closeAuxMenu();
  showProgressWorkLog();
});

// ── 에러사항 - 작업이력과 완전히 같은 패턴(팝업 아님, 조회 전용이라 PASSWORD 게이트 없음,
// 처음 열 때만 그리드 마운트). public/gms-sub-sequence-runner.js가 실제 Alarm Seq. 동작이
// 일어날 때만 기록한 것만 모아 보여준다(DB는 작업이력과 별개 - error_log). ──
function showProgressErrorLog() {
  showProgressScreen('errorLog', screenTitleFor('errorLog', '에러사항'));
  const errorLogContainer = document.getElementById('gmsErrorLogGridContainer');
  void errorLogContainer.offsetHeight; // 강제 리플로우
  window.loadGmsWidgetModule('errorlog', './gms-errorlog-grid/gms-errorlog-widget.js').then(() => {
    setTimeout(() => window.initGmsErrorLogGrid('gmsErrorLogGridContainer'), 0);
  });
}
document.getElementById('auxMenuErrorLogBtn').addEventListener('click', () => {
  logWorkAction('auxMenuErrorLogBtn', progressCurrentSide);
  closeAuxMenu();
  showProgressErrorLog();
});

// ── OPTION DISPLAY - 보조 메뉴의 "OPTION DISPLAY" 버튼이 여는 화면(작업이력과 동일한 패턴 -
// 팝업 아님, 조회 전용이라 PASSWORD 게이트 없음). OPTION 탭 설정값을 읽기 전용으로 보여주기만
// 하므로(요청사항: "변경권한은 없음") Univer 그리드가 아니라 일반 표(public/gms-option-display.js)
// 로 그린다 - 마운트 지연 문제 자체가 없어 작업이력/USER 탭처럼 별도 lazy-mount 처리가
// 필요 없고, 화면을 열 때마다 renderOptionDisplay()로 다시 그리기만 하면 된다. ──
function showProgressOptionDisplay() {
  showProgressScreen('optionDisplay', screenTitleFor('optionDisplay', 'OPTION DISPLAY'));
  if (window.wireOptionDisplayOnce) window.wireOptionDisplayOnce();
  if (window.renderOptionDisplay) window.renderOptionDisplay();
}
document.getElementById('auxMenuOptionDisplayBtn').addEventListener('click', () => {
  logWorkAction('auxMenuOptionDisplayBtn', progressCurrentSide);
  closeAuxMenu();
  showProgressOptionDisplay();
});

const progressScreens = {
  root: progressRootBody, mainMenu: progressMainMenuBody, password: progressPasswordBody,
  maintenanceMenu: progressMaintenanceMenuBody, manualValve: progressManualValveBody,
  heater: progressHeaterBody, maintenancePurge: progressMaintenancePurgeBody,
  pipeClean: progressPipeCleanBody, leakTest: progressLeakTestBody, vtTest: progressVtTestBody,
  ptTest: progressPtTestBody, pressureTest: progressPressureTestBody,
  barcodeCheck: progressBarcodeCheckBody, cylinderLockCheck: progressCylinderLockCheckBody,
  pulsAutoRun: progressPulsAutoRunBody, onePAutoRun: progressOnePAutoRunBody,
  onePPurgeAutoRun: progressOnePPurgeAutoRunBody, onePPumpingAutoRun: progressOnePPumpingAutoRunBody,
  onePPrimaryPurgeAutoRun: progressOnePPrimaryPurgeAutoRunBody,
  exchangePressureTest: progressExchangePressureTestBody,
  exchangeVtTest: progressExchangeVtTestBody, exchangeSecondPurge: progressExchangeSecondPurgeBody,
  cylReplaceCheck: progressCylReplaceCheckBody, cylReplaceValveOpen: progressCylReplaceValveOpenBody,
  cylReplaceAutoGuardOpen: progressCylReplaceAutoGuardOpenBody, cylReplaceSwap: progressCylReplaceSwapBody,
  cylReplaceGasName: progressCylReplaceGasNameBody, cylReplaceAutoGuardClose: progressCylReplaceAutoGuardCloseBody,
  exchangeAfterPressureTest: progressExchangeAfterPressureTestBody,
  exchangeAfterPuls: progressExchangeAfterPulsBody,
  exchangeThirdPurge: progressExchangeThirdPurgeBody,
  exchangeAfterVtTest: progressExchangeAfterVtTestBody, exchangeFourthPurge: progressExchangeFourthPurgeBody,
  exchangePurgeComplete: progressExchangePurgeCompleteBody,
  hpLpPump: progressHpLpPumpBody,
  cylReplaceForcePurge: progressCylReplaceForcePurgeBody,
  gasSupplyPressureCheck: progressGasSupplyPressureCheckBody, gasSupplyValveShutter: progressGasSupplyValveShutterBody,
  gasSupplyRegulatorClose: progressGasSupplyRegulatorCloseBody, gasSupplyCylinderOpen: progressGasSupplyCylinderOpenBody,
  gasSupplyRegulatorAdjust: progressGasSupplyRegulatorAdjustBody, gasSupplyPmvOpen: progressGasSupplyPmvOpenBody,
  gasSupplyFpvOpen: progressGasSupplyFpvOpenBody,
  gasSupplyReady: progressGasSupplyReadyBody,
  gasSupplyActive: progressGasSupplyActiveBody,
  gasSupplyConfirmAction: progressGasSupplyConfirmActionBody,
  trend: progressTrendBody,
  adjustMode: progressAdjustModeBody,
  pressureAdjust: progressPressureAdjustBody,
  workLog: progressWorkLogBody,
  errorLog: progressErrorLogBody,
  configMode: progressConfigModeBody,
  optionDisplay: progressOptionDisplayBody,
  auxMaintenanceMode: progressAuxMaintenanceModeBody,
  sequencePuls: progressSequencePulsBody,
  sequenceBypass: progressSequenceBypassBody,
  sequenceRgv: progressSequenceRgvBody,
};
let progressCurrentSide = null;
// 아래 셋은 각각 progressPasswordBody/progressManualValveBody/progressHeaterBody의 자식
// 요소라 fetch 완료 전엔 존재하지 않는다 - wireOperationScreens()에서 실제 요소로 채워진다.
let passwordDisplay = null;
let manualValveGrid = null;
let manualHeaterGrid = null;

// 다른 페이지로 갔다가 돌아와도(또는 새로고침해도) 조작화면이 처음(진행 메뉴)으로 초기화되지
// 않고 마지막 화면/측(A·B)을 그대로 유지하도록 localStorage에 저장한다.
// 주의: 비밀번호로 들어가는 유지보수 메뉴/수동밸브 조작 화면도 그대로 복원되므로, 새로고침만
// 해도 비밀번호 재입력 없이 그 화면으로 돌아간다(요청에 따른 동작 - 보안이 중요하면 추후 조정 필요).
const PROGRESS_STATE_KEY = 'gmsProgressScreenState';
function saveProgressState(screenName) {
  try { localStorage.setItem(PROGRESS_STATE_KEY, JSON.stringify({ screen: screenName, side: progressCurrentSide })); } catch (e) { /* 무시 */ }
}

/** gms.js의 screenTitles(서버 설정, "화면 제목 설정" 화면에서 엑셀로 편집)에서 그 화면의
    제목을 찾는다 - 없으면(설정 파일이 아직 없거나 그 키가 빠져 있으면) fallback을 그대로
    쓴다. showProgressScreen에 전달할 문구는 전부 이 함수(또는 아래 sideScreenTitle)를
    거쳐야 "화면 제목 설정" 편집이 실제로 반영된다. */
function screenTitleFor(key, fallback) {
  const t = screenTitles.find((x) => x.screenKey === key);
  return (t && t.title) || fallback;
}
/** screenTitleFor에 "[A]/[B] " 접두사를 붙인다(side가 없으면 접두사 없이). 측별 화면
    제목이 필요한 대부분의 showProgressScreen 호출이 이 함수를 쓴다. */
function sideScreenTitle(key, fallback, side) {
  const base = screenTitleFor(key, fallback);
  return side ? `[${side}] ${base}` : base;
}

/** 진행 메뉴 프레임(조작화면) 안의 화면들 중 하나만 보여준다. */
function showProgressScreen(name, headerText) {
  for (const [key, el] of Object.entries(progressScreens)) el.style.display = key === name ? '' : 'none';
  progressHeader.textContent = headerText;
  saveProgressState(name);
  // 작업이력/OPTION DISPLAY 화면은 배관도(.diagram-panel)를 숨기고 op-panel이 그 자리까지
  // 전체 폭을 쓰게 한다(열이 많은 표라 좁은 우측 패널만으론 비좁음 - 요청사항). 다른 화면으로
  // 넘어가면 즉시 원래 레이아웃으로 되돌린다 - showProgressScreen이 모든 화면 전환의
  // 유일한 창구라 여기 한 곳만 지키면 된다. 앞으로 전체 폭이 필요한 화면이 늘어나면
  // FULL_WIDTH_SCREENS에 이름만 추가하면 된다.
  if (typeof setWorkLogFullWidth === 'function') setWorkLogFullWidth(FULL_WIDTH_SCREENS.has(name));
}
const FULL_WIDTH_SCREENS = new Set(['workLog', 'errorLog', 'optionDisplay', 'configMode']);
/** 작업이력/OPTION DISPLAY 같은 "배관도+조작화면 합친 전체 폭" 화면의 레이아웃 on/off -
    gms.js의 tab-switch-bar(CONFIG/OPTION/ALARM/USER/SHUT-DOWN) 클릭 핸들러도 다른 탭으로
    넘어갈 때 이 함수를 불러 되돌린다(그 탭들은 showProgressScreen을 거치지 않으므로
    별도로 챙겨야 한다). */
function setWorkLogFullWidth(active) {
  const diagramPanel = document.querySelector('.diagram-panel');
  const opPanel = document.querySelector('.op-panel');
  if (!diagramPanel || !opPanel) return;
  diagramPanel.style.display = active ? 'none' : '';
  // flex-grow/shrink만 건드리고 flex-basis는 절대 건드리지 않는다 - gms.js의 initHSplitter가
  // 사용자가 드래그로 맞춘 폭을 opPanel.style.flexBasis(+ localStorage 'gmsOpPanelWidth')로
  // 관리하는데, 예전엔 여기서 style.flex 단축 속성을 썼다. 단축 속성은 flex-basis까지 함께
  // 써버리는 값이라, PT값 저장처럼 어떤 화면 전환이든(showProgressScreen이 항상 이 함수를
  // 부른다) 지나가기만 하면 사용자가 맞춰둔 폭이 매번 CSS 기본값(380px)으로 되돌아가는
  // 버그가 있었다(요청사항: "다른 화면으로 전환을 했을 때 원래 돌아가는 것이 아니라 최종값을
  // 그대로 유지").
  opPanel.style.flexGrow = active ? '1' : '';
  opPanel.style.flexShrink = active ? '1' : '';
  opPanel.style.width = active ? '100%' : '';
  opPanel.style.maxWidth = active ? 'none' : '';
}
window.setWorkLogFullWidth = setWorkLogFullWidth;
/** 작업이력 그리드의 "복귀" 버튼(gms-worklog-widget.js)이 부른다 - 선택한 행이 기록될
    당시의 화면(screenKey/screenTitle)으로 그대로 돌아간다. side가 있으면
    progressCurrentSide도 그 측으로 맞춘다(그래야 화면 안의 [A]/[B] 표시나 그 측 데이터가
    올바르게 보인다). */
window.returnToWorkLogScreen = function returnToWorkLogScreen(screenKey, screenTitle, side) {
  if (!progressScreens[screenKey]) {
    toast('그 화면을 찾을 수 없습니다(삭제되었거나 이름이 바뀐 화면일 수 있습니다).', 'err');
    return;
  }
  if (side) progressCurrentSide = side;
  showProgressScreen(screenKey, screenTitle || screenKey);
};
function showProgressMainMenu(side) {
  progressCurrentSide = side;
  showProgressScreen('mainMenu', sideScreenTitle('mainMenu', '메인 메뉴', side));
  document.getElementById('mainMenuSwitchSideBtn').textContent = side === 'A' ? '"B" 선택' : '"A" 선택';
}
function showProgressRoot() {
  progressCurrentSide = null;
  showProgressScreen('root', screenTitleFor('root', '진행 메뉴'));
}

// ── TREND 화면 - 각 시퀀스 화면의 "TREND" 버튼(~10곳)이 전부 이 화면을 연다. 배관도화면
// 쪽은 gms.js의 openGmsTrend()/closeGmsTrend()가 #gmsSvg↔#gmsTrendCanvas를 전환한다.
// "이전화면"을 누르면 TREND 열기 직전에 보이던 화면(이름+헤더 텍스트)으로 정확히 되돌아간다. ──
let trendPrevScreen = null;
function showGmsTrend() {
  const currentEntry = Object.entries(progressScreens).find(([, el]) => el.style.display === '');
  trendPrevScreen = { name: currentEntry ? currentEntry[0] : 'root', header: progressHeader.textContent };
  showProgressScreen('trend', screenTitleFor('trend', 'TREND'));
  if (window.openGmsTrend) window.openGmsTrend();
}
function showProgressTrendBack() {
  const prev = trendPrevScreen || { name: 'root', header: '진행 메뉴' };
  showProgressScreen(prev.name, prev.header);
  if (window.closeGmsTrend) window.closeGmsTrend();
}

// ── PASSWORD 입력 화면 - 유지 보수 진입 시 거치는 단계. 숫자 키패드로 자릿수를 모아
// 마스킹(●) 표시하고, 확인/취소/CLR/⌫만 실제로 동작한다(검증 로직은 아직 없음). ──
let passwordDigits = '';
function renderPasswordDisplay() {
  if (!passwordDigits) {
    passwordDisplay.innerHTML = '<span class="placeholder">PASSWORD</span>';
    return;
  }
  // 점을 개별 span으로 flex 배치해야 letter-spacing 방식의 중앙정렬 쏠림 없이 정확히 가운데
  // 맞는다(.password-display CSS 주석 참고).
  passwordDisplay.innerHTML = '<span class="password-dots">'
    + '●'.repeat(passwordDigits.length).split('').map((c) => `<span>${c}</span>`).join('')
    + '</span>';
}
// PASSWORD 화면에서 "취소"를 눌렀을 때 되돌아갈 화면 - 메인 메뉴에서 "유지 보수"로
// 들어온 경우('mainMenu')와 수동밸브 조작/히터 조작에서 "취소"로 나가며 재확인차 들른
// 경우('manualValve'/'heater')가 서로 다르다. showProgressPassword() 호출부마다 명시해서
// 지정한다 - 안 그러면 이전 방문의 값이 남아있어(예: 수동밸브 조작에서 나왔는데 메인
// 메뉴로 잘못 튕기는 버그) 항상 인자를 넘기도록 강제한다.
let passwordCancelTarget = 'mainMenu';
// 안내 문구("비밀번호를 입력하십시오.") 바로 위에 "지금 무엇 때문에 PASSWORD를 요구하는지"
// 보여준다 - cancelTarget과 1:1로 대응한다. 화면이 늘어나 showProgressPassword()에 새
// cancelTarget이 추가되면 여기에도 문구를 같이 추가해야 한다.
const PASSWORD_CONTEXT_LABELS = {
  mainMenu: '유지보수',
  manualValve: '수동 밸브 조작 취소',
  heater: '히터 조작 취소',
  cylinderExchange: '실린더 교환',
  cylinderLockCheck: '교환전 취소',
  cylinderExchangeDone: '실린더 교체',
  cylReplace: '용기교체 취소',
  exchangeAfterCancel: '교환후 취소',
  postPcCancel: '퍼지완료 이후 취소',
  cylReplaceDone: '용기교체 완료',
  exchangeFourthPurgeDone: '퍼지 완료',
  statusJump: 'Status Jump',
  gasSupplyEntry: '가스공급',
  gasSupplyPauseEntry: '일시정지',
  gasSupplyStopEntry: '공급중지',
  gasSupplyForceChangeEntry: '강제교체',
  adjustMode: '조정모드',
  lineVent: 'Line Vent',
  workLogClear: '작업이력 Data Clear',
  errorLogClear: '에러사항 Data Clear',
  auxMaintenanceMode: '유지보수모드(PM/Set-up)',
};
// cylReplace/exchangeAfterCancel로 PASSWORD에 들어왔을 때, 취소를 다시 눌러 되돌아갈
// 화면(용기교체 CC 6단계 또는 교환후 +L~4P 4단계 중 어느 화면에서 취소를 눌렀는지) -
// showProgressPassword() 호출 직전에 지정한다.
let cylReplaceCancelFromKey = null;
// CYLINDER STEP STATUS 배지(위 CYLINDER_STEP_ORDER)를 클릭했을 때 이동할 화면 - 배열
// 위치가 CYLINDER_STEP_ORDER의 인덱스와 그대로 대응한다("-VT"가 두 번 나오는 문제를
// 텍스트가 아니라 배지의 DOM 위치(인덱스)로 클릭을 구분해 피한다). 실제 진입 화면 key는
// entryScreenKeyForIndex(idx)가 계산한다(더 아래 정의, CYLINDER_STEP_ORDER 관련 블록) -
// Main 시퀀스 편집기로 순서를 바꿔도 이 함수 하나만 있으면 항상 올바르게 갈린다. ──
// requestStatusJump()가 지정해두고, PASSWORD 확인 후(또는 Status Jump 옵션 미적용 시
// 즉시) performStatusJump()가 읽어서 실제로 이동한다.
let statusJumpTarget = null;
function performStatusJump() {
  if (!statusJumpTarget) return;
  const { side, idx } = statusJumpTarget;
  logWorkAction('statusJumpBadge', side);
  progressCurrentSide = side;
  const progressTabBtn = document.querySelector('.tab-switch-btn[data-tab="progress"]');
  if (progressTabBtn) progressTabBtn.click();
  const type = CYLINDER_STEP_ORDER[idx];
  if (type === 'Service') { showProgressGasSupplyActive(side); return; }
  if (type === 'READY') {
    // READY 배지는 "이미 준비를 마친 상태"를 가리키므로 가스공급준비 7단계 중 마지막
    // (가스공급준비 완료) 화면으로 바로 간다 - 처음부터 다시 거칠 필요 없음.
    showProgressGasSupplyStep(GAS_SUPPLY_STEPS.findIndex((s) => s.key === 'gasSupplyReady'));
    return;
  }
  if (type === 'GSP') {
    // GSP(가스공급 진행) 배지는 준비 절차 자체를 가리키므로 7단계 중 처음(공급 압력 확인)
    // 화면부터 다시 보여준다 - RGV와 별개 Status라 자체 진입 지점을 갖는다.
    showProgressGasSupplyStep(0);
    return;
  }
  if (type === 'IDLE') {
    // IDLE로 점프 - Status 자체를 되돌려야 하므로 resetCylinderStepStatus로 인덱스도 함께 갱신한다.
    resetCylinderStepStatus(side);
    showProgressCylinderLockCheck();
    return;
  }
  const targetKey = entryScreenKeyForIndex(idx);
  if (!targetKey) { toast('아직 준비되지 않은 Status입니다.', ''); return; }
  showProgressCylExchangePurgeStep(CYL_EXCHANGE_PURGE_STEPS.findIndex((s) => s.key === targetKey));
}
/** progressCurrentSide를 side로 바꾸고, 그 측의 "현재 실제 Status"에 해당하는 화면을 그대로
 * 보여준다 - Status Jump(performStatusJump)와 달리 인덱스를 건드리거나 초기화하지 않는
 * 순수 화면 전환이다(양쪽 측의 진행 상태를 그대로 유지 - "상태 유지"). IDLE/CC는 PASSWORD
 * 재확인이 필요한 실린더 교환 진입/재개 지점이라 이 버튼(비밀번호 없는 단순 보기 전환)
 * 에서는 그 화면으로 바로 들여보내지 않고 메인 메뉴로 보여준다(정식 재진입은 메인 메뉴의
 * "실린더 교환" 버튼 → PASSWORD를 거쳐야 한다). Service/READY는 각각 가스공급 중/
 * 가스공급준비 화면으로, 그 외 Status(1P~4P, PC)는 해당 화면을 그대로 보여주고, 아직
 * 화면이 없는 Status는 메인 메뉴로 대신 보여준다. */
function showScreenForSideStatus(side) {
  const idx = cylinderCurrentStepIndex[side];
  const stepKey = CYLINDER_STEP_ORDER[idx];
  progressCurrentSide = side;
  const progressTabBtn = document.querySelector('.tab-switch-btn[data-tab="progress"]');
  if (progressTabBtn) progressTabBtn.click();
  if (stepKey === 'IDLE' || stepKey === 'CC') { showProgressMainMenu(side); return; }
  if (stepKey === 'Service') { showProgressGasSupplyActive(side); return; }
  if (stepKey === 'READY') {
    showProgressGasSupplyStep(GAS_SUPPLY_STEPS.findIndex((s) => s.key === 'gasSupplyReady'));
    return;
  }
  if (stepKey === 'GSP') {
    // GSP(가스공급 진행) 중간 어느 단계였는지는 따로 기억하지 않으므로(1P 하위 5단계와
    // 동일한 한계) 첫 화면(공급 압력 확인)으로 보여준다.
    showProgressGasSupplyStep(0);
    return;
  }
  const targetKey = entryScreenKeyForIndex(idx);
  if (!targetKey) { showProgressMainMenu(side); return; }
  showProgressCylExchangePurgeStep(CYL_EXCHANGE_PURGE_STEPS.findIndex((s) => s.key === targetKey));
}
/** CYLINDER STEP STATUS 배지 클릭 - Status Jump 옵션이 적용이면 PASSWORD 확인 후, 미적용이면
 * 바로 해당 Status의 첫 화면으로 조작화면을 이동시킨다. */
function requestStatusJump(side, idx) {
  // 인터락: 서브시퀀스(Puls/1P/실린더 잠금check 등) 실행 중에 Status Jump로 건너뛰면
  // 밸브/타이머/진행횟수 상태가 붕 뜬 채 남아 다음 재진입이 꼬일 수 있다 - 실행 중인
  // 서브시퀀스를 먼저 정상적으로 마치거나 "취소"로 정리한 뒤에만 Jump를 허용한다.
  if (window.isSubSequenceRunningForSide && window.isSubSequenceRunningForSide(side)) {
    toast('서브시퀀스가 진행 중입니다 - 완료하거나 취소한 뒤 Status Jump를 이용해 주세요.', 'err');
    return;
  }
  statusJumpTarget = { side, idx };
  proceedPastPasswordGate('statusJump', performStatusJump);
}
// 퍼지완료(PC) 화면의 "취소" 2단 확인 무장 상태 - showProgressCylExchangePurgeStep이 이
// 화면에 들어올 때마다 초기화한다(다른 화면을 거쳐 다시 들어왔을 때 이전 무장 상태가
// 남아있어 한 번만 눌러도 바로 초기화되는 일이 없도록).
let pcCancelArmed = false;
let passwordPreviousScreenInfo = null;
function showProgressPassword(cancelTarget) {
  // 비밀번호 화면으로 전환되기 직전, 현재 표시 중이던 화면 정보(화면명, 헤더 문구, side) 백업
  const currentVisibleEntry = Object.entries(progressScreens).find(([k, el]) => k !== 'password' && el && el.style.display === '');
  if (currentVisibleEntry) {
    passwordPreviousScreenInfo = {
      name: currentVisibleEntry[0],
      header: progressHeader ? progressHeader.textContent : '',
      side: progressCurrentSide,
    };
  }

  passwordCancelTarget = cancelTarget;
  passwordDigits = '';
  renderPasswordDisplay();
  const contextLabel = document.getElementById('passwordContextLabel');
  if (contextLabel) {
    const text = PASSWORD_CONTEXT_LABELS[cancelTarget] || '';
    contextLabel.textContent = progressCurrentSide ? `[${progressCurrentSide}] ${text}` : text;
  }
  showProgressScreen('password', sideScreenTitle('password', 'PASSWORD', progressCurrentSide));
}
// USER 탭에 계정이 하나도 없을 때만 쓰는 최후의 안전장치 비밀번호(passwordConfirmBtn
// 참고) - 정상 운영 중(계정이 등록되어 있으면)에는 쓰이지 않는다.
const MAINTENANCE_PASSWORD = '4321';

// ── 작업이력(work_log) 기록 - "보조 메뉴 > 작업이력" 화면에 표시된다. 마지막으로 PASSWORD를
// 통과한 사람을 기억해뒀다가, PASSWORD 없이 눌린 실행/확인 버튼은 이 사람 이름으로 그대로
// 기록한다(요청사항: "패스워드는 없이 Key 눌렀을 때에는 최종 USER를 그대로 Copy"). ──
let currentGmsOperator = null; // { name, role } | null
// 작업이력 "Data Clear" - 탭(A/B)별로 나눠서 지우고, 반드시 PASSWORD를 통과해야 한다("반드시
// 비밀번호 시퀀스 통과한 후 지워져야 함" 요청 - OPTION 탭 게이트 토글로 우회되면 안 되므로
// proceedPastPasswordGate가 아니라 showProgressPassword를 직접 호출한다). 확인을 누른 사람은
// currentGmsOperator에 그대로 반영되고, 아래 passwordConfirmBtn 분기에서 logWorkAction으로
// work_log에 남겨 "누가 지웠는지" 이력에 남긴다.
let pendingWorkLogClearSide = null;
window.requestWorkLogDataClear = function requestWorkLogDataClear(side) {
  pendingWorkLogClearSide = side;
  progressCurrentSide = side;
  showProgressPassword('workLogClear');
};
// 에러사항 "Data Clear" - 작업이력과 완전히 같은 패턴(반드시 PASSWORD 통과, DB는 안 지움).
let pendingErrorLogClearSide = null;
window.requestErrorLogDataClear = function requestErrorLogDataClear(side) {
  pendingErrorLogClearSide = side;
  progressCurrentSide = side;
  showProgressPassword('errorLogClear');
};
/** 실행/확인류 버튼 핸들러 맨 앞에서 호출한다. buttonId로 gms.js의 workLogMessages에서
    표시 문구를 찾고, 그 순간의 PT/Weight 아날로그값(gms.js의 lastPtByTag)을 함께 남긴다.
    서버 기록은 실패해도 화면 동작을 막지 않는다(then/catch 모두 무시). */
function logWorkAction(buttonId, side) {
  try {
    const msgDef = workLogMessages.find((m) => m.buttonId === buttonId);
    // 지금 보이는 화면(progressScreens 중 display:''인 것)을 "복귀" 대상으로 함께 남긴다 -
    // logWorkAction은 항상 그 버튼이 실제로 눌린 화면이 아직 그대로 보이는 시점(핸들러
    // 맨 앞)에서 호출되므로 이 시점의 화면이 곧 그 버튼이 속한 화면이다.
    const visibleEntry = Object.entries(progressScreens).find(([, el]) => el.style.display === '');
    const screenKey = visibleEntry ? visibleEntry[0] : null;
    const screenTitle = progressHeader ? progressHeader.textContent : '';
    const statusLabel = side ? (CYLINDER_STEP_LABELS[CYLINDER_STEP_ORDER[cylinderCurrentStepIndex[side]]] || '') : '';
    // buttonId는 항상 실제 클릭된 요소의 DOM id와 같게 넘기므로(템플릿 리터럴로 만든
    // buttonId 포함) 그 요소를 그대로 찾아 화면에 실제로 보이는 문구를 함께 남긴다 -
    // "조작 Key" 열에서 buttonId 접미사로 추측한 한글(실행/확인/취소 등)이 아니라 사람이
    // 실제로 본 버튼 글자 그대로("" 안에 표시)를 보여주기 위함(배지 클릭처럼 buttonId가
    // 실제 DOM id가 아닌 경우는 null - 그리드가 메시지 설정으로 대체 표시한다).
    const btnEl = document.getElementById(buttonId);
    const buttonLabel = btnEl ? btnEl.textContent.trim() : null;
    fetch('/api/gms/worklog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitId: selectedUnitId,
        action: buttonId,
        side: side || null,
        detail: msgDef ? msgDef.message : buttonId,
        operatorName: currentGmsOperator ? currentGmsOperator.name : null,
        operatorRole: currentGmsOperator ? currentGmsOperator.role : null,
        analogSnapshot: { ...lastPtByTag },
        screenKey,
        screenTitle,
        statusLabel,
        buttonLabel,
      }),
    }).catch(() => { /* 이력 기록 실패가 조작 자체를 막으면 안 됨 */ });
  } catch (e) { /* 무시 */ }
}
/** gms.js의 passwordGateEnabled(gateKey)이 "적용"이면 PASSWORD 화면을 띄우고, "미적용"이면
 * PASSWORD 없이 directAction()을 바로 실행한다 - PASSWORD를 여는 모든 지점이 이 함수를
 * 거치도록 해서, gms.js OPTION 탭의 개별 토글이 실제로 전부 반영되게 한다. */
function proceedPastPasswordGate(gateKey, directAction) {
  if (passwordGateEnabled(gateKey)) {
    showProgressPassword(gateKey);
  } else {
    // 비밀번호 옵션이 미적용(체크 해제)인 경우: 비밀번호 화면을 띄우지 않고 즉시 취소/실행 처리
    if (['cylinderLockCheck', 'cylReplace', 'exchangeAfterCancel', 'postPcCancel'].includes(gateKey)) {
      if (typeof window.stopAllSubSequences === 'function') window.stopAllSubSequences();
    }
    directAction();
  }
}

// ── 유지보수 메뉴 - PASSWORD 통과 후 화면. 메뉴얼 기준 우선 3개 항목만(수동밸브조작/
// 바코드 체크/Maintenance Purge) - 나머지(ESO Valve 조작 등)는 다음 단계에서 추가. ──
function showProgressMaintenanceMenu() {
  showProgressScreen('maintenanceMenu', sideScreenTitle('maintenanceMenu', '유지보수 메뉴', progressCurrentSide));
}

// ── 수동 바코드 체크 - 유지보수 메뉴의 "바코드 체크" 버튼으로 들어온다. 실린더 2개
// (A측이면 A1/A2, B측이면 B1/B2)의 바코드 스캐너 입력칸을 보여준다. 실제 검증(Gas name
// 일치 확인) 로직은 아직 없음(뼈대) - 확인은 토스트만. 취소는 유지보수 메뉴로 되돌아간다. ──
function showProgressBarcodeCheck() {
  const side = progressCurrentSide || 'A';
  document.getElementById('barcodeLabel1').textContent = `${side}1`;
  document.getElementById('barcodeLabel2').textContent = `${side}2`;
  document.getElementById('barcodeInput1').value = '';
  document.getElementById('barcodeInput2').value = '';
  showProgressScreen('barcodeCheck', sideScreenTitle('barcodeCheck', '수동 바코드 체크', progressCurrentSide));
}

// ── 실린더 잠금 check - 메인 메뉴 "실린더 교환" → PASSWORD 확인 후 들어온다. Puls 구간
// (실린더교환.xlsx 4~10번, 7단계)의 진입 화면 - "실행" 전에는 idle, 실행 후에는 서브시퀀스
// 진행 패널을 보여준다(ns='idleCheck', Status는 IDLE 그대로 유지). showProgressAdjustMode와
// 동일한 이유로 화면에 들어올 때마다 stopNamespacedSubSequenceRunner('idleCheck')를 호출해
// idle로 초기화한다 - 안 그러면 지난번에 끝까지 진행했던(완료) 패널이 그대로 남아있는 채로
// 재진입하는 버그가 생긴다(취소 → 메인메뉴 → 실린더 교환 재실행 시 "완료" 상태 패널이
// 다시 보이던 문제, 실사용 중 발견). ──
function showProgressCylinderLockCheck() {
  if (window.stopNamespacedSubSequenceRunner) window.stopNamespacedSubSequenceRunner('idleCheck');
  showProgressScreen('cylinderLockCheck', sideScreenTitle('cylinderLockCheck', '실린더 잠금 check', progressCurrentSide));
  if (progressCurrentSide) {
    const pulsIdx = CYLINDER_STEP_ORDER.indexOf('Puls');
    if (cylinderCurrentStepIndex[progressCurrentSide] === 0 && pulsIdx !== -1) {
      cylinderCurrentStepIndex[progressCurrentSide] = pulsIdx;
    }
    applyCylinderStepStatus(progressCurrentSide);
  }
}

// ── IDLE 사전확인 7단계(실린더 잠금 check, ns='idleCheck') 완료 후 Status "Puls"(잔류가스
// Check, Pulse Vent, ns='puls')가 자동 시작되고, 그게 끝나면 Status "1P"(2차측 Vent~1차측
// Purge 5단계, ns='oneP')가 자동 시작된다. 둘 다 서브시퀀스 엑셀 엔진 화면이라 CYL_EXCHANGE_PURGE_STEPS
// 안에는 각각 항목 1개씩만 있으면 된다(실제 내용은 data/gmsSubSequences/Puls_v1.json,
// OneP_v1.json). 1P(5단계) 완료 시 다음 Status(-L)로 넘어간다. ──
const CYL_EXCHANGE_PURGE_STEPS = [
  { key: 'pulsAutoRun', title: '자동 진행' },
  { key: 'onePAutoRun', title: '2차측 Vent 자동진행' },
  { key: 'onePPurgeAutoRun', title: '2차측 Purge 자동진행' },
  { key: 'onePPumpingAutoRun', title: 'Pumping 자동진행' },
  { key: 'onePPrimaryPurgeAutoRun', title: '1차측 Purge 자동진행' },
  // 1P(5단계) "완료" 이후 - 여기서부터는 실제로 Status가 넘어간다(showProgressCylExchangePurgeStep의
  // CYL_STEP_STATUS_OVERRIDE 참고 - 이 key들로 진입할 때만 cylinderCurrentStepIndex를 옮긴다).
  { key: 'exchangePressureTest', title: '자동 진행' },
  // -L 다음은 VT 사용 옵션(gms.js의 vtUseOption)에 따라 갈린다 - 적용이면 이 VT 단계를
  // 거쳐 2차 배관청소로, 미적용이면 -L에서 바로 2차 배관청소로(exchangePressureTestRunBtn
  // 참고). CYL_EXCHANGE_PURGE_STEPS 배열 안에서는 그냥 다음 순서로 두되, 실제 진입은
  // 항상 findIndex로 key를 찾아서 이동하므로 배열 순서 자체가 진행 순서를 강제하지 않는다.
  { key: 'exchangeVtTest', title: '자동 진행' },
  { key: 'exchangeSecondPurge', title: '자동 진행' },
  // 2차 배관청소 "실행" → PASSWORD("실린더 교체") 통과 후 들어오는 용기교체(Status "CC")
  // 6단계 - 배지(step-badges-lg) 없이 안내문/버튼만 있는 화면들이다.
  { key: 'cylReplaceCheck', title: '자동 진행' },
  { key: 'cylReplaceValveOpen', title: '자동 진행' },
  { key: 'cylReplaceAutoGuardOpen', title: '자동 진행' },
  { key: 'cylReplaceSwap', title: '자동 진행' },
  { key: 'cylReplaceGasName', title: '자동 진행' },
  { key: 'cylReplaceAutoGuardClose', title: '자동 진행' },
  // Auto Guard 확인(Close) "확인" → "교환후" 자동 진행 4단계(3차 배관청소 → +L 가압시험 →
  // [VT 사용 옵션] → 4차 배관청소) - 교환전(1P~2P)과 대칭 구성, 전부 서브시퀀스 엔진 화면
  // (afterThreeP/afterPlusL/afterFourP). +L 가압시험 다음도 VT 사용 옵션에 따라 갈린다
  // (advanceToNextEnabledStatus가 자동 처리 - 교환전 exchangePressureTest와 동일 패턴).
  { key: 'exchangeThirdPurge', title: '자동 진행' },
  { key: 'exchangeAfterPressureTest', title: '자동 진행' },
  { key: 'exchangeAfterPuls', title: '자동 진행' },
  { key: 'exchangeAfterVtTest', title: '자동 진행' },
  { key: 'exchangeFourthPurge', title: '자동 진행' },
  // 4차 배관청소 "실행" → PASSWORD 통과 후 들어오는 마지막 화면(Status "4P"→"PC", 퍼지완료) -
  // 실린더 교환이 끝났으니 다음 메뉴(가스공급 등)를 고르는 화면이라 제목도 "가스 공급".
  { key: 'exchangePurgeComplete', title: '가스 공급' },
  // 퍼지완료(PC) 후 가스공급 전 배관 진공을 잡는 Pumping 구간 (Status "HP&LP Pump").
  { key: 'hpLpPump', title: '가스공급 진행' },
  // Main Sequence.csv에는 있지만 이 앱엔 아직 화면이 없던 3단계(Puls/Bypass/RGV) - Main
  // 시퀀스 편집기로 순서에 넣고 적용 처리하면 실제로 거치게 된다. 셋 다 아직 실기 연동
  // 전이라 간단한 안내문+실행/취소/TREND 뼈대 화면이다(advanceToNextEnabledStatus 참고).
  { key: 'sequencePuls', title: '자동 진행' },
  { key: 'sequenceBypass', title: '자동 진행' },
  { key: 'sequenceRgv', title: '자동 진행' },
];
// CYL_EXCHANGE_PURGE_STEPS의 각 단계가 실제로 어느 Status(cylinderCurrentStepIndex)에
// 해당하는지 - 잔류가스Check~1차측 Purge 5단계는 전부 "1P" 하위 단계라 항상 1P로
// 재설정한다(이전에 -L/2P까지 진행했다가 실린더 잠금 check에서 다시 "실행"으로 들어와도
// 1P부터 정확히 점멸/Status 표시되도록 - 남아있던 인덱스를 그대로 두면 배지가 어긋난다).
const CYL_STEP_STATUS_MAP = {
  pulsAutoRun: 'Puls', onePAutoRun: '1P',
  onePPurgeAutoRun: '1P', onePPumpingAutoRun: '1P', onePPrimaryPurgeAutoRun: '1P',
  exchangePressureTest: '-L', exchangeVtTest: '-VT', exchangeSecondPurge: '2P',
  cylReplaceCheck: 'CC', cylReplaceValveOpen: 'CC', cylReplaceAutoGuardOpen: 'CC',
  cylReplaceSwap: 'CC', cylReplaceGasName: 'CC', cylReplaceAutoGuardClose: 'CC',
  exchangeAfterPressureTest: '+L', exchangeAfterPuls: 'Puls 2', exchangeThirdPurge: '3P', exchangeAfterVtTest: '-VT', exchangeFourthPurge: '4P',
  exchangePurgeComplete: 'PC', hpLpPump: 'HP&LP Pump',
  sequencePuls: 'Puls', sequenceBypass: 'Bypass', sequenceRgv: 'RGV',
};
// ── 용기교체(CC) 6화면 - "화면 1개 = 서브시퀀스 네임스페이스 1개"라는 다른 자동진행 화면들의
// 관례와 다르게, 이 6화면은 여전히 사용자가 "확인" 버튼을 눌러 수동으로 넘긴다(타이머/알람
// 기반 SUBSEQ_NS 풀 엔진을 쓰지 않음). 대신 진입화면("실린더 확인")에만 귀속된 Step 데이터
// 파일 하나(data/gmsSubSequences/CylReplace_v1.json)가 6단계 전체 순서+밸브 개폐를 규정하고,
// 나머지 5개 화면은 그 데이터에서 자기 단계만 조회해서 읽기 전용으로 보여준다
// (docs/01-plan/features/gms-cc-replace-subseq.plan.md, docs/GMS_AUTO_SEQUENCE_HANDOFF.md 참고). ──
const CC_STEP_NO_BY_KEY = {
  cylReplaceCheck: '1', cylReplaceValveOpen: '2', cylReplaceAutoGuardOpen: '3',
  cylReplaceSwap: '4', cylReplaceGasName: '5', cylReplaceAutoGuardClose: '6',
};
// 밸브 상태는 화면에 텍스트로 표시하지 않는다 - SVG 배관도(gms-diagram.svg)의 실제 밸브
// 아이콘에 반영한다(다른 서브시퀀스 엔진의 subSeqApplyValves와 동일한 POST
// /api/gms/valve/write 사용). 값 문자열은 "O"/"C"(즉시) 외에 "O+2"/"C+4"처럼 "+n" 접미사로
// 화면 진입 후 n초 뒤 적용을 지정할 수 있어, 같은 Step 안 여러 밸브를 순차 개폐시킬 수 있다.
let ccPendingValveTimers = [];
function ccClearPendingValveTimers() {
  ccPendingValveTimers.forEach((id) => clearTimeout(id));
  ccPendingValveTimers = [];
}
function ccWriteValve(tag, open) {
  fetch('/api/gms/valve/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag, value: open }),
  }).catch(() => { /* 무시 - 밸브 쓰기 실패해도 화면 진행에는 영향 없음 */ });
}
/** CylReplace_v1.json에서 이 화면(stepNo)에 해당하는 밸브 개폐 상태를 조회해 SVG 배관도에
    반영한다. 진행/타이머/알람에는 전혀 관여하지 않는다 - "확인" 버튼 클릭이 여전히 다음
    화면을 결정한다(wireOperationScreens의 기존 핸들러 그대로). */
async function applyCcStepValves(stepNo) {
  ccClearPendingValveTimers();
  try {
    const res = await fetch('/api/gms/sub-sequences/CylReplace_v1');
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || '조회 실패');
    const step = (data.steps || []).find((s) => String(s.no) === String(stepNo));
    if (!step) return;
    const side = progressCurrentSide || 'A';
    Object.entries(step.valves || {}).forEach(([tag, raw]) => {
      const resolvedTag = tag.replace('{side}', side);
      const m = /^([OC])(?:\+(\d+))?$/.exec(String(raw || '').trim());
      if (!m) return;
      const open = m[1] === 'O';
      const delaySec = Number(m[2] || 0);
      if (delaySec > 0) {
        ccPendingValveTimers.push(setTimeout(() => ccWriteValve(resolvedTag, open), delaySec * 1000));
      } else {
        ccWriteValve(resolvedTag, open);
      }
    });
  } catch (e) { /* 무시 - 조회 실패해도 화면 전환 자체는 계속 진행 */ }
}

function showProgressCylExchangePurgeStep(index) {
  const step = CYL_EXCHANGE_PURGE_STEPS[index];
  showProgressScreen(step.key, sideScreenTitle(step.key, step.title, progressCurrentSide));
  if (progressCurrentSide) {
    // "-VT"는 CYLINDER_STEP_ORDER에 두 번(교환전/교환후) 나올 수 있다 - entryScreenKeyForIndex와
    // 동일한 기준(CC보다 앞이면 교환전, 뒤면 교환후)으로 어느 occurrence인지 찾는다. 순서를
    // 재배열해도(Main 시퀀스 편집기) 항상 올바른 위치를 가리킨다(단순 first/lastIndexOf보다
    // 일반적).
    const statusLabel = CYL_STEP_STATUS_MAP[step.key];
    if (statusLabel === '-VT') {
      const ccIdx = CYLINDER_STEP_ORDER.indexOf('CC');
      const wantPost = step.key === 'exchangeAfterVtTest';
      let found = -1;
      CYLINDER_STEP_ORDER.forEach((v, i) => {
        if (v !== '-VT') return;
        const isPost = ccIdx !== -1 && i >= ccIdx;
        if (isPost === wantPost) found = i;
      });
      cylinderCurrentStepIndex[progressCurrentSide] = found !== -1 ? found : CYLINDER_STEP_ORDER.indexOf('-VT');
    } else {
      cylinderCurrentStepIndex[progressCurrentSide] = CYLINDER_STEP_ORDER.indexOf(statusLabel);
    }
    // Valve Open 확인/Gas name 확인 화면의 측별 라벨(PGI_A·PGII_A / "A1" 등)을 갱신한다.
    if (step.key === 'cylReplaceValveOpen') {
      const label = document.getElementById('cylReplaceValveOpenTagsLabel');
      if (label) label.innerHTML = `PIV, PGII_${progressCurrentSide}, PGI_${progressCurrentSide}<br>2초 간격으로 순차 Open<br>진행 하시기 바랍니다.`;
    }
    // 퍼지완료(PC) 화면의 "취소" 2단 확인 무장 상태는 화면에 새로 들어올 때마다 초기화하고,
    // "B"/"A" 선택 버튼 라벨을 현재 측 기준으로 갱신한다.
    if (step.key === 'exchangePurgeComplete') {
      pcCancelArmed = false;
      const switchBtn = document.getElementById('exchangePurgeCompleteSwitchSideBtn');
      if (switchBtn) switchBtn.textContent = progressCurrentSide === 'A' ? '"B" 선택' : '"A" 선택';
    }
    if (step.key === 'cylReplaceGasName') {
      const title = document.getElementById('cylReplaceGasNameTitle');
      if (title) title.textContent = `[${progressCurrentSide}1 실린더 Gas name 확인]`;
    }
    if (CC_STEP_NO_BY_KEY[step.key]) applyCcStepValves(CC_STEP_NO_BY_KEY[step.key]);
    applyCylinderStepStatus(progressCurrentSide);
    // Puls(잔류가스Check~Pulse Vent, ns='puls')와 1P(2차측Vent~1차측Purge, ns='oneP')는
    // 둘 다 진입(잠금check 7단계 완료/Status Jump/B·A 선택 - 전부 이 함수로 수렴한다)마다
    // 서브시퀀스를 처음(Step 1)부터 새로 시작한다 - 자리를 기억하지 않고 항상 Step 1로
    // 되돌아가는 게 이 화면 계열의 일관된 동작이다(회귀 아님).
    if (step.key === 'pulsAutoRun' && window.startNamespacedSubSequenceRunner) {
      const side = progressCurrentSide;
      window.startNamespacedSubSequenceRunner('puls', 'Puls', side, {
        onFinish: (finishedSide) => advanceOnePChain(null, finishedSide),
        onCancel: () => { window.cancelPreCcToPassword(); },
      });
    }
    if (step.key === 'onePAutoRun' && window.startNamespacedSubSequenceRunner) {
      const side = progressCurrentSide;
      window.startNamespacedSubSequenceRunner('oneP', 'OneP', side, {
        onFinish: (finishedSide) => advanceOnePChain('onePAutoRun', finishedSide),
        onCancel: () => { window.cancelPreCcToPassword(); },
      });
    }
    if (step.key === 'onePPurgeAutoRun' && window.startNamespacedSubSequenceRunner) {
      const side = progressCurrentSide;
      window.startNamespacedSubSequenceRunner('onePPurge', 'OneP2', side, {
        onFinish: (finishedSide) => advanceOnePChain('onePPurgeAutoRun', finishedSide),
        onCancel: () => { window.cancelPreCcToPassword(); },
      });
    }
    if (step.key === 'onePPumpingAutoRun' && window.startNamespacedSubSequenceRunner) {
      const side = progressCurrentSide;
      window.startNamespacedSubSequenceRunner('onePPumping', 'OneP3', side, {
        onFinish: (finishedSide) => advanceOnePChain('onePPumpingAutoRun', finishedSide),
        onCancel: () => { window.cancelPreCcToPassword(); },
      });
    }
    if (step.key === 'onePPrimaryPurgeAutoRun' && window.startNamespacedSubSequenceRunner) {
      const side = progressCurrentSide;
      window.startNamespacedSubSequenceRunner('onePPrimaryPurge', 'OneP4', side, {
        onFinish: (finishedSide) => advanceOnePChain('onePPrimaryPurgeAutoRun', finishedSide),
        onCancel: () => { window.cancelPreCcToPassword(); },
      });
    }
    // "-L" 감압시험 - 1P 구간 완료 직후 자동으로 시작된다. Puls/1P 4단계와 같은 서브시퀀스
    // 엔진 화면(Pumping과 동일 디자인/패턴)이지만, 여기서부터는 Status가 실제로 넘어가는
    // 구간(zone1 이후)이라 완료 콜백이 advanceOnePChain이 아니라 곧장
    // advanceToNextEnabledStatus를 부른다(VT 사용 옵션에 따라 -VT 또는 2P로 - 기존
    // exchangePressureTestRunBtn과 동일한 동작).
    if (step.key === 'exchangePressureTest' && window.startNamespacedSubSequenceRunner) {
      const side = progressCurrentSide;
      window.startNamespacedSubSequenceRunner('exchangePressureTest', 'ExchL', side, {
        onFinish: (finishedSide) => {
          markStepComplete(finishedSide, cylinderCurrentStepIndex[finishedSide]);
          advanceToNextEnabledStatus(finishedSide);
        },
        onCancel: () => { window.cancelPreCcToPassword(); },
      });
    }
    // "2P" 2차 배관청소 - 감압시험(또는 VT 감압시험) 완료 직후 자동으로 시작된다. 1P 구간의
    // 1차측 Purge(onePPrimaryPurge)와 동일한 서브시퀀스 엔진 화면(ns='twoP') - 완료는 전체
    // 실린더 교환(교환전 구간)이 끝났다는 뜻이라 PASSWORD 재확인(cylinderExchangeDone)을
    // 거쳐 다음 Status(기본값 CC)로 넘어간다(옛 exchangeSecondPurgeRunBtn과 동일 정책).
    if (step.key === 'exchangeSecondPurge' && window.startNamespacedSubSequenceRunner) {
      const side = progressCurrentSide;
      window.startNamespacedSubSequenceRunner('twoP', 'TwoP', side, {
        onFinish: () => { proceedPastPasswordGate('cylinderExchangeDone', window.advanceCylinderExchangeDone); },
        onCancel: () => { window.cancelPreCcToPassword(); },
      });
    }
    // "Bypass" 배관 By-pass 체크 - 용기교체(CC) 완료 직후 자동으로 시작된다("Bypass 사용
    // 옵션" 적용 시만 - 미적용이면 nextStatusIndexAfter가 이 Status 자체를 건너뛰어 여기
    // 도달하지 않는다). 완료되면 곧장 다음 화면(3P)으로 넘어간다(단순 연결,
    // advanceToNextEnabledStatus - TASK.md 2026-08-09 지시).
    if (step.key === 'sequenceBypass' && window.startNamespacedSubSequenceRunner) {
      const side = progressCurrentSide;
      window.startNamespacedSubSequenceRunner('bypass', 'Bypass', side, {
        onFinish: (finishedSide) => {
          markStepComplete(finishedSide, cylinderCurrentStepIndex[finishedSide]);
          advanceToNextEnabledStatus(finishedSide);
        },
        onCancel: () => { window.cancelExchangeAfterToPassword('sequenceBypass'); },
      });
    }
    // "-VT" VT 감압시험 - VT 사용 옵션이 적용일 때만 감압시험(교환전) 또는 가압시험(교환후)
    // 다음에 자동으로 시작된다. 교환전/교환후 둘 다 완료 콜백은 advanceToNextEnabledStatus
    // 하나로 충분하다(옛 exchangeVtTestRunBtn/exchangeAfterVtTestRunBtn과 동일 정책) - 다음
    // Status(2P 또는 4P)는 Main 시퀀스 순서가 결정한다. "취소" 정책만 Zone1/Zone2로 갈린다.
    if (step.key === 'exchangeVtTest' && window.startNamespacedSubSequenceRunner) {
      const side = progressCurrentSide;
      window.startNamespacedSubSequenceRunner('vtTest', 'VtTest', side, {
        onFinish: (finishedSide) => {
          markStepComplete(finishedSide, cylinderCurrentStepIndex[finishedSide]);
          advanceToNextEnabledStatus(finishedSide);
        },
        onCancel: () => { window.cancelPreCcToPassword(); },
      });
    }
    if (step.key === 'exchangeAfterVtTest' && window.startNamespacedSubSequenceRunner) {
      const side = progressCurrentSide;
      window.startNamespacedSubSequenceRunner('afterVtTest', 'AfterVtTest', side, {
        onFinish: (finishedSide) => {
          markStepComplete(finishedSide, cylinderCurrentStepIndex[finishedSide]);
          advanceToNextEnabledStatus(finishedSide);
        },
        onCancel: () => { window.cancelExchangeAfterToPassword('exchangeAfterVtTest'); },
      });
    }
    // "3P" 교환 후 1차 배관청소 - 용기교체(CC) 완료 직후 자동으로 시작된다. 교환전 2P(twoP)와
    // 완전히 동일한 서브시퀀스 엔진 화면(ns='afterThreeP') - 완료되면 곧장 다음 화면(+L)으로
    // 넘어간다(VT 분기 없음, advanceToNextEnabledStatus가 처리).
    if (step.key === 'exchangeThirdPurge' && window.startNamespacedSubSequenceRunner) {
      const side = progressCurrentSide;
      window.startNamespacedSubSequenceRunner('afterThreeP', 'AfterThreeP', side, {
        onFinish: (finishedSide) => {
          markStepComplete(finishedSide, cylinderCurrentStepIndex[finishedSide]);
          advanceToNextEnabledStatus(finishedSide);
        },
        onCancel: () => { window.cancelExchangeAfterToPassword('exchangeThirdPurge'); },
      });
    }
    // "+L" 교환 후 가압시험 - 3차 배관청소 완료 직후 자동으로 시작된다.
    if (step.key === 'exchangeAfterPressureTest' && window.startNamespacedSubSequenceRunner) {
      const side = progressCurrentSide;
      window.startNamespacedSubSequenceRunner('afterPlusL', 'AfterPlusL', side, {
        onFinish: (finishedSide) => {
          markStepComplete(finishedSide, cylinderCurrentStepIndex[finishedSide]);
          advanceToNextEnabledStatus(finishedSide);
        },
        onCancel: () => { window.cancelExchangeAfterToPassword('exchangeAfterPressureTest'); },
      });
    }
    // "Puls 2" 교환 후 가압시험 후 Puls Vent - +L 가압시험 완료 직후 자동으로 시작된다.
    if (step.key === 'exchangeAfterPuls' && window.startNamespacedSubSequenceRunner) {
      const side = progressCurrentSide;
      window.startNamespacedSubSequenceRunner('afterPuls', 'AfterPuls', side, {
        onFinish: (finishedSide) => {
          markStepComplete(finishedSide, cylinderCurrentStepIndex[finishedSide]);
          advanceToNextEnabledStatus(finishedSide);
        },
        onCancel: () => { window.cancelExchangeAfterToPassword('exchangeAfterPuls'); },
      });
    }
    // "4P" 교환 후 2차 배관청소 - +L(또는 -VT) 완료 직후 자동으로 시작된다. 완료 시
    // PASSWORD(exchangeFourthPurgeDone) 재확인 후 다음 Status(PC)로 넘어간다(옛
    // exchangeFourthPurgeRunBtn과 동일 정책).
    if (step.key === 'exchangeFourthPurge' && window.startNamespacedSubSequenceRunner) {
      const side = progressCurrentSide;
      window.startNamespacedSubSequenceRunner('afterFourP', 'AfterFourP', side, {
        onFinish: () => { proceedPastPasswordGate('exchangeFourthPurgeDone', window.advanceExchangeFourthPurgeDone); },
        onCancel: () => { window.cancelExchangeAfterToPassword('exchangeFourthPurge'); },
      });
    }
    // "HP&LP Pump" - 퍼지완료(PC) 후 가스공급 전 배관 진공을 잡는 Pumping 구간.
    // 완료 시 다음 Status(READY/GSP 등)로 이동한다.
    if (step.key === 'hpLpPump' && window.startNamespacedSubSequenceRunner) {
      const side = progressCurrentSide;
      window.startNamespacedSubSequenceRunner('hpLpPump', 'HpLpPump', side, {
        onFinish: (finishedSide) => {
          markStepComplete(finishedSide, cylinderCurrentStepIndex[finishedSide]);
          advanceToNextEnabledStatus(finishedSide);
        },
        onCancel: () => {
          cancelPostPcToPassword('hpLpPump');
        },
      });
    }
  }
}

// ── 가스공급 자동 진행 - PC/가스공급 화면의 "가스공급" 버튼(gasSupplyEntry PASSWORD 게이트)
// 으로 들어온다. 실린더 교환(CYLINDER_STEP_ORDER/Status)과는 무관한 별도 시퀀스라 배지도
// 없고, cylinderCurrentStepIndex도 건드리지 않는다 - 공급 압력 확인 → Valve shutter 장착 →
// Regulator Close → Cylinder open → Regulator 조정 → PMV(=AV14) open 확인 → 가스공급준비
// 순서로 진행한다("가스공급" 자체가 시작되면 별도 화면 없이 완료 토스트 후 진입 지점으로
// 되돌아간다 - gasSupplyReadyConfirmBtn 참고). ──
const GAS_SUPPLY_STEPS = [
  { key: 'gasSupplyPressureCheck', title: '가스공급 진행' },
  { key: 'gasSupplyValveShutter', title: '가스공급 진행' },
  { key: 'gasSupplyRegulatorClose', title: '가스공급 진행' },
  { key: 'gasSupplyCylinderOpen', title: '가스공급 진행' },
  { key: 'gasSupplyRegulatorAdjust', title: '가스공급 진행' },
  { key: 'gasSupplyFpvOpen', title: '가스공급 진행' },
  { key: 'gasSupplyReady', title: '가스공급 진행' },
];

let gspConfigRowsCache = [];

async function loadGspConfigRowsFromApi() {
  try {
    const res = await fetch('/api/gms/sub-sequence-config');
    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.rows)) {
        gspConfigRowsCache = data.rows;
        window.gmsSubSequenceConfigRows = data.rows;
        return;
      }
    }
  } catch (e) {}

  try {
    const res2 = await fetch('data/gmsSubSequenceConfig.json');
    if (res2.ok) {
      const data2 = await res2.json();
      const rows = Array.isArray(data2.rows) ? data2.rows : (Array.isArray(data2) ? data2 : []);
      gspConfigRowsCache = rows;
      window.gmsSubSequenceConfigRows = rows;
    }
  } catch (e2) {}
}
loadGspConfigRowsFromApi();

function getGspConfigValue(name, defaultValue) {
  const rows = (typeof window !== 'undefined' && (window.gmsSubSequenceConfigRows || window.configRows || window.subSeqConfigRows)) || gspConfigRowsCache;
  if (Array.isArray(rows)) {
    const row = rows.find((r) => r.name === name || r.id === name);
    if (row && row.value !== '' && row.value != null) {
      const num = Number(row.value);
      if (!isNaN(num)) return num;
    }
  }
  return defaultValue;
}

function writeValveDirect(tag, value) {
  fetch('/api/gms/valve/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag, value: !!value }),
  }).catch((e) => console.error(`[ValveWrite] ${tag} failed:`, e));
}

function checkGspStep1Interlock(side) {
  const vacLimit = getGspConfigValue(`진공하한치_${side}`, -12.0);
  const ptTags = [`HPT_${side}`, `LPT_${side}`, `NPT_${side}`];
  if (typeof isAnalogTagEnabled === 'function' && isAnalogTagEnabled(`MPT_${side}`)) {
    ptTags.push(`MPT_${side}`);
  }
  for (const tag of ptTags) {
    const val = typeof lastPtByTag !== 'undefined' ? lastPtByTag[tag] : null;
    if (val != null && !isNaN(val) && Number(val) > vacLimit) {
      toast(`[${side}] 진공 하한치 초과: ${tag} (${Number(val).toFixed(2)} > ${vacLimit} PSI)`, 'err');
      return false;
    }
  }
  const isWeightEnabled = typeof isAnalogTagEnabled === 'function' ? isAnalogTagEnabled(`WI_${side}`) : true;
  if (isWeightEnabled) {
    const weightLower = getGspConfigValue(`WI_${side} Gas[Net] 무게 1차 하한`, 5.0);
    const weightUpper = getGspConfigValue(`WI_${side} Gas[Net] 무게 상한`, 50.0);
    const rawWeight = typeof lastPtByTag !== 'undefined' ? (lastPtByTag[`WI_${side}`] ?? lastPtByTag[`Weight_${side}`]) : null;
    const currentWeight = rawWeight != null && !isNaN(rawWeight) ? Number(rawWeight) : null;
    if (currentWeight !== null) {
      if (currentWeight <= weightLower || currentWeight >= weightUpper) {
        toast(`[${side}] Gas Net 무게 범위 벗어남: WI_${side} (${currentWeight.toFixed(2)} kg, 기준: ${weightLower} ~ ${weightUpper} kg)`, 'err');
        return false;
      }
    }
  }
  return true;
}

const GSP_PIPE_SEGMENTS = {
  A: {
    1: [ // Step 4 진입: V/S_A Open ~ HPI_A 하단 입구 & PGI_A 상단 입구(PGI 닫힘)
      'M 254.9 656.4 L 254.9 646.1 L 367 646.1',
      'M 367 646.1 L 367 698', // PGI_A 밸브 상단 입구까지만 (PGI 하단 및 PGII 아래 라인 제외)
      'M 367 646.1 L 367 542', // HPI_A 밸브 하단 입구까지만
      'M 367 564.7 L 341.5 564.7', // HPV_A 밸브 앞단까지만
    ],
    2: [ // Step 4 완료: HPI_A 통과 ~ REG1A 하단 입구
      'M 367 542 L 367 446',
    ],
    3: [ // Step 5 진입: REG1A, REG2A 통과 ~ LPI_A 하단 입구 & LPV_A 앞단
      'M 367 446 L 367 352',
      'M 367 365 L 341 365', // LPV_A 밸브 앞단까지만
    ],
    4: [ // Step 6 & Step 7 (A 가스공급준비): LPI_A 통과 ~ FPV_A 하단 입구까지만 착색
      'M 367 352 L 367 271',
    ],
    5: [ // Service (A 가스공급): FPV_A 통과(y=271~144) ~ LF2 ~ FPT ~ PROCESS 최상단 라인
      'M 367 271 L 367 144',
      'M 367 144 L 700.3 144',
      'M 700.3 144 L 700.3 58.2',
    ],
  },
  B: {
    1: [ // Step 4 진입: V/S_B Open ~ HPI_B 하단 입구 & PGI_B 상단 입구(PGI 닫힘)
      'M 586.5 656.4 L 586.5 646.1 L 700.3 646.1',
      'M 700.3 646.1 L 700.3 694', // PGI_B 밸브 상단 입구까지만 (PGI 하단 및 PGII 아래 라인 제외)
      'M 700.3 646.1 L 700.3 542', // HPI_B 밸브 하단 입구까지만
      'M 700.3 564.6 L 671.3 564.6', // HPV_B 밸브 앞단까지만
    ],
    2: [ // Step 4 완료: HPI_B 통과 ~ REG1B 하단 입구
      'M 700.3 542 L 700.3 446',
    ],
    3: [ // Step 5 진입: REG1B, REG2B 통과 ~ LPI_B 하단 입구 & LPV_B 앞단
      'M 700.3 446 L 700.3 352',
      'M 700.3 364.9 L 671.3 364.9', // LPV_B 밸브 앞단까지만
    ],
    4: [ // Step 6 & Step 7 (B 가스공급준비): LPI_B 통과 ~ FPV_B 하단 입구까지만 착색
      'M 700.3 352 L 700.3 268',
    ],
    5: [ // Service (B 가스공급): FPV_B 통과(y=268~173) ~ 우회 라인 ~ LF2 ~ FPT ~ PROCESS 최상단 라인
      'M 700.3 268 L 700.3 173 L 368.3 173 L 368.3 144',
      'M 368.3 144 L 700.3 144',
      'M 700.3 144 L 700.3 58.2',
    ],
  },
};

const gspActivePipeStage = { A: 0, B: 0 };

function updateGspPipeColors(side, stage) {
  if (!side) return;
  gspActivePipeStage[side] = stage;
  renderGspPipeLayers();
}

function renderGspPipeLayers() {
  const layer = document.getElementById('gasFlowLayer');
  if (!layer) return;
  layer.innerHTML = '';

  ['A', 'B'].forEach((s) => {
    const stage = gspActivePipeStage[s] || 0;
    if (stage <= 0) return;

    const segments = GSP_PIPE_SEGMENTS[s];
    if (!segments) return;

    for (let st = 1; st <= stage; st++) {
      const paths = segments[st] || [];
      paths.forEach((d) => {
        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.setAttribute('d', d);
        pathEl.setAttribute('class', 'gsp-gas-flow-pipe');
        pathEl.setAttribute('style', 'fill:none; stroke:#e74c3c; stroke-width:4.5; stroke-linecap:round; stroke-linejoin:miter;');
        layer.appendChild(pathEl);
      });
    }
  });
}
window.updateGspPipeColors = updateGspPipeColors;
window.renderGspPipeLayers = renderGspPipeLayers;

function checkGspStep4Interlock(side) {
  const hptLow = getGspConfigValue(`HPT_${side} 1차 저압`, 100.0);
  const hptHigh = getGspConfigValue(`HPT_${side} 고압`, 2500.0);
  const hptVal = typeof lastPtByTag !== 'undefined' ? lastPtByTag[`HPT_${side}`] : null;
  const currentHpt = hptVal != null && !isNaN(hptVal) ? Number(hptVal) : null;
  if (currentHpt === null || currentHpt < hptLow || currentHpt > hptHigh) {
    const hptStr = currentHpt !== null ? currentHpt.toFixed(2) : '--';
    toast(`[${side}] HPT 압력 조건 미달: HPT_${side} (${hptStr} PSI, 기준: ${hptLow} ~ ${hptHigh} PSI)`, 'err');
    return false;
  }
  writeValveDirect(`HPI_${side}`, true);
  updateGspPipeColors(side, 2); // 그림 2: HPI Open 후 REG1 앞단까지 적색 착색
  return true;
}

function checkGspStep5Interlock(side) {
  const lptLow = getGspConfigValue(`LPT_${side} 1차 저압`, 10.0);
  const lptHigh = getGspConfigValue(`LPT_${side} 1차 고압`, 100.0);
  const lptVal = typeof lastPtByTag !== 'undefined' ? lastPtByTag[`LPT_${side}`] : null;
  const currentLpt = lptVal != null && !isNaN(lptVal) ? Number(lptVal) : null;
  if (currentLpt === null || currentLpt < lptLow || currentLpt > lptHigh) {
    const lptStr = currentLpt !== null ? currentLpt.toFixed(2) : '--';
    toast(`[${side}] LPT 2차 압력 조건 미달: LPT_${side} (${lptStr} PSI, 기준: ${lptLow} ~ ${lptHigh} PSI)`, 'err');
    return false;
  }
  if (typeof isAnalogTagEnabled === 'function' && isAnalogTagEnabled(`MPT_${side}`)) {
    const mptLow = getGspConfigValue(`MPT_${side} 저압`, 10.0);
    const mptHigh = getGspConfigValue(`MPT_${side} 고압`, 150.0);
    const mptVal = typeof lastPtByTag !== 'undefined' ? lastPtByTag[`MPT_${side}`] : null;
    const currentMpt = mptVal != null && !isNaN(mptVal) ? Number(mptVal) : null;
    if (currentMpt === null || currentMpt < mptLow || currentMpt > mptHigh) {
      const mptStr = currentMpt !== null ? currentMpt.toFixed(2) : '--';
      toast(`[${side}] MPT 매니폴드 압력 조건 미달: MPT_${side} (${mptStr} PSI, 기준: ${mptLow} ~ ${mptHigh} PSI)`, 'err');
      return false;
    }
  }
  return true;
}

function updateGspPressureCheckReadouts() {
  const side = progressCurrentSide || 'A';

  // Step 1: 공급 압력 확인
  const hptEl = document.getElementById('gspHptVal');
  const mptEl = document.getElementById('gspMptVal');
  const lptEl = document.getElementById('gspLptVal');
  const nptEl = document.getElementById('gspNptVal');
  const weightEl = document.getElementById('gspWeightVal');

  const hptLbl = document.getElementById('gspHptLabel');
  const mptLbl = document.getElementById('gspMptLabel');
  const lptLbl = document.getElementById('gspLptLabel');
  const nptLbl = document.getElementById('gspNptLabel');
  const weightLbl = document.getElementById('gspWeightLabel');

  const mptRow = document.getElementById('gspMptRow');
  const weightRow = document.getElementById('gspWeightRow');

  // Step 7: 공급준비 완료
  const readyHptEl = document.getElementById('gspReadyHptVal');
  const readyMptEl = document.getElementById('gspReadyMptVal');
  const readyLptEl = document.getElementById('gspReadyLptVal');
  const readyNptEl = document.getElementById('gspReadyNptVal');
  const readyWeightEl = document.getElementById('gspReadyWeightVal');

  const readyHptLbl = document.getElementById('gspReadyHptLabel');
  const readyMptLbl = document.getElementById('gspReadyMptLabel');
  const readyLptLbl = document.getElementById('gspReadyLptLabel');
  const readyNptLbl = document.getElementById('gspReadyNptLabel');
  const readyWeightLbl = document.getElementById('gspReadyWeightLabel');

  const readyMptRow = document.getElementById('gspReadyMptRow');
  const readyWeightRow = document.getElementById('gspReadyWeightRow');

  if (hptLbl) hptLbl.textContent = `HPT_${side} :`;
  if (mptLbl) mptLbl.textContent = `MPT_${side} :`;
  if (lptLbl) lptLbl.textContent = `LPT_${side} :`;
  if (nptLbl) nptLbl.textContent = `NPT_${side} :`;
  if (weightLbl) weightLbl.textContent = `WI_${side} :`;

  if (readyHptLbl) readyHptLbl.textContent = `HPT_${side} :`;
  if (readyMptLbl) readyMptLbl.textContent = `MPT_${side} :`;
  if (readyLptLbl) readyLptLbl.textContent = `LPT_${side} :`;
  if (readyNptLbl) readyNptLbl.textContent = `NPT_${side} :`;
  if (readyWeightLbl) readyWeightLbl.textContent = `WI_${side} :`;

  // MPT 및 Weight(WI) 옵션 처리: OPTION 탭에서 미적용 시 숨기고 빈자리를 당겨서 자동 간격 조정
  const showMpt = typeof isAnalogTagEnabled === 'function' ? isAnalogTagEnabled(`MPT_${side}`) : true;
  const showWeight = typeof isAnalogTagEnabled === 'function' ? isAnalogTagEnabled(`WI_${side}`) : true;

  if (mptRow) mptRow.style.display = showMpt ? 'flex' : 'none';
  if (weightRow) weightRow.style.display = showWeight ? 'flex' : 'none';
  if (readyMptRow) readyMptRow.style.display = showMpt ? 'flex' : 'none';
  if (readyWeightRow) readyWeightRow.style.display = showWeight ? 'flex' : 'none';

  if (typeof lastPtByTag !== 'undefined') {
    const hptV = lastPtByTag[`HPT_${side}`];
    const mptV = lastPtByTag[`MPT_${side}`];
    const lptV = lastPtByTag[`LPT_${side}`];
    const nptV = lastPtByTag[`NPT_${side}`];
    const weightV = lastPtByTag[`WI_${side}`] ?? lastPtByTag[`Weight_${side}`];

    const hptStr = hptV != null ? Number(hptV).toFixed(2) : '--';
    const mptStr = mptV != null ? Number(mptV).toFixed(2) : '--';
    const lptStr = lptV != null ? Number(lptV).toFixed(2) : '--';
    const nptStr = nptV != null ? Number(nptV).toFixed(2) : '--';
    const weightStr = (weightV != null && !isNaN(weightV)) ? Number(weightV).toFixed(2) : '0.00';

    if (hptEl) hptEl.textContent = hptStr;
    if (mptEl) mptEl.textContent = mptStr;
    if (lptEl) lptEl.textContent = lptStr;
    if (nptEl) nptEl.textContent = nptStr;
    if (weightEl) weightEl.textContent = weightStr;

    if (readyHptEl) readyHptEl.textContent = hptStr;
    if (readyMptEl) readyMptEl.textContent = mptStr;
    if (readyLptEl) readyLptEl.textContent = lptStr;
    if (readyNptEl) readyNptEl.textContent = nptStr;
    if (readyWeightEl) readyWeightEl.textContent = weightStr;
  }
}
window.updateGspPressureCheckReadouts = updateGspPressureCheckReadouts;

function showProgressGasSupplyStep(index) {
  const step = GAS_SUPPLY_STEPS[index];
  const side = progressCurrentSide || 'A';
  showProgressScreen(step.key, sideScreenTitle(step.key, step.title, progressCurrentSide));

  if (step.key === 'gasSupplyPressureCheck' || step.key === 'gasSupplyReady') {
    updateGspPressureCheckReadouts();
  }
  if (step.key === 'gasSupplyPressureCheck' || step.key === 'gasSupplyValveShutter' || step.key === 'gasSupplyRegulatorClose') {
    updateGspPipeColors(side, 0);
  } else if (step.key === 'gasSupplyCylinderOpen') {
    // Step 4 진입 시: V/S Valve Open 및 그림 1 배관 적색 착색
    writeValveDirect(`V/S_${side}`, true);
    updateGspPipeColors(side, 1);
  } else if (step.key === 'gasSupplyRegulatorAdjust') {
    // Step 5 진입 시: LPI Valve Open 및 그림 3 배관 적색 착색
    writeValveDirect(`LPI_${side}`, true);
    updateGspPipeColors(side, 3);
  } else if (step.key === 'gasSupplyFpvOpen') {
    // Step 6: FPV 앞단까지 배관 적색 착색
    updateGspPipeColors(side, 4);
  } else if (step.key === 'gasSupplyReady') {
    // Step 7 가스공급 준비 완료 (점프 또는 정상 진행 진입): V/S, HPI, LPI 밸브 모두 OPEN 및 FPV 앞단까지 적색 착색
    writeValveDirect(`V/S_${side}`, true);
    writeValveDirect(`HPI_${side}`, true);
    writeValveDirect(`LPI_${side}`, true);
    updateGspPipeColors(side, 4);
  }

  // 가스공급준비 7단계 중 마지막(가스공급준비 완료) 화면에 들어오면 Status를 READY
  // ("공급준비")로 올린다 - 여기서 "확인"을 눌러야 비로소 Status가 Service("가스공급")로
  // 넘어간다(gasSupplyReadyConfirmBtn 참고). 나머지 6단계는 전부 GSP("가스공급 진행") -
  // RGV(Real Gas Vent)와는 별개의 Status라 이 6단계 동안은 그대로 GSP를 유지한다(1P가
  // 하위 5단계를 공유하는 것과 동일한 패턴, CYL_STEP_STATUS_MAP 참고).
  if (progressCurrentSide) {
    const statusType = step.key === 'gasSupplyReady' ? 'READY' : 'GSP';
    const statusIdx = CYLINDER_STEP_ORDER.indexOf(statusType);
    if (statusIdx !== -1) cylinderCurrentStepIndex[progressCurrentSide] = statusIdx;
    applyCylinderStepStatus(progressCurrentSide);
  }
}
function closeAllProcessValvesDirect(side) {
  const targetSide = side || progressCurrentSide || 'A';
  const targetValves = [
    `V/S_${targetSide}`,
    `HPI_${targetSide}`,
    `HPV_${targetSide}`,
    `LPI_${targetSide}`,
    `LPV_${targetSide}`,
    `FPV_${targetSide}`,
    `PGI_${targetSide}`,
    `PGII_${targetSide}`,
    `AV1_${targetSide}`,
    `AV2_${targetSide}`,
    `AV3_${targetSide}`,
    `AV4_${targetSide}`,
    `AV5_${targetSide}`,
    `AV6_${targetSide}`,
    `AV7_${targetSide}`,
    `AV8_${targetSide}`,
    `AV9_${targetSide}`,
    `AV10_${targetSide}`,
    `AV11_${targetSide}`,
    `AV12_${targetSide}`,
    `AV13_${targetSide}`,
    `AV14_${targetSide}`,
    `AV15_${targetSide}`,
    'PNV',
    'VN1',
    'VN2',
    'GNV',
    'HPIV',
    'PNBV',
    'PIV',
    'FPT',
  ];

  Promise.all(
    targetValves.map((tag) =>
      fetch('/api/gms/valve/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag, value: false }),
      }).catch((e) => console.error(`[ValveClose] ${tag} failed:`, e))
    )
  );

  updateGspPipeColors(targetSide, 0);
}
window.closeAllProcessValvesDirect = closeAllProcessValvesDirect;

/** 가스공급 시퀀스 중 아무 화면에서나 "취소" - 시퀀스를 그만두고 진입 지점(PC/가스공급
 * 화면)으로 되돌아간다. */
function cancelGasSupply() {
  const side = progressCurrentSide || 'A';
  closeAllProcessValvesDirect(side);
  showProgressCylExchangePurgeStep(CYL_EXCHANGE_PURGE_STEPS.findIndex((s) => s.key === 'exchangePurgeComplete'));
}
/** 가스공급준비 완료 화면의 "확인"(실제 가스공급 시작) → 들어오는 화면 - Status를
 * Service("가스공급")로 올린 채 표시한다(CYL_EXCHANGE_PURGE_STEPS/GAS_SUPPLY_STEPS 어느
 * 배열에도 속하지 않는 독립 화면이라 showProgressScreen을 직접 쓴다). */
function showProgressGasSupplyActive(side) {
  if (side) progressCurrentSide = side;
  const targetSide = progressCurrentSide || 'A';
  if (progressCurrentSide) {
    cylinderCurrentStepIndex[progressCurrentSide] = CYLINDER_STEP_ORDER.indexOf('Service');
    applyCylinderStepStatus(progressCurrentSide);
  }
  showProgressScreen('gasSupplyActive', sideScreenTitle('gasSupplyActive', '가스공급 진행', progressCurrentSide));

  // 서비스(가스공급 중) 진입 시: V/S, HPI, LPI, FPV 밸브 모두 OPEN 및 상단 PROCESS 배관까지 가스 유입(Stage 5)
  const supplyValves = [`V/S_${targetSide}`, `HPI_${targetSide}`, `LPI_${targetSide}`, `FPV_${targetSide}`];
  supplyValves.forEach((tag) => writeValveDirect(tag, true));
  updateGspPipeColors(targetSide, 5);

  const label = document.getElementById('gasSupplyActiveFlowLabel');
  if (label) label.textContent = `${targetSide} Cylinder flow!`;
  // "B"/"A" 선택 버튼 라벨도 현재 측 기준으로 갱신한다 - 안 그러면 측을 바꿔도 버튼
  // 글자가 그대로라 전환이 안 되는 것처럼 보인다.
  const switchBtn = document.getElementById('gasSupplyActiveSwitchSideBtn');
  if (switchBtn) switchBtn.textContent = targetSide === 'A' ? '"B" 선택' : '"A" 선택';
}

// ── 가스공급 중 화면의 "일시정지"/"공급중지"/"강제 교체" - 셋 다 PASSWORD 통과 후 공용
// 재확인 화면(가스공급_동작재확인.html)을 거쳐 "실행"을 눌러야 실제로 동작한다("취소"는
// 가스공급 중 화면으로 되돌아간다). passwordGate는 gms.js PASSWORD_GATE_DEFS의 개별
// 옵션과 대응한다. ──
const GAS_SUPPLY_ACTIONS = {
  pause: {
    label: '일시정지',
    passwordGate: 'gasSupplyPauseEntry',
    // 밸브 all Close & 배관 램프 OFF 후 PC(퍼지완료) 화면으로 이동(Status PC)
    perform: () => cancelGasSupply(),
  },
  stop: {
    label: '공급중지',
    passwordGate: 'gasSupplyStopEntry',
    // 밸브 all Close & 배관 램프 OFF 후 이 측을 IDLE로 되돌리고 메인 메뉴로 나간다.
    perform: () => {
      const side = progressCurrentSide || 'A';
      closeAllProcessValvesDirect(side);
      resetCylinderStepStatus(side);
      showProgressMainMenu(side);
    },
  },
  forceChange: {
    label: '강제 교체',
    passwordGate: 'gasSupplyForceChangeEntry',
    // 이전 측 밸브 all Close & 배관 램프 OFF, IDLE로 되돌리고 반대 측을 가스공급 중 화면(Status Service)으로 전환한다.
    perform: () => {
      const fromSide = progressCurrentSide || 'A';
      const toSide = fromSide === 'A' ? 'B' : 'A';
      closeAllProcessValvesDirect(fromSide);
      resetCylinderStepStatus(fromSide);
      showProgressGasSupplyActive(toSide);
    },
  },
};
let gasSupplyPendingAction = null;
function showGasSupplyConfirmAction(actionKey) {
  gasSupplyPendingAction = actionKey;
  const desc = document.getElementById('gasSupplyConfirmActionDesc');
  if (desc) desc.textContent = `${GAS_SUPPLY_ACTIONS[actionKey].label}를 진행하시겠습니까?`;
  showProgressScreen('gasSupplyConfirmAction', sideScreenTitle('gasSupplyConfirmAction', '자동 진행', progressCurrentSide));
}
/** 가스공급 중 화면의 세 버튼이 공통으로 호출 - PASSWORD 게이트가 적용이면 통과 후,
 * 미적용이면 바로 재확인 화면으로 이동한다(가스공급 진입 등 다른 게이트와 동일 패턴). */
function requestGasSupplyAction(actionKey) {
  proceedPastPasswordGate(GAS_SUPPLY_ACTIONS[actionKey].passwordGate, () => showGasSupplyConfirmAction(actionKey));
}

// ── CYLINDER STEP STATUS 배지 순서 - "-VT"가 두 번 나오므로 라벨이 아니라 배열 위치
// (인덱스)로 "현재 스텝"을 구분한다. 원래는 하드코딩 상수였지만, 이제 gms.js가 서버
// (data/gmsMainSequence.json, OPTION 탭 "Main 시퀀스 순서" 편집기)에서 불러온
// mainSequenceOrder/mainSequenceEnabledTypes로부터 다시 계산되는 let 변수다 - 배열
// "내용이 어디서 오는가"만 바뀌었을 뿐, indexOf/lastIndexOf/CYLINDER_STEP_ORDER[idx]로
// 읽는 기존 코드는 전부 그대로 동작한다. 서버 로드 실패/편집 전이면 아래 기본값
// (CYLINDER_STEP_ORDER_FALLBACK, 기존 하드코딩 13단계)을 그대로 쓴다. ──
const CYLINDER_STEP_ORDER_FALLBACK = ['IDLE', 'Puls', '1P', '-L', '-VT', '2P', 'CC', 'Bypass', '3P', '+L', 'Puls 2', '-VT', '4P', 'PC', 'HP&LP Pump', 'READY', 'Service'];
let CYLINDER_STEP_ORDER = CYLINDER_STEP_ORDER_FALLBACK.slice();
// 우측 "A : ○○" 상태 텍스트에 쓰는 스텝별 풀네임.
const CYLINDER_STEP_LABELS = {
  IDLE: '준비 전',
  Puls: '잔류가스 제거',
  '1P': '교환전 1차 청소',
  '-L': '감압시험',
  '-VT': '고진공Pumping',
  '2P': '교환전2차 청소',
  CC: '실린더 교체',
  Bypass: 'By-pass 체크',
  '+L': '가압시험',
  'Puls 2': '가압 후 Puls',
  '3P': '교환후3차 청소',
  '4P': '교환후4차 청소',
  PC: '퍼지완료',
  'HP&LP Pump': 'HP&LP Pump',
  RGV: 'Real Gas Vent',
  GSP: '가스공급 진행',
  READY: '공급준비',
  Service: '가스공급',
};
// ── Status 타입 문자열 → 그 상태로 "진입"하는 CYL_EXCHANGE_PURGE_STEPS 화면 key. "-VT"만
// 예외로 타입만으로 특정할 수 없다(교환전/교환후 두 화면 중 어느 쪽인지는 CC 기준
// 앞/뒤 위치로 가른다) - entryScreenKeyForIndex()가 idx를 받아 처리한다. IDLE은 "진입"
// 대상이 아니라 리셋 대상이라 이 표에 없다(Status Jump에서 별도 처리). ──
const STATUS_ENTRY_SCREEN_BY_TYPE = {
  '1P': 'onePAutoRun',
  '-L': 'exchangePressureTest',
  '2P': 'exchangeSecondPurge',
  CC: 'cylReplaceCheck',
  '+L': 'exchangeAfterPressureTest',
  'Puls 2': 'exchangeAfterPuls',
  '3P': 'exchangeThirdPurge',
  '4P': 'exchangeFourthPurge',
  PC: 'exchangePurgeComplete',
  'HP&LP Pump': 'hpLpPump',
  // Puls는 이제 실제 화면(pulsAutoRun, 잔류가스Check+Pulse Vent 2단계)이 있어 옛 범용
  // 뼈대(sequencePuls)를 대체한다 - Main 시퀀스 편집기로 순서를 바꿔도 항상 이 실제
  // 화면으로 간다. sequencePuls 항목 자체는 Bypass/RGV와 같은 공용 루프를 쓰고 있어
  // 그대로 남겨뒀지만(코드 위치 934줄 근처) 더 이상 이 표에서는 참조되지 않는다.
  Puls: 'pulsAutoRun',
  Bypass: 'sequenceBypass',
  RGV: 'sequenceRgv',
};
/** CYLINDER_STEP_ORDER[idx]가 진입하는 화면 key. "-VT"는 idx가 CC보다 앞이면 교환전
    화면, 뒤면 교환후 화면 - 사용자가 순서를 바꿔도(Main 시퀀스 편집기) 항상 올바르게
    갈린다(기존의 first/lastIndexOf 위치 특수 처리를 일반화한 것). */
function entryScreenKeyForIndex(idx) {
  const type = CYLINDER_STEP_ORDER[idx];
  if (type === '-VT') {
    const ccIdx = CYLINDER_STEP_ORDER.indexOf('CC');
    return (ccIdx === -1 || idx < ccIdx) ? 'exchangeVtTest' : 'exchangeAfterVtTest';
  }
  // Status "1P"는 화면 4개(1-2차측 Vent Mode/2차측 Purge/Pumping/1차측 Purge)로 이루어져
  // 있고, OPTION 탭의 "1P 서브시퀀스 사용 여부"로 각각 켜고 끌 수 있다(사용자 요청 -
  // "적용된것만 1p시퀀스에 연결되어 순차적으로 진행"). 첫 번째로 적용된 화면이 진입점이고,
  // 전부 미적용이면 null을 돌려줘 -VT처럼 이 함수를 쓰는 쪽(nextStatusIndexAfter 등)이
  // "1P" 자체를 건너뛰게 한다.
  if (type === '1P') return firstEnabledOnePStageKey();
  return STATUS_ENTRY_SCREEN_BY_TYPE[type] || null;
}
/** ONE_P_SUBSEQ_DEFS(gms.js) 순서대로 첫 번째 "적용" 화면 key를 돌려준다(전부 미적용이면
    null). */
function firstEnabledOnePStageKey() {
  if (typeof ONE_P_SUBSEQ_DEFS === 'undefined' || typeof onePSubseqEnabled !== 'function') return 'onePAutoRun';
  const found = ONE_P_SUBSEQ_DEFS.find((def) => onePSubseqEnabled(def.key));
  return found ? found.key : null;
}
/** afterKey 다음으로 "적용"된 1P 화면 key를 찾는다(없으면 null - 1P 구간이 끝났다는 뜻).
    각 화면의 onFinish가 이 함수로 다음 목적지를 정한다 - 사이에 미적용 화면이 있으면
    자동으로 건너뛴다. */
function nextEnabledOnePStageKey(afterKey) {
  if (typeof ONE_P_SUBSEQ_DEFS === 'undefined' || typeof onePSubseqEnabled !== 'function') return null;
  const startAt = ONE_P_SUBSEQ_DEFS.findIndex((def) => def.key === afterKey) + 1;
  for (let i = startAt; i < ONE_P_SUBSEQ_DEFS.length; i++) {
    if (onePSubseqEnabled(ONE_P_SUBSEQ_DEFS[i].key)) return ONE_P_SUBSEQ_DEFS[i].key;
  }
  return null;
}
/** 1P 구간 화면(Puls 포함) 완료 콜백들이 전부 이 함수 하나로 "다음 화면"을 정한다.
    fromKey가 null이면(Puls 완료 직후) 1P의 첫 적용 화면으로, 그 외엔 fromKey 다음
    적용 화면으로 이동한다 - 더 이상 적용된 화면이 없으면(1P 구간 전체 완료, 또는
    OPTION에서 전부 미적용) Status를 완료 처리하고 다음 Status로 넘어간다. */
function advanceOnePChain(fromKey, finishedSide) {
  const nextKey = fromKey === null ? firstEnabledOnePStageKey() : nextEnabledOnePStageKey(fromKey);
  if (nextKey) {
    showProgressCylExchangePurgeStep(CYL_EXCHANGE_PURGE_STEPS.findIndex((s) => s.key === nextKey));
  } else {
    markStepComplete(finishedSide, cylinderCurrentStepIndex[finishedSide]);
    advanceToNextEnabledStatus(finishedSide);
  }
}
/** idx 다음으로 실제 진입 가능한 위치를 찾는다(비어있는/미구현 타입은 건너뜀). VT 사용
    옵션(gms.js vtUseOption)이 미적용이면 순서에 "-VT"가 있어도 런타임에 건너뛴다 - Main
    시퀀스 편집기의 "-VT 적용/미적용"은 순서 자체에서 빼는 구조적 설정이고, 기존 VT 사용
    옵션은 순서엔 있어도 그때그때 끄고 켜는 런타임 설정으로 둘 다 유지한다. */
function nextStatusIndexAfter(idx) {
  for (let i = idx + 1; i < CYLINDER_STEP_ORDER.length; i++) {
    const type = CYLINDER_STEP_ORDER[i];
    if (type === 'READY' || type === 'Service' || type === 'GSP') return i;
    if (type === '-VT' && typeof vtUseOption !== 'undefined' && !vtUseOption) continue;
    // Bypass 사용 옵션(gms.js, TASK.md 2026-08-09 지시) 미적용이면 Bypass Status를
    // 런타임에 건너뛴다(-VT/vtUseOption과 동일한 패턴).
    if (type === 'Bypass' && typeof bypassUseOption !== 'undefined' && !bypassUseOption) continue;
    if (entryScreenKeyForIndex(i)) return i;
  }
  return -1;
}
/** 실린더 교환 자동 진행 중 "다음 상태로 넘어가기"의 유일한 창구 - Main 시퀀스 편집기에서
    순서를 바꾸거나(예: +L↔3P) 타입을 미적용 처리하면(예: Bypass) 이 함수의 결과가 그에
    따라 달라지므로, 이 함수를 쓰는 모든 "실행" 버튼이 실제로 편집한 순서를 따라간다. */
function advanceToNextEnabledStatus(side) {
  const nextIdx = nextStatusIndexAfter(cylinderCurrentStepIndex[side]);
  if (nextIdx === -1) {
    toast('다음 단계가 설정되어 있지 않습니다(Main 시퀀스 순서를 확인하세요).', 'err');
    return;
  }
  const nextType = CYLINDER_STEP_ORDER[nextIdx];
  if (nextType === 'GSP' || nextType === 'READY') {
    // "가스공급 진행"(GSP)으로 "새로 진입"하는 것이므로(이미 그 상태에 가 있는 화면을 다시
    // 보여주는 showScreenForSideStatus/performStatusJump와 다름) 가스공급준비 7단계를
    // 처음부터 거쳐야 한다(PC 화면의 "가스공급" 버튼과 동일 동작) - 마지막 단계로 건너뛰면
    // 안 된다. GSP가 Main 시퀀스에서 미적용 처리되어 nextType이 곧바로 READY로 나온
    // 경우도 동일하게 처음부터 시작한다(가스공급준비 화면 자체를 건너뛸 방법은 없음 -
    // GSP 미적용은 배지/순서 표시에서만 빠지고 실제 준비 절차는 항상 거쳐야 한다).
    showProgressGasSupplyStep(0);
    return;
  }
  if (nextType === 'Service') { showProgressGasSupplyActive(side); return; }
  const key = entryScreenKeyForIndex(nextIdx);
  if (!key) { toast(`"${nextType}" 단계는 아직 화면이 준비되지 않았습니다.`, 'err'); return; }
  showProgressCylExchangePurgeStep(CYL_EXCHANGE_PURGE_STEPS.findIndex((s) => s.key === key));
}
/** gms.js가 Main 시퀀스 설정을 (재)로드할 때마다 부른다(초기 로드 + 편집기 저장 시) -
    mainSequenceOrder/mainSequenceEnabledTypes로부터 CYLINDER_STEP_ORDER를 다시 계산하고,
    상단 배지 DOM(#cylStepBadgesA/B)도 새 순서에 맞춰 다시 그린다. window에 노출해서
    gms.js/gms-sequence-editor.js에서 직접 호출할 수 있게 한다. */
function rebuildCylinderStepOrder() {
  const hasConfig = typeof mainSequenceOrder !== 'undefined' && mainSequenceOrder.length > 0;
  const filtered = hasConfig
    ? mainSequenceOrder
      .filter((inst) => mainSequenceEnabledTypes[inst.type] !== false)
      .map((inst) => inst.type)
    : [];
  CYLINDER_STEP_ORDER = filtered.length ? filtered : CYLINDER_STEP_ORDER_FALLBACK.slice();
  ['cylStepBadgesA', 'cylStepBadgesB'].forEach((id) => {
    const row = document.getElementById(id);
    if (!row) return;
    row.innerHTML = CYLINDER_STEP_ORDER.map((type) => `<span class="step-badge">${type}</span>`).join('');
  });
  ['A', 'B'].forEach((side) => {
    // 항목을 줄이는 편집으로 기존 인덱스가 범위를 벗어나면 안전하게 IDLE로 되돌린다.
    if (cylinderCurrentStepIndex[side] >= CYLINDER_STEP_ORDER.length) {
      cylinderCurrentStepIndex[side] = 0;
      completedStatusSteps[side].clear();
    }
    applyCylinderStepStatus(side);
  });
}
window.rebuildCylinderStepOrder = rebuildCylinderStepOrder;
// 실제 스텝 비트 연동 전까지는 양측 모두 IDLE(준비 전)에서 시작한다 - 실제 진행은
// 각 화면의 "실행"/PASSWORD 확인 로직이 명시적으로 인덱스를 옮길 때만 바뀐다.
const cylinderCurrentStepIndex = { A: 0, B: 0 };
// ── 큰 배지(.step-badge-lg)의 "완료(.done, 적색 채움)" 표시는 idx보다 앞선 위치라고 해서
// 무조건 채우지 않는다 - Status Jump로 건너뛴 스텝은 실제로 시퀀스를 완료(Complete
// bit)한 게 아니므로 채우면 안 된다. 각 스텝을 정상적으로 마치고 다음 단계로 넘어가는
// 실제 "실행"/PASSWORD 확인 지점에서만 markStepComplete()로 이 Set에 기록한다(값은
// CYLINDER_STEP_ORDER의 인덱스 - "-VT"가 두 번 나오는 문제를 텍스트가 아니라 위치로
// 피한다). resetCylinderStepStatus()가 IDLE로 되돌릴 때 함께 비운다. ──
const completedStatusSteps = { A: new Set(), B: new Set() };
function markStepComplete(side, idx) {
  if (side) completedStatusSteps[side].add(idx);
}

// ── 현재 스텝(인덱스) 기준으로 세 곳을 한 번에 맞춘다: ① 상단 CYLINDER STEP STATUS
// 작은 배지(IDLE부터 현재까지 누적 적색), ② 우측 "A/B : ○○" 상태 텍스트,
// ③ 실린더 잠금 check 화면의 큰 배지(현재 스텝과 이름이 같은 것만 점멸). 점멸 중인
// 큰 사각형이 곧 "현재 Status"이므로 항상 이 함수 하나로 세 표시를 동기화한다. ──
function applyCylinderStepStatus(side) {
  const idx = cylinderCurrentStepIndex[side];
  const stepKey = CYLINDER_STEP_ORDER[idx];
  const row = document.getElementById(side === 'B' ? 'cylStepBadgesB' : 'cylStepBadgesA');
  if (row) [...row.children].forEach((badge, i) => {
    badge.classList.toggle('active', i <= idx);
    // 현재 진행 중인 스텝(IDLE 제외)은 상단 배지도 선명하게 점멸(blinking)
    badge.classList.toggle('blinking', i === idx && stepKey !== 'IDLE');
  });
  const statusText = document.getElementById(side === 'B' ? 'progressStatusB' : 'progressStatusA');
  if (statusText) statusText.textContent = CYLINDER_STEP_LABELS[stepKey] || stepKey;
  // 실린더 잠금 check + "교환전 1차 Purge" 5단계 화면 모두 큰 배지가 A/B 공용(화면이
  // 하나뿐)이므로, 지금 표시 중인 측일 때만 갱신한다 - 아니면 A 갱신 직후 B 갱신이
  // 덮어써 버린다. 숨겨진 화면의 배지를 건드려도 안 보이니 무해하다.
  if (side === progressCurrentSide) {
    const ccIdx = CYLINDER_STEP_ORDER.indexOf('CC');
    const isLockCheckScreen = progressScreens && progressScreens['cylinderLockCheck'] && progressScreens['cylinderLockCheck'].style.display !== 'none';
    document.querySelectorAll('.step-badge-lg').forEach((badge) => {
      const label = badge.textContent.trim();
      let labelIdx = -1;
      if (label === '-VT') {
        // 현재 진행 위치(idx)가 CC 이전이면 교환전 -VT, CC 이후면 교환후 -VT로 정확히 매핑한다.
        // (단순 거리 계산 시 3P에서 교환전 -VT와 교환후 -VT 거리가 3으로 같아 교환전 -VT로
        // 오판되어 'done' 적색 불이 켜지던 버그 수정).
        const isPost = ccIdx !== -1 && idx >= ccIdx;
        let found = -1;
        CYLINDER_STEP_ORDER.forEach((v, i) => {
          if (v !== '-VT') return;
          if ((ccIdx !== -1 && i >= ccIdx) === isPost) found = i;
        });
        labelIdx = found !== -1 ? found : CYLINDER_STEP_ORDER.indexOf('-VT');
      } else {
        labelIdx = CYLINDER_STEP_ORDER.indexOf(label);
      }

      // 현재 스텝만 점멸(.blinking). "완료(.done, 적색 채움)"는 앞선 위치라고 무조건
      // 채우지 않고, 그 스텝을 실제로 정상 완료한 경우(completedStatusSteps)에만 채운다.
      // "1P" 큰 배지는 Puls/1P 두 Status 및 실린더 잠금 check 화면에 걸쳐 공유된다
      const isSharedOnePBlink = label === '1P' && (stepKey === 'Puls' || stepKey === '1P' || isLockCheckScreen);
      const isSharedPlusLBlink = label === '+L' && stepKey === 'Bypass';
      badge.classList.toggle('blinking', label === stepKey || isSharedOnePBlink || isSharedPlusLBlink);
      badge.classList.toggle('done', labelIdx !== -1 && labelIdx < idx && completedStatusSteps[side].has(labelIdx));
    });
  }
}

// ── 실린더 교환을 취소하고 메인 메뉴로 빠져나올 때 호출 - 현재 스텝을 IDLE(인덱스 0)로
// 되돌리고 위 세 표시를 함께 갱신한다. side가 없으면 A/B 둘 다 되돌린다. ──
function resetCylinderStepStatus(side) {
  const sides = side === 'B' ? ['B'] : side === 'A' ? ['A'] : ['A', 'B'];
  const idleIdx = Math.max(0, CYLINDER_STEP_ORDER.indexOf('IDLE')); // Main 시퀀스 편집으로 IDLE 위치가 바뀌어도 안전
  sides.forEach((s) => { cylinderCurrentStepIndex[s] = idleIdx; completedStatusSteps[s].clear(); applyCylinderStepStatus(s); });
}

// ── Maintenance Purge - 유지보수 메뉴의 세 번째 항목. 배관 청소/누출 시험 두 갈래로만
// 나뉜다(실제 시퀀스 로직은 아직 없음, 뼈대). 취소는 유지보수 메뉴로 되돌아간다. ──
function showProgressMaintenancePurge() {
  showProgressScreen('maintenancePurge', sideScreenTitle('maintenancePurge', 'Maintenance Purge', progressCurrentSide));
}

// ── 수동 배관 청소 - Maintenance Purge 화면의 "배관 청소" 버튼으로 들어온다. 설정 횟수만큼
// 반복하는 실제 시퀀스/카운트 로직은 아직 없음(뼈대) - 확인은 토스트만, 진행 횟수는 0 고정.
// 취소는 Maintenance Purge 화면으로 되돌아간다. ──
function showProgressPipeClean() {
  showProgressScreen('pipeClean', sideScreenTitle('pipeClean', '수동 배관 청소', progressCurrentSide));
}

// ── 누출 시험 종류 선택 - Maintenance Purge 화면의 "누출 시험" 버튼으로 들어온다.
// VT 감압 시험/PT 감압 시험/가압 시험 중 하나를 고르고 확인하는 화면(뼈대, 실제 시퀀스
// 없음). 취소는 Maintenance Purge 화면으로 되돌아간다. ──
let leakTestSelected = null;
function showProgressLeakTest() {
  leakTestSelected = null;
  progressLeakTestBody.querySelectorAll('.leak-test-btn').forEach((b) => b.classList.remove('selected'));
  showProgressScreen('leakTest', sideScreenTitle('leakTest', '수동 누출 시험', progressCurrentSide));
}

// ── 수동 VT 감압 시험 - 누출 시험 화면의 "VT 감압 시험" 버튼으로 들어온다. 설정시간/
// 설정값만 입력 가능하고, 진행시간·초기값·현재값은 실제 시퀀스가 없어 0(.000) 고정
// 표시다(뼈대). 취소는 누출 시험 화면으로 되돌아간다. ──
function showProgressVtTest() {
  showProgressScreen('vtTest', sideScreenTitle('vtTest', '수동 VT 감압시험', progressCurrentSide));
}

// ── 수동 감압 시험 / 수동 가압 시험 - 누출 시험 화면의 "PT 감압 시험"/"가압 시험" 버튼으로
// 들어온다. 둘 다 HPT_A1~A4(또는 B1~B4) 4점의 초기압력/현재압력을 같은 구성으로 보여줘서
// 표 렌더링(renderHptRows)을 공유한다 - unit1.json에 아직 없는 태그라(뼈대) 이름만 현재
// 측(A/B)에 맞춰 동적으로 만들고 값은 0 고정 표시한다. 취소는 누출 시험 화면으로
// 되돌아간다. ──
const HPT_ROW_COUNT = 4;
function renderHptRows(tbodyId, side) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = '';
  for (let i = 1; i <= HPT_ROW_COUNT; i++) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>HPT_${side}${i} :</td>`
      + '<td><span class="purge-count-box small">[ <span class="purge-count-value">0</span> ]</span></td>'
      + '<td><span class="purge-count-box small">[ <span class="purge-count-value">0</span> ]</span></td>';
    tbody.appendChild(tr);
  }
}
function showProgressPtTest() {
  renderHptRows('ptTestRows', progressCurrentSide || 'A');
  showProgressScreen('ptTest', sideScreenTitle('ptTest', '수동 감압 시험', progressCurrentSide));
}
function showProgressPressureTest() {
  renderHptRows('pressureTestRows', progressCurrentSide || 'A');
  showProgressScreen('pressureTest', sideScreenTitle('pressureTest', '수동 가압 시험', progressCurrentSide));
}

// ── 수동밸브 조작 - 유지보수 메뉴의 첫 항목. A/B측 전용 밸브(_A/_B)와 공통 밸브를
// 3열 격자로 배치한다(행 수는 항목 개수에 맞춰 자동 - .valve-grid의 grid-auto-rows:1fr가
// 세로 폭을 항상 균등하게 맞춘다, gms.css 참고). 태그는 배관도화면(unit1.json)과 동일한
// 이름을 쓴다(사용자 확인 매칭: AV1A→PGI_A, AV2A→HPI_A, AV3A→LPI_A, AV4A→LPV_A,
// AV5A→HPV_A, AV11A→PGII_A, AV14A→FPV_A, AV6→HPIV, AV7→PIV, AV8→PNV, AV9→PNBV,
// AV10→GNV, B측은 대칭). ESO는 배관도에 위치/주소 자체가 없어(unit1.json에 항목 없음)
// 여전히 제외했지만, VN1(구 AV12)・VN2(CIO206)・AG_A/AG_B(CIO207/208)를 추가해
// unit1.json의 밸브 25개 전부가 이 격자에 대응된다. 전체 밸브가 실제 점멸+확인+쓰기로
// 동작한다(요청에 따라 확장 완료) - 인터락 로직은 다음 단계에서 추가할 예정. ──
// 격자 순서(왼쪽 위→오른쪽 아래). common이면 접미사 없이, 아니면 현재 side(_A/_B) 접미사.
// H/T만 밸브가 아니라 히터 조작 화면으로 넘어가는 버튼이다(heater:true).
const MANUAL_VALVE_GRID_LAYOUT = [
  { key: 'V/S' }, { key: 'PGI' }, { key: 'HPI' },
  { key: 'LPI' }, { key: 'LPV' }, { key: 'HPV' },
  { key: 'HPIV', common: true }, { key: 'PIV', common: true }, { key: 'PNV', common: true },
  { key: 'PNBV', common: true }, { key: 'GNV', common: true }, { key: 'PGII' },
  { key: 'VN1', common: true }, { key: 'VN2', common: true }, { key: 'FPV' },
  { key: 'AG' }, { key: 'H/T', common: true, heater: true },
];
// Line Vent로 진입 시 표현할 6개 밸브 (PNV, LPV, HPV, HPI, PGI, PGII)
const LINE_VENT_VALVE_GRID_LAYOUT = [
  { key: 'PNV', common: true }, { key: 'LPV' }, { key: 'HPV' },
  { key: 'HPI' }, { key: 'PGI' }, { key: 'PGII' },
];

function renderManualValveGrid(side) {
  manualValveGrid.innerHTML = '';
  const isLineVent = manualValvePrevScreen === 'gasSupplyPressureCheck';
  const layout = isLineVent ? LINE_VENT_VALVE_GRID_LAYOUT : MANUAL_VALVE_GRID_LAYOUT;
  layout.forEach((item) => {
    const tag = item.common ? item.key : `${item.key}_${side}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'valve-grid-btn';
    btn.textContent = tag;
    btn.dataset.tag = tag;
    btn.addEventListener('click', () => {
      if (item.heater) { showProgressHeater(); return; }
      requestValveAction(tag);
    });
    manualValveGrid.appendChild(btn);
  });
  applyGmsValues(lastValueByTag); // 격자를 새로 그렸으니 이미 알고 있는 최신 상태를 바로 반영
}
function showProgressManualValve() {
  renderManualValveGrid(progressCurrentSide || 'A');
  showProgressScreen('manualValve', sideScreenTitle('manualValve', '수동 밸브 조작', progressCurrentSide));
}
// ── 수동밸브 조작 화면 "취소" - 바로 나가지 않는다. 열린 밸브가 있으면 유지/전부 CLOSE
// 여부를 먼저 묻고, 그 다음 비밀번호를 다시 확인한 뒤에야 원래 화면으로 이동한다.
// H/T는 밸브가 아니라 화면 전환 버튼이라 이 열림 검사에서 제외한다. ──
function currentGridOpenEnabledTags() {
  const side = progressCurrentSide || 'A';
  const isLineVent = manualValvePrevScreen === 'gasSupplyPressureCheck';
  const layout = isLineVent ? LINE_VENT_VALVE_GRID_LAYOUT : MANUAL_VALVE_GRID_LAYOUT;
  return layout
    .filter((item) => !item.heater)
    .map((item) => (item.common ? item.key : `${item.key}_${side}`))
    .filter((tag) => valveStateClass(lastValueByTag[tag]) === 'state-open');
}

// ── 히터 조작 - 수동밸브 조작 화면의 H/T 버튼으로 들어오는 화면. M/H(매니폴드)・J/H(재킷)・
// L/H_2nd(2차 배관) 3종 히터를 다루며, 전부 A/B 양쪽 각각 존재한다(요청사항). 밸브와 같은
// 방식(점멸+확인+쓰기)으로 동작하도록 unit1.json의 valves[]에 히터 태그를 그대로 추가해뒀다
// (requestValveAction/lastValueByTag를 그대로 재사용). 수동밸브 조작 화면과 격자 크기(3열×
// 5행)를 맞추려고 나머지 칸은 빈 자리(향후 히터 확장 자리)로 채운다. V/V 버튼으로 밸브
// 화면으로 돌아간다(서로 왔다갔다). ──
// L/H_2nd(2차 배관 히터)는 물리적으로 한 대뿐이라 A/B 공통(common) - 밸브 쪽 HPIV 등과
// 동일한 패턴이다. M/H(매니폴드)·J/H(재킷)는 실제로 A/B 각각 있어 계속 측별로 나뉜다.
const HEATER_GRID_LAYOUT = [{ key: 'M/H' }, { key: 'J/H' }, { key: 'L/H_2nd', common: true }];
const HEATER_GRID_TOTAL_SLOTS = 15; // 수동밸브 조작 화면과 동일한 3×5 격자 크기
function renderHeaterGrid(side) {
  manualHeaterGrid.innerHTML = '';
  // OPTION 탭에서 미적용 처리한 히터는 이 격자에서도 뺀다(요청사항 - gms.js의
  // isAnalogTagEnabled를 그대로 가져다 쓴다).
  const items = HEATER_GRID_LAYOUT
    .map((item) => ({ item, tag: item.common ? item.key : `${item.key}_${side}` }))
    .filter(({ tag }) => typeof isAnalogTagEnabled !== 'function' || isAnalogTagEnabled(tag));
  items.forEach(({ tag }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'valve-grid-btn';
    btn.textContent = tag;
    btn.dataset.tag = tag;
    btn.addEventListener('click', () => requestValveAction(tag));
    manualHeaterGrid.appendChild(btn);
  });
  for (let i = items.length; i < HEATER_GRID_TOTAL_SLOTS; i++) {
    const empty = document.createElement('div');
    empty.className = 'valve-grid-btn empty-slot';
    manualHeaterGrid.appendChild(empty);
  }
  applyGmsValues(lastValueByTag);
}
function showProgressHeater() {
  renderHeaterGrid(progressCurrentSide || 'A');
  showProgressScreen('heater', sideScreenTitle('heater', '히터 조작', progressCurrentSide));
}

let manualValvePrevScreen = null;
function exitManualValve() {
  if (manualValvePrevScreen === 'gasSupplyPressureCheck') {
    showProgressGasSupplyStep(0);
    if (typeof updateGspPressureCheckReadouts === 'function') {
      updateGspPressureCheckReadouts();
    }
    manualValvePrevScreen = null;
  } else {
    showProgressMaintenanceMenu();
  }
}

function closeValvesThenExit(tags) {
  Promise.all(tags.map((tag) => fetch('/api/gms/valve/write', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag, value: false }),
  }).then((r) => r.json()).catch((e) => ({ ok: false, error: e.message }))))
    .then((results) => {
      const failed = results.filter((r) => !r.ok);
      if (failed.length) toast(`일부 밸브 CLOSE 실패(${failed.length}건)`, 'err');
      else if (tags.length) toast(`밸브 ${tags.length}개 CLOSE 명령 전송됨`, 'ok');
    })
    .finally(() => proceedPastPasswordGate('manualValve', exitManualValve));
}
const manualValveExitModal = document.getElementById('manualValveExitModal');

// ── 조작화면 5개 파일을 OPERATION HTML/ 폴더에서 fetch해서 위 컨테이너들 안에 채워 넣는다.
// 화면이 늘어나도 이 매핑에 항목만 추가하면 되고, 각 파일은 피그마 등에서 화면별로 따로
// 열어 디자인만 편집할 수 있다(스타일은 공용 스타일시트 gms.css를 그대로 참조 - 각 파일에
// CSS를 복사해 넣지 않는다). ──
const OPERATION_SCREEN_FILES = {
  progressRootBody: 'OPERATION HTML/진행 메뉴.html',
  progressMainMenuBody: 'OPERATION HTML/메인 메뉴.html',
  progressPasswordBody: 'OPERATION HTML/PASSWORD.html',
  progressMaintenanceMenuBody: 'OPERATION HTML/유지보수 메뉴.html',
  progressManualValveBody: 'OPERATION HTML/수동 밸브 조작.html',
  progressHeaterBody: 'OPERATION HTML/히터 조작.html',
  progressMaintenancePurgeBody: 'OPERATION HTML/Maintenance Purge.html',
  progressPipeCleanBody: 'OPERATION HTML/수동 배관 청소.html',
  progressLeakTestBody: 'OPERATION HTML/누출 시험.html',
  progressVtTestBody: 'OPERATION HTML/수동 VT 감압시험.html',
  progressPtTestBody: 'OPERATION HTML/수동 감압 시험.html',
  progressPressureTestBody: 'OPERATION HTML/수동 가압 시험.html',
  progressBarcodeCheckBody: 'OPERATION HTML/수동 바코드 체크.html',
  // 실린더교환 모드 화면은 파일명 앞에 반드시 현재 Status(1P/-L/2P 등)를 접두사로 붙인다
  // (예: "교환전1P_") - 새 화면을 추가할 때도 이 규칙을 지킨다.
  progressCylinderLockCheckBody: 'OPERATION HTML/교환전1P_실린더 잠금 check.html',
  progressPulsAutoRunBody: 'OPERATION HTML/Puls_자동진행.html',
  progressOnePAutoRunBody: 'OPERATION HTML/1P_자동진행.html',
  progressOnePPurgeAutoRunBody: 'OPERATION HTML/1P_2차측Purge_자동진행.html',
  progressOnePPumpingAutoRunBody: 'OPERATION HTML/1P_Pumping_자동진행.html',
  progressOnePPrimaryPurgeAutoRunBody: 'OPERATION HTML/1P_1차측Purge_자동진행.html',
  progressExchangePressureTestBody: 'OPERATION HTML/교환전-L_감압시험.html',
  progressExchangeVtTestBody: 'OPERATION HTML/교환전-VT_VT 감압시험.html',
  progressExchangeSecondPurgeBody: 'OPERATION HTML/교환전2P_2차 배관청소.html',
  progressCylReplaceCheckBody: 'OPERATION HTML/용기교체CC_실린더 확인.html',
  progressCylReplaceValveOpenBody: 'OPERATION HTML/용기교체CC_Valve Open 확인.html',
  progressCylReplaceAutoGuardOpenBody: 'OPERATION HTML/용기교체CC_Auto Guard Open 확인.html',
  progressCylReplaceSwapBody: 'OPERATION HTML/용기교체CC_실린더 분리 및 교체.html',
  progressCylReplaceGasNameBody: 'OPERATION HTML/용기교체CC_Gas name 확인.html',
  progressCylReplaceAutoGuardCloseBody: 'OPERATION HTML/용기교체CC_Auto Guard Close 확인.html',
  progressExchangeAfterPressureTestBody: 'OPERATION HTML/교환후+L_가압시험.html',
  progressExchangeAfterPulsBody: 'OPERATION HTML/교환후_Puls2.html',
  progressExchangeThirdPurgeBody: 'OPERATION HTML/교환후3P_배관청소.html',
  progressExchangeAfterVtTestBody: 'OPERATION HTML/교환후-VT_VT감압시험.html',
  progressExchangeFourthPurgeBody: 'OPERATION HTML/교환후4P_배관청소.html',
  progressExchangePurgeCompleteBody: 'OPERATION HTML/PC_퍼지완료.html',
  progressHpLpPumpBody: 'OPERATION HTML/HP&LP_Pump.html',
  progressCylReplaceForcePurgeBody: 'OPERATION HTML/용기교체CC_Force Purge.html',
  progressGasSupplyPressureCheckBody: 'OPERATION HTML/가스공급_압력확인.html',
  progressGasSupplyValveShutterBody: 'OPERATION HTML/가스공급_Valve shutter 장착.html',
  progressGasSupplyRegulatorCloseBody: 'OPERATION HTML/가스공급_Regulator Close.html',
  progressGasSupplyCylinderOpenBody: 'OPERATION HTML/가스공급_Cylinder Open.html',
  progressGasSupplyRegulatorAdjustBody: 'OPERATION HTML/가스공급_Regulator 조정.html',
  progressGasSupplyPmvOpenBody: 'OPERATION HTML/가스공급_PMV Open 확인.html',
  progressGasSupplyFpvOpenBody: 'OPERATION HTML/가스공급_FPV Open 확인.html',
  progressGasSupplyReadyBody: 'OPERATION HTML/가스공급_준비완료.html',
  progressGasSupplyActiveBody: 'OPERATION HTML/가스공급_공급중.html',
  progressGasSupplyConfirmActionBody: 'OPERATION HTML/가스공급_동작재확인.html',
  progressTrendBody: 'OPERATION HTML/TREND.html',
  progressAdjustModeBody: 'OPERATION HTML/압력 조정 모드.html',
  progressPressureAdjustBody: 'OPERATION HTML/압력조정.html',
  progressWorkLogBody: 'OPERATION HTML/작업이력.html',
  progressErrorLogBody: 'OPERATION HTML/에러 사항.html',
  progressConfigModeBody: 'OPERATION HTML/설정모드.html',
  progressOptionDisplayBody: 'OPERATION HTML/OPTION DISPLAY.html',
  progressAuxMaintenanceModeBody: 'OPERATION HTML/유지보수모드.html',
  progressSequencePulsBody: 'OPERATION HTML/시퀀스_Puls.html',
  progressSequenceBypassBody: 'OPERATION HTML/시퀀스_Bypass.html',
  progressSequenceRgvBody: 'OPERATION HTML/시퀀스_RGV.html',
};
async function loadOperationScreens() {
  await Promise.all(Object.entries(OPERATION_SCREEN_FILES).map(async ([containerId, path]) => {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`[Operation] "${containerId}" 컨테이너를 gms.html에서 찾을 수 없습니다(${path}) - div가 빠졌을 수 있습니다.`);
      return;
    }
    try {
      const fileName = path.split('/').pop();
      let htmlText = null;
      if (window.OPERATION_SCREEN_BUNDLE && window.OPERATION_SCREEN_BUNDLE[fileName]) {
        htmlText = window.OPERATION_SCREEN_BUNDLE[fileName];
      } else {
        let encodedPath = path.split('/').map(segment => encodeURIComponent(segment)).join('/');
        let res;
        try {
          res = await fetch(encodedPath);
        } catch (err1) {
          res = await fetch(path);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        htmlText = await res.text();
      }
      const doc = new DOMParser().parseFromString(htmlText, 'text/html');
      const source = doc.getElementById(containerId);
      container.innerHTML = source ? source.innerHTML : doc.body.innerHTML;
    } catch (e) {
      container.innerHTML = `<div class="progress-menu-desc">화면 로딩 실패(${path}): ${e.message}</div>`;
    }
  }));
}

/** fetch로 방금 주입된 자식 요소(버튼 등)에 이벤트를 연결한다 - loadOperationScreens() 완료 후에만 호출. */
function wireOperationScreens() {
  passwordDisplay = document.getElementById('passwordDisplay');
  manualValveGrid = document.getElementById('manualValveGrid');
  manualHeaterGrid = document.getElementById('manualHeaterGrid');

  document.getElementById('trendBackBtn').addEventListener('click', () => {
    logWorkAction('trendBackBtn', progressCurrentSide);
    showProgressTrendBack();
  });
  // 작업이력 화면 "닫기" - 진행 메뉴로 나간다(showProgressScreen이 배관도 전체 폭
  // 레이아웃도 자동으로 되돌린다).
  document.getElementById('workLogCloseBtn')?.addEventListener('click', () => {
    logWorkAction('workLogCloseBtn', progressCurrentSide);
    showProgressRoot();
  });
  document.getElementById('errorLogCloseBtn')?.addEventListener('click', () => {
    logWorkAction('errorLogCloseBtn', progressCurrentSide);
    showProgressRoot();
  });
  document.getElementById('configModeCloseBtn')?.addEventListener('click', () => {
    logWorkAction('configModeCloseBtn', progressCurrentSide);
    exitConfigMode();
  });

  // 유지보수모드 화면 - PM/Set-up Mode 토글 + 이전화면(메인 메뉴 또는 진행 메뉴)으로 복귀.
  document.getElementById('pmModeToggleBtn')?.addEventListener('click', () => toggleMaintenanceMode('pm'));
  document.getElementById('setupModeToggleBtn')?.addEventListener('click', () => toggleMaintenanceMode('setup'));
  document.getElementById('auxMaintenanceModeCloseBtn')?.addEventListener('click', () => {
    logWorkAction('auxMaintenanceModeCloseBtn', progressCurrentSide);
    if (progressCurrentSide) showProgressMainMenu(progressCurrentSide);
    else showProgressRoot();
  });

  // ── 실린더 교환 자동 진행 중 다음 단계로 넘어가는 지점(진입 지점)들의 실제 이동 로직을
  // 함수로 뽑아뒀다 - gms.js의 passwordGateEnabled(key)가 "적용"이면 PASSWORD 확인 후
  // (passwordConfirmBtn에서) 호출하고, "미적용"이면 각 버튼 핸들러에서 PASSWORD 없이
  // 바로 호출한다(gate 옵션의 OPTION 탭 UI는 gms.js PASSWORD_GATE_DEFS 참고). ──
  function advanceCylinderExchangeEntry() {
    // Status가 이미 CC(용기교체 중 메인 메뉴로 빠져나온 경우)면 처음(실린더 잠금 check)
    // 부터가 아니라 CC의 첫 화면(실린더 확인)으로 바로 이어서 들어간다.
    const stepKey = CYLINDER_STEP_ORDER[cylinderCurrentStepIndex[progressCurrentSide]];
    if (stepKey === 'CC') {
      showProgressCylExchangePurgeStep(CYL_EXCHANGE_PURGE_STEPS.findIndex((s) => s.key === 'cylReplaceCheck'));
    } else {
      showProgressCylinderLockCheck();
    }
  }
  function advanceCylinderExchangeDone() {
    // 2차 배관청소까지 마쳤을 때 - 2P를 정상 완료로 기록하고 다음 Status(기본값 "CC")로
    // 들어간다(PASSWORD 확인 후에만 호출되므로 여기서 기록해야 취소 시 잘못 완료 표시되지
    // 않는다). 다음 Status는 advanceToNextEnabledStatus가 Main 시퀀스 순서를 보고 정한다.
    markStepComplete(progressCurrentSide, cylinderCurrentStepIndex[progressCurrentSide]);
    advanceToNextEnabledStatus(progressCurrentSide);
  }
  // showProgressCylExchangePurgeStep(top-level 함수, wireOperationScreens 바깥)이 2P
  // 서브시퀀스 엔진의 onFinish 콜백에서 이 함수를 호출해야 한다 - cancelPreCcToPassword와
  // 동일한 이유로 window에 노출해서 스코프를 넘긴다.
  window.advanceCylinderExchangeDone = advanceCylinderExchangeDone;
  function advanceCylReplaceDone() {
    // 용기교체 마지막 화면(Auto Guard 확인(Close))의 "확인" - 다음 Status(기본값 "3P")로
    // 넘어간다(CC는 큰 배지가 없어 완료 기록 불필요).
    advanceToNextEnabledStatus(progressCurrentSide);
  }
  function advanceExchangeFourthPurgeDone() {
    // 4차 배관청소 완료(afterFourP 서브시퀀스 엔진 onFinish) - 4P를 정상 완료로 기록하고
    // 다음 Status(기본값 "PC")로 넘어간다.
    markStepComplete(progressCurrentSide, cylinderCurrentStepIndex[progressCurrentSide]);
    advanceToNextEnabledStatus(progressCurrentSide);
  }
  // showProgressCylExchangePurgeStep(top-level 함수, wireOperationScreens 바깥)이 afterFourP
  // 서브시퀀스 엔진의 onFinish 콜백에서 이 함수를 호출해야 한다 - window.advanceCylinderExchangeDone과
  // 동일한 이유로 window에 노출해서 스코프를 넘긴다.
  window.advanceExchangeFourthPurgeDone = advanceExchangeFourthPurgeDone;
  function advanceCylinderLockCheckExit() {
    // 실린더 잠금 check "취소" 및 교환전 서브시퀀스 취소 - 실행 중이던 서브시퀀스를 완전히 정지하고
    // Status를 IDLE로 되돌린 뒤 메인 메뉴로 완전히 빠진다.
    if (typeof window.stopAllSubSequences === 'function') window.stopAllSubSequences();
    resetCylinderStepStatus(progressCurrentSide);
    showProgressMainMenu(progressCurrentSide);
  }
  function advanceCylReplaceCancelExit() {
    // 용기교체(Status "CC") 6단계 자체의 "취소" 목적지 - Status 램프(CC)는 손대지 않고
    // 그대로 유지한 채 화면만 메인 메뉴로 이동한다.
    if (typeof window.stopAllSubSequences === 'function') window.stopAllSubSequences();
    showProgressMainMenu(progressCurrentSide);
  }
  function advanceExchangeAfterCancelExit() {
    // 교환후(Bypass~4P) 구간 공통 "취소" 목적지 - CC 첫 번째 스텝(실린더 확인)으로 되돌아간다.
    if (typeof window.stopAllSubSequences === 'function') window.stopAllSubSequences();
    showProgressCylExchangePurgeStep(CYL_EXCHANGE_PURGE_STEPS.findIndex((s) => s.key === 'cylReplaceCheck'));
  }
  function advancePostPcCancelExit() {
    // 퍼지완료(PC) 이후(HP&LP Pump, RGV, 가스공급준비 7단계 등) 취소 시:
    // 1. 모든 공정 밸브 완전 CLOSE
    if (typeof closeAllProcessValvesDirect === 'function') {
      closeAllProcessValvesDirect(progressCurrentSide);
    }
    // 2. 실행 중이던 서브시퀀스 초기화
    if (typeof window.stopNamespacedSubSequenceRunner === 'function') {
      window.stopNamespacedSubSequenceRunner('hpLpPump');
    }
    // 3. PC/가스공급 화면(exchangePurgeComplete)으로 이동
    cancelGasSupply();
  }

  document.getElementById('progressABtn').addEventListener('click', () => {
    logWorkAction('progressABtn', 'A');
    showProgressMainMenu('A');
  });
  document.getElementById('progressBBtn').addEventListener('click', () => {
    logWorkAction('progressBBtn', 'B');
    showProgressMainMenu('B');
  });
  document.getElementById('progressAuxBtn').addEventListener('click', () => {
    logWorkAction('progressAuxBtn', progressCurrentSide);
    openAuxMenu();
  });
  document.getElementById('mainMenuCancelBtn').addEventListener('click', () => {
    logWorkAction('mainMenuCancelBtn', progressCurrentSide);
    showProgressRoot();
  });
  document.getElementById('mainMenuSwitchSideBtn').addEventListener('click', () => {
    logWorkAction('mainMenuSwitchSideBtn', progressCurrentSide);
    showScreenForSideStatus(progressCurrentSide === 'A' ? 'B' : 'A');
  });
  document.getElementById('mainMenuAuxBtn').addEventListener('click', () => {
    logWorkAction('mainMenuAuxBtn', progressCurrentSide);
    openAuxMenu();
  });

  document.querySelectorAll('.password-keypad [data-digit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (passwordDigits.length >= 8) return; // 과도한 입력 방지
      passwordDigits += btn.dataset.digit;
      renderPasswordDisplay();
    });
  });
  // 물리 키보드 지원 - PASSWORD 화면이 보이는 동안만 숫자/백스페이스/Delete/Enter/Esc를
  // 화면 키패드의 같은 버튼 클릭으로 그대로 연결한다(로직 중복 없이 기존 클릭 핸들러 재사용 -
  // 요청사항: "화면터치만 되는데 키보드 키패드도 함께 되었으면").
  document.addEventListener('keydown', (e) => {
    if (!progressScreens.password || progressScreens.password.style.display !== '') return;
    if (/^[0-9]$/.test(e.key)) {
      const digitBtn = document.querySelector(`.password-keypad [data-digit="${e.key}"]`);
      if (digitBtn) { e.preventDefault(); digitBtn.click(); }
      return;
    }
    if (e.key === 'Backspace') { e.preventDefault(); document.getElementById('passwordBackBtn').click(); return; }
    if (e.key === 'Delete') { e.preventDefault(); document.getElementById('passwordClearBtn').click(); return; }
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('passwordConfirmBtn').click(); return; }
    if (e.key === 'Escape') { e.preventDefault(); document.getElementById('passwordCancelBtn').click(); return; }
  });
  document.getElementById('passwordClearBtn').addEventListener('click', () => {
    passwordDigits = '';
    renderPasswordDisplay();
  });
  document.getElementById('passwordBackBtn').addEventListener('click', () => {
    passwordDigits = passwordDigits.slice(0, -1);
    renderPasswordDisplay();
  });
  document.getElementById('passwordCancelBtn').addEventListener('click', () => {
    // 1. 최우선: 비밀번호 진입 직전 화면 백업 정보(passwordPreviousScreenInfo)가 있으면 해당 원래 화면으로 100% 안전 복귀.
    // 서브시퀀스 진행 중 "취소"를 눌러 비밀번호 화면으로 들어왔다가 "취소"를 누른 경우,
    // 시퀀스는 백그라운드에서 멈추지 않고 계속 진행 중이었으므로 원래 서브시퀀스 화면으로 되돌아가고 패널을 다시 보여준다.
    if (passwordPreviousScreenInfo) {
      const prev = passwordPreviousScreenInfo;
      passwordPreviousScreenInfo = null;
      if (prev.side) progressCurrentSide = prev.side;
      showProgressScreen(prev.name, prev.header);
      if (prev.name === 'gasSupplyPressureCheck' && typeof updateGspPressureCheckReadouts === 'function') {
        updateGspPressureCheckReadouts();
      }
      if (typeof window.restoreRunningSubSequencePanel === 'function') {
        window.restoreRunningSubSequencePanel();
      }
      return;
    }

    // 직전 화면 정보가 없는 경우의 개별 fallback 처리:
    if (passwordCancelTarget === 'manualValve') { showProgressManualValve(); return; }
    if (passwordCancelTarget === 'heater') { showProgressHeater(); return; }
    if (passwordCancelTarget === 'cylinderLockCheck') { showProgressCylinderLockCheck(); return; }
    if (passwordCancelTarget === 'cylinderExchangeDone') {
      showProgressCylExchangePurgeStep(CYL_EXCHANGE_PURGE_STEPS.findIndex((s) => s.key === 'exchangeSecondPurge'));
      return;
    }
    if (['cylReplace', 'exchangeAfterCancel', 'postPcCancel'].includes(passwordCancelTarget)) {
      const gasIdx = GAS_SUPPLY_STEPS.findIndex((s) => s.key === cylReplaceCancelFromKey);
      if (gasIdx !== -1) { showProgressGasSupplyStep(gasIdx); return; }
      showProgressCylExchangePurgeStep(CYL_EXCHANGE_PURGE_STEPS.findIndex((s) => s.key === cylReplaceCancelFromKey));
      return;
    }
    if (passwordCancelTarget === 'cylReplaceDone') {
      showProgressCylExchangePurgeStep(CYL_EXCHANGE_PURGE_STEPS.findIndex((s) => s.key === 'cylReplaceAutoGuardClose'));
      return;
    }
    if (passwordCancelTarget === 'exchangeFourthPurgeDone') {
      showProgressCylExchangePurgeStep(CYL_EXCHANGE_PURGE_STEPS.findIndex((s) => s.key === 'exchangeFourthPurge'));
      return;
    }
    if (passwordCancelTarget === 'gasSupplyEntry') {
      showProgressCylExchangePurgeStep(CYL_EXCHANGE_PURGE_STEPS.findIndex((s) => s.key === 'exchangePurgeComplete'));
      return;
    }
    if (['gasSupplyPauseEntry', 'gasSupplyStopEntry', 'gasSupplyForceChangeEntry'].includes(passwordCancelTarget)) {
      showProgressGasSupplyActive(progressCurrentSide);
      return;
    }
    if (passwordCancelTarget === 'workLogClear') { showProgressWorkLog(); return; }
    if (passwordCancelTarget === 'errorLogClear') { showProgressErrorLog(); return; }
    if (passwordCancelTarget === 'adjustMode') { exitAdjustMode(); return; }
    if (passwordCancelTarget === 'lineVent') { showProgressGasSupplyStep(0); return; }

    if (progressCurrentSide) showProgressMainMenu(progressCurrentSide);
    else showProgressRoot();
  });
  document.getElementById('passwordConfirmBtn').addEventListener('click', () => {
    if (!passwordDigits) { toast('비밀번호를 입력하세요.', 'err'); return; }
    // 마스터 비밀번호 하나가 아니라 USER 탭(gms.js의 gmsUsersList, /api/gms/users)에 등록된
    // 작업자 개개인의 비밀번호로 통과시킨다. gmsUsersList가 아직 안 불러와졌거나(네트워크
    // 지연) 계정이 하나도 등록 안 된 경우에만 MAINTENANCE_PASSWORD를 최후의 안전장치로
    // 허용한다(정상적으로 계정이 등록되어 있으면 이 경로는 쓰이지 않는다).
    const matchedUser = gmsUsersList.find((u) => u.password === passwordDigits);
    const allowFallback = gmsUsersList.length === 0 && passwordDigits === MAINTENANCE_PASSWORD;
    if (!matchedUser && !allowFallback) {
      toast('비밀번호가 일치하지 않습니다.', 'err');
      passwordDigits = '';
      renderPasswordDisplay();
      return;
    }
    if (matchedUser) {
      toast(`[${matchedUser.role}] ${matchedUser.name}님 확인되었습니다.`, 'ok');
      // "작업이력" 기록용 - PASSWORD 없이 눌린 다음 키들은 이 값을 그대로 조작자로 복사한다
      // (logWorkAction 참고).
      currentGmsOperator = { name: matchedUser.name, role: matchedUser.role };
    }
    // 확인 후 목적지도 어떤 경로로 PASSWORD에 들어왔는지(passwordCancelTarget)에 따라
    // 다르다 - 실린더 교환 진입은 실린더 잠금 check 화면으로, 실린더 잠금 check에서 취소로
    // 나가는 경우는 비밀번호 통과 후 메인 메뉴로 완전히 빠진다. 그 외(유지보수/수동밸브
    // 조작·히터 조작 재확인)는 전부 유지보수 메뉴로 간다.
    if (passwordCancelTarget === 'cylinderExchange') { advanceCylinderExchangeEntry(); return; }
    if (passwordCancelTarget === 'cylinderExchangeDone') { advanceCylinderExchangeDone(); return; }
    if (passwordCancelTarget === 'cylinderLockCheck') { advanceCylinderLockCheckExit(); return; }
    // 용기교체(CC) 6단계 자체의 "취소"는 Status(CC)를 그대로 둔 채 메인 메뉴로 나간다.
    if (passwordCancelTarget === 'cylReplace') { advanceCylReplaceCancelExit(); return; }
    // 교환후(Bypass~4P) 구간은 CC 초기 화면(실린더 확인)으로 되돌아간다(Status도 CC로).
    if (passwordCancelTarget === 'exchangeAfterCancel') { advanceExchangeAfterCancelExit(); return; }
    // PC 이후(RGV·가스공급준비 7단계) 구간은 PC/가스공급 화면(exchangePurgeComplete)으로
    // 되돌아간다.
    if (passwordCancelTarget === 'postPcCancel') { advancePostPcCancelExit(); return; }
    if (passwordCancelTarget === 'cylReplaceDone') { advanceCylReplaceDone(); return; }
    if (passwordCancelTarget === 'exchangeFourthPurgeDone') { advanceExchangeFourthPurgeDone(); return; }
    if (passwordCancelTarget === 'statusJump') { performStatusJump(); return; }
    if (passwordCancelTarget === 'gasSupplyEntry') { advanceToNextEnabledStatus(progressCurrentSide); return; }
    if (passwordCancelTarget === 'gasSupplyPauseEntry') { showGasSupplyConfirmAction('pause'); return; }
    if (passwordCancelTarget === 'gasSupplyStopEntry') { showGasSupplyConfirmAction('stop'); return; }
    if (passwordCancelTarget === 'gasSupplyForceChangeEntry') { showGasSupplyConfirmAction('forceChange'); return; }
    if (passwordCancelTarget === 'manualValve') { exitManualValve(); return; }
    if (passwordCancelTarget === 'lineVent') { manualValvePrevScreen = 'gasSupplyPressureCheck'; showProgressManualValve(); return; }
    if (passwordCancelTarget === 'adjustMode') { showProgressAdjustMode(pendingAdjustModeSide); return; }
    if (passwordCancelTarget === 'auxMaintenanceMode') { showProgressAuxMaintenanceMode(); return; }
    if (passwordCancelTarget === 'workLogClear') {
      // showProgressWorkLog()가 아니라 showProgressScreen을 직접 불러야 한다 - 이미
      // 마운트된 그리드를 다시 fetchWorkLog()로 새로고침하면 방금 지운 화면이 바로
      // 서버 데이터로 되돌아가 버린다(gms-worklog-widget.js의 window.initGmsWorkLogGrid
      // 참고 - 마운트된 상태에서 열면 항상 재조회한다). logWorkAction보다 먼저 불러야
      // 이력의 HTML화면 열에 "PASSWORD"가 아니라 "작업이력"이 남는다(logWorkAction은
      // 호출 시점에 보이는 화면을 그대로 기록하므로).
      showProgressScreen('workLog', screenTitleFor('workLog', '작업이력'));
      logWorkAction('workLogDataClearBtn', pendingWorkLogClearSide);
      if (window.clearWorkLogTabData) window.clearWorkLogTabData(pendingWorkLogClearSide);
      return;
    }
    if (passwordCancelTarget === 'errorLogClear') {
      // 작업이력 Data Clear와 완전히 같은 이유(showProgressScreen을 직접 불러야 재조회로
      // 되돌아가지 않음)로 동일하게 처리한다.
      showProgressScreen('errorLog', screenTitleFor('errorLog', '에러사항'));
      logWorkAction('errorLogDataClearBtn', pendingErrorLogClearSide);
      if (window.clearErrorLogTabData) window.clearErrorLogTabData(pendingErrorLogClearSide);
      return;
    }
    showProgressMaintenanceMenu();
  });

  document.getElementById('maintenanceMenuCancelBtn').addEventListener('click', () => {
    logWorkAction('maintenanceMenuCancelBtn', progressCurrentSide);
    if (progressCurrentSide) showProgressMainMenu(progressCurrentSide);
    else showProgressRoot();
  });

  // 압력 조정 모드 화면 - "취소"는 들어오기 전 화면으로 되돌아간다. "실행"은 서브시퀀스
  // 실행 엔진(public/gms-sub-sequence-runner.js)을 시작한다 - 어떤 서브시퀀스를 쓸지는
  // data/gmsSubSequenceSelection.json의 "AdjustMode" 매핑을 따른다(현재 샘플 하나 -
  // AdjustMode_v1). "압력조정"(PT Sensor 압력 조정)은 별도 화면으로 이동한다.
  document.getElementById('adjustModeExecuteBtn').addEventListener('click', () => {
    logWorkAction('adjustModeExecuteBtn', progressCurrentSide);
    if (window.startSubSequenceRunner) window.startSubSequenceRunner('AdjustMode', progressCurrentSide);
    else toast('서브시퀀스 실행 엔진을 불러오지 못했습니다.', 'err');
  });
  document.getElementById('adjustModeCancelBtn').addEventListener('click', () => {
    logWorkAction('adjustModeCancelBtn', progressCurrentSide);
    exitAdjustMode();
  });
  // "압력조정" - PT/Weight 아날로그 교정(MAX/분해능/ANALOG VALUE/OFFSET) 표 화면으로
  // 이동한다(public/gms-pt-calibration.js가 렌더링을 전담 - gms-sequence-editor.js와 같은
  // 관심사 분리). 이미 조정모드(PASSWORD 게이트 통과)에 들어와 있으므로 추가 PASSWORD는
  // 없다.
  document.getElementById('adjustModePressureBtn').addEventListener('click', () => {
    if (window.openPressureAdjustScreen) window.openPressureAdjustScreen(progressCurrentSide);
  });

  // Main Sequence.csv에는 있지만 화면이 없던 3단계(Puls/Bypass/RGV) 중 Puls/RGV는 여전히
  // 뼈대(안내문+실행/취소/TREND뿐) - "실행"은 완료 기록 후 다음 단계로 넘어간다(공용).
  // Bypass는 2026-08-09 TASK.md 지시로 실제 서브시퀀스 엔진 화면(ns='bypass')이 되어
  // 이 공용 루프에서 빠졌다(아래 별도 블록 참고). "취소"는 CC/PC 기준 구간에 따라 목적지가
  // 다르므로(Puls는 CC 전 → 메인메뉴, Bypass는 CC~PC 전 → CC 초기화면, RGV는 PC 이후 →
  // PC 화면) 아래에서 각자 따로 연결한다.
  [
    { prefix: 'sequencePuls' },
    { prefix: 'sequenceRgv' },
  ].forEach(({ prefix }) => {
    document.getElementById(`${prefix}RunBtn`).addEventListener('click', () => {
      logWorkAction(`${prefix}RunBtn`, progressCurrentSide);
      markStepComplete(progressCurrentSide, cylinderCurrentStepIndex[progressCurrentSide]);
      advanceToNextEnabledStatus(progressCurrentSide);
    });
    document.getElementById(`${prefix}TrendBtn`).addEventListener('click', () => {
      logWorkAction(`${prefix}TrendBtn`, progressCurrentSide);
      showGmsTrend();
    });
  });
  document.getElementById('sequencePulsCancelBtn').addEventListener('click', () => {
    logWorkAction('sequencePulsCancelBtn', progressCurrentSide);
    cancelPreCcToPassword();
  });
  // Bypass 화면 - 이제 서브시퀀스 엔진 화면(3P/4P와 동일 패턴)이라 "확인"/"실행"/
  // "취소"(stopBtnMode:'cancel')는 subSeqWireOnce가 자동으로 연결한다
  // (showProgressCylExchangePurgeStep의 sequenceBypass 분기 참고) - 여기서는 엔진이
  // 관여하지 않는 TREND 버튼(패널/idle 둘 다)만 개별로 연결한다.
  document.getElementById('sequenceBypassTrendBtn')?.addEventListener('click', () => {
    logWorkAction('sequenceBypassTrendBtn', progressCurrentSide);
    showGmsTrend();
  });
  document.getElementById('sequenceBypassIdleTrendBtn')?.addEventListener('click', () => {
    logWorkAction('sequenceBypassIdleTrendBtn', progressCurrentSide);
    showGmsTrend();
  });
  document.getElementById('sequenceRgvCancelBtn').addEventListener('click', () => {
    logWorkAction('sequenceRgvCancelBtn', progressCurrentSide);
    cancelPostPcToPassword('sequenceRgv');
  });

  document.getElementById('manualValveCancelBtn').addEventListener('click', () => {
    logWorkAction('manualValveCancelBtn', progressCurrentSide);
    // "수동조작 상태 유지 옵션"이 적용 상태면 열려있는 밸브/히터가 있어도 묻지 않고
    // 그대로 유지한 채 나간다(OPTION 탭에서 토글).
    if (manualStateHoldOption) { proceedPastPasswordGate('manualValve', exitManualValve); return; }
    const openTags = currentGridOpenEnabledTags();
    if (!openTags.length) { proceedPastPasswordGate('manualValve', exitManualValve); return; }
    manualValveExitModal.hidden = false;
  });
  document.getElementById('manualValveExitCloseBtn').addEventListener('click', () => {
    logWorkAction('manualValveExitCloseBtn', progressCurrentSide);
    manualValveExitModal.hidden = true;
    if (!requireOperationMode('밸브 CLOSE')) { proceedPastPasswordGate('manualValve', exitManualValve); return; }
    closeValvesThenExit(currentGridOpenEnabledTags());
  });
  document.getElementById('manualValveExitKeepBtn').addEventListener('click', () => {
    logWorkAction('manualValveExitKeepBtn', progressCurrentSide);
    manualValveExitModal.hidden = true;
    proceedPastPasswordGate('manualValve', exitManualValve);
  });
  document.getElementById('manualValveQcBtn').addEventListener('click', () => {
    logWorkAction('manualValveQcBtn', progressCurrentSide);
    toast('Q/C(PT 이력 로그) 화면은 아직 준비 중입니다.', '');
  });
  document.getElementById('manualValveConfirmBtn').addEventListener('click', () => {
    logWorkAction('manualValveConfirmBtn', progressCurrentSide);
    toast('확인 기능은 아직 준비 중입니다.', '');
  });

  // ── 히터 조작 화면 - V/V로 밸브 화면과 서로 왔다갔다 한다. 취소/확인/Q-C는 우선
  // 수동밸브 조작 화면과 같은 뼈대(열림 확인 없이 바로 전환/토스트)로 둔다 - 인터락은
  // 다음 단계에서 밸브와 함께 추가할 예정. ──
  document.getElementById('heaterToValveBtn').addEventListener('click', () => {
    logWorkAction('heaterToValveBtn', progressCurrentSide);
    showProgressManualValve();
  });
  // "취소"는 V/V(밸브 화면으로 되돌아가기)와 달리, 수동밸브 조작 화면의 취소와 같은 레벨로
  // 조작 자체를 끝내고 PASSWORD 화면으로 나간다(열림 확인은 인터락 단계에서 추가 예정).
  document.getElementById('heaterCancelBtn').addEventListener('click', () => {
    logWorkAction('heaterCancelBtn', progressCurrentSide);
    proceedPastPasswordGate('heater', showProgressMaintenanceMenu);
  });
  document.getElementById('heaterQcBtn').addEventListener('click', () => {
    logWorkAction('heaterQcBtn', progressCurrentSide);
    toast('Q/C(PT 이력 로그) 화면은 아직 준비 중입니다.', '');
  });
  document.getElementById('heaterConfirmBtn').addEventListener('click', () => {
    logWorkAction('heaterConfirmBtn', progressCurrentSide);
    toast('확인 기능은 아직 준비 중입니다.', '');
  });

  // ── Maintenance Purge 화면 - "배관 청소"/"누출 시험" 모두 실제 화면 전환. 취소는
  // 유지보수 메뉴로 되돌아간다. ──
  progressMaintenancePurgeBody.querySelectorAll('[data-purge-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.purgeAction === '배관 청소') { showProgressPipeClean(); return; }
      if (btn.dataset.purgeAction === '누출 시험') { showProgressLeakTest(); return; }
      toast(`${btn.dataset.purgeAction} 기능은 아직 준비 중입니다.`, '');
    });
  });
  document.getElementById('maintenancePurgeCancelBtn').addEventListener('click', () => {
    logWorkAction('maintenancePurgeCancelBtn', progressCurrentSide);
    showProgressMaintenanceMenu();
  });

  // ── 수동 배관 청소 화면 - 확인은 아직 뼈대(토스트만). 취소는 Maintenance Purge
  // 화면으로 되돌아간다. ──
  document.getElementById('pipeCleanConfirmBtn').addEventListener('click', () => {
    logWorkAction('pipeCleanConfirmBtn', progressCurrentSide);
    toast('확인 기능은 아직 준비 중입니다.', '');
  });
  document.getElementById('pipeCleanCancelBtn').addEventListener('click', () => {
    logWorkAction('pipeCleanCancelBtn', progressCurrentSide);
    showProgressMaintenancePurge();
  });

  // ── 누출 시험 화면 - VT 감압/PT 감압/가압 시험 버튼을 누르면 그 즉시 강조 표시 + 화면
  // 전환(또는 아직 없는 화면이면 토스트)까지 한 번에 처리한다(예전엔 선택 후 "확인"을
  // 따로 눌러야 해서 "버튼을 눌러도 이동이 안 된다"는 문제가 있었음). "확인" 버튼은
  // 마지막으로 선택한 항목을 같은 방식으로 다시 실행하는 보조 버튼으로 남겨둔다.
  function goToLeakTest(name) {
    leakTestSelected = name;
    progressLeakTestBody.querySelectorAll('.leak-test-btn').forEach((b) => b.classList.toggle('selected', b.dataset.leakTest === name));
    if (name === 'VT 감압 시험') { showProgressVtTest(); return; }
    if (name === 'PT 감압 시험') { showProgressPtTest(); return; }
    if (name === '가압 시험') { showProgressPressureTest(); return; }
    toast(`${name} 기능은 아직 준비 중입니다.`, '');
  }
  progressLeakTestBody.querySelectorAll('.leak-test-btn').forEach((btn) => {
    btn.addEventListener('click', () => goToLeakTest(btn.dataset.leakTest));
  });
  document.getElementById('leakTestConfirmBtn').addEventListener('click', () => {
    if (!leakTestSelected) { toast('시험 종류를 먼저 선택하세요.', 'err'); return; }
    logWorkAction('leakTestConfirmBtn', progressCurrentSide);
    goToLeakTest(leakTestSelected);
  });
  document.getElementById('leakTestCancelBtn').addEventListener('click', () => {
    logWorkAction('leakTestCancelBtn', progressCurrentSide);
    showProgressMaintenancePurge();
  });

  // ── 수동 VT 감압 시험 화면 - 실행은 아직 뼈대(토스트만). 취소는 누출 시험 화면으로
  // 되돌아간다. ──
  document.getElementById('vtTestRunBtn').addEventListener('click', () => {
    logWorkAction('vtTestRunBtn', progressCurrentSide);
    toast('실행 기능은 아직 준비 중입니다.', '');
  });
  document.getElementById('vtTestCancelBtn').addEventListener('click', () => {
    logWorkAction('vtTestCancelBtn', progressCurrentSide);
    showProgressLeakTest();
  });

  // ── 수동 감압 시험(PT) 화면 - 확인은 아직 뼈대(토스트만). 취소는 누출 시험 화면으로
  // 되돌아간다. ──
  document.getElementById('ptTestConfirmBtn').addEventListener('click', () => {
    logWorkAction('ptTestConfirmBtn', progressCurrentSide);
    toast('확인 기능은 아직 준비 중입니다.', '');
  });
  document.getElementById('ptTestCancelBtn').addEventListener('click', () => {
    logWorkAction('ptTestCancelBtn', progressCurrentSide);
    showProgressLeakTest();
  });

  // ── 수동 가압 시험 화면 - 확인은 아직 뼈대(토스트만). 취소는 누출 시험 화면으로
  // 되돌아간다. ──
  document.getElementById('pressureTestConfirmBtn').addEventListener('click', () => {
    logWorkAction('pressureTestConfirmBtn', progressCurrentSide);
    toast('확인 기능은 아직 준비 중입니다.', '');
  });
  document.getElementById('pressureTestCancelBtn').addEventListener('click', () => {
    logWorkAction('pressureTestCancelBtn', progressCurrentSide);
    showProgressLeakTest();
  });

  // [X] 메인 메뉴 / 유지보수 메뉴 두 화면의 스텁 버튼(data-action)을 함께 처리한다.
  // "유지 보수"/"실린더 교환"/"수동밸브 조작"/"바코드 체크"/"Maintenance Purge"/"TREND"만
  // 실제 화면 전환, 나머지는 전부 "준비 중" 토스트. "실린더 교환"은 PASSWORD까지만 실제로
  // 이동하고, 그 다음 화면은 아직 없어(뼈대) 확인 후 토스트 + 메인 메뉴로 되돌아간다.
  [...progressMainMenuBody.querySelectorAll('[data-action]'), ...progressMaintenanceMenuBody.querySelectorAll('[data-action]')].forEach((btn) => {
    btn.addEventListener('click', () => {
      logWorkAction(btn.id, progressCurrentSide);
      if (btn.dataset.action === '유지 보수') { proceedPastPasswordGate('mainMenu', showProgressMaintenanceMenu); return; }
      if (btn.dataset.action === '실린더 교환') { proceedPastPasswordGate('cylinderExchange', advanceCylinderExchangeEntry); return; }
      if (btn.dataset.action === '수동밸브 조작') { manualValvePrevScreen = 'maintenanceMenu'; showProgressManualValve(); return; }
      if (btn.dataset.action === '바코드 체크') { showProgressBarcodeCheck(); return; }
      if (btn.dataset.action === 'Maintenance Purge') { showProgressMaintenancePurge(); return; }
      if (btn.dataset.action === 'TREND') { showGmsTrend(); return; }
      toast(`${btn.dataset.action} 기능은 아직 준비 중입니다.`, '');
    });
  });

  // ── 수동 바코드 체크 화면 - 확인은 아직 뼈대(토스트만). 취소는 유지보수 메뉴로
  // 되돌아간다. ──
  document.getElementById('barcodeCheckConfirmBtn').addEventListener('click', () => {
    logWorkAction('barcodeCheckConfirmBtn', progressCurrentSide);
    toast('확인 기능은 아직 준비 중입니다.', '');
  });
  document.getElementById('barcodeCheckCancelBtn').addEventListener('click', () => {
    logWorkAction('barcodeCheckCancelBtn', progressCurrentSide);
    showProgressMaintenanceMenu();
  });

  // ── 실린더 잠금 check 화면 - "실행"을 누르면 IDLE 사전확인 7단계(실린더교환.xlsx 4~10번,
  // 서브시퀀스 엔진 ns='idleCheck')가 시작된다. 이 7단계 동안 Status는 IDLE 그대로다(사용자
  // 확인 결과 - Puls는 이 7단계가 아니라 그 다음의 잔류가스Check/Pulse Vent 2단계를
  // 가리킨다). 7단계 완료(onFinish) → Status가 Puls로 넘어가며 pulsAutoRun 화면이 자동
  // 시작된다. 취소는 바로 나가지 않고 PASSWORD를 다시 통과해야 메인 메뉴로 완전히
  // 빠진다(안전 재확인 - 수동밸브 조작 화면의 취소와 같은 패턴). ──
  document.getElementById('cylinderLockReturnBtn').addEventListener('click', () => {
    logWorkAction('cylinderLockReturnBtn', progressCurrentSide);
    const side = progressCurrentSide;
    if (window.startNamespacedSubSequenceRunner) {
      window.startNamespacedSubSequenceRunner('idleCheck', 'IdleCheck', side, {
        onFinish: () => {
          showProgressCylExchangePurgeStep(CYL_EXCHANGE_PURGE_STEPS.findIndex((s) => s.key === 'pulsAutoRun'));
        },
        onCancel: () => { window.cancelPreCcToPassword(); },
      });
    }
  });
  document.getElementById('cylinderLockCancelBtn').addEventListener('click', () => {
    logWorkAction('cylinderLockCancelBtn', progressCurrentSide);
    if (window.stopNamespacedSubSequenceRunner) window.stopNamespacedSubSequenceRunner('idleCheck');
    proceedPastPasswordGate('cylinderLockCheck', advanceCylinderLockCheckExit);
  });
  document.getElementById('cylinderLockTrendBtn').addEventListener('click', () => {
    logWorkAction('cylinderLockTrendBtn', progressCurrentSide);
    showGmsTrend();
  });
  document.getElementById('pulsTrendBtn')?.addEventListener('click', () => {
    logWorkAction('pulsTrendBtn', progressCurrentSide);
    showGmsTrend();
  });
  document.getElementById('pulsRunTrendBtn')?.addEventListener('click', () => {
    logWorkAction('pulsRunTrendBtn', progressCurrentSide);
    showGmsTrend();
  });
  document.getElementById('pulsRunIdleTrendBtn')?.addEventListener('click', () => {
    logWorkAction('pulsRunIdleTrendBtn', progressCurrentSide);
    showGmsTrend();
  });
  document.getElementById('onePTrendBtn')?.addEventListener('click', () => {
    logWorkAction('onePTrendBtn', progressCurrentSide);
    showGmsTrend();
  });
  document.getElementById('onePIdleTrendBtn')?.addEventListener('click', () => {
    logWorkAction('onePIdleTrendBtn', progressCurrentSide);
    showGmsTrend();
  });
  document.getElementById('onePPurgeTrendBtn')?.addEventListener('click', () => {
    logWorkAction('onePPurgeTrendBtn', progressCurrentSide);
    showGmsTrend();
  });
  document.getElementById('onePPurgeIdleTrendBtn')?.addEventListener('click', () => {
    logWorkAction('onePPurgeIdleTrendBtn', progressCurrentSide);
    showGmsTrend();
  });
  document.getElementById('onePPumpingTrendBtn')?.addEventListener('click', () => {
    logWorkAction('onePPumpingTrendBtn', progressCurrentSide);
    showGmsTrend();
  });
  document.getElementById('onePPumpingIdleTrendBtn')?.addEventListener('click', () => {
    logWorkAction('onePPumpingIdleTrendBtn', progressCurrentSide);
    showGmsTrend();
  });
  document.getElementById('onePPrimaryPurgeTrendBtn')?.addEventListener('click', () => {
    logWorkAction('onePPrimaryPurgeTrendBtn', progressCurrentSide);
    showGmsTrend();
  });
  document.getElementById('onePPrimaryPurgeIdleTrendBtn')?.addEventListener('click', () => {
    logWorkAction('onePPrimaryPurgeIdleTrendBtn', progressCurrentSide);
    showGmsTrend();
  });

  // CC 전(Zone1: IDLE 사전확인/Puls/1P/-L/-VT(교환전)/2P) 구간 공통 "취소" - PASSWORD를
  // 다시 통과해야 하고(실린더 잠금 check 화면의 취소와 같은 게이트를 공유 - 라벨도 이미
  // "교환전 취소 비밀번호"), 통과하면 Status를 IDLE로 되돌리고 메인 메뉴로 나간다
  // (advanceCylinderLockCheckExit - 아직 물리적으로 확정된 작업이 없는 구간이라 실린더
  // 잠금 check 취소와 동일하게 전부 되돌린다). Status Jump로 이 구간 중 어디로
  // 들어왔든 항상 똑같이 동작한다.
  function cancelPreCcToPassword() {
    proceedPastPasswordGate('cylinderLockCheck', advanceCylinderLockCheckExit);
  }
  // showProgressCylExchangePurgeStep(top-level 함수, wireOperationScreens 바깥)이 Puls/1P
  // 구간의 서브시퀀스 엔진 "취소" 콜백에서 이 함수를 호출해야 한다 - 함수 선언은 이 함수
  // (wireOperationScreens) 안에서만 보이므로 window에 노출해서 스코프를 넘긴다(이 파일의
  // 다른 cross-scope 노출과 동일 패턴).
  window.cancelPreCcToPassword = cancelPreCcToPassword;

  // ── 감압시험(-L) 화면 - 1차측 Purge 다음 단계. 이제 서브시퀀스 엔진 화면(Puls/1P 4단계와
  // 동일 패턴)이라 "확인"/"실행"/"취소"(stopBtnMode:'cancel')는 gms-sub-sequence-runner.js의
  // subSeqWireOnce가 자동으로 연결한다(showProgressCylExchangePurgeStep의 exchangePressureTest
  // 분기에서 등록한 onFinish/onCancel 콜백 참고) - 여기서는 엔진이 관여하지 않는 TREND
  // 버튼(패널/idle 둘 다)만 개별로 연결한다. "실행" 완료 시 VT 사용 옵션(gms.js의
  // vtUseOption)이 적용이면 VT 감압시험(-VT)으로, 미적용이면 바로 2차 배관청소(2P)로
  // 넘어간다(advanceToNextEnabledStatus가 처리). ──
  document.getElementById('exchangePressureTestTrendBtn')?.addEventListener('click', () => {
    logWorkAction('exchangePressureTestTrendBtn', progressCurrentSide);
    showGmsTrend();
  });
  document.getElementById('exchangePressureTestIdleTrendBtn')?.addEventListener('click', () => {
    logWorkAction('exchangePressureTestIdleTrendBtn', progressCurrentSide);
    showGmsTrend();
  });

  // ── VT 감압시험(-VT) 화면 - VT 사용 옵션이 적용일 때만 감압시험(-L) 다음에 들어온다. 이제
  // 서브시퀀스 엔진 화면(-L과 동일 패턴)이라 "확인"/"실행"/"취소"(stopBtnMode:'cancel')는
  // gms-sub-sequence-runner.js의 subSeqWireOnce가 자동으로 연결한다(showProgressCylExchangePurgeStep의
  // exchangeVtTest 분기에서 등록한 onFinish/onCancel 콜백 참고) - 여기서는 엔진이 관여하지
  // 않는 TREND 버튼(패널/idle 둘 다)만 개별로 연결한다. "실행" 완료 시 다음 Status(2P)로
  // 자동으로 넘어간다(옛 exchangeVtTestRunBtn과 동일 정책).
  document.getElementById('exchangeVtTestTrendBtn')?.addEventListener('click', () => {
    logWorkAction('exchangeVtTestTrendBtn', progressCurrentSide);
    showGmsTrend();
  });
  document.getElementById('exchangeVtTestIdleTrendBtn')?.addEventListener('click', () => {
    logWorkAction('exchangeVtTestIdleTrendBtn', progressCurrentSide);
    showGmsTrend();
  });

  // ── 2차 배관청소(2P) 화면 - 감압시험(또는 VT 감압시험) 다음(현재 마지막) 단계. 이제
  // 서브시퀀스 엔진 화면(1P 4단계/-L과 동일 패턴)이라 "확인"/"실행"/"취소"(stopBtnMode:'cancel')는
  // gms-sub-sequence-runner.js의 subSeqWireOnce가 자동으로 연결한다(showProgressCylExchangePurgeStep의
  // exchangeSecondPurge 분기에서 등록한 onFinish/onCancel 콜백 참고) - 여기서는 엔진이
  // 관여하지 않는 TREND 버튼(패널/idle 둘 다)만 개별로 연결한다. "실행" 완료(Step 20) 시
  // PASSWORD("실린더 교체") 재확인 후 다음 Status(CC)로 넘어간다(옛 exchangeSecondPurgeRunBtn과
  // 동일 정책, window.advanceCylinderExchangeDone 참고).
  document.getElementById('exchangeSecondPurgeTrendBtn')?.addEventListener('click', () => {
    logWorkAction('exchangeSecondPurgeTrendBtn', progressCurrentSide);
    showGmsTrend();
  });
  document.getElementById('exchangeSecondPurgeIdleTrendBtn')?.addEventListener('click', () => {
    logWorkAction('exchangeSecondPurgeIdleTrendBtn', progressCurrentSide);
    showGmsTrend();
  });

  // ── 용기교체(Status "CC") 6단계 - "실린더 교체" PASSWORD 통과 후 들어온다. 배지 없이
  // 안내문/버튼만 있는 화면들(실린더 확인 → Valve Open 확인 → Auto Guard 확인(Open) →
  // 실린더 분리 및 교체 → Gas name 확인 → Auto Guard 확인(Close)). 각 화면의 "취소"는
  // 바로 나가지 않고 PASSWORD를 다시 통과해야 한다(수동밸브 조작 화면의 취소와 같은
  // 안전 재확인 패턴 - PASSWORD의 "취소"를 누르면 cylReplaceCancelFromKey로 저장해둔
  // 원래 화면으로 되돌아간다). 통과하면 Status 램프(CC)는 그대로 유지한 채 메인 메뉴로
  // 나간다(advanceCylReplaceCancelExit) - 물리적으로 이미 진행한 작업이 있을 수 있으므로
  // 되돌리지 않고, 나중에 메인 메뉴에서 "실린더 교환"으로 다시 들어오면(위
  // passwordConfirmBtn의 cylinderExchange 분기) CC 상태를 보고 실린더 확인(첫 화면)으로
  // 이어서 들어간다. ──
  function cancelCylReplaceToPassword(stepKey) {
    cylReplaceCancelFromKey = stepKey;
    proceedPastPasswordGate('cylReplace', advanceCylReplaceCancelExit);
  }

  // 교환후(Status "+L"~"4P") 단계들의 "취소"도 용기교체와 마찬가지로 바로 나가지 않고
  // PASSWORD를 다시 통과해야 한다. 통과하면 CC 첫 번째 스텝(실린더 확인)으로 되돌아간다
  // (passwordConfirmBtn의 exchangeAfterCancel 분기 참고).
  function cancelExchangeAfterToPassword(stepKey) {
    cylReplaceCancelFromKey = stepKey;
    proceedPastPasswordGate('exchangeAfterCancel', advanceExchangeAfterCancelExit);
  }
  // showProgressCylExchangePurgeStep(top-level 함수, wireOperationScreens 바깥)이 교환후-VT
  // 서브시퀀스 엔진의 onCancel 콜백에서 이 함수를 호출해야 한다 - cancelPreCcToPassword와
  // 동일한 이유로 window에 노출해서 스코프를 넘긴다.
  window.cancelExchangeAfterToPassword = cancelExchangeAfterToPassword;

  // PC 이후(Status "RGV"·가스공급준비 7단계) 단계들의 "취소" - 위와 같은 안전 재확인
  // 패턴이지만 통과 후 목적지가 다르다(PC/가스공급 화면으로). stepKey는 CYL_EXCHANGE_PURGE_STEPS
  // (RGV) 또는 GAS_SUPPLY_STEPS(가스공급준비 7단계) 어느 쪽 key여도 된다 - PASSWORD의
  // "취소" 처리부(passwordCancelBtn)가 두 배열 모두에서 찾는다.
  function cancelPostPcToPassword(stepKey) {
    cylReplaceCancelFromKey = stepKey;
    proceedPastPasswordGate('postPcCancel', advancePostPcCancelExit);
  }
  window.cancelPostPcToPassword = cancelPostPcToPassword;

  // 용기교체(CC) 6화면 전체의 밸브 순서 데이터(CylReplace_v1.json)를 진입화면("실린더
  // 확인")에서만 엑셀로 내보내기/불러오기한다 - 다른 서브시퀀스 화면처럼 SUBSEQ_NS
  // 네임스페이스를 새로 등록하지 않고, gms-sub-sequence-runner.js의 subSeqWireExcelButtons를
  // mainStepType만 넘겨 그대로 재사용한다(범용 함수라 네임스페이스 등록 없이도 동작).
  if (typeof subSeqWireExcelButtons === 'function') {
    subSeqWireExcelButtons(
      'cylReplaceCheck', { mainStepType: 'CylReplace' },
      document.getElementById('cylReplaceCheckExcelExportBtn'),
      document.getElementById('cylReplaceCheckExcelImportBtn'),
      document.getElementById('cylReplaceCheckExcelFileInput')
    );
  }

  // "준비전 모드변경" - 실수로 누르는 걸 막기 위해 PASSWORD를 다시 통과해야 한다(실린더
  // 잠금 check 화면의 취소와 같은 게이트 - advanceCylinderLockCheckExit이 이미 정확히
  // "Status를 IDLE(준비 전)로 되돌리고 메인 메뉴로 나간다"를 한다).
  document.getElementById('cylReplaceCheckModeBtn').addEventListener('click', () => {
    logWorkAction('cylReplaceCheckModeBtn', progressCurrentSide);
    proceedPastPasswordGate('cylinderLockCheck', advanceCylinderLockCheckExit);
  });
  document.getElementById('cylReplaceCheckForcePurgeBtn').addEventListener('click', () => {
    logWorkAction('cylReplaceCheckForcePurgeBtn', progressCurrentSide);
    showProgressScreen('cylReplaceForcePurge', sideScreenTitle('cylReplaceForcePurge', '자동 진행', progressCurrentSide));
  });
  // Force Purge 화면 - "취소"는 실린더 확인 화면으로 되돌아간다.
  document.getElementById('cylReplaceForcePurgeCancelBtn').addEventListener('click', () => {
    logWorkAction('cylReplaceForcePurgeCancelBtn', progressCurrentSide);
    showProgressCylExchangePurgeStep(CYL_EXCHANGE_PURGE_STEPS.findIndex((s) => s.key === 'cylReplaceCheck'));
  });
  document.getElementById('cylReplaceCheckConfirmBtn').addEventListener('click', () => {
    logWorkAction('cylReplaceCheckConfirmBtn', progressCurrentSide);
    showProgressCylExchangePurgeStep(CYL_EXCHANGE_PURGE_STEPS.findIndex((s) => s.key === 'cylReplaceValveOpen'));
  });
  document.getElementById('cylReplaceCheckCancelBtn').addEventListener('click', () => {
    logWorkAction('cylReplaceCheckCancelBtn', progressCurrentSide);
    cancelCylReplaceToPassword('cylReplaceCheck');
  });

  // Valve Open 확인 화면 - PIV(공통)/PGI_·PGII_(측별) 태그를 현재 측에 맞춰 보여준다.
  document.getElementById('cylReplaceValveOpenConfirmBtn').addEventListener('click', () => {
    logWorkAction('cylReplaceValveOpenConfirmBtn', progressCurrentSide);
    showProgressCylExchangePurgeStep(CYL_EXCHANGE_PURGE_STEPS.findIndex((s) => s.key === 'cylReplaceAutoGuardOpen'));
  });
  document.getElementById('cylReplaceValveOpenCancelBtn').addEventListener('click', () => {
    logWorkAction('cylReplaceValveOpenCancelBtn', progressCurrentSide);
    cancelCylReplaceToPassword('cylReplaceValveOpen');
  });

  document.getElementById('cylReplaceAutoGuardOpenConfirmBtn').addEventListener('click', () => {
    logWorkAction('cylReplaceAutoGuardOpenConfirmBtn', progressCurrentSide);
    showProgressCylExchangePurgeStep(CYL_EXCHANGE_PURGE_STEPS.findIndex((s) => s.key === 'cylReplaceSwap'));
  });
  document.getElementById('cylReplaceAutoGuardOpenCancelBtn').addEventListener('click', () => {
    logWorkAction('cylReplaceAutoGuardOpenCancelBtn', progressCurrentSide);
    cancelCylReplaceToPassword('cylReplaceAutoGuardOpen');
  });

  document.getElementById('cylReplaceSwapZeroBtn').addEventListener('click', () => {
    logWorkAction('cylReplaceSwapZeroBtn', progressCurrentSide);
    toast('Load Cell Offset Zero Setting 기능은 아직 준비 중입니다.', '');
  });
  document.getElementById('cylReplaceSwapConfirmBtn').addEventListener('click', () => {
    logWorkAction('cylReplaceSwapConfirmBtn', progressCurrentSide);
    showProgressCylExchangePurgeStep(CYL_EXCHANGE_PURGE_STEPS.findIndex((s) => s.key === 'cylReplaceGasName'));
  });
  document.getElementById('cylReplaceSwapCancelBtn').addEventListener('click', () => {
    logWorkAction('cylReplaceSwapCancelBtn', progressCurrentSide);
    cancelCylReplaceToPassword('cylReplaceSwap');
  });

  // Gas name 확인 화면 - 제목의 측/번호(예: "A1")를 현재 측에 맞춰 보여준다.
  document.getElementById('cylReplaceGasNameLotSkipBtn').addEventListener('click', () => {
    logWorkAction('cylReplaceGasNameLotSkipBtn', progressCurrentSide);
    toast('Lot No. Skip 기능은 아직 준비 중입니다.', '');
  });
  document.getElementById('cylReplaceGasNameManualBtn').addEventListener('click', () => {
    logWorkAction('cylReplaceGasNameManualBtn', progressCurrentSide);
    toast('바코드 수동입력 기능은 아직 준비 중입니다.', '');
  });
  document.getElementById('cylReplaceGasNameCheckBtn').addEventListener('click', () => {
    logWorkAction('cylReplaceGasNameCheckBtn', progressCurrentSide);
    toast('바코드 확인 기능은 아직 준비 중입니다.', '');
  });
  document.getElementById('cylReplaceGasNameRunBtn').addEventListener('click', () => {
    logWorkAction('cylReplaceGasNameRunBtn', progressCurrentSide);
    showProgressCylExchangePurgeStep(CYL_EXCHANGE_PURGE_STEPS.findIndex((s) => s.key === 'cylReplaceAutoGuardClose'));
  });
  document.getElementById('cylReplaceGasNameCancelBtn').addEventListener('click', () => {
    logWorkAction('cylReplaceGasNameCancelBtn', progressCurrentSide);
    cancelCylReplaceToPassword('cylReplaceGasName');
  });

  // Auto Guard 확인(Close) - 용기교체 6단계 중 마지막. "확인"은 바로 넘어가지 않고
  // PASSWORD를 다시 확인한다(2차 배관청소 "실행"의 cylinderExchangeDone과 동일 패턴) -
  // 통과하면 "교환후" 자동 진행 첫 화면(3차 배관청소, Status "CC"→"3P")으로 넘어간다.
  document.getElementById('cylReplaceAutoGuardCloseConfirmBtn').addEventListener('click', () => {
    logWorkAction('cylReplaceAutoGuardCloseConfirmBtn', progressCurrentSide);
    proceedPastPasswordGate('cylReplaceDone', advanceCylReplaceDone);
  });
  document.getElementById('cylReplaceAutoGuardCloseCancelBtn').addEventListener('click', () => {
    logWorkAction('cylReplaceAutoGuardCloseCancelBtn', progressCurrentSide);
    cancelCylReplaceToPassword('cylReplaceAutoGuardClose');
  });

  // ── "교환후" 자동 진행 4단계 - 용기교체(CC) 완료 후 들어온다. 3차 배관청소(3P) → +L
  // 가압시험 → [VT 사용 옵션] → 4차 배관청소(4P)로, 교환전(1P→-L→[VT 옵션]→2P)과 대칭
  // 구조다. 사용자 확인(2026-08-09): 3P/4P는 교환전 2P(twoP)와, +L은 -L(exchangePressureTest)과
  // 완전히 동일한 서브시퀀스 엔진 화면(ns='afterThreeP'/'afterPlusL'/'afterFourP') - 이제
  // "확인"/"실행"/"취소"(stopBtnMode:'cancel')는 gms-sub-sequence-runner.js의 subSeqWireOnce가
  // 자동으로 연결한다(showProgressCylExchangePurgeStep의 exchangeThirdPurge/
  // exchangeAfterPressureTest/exchangeFourthPurge 분기에서 등록한 onFinish/onCancel 콜백 참고) -
  // 여기서는 엔진이 관여하지 않는 TREND 버튼(패널/idle 둘 다)만 개별로 연결한다. ──
  document.getElementById('exchangeThirdPurgeTrendBtn')?.addEventListener('click', () => {
    logWorkAction('exchangeThirdPurgeTrendBtn', progressCurrentSide);
    showGmsTrend();
  });
  document.getElementById('exchangeThirdPurgeIdleTrendBtn')?.addEventListener('click', () => {
    logWorkAction('exchangeThirdPurgeIdleTrendBtn', progressCurrentSide);
    showGmsTrend();
  });

  document.getElementById('exchangeAfterPressureTestTrendBtn')?.addEventListener('click', () => {
    logWorkAction('exchangeAfterPressureTestTrendBtn', progressCurrentSide);
    showGmsTrend();
  });
  document.getElementById('exchangeAfterPressureTestIdleTrendBtn')?.addEventListener('click', () => {
    logWorkAction('exchangeAfterPressureTestIdleTrendBtn', progressCurrentSide);
    showGmsTrend();
  });

  document.getElementById('exchangeAfterPulsTrendBtn')?.addEventListener('click', () => {
    logWorkAction('exchangeAfterPulsTrendBtn', progressCurrentSide);
    showGmsTrend();
  });
  document.getElementById('exchangeAfterPulsIdleTrendBtn')?.addEventListener('click', () => {
    logWorkAction('exchangeAfterPulsIdleTrendBtn', progressCurrentSide);
    showGmsTrend();
  });

  // 교환후-VT 감압시험 화면 - 이제 서브시퀀스 엔진 화면(교환전-VT와 동일 패턴)이라
  // "확인"/"실행"/"취소"(stopBtnMode:'cancel')는 subSeqWireOnce가 자동으로 연결한다
  // (showProgressCylExchangePurgeStep의 exchangeAfterVtTest 분기 참고) - 여기서는 TREND
  // 버튼(패널/idle 둘 다)만 개별로 연결한다.
  document.getElementById('exchangeAfterVtTestTrendBtn')?.addEventListener('click', () => {
    logWorkAction('exchangeAfterVtTestTrendBtn', progressCurrentSide);
    showGmsTrend();
  });
  document.getElementById('exchangeAfterVtTestIdleTrendBtn')?.addEventListener('click', () => {
    logWorkAction('exchangeAfterVtTestIdleTrendBtn', progressCurrentSide);
    showGmsTrend();
  });

  // 4차 배관청소 - "교환후" 자동 진행 중 마지막 배관청소 단계. 엔진 완료(Step 20) 시
  // PASSWORD(exchangeFourthPurgeDone) 재확인 후 다음 Status(기본값 "PC")로 넘어간다
  // (window.advanceExchangeFourthPurgeDone 참고).
  document.getElementById('exchangeFourthPurgeTrendBtn')?.addEventListener('click', () => {
    logWorkAction('exchangeFourthPurgeTrendBtn', progressCurrentSide);
    showGmsTrend();
  });
  document.getElementById('exchangeFourthPurgeIdleTrendBtn')?.addEventListener('click', () => {
    logWorkAction('exchangeFourthPurgeIdleTrendBtn', progressCurrentSide);
    showGmsTrend();
  });

  // HP&LP Pump 화면 TREND 및 취소 버튼
  document.getElementById('hpLpPumpTrendBtn')?.addEventListener('click', () => {
    logWorkAction('hpLpPumpTrendBtn', progressCurrentSide);
    showGmsTrend();
  });
  document.getElementById('hpLpPumpIdleTrendBtn')?.addEventListener('click', () => {
    logWorkAction('hpLpPumpIdleTrendBtn', progressCurrentSide);
    showGmsTrend();
  });
  document.getElementById('hpLpPumpIdleCancelBtn')?.addEventListener('click', () => {
    logWorkAction('hpLpPumpIdleCancelBtn', progressCurrentSide);
    cancelPostPcToPassword('hpLpPump');
  });
  document.getElementById('hpLpPumpCancelBtn')?.addEventListener('click', () => {
    logWorkAction('hpLpPumpCancelBtn', progressCurrentSide);
    cancelPostPcToPassword('hpLpPump');
  });

  // ── 퍼지완료(PC) 화면 - 교환후 자동 진행 중 현재 마지막. 실린더 교환이 끝났으니 메인
  // 메뉴와 같은 구성으로 다음 메뉴를 고르게 한다(가스공급/B 선택/유지 보수/TREND/보조
  // 메뉴). "B" 선택은 아직 실제 로직 없음(뼈대, 토스트만) - "보조 메뉴"는 openAuxMenu()로
  // 공용 팝업을 연다. "유지 보수"는
  // 메인 메뉴와 동일하게 PASSWORD 게이트(mainMenu)를 거쳐 유지보수 메뉴로 간다. "가스공급"
  // 은 PASSWORD 게이트(gasSupplyEntry)를 거쳐 다음 단계로 들어간다 - Main 시퀀스에 PC와
  // READY 사이에 적용된 단계(예: RGV)가 있으면 그 화면부터, 없으면 곧바로 가스공급 자동
  // 진행 7단계(0번)부터 시작한다(advanceToNextEnabledStatus가 판단). ──
  document.getElementById('exchangePurgeCompleteGasSupplyBtn').addEventListener('click', () => {
    logWorkAction('exchangePurgeCompleteGasSupplyBtn', progressCurrentSide);
    proceedPastPasswordGate('gasSupplyEntry', () => {
      // HPLP 서브시퀀스를 점프해서 GSP 1단계(공급 압력 확인)로 바로 이동
      showProgressGasSupplyStep(0);
    });
  });
  // "B"/"A" 선택 - 메인 메뉴처럼 단순히 반대 측 메인 메뉴를 보여주는 대신, 반대 측의
  // 실제 현재 Status에 해당하는 화면으로 조작화면을 전환한다(양쪽 진행 상태는 그대로 유지).
  document.getElementById('exchangePurgeCompleteSwitchSideBtn').addEventListener('click', () => {
    logWorkAction('exchangePurgeCompleteSwitchSideBtn', progressCurrentSide);
    showScreenForSideStatus(progressCurrentSide === 'A' ? 'B' : 'A');
  });
  document.getElementById('exchangePurgeCompleteMaintenanceBtn').addEventListener('click', () => {
    logWorkAction('exchangePurgeCompleteMaintenanceBtn', progressCurrentSide);
    proceedPastPasswordGate('mainMenu', showProgressMaintenanceMenu);
  });
  document.getElementById('exchangePurgeCompleteAuxBtn').addEventListener('click', () => {
    logWorkAction('exchangePurgeCompleteAuxBtn', progressCurrentSide);
    openAuxMenu();
  });
  // "취소"는 한 번 누르면 경고 토스트만 뜨고(2단 확인), 곧바로 다시 한 번 눌러야 실제로
  // Status를 IDLE(준비 전)로 되돌리고 메인 메뉴로 나간다 - 실수로 한 번 누른 것만으로
  // 전체 시퀀스가 초기화되지 않도록 하는 안전장치다. 화면을 벗어났다가 다시 들어오면
  // (showProgressCylExchangePurgeStep) 무장 상태를 초기화한다.
  document.getElementById('exchangePurgeCompleteCancelBtn').addEventListener('click', () => {
    logWorkAction('exchangePurgeCompleteCancelBtn', progressCurrentSide);
    if (!pcCancelArmed) {
      pcCancelArmed = true;
      toast('취소를 한번더 누르면 준비전으로 이동합니다.', 'err');
      return;
    }
    pcCancelArmed = false;
    resetCylinderStepStatus(progressCurrentSide);
    showProgressMainMenu(progressCurrentSide);
  });
  document.getElementById('exchangePurgeCompleteTrendBtn').addEventListener('click', () => {
    logWorkAction('exchangePurgeCompleteTrendBtn', progressCurrentSide);
    showGmsTrend();
  });

  // ── 가스공급 자동 진행 7단계(PC 이후 Zone3) - 각 화면의 "취소"는 PASSWORD를 다시
  // 통과해야 하고(cancelPostPcToPassword), 통과하면 진입 지점(PC/가스공급 화면)으로
  // 되돌아간다(advancePostPcCancelExit → cancelGasSupply). "확인"(또는 첫 화면의 "가스공급"
  // 버튼)은 다음 화면으로 이어진다. ──
  document.getElementById('gasSupplyPressureCheckRunBtn').addEventListener('click', () => {
    logWorkAction('gasSupplyPressureCheckRunBtn', progressCurrentSide);
    if (!checkGspStep1Interlock(progressCurrentSide || 'A')) return;
    showProgressGasSupplyStep(GAS_SUPPLY_STEPS.findIndex((s) => s.key === 'gasSupplyValveShutter'));
  });
  document.getElementById('gasSupplyPressureCheckAdjustModeBtn').addEventListener('click', () => {
    logWorkAction('gasSupplyPressureCheckAdjustModeBtn', progressCurrentSide);
    requestAdjustMode(progressCurrentSide);
  });
  document.getElementById('gasSupplyPressureCheckLineVentBtn').addEventListener('click', () => {
    logWorkAction('gasSupplyPressureCheckLineVentBtn', progressCurrentSide);
    manualValvePrevScreen = 'gasSupplyPressureCheck';
    proceedPastPasswordGate('lineVent', () => showProgressManualValve());
  });
  document.getElementById('gasSupplyPressureCheckCancelBtn').addEventListener('click', () => {
    logWorkAction('gasSupplyPressureCheckCancelBtn', progressCurrentSide);
    cancelPostPcToPassword('gasSupplyPressureCheck');
  });

  document.getElementById('gasSupplyValveShutterConfirmBtn').addEventListener('click', () => {
    logWorkAction('gasSupplyValveShutterConfirmBtn', progressCurrentSide);
    showProgressGasSupplyStep(GAS_SUPPLY_STEPS.findIndex((s) => s.key === 'gasSupplyRegulatorClose'));
  });
  document.getElementById('gasSupplyValveShutterCancelBtn').addEventListener('click', () => {
    logWorkAction('gasSupplyValveShutterCancelBtn', progressCurrentSide);
    cancelPostPcToPassword('gasSupplyValveShutter');
  });

  document.getElementById('gasSupplyRegulatorCloseConfirmBtn').addEventListener('click', () => {
    logWorkAction('gasSupplyRegulatorCloseConfirmBtn', progressCurrentSide);
    showProgressGasSupplyStep(GAS_SUPPLY_STEPS.findIndex((s) => s.key === 'gasSupplyCylinderOpen'));
  });
  document.getElementById('gasSupplyRegulatorCloseCancelBtn').addEventListener('click', () => {
    logWorkAction('gasSupplyRegulatorCloseCancelBtn', progressCurrentSide);
    cancelPostPcToPassword('gasSupplyRegulatorClose');
  });

  document.getElementById('gasSupplyCylinderOpenConfirmBtn').addEventListener('click', () => {
    logWorkAction('gasSupplyCylinderOpenConfirmBtn', progressCurrentSide);
    if (!checkGspStep4Interlock(progressCurrentSide || 'A')) return;
    showProgressGasSupplyStep(GAS_SUPPLY_STEPS.findIndex((s) => s.key === 'gasSupplyRegulatorAdjust'));
  });
  document.getElementById('gasSupplyCylinderOpenCancelBtn').addEventListener('click', () => {
    logWorkAction('gasSupplyCylinderOpenCancelBtn', progressCurrentSide);
    cancelPostPcToPassword('gasSupplyCylinderOpen');
  });

  document.getElementById('gasSupplyRegulatorAdjustConfirmBtn').addEventListener('click', () => {
    logWorkAction('gasSupplyRegulatorAdjustConfirmBtn', progressCurrentSide);
    if (!checkGspStep5Interlock(progressCurrentSide || 'A')) return;
    showProgressGasSupplyStep(GAS_SUPPLY_STEPS.findIndex((s) => s.key === 'gasSupplyFpvOpen'));
  });
  document.getElementById('gasSupplyRegulatorAdjustCancelBtn').addEventListener('click', () => {
    logWorkAction('gasSupplyRegulatorAdjustCancelBtn', progressCurrentSide);
    cancelPostPcToPassword('gasSupplyRegulatorAdjust');
  });

  const handleFpvConfirm = () => {
    logWorkAction('gasSupplyFpvOpenConfirmBtn', progressCurrentSide);
    showProgressGasSupplyStep(GAS_SUPPLY_STEPS.findIndex((s) => s.key === 'gasSupplyReady'));
  };
  const handleFpvCancel = () => {
    logWorkAction('gasSupplyFpvOpenCancelBtn', progressCurrentSide);
    cancelPostPcToPassword('gasSupplyFpvOpen');
  };
  const fpvConfirmBtn = document.getElementById('gasSupplyFpvOpenConfirmBtn');
  if (fpvConfirmBtn) fpvConfirmBtn.addEventListener('click', handleFpvConfirm);
  const pmvConfirmBtn = document.getElementById('gasSupplyPmvOpenConfirmBtn');
  if (pmvConfirmBtn) pmvConfirmBtn.addEventListener('click', handleFpvConfirm);
  const fpvCancelBtn = document.getElementById('gasSupplyFpvOpenCancelBtn');
  if (fpvCancelBtn) fpvCancelBtn.addEventListener('click', handleFpvCancel);
  const pmvCancelBtn = document.getElementById('gasSupplyPmvOpenCancelBtn');
  if (pmvCancelBtn) pmvCancelBtn.addEventListener('click', handleFpvCancel);

  // 가스공급준비 완료 - 마지막 화면. "확인"은 실제 가스공급이 시작된다는 뜻이라 가스공급
  // 중(Status "READY"→"Service") 화면으로 넘어간다 - 단, GC Type 옵션(gms.js)이 2B1P
  // (미적용, 포트 하나)이고 반대 측이 이미 가스공급 중이면 이 측은 진행하지 못하고
  // 조작화면이 반대 측 가스공급 화면으로 바뀐다(2B2P/적용이면 기존처럼 양측 모두
  // 독립적으로 가능).
  document.getElementById('gasSupplyReadyConfirmBtn').addEventListener('click', () => {
    logWorkAction('gasSupplyReadyConfirmBtn', progressCurrentSide);
    const side = progressCurrentSide || 'A';
    const otherSide = side === 'A' ? 'B' : 'A';

    // Valve 동작: FPV_? Open
    writeValveDirect(`FPV_${side}`, true);

    // 조건: 반대쪽 Status 상태가 Service(가스공급) 상태가 아니면 현재 측 가스공급 화면으로 이동,
    //       반대쪽이 가스공급화면이면 반대쪽 가스공급 화면으로 이동.
    const otherStatus = CYLINDER_STEP_ORDER[cylinderCurrentStepIndex[otherSide]];
    if (otherStatus === 'Service') {
      toast(`[${side}] 공급준비(READY) 완료. 반대쪽(${otherSide})에서 가스공급 중이므로 ${otherSide}측 가스공급 화면으로 이동합니다.`, 'ok');
      showProgressGasSupplyActive(otherSide);
      return;
    }

    toast(`[${side}] 가스공급이 시작되었습니다.`, 'ok');
    showProgressGasSupplyActive(side);
  });
  document.getElementById('gasSupplyReadyCancelBtn').addEventListener('click', () => {
    logWorkAction('gasSupplyReadyCancelBtn', progressCurrentSide);
    cancelPostPcToPassword('gasSupplyReady');
  });

  // ── 가스공급 중(Service) 화면 - "일시정지"/"공급중지"/"강제 교체"는 전부 PASSWORD →
  // 재확인 화면(실행/취소)을 거친다(requestGasSupplyAction). "강제 교체"는 이 측이
  // Service이고 반대 측이 READY(공급준비)일 때만 진행할 수 있다 - 아니면 PASSWORD도
  // 열지 않고 바로 안내 토스트만 띄운다. TREND는 아직 실제 로직 없음(뼈대, 토스트만).
  // "보조메뉴"는 openAuxMenu()로 공용 팝업을 연다. "B"/"A" 선택은 다른 화면들과 동일하게
  // 반대 측의 실제 현재 Status 화면으로
  // 전환한다(양쪽 진행 상태는 그대로 유지). ──
  document.getElementById('gasSupplyActivePauseBtn').addEventListener('click', () => {
    logWorkAction('gasSupplyActivePauseBtn', progressCurrentSide);
    requestGasSupplyAction('pause');
  });
  document.getElementById('gasSupplyActiveStopBtn').addEventListener('click', () => {
    logWorkAction('gasSupplyActiveStopBtn', progressCurrentSide);
    requestGasSupplyAction('stop');
  });
  document.getElementById('gasSupplyActiveSwitchSideBtn').addEventListener('click', () => {
    logWorkAction('gasSupplyActiveSwitchSideBtn', progressCurrentSide);
    showScreenForSideStatus(progressCurrentSide === 'A' ? 'B' : 'A');
  });
  document.getElementById('gasSupplyActiveForceChangeBtn').addEventListener('click', () => {
    logWorkAction('gasSupplyActiveForceChangeBtn', progressCurrentSide);
    const side = progressCurrentSide;
    const otherSide = side === 'A' ? 'B' : 'A';
    const sideStatus = CYLINDER_STEP_ORDER[cylinderCurrentStepIndex[side]];
    const otherStatus = CYLINDER_STEP_ORDER[cylinderCurrentStepIndex[otherSide]];
    if (sideStatus !== 'Service' || otherStatus !== 'READY') {
      toast('반대편가스공급준비상태 확인', 'err');
      return;
    }
    requestGasSupplyAction('forceChange');
  });
  document.getElementById('gasSupplyActiveAuxBtn').addEventListener('click', () => {
    logWorkAction('gasSupplyActiveAuxBtn', progressCurrentSide);
    openAuxMenu();
  });
  document.getElementById('gasSupplyActiveTrendBtn').addEventListener('click', () => {
    logWorkAction('gasSupplyActiveTrendBtn', progressCurrentSide);
    showGmsTrend();
  });

  // 가스공급 동작 재확인 화면 - "실행"은 대기 중인 동작(일시정지/공급중지/강제 교체)을
  // 실제로 수행하고, "취소"는 가스공급 중 화면으로 되돌아간다.
  document.getElementById('gasSupplyConfirmActionRunBtn').addEventListener('click', () => {
    logWorkAction('gasSupplyConfirmActionRunBtn', progressCurrentSide);
    const action = GAS_SUPPLY_ACTIONS[gasSupplyPendingAction];
    if (action) action.perform();
  });
  document.getElementById('gasSupplyConfirmActionCancelBtn').addEventListener('click', () => {
    logWorkAction('gasSupplyConfirmActionCancelBtn', progressCurrentSide);
    showProgressGasSupplyActive(progressCurrentSide);
  });

  // ── 조작화면 마지막 상태 복원 - 다른 페이지에 갔다 오거나 새로고침해도 진행 메뉴로
  // 초기화되지 않고 마지막 화면/측을 그대로 이어간다. ──
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(PROGRESS_STATE_KEY) || 'null'); } catch (e) { /* 무시 */ }
  if (saved) {
    const side = saved.side;
    if (saved.screen === 'mainMenu' && side) showProgressMainMenu(side);
    else if (saved.screen === 'maintenanceMenu' && side) { progressCurrentSide = side; showProgressMaintenanceMenu(); }
    else if (saved.screen === 'manualValve' && side) { progressCurrentSide = side; showProgressManualValve(); }
    else if (saved.screen === 'heater' && side) { progressCurrentSide = side; showProgressHeater(); }
    else if (saved.screen === 'maintenancePurge' && side) { progressCurrentSide = side; showProgressMaintenancePurge(); }
    else if (saved.screen === 'pipeClean' && side) { progressCurrentSide = side; showProgressPipeClean(); }
    else if (saved.screen === 'leakTest' && side) { progressCurrentSide = side; showProgressLeakTest(); }
    else if (saved.screen === 'vtTest' && side) { progressCurrentSide = side; showProgressVtTest(); }
    else if (saved.screen === 'ptTest' && side) { progressCurrentSide = side; showProgressPtTest(); }
    else if (saved.screen === 'pressureTest' && side) { progressCurrentSide = side; showProgressPressureTest(); }
    else if (saved.screen === 'barcodeCheck' && side) { progressCurrentSide = side; showProgressBarcodeCheck(); }
    else if (saved.screen === 'cylinderLockCheck' && side) { progressCurrentSide = side; showProgressCylinderLockCheck(); }
    else if (CYL_EXCHANGE_PURGE_STEPS.some((s) => s.key === saved.screen) && side) {
      progressCurrentSide = side;
      showProgressCylExchangePurgeStep(CYL_EXCHANGE_PURGE_STEPS.findIndex((s) => s.key === saved.screen));
    }
    else if (GAS_SUPPLY_STEPS.some((s) => s.key === saved.screen) && side) {
      progressCurrentSide = side;
      showProgressGasSupplyStep(GAS_SUPPLY_STEPS.findIndex((s) => s.key === saved.screen));
    }
    else if (saved.screen === 'gasSupplyActive' && side) showProgressGasSupplyActive(side);
    // 'gasSupplyConfirmAction'은 대기 중이던 동작(gasSupplyPendingAction)을 복원할 수
    // 없어 안전하게 가스공급 중 화면으로 되돌린다.
    else if (saved.screen === 'gasSupplyConfirmAction' && side) showProgressGasSupplyActive(side);
    // 'password' 화면은 입력 중이던 자릿수를 복원할 수 없어 안전하게 메인 메뉴로 되돌린다.
    else if (saved.screen === 'password' && side) showProgressMainMenu(side);
  }

  // 교환전 화면 전체의 -VT 배지(.step-badge-lg[data-vt-badge])를 VT 사용 옵션에 맞춰
  // 보이거나 숨긴다 - 방금 fetch로 주입된 배지들이라 여기서 처음 호출해야 반영된다.
  applyVtBadgeVisibility();

  // CYLINDER STEP STATUS/우측 상태 텍스트/실린더 잠금 check 큰 배지를 현재 스텝 기준으로
  // 최초 렌더 - 실린더 잠금 check.html이 방금 fetch로 주입되었으므로 여기서 호출해야
  // 큰 배지(.step-badge-lg)도 함께 반영된다.
  applyCylinderStepStatus('A');
  applyCylinderStepStatus('B');

  // ── CYLINDER STEP STATUS 배지 클릭 → Status Jump - 실행을 여러 번 눌러 단계를 하나씩
  // 밟지 않고, 원하는 Status의 첫 화면으로 조작화면을 바로 이동시킨다(Status Jump 옵션이
  // 적용이면 PASSWORD 확인 후, 미적용이면 즉시 - requestStatusJump 참고). "-VT"가 두 번
  // 나오므로 배지 텍스트가 아니라 DOM 안에서의 위치(인덱스)로 어느 -VT인지 구분한다. ──
  ['A', 'B'].forEach((side) => {
    const row = document.getElementById(side === 'B' ? 'cylStepBadgesB' : 'cylStepBadgesA');
    if (!row) return;
    [...row.children].forEach((badge, idx) => {
      badge.style.cursor = 'pointer';
      badge.title = 'Status Jump';
      badge.addEventListener('click', () => requestStatusJump(side, idx));
    });
  });
}
loadOperationScreens().then(() => {
  wireOperationScreens();
  window.operationScreensLoaded = true;
});
