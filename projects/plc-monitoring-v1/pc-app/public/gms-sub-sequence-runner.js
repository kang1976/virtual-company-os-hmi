'use strict';

/**
 * 서브시퀀스(Sub Sequence) 실행 엔진 - Main Step 하나(예: 조정모드, 실린더교환 Puls 구간) 안의
 * 상세 Step을 data/gmsSubSequences/<id>.json 순서대로 자동/Ack 진행시킨다. mainStepType(예:
 * "AdjustMode"/"Puls")이 어떤 서브시퀀스 id를 쓸지는 data/gmsSubSequenceSelection.json 매핑을
 * 그대로 따른다. gms.html에서 반드시 gms.js/Operation.js 다음에 로드해야 한다(toast,
 * progressCurrentSide, selectedUnitId, currentGmsOperator, lastPtByTag, progressHeader를
 * 그대로 가져다 쓴다 - gms-pt-calibration.js와 동일한 패턴).
 *
 * 밸브 태그의 "{side}"는 실행 시 진행 중인 측(A/B)으로 치환한다. 각 Step의 valves는 그
 * Step에서 바뀌는 밸브만 담고 있고(O/C), 적히지 않은 밸브는 이전 상태를 그대로 유지한다
 * (실제 엔지니어링 문서의 O/C 표기 방식과 동일 - 실행 엔진도 누적 상태를 따로 들고 있다가
 * 매 Step마다 바뀐 것만 서버에 씀).
 *
 * 이 엔진은 화면 하나(조정모드)만 쓰던 걸 여러 화면(실린더교환 Puls 구간 등)이 동시에 안전하게
 * 쓸 수 있도록 "네임스페이스"로 상태/DOM id를 분리한다(SUBSEQ_NS 참고) - 조정모드를 실행
 * 중인데 다른 화면에서 Puls 구간을 시작해도(또는 반대 순서로도) 서로의 진행 상태가 덮어써지지
 * 않는다. 조정모드(ns='adjustMode')는 기존 DOM id를 그대로 쓰므로 HTML 변경이 필요 없다.
 */

// 네임스페이스별 DOM id/설정 - 새 "자동진행" 화면을 추가할 때 이 표에 한 항목만 추가하면
// 엔진 로직은 전혀 손대지 않아도 된다(id 문자열만 그 화면의 실제 마크업과 맞으면 됨).
const SUBSEQ_NS = {
  adjustMode: {
    mainStepType: 'AdjustMode', screenKey: 'adjustMode',
    idle: 'adjustModeSeqIdle', panel: 'adjustModeSeqPanel', stepLabel: 'subSeqStepLabel',
    operation: 'subSeqOperation', message: 'subSeqMessage', valveDiff: 'subSeqValveDiff',
    timer: 'subSeqTimer', accTime: 'subSeqAccTime',
    cycleInfo: 'subSeqCycleInfo', cycleTarget: 'subSeqCycleTarget', cycleCurrent: 'subSeqCycleCurrent',
    ackBtn: 'subSeqAckBtn', stopBtn: 'subSeqStopBtn', stopBtnMode: 'idle', finishStopLabel: 'PT 영점조정 완료',
    alarmTestBtn: 'subSeqAlarmTestBtn', alarmTestSelect: 'subSeqAlarmTestSelect',
    exportBtn: 'subSeqExcelExportBtn', importBtn: 'subSeqExcelImportBtn', fileInput: 'subSeqExcelFileInput',
    // idle에 알람 메시지가 남아있게(사용자 요청 - "조정모드 알람도 함께 체크") - 조정모드는
    // idle에 이미 "실행" 버튼이 있으므로(원래 구조) puls/oneP처럼 배너/버튼 전환은 필요
    // 없고, 알람 메시지 표시줄만 추가하면 된다.
    lastAlarm: 'subSeqLastAlarm',
  },
  // "실린더 잠금 check" 화면(교환전1P_실린더 잠금 check.html) - 실린더교환.xlsx "3차 수정본"
  // 시트 4~10번(실린더 확인~확인, 7단계). 사용자 확인(실사 HMI 참고 자료) 결과 이 7단계는
  // Status가 "Puls"가 아니라 "IDLE"인 채로 진행된다(그래서 이름이 puls가 아니라 idleCheck) -
  // 7단계 완료 후에야 Status가 Puls로 넘어간다(아래 puls 네임스페이스, 별도 2단계 화면).
  // idle 상태 취소 버튼(cylinderLockCancelBtn)과 패널(진행 중) 취소 버튼(pulsCancelBtn)을
  // 분리한 이유: idle 상태의 취소는 Operation.js가 직접 처리한다(엔진이 시작되기 전이라
  // 콜백이 아직 등록되지 않았을 수 있음).
  idleCheck: {
    mainStepType: 'IdleCheck', screenKey: 'cylinderLockCheck',
    idle: 'cylinderLockIdle', panel: 'cylinderLockPanel', stepLabel: 'pulsStepLabel',
    operation: 'pulsOperation', message: 'pulsMessage', valveDiff: 'pulsValveDiff',
    timer: 'pulsTimer', accTime: 'pulsAccTime',
    cycleInfo: 'pulsCycleInfo', cycleTarget: 'pulsCycleTarget', cycleCurrent: 'pulsCycleCurrent',
    ackBtn: 'pulsAckBtn', stopBtn: 'pulsCancelBtn', stopBtnMode: 'cancel', finishStopLabel: null,
    alarmTestBtn: null, alarmTestSelect: null,
    exportBtn: 'pulsExcelExportBtn', importBtn: 'pulsExcelImportBtn', fileInput: 'pulsExcelFileInput',
  },
  // "Puls_자동진행" 화면(OPERATION HTML/Puls_자동진행.html) - Status "Puls" 실제 구간
  // (잔류가스 Check, Pulse Vent 2단계). idleCheck(7단계) 완료 직후 자동으로 시작된다
  // (화면에 idle 대기 상태 없이 곧장 실행 - Operation.js의 showProgressCylExchangePurgeStep
  // 특수 분기 참고). 큰 배지(step-badges-lg)는 이 구간 동안 어느 것도 점멸하지 않는다.
  puls: {
    mainStepType: 'Puls', screenKey: 'pulsAutoRun',
    idle: 'pulsRunIdle', panel: 'pulsRunPanel', stepLabel: 'pulsRunStepLabel',
    operation: 'pulsRunOperation', message: 'pulsRunMessage', valveDiff: 'pulsRunValveDiff',
    timer: 'pulsRunTimer', accTime: 'pulsRunAccTime',
    cycleInfo: 'pulsRunCycleInfo', cycleTarget: 'pulsRunCycleTarget', cycleCurrent: 'pulsRunCycleCurrent',
    ackBtn: 'pulsRunAckBtn', stopBtn: 'pulsRunCancelBtn', stopBtnMode: 'cancel', finishStopLabel: null,
    alarmTestBtn: null, alarmTestSelect: null,
    exportBtn: 'pulsRunExcelExportBtn', importBtn: 'pulsRunExcelImportBtn', fileInput: 'pulsRunExcelFileInput',
    // 알람(Alarm Seq. 1/3)으로 초기화되면 idle로 돌아가는데, 예전엔 "Puls 구간을 준비하는
    // 중입니다..."만 뜨고 재시작할 방법이 없었다(사용자 지적 - 알람 메시지도 사라지고 화면이
    // 막힘). idle에 "실행" 버튼과 마지막 알람 메시지 표시줄을 추가해 조정모드 idle과
    // 동일하게(재실행 가능) 맞춘다.
    executeBtn: 'pulsRunExecuteBtn', lastAlarm: 'pulsRunLastAlarm',
    // idle 화면에 알람 발생 시점의 설정/진행 횟수를 그대로 남겨두는 표시(사용자 요청 -
    // "진행횟수 유지하고 알람 메시지만 띄우면 됩니다") - 라이브 갱신되는 pulsRunCycleInfo와
    // 별개로, subSeqHandleAlarm이 알람 순간의 값을 이쪽에 복사해 넣고 그대로 고정해 둔다.
    idleCycleInfo: 'pulsRunIdleCycleInfo', idleCycleTarget: 'pulsRunIdleCycleTarget', idleCycleCurrent: 'pulsRunIdleCycleCurrent',
    // idle 화면 버튼 배치를 조정모드 idle(실행/취소/압력조정 + 엑셀 내보내기/불러오기 2줄)과
    // 통일한다(사용자 요청 - "실행 key 하나만 있음, 첫번째 아래 버튼처럼 배치"). 취소는
    // 아직 실행 전이라 정지할 대상이 없으므로 등록된 onCancel 콜백만 그대로 호출한다.
    idleCancelBtn: 'pulsRunIdleCancelBtn',
    idleExportBtn: 'pulsRunIdleExcelExportBtn', idleImportBtn: 'pulsRunIdleExcelImportBtn', idleFileInput: 'pulsRunIdleExcelFileInput',
    // 알람이 나도 화면(idle) 전환 없이 지금 패널을 그대로 두고 이 배너(메시지만)를 띄운다
    // (사용자 요청 - "화면 변경없이 기존 화면에 알람 메세지만 추가로"). 별도 확인 버튼은
    // 없고, 알람 중엔 하단 stopBtn("취소")이 "실행"으로 바뀌어 재시작을 담당한다(사용자
    // 요청 - "확인 key를 삭제하시고, 하단 버튼에 취소를 실행으로 변경").
    panelAlarmBanner: 'pulsRunAlarmBanner', panelAlarmMsg: 'pulsRunPanelAlarmMsg',
    // 테스트용 일시정지 - Step 카운트다운/누적시간을 그 자리에서 멈춰 밸브·PT 상태를 붙잡아
    // 두고 살펴볼 수 있게 한다(사용자 요청 - "각 HTML마다 일시정지를 추가"). pauseBtn id가
    // 없는 네임스페이스(조정모드/idleCheck)는 subSeqTogglePause가 조용히 무시한다.
    pauseBtn: 'pulsRunPauseBtn',
    // 테스트 기간 전용 - Step 1로 즉시 되돌아가 새로 시작한다(사용자 요청 - "일시정지
    // 버튼 옆에 test 기간동안만 서브시퀀스 초기화해서 처음부터 진행할 수 있는 버튼").
    resetBtn: 'pulsRunResetBtn',
  },
  // "1P_자동진행" 화면(OPERATION HTML/1P_자동진행.html) - Status "1P" 4개 서브시퀀스 중
  // 1번째(1-2차측 Vent Mode). Puls(2단계) 완료 직후 자동으로 시작되고, 완료되면 자동으로
  // onePPurge(2차측 Purge)로 넘어간다. 이 구간 동안은 큰 배지 "1P"가 점멸한다(gms.html의
  // .step-badges-lg 마크업, applyCylinderStepStatus).
  oneP: {
    mainStepType: 'OneP', screenKey: 'onePAutoRun',
    idle: 'onePIdle', panel: 'onePPanel', stepLabel: 'onePStepLabel',
    operation: 'onePOperation', message: 'onePMessage', valveDiff: 'onePValveDiff',
    timer: 'onePTimer', accTime: 'onePAccTime',
    cycleInfo: 'onePCycleInfo', cycleTarget: 'onePCycleTarget', cycleCurrent: 'onePCycleCurrent',
    ackBtn: 'onePAckBtn', stopBtn: 'onePCancelBtn', stopBtnMode: 'cancel', finishStopLabel: null,
    alarmTestBtn: null, alarmTestSelect: null,
    exportBtn: 'onePExcelExportBtn', importBtn: 'onePExcelImportBtn', fileInput: 'onePExcelFileInput',
    executeBtn: 'onePExecuteBtn', lastAlarm: 'onePLastAlarm',
    idleCycleInfo: 'onePIdleCycleInfo', idleCycleTarget: 'onePIdleCycleTarget', idleCycleCurrent: 'onePIdleCycleCurrent',
    idleCancelBtn: 'onePIdleCancelBtn',
    idleExportBtn: 'onePIdleExcelExportBtn', idleImportBtn: 'onePIdleExcelImportBtn', idleFileInput: 'onePIdleExcelFileInput',
    panelAlarmBanner: 'onePAlarmBanner', panelAlarmMsg: 'onePPanelAlarmMsg',
    pauseBtn: 'onePPauseBtn',
    resetBtn: 'onePResetBtn',
  },
  // "1P_2차측Purge_자동진행" 화면 - Status "1P" 4개 서브시퀀스 중 2번째(2차측 Purge).
  // oneP(1-2차측 Vent Mode) 완료 직후 자동 시작, 완료되면 onePPumping으로 자동 진행.
  onePPurge: {
    mainStepType: 'OneP2', screenKey: 'onePPurgeAutoRun',
    idle: 'onePPurgeIdle', panel: 'onePPurgePanel', stepLabel: 'onePPurgeStepLabel',
    operation: 'onePPurgeOperation', message: 'onePPurgeMessage', valveDiff: 'onePPurgeValveDiff',
    timer: 'onePPurgeTimer', accTime: 'onePPurgeAccTime',
    cycleInfo: 'onePPurgeCycleInfo', cycleTarget: 'onePPurgeCycleTarget', cycleCurrent: 'onePPurgeCycleCurrent',
    ackBtn: 'onePPurgeAckBtn', stopBtn: 'onePPurgeCancelBtn', stopBtnMode: 'cancel', finishStopLabel: null,
    alarmTestBtn: null, alarmTestSelect: null,
    exportBtn: 'onePPurgeExcelExportBtn', importBtn: 'onePPurgeExcelImportBtn', fileInput: 'onePPurgeExcelFileInput',
    executeBtn: 'onePPurgeExecuteBtn', lastAlarm: 'onePPurgeLastAlarm',
    idleCycleInfo: 'onePPurgeIdleCycleInfo', idleCycleTarget: 'onePPurgeIdleCycleTarget', idleCycleCurrent: 'onePPurgeIdleCycleCurrent',
    idleCancelBtn: 'onePPurgeIdleCancelBtn',
    idleExportBtn: 'onePPurgeIdleExcelExportBtn', idleImportBtn: 'onePPurgeIdleExcelImportBtn', idleFileInput: 'onePPurgeIdleExcelFileInput',
    panelAlarmBanner: 'onePPurgeAlarmBanner', panelAlarmMsg: 'onePPurgePanelAlarmMsg',
    pauseBtn: 'onePPurgePauseBtn',
    resetBtn: 'onePPurgeResetBtn',
  },
  // "1P_Pumping_자동진행" 화면 - Status "1P" 4개 서브시퀀스 중 3번째(Pumping). onePPurge
  // 완료 직후 자동 시작, 완료되면 onePPrimaryPurge로 자동 진행.
  onePPumping: {
    mainStepType: 'OneP3', screenKey: 'onePPumpingAutoRun',
    idle: 'onePPumpingIdle', panel: 'onePPumpingPanel', stepLabel: 'onePPumpingStepLabel',
    operation: 'onePPumpingOperation', message: 'onePPumpingMessage', valveDiff: 'onePPumpingValveDiff',
    timer: 'onePPumpingTimer', accTime: 'onePPumpingAccTime',
    cycleInfo: 'onePPumpingCycleInfo', cycleTarget: 'onePPumpingCycleTarget', cycleCurrent: 'onePPumpingCycleCurrent',
    ackBtn: 'onePPumpingAckBtn', stopBtn: 'onePPumpingCancelBtn', stopBtnMode: 'cancel', finishStopLabel: null,
    alarmTestBtn: null, alarmTestSelect: null,
    exportBtn: 'onePPumpingExcelExportBtn', importBtn: 'onePPumpingExcelImportBtn', fileInput: 'onePPumpingExcelFileInput',
    executeBtn: 'onePPumpingExecuteBtn', lastAlarm: 'onePPumpingLastAlarm',
    idleCycleInfo: 'onePPumpingIdleCycleInfo', idleCycleTarget: 'onePPumpingIdleCycleTarget', idleCycleCurrent: 'onePPumpingIdleCycleCurrent',
    idleCancelBtn: 'onePPumpingIdleCancelBtn',
    idleExportBtn: 'onePPumpingIdleExcelExportBtn', idleImportBtn: 'onePPumpingIdleExcelImportBtn', idleFileInput: 'onePPumpingIdleExcelFileInput',
    panelAlarmBanner: 'onePPumpingAlarmBanner', panelAlarmMsg: 'onePPumpingPanelAlarmMsg',
    pauseBtn: 'onePPumpingPauseBtn',
    // Pumping 전용 - Step 7의 Cycle 열 "CAPTURE:<태그>" 지시를 만나면 그 Step에 최초로
    // 도달했을 때 태그의 현재값을 '초기값'에 한 번만 저장하고, '현재값'은 PT가 새로
    // 들어올 때마다(gms.js의 applyGmsPts → subSeqRefreshLiveCaptures) 계속 갱신한다.
    // captureInitial/captureCurrent id가 없는 네임스페이스는 subSeqApplyCapture가
    // 조용히 건너뛴다(사용자 요청 - "초기값,현재값,설정시간,진행시간" 4개 값 표시는
    // Pumping 화면만 필요).
    captureInitial: 'onePPumpingCaptureInitial', captureCurrent: 'onePPumpingCaptureCurrent',
    // "진행 횟수"(Step 7의 진행횟수 반복 카운트)를 "N분 SS초"로 표시한다(사용자 요청 -
    // "진행시간은 분과 초가 함께 나왔으면"). 이 플래그가 없는 다른 네임스페이스(Puls,
    // 2차측 Purge 등)는 지금처럼 정수 횟수로만 표시된다.
    cycleCurrentAsTime: true,
    resetBtn: 'onePPumpingResetBtn',
  },
  // "1P_1차측Purge_자동진행" 화면 - Status "1P" 4개 서브시퀀스 중 마지막(4번째, 1차측
  // Purge). onePPumping 완료 직후 자동 시작, 완료되면 1P 구간 전체가 끝나 Status가
  // -L(감압시험)로 넘어간다(Operation.js의 showProgressCylExchangePurgeStep onFinish).
  onePPrimaryPurge: {
    mainStepType: 'OneP4', screenKey: 'onePPrimaryPurgeAutoRun',
    idle: 'onePPrimaryPurgeIdle', panel: 'onePPrimaryPurgePanel', stepLabel: 'onePPrimaryPurgeStepLabel',
    operation: 'onePPrimaryPurgeOperation', message: 'onePPrimaryPurgeMessage', valveDiff: 'onePPrimaryPurgeValveDiff',
    timer: 'onePPrimaryPurgeTimer', accTime: 'onePPrimaryPurgeAccTime',
    cycleInfo: 'onePPrimaryPurgeCycleInfo', cycleTarget: 'onePPrimaryPurgeCycleTarget', cycleCurrent: 'onePPrimaryPurgeCycleCurrent',
    ackBtn: 'onePPrimaryPurgeAckBtn', stopBtn: 'onePPrimaryPurgeCancelBtn', stopBtnMode: 'cancel', finishStopLabel: null,
    alarmTestBtn: null, alarmTestSelect: null,
    exportBtn: 'onePPrimaryPurgeExcelExportBtn', importBtn: 'onePPrimaryPurgeExcelImportBtn', fileInput: 'onePPrimaryPurgeExcelFileInput',
    executeBtn: 'onePPrimaryPurgeExecuteBtn', lastAlarm: 'onePPrimaryPurgeLastAlarm',
    idleCycleInfo: 'onePPrimaryPurgeIdleCycleInfo', idleCycleTarget: 'onePPrimaryPurgeIdleCycleTarget', idleCycleCurrent: 'onePPrimaryPurgeIdleCycleCurrent',
    idleCancelBtn: 'onePPrimaryPurgeIdleCancelBtn',
    idleExportBtn: 'onePPrimaryPurgeIdleExcelExportBtn', idleImportBtn: 'onePPrimaryPurgeIdleExcelImportBtn', idleFileInput: 'onePPrimaryPurgeIdleExcelFileInput',
    panelAlarmBanner: 'onePPrimaryPurgeAlarmBanner', panelAlarmMsg: 'onePPrimaryPurgePanelAlarmMsg',
    pauseBtn: 'onePPrimaryPurgePauseBtn',
    resetBtn: 'onePPrimaryPurgeResetBtn',
  },
  // "교환전-L_감압시험" 화면(OPERATION HTML/교환전-L_감압시험.html) - Status "-L"(감압시험).
  // 1P 구간(onePPrimaryPurge) 완료 직후 자동으로 시작된다(Operation.js의
  // showProgressCylExchangePurgeStep 특수 분기). Pumping과 완전히 동일한 패턴(값 캡처 +
  // 분 단위 진행시간 + 초 단위 실시간 표시) - 자세한 재사용 방법은
  // data/gmsSubSequences/ExchL_v1.json의 Step Remarks 참고. 완료되면 advanceToNextEnabledStatus로
  // 다음 Status(VT 사용 옵션에 따라 -VT 또는 2P)로 넘어간다.
  exchangePressureTest: {
    mainStepType: 'ExchL', screenKey: 'exchangePressureTest',
    idle: 'exchangePressureTestIdle', panel: 'exchangePressureTestPanel', stepLabel: 'exchangePressureTestStepLabel',
    operation: 'exchangePressureTestOperation', message: 'exchangePressureTestMessage', valveDiff: 'exchangePressureTestValveDiff',
    timer: 'exchangePressureTestTimer', accTime: 'exchangePressureTestAccTime',
    cycleInfo: 'exchangePressureTestCycleInfo', cycleTarget: 'exchangePressureTestCycleTarget', cycleCurrent: 'exchangePressureTestCycleCurrent',
    ackBtn: 'exchangePressureTestAckBtn', stopBtn: 'exchangePressureTestCancelBtn', stopBtnMode: 'cancel', finishStopLabel: null,
    alarmTestBtn: null, alarmTestSelect: null,
    exportBtn: 'exchangePressureTestExcelExportBtn', importBtn: 'exchangePressureTestExcelImportBtn', fileInput: 'exchangePressureTestExcelFileInput',
    executeBtn: 'exchangePressureTestExecuteBtn', lastAlarm: 'exchangePressureTestLastAlarm',
    idleCycleInfo: 'exchangePressureTestIdleCycleInfo', idleCycleTarget: 'exchangePressureTestIdleCycleTarget', idleCycleCurrent: 'exchangePressureTestIdleCycleCurrent',
    idleCancelBtn: 'exchangePressureTestIdleCancelBtn',
    idleExportBtn: 'exchangePressureTestIdleExcelExportBtn', idleImportBtn: 'exchangePressureTestIdleExcelImportBtn', idleFileInput: 'exchangePressureTestIdleExcelFileInput',
    panelAlarmBanner: 'exchangePressureTestAlarmBanner', panelAlarmMsg: 'exchangePressureTestPanelAlarmMsg',
    pauseBtn: 'exchangePressureTestPauseBtn',
    captureInitial: 'exchangePressureTestCaptureInitial', captureCurrent: 'exchangePressureTestCaptureCurrent',
    captureLimit: 'exchangePressureTestCaptureLimit',
    cycleCurrentAsTime: true,
    resetBtn: 'exchangePressureTestResetBtn',
  },
  // "교환전2P_2차 배관청소" 화면 - Status "2P". -L(또는 -VT) 감압시험 완료 직후 자동으로
  // 시작된다(Operation.js의 showProgressCylExchangePurgeStep 특수 분기). 1P 구간의
  // 1차측 Purge(onePPrimaryPurge, OneP4_v1)와 완전히 동일한 구조(배관진공 확인 → N2 Purge →
  // 예약어 '진행횟수' 반복) - 다만 반복 종료 조건 CONFIG만 "교환전 2차 퍼지진행 횟수"로
  // 다르다(data/gmsSubSequences/TwoP_v1.json 참고). 완료되면 PASSWORD("실린더 교체") 확인
  // 후 다음 Status(CC, 용기교체)로 넘어간다(기존 exchangeSecondPurgeRunBtn과 동일한 정책 -
  // showProgressCylExchangePurgeStep의 exchangeSecondPurge 분기 참고).
  twoP: {
    mainStepType: 'TwoP', screenKey: 'exchangeSecondPurge',
    idle: 'exchangeSecondPurgeIdle', panel: 'exchangeSecondPurgePanel', stepLabel: 'exchangeSecondPurgeStepLabel',
    operation: 'exchangeSecondPurgeOperation', message: 'exchangeSecondPurgeMessage', valveDiff: 'exchangeSecondPurgeValveDiff',
    timer: 'exchangeSecondPurgeTimer', accTime: 'exchangeSecondPurgeAccTime',
    cycleInfo: 'exchangeSecondPurgeCycleInfo', cycleTarget: 'exchangeSecondPurgeCycleTarget', cycleCurrent: 'exchangeSecondPurgeCycleCurrent',
    ackBtn: 'exchangeSecondPurgeAckBtn', stopBtn: 'exchangeSecondPurgeCancelBtn', stopBtnMode: 'cancel', finishStopLabel: null,
    alarmTestBtn: null, alarmTestSelect: null,
    exportBtn: 'exchangeSecondPurgeExcelExportBtn', importBtn: 'exchangeSecondPurgeExcelImportBtn', fileInput: 'exchangeSecondPurgeExcelFileInput',
    executeBtn: 'exchangeSecondPurgeExecuteBtn', lastAlarm: 'exchangeSecondPurgeLastAlarm',
    idleCycleInfo: 'exchangeSecondPurgeIdleCycleInfo', idleCycleTarget: 'exchangeSecondPurgeIdleCycleTarget', idleCycleCurrent: 'exchangeSecondPurgeIdleCycleCurrent',
    idleCancelBtn: 'exchangeSecondPurgeIdleCancelBtn',
    idleExportBtn: 'exchangeSecondPurgeIdleExcelExportBtn', idleImportBtn: 'exchangeSecondPurgeIdleExcelImportBtn', idleFileInput: 'exchangeSecondPurgeIdleExcelFileInput',
    panelAlarmBanner: 'exchangeSecondPurgeAlarmBanner', panelAlarmMsg: 'exchangeSecondPurgePanelAlarmMsg',
    pauseBtn: 'exchangeSecondPurgePauseBtn',
    resetBtn: 'exchangeSecondPurgeResetBtn',
  },
  // "교환전-VT_VT 감압시험" 화면 - Status "-VT"(VT 사용 옵션 적용일 때만 -L/2P 사이에 들어옴).
  // data/gmsSubSequences/VtTest_v1.json: 1)VT Process Pumping(단순 시간대기) 2)VT 1/2차측
  // Pumping+진공상한 체크(실 알람) 3)VT 점검(누출시험 - 초기값 캡처 후 CAPOFFSET로 허용범위
  // 이내인지 실 알람 판정). "초기값/현재값"은 3단계(VT 점검)에서만 채워진다(그 전엔 "-").
  // "설정 값"은 지금 감시 중인 Step의 비교 대상 CONFIG 값을 그대로 보여준다(2단계엔 진공
  // 상한, 3단계엔 초기값+누출허용범위 - subSeqSetSettingValue 참고).
  vtTest: {
    mainStepType: 'VtTest', screenKey: 'exchangeVtTest',
    idle: 'exchangeVtTestIdle', panel: 'exchangeVtTestPanel', stepLabel: 'exchangeVtTestStepLabel',
    operation: 'exchangeVtTestOperation', message: 'exchangeVtTestMessage', valveDiff: 'exchangeVtTestValveDiff',
    timer: 'exchangeVtTestTimer', accTime: 'exchangeVtTestAccTime',
    cycleInfo: 'exchangeVtTestCycleInfo', cycleTarget: 'exchangeVtTestCycleTarget', cycleCurrent: 'exchangeVtTestCycleCurrent',
    ackBtn: 'exchangeVtTestAckBtn', stopBtn: 'exchangeVtTestCancelBtn', stopBtnMode: 'cancel', finishStopLabel: null,
    alarmTestBtn: null, alarmTestSelect: null,
    exportBtn: 'exchangeVtTestExcelExportBtn', importBtn: 'exchangeVtTestExcelImportBtn', fileInput: 'exchangeVtTestExcelFileInput',
    executeBtn: 'exchangeVtTestExecuteBtn', lastAlarm: 'exchangeVtTestLastAlarm',
    idleCycleInfo: 'exchangeVtTestIdleCycleInfo', idleCycleTarget: 'exchangeVtTestIdleCycleTarget', idleCycleCurrent: 'exchangeVtTestIdleCycleCurrent',
    idleCancelBtn: 'exchangeVtTestIdleCancelBtn',
    idleExportBtn: 'exchangeVtTestIdleExcelExportBtn', idleImportBtn: 'exchangeVtTestIdleExcelImportBtn', idleFileInput: 'exchangeVtTestIdleExcelFileInput',
    panelAlarmBanner: 'exchangeVtTestAlarmBanner', panelAlarmMsg: 'exchangeVtTestPanelAlarmMsg',
    pauseBtn: 'exchangeVtTestPauseBtn',
    resetBtn: 'exchangeVtTestResetBtn',
    captureInitial: 'exchangeVtTestInitialValue', captureCurrent: 'exchangeVtTestCurrentValue',
    // VT(고진공) 값은 Torr 단위로 소수점 3자리까지 봐야 한다(기존 "PT/Weight 자릿수 통일" 규칙 -
    // VT류는 3자리, 그 외는 2자리) - 실제 HMI 참고 사진의 "0.000" 표시와 동일하게 맞춘다.
    captureDecimals: 3,
    settingValue: 'exchangeVtTestSetValue',
  },
  // "교환후-VT_VT감압시험" 화면 - vtTest와 완전히 동일한 로직(data/gmsSubSequences/AfterVtTest_v1.json,
  // VtTest_v1.json과 내용 동일) - VT 사용 옵션 적용일 때만 교환후 +L/4P 사이에 들어온다.
  afterVtTest: {
    mainStepType: 'AfterVtTest', screenKey: 'exchangeAfterVtTest',
    idle: 'exchangeAfterVtTestIdle', panel: 'exchangeAfterVtTestPanel', stepLabel: 'exchangeAfterVtTestStepLabel',
    operation: 'exchangeAfterVtTestOperation', message: 'exchangeAfterVtTestMessage', valveDiff: 'exchangeAfterVtTestValveDiff',
    timer: 'exchangeAfterVtTestTimer', accTime: 'exchangeAfterVtTestAccTime',
    cycleInfo: 'exchangeAfterVtTestCycleInfo', cycleTarget: 'exchangeAfterVtTestCycleTarget', cycleCurrent: 'exchangeAfterVtTestCycleCurrent',
    ackBtn: 'exchangeAfterVtTestAckBtn', stopBtn: 'exchangeAfterVtTestCancelBtn', stopBtnMode: 'cancel', finishStopLabel: null,
    alarmTestBtn: null, alarmTestSelect: null,
    exportBtn: 'exchangeAfterVtTestExcelExportBtn', importBtn: 'exchangeAfterVtTestExcelImportBtn', fileInput: 'exchangeAfterVtTestExcelFileInput',
    executeBtn: 'exchangeAfterVtTestExecuteBtn', lastAlarm: 'exchangeAfterVtTestLastAlarm',
    idleCycleInfo: 'exchangeAfterVtTestIdleCycleInfo', idleCycleTarget: 'exchangeAfterVtTestIdleCycleTarget', idleCycleCurrent: 'exchangeAfterVtTestIdleCycleCurrent',
    idleCancelBtn: 'exchangeAfterVtTestIdleCancelBtn',
    idleExportBtn: 'exchangeAfterVtTestIdleExcelExportBtn', idleImportBtn: 'exchangeAfterVtTestIdleExcelImportBtn', idleFileInput: 'exchangeAfterVtTestIdleExcelFileInput',
    panelAlarmBanner: 'exchangeAfterVtTestAlarmBanner', panelAlarmMsg: 'exchangeAfterVtTestPanelAlarmMsg',
    pauseBtn: 'exchangeAfterVtTestPauseBtn',
    resetBtn: 'exchangeAfterVtTestResetBtn',
    captureInitial: 'exchangeAfterVtTestInitialValue', captureCurrent: 'exchangeAfterVtTestCurrentValue',
    captureDecimals: 3,
    settingValue: 'exchangeAfterVtTestSetValue',
  },
  // "교환후3P_배관청소" 화면 - Status "3P". 용기교체(CC) 완료 직후 자동으로 시작된다.
  // 사용자 확인(2026-08-09): 교환전 2P(twoP)와 완전히 동일한 서브시퀀스 구조(TwoP_v1.json을
  // 그대로 복제) - data/gmsSubSequences/AfterThreeP_v1.json 참고. 완료되면 곧장 다음
  // 화면(+L 가압시험)으로 넘어간다(VT 분기 없음, advanceToNextEnabledStatus가 처리).
  afterThreeP: {
    mainStepType: 'AfterThreeP', screenKey: 'exchangeThirdPurge',
    idle: 'exchangeThirdPurgeIdle', panel: 'exchangeThirdPurgePanel', stepLabel: 'exchangeThirdPurgeStepLabel',
    operation: 'exchangeThirdPurgeOperation', message: 'exchangeThirdPurgeMessage', valveDiff: 'exchangeThirdPurgeValveDiff',
    timer: 'exchangeThirdPurgeTimer', accTime: 'exchangeThirdPurgeAccTime',
    cycleInfo: 'exchangeThirdPurgeCycleInfo', cycleTarget: 'exchangeThirdPurgeCycleTarget', cycleCurrent: 'exchangeThirdPurgeCycleCurrent',
    ackBtn: 'exchangeThirdPurgeAckBtn', stopBtn: 'exchangeThirdPurgeCancelBtn', stopBtnMode: 'cancel', finishStopLabel: null,
    alarmTestBtn: null, alarmTestSelect: null,
    exportBtn: 'exchangeThirdPurgeExcelExportBtn', importBtn: 'exchangeThirdPurgeExcelImportBtn', fileInput: 'exchangeThirdPurgeExcelFileInput',
    executeBtn: 'exchangeThirdPurgeExecuteBtn', lastAlarm: 'exchangeThirdPurgeLastAlarm',
    idleCycleInfo: 'exchangeThirdPurgeIdleCycleInfo', idleCycleTarget: 'exchangeThirdPurgeIdleCycleTarget', idleCycleCurrent: 'exchangeThirdPurgeIdleCycleCurrent',
    idleCancelBtn: 'exchangeThirdPurgeIdleCancelBtn',
    idleExportBtn: 'exchangeThirdPurgeIdleExcelExportBtn', idleImportBtn: 'exchangeThirdPurgeIdleExcelImportBtn', idleFileInput: 'exchangeThirdPurgeIdleExcelFileInput',
    panelAlarmBanner: 'exchangeThirdPurgeAlarmBanner', panelAlarmMsg: 'exchangeThirdPurgePanelAlarmMsg',
    pauseBtn: 'exchangeThirdPurgePauseBtn',
    resetBtn: 'exchangeThirdPurgeResetBtn',
  },
  // "교환후+L_가압시험" 화면 - Status "+L". 3차 배관청소 완료 직후 자동으로 시작된다. 교환전
  // -L(exchangePressureTest)과 동일한 CAPTURE+분단위 반복판정 패턴이지만 안전조건 방향은
  // 반대다(가압 시험이라 압력이 하한 아래로 새면 알람) - data/gmsSubSequences/AfterPlusL_v1.json
  // 참고. 완료 시 VT 사용 옵션에 따라 -VT 또는 4P로 넘어간다(advanceToNextEnabledStatus가 처리).
  afterPlusL: {
    mainStepType: 'AfterPlusL', screenKey: 'exchangeAfterPressureTest',
    idle: 'exchangeAfterPressureTestIdle', panel: 'exchangeAfterPressureTestPanel', stepLabel: 'exchangeAfterPressureTestStepLabel',
    operation: 'exchangeAfterPressureTestOperation', message: 'exchangeAfterPressureTestMessage', valveDiff: 'exchangeAfterPressureTestValveDiff',
    timer: 'exchangeAfterPressureTestTimer', accTime: 'exchangeAfterPressureTestAccTime',
    cycleInfo: 'exchangeAfterPressureTestCycleInfo', cycleTarget: 'exchangeAfterPressureTestCycleTarget', cycleCurrent: 'exchangeAfterPressureTestCycleCurrent',
    ackBtn: 'exchangeAfterPressureTestAckBtn', stopBtn: 'exchangeAfterPressureTestCancelBtn', stopBtnMode: 'cancel', finishStopLabel: null,
    alarmTestBtn: null, alarmTestSelect: null,
    exportBtn: 'exchangeAfterPressureTestExcelExportBtn', importBtn: 'exchangeAfterPressureTestExcelImportBtn', fileInput: 'exchangeAfterPressureTestExcelFileInput',
    executeBtn: 'exchangeAfterPressureTestExecuteBtn', lastAlarm: 'exchangeAfterPressureTestLastAlarm',
    idleCycleInfo: 'exchangeAfterPressureTestIdleCycleInfo', idleCycleTarget: 'exchangeAfterPressureTestIdleCycleTarget', idleCycleCurrent: 'exchangeAfterPressureTestIdleCycleCurrent',
    idleCancelBtn: 'exchangeAfterPressureTestIdleCancelBtn',
    idleExportBtn: 'exchangeAfterPressureTestIdleExcelExportBtn', idleImportBtn: 'exchangeAfterPressureTestIdleExcelImportBtn', idleFileInput: 'exchangeAfterPressureTestIdleExcelFileInput',
    panelAlarmBanner: 'exchangeAfterPressureTestAlarmBanner', panelAlarmMsg: 'exchangeAfterPressureTestPanelAlarmMsg',
    pauseBtn: 'exchangeAfterPressureTestPauseBtn',
    captureInitial: 'exchangeAfterPressureTestCaptureInitial', captureCurrent: 'exchangeAfterPressureTestCaptureCurrent',
    captureLimit: 'exchangeAfterPressureTestCaptureLimit',
    cycleCurrentAsTime: true,
    resetBtn: 'exchangeAfterPressureTestResetBtn',
  },
  // "교환후_Puls2" 화면 - Status "Puls 2"(가압 후 Pulse Vent). +L 완료 직후 자동으로 시작된다.
  // data/gmsSubSequences/AfterPuls_v1.json 참고. 완료 시 -VT 또는 4P로 넘어간다.
  afterPuls: {
    mainStepType: 'AfterPuls', screenKey: 'exchangeAfterPuls',
    idle: 'exchangeAfterPulsIdle', panel: 'exchangeAfterPulsPanel', stepLabel: 'exchangeAfterPulsStepLabel',
    operation: 'exchangeAfterPulsOperation', message: 'exchangeAfterPulsMessage', valveDiff: 'exchangeAfterPulsValveDiff',
    timer: 'exchangeAfterPulsTimer', accTime: 'exchangeAfterPulsAccTime',
    cycleInfo: 'exchangeAfterPulsCycleInfo', cycleTarget: 'exchangeAfterPulsCycleTarget', cycleCurrent: 'exchangeAfterPulsCycleCurrent',
    ackBtn: 'exchangeAfterPulsAckBtn', stopBtn: 'exchangeAfterPulsCancelBtn', stopBtnMode: 'cancel', finishStopLabel: null,
    alarmTestBtn: null, alarmTestSelect: null,
    exportBtn: 'exchangeAfterPulsExcelExportBtn', importBtn: 'exchangeAfterPulsExcelImportBtn', fileInput: 'exchangeAfterPulsExcelFileInput',
    executeBtn: 'exchangeAfterPulsExecuteBtn', lastAlarm: 'exchangeAfterPulsLastAlarm',
    idleCycleInfo: 'exchangeAfterPulsIdleCycleInfo', idleCycleTarget: 'exchangeAfterPulsIdleCycleTarget', idleCycleCurrent: 'exchangeAfterPulsIdleCycleCurrent',
    idleCancelBtn: 'exchangeAfterPulsIdleCancelBtn',
    idleExportBtn: 'exchangeAfterPulsIdleExcelExportBtn', idleImportBtn: 'exchangeAfterPulsIdleExcelImportBtn', idleFileInput: 'exchangeAfterPulsIdleExcelFileInput',
    panelAlarmBanner: 'exchangeAfterPulsAlarmBanner', panelAlarmMsg: 'exchangeAfterPulsPanelAlarmMsg',
    pauseBtn: 'exchangeAfterPulsPauseBtn',
    resetBtn: 'exchangeAfterPulsResetBtn',
  },
  // "교환후4P_배관청소" 화면 - Status "4P". +L(또는 -VT) 완료 직후 자동으로 시작된다. 3P와
  // 완전히 동일한 구조(TwoP_v1.json 복제) - data/gmsSubSequences/AfterFourP_v1.json 참고.
  // 완료 시 PASSWORD(exchangeFourthPurgeDone) 재확인 후 다음 Status(PC)로 넘어간다.
  afterFourP: {
    mainStepType: 'AfterFourP', screenKey: 'exchangeFourthPurge',
    idle: 'exchangeFourthPurgeIdle', panel: 'exchangeFourthPurgePanel', stepLabel: 'exchangeFourthPurgeStepLabel',
    operation: 'exchangeFourthPurgeOperation', message: 'exchangeFourthPurgeMessage', valveDiff: 'exchangeFourthPurgeValveDiff',
    timer: 'exchangeFourthPurgeTimer', accTime: 'exchangeFourthPurgeAccTime',
    cycleInfo: 'exchangeFourthPurgeCycleInfo', cycleTarget: 'exchangeFourthPurgeCycleTarget', cycleCurrent: 'exchangeFourthPurgeCycleCurrent',
    ackBtn: 'exchangeFourthPurgeAckBtn', stopBtn: 'exchangeFourthPurgeCancelBtn', stopBtnMode: 'cancel', finishStopLabel: null,
    alarmTestBtn: null, alarmTestSelect: null,
    exportBtn: 'exchangeFourthPurgeExcelExportBtn', importBtn: 'exchangeFourthPurgeExcelImportBtn', fileInput: 'exchangeFourthPurgeExcelFileInput',
    executeBtn: 'exchangeFourthPurgeExecuteBtn', lastAlarm: 'exchangeFourthPurgeLastAlarm',
    idleCycleInfo: 'exchangeFourthPurgeIdleCycleInfo', idleCycleTarget: 'exchangeFourthPurgeIdleCycleTarget', idleCycleCurrent: 'exchangeFourthPurgeIdleCycleCurrent',
    idleCancelBtn: 'exchangeFourthPurgeIdleCancelBtn',
    idleExportBtn: 'exchangeFourthPurgeIdleExcelExportBtn', idleImportBtn: 'exchangeFourthPurgeIdleExcelImportBtn', idleFileInput: 'exchangeFourthPurgeIdleExcelFileInput',
    panelAlarmBanner: 'exchangeFourthPurgeAlarmBanner', panelAlarmMsg: 'exchangeFourthPurgePanelAlarmMsg',
    pauseBtn: 'exchangeFourthPurgePauseBtn',
    resetBtn: 'exchangeFourthPurgeResetBtn',
  },
  // "HP&LP_Pump" 화면 - Status "HP&LP Pump". 퍼지완료(PC) 후 가스공급 전 배관 진공을 잡는 Pumping 구간.
  // OneP3_v1.json과 동일한 분 단위 Pumping 대기 & 실시간 HPT 감시 구조.
  // data/gmsSubSequences/HpLpPump_v1.json 참고.
  hpLpPump: {
    mainStepType: 'HpLpPump', screenKey: 'hpLpPump',
    idle: 'hpLpPumpIdle', panel: 'hpLpPumpPanel', stepLabel: 'hpLpPumpStepLabel',
    operation: 'hpLpPumpOperation', message: 'hpLpPumpMessage', valveDiff: 'hpLpPumpValveDiff',
    timer: 'hpLpPumpTimer', accTime: 'hpLpPumpAccTime',
    cycleInfo: 'hpLpPumpCycleInfo', cycleTarget: 'hpLpPumpCycleTarget', cycleCurrent: 'hpLpPumpCycleCurrent',
    ackBtn: 'hpLpPumpAckBtn', stopBtn: 'hpLpPumpCancelBtn', stopBtnMode: 'cancel', finishStopLabel: null,
    alarmTestBtn: null, alarmTestSelect: null,
    exportBtn: 'hpLpPumpExcelExportBtn', importBtn: 'hpLpPumpExcelImportBtn', fileInput: 'hpLpPumpExcelFileInput',
    executeBtn: 'hpLpPumpExecuteBtn', lastAlarm: 'hpLpPumpLastAlarm',
    idleCycleInfo: 'hpLpPumpIdleCycleInfo', idleCycleTarget: 'hpLpPumpIdleCycleTarget', idleCycleCurrent: 'hpLpPumpIdleCycleCurrent',
    idleCancelBtn: 'hpLpPumpIdleCancelBtn',
    idleExportBtn: 'hpLpPumpIdleExcelExportBtn', idleImportBtn: 'hpLpPumpIdleExcelImportBtn', idleFileInput: 'hpLpPumpIdleExcelFileInput',
    panelAlarmBanner: 'hpLpPumpAlarmBanner', panelAlarmMsg: 'hpLpPumpPanelAlarmMsg',
    pauseBtn: 'hpLpPumpPauseBtn',
    captureInitial: 'hpLpPumpCaptureInitial', captureCurrent: 'hpLpPumpCaptureCurrent',
    cycleCurrentAsTime: true,
    resetBtn: 'hpLpPumpResetBtn',
  },
  // "시퀀스_Bypass" 화면 - Status "Bypass"(배관 By-pass 체크). 용기교체(CC) 완료 직후
  // 자동으로 시작된다(Bypass 사용 옵션 적용 시만 - 미적용이면 Operation.js의
  // nextStatusIndexAfter가 이 Status 자체를 건너뛴다). data/gmsSubSequences/Bypass_v1.json
  // 참고 - TASK.md 2026-08-09 지시 반영. 완료되면 곧장 다음 화면(3P)으로 넘어간다.
  bypass: {
    mainStepType: 'Bypass', screenKey: 'sequenceBypass',
    idle: 'sequenceBypassIdle', panel: 'sequenceBypassPanel', stepLabel: 'sequenceBypassStepLabel',
    operation: 'sequenceBypassOperation', message: 'sequenceBypassMessage', valveDiff: 'sequenceBypassValveDiff',
    timer: 'sequenceBypassTimer', accTime: 'sequenceBypassAccTime',
    cycleInfo: 'sequenceBypassCycleInfo', cycleTarget: 'sequenceBypassCycleTarget', cycleCurrent: 'sequenceBypassCycleCurrent',
    ackBtn: 'sequenceBypassAckBtn', stopBtn: 'sequenceBypassCancelBtn', stopBtnMode: 'cancel', finishStopLabel: null,
    alarmTestBtn: null, alarmTestSelect: null,
    exportBtn: 'sequenceBypassExcelExportBtn', importBtn: 'sequenceBypassExcelImportBtn', fileInput: 'sequenceBypassExcelFileInput',
    executeBtn: 'sequenceBypassExecuteBtn', lastAlarm: 'sequenceBypassLastAlarm',
    idleCycleInfo: 'sequenceBypassIdleCycleInfo', idleCycleTarget: 'sequenceBypassIdleCycleTarget', idleCycleCurrent: 'sequenceBypassIdleCycleCurrent',
    idleCancelBtn: 'sequenceBypassIdleCancelBtn',
    idleExportBtn: 'sequenceBypassIdleExcelExportBtn', idleImportBtn: 'sequenceBypassIdleExcelImportBtn', idleFileInput: 'sequenceBypassIdleExcelFileInput',
    panelAlarmBanner: 'sequenceBypassAlarmBanner', panelAlarmMsg: 'sequenceBypassPanelAlarmMsg',
    pauseBtn: 'sequenceBypassPauseBtn',
    resetBtn: 'sequenceBypassResetBtn',
    captureInitial: 'sequenceBypassCaptureInitial', captureCurrent: 'sequenceBypassCaptureCurrent',
    captureLimit: 'sequenceBypassCaptureLimit',
    captureDecimals: 2,
    cycleCurrentAsTime: true,
  },
};

function el(ns, key) {
  const id = SUBSEQ_NS[ns] && SUBSEQ_NS[ns][key];
  return id ? document.getElementById(id) : null;
}

/** idle 화면에 "마지막 알람" 문구를 표시(lastAlarm id가 없는 네임스페이스는 조용히 무시). */
function subSeqSetLastAlarm(ns, text) {
  const elMsg = el(ns, 'lastAlarm');
  if (elMsg) elMsg.textContent = text;
}

/** 알람 발생 순간의 설정/진행 횟수를 idle 화면 쪽에 그대로 복사해 고정한다(사용자 요청 -
    "진행횟수 유지하고 알람 메시지만 띄우면 됩니다"). cycleTarget이 아직 없으면(반복문에
    도달하기 전에 알람이 난 경우) 표시하지 않는다 - subSeqRenderCycleStatus와 동일한 규칙. */
/** "진행 횟수"를 초 단위 정밀도로 "N분 SS초"로 표시해야 하는 네임스페이스(Pumping)를 위한
    포맷터(사용자 요청 - "진행시간은 분과 초가 함께 나왔으면"). totalSec가 없으면(idle 알람
    스냅샷처럼 정확한 초 정보가 없을 때) 분 단위만 알고 있다고 보고 00초로 표시한다. */
function subSeqFormatCycleAsTime(cycleCurrent, totalSec) {
  const t = totalSec != null ? totalSec : Number(cycleCurrent) * 60;
  const mm = Math.floor(t / 60);
  const ss = Math.max(0, Math.floor(t % 60));
  return `${mm}분 ${String(ss).padStart(2, '0')}초`;
}

/** 이 Step이 감시 중인 실제 비교값(예: 압력 상한/누출 허용범위)을 화면의 "설정 값" 칸에
    보여준다(settingValue id가 없는 네임스페이스는 조용히 무시) - VT 감압시험처럼 단계마다
    비교 대상 CONFIG가 달라지는 화면에서, 지금 이 순간 실제로 감시 중인 숫자를 그대로
    보여주기 위함(subSeqEvalOneCondition이 조건을 평가할 때마다 갱신). */
function subSeqSetSettingValue(ns, value) {
  const elVal = el(ns, 'settingValue');
  if (!elVal || !Number.isFinite(value)) return;
  elVal.textContent = value.toFixed(3);
}

function subSeqSetIdleCycleInfo(ns, cycleTarget, cycleCurrent) {
  const wrapEl = el(ns, 'idleCycleInfo');
  if (!wrapEl) return;
  if (cycleTarget == null) {
    wrapEl.style.display = 'none';
    return;
  }
  wrapEl.style.display = '';
  const targetEl = el(ns, 'idleCycleTarget');
  const curEl = el(ns, 'idleCycleCurrent');
  if (targetEl) targetEl.textContent = String(cycleTarget);
  if (curEl) curEl.textContent = SUBSEQ_NS[ns].cycleCurrentAsTime ? subSeqFormatCycleAsTime(cycleCurrent) : String(cycleCurrent);
}

// ns별 "알람 배너가 떠 있는 동안" 플래그 - 이 동안엔 stopBtn("취소")이 "실행"으로 바뀌어
// 재시작을 담당한다(사용자 요청 - "확인 key를 삭제하시고, 하단 버튼에 취소를 실행으로 변경").
const subSeqAlarmActive = { adjustMode: false, idleCheck: false, puls: false, oneP: false, onePPurge: false, onePPumping: false, onePPrimaryPurge: false, exchangePressureTest: false, twoP: false, vtTest: false, afterVtTest: false, afterThreeP: false, afterPlusL: false, afterPuls: false, afterFourP: false, hpLpPump: false, bypass: false };

/** 알람이 나도 화면(idle) 전환 없이 지금 패널을 그대로 두고 배너(메시지만)를 띄운다(사용자
    요청 - "화면 변경없이 기존 화면에 알람 메세지만 추가로"). 별도 확인 버튼 대신 stopBtn을
    "실행"으로 바꿔 재시작을 맡긴다. panelAlarmBanner id가 없는 네임스페이스는 조용히
    무시(하위호환 - 조정모드/idleCheck는 기존 idle 전환 방식 그대로). */
function subSeqShowAlarmBanner(ns, text) {
  const banner = el(ns, 'panelAlarmBanner');
  const msgEl = el(ns, 'panelAlarmMsg');
  if (!banner) return;
  if (msgEl) msgEl.textContent = text;
  banner.style.display = '';
  subSeqAlarmActive[ns] = true;
  const stopBtn = el(ns, 'stopBtn');
  if (stopBtn) {
    if (!stopBtn.dataset.origLabel) stopBtn.dataset.origLabel = stopBtn.textContent;
    stopBtn.textContent = '실행';
  }
}
function subSeqHideAlarmBanner(ns) {
  const banner = el(ns, 'panelAlarmBanner');
  if (banner) banner.style.display = 'none';
  subSeqAlarmActive[ns] = false;
  const stopBtn = el(ns, 'stopBtn');
  if (stopBtn && stopBtn.dataset.origLabel) stopBtn.textContent = stopBtn.dataset.origLabel;
}

// ns별 "다음 실행은 이 Step No부터 시작" 힌트 - Alarm Seq. 1(초기화)은 밸브를 전부 CLOSE한
// 뒤 정지하므로, 곧바로 다시 "실행"하면 Step 1(보통 "밸브 초기화(전체 Close)" - 이미 끝난
// 상태)을 또 반복할 필요가 없다(사용자 요청 - "실행을 눌렀을 때 Step 2번부터 재실행").
// startNamespacedSubSequenceRunner가 다음 "실행"(resume이 아닌 새 실행) 때 한 번만 읽고
// 지운다 - 그 다음부터는(정상 완료 후 재시작 등) 다시 Step 1부터 시작한다.
const subSeqRestartFromStepNo = { adjustMode: null, idleCheck: null, puls: null, oneP: null, onePPurge: null, onePPumping: null, onePPrimaryPurge: null, exchangePressureTest: null, twoP: null, vtTest: null, afterVtTest: null, afterThreeP: null, afterPlusL: null, afterPuls: null, afterFourP: null, hpLpPump: null, bypass: null };

// ns별 실행 상태 - 예전엔 이 전부가 모듈 전역 변수 하나(subSeqRunState)였다. { mainStepType,
// side, data, stepIndex, valveOpenState:{resolvedTag:bool}, timerId, masterTimerId, elapsedSec,
// cycleTarget, cycleCurrent, running } | null
const subSeqRunStates = { adjustMode: null, idleCheck: null, puls: null, oneP: null, onePPurge: null, onePPumping: null, onePPrimaryPurge: null, exchangePressureTest: null, twoP: null, vtTest: null, afterVtTest: null, afterThreeP: null, afterPlusL: null, afterPuls: null, afterFourP: null, hpLpPump: null, bypass: null };
// ns별 Alarm Seq. 코드 2(이어서 재진행) 대기 지점. { mainStepType, side, stepIndex,
// valveOpenState, elapsedSec, cycleTarget, cycleCurrent } | null
const subSeqPendingResumes = { adjustMode: null, idleCheck: null, puls: null, oneP: null, onePPurge: null, onePPumping: null, onePPrimaryPurge: null, exchangePressureTest: null, twoP: null, vtTest: null, afterVtTest: null, afterThreeP: null, afterPlusL: null, afterPuls: null, afterFourP: null, hpLpPump: null, bypass: null };
// ns별 시작 옵션(onFinish/onCancel 콜백) - startNamespacedSubSequenceRunner가 호출될 때마다 갱신.
const subSeqCallbacks = { adjustMode: {}, idleCheck: {}, puls: {}, oneP: {}, onePPurge: {}, onePPumping: {}, onePPrimaryPurge: {}, exchangePressureTest: {}, twoP: {}, vtTest: {}, afterVtTest: {}, afterThreeP: {}, afterPlusL: {}, afterPuls: {}, afterFourP: {}, hpLpPump: {}, bypass: {} };

// CONFIG 탭(gms.html 상단 탭 바) 설정값 캐시 - 서브시퀀스 시작 시 한 번 불러와서 Step의
// conditionValue(CONFIG id 참조)를 조건 평가 때 찾아 쓴다. 실행 중 CONFIG 값이 바뀌어도
// 이미 시작된 실행에는 반영되지 않는다(다음 실행부터 최신값 적용). CONFIG는 앱 전체에서
// 공유되는 단일 데이터라 네임스페이스별로 나눌 필요가 없다(여러 네임스페이스가 동시에
// 시작돼도 매번 같은 서버 데이터를 다시 받아오는 것뿐이라 서로 덮어써도 안전).
let subSeqConfigRows = [];
// 압력조정 표(data/gmsPtCalibration.json) 캐시 - 위와 같은 이유로 공유.
let subSeqPtCalibRows = [];

function subSeqResolveTag(tag, side) {
  return tag.replace('{side}', side);
}

/** CONFIG 탭 또는 런타임에 동적으로 변경된 최신 설정값 배열을 반환한다. */
function subSeqGetActiveConfigRows() {
  if (typeof configRows !== 'undefined' && Array.isArray(configRows) && configRows.length > 0) {
    return configRows;
  }
  if (typeof window !== 'undefined' && Array.isArray(window.configRows) && window.configRows.length > 0) {
    return window.configRows;
  }
  return subSeqConfigRows || [];
}
window.updateSubSeqConfigRows = (rows) => {
  if (Array.isArray(rows)) subSeqConfigRows = rows;
};

/** CONFIG 설정값을 id 또는 name으로 찾고, 필요 시 _{side} suffix fallback을 적용한다.
    시퀀스 진행 도중 CONFIG 탭에서 진공하한치나 설정값을 변경해도 실시간으로 즉시 반영된다. */
function subSeqFindConfigRow(targetRef, side) {
  const resolvedTargetRef = subSeqResolveTag(targetRef, side);
  const rows = subSeqGetActiveConfigRows();
  let configRow = rows.find((r) => r.id === resolvedTargetRef || r.name === resolvedTargetRef);
  if (!configRow && side && !resolvedTargetRef.endsWith('_' + side)) {
    const sideSuffixTarget = resolvedTargetRef + '_' + side;
    configRow = rows.find((r) => r.id === sideSuffixTarget || r.name === sideSuffixTarget);
  }
  return { configRow, resolvedTargetRef };
}

/** "설정 횟수 / 진행 횟수" 박스가 반복문 Step에 처음 도달하기 전까지 안 보이던 문제
    (사용자 지적 - "처음 화면 진행을 할 때부터 보이면 될 것 같습니다")를 고친다. 실행
    시작 시점에 미리 steps를 훑어서 "진행횟수"를 감시하는 Step을 찾아 그 설정값(CONFIG)을
    읽어둔다 - 실제 조건 평가(subSeqEvalOneCondition)와 같은 방식(&로 구분된 여러 조건 중
    "진행횟수"와 같은 자리의 대상을 CONFIG id/설정명으로 찾음)으로 계산해서 결과가 어긋나지
    않게 한다. 못 찾으면(반복문이 없는 서브시퀀스 등) null - 기존처럼 박스가 계속 숨겨진다. */
function subSeqPrescanCycleTarget(steps, side) {
  for (const step of steps) {
    if (!step.alarmMonitoring || !step.conditionValue) continue;
    const tags = String(step.alarmMonitoring).split('&').map((s) => s.trim());
    const idx = tags.indexOf('진행횟수');
    if (idx === -1) continue;
    const targets = String(step.conditionValue).split('&').map((s) => s.trim());
    const targetRef = targets[idx];
    if (!targetRef) continue;
    const { configRow, resolvedTargetRef } = subSeqFindConfigRow(targetRef, side);
    const target = Number(configRow ? configRow.value : resolvedTargetRef);
    if (Number.isFinite(target)) return target;
  }
  return null;
}

function subSeqFindStepIndexByNo(steps, no) {
  const idx = steps.findIndex((s) => String(s.no) === String(no));
  return idx;
}

// ── 16개 Main 공정 표준 명칭 매핑 (작업이력 표시용) ──
const MAIN_STEP_INFO = {
  IdleCheck:   { no: 1,  name: '사전확인', title: '교환전 사전확인' },
  Puls:        { no: 2,  name: 'Puls',     title: '잔류가스 Check & 배기' },
  OneP:        { no: 3,  name: '1P-1',     title: '1-2차측 Vent Mode' },
  OneP2:       { no: 4,  name: '1P-2',     title: '2차측 Purge' },
  OneP3:       { no: 5,  name: '1P-3',     title: 'Pumping' },
  OneP4:       { no: 6,  name: '1P-4',     title: '1차측 Purge' },
  ExchL:       { no: 7,  name: '-L',       title: '교환전 -L 감압시험' },
  TwoP:        { no: 8,  name: '2P',       title: '교환전 2P 배관청소' },
  VtTest:      { no: 9,  name: '-VT',      title: '교환전 -VT 감압시험' },
  CylReplace:  { no: 10, name: 'CC',       title: '용기교체' },
  Bypass:      { no: 11, name: 'Bypass',   title: '배관 Bypass 체크' },
  AfterThreeP: { no: 12, name: '3P',       title: '교환후 3P 배관청소' },
  AfterPlusL:  { no: 13, name: '+L',       title: '교환후 +L 가압시험' },
  AfterPuls:   { no: 14, name: 'Puls 2',   title: '가압 후 Puls' },
  AfterVtTest: { no: 15, name: '-VT',      title: '교환후 -VT 감압시험' },
  AfterFourP:  { no: 16, name: '4P',       title: '교환후 4P 배관청소' },
  HpLpPump:    { no: 17, name: 'HP&LP Pump', title: 'HP&LP Pump' },
  AdjustMode:  { no: 18, name: '조정모드', title: '압력조정모드' },
};

/** 사람이 한눈에 공정/스텝/밸브 Open-Close/초기값/안정화/누적시간을 이해할 수 있는 정밀 작업이력 문구 생성 */
function subSeqFormatWorklogMessage(ns, step, runStateSnapshot, extraLabel, diffLabels) {
  const { mainStepType, side, elapsedSec, valveOpenState } = runStateSnapshot;
  const mInfo = MAIN_STEP_INFO[mainStepType] || { no: step.mainStep || '-', name: mainStepType, title: mainStepType };

  // 1. 메인 공정 & 서브스텝 헤더
  let stepName = step.operation || step.message || '';
  if (!stepName && step.remarks) {
    stepName = step.remarks.length > 25 ? `${step.remarks.slice(0, 22)}...` : step.remarks;
  }
  if (!stepName) stepName = '자동진행';
  const headerPart = `[Main ${mInfo.no}: ${mInfo.name} / Step ${step.no} (${stepName}${extraLabel ? ` - ${extraLabel}` : ''})]`;

  // 2. 밸브 동작 상태 포맷팅 (Open/Close 개별 동작 정밀 분석)
  let valvePart = '';
  const valveEntries = Object.entries(step.valves || {});
  const opens = [];
  const closes = [];
  valveEntries.forEach(([tag, mark]) => {
    const resolved = subSeqResolveTag(tag, side);
    if (mark === 'O') opens.push(resolved);
    else if (mark === 'C') closes.push(resolved);
  });

  if (opens.length > 0 && closes.length > 0) {
    valvePart = `밸브 동작: ${opens.join(', ')} [OPEN] / ${closes.join(', ')} [CLOSE]`;
  } else if (opens.length > 0) {
    valvePart = `밸브 동작: ${opens.join(', ')} [OPEN]`;
  } else if (closes.length > 0) {
    valvePart = `밸브 동작: ${closes.join(', ')} [CLOSE]`;
  } else if (diffLabels && diffLabels.length > 0) {
    valvePart = `밸브 동작: ${diffLabels.join(', ')}`;
  } else {
    // 변경된 밸브가 없는 경우 -> 현재 열려있는 밸브 상태 유지 확인
    const currentlyOpen = Object.entries(valveOpenState || {})
      .filter(([_, isOpen]) => isOpen === true)
      .map(([tag]) => tag);
    if (currentlyOpen.length > 0) {
      valvePart = `밸브 상태: ${currentlyOpen.join(', ')} [OPEN 유지]`;
    } else {
      valvePart = '밸브 상태: 전 밸브 [CLOSE]';
    }
  }

  // 3. 판정 기준 / 안정화 시간 / 초기값 포맷팅
  let condPart = '';
  const delaySec = Number(step.timeSec) || Number(step.delay) || 0;
  const rawCondTag = step.alarmMonitoring || step.conditionTag || '';
  if (rawCondTag && rawCondTag.trim() !== '') {
    const condTag = subSeqResolveTag(rawCondTag, side);
    const op = step.conditionOp || step.conditionOperator || '==';
    const val = step.conditionValue != null ? subSeqResolveTag(step.conditionValue, side) : '';

    let initValStr = '';
    if (runStateSnapshot && runStateSnapshot.initialPt && runStateSnapshot.initialPt[condTag] != null) {
      initValStr = ` (초기 P0: ${Number(runStateSnapshot.initialPt[condTag]).toFixed(2)})`;
    }
    condPart = `판정: ${condTag} ${op} ${val}${initValStr}${delaySec > 0 ? ` (안정화: ${delaySec}초)` : ''}`;
  } else if (delaySec > 0) {
    condPart = `대기: ${delaySec}초 안정화 대기`;
  } else if (step.advance === 'ack' || step.type === 'ack' || step.type === 'HLT') {
    condPart = '판정: 작업자 수동 확인(Ack) 대기';
  } else {
    condPart = '판정: 동작 완료 후 Next Step 이동';
  }

  // 4. 진행 시간 및 누적 시간
  const timePart = `시간: ${delaySec > 0 ? `${delaySec}초` : '-'} (누적 ${elapsedSec || 0}초)`;

  // 사용자 지정 커스텀 remarks가 있고 operation과 다르면 뒤에 부가 설명으로 붙임
  const customHint = (step.remarks && step.remarks !== step.operation) ? ` [${step.remarks}]` : '';

  return `${headerPart} | ${valvePart} | ${condPart} | ${timePart}${customHint}`;
}

/** logWorkAction과 같은 형식으로 work_log에 남기되, 실제 클릭 버튼이 없는 자동/Ack 진행이라
    사람이 직관적으로 이해할 수 있는 4단 정밀 포맷(공정/스텝/밸브 Open-Close/판정/시간)으로 기록한다. */
function subSeqLogStep(ns, step, runStateSnapshot, extraLabel, diffLabels) {
  const { mainStepType, subSeqId, side, elapsedSec } = runStateSnapshot;
  const richLabel = subSeqFormatWorklogMessage(ns, step, runStateSnapshot, extraLabel, diffLabels);

  fetch('/api/gms/worklog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      unitId: selectedUnitId,
      action: `subSeq_${mainStepType}`,
      side: side || null,
      detail: richLabel,
      operatorName: currentGmsOperator ? currentGmsOperator.name : null,
      operatorRole: currentGmsOperator ? currentGmsOperator.role : null,
      analogSnapshot: { ...lastPtByTag },
      screenKey: SUBSEQ_NS[ns].screenKey,
      screenTitle: progressHeader ? progressHeader.textContent : '',
      statusLabel: '',
      buttonLabel: richLabel,
      subSeqId,
      subSeqStepNo: step.no != null ? String(step.no) : null,
      subSeqElapsedSec: elapsedSec,
    }),
  }).catch(() => { /* 이력 기록 실패가 진행을 막으면 안 됨 */ });
}

function subSeqSetPanelVisible(ns, running) {
  const idle = el(ns, 'idle');
  const panel = el(ns, 'panel');
  if (idle) idle.style.display = running ? 'none' : 'flex';
  if (panel) panel.style.display = running ? 'flex' : 'none';

  // idleCheck 네임스페이스 특수 보강 (DOM 캐시나 ID 직접 지정 대비)
  if (ns === 'idleCheck') {
    const lockIdle = document.getElementById('cylinderLockIdle');
    if (lockIdle) lockIdle.style.display = running ? 'none' : 'flex';
    const lockPanel = document.getElementById('cylinderLockPanel');
    if (lockPanel) lockPanel.style.display = running ? 'flex' : 'none';
  }
}

function subSeqClearTimer(ns) {
  const rt = subSeqRunStates[ns];
  if (rt && rt.timerId) {
    clearInterval(rt.timerId);
    rt.timerId = null;
  }
}

/** 누적(경과) 시간 표시 - Step이 auto든 ack(HLT)든 상관없이 시작부터 종료/중지까지 1초
    단위로 계속 올라간다. Step별 카운트다운(subSeqClearTimer 대상)과는 별개의 타이머라 Ack
    대기 중에도 멈추지 않는다. */
function subSeqRenderAccTime(ns) {
  const rt = subSeqRunStates[ns];
  const target = el(ns, 'accTime');
  if (target && rt) target.textContent = `누적 경과시간: ${rt.elapsedSec}초`;
}
function subSeqStartMasterTimer(ns) {
  subSeqStopMasterTimer(ns);
  subSeqRenderAccTime(ns);
  const rt = subSeqRunStates[ns];
  rt.masterTimerId = setInterval(() => {
    const cur = subSeqRunStates[ns];
    if (!cur) return;
    cur.elapsedSec += 1;
    subSeqRenderAccTime(ns);
  }, 1000);
}
function subSeqStopMasterTimer(ns) {
  const rt = subSeqRunStates[ns];
  if (rt && rt.masterTimerId) {
    clearInterval(rt.masterTimerId);
    rt.masterTimerId = null;
  }
}

/** 지금까지 이 실행에서 OPEN으로 기록된 밸브 및 이 공정/측에 관련된 모든 밸브를
    전부 CLOSE 명령으로 내보낸다 - 알람 초기화(Alarm Seq. 1)/SHUTDOWN(3)/수동 "중지"·"취소"
    버튼이 전부 같은 안전 전폐 동작을 보장한다. 이어서 재진행(Alarm Seq. 2)에서는 부르면
    안 된다 - 그건 지금 상태를 그대로 두고 나중에 이어가야 하므로. */
function subSeqCloseAllOpenValves(valveOpenState, side, data) {
  const tagsToClose = new Set();
  // 1. 현재 실행에서 열려있는 것으로 기록된 밸브
  Object.entries(valveOpenState || {})
    .filter(([, open]) => open)
    .forEach(([tag]) => tagsToClose.add(tag));

  // 2. 이 서브시퀀스에 정의된 밸브 태그 전체
  if (data && Array.isArray(data.valveTags)) {
    data.valveTags.forEach((rawTag) => {
      tagsToClose.add(subSeqResolveTag(rawTag, side));
    });
  }

  // 3. 주요 공정 및 안전 차단 밸브 전체 전폐 (안전 인터록)
  ['PNV', 'GNV', 'HPIV', 'PNBV', 'PIV'].forEach((t) => tagsToClose.add(t));
  if (side) {
    ['LPV', 'HPI', 'HPV', 'PGI', 'PGII', 'FPV', 'LPI', 'V/S', 'AG'].forEach((t) => {
      tagsToClose.add(`${t}_${side}`);
    });
  }

  tagsToClose.forEach((tag) => {
    fetch('/api/gms/valve/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag, value: false }),
    }).catch(() => { /* 무시 - 밸브 CLOSE 실패해도 초기화 자체는 계속 진행 */ });
    if (valveOpenState) valveOpenState[tag] = false;
  });
  return Array.from(tagsToClose);
}

/** 밸브 O/C 변경분만 실제 쓰기(POST /api/gms/valve/write)로 내보내고, 누적 상태(valveOpenState)를
    갱신한다. 실패해도 시퀀스 진행 자체는 막지 않는다(작업이력에는 그대로 남음). 밸브가 없는
    서브시퀀스(step.valves가 빈 객체)는 entries가 비어있어 자연히 아무 일도 안 한다. */
function subSeqApplyValves(step, side, valveOpenState) {
  const entries = Object.entries(step.valves || {});
  const diffLabels = [];
  entries.forEach(([tag, mark]) => {
    const resolvedTag = subSeqResolveTag(tag, side);
    const open = mark === 'O';
    valveOpenState[resolvedTag] = open;
    diffLabels.push(`${resolvedTag} ${open ? 'OPEN' : 'CLOSE'}`);
    fetch('/api/gms/valve/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: resolvedTag, value: open }),
    }).catch(() => { /* 무시 - 밸브 쓰기 실패해도 시퀀스는 계속 진행 */ });
  });
  return diffLabels;
}

function subSeqRenderStep(ns, step, diffLabels, side) {
  const labelEl = el(ns, 'stepLabel');
  const opEl = el(ns, 'operation');
  const msgEl = el(ns, 'message');
  const diffEl = el(ns, 'valveDiff');
  const ackBtn = el(ns, 'ackBtn');
  if (labelEl) labelEl.textContent = `Main ${step.mainStep != null ? step.mainStep : '-'} - Sub ${step.subStep != null ? step.subStep : '-'}`;
  // Operation/Message 텍스트에도 밸브 태그와 동일하게 "{side}"를 진행 중인 측(A/B)으로
  // 치환한다(예: "Vent {side} Spec"). {side}가 없는 문자열은 replace가 그대로 반환하므로
  // 기존 Step들(대부분 side 무관 문구)에는 영향이 없다.
  if (opEl && step.operation) opEl.textContent = side ? subSeqResolveTag(step.operation, side) : step.operation; // Operation 없는 Step은 이전 값을 그대로 유지
  if (msgEl && step.message) msgEl.textContent = side ? subSeqResolveTag(step.message, side) : step.message; // 메시지 없는 Step은 이전 메시지를 그대로 유지
  if (diffEl) diffEl.textContent = diffLabels.length ? diffLabels.join(', ') : '(밸브 변경 없음)';
  if (ackBtn) ackBtn.style.display = step.advance === 'ack' ? '' : 'none';
  subSeqRenderCycleStatus(ns);
}

/** Step의 조건(Alarm Monitoring 태그 + 비교연산자 + 비교대상)을 CONFIG 값과 비교한다.
    셋 중 하나라도 비어있거나 지금 그 태그의 실시간 값을 모르면 "조건 없음"(null)으로 보고
    평소처럼 다음 Step으로 진행한다. conditionValue는 CONFIG 탭 행의 id를 먼저 찾아보고,
    없으면 숫자 리터럴로도 해석한다. */
function subSeqCompare(liveValue, op, target) {
  switch (op) {
    case '<': return liveValue < target;
    case '>': return liveValue > target;
    case '<=': return liveValue <= target;
    case '>=': return liveValue >= target;
    case '==': case '=': return liveValue === target;
    default: return null;
  }
}

const SUB_SEQ_BIT_OPS = new Set(['ON', 'OFF']);

function subSeqResolveCalibRow(tag) {
  return subSeqPtCalibRows.find((r) => r.tag === tag);
}
/** 압력조정 표 한 행(analogValue/offset/maxValue/resolution/type)으로 "현재값"을 계산한다 -
    src/gmsManager.js의 computeCalibratedCurrentValue와 완전히 같은 공식(rangeMin은 PT=-14.7,
    그 외(VT/Weight)=0). 압력조정 화면에 보이는 "현재값"과 항상 같은 수치가 나온다. */
function subSeqComputeCalibratedValue(calRow) {
  const resolution = Number(calRow.resolution) || 1;
  const analog = Number(calRow.analogValue) || 0;
  const percent = Math.max(0, Math.min(1, analog / resolution));
  const rangeMin = calRow.type === 'PT' ? -14.7 : 0;
  const max = Number(calRow.maxValue) || 0;
  const offset = Number(calRow.offset) || 0;
  return rangeMin + percent * (max - rangeMin) + offset;
}

/** Step 진입 시 "ZERO" 자동 0점 조정을 수행한다. Alarm Monitoring/비교연산자 두 열을 "&"로
    나란히 묶어 태그마다 "ZERO"(끝에 "?"를 붙이면 압력조정 표에 없는 태그는 조용히 건너뜀)를
    적으면, 그 태그의 압력조정 표 현재값을 읽어 "새 offset = 기존 offset - 현재값"으로 다시
    계산해 즉시 반영한다(현재값이 정확히 0이 되는 offset). 비교대상(conditionValue) 열은
    쓰지 않는다. subSeqPtCalibRows를 직접 수정하므로 바로 다음 Step이 ":OFFSET" 조건으로
    같은 태그를 확인해도 곧바로 반영된 값을 본다(fire-and-forget 서버 저장). */
function subSeqApplyAutoZero(step, side) {
  if (!step.alarmMonitoring || !step.conditionOp) return;
  const tags = String(step.alarmMonitoring).split('&').map((s) => s.trim()).filter(Boolean);
  const ops = String(step.conditionOp).split('&').map((s) => s.trim()).filter(Boolean);
  if (tags.length === 0 || tags.length !== ops.length) return;
  const zeroedTags = [];
  tags.forEach((tag, i) => {
    const isOptional = /\?\s*$/.test(ops[i]);
    const rawOp = ops[i].replace(/\?\s*$/, '').trim().toUpperCase();
    if (rawOp !== 'ZERO') return;
    const resolvedTag = subSeqResolveTag(tag, side);
    const calRow = subSeqResolveCalibRow(resolvedTag);
    if (!calRow) {
      if (!isOptional) {
        console.warn(`[서브시퀀스] Step ${step.no}: ZERO - "${resolvedTag}"를 압력조정 표에서 찾을 수 없습니다(오타 의심).`);
        if (typeof toast === 'function') toast(`Step ${step.no} 설정 오류: "${resolvedTag}"를 압력조정 표에서 찾을 수 없습니다(오타 확인 필요)`, 'err');
      }
      return;
    }
    const currentValue = subSeqComputeCalibratedValue(calRow);
    calRow.offset = (Number(calRow.offset) || 0) - currentValue;
    zeroedTags.push(resolvedTag);
  });
  if (zeroedTags.length === 0) return;
  toast(`Offset 자동 반영: ${zeroedTags.join(', ')}`, 'ok');
  fetch('/api/gms/pt-calibration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows: subSeqPtCalibRows }),
  }).catch(() => { /* 서버 저장 실패해도 진행 중인 시퀀스를 막지 않음 - 다음 실행 때 다시 반영됨 */ });
}

/** Cycle열(E열)에 "CAPTURE:<태그>" 지시가 있는 Step이 렌더될 때마다 호출된다(사용자 요청 -
    "7번스텝 처음 진행을 했을때 그때 hpt값을 초기값에 저장하고, 현재값은 hpt값을 계속
    실시간으로 보여준다"). rt.captureValues[태그]가 아직 없을 때만(=이번 실행에서 이 Step에
    처음 도달했을 때만) 그 순간의 값을 '초기값'으로 한 번 저장한다 - Pumping의 Step 7처럼
    같은 Step으로 반복 Alarm Goto(자기 자신 루프)해도 재캡처되지 않는다(cfg.captureInitial이
    있어야만 동작 - Pumping 화면 전용, 다른 네임스페이스는 자동으로 건너뜀). */
function subSeqResolvePtTag(rawTag, side) {
  let tag = subSeqResolveTag(rawTag, side);
  if (typeof lastPtByTag !== 'undefined' && lastPtByTag[tag] === undefined && side && !tag.endsWith('_' + side)) {
    const sideTag = tag + '_' + side;
    if (lastPtByTag[sideTag] !== undefined) tag = sideTag;
  }
  return tag;
}

function subSeqApplyCapture(ns, step, side) {
  const cfg = SUBSEQ_NS[ns];
  if (!cfg.captureInitial) return;
  const rt = subSeqRunStates[ns];
  if (!rt) return;
  const m = /^CAPTURE:(.+)$/i.exec(String(step.cycle || '').trim());
  if (m) {
    const tag = subSeqResolvePtTag(m[1].trim(), side);
    if (!rt.captureValues) rt.captureValues = {};
    if (rt.captureValues[tag] === undefined) {
      rt.captureValues[tag] = typeof lastPtByTag !== 'undefined' ? lastPtByTag[tag] : null;
    }
    rt.captureTag = tag;
    const baseTagName = tag.replace(/_[AB]$/i, '');
    const initEl = el(ns, 'captureInitial');
    const initLabelEl = document.getElementById(ns === 'bypass' ? 'sequenceBypassInitialLabel' : null) || (initEl && initEl.closest('.purge-count-row') && initEl.closest('.purge-count-row').querySelector('.purge-count-label'));
    if (initLabelEl) initLabelEl.textContent = `초기값(${baseTagName}) :`;
    const curEl = el(ns, 'captureCurrent');
    const curLabelEl = document.getElementById(ns === 'bypass' ? 'sequenceBypassCurrentLabel' : null) || (curEl && curEl.closest('.purge-count-row') && curEl.closest('.purge-count-row').querySelector('.purge-count-label'));
    if (curLabelEl) curLabelEl.textContent = `현재값(${baseTagName}) :`;
    if (initEl) {
      const v = rt.captureValues[tag];
      initEl.textContent = v === null || v === undefined ? '--' : Number(v).toFixed(cfg.captureDecimals || 2);
    }
    const limitEl = el(ns, 'captureLimit');
    if (limitEl) {
      let limitVal = null;
      let limitUnit = 'PSI';
      const condVal = String(step.conditionValue || '');
      const parts = condVal.split('&').map((s) => s.trim().replace(/^-/, ''));
      for (const p of parts) {
        if (p.includes('변동 기준') || p.includes('Variation') || p.includes('Limit')) {
          const { configRow } = subSeqFindConfigRow(p, side);
          if (configRow && configRow.value !== '' && configRow.value !== null && configRow.value !== undefined) {
            limitVal = configRow.value;
            if (configRow.unit) limitUnit = configRow.unit;
            break;
          }
        }
      }
      if (limitVal === null) {
        let defaultKey = '';
        if (ns === 'afterPlusL') defaultKey = '가압 시험-압력 변동 기준';
        else if (ns === 'exchangePressureTest') defaultKey = '감압 시험-압력 변동 기준';
        else if (ns === 'vtTest' || ns === 'afterVtTest') defaultKey = 'VT 누출 압력 변동 기준';
        if (defaultKey) {
          const { configRow } = subSeqFindConfigRow(defaultKey, side);
          if (configRow && configRow.value !== '' && configRow.value !== null && configRow.value !== undefined) {
            limitVal = configRow.value;
            if (configRow.unit) limitUnit = configRow.unit;
          }
        }
      }
      limitEl.textContent = limitVal !== null ? `${Number(limitVal).toFixed(cfg.captureDecimals || 2)} ${limitUnit}` : '-';
    }
  }
  subSeqRefreshLiveCaptures();
}

/** gms.js의 applyGmsPts(PT 값이 새로 들어올 때마다 호출됨)에서 매번 불러준다 - 진행 중인
    네임스페이스 중 캡처 대상 태그(rt.captureTag)가 있으면 그 화면의 '현재값'란을 실시간
    갱신한다. lastPtByTag는 gms.js에 정의된 전역이라 그대로 읽는다(toast()와 동일한
    클래식 스크립트 전역 공유 패턴). */
function subSeqRefreshLiveCaptures() {
  Object.keys(SUBSEQ_NS).forEach((ns) => {
    const cfg = SUBSEQ_NS[ns];
    if (!cfg.captureCurrent) return;
    const rt = subSeqRunStates[ns];
    if (!rt || !rt.running || !rt.captureTag) return;
    const curEl = el(ns, 'captureCurrent');
    if (curEl) {
      const v = lastPtByTag[rt.captureTag];
      curEl.textContent = v === null || v === undefined ? '--' : Number(v).toFixed(cfg.captureDecimals || 2);
    }
    subSeqCheckLiveSafety(ns, rt);
  });
}

/** CAPTURE:<태그> Step(예: Pumping Step 7)에 서 있는 동안 안전 조건(Alarm Monitoring/
    비교연산자/설정명)을 PT 값이 새로 들어올 때마다(1초 주기 폴링, gms.js applyGmsPts →
    subSeqRefreshLiveCaptures) 즉시 재평가한다(사용자 지적 - "60초마다가 아니라 진행시간
    동안 실시간으로 체크"). 60초 카운트다운이 다 차기를 기다리지 않고, 조건이 거짓이
    되는 순간 바로 subSeqHandleAlarm을 호출해 알람을 낸다 - 원래 있던 "타이머 만료 시점"
    평가(subSeqStartStepCountdown)는 그대로 두어, PT 폴링이 잠깐 끊겨도 최소 60초 안에는
    한 번 더 확인하는 안전망 역할을 한다. */
function subSeqCheckLiveSafety(ns, rt) {
  const steps = rt.data.steps || [];
  const step = steps[rt.stepIndex];
  if (!step || !/^CAPTURE:/i.test(String(step.cycle || '').trim())) return;
  if (!step.alarmMonitoring || !step.conditionOp) return;
  if (subSeqUsesCycleCounter(step)) return; // "진행횟수" 반복 판정은 이 실시간 경로가 아니라 타이머 만료 시점에만 평가한다
  if (subSeqEvalCondition(ns, step, rt.side) !== false) return;
  subSeqClearTimer(ns); // 남은 카운트다운을 즉시 중단하고 지금 바로 알람 처리로 넘어간다
  subSeqHandleAlarm(ns, Number(step.alarmSeq) || 1, step.alarmGoto);
}

/** OPTION 탭에서 조작자가 직접 켜고 끄는 스위치를 서브시퀀스 조건식(Alarm Monitoring 열)에서
    "가상 bit 태그"처럼 참조할 수 있게 하는 레지스트리 - PLC 신호(lastValueByTag)가 아니라
    gms.js에 정의된 전역 변수를 그대로 읽는다. ON/OFF 연산자로만 쓸 수 있다. 새 OPTION
    스위치를 추가하면 여기 한 줄만 더 적으면 서브시퀀스 Step에서 바로 쓸 수 있다. */
const SUB_SEQ_OPTION_TAGS = {
  '조정모드시퀀스1': () => (typeof adjustSeq1Option !== 'undefined' ? adjustSeq1Option : false),
  // Bypass/+L 가압시험 옵션(gms.js, TASK.md 2026-08-09 지시) - Bypass_v1.json/AfterPlusL_v1.json이
  // 이 3개 태그를 Alarm Monitoring 열에서 ON/OFF 연산자로 참조해 분기한다.
  'Bypass사용': () => (typeof bypassUseOption !== 'undefined' ? bypassUseOption : false),
  '고압HELeakCheck': () => (typeof highPressureHeLeakCheckOption !== 'undefined' ? highPressureHeLeakCheckOption : false),
  '가압시험후PulsVent': () => (typeof postPressureTestPulseVentOption !== 'undefined' ? postPressureTestPulseVentOption : false),
};

/** 조건 하나(태그+연산자+대상)를 평가한다(ns는 "진행횟수" 예약어의 Cycle 상태를 어느
    네임스페이스에서 읽을지 구분하기 위해 필요). 태그의 "{side}"는 밸브 태그와 동일하게
    진행 중인 측(A/B)으로 치환한다. 연산자가 ON/OFF면 아날로그값이 아니라 밸브 등 bit
    신호의 피드백(fb)을 본다. 연산자 끝에 "?"를 붙이면(예: "<=?", "ON?") 그 항목은
    "옵션"이다 - 태그의 실시간 값을 아직 모르면 이 항목 하나만 건너뛰고 나머지 필수
    항목들은 그대로 평가한다. CONFIG 값을 못 찾는 것(오타)은 옵션 여부와 무관하게 항상
    경고한다. */
function subSeqEvalOneCondition(ns, tag, rawOp, targetRef, side) {
  const resolvedTag = subSeqResolveTag(tag, side);
  const isOptional = /\?\s*$/.test(rawOp);
  const op = String(rawOp).replace(/\?\s*$/, '').trim();
  const normalizedOp = op.toUpperCase();

  // ":OFFSET" 접미사(예: "NPT_{side}:OFFSET") - 원시 PLC 값(lastPtByTag)이 아니라 압력조정
  // 표로 계산한 "현재값"의 절댓값을 쓴다. 비교대상 칸에 "<태그>:MAX<n>%"를 쓰면 그 태그의
  // 압력조정 표 Max값 × n%를 목표값으로 쓴다.
  const offsetMatch = /^(.*):OFFSET$/i.exec(resolvedTag);
  if (offsetMatch) {
    const baseTag = offsetMatch[1];
    const calRow = subSeqResolveCalibRow(baseTag);
    if (!calRow) return isOptional ? 'skip' : null;
    const liveValue = Math.abs(subSeqComputeCalibratedValue(calRow));
    const resolvedTargetRef = subSeqResolveTag(targetRef, side);
    const maxPctMatch = /^(.+):MAX(\d+(?:\.\d+)?)%$/i.exec(resolvedTargetRef);
    let target;
    if (maxPctMatch) {
      const targetCalRow = subSeqResolveCalibRow(maxPctMatch[1]);
      if (!targetCalRow || !Number.isFinite(Number(targetCalRow.maxValue))) {
        console.warn(`[서브시퀀스] "${resolvedTargetRef}" - "${maxPctMatch[1]}"의 압력조정 표 Max값을 찾을 수 없습니다(오타 의심) - 조건을 건너뜁니다.`);
        if (typeof toast === 'function') toast(`조건 설정 오류: "${maxPctMatch[1]}"를 압력조정 표에서 찾을 수 없습니다(오타 확인 필요)`, 'err');
        return null;
      }
      target = Number(targetCalRow.maxValue) * (Number(maxPctMatch[2]) / 100);
    } else {
      const { configRow } = subSeqFindConfigRow(targetRef, side);
      target = Number(configRow ? configRow.value : resolvedTargetRef);
      if (!Number.isFinite(target)) {
        console.warn(`[서브시퀀스] "${resolvedTargetRef}"를 CONFIG 탭 설정명/id로도, 숫자로도 해석하지 못했습니다(오타 의심) - 조건을 건너뜁니다.`);
        if (typeof toast === 'function') toast(`조건 설정 오류: "${resolvedTargetRef}"를 CONFIG에서 찾을 수 없습니다(오타 확인 필요)`, 'err');
        return null;
      }
    }
    return subSeqCompare(liveValue, op, target);
  }

  // ":CAPOFFSET" 접미사(예: "VT_{side}:CAPOFFSET") - 이 Step의 Cycle 열 CAPTURE:<태그>로
  // 최초 진입 시 저장해 둔 "초기값"(subSeqApplyCapture, rt.captureValues)에 비교대상(CONFIG)
  // 값을 더한 것을 목표값으로 삼아 실시간 값과 비교한다(누출시험 패턴 - 초기값 대비 이만큼
  // 이상 벗어나면 이상). :OFFSET(압력조정 캘리브레이션 기반)과 자매 문법이지만 대상이
  // "이번 실행에서 캡처한 값"이라는 점이 다르다.
  const capOffsetMatch = /^(.*):CAPOFFSET$/i.exec(resolvedTag);
  if (capOffsetMatch) {
    const baseTag = capOffsetMatch[1];
    const rtc = subSeqRunStates[ns];
    const capturedInitial = rtc && rtc.captureValues ? Number(rtc.captureValues[baseTag]) : NaN;
    if (!Number.isFinite(capturedInitial)) return isOptional ? 'skip' : null;
    const liveValue = Number(lastPtByTag[baseTag]);
    if (!Number.isFinite(liveValue)) return isOptional ? 'skip' : null;
    // 비교대상 앞에 "-"를 붙이면(예: "-가압 시험-압력 변동 기준_{side}") CONFIG 값을 뺀
    // 목표값(초기값-허용변동)을 만든다 - 압력이 초기값보다 "얼마나 내려가면" 이상인지
    // 판정할 때 쓴다(VT 누출시험의 "초기값+허용증가"와 반대 방향, 가압시험 FAIL 판정용).
    const negateOffset = /^-/.test(String(targetRef).trim());
    const rawTargetRef = negateOffset ? String(targetRef).trim().slice(1) : targetRef;
    const { configRow, resolvedTargetRef } = subSeqFindConfigRow(rawTargetRef, side);
    const rawOffset = Number(configRow ? configRow.value : resolvedTargetRef);
    if (!Number.isFinite(rawOffset)) {
      console.warn(`[서브시퀀스] "${resolvedTargetRef}"를 CONFIG 탭 설정명/id로도, 숫자로도 해석하지 못했습니다(오타 의심) - "${resolvedTag}" 조건을 건너뜁니다.`);
      if (typeof toast === 'function') toast(`조건 설정 오류: "${resolvedTargetRef}"를 CONFIG에서 찾을 수 없습니다(오타 확인 필요)`, 'err');
      return null;
    }
    const offset = negateOffset ? -rawOffset : rawOffset;
    const target = capturedInitial + offset;
    subSeqSetSettingValue(ns, target);
    return subSeqCompare(liveValue, op, target);
  }

  if (resolvedTag !== '진행횟수' && SUB_SEQ_BIT_OPS.has(normalizedOp)) {
    if (SUB_SEQ_OPTION_TAGS[resolvedTag]) {
      const optionOn = SUB_SEQ_OPTION_TAGS[resolvedTag]() === true;
      return normalizedOp === 'ON' ? optionOn : !optionOn;
    }
    const bitState = lastValueByTag[resolvedTag];
    if (!bitState || typeof bitState.fb !== 'boolean') return isOptional ? 'skip' : null;
    return normalizedOp === 'ON' ? bitState.fb === true : bitState.fb === false;
  }
  // "진행횟수"는 실제 센서가 아니라 이 실행의 Cycle 반복 진행 횟수(subSeqRunStates[ns].cycleCurrent)를
  // 가리키는 예약어다. 그 외에는 지금까지처럼 실시간 PT 값을 쓴다.
  const rt = subSeqRunStates[ns];
  // "진행횟수"를 평가하는 지금 이 순간이 "반복 한 번이 막 끝난 시점"이다 - 이번 반복에서
  // 처음 참조될 때 딱 한 번만 카운트를 올리고(같은 반복 안에서 7A→7B처럼 "진행횟수"를 또
  // 참조해도 중복으로 세지 않는다 - cycleCountedThisIteration 플래그), 그 값으로 곧바로
  // 비교한다. 실제로 이 반복을 계속할지(=한 번 더 돌지)는 "지금까지 완료한 반복이
  // 설정횟수에 못 미치는가"로 판단해야 하므로, 반복이 끝나고 나서 세는 게 아니라 끝나는
  // 그 순간(비교 직전)에 세야 한다 - 예전엔 "계속할지" 판단 후에 세서 실제로는 설정
  // 횟수보다 한 번 더 돌고 나서야 멈췄다(사용자 지적 - 밸브가 3번 도는데 설정은 2회).
  // 한 시퀀스 안에 서로 다른 '진행횟수' 반복구간이 여러 개 있을 수 있다(예: ExchL_v1.json
  // 6A "감압 안정화 시간[분]" 구간 다음에 7A "감압 시간[분]" 구간이 이어짐). 카운트를 세는
  // Step 번호가 이전과 달라졌다면(=새 반복구간에 처음 들어왔다면) 누적치와 목표값을 새로
  // 시작한다 - 안 그러면 두 번째 구간이 첫 번째 구간의 누적 횟수를 그대로 이어받아 설정
  // 횟수보다 일찍(또는 늦게) 끝나 버린다. 반복구간이 하나뿐인 시퀀스(Pumping, 2차측 Purge
  // 등)에서는 이 조건이 실행 중 딱 한 번(null -> 그 Step)만 참이 되므로 기존 동작과 동일하다.
  if (resolvedTag === '진행횟수' && rt && rt.cycleCheckStepIndex !== rt.stepIndex) {
    // 직전 반복 검사 스텝(7A 등)에서 정지 스텝(7B 등)으로 넘어온 경우(동일 targetRef이거나
    // alarmGoto가 없는 정지 스텝인 경우)에는 cycleCurrent를 0으로 리셋하지 않고 유지한다.
    const steps = rt.data && rt.data.steps ? rt.data.steps : [];
    const prevStep = rt.cycleCheckStepIndex != null ? steps[rt.cycleCheckStepIndex] : null;
    const currentStep = steps[rt.stepIndex] || {};
    const isStopTriggerTransition = prevStep && (
      String(prevStep.conditionValue || '').trim() === String(targetRef || '').trim() ||
      (!currentStep.alarmGoto && String(currentStep.alarmSeq || '').trim() !== '')
    );
    if (!isStopTriggerTransition) {
      rt.cycleCurrent = 0;
      rt.cycleCountedThisIteration = false;
      rt.cycleTarget = null;
    }
    rt.cycleCheckStepIndex = rt.stepIndex;
  }
  if (resolvedTag === '진행횟수' && rt && !rt.cycleCountedThisIteration) {
    rt.cycleCurrent += 1;
    rt.cycleCountedThisIteration = true;
    subSeqRenderCycleStatus(ns);
  }
  const liveValue = resolvedTag === '진행횟수'
    ? (rt ? Number(rt.cycleCurrent) : NaN)
    : Number(lastPtByTag[resolvedTag]);
  if (!Number.isFinite(liveValue)) return isOptional ? 'skip' : null;
  const { configRow, resolvedTargetRef } = subSeqFindConfigRow(targetRef, side);
  const target = Number(configRow ? configRow.value : resolvedTargetRef);
  if (!Number.isFinite(target)) {
    console.warn(`[서브시퀀스] "${resolvedTargetRef}"를 CONFIG 탭 설정명/id로도, 숫자로도 해석하지 못했습니다(오타 의심) - "${resolvedTag}" 조건을 건너뜁니다.`);
    if (typeof toast === 'function') toast(`조건 설정 오류: "${resolvedTargetRef}"를 CONFIG에서 찾을 수 없습니다(오타 확인 필요)`, 'err');
    return null;
  }
  if (resolvedTag === '진행횟수' && rt && rt.cycleTarget == null) {
    rt.cycleTarget = target;
    subSeqRenderCycleStatus(ns);
  }
  if (resolvedTag !== '진행횟수') subSeqSetSettingValue(ns, target);
  return subSeqCompare(liveValue, op, target);
}

/** Step의 조건(Alarm Monitoring 태그 + 비교연산자 + 비교대상)을 CONFIG 값과 비교한다.
    한 Step에서 여러 값을 동시에 확인해야 하면 세 열 전부 "&"로 구분해서 같은 순서로 여러
    개를 적는다. 전부 참이어야(AND) 정상 진행하고, 하나라도 거짓이면 그 즉시 거짓으로
    판단한다. 셋 중 하나라도 비어있거나, 세 열의 "&" 개수가 서로 안 맞거나, 어느 조건이든
    값을 아직 모르면 "조건 없음"(null)으로 보고 평소처럼 다음 Step으로 진행한다(하위호환). */
function subSeqEvalCondition(ns, step, side) {
  if (!step.alarmMonitoring || !step.conditionOp || !step.conditionValue) return null;
  const tags = String(step.alarmMonitoring).split('&').map((s) => s.trim()).filter(Boolean);
  const ops = String(step.conditionOp).split('&').map((s) => s.trim()).filter(Boolean);
  const targets = String(step.conditionValue).split('&').map((s) => s.trim()).filter(Boolean);
  if (tags.length === 0 || tags.length !== ops.length || tags.length !== targets.length) {
    console.warn(`[서브시퀀스] Step ${step.no}: Alarm Monitoring(${tags.length}개)/비교연산자(${ops.length}개)/설정명(비교대상ID)(${targets.length}개)의 "&" 개수가 서로 안 맞습니다 - 조건을 건너뜁니다.`);
    if (typeof toast === 'function') toast(`Step ${step.no} 조건 설정 오류: 태그/연산자/대상 개수가 안 맞습니다(&로 구분한 개수 확인 필요)`, 'err');
    return null;
  }
  let evaluatedCount = 0;
  for (let i = 0; i < tags.length; i++) {
    const result = subSeqEvalOneCondition(ns, tags[i], ops[i], targets[i], side);
    if (result === 'skip') continue;
    if (result === null) return null;
    evaluatedCount++;
    if (!result) return false;
  }
  return evaluatedCount > 0 ? true : null;
}

/** subSeqEvalCondition이 거짓을 돌려준 뒤, 실제로 어느 태그(들)가 거짓이었는지 다시 훑어서
    돌려준다(알람 메시지에 원인 PT 이름을 함께 표기하기 위함). */
function subSeqCollectFailedTags(ns, step, side) {
  if (!step.alarmMonitoring || !step.conditionOp || !step.conditionValue) return [];
  const tags = String(step.alarmMonitoring).split('&').map((s) => s.trim()).filter(Boolean);
  const ops = String(step.conditionOp).split('&').map((s) => s.trim()).filter(Boolean);
  const targets = String(step.conditionValue).split('&').map((s) => s.trim()).filter(Boolean);
  if (tags.length === 0 || tags.length !== ops.length || tags.length !== targets.length) return [];
  const failed = [];
  for (let i = 0; i < tags.length; i++) {
    const result = subSeqEvalOneCondition(ns, tags[i], ops[i], targets[i], side);
    if (result === false) {
      const displayTag = subSeqResolveTag(tags[i], side).trim().replace(/:OFFSET$/i, '');
      failed.push(displayTag);
    }
  }
  return failed;
}

const SUB_SEQ_TRUTHY = new Set(['Y', 'YES', '예', 'O', '1', 'TRUE', 'ON']);

/** "조기통과" 열이 Y/예/O 등으로 켜져 있는지 - 켜져 있으면 Time(Sec) 대기 중 매초 조건을
    다시 확인해서 참이 되는 즉시(남은 시간을 기다리지 않고) 다음 Step으로 넘어간다. */
function subSeqIsEarlyPassEnabled(step) {
  return SUB_SEQ_TRUTHY.has(String(step.earlyPass || '').trim().toUpperCase());
}

function subSeqNextIndex(step, steps, currentIndex) {
  if (step.ackGoto) {
    const found = subSeqFindStepIndexByNo(steps, step.ackGoto);
    if (found !== -1) return found;
  }
  return currentIndex + 1;
}

/** step.nextStep(엑셀 "Next Step" 열)이 채워져 있고 실제로 존재하는 Step No를 가리키면 그
    인덱스를 돌려주고, 없으면(빈 값/못 찾음) null을 돌려준다 - 호출부가 null이면 평소처럼
    subSeqNextIndex로 진행한다(하위호환). */
function subSeqResolveNextStepIndex(step, steps) {
  if (!step.nextStep) return null;
  const idx = subSeqFindStepIndexByNo(steps, step.nextStep);
  if (idx === -1) {
    console.warn(`[서브시퀀스] Step ${step.no}: Next Step "${step.nextStep}"을 찾을 수 없습니다 - 평소처럼 다음 Step으로 진행합니다.`);
    if (typeof toast === 'function') toast(`Step ${step.no} 설정 오류: Next Step "${step.nextStep}"을 찾을 수 없습니다`, 'err');
    return null;
  }
  return idx;
}

/** Step의 alarmMonitoring이 예약 태그 "진행횟수"를 포함하는지 - 포함하면 이 Step은 Cycle
    반복 진행 횟수(subSeqRunStates[ns].cycleCurrent)를 세는 반복문의 끝점이라는 뜻이라, 조건이
    거짓(=아직 설정 횟수에 못 미침)으로 판정돼 되돌아갈 때마다 진행 횟수를 1 늘린다. */
function subSeqUsesCycleCounter(step) {
  return String(step.alarmMonitoring || '').split('&').map((s) => s.trim()).includes('진행횟수');
}

function subSeqRenderCycleStatus(ns) {
  const wrapEl = el(ns, 'cycleInfo');
  if (!wrapEl) return;
  const rt = subSeqRunStates[ns];
  if (!rt || rt.cycleTarget == null) {
    wrapEl.style.display = 'none';
    return;
  }
  wrapEl.style.display = '';
  const targetEl = el(ns, 'cycleTarget');
  const curEl = el(ns, 'cycleCurrent');
  if (targetEl) targetEl.textContent = String(rt.cycleTarget);
  if (curEl) {
    if (SUBSEQ_NS[ns].cycleCurrentAsTime) {
      // rt.cycleIterElapsedSec는 Cycle열이 "CAPTURE:<태그>"인 Step(대기 Step)에서만 초 단위로 흐르고,
      // 그 외 판정/완료 Step(7A, 7B 등)에서는 완료된 분(rt.cycleCurrent * 60)만 정확히 표시한다.
      const currentStep = rt.data && rt.data.steps ? rt.data.steps[rt.stepIndex] : null;
      const isCap = currentStep && /^CAPTURE:/i.test(String(currentStep.cycle || '').trim());
      const extraSec = isCap ? (rt.cycleIterElapsedSec || 0) : 0;
      curEl.textContent = subSeqFormatCycleAsTime(null, rt.cycleCurrent * 60 + extraSec);
    } else {
      curEl.textContent = String(rt.cycleCurrent);
    }
  }
}

function subSeqFinish(ns) {
  toast('서브시퀀스가 완료되었습니다.', 'ok');
  subSeqClearTimer(ns);
  subSeqStopMasterTimer(ns);
  subSeqPendingResumes[ns] = null; // 정상 완료 - 이어서 재개할 지점 없음
  const rt = subSeqRunStates[ns];
  const side = rt ? rt.side : progressCurrentSide;
  // 예전엔 여기서 runState를 바로 비우고 idle 화면으로 되돌렸는데, 그러면 마지막 Step
  // 화면이 순간적으로 사라지고 "실행" 대기 화면으로 돌아가 버렸다(요청사항: "정상적으로
  // 마무리 되었으면 그 자리에 있어야 한다"). running만 false로 바꿔 패널은 마지막 Step
  // 그대로 띄워둔다. 다음 "실행"은 subSeqPendingResumes[ns]가 비어있으므로 항상 Step 1부터
  // 새로 시작한다.
  if (rt) rt.running = false;
  const timerEl = el(ns, 'timer');
  if (timerEl) timerEl.textContent = '완료';
  const ackBtn = el(ns, 'ackBtn');
  if (ackBtn) { ackBtn.style.display = 'none'; ackBtn.disabled = false; }
  const pauseBtn = el(ns, 'pauseBtn');
  if (pauseBtn) { pauseBtn.style.display = 'none'; pauseBtn.textContent = '일시정지'; }
  if (rt) rt.paused = false;
  const cfg = SUBSEQ_NS[ns];
  if (cfg.finishStopLabel) {
    // 조정모드: 완료 후엔 "중지"가 아니라 "PT 영점조정 완료"로 - 눌러야 하는 동작(idle로
    // 복귀)은 stopNamespacedSubSequenceRunner로 동일하지만, 문구는 "그만두는 것"이 아니라
    // "다 됐다"는 확인이므로. 다음 실행 시작 시 다시 원래 라벨로 되돌린다.
    const stopBtn = el(ns, 'stopBtn');
    if (stopBtn) stopBtn.textContent = cfg.finishStopLabel;
  }
  const cb = subSeqCallbacks[ns];
  if (cb && typeof cb.onFinish === 'function') cb.onFinish(side);
}

function subSeqRunStepAt(ns, index) {
  const rt = subSeqRunStates[ns];
  if (!rt || !rt.running) return;
  subSeqClearTimer(ns);
  const { data, side } = rt;
  const steps = data.steps || [];
  if (index < 0 || index >= steps.length) {
    subSeqFinish(ns);
    return;
  }
  rt.stepIndex = index;
  const step = steps[index];
  const diffLabels = subSeqApplyValves(step, side, rt.valveOpenState);
  subSeqApplyAutoZero(step, side); // "ZERO" Step이면 즉시 Offset 자동 반영
  subSeqApplyCapture(ns, step, side); // Cycle열 "CAPTURE:<태그>"면 최초 1회 초기값 저장 + 현재값 갱신
  subSeqRenderStep(ns, step, diffLabels, side);
  subSeqLogStep(ns, step, rt, step.advance === 'ack' ? '확인대기' : '자동진행', diffLabels);

  const timerEl = el(ns, 'timer');
  if (step.advance === 'ack') {
    if (timerEl) timerEl.textContent = '작업자 확인 대기 중';
    return; // ackBtn 클릭이 다음 Step으로 넘긴다
  }

  const totalSec = Number(step.timeSec);
  if (!Number.isFinite(totalSec) || totalSec <= 0) {
    subSeqRunStepAt(ns, subSeqNextIndex(step, steps, index));
    return;
  }
  subSeqStartStepCountdown(ns, index, totalSec);
}

/** Step 카운트다운 인터벌을 (다시) 시작한다 - subSeqRunStepAt이 새 Step을 시작할 때와,
    subSeqTogglePause가 일시정지를 풀고 남은 시간(remaining)부터 이어갈 때 둘 다 이 함수를
    쓴다(테스트용 일시정지 - 사용자 요청 "각 HTML마다 일시정지를 추가"). step/steps는 index로
    다시 조회하므로 클로저에 따로 들고 있을 필요가 없다 - rt.stepRemainingSec에 매 tick마다
    최신 remaining을 반영해 두면, 일시정지 시 그 값만 그대로 읽어 재개할 수 있다. */
function subSeqStartStepCountdown(ns, index, remaining) {
  const rt = subSeqRunStates[ns];
  if (!rt || !rt.running) return;
  const { data, side } = rt;
  const steps = data.steps || [];
  const step = steps[index];
  const timerEl = el(ns, 'timer');
  rt.stepRemainingSec = remaining;
  if (timerEl) timerEl.textContent = `${remaining}초 후 다음 Step`;
  // "N분 SS초" 표시(cycleCurrentAsTime 네임스페이스, 예: Pumping)는 Cycle열이
  // "CAPTURE:<태그>"인 Step(재사용 가능한 "분 단위 대기" Step - 진행횟수를 세는 Step과
  // 물리적으로 같은 Step일 필요는 없다, Pumping은 Step 7이 대기+캡처, Step 7A가 진행횟수
  // 판정)의 매초 tick마다 rt.cycleIterElapsedSec를 다시 계산해야 초 단위가 실시간으로
  // 흐른다. 이 Step이 아니면 손대지 않는다(직전 반복에서 멈춘 값을 그대로 유지).
  const isCaptureStep = /^CAPTURE:/i.test(String(step.cycle || '').trim());
  const totalSec = Number(step.timeSec);
  if (SUBSEQ_NS[ns].cycleCurrentAsTime) {
    if (isCaptureStep) rt.cycleIterElapsedSec = Math.max(0, totalSec - remaining);
    subSeqRenderCycleStatus(ns);
  }

  // 1. 진입 시점(0초) 즉시 실시간 안전 조건 감시 (감압, 가압, VT, Pumping, HP&LP Pump 등 전 시퀀스 공통)
  if (step.alarmMonitoring && step.conditionOp && !subSeqUsesCycleCounter(step)) {
    if (subSeqEvalCondition(ns, step, side) === false) {
      subSeqHandleAlarm(ns, Number(step.alarmSeq) || 1, step.alarmGoto);
      return;
    }
  }

  const earlyPassEnabled = subSeqIsEarlyPassEnabled(step);
  rt.timerId = setInterval(() => {
    remaining -= 1;
    rt.stepRemainingSec = remaining;
    if (SUBSEQ_NS[ns].cycleCurrentAsTime) {
      if (isCaptureStep) rt.cycleIterElapsedSec = Math.max(0, totalSec - remaining);
      subSeqRenderCycleStatus(ns);
    }
    // 2. 매 1초마다 실시간 안전 감시 (감압, 가압, VT, Pumping 등 모든 카운트다운 스텝 중 CONFIG 변경 또는 압력 이상 즉시 감지)
    if (step.alarmMonitoring && step.conditionOp && !subSeqUsesCycleCounter(step)) {
      if (subSeqEvalCondition(ns, step, side) === false) {
        subSeqClearTimer(ns);
        subSeqHandleAlarm(ns, Number(step.alarmSeq) || 1, step.alarmGoto);
        return;
      }
    }
    if (earlyPassEnabled && subSeqEvalCondition(ns, step, side) === true) {
      subSeqClearTimer(ns);
      if (timerEl) timerEl.textContent = '조건 충족 - 조기 진행';
      const jumpIdx = subSeqResolveNextStepIndex(step, steps);
      subSeqRunStepAt(ns, jumpIdx !== null ? jumpIdx : subSeqNextIndex(step, steps, index));
      return;
    }
    if (remaining <= 0) {
      subSeqClearTimer(ns);
      if (isCaptureStep) rt.cycleIterElapsedSec = 0;
      const condResult = subSeqEvalCondition(ns, step, side);
      if (condResult === false) {
        subSeqHandleAlarm(ns, Number(step.alarmSeq) || 1, step.alarmGoto);
        return;
      }
      const jumpIdx = subSeqResolveNextStepIndex(step, steps);
      subSeqRunStepAt(ns, jumpIdx !== null ? jumpIdx : subSeqNextIndex(step, steps, index));
      return;
    }
    if (timerEl) timerEl.textContent = `${remaining}초 후 다음 Step`;
  }, 1000);
}

/** 테스트용 일시정지/재개 토글 - Step 카운트다운과 누적 경과시간 타이머를 둘 다 그 자리에서
    멈춰서(실제 Step 진행은 그대로 둔 채) 밸브/PT 상태를 여유 있게 살펴볼 수 있게 한다(사용자
    요청 - "각 HTML마다 일시정지를 추가, 테스트용으로"). pauseBtn id가 없는 네임스페이스
    (조정모드/idleCheck)는 subSeqWireOnce에서 애초에 안 불려서 이 함수 자체가 호출되지 않는다.
    확인(ack) 대기 중처럼 Step 카운트다운이 없는 상태에서도 눌러도 되게 만든다 - 그때는
    rt.timerId가 없으므로 누적시간만 멈췄다가 재개 시 다시 흐른다(Step은 원래도 확인을
    눌러야만 넘어가니 추가로 멈출 대상이 없다). */
function subSeqTogglePause(ns) {
  const rt = subSeqRunStates[ns];
  if (!rt || !rt.running) return;
  const pauseBtn = el(ns, 'pauseBtn');
  const timerEl = el(ns, 'timer');
  const ackBtn = el(ns, 'ackBtn');
  if (!rt.paused) {
    rt.wasCountingDown = !!rt.timerId;
    if (rt.timerId) subSeqClearTimer(ns);
    subSeqStopMasterTimer(ns);
    rt.paused = true;
    if (timerEl && rt.wasCountingDown) timerEl.textContent = `일시정지됨 (${rt.stepRemainingSec}초 남음)`;
    if (pauseBtn) pauseBtn.textContent = '재개';
    if (ackBtn) ackBtn.disabled = true;
  } else {
    rt.paused = false;
    subSeqStartMasterTimer(ns);
    if (rt.wasCountingDown) subSeqStartStepCountdown(ns, rt.stepIndex, rt.stepRemainingSec);
    if (pauseBtn) pauseBtn.textContent = '일시정지';
    if (ackBtn) ackBtn.disabled = false;
  }
  logWorkAction(SUBSEQ_NS[ns].pauseBtn, rt.side);
}

/** 초기화 버튼 클릭 시 - 열려있는 모든 밸브를 CLOSE하고, 진행시간/누적시간, Cycle 진행횟수/시간,
    초기값/현재값(HPT 등)을 전부 0 및 '-'으로 깨끗하게 초기화한 뒤 Step 1부터 새로 시작한다(사용자 요청). */
function subSeqResetToStart(ns) {
  const rt = subSeqRunStates[ns];
  const side = rt ? rt.side : progressCurrentSide;
  const cfg = SUBSEQ_NS[ns];
  const mainStepType = cfg.mainStepType;

  logWorkAction(cfg.resetBtn, side);

  // 1. 모든 열려있던 밸브 및 서브시퀀스 정의 밸브 전체 CLOSE
  subSeqCloseAllOpenValves(rt ? rt.valveOpenState : {}, side, rt ? rt.data : null);

  // 2. 타이머 및 러너 정지
  subSeqClearTimer(ns);
  subSeqStopMasterTimer(ns);
  subSeqPendingResumes[ns] = null;
  subSeqRestartFromStepNo[ns] = null;

  // 3. 누적시간 / 진행시간 / Cycle 진행시간·횟수 초기화
  if (rt) {
    rt.elapsedSec = 0;
    rt.cycleCurrent = 0;
    rt.cycleIterElapsedSec = 0;
    rt.captureValues = {};
    rt.captureTag = null;
    rt.paused = false;
  }

  // 4. 화면 UI 컴포넌트 전체 초기화
  const accTimeEl = el(ns, 'accTime');
  if (accTimeEl) accTimeEl.textContent = '누적 경과시간: 0초';
  const timerEl = el(ns, 'timer');
  if (timerEl) timerEl.textContent = '-';
  const initEl = el(ns, 'captureInitial');
  if (initEl) initEl.textContent = '-';
  const curEl = el(ns, 'captureCurrent');
  if (curEl) curEl.textContent = '-';
  const limitEl = el(ns, 'captureLimit');
  if (limitEl) limitEl.textContent = '-';
  const setEl = el(ns, 'settingValue');
  if (setEl) setEl.textContent = '-';
  const diffEl = el(ns, 'valveDiff');
  if (diffEl) diffEl.innerHTML = '';
  const msgEl = el(ns, 'message');
  if (msgEl) msgEl.textContent = '';
  const opEl = el(ns, 'operation');
  if (opEl) opEl.textContent = '';
  const pauseBtn = el(ns, 'pauseBtn');
  if (pauseBtn) { pauseBtn.textContent = '일시정지'; pauseBtn.style.display = ''; }

  const curCycleEl = el(ns, 'cycleCurrent');
  if (curCycleEl) curCycleEl.textContent = cfg.cycleCurrentAsTime ? '0분 00초' : '0';

  subSeqHideAlarmBanner(ns);
  subSeqSetLastAlarm(ns, '');
  subSeqRenderCycleStatus(ns);

  toast('초기화 완료 - 모든 밸브 CLOSE 및 표시값 초기화', 'ok');

  // 5. Step 1부터 새로 시작
  subSeqRunStates[ns] = null;
  window.startNamespacedSubSequenceRunner(ns, mainStepType, side, subSeqCallbacks[ns]);
}

/** Alarm Seq. 코드별 대응 - 1: 서브시퀀스 초기화(중지와 동일하게 완전히 리셋), 2: 지금
    Step을 기억해두고 대기 - 다음에 같은 Main Step을 "실행"하면 그 Step부터 이어서 진행,
    3: SHUTDOWN급 알람 - 완전히 초기화하고 메인 화면으로 이동.

    gotoStepNo(엑셀 "Alarm Goto" 열)가 채워져 있고 실제 존재하는 Step이면, 코드 1/2/3의
    원래 동작 대신 밸브 상태·누적시간·Cycle 진행 상태를 그대로 둔 채 그 Step으로 즉시
    이동만 하는 "가벼운 GOTO"를 수행한다(반복문 등 "정상적인 분기"에도 Alarm Seq. 열을
    재사용하되, 매번 밸브가 리셋되면 안 되므로). gotoStepNo가 비어 있거나 못 찾으면
    지금까지와 동일하게 code별 동작을 그대로 수행한다(하위호환).

    "에러 사항" 화면(보조 메뉴) 기록도 여기서 겸한다 - Alarm Goto로 가볍게 이동하지 않고 실제
    코드 1/2/3 동작을 수행할 때, 그 Step의 Alarm Seq.(엑셀 AE열)이 실제로 채워져 있는 경우에만
    /api/gms/errorlog에 남긴다(반복문/Step 점프는 알람이 아니므로 제외). */
function subSeqHandleAlarm(ns, code, gotoStepNo) {
  const rt = subSeqRunStates[ns];
  if (!rt) return;
  const { mainStepType, subSeqId, side, stepIndex, data, valveOpenState, elapsedSec, cycleTarget, cycleCurrent, cycleCheckStepIndex } = rt;
  const steps = data.steps || [];
  const step = steps[stepIndex];
  const cfg = SUBSEQ_NS[ns];
  const gotoIdx = gotoStepNo ? subSeqFindStepIndexByNo(steps, gotoStepNo) : -1;
  if (gotoStepNo && gotoIdx === -1) {
    console.warn(`[서브시퀀스] Step ${step ? step.no : '-'}: Alarm Goto "${gotoStepNo}"를 찾을 수 없습니다 - 평소 Alarm Seq. ${code} 동작으로 대체합니다.`);
    if (typeof toast === 'function') toast(`Step ${step ? step.no : '-'} 설정 오류: Alarm Goto "${gotoStepNo}"를 찾을 수 없습니다`, 'err');
  }
  logWorkAction(cfg.alarmTestBtn || `subSeqAlarm_${ns}`, side);
  fetch('/api/gms/worklog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      unitId: selectedUnitId,
      action: `subSeqAlarm_${mainStepType}`,
      side: side || null,
      detail: gotoIdx !== -1
        ? `조건 불충족 - Step ${gotoStepNo}로 이동 (Step ${step ? step.no : '-'}, 누적 ${elapsedSec}초)`
        : `Alarm Seq. ${code} 발생 (Step ${step ? step.no : '-'}, 누적 ${elapsedSec}초)`,
      operatorName: currentGmsOperator ? currentGmsOperator.name : null,
      operatorRole: currentGmsOperator ? currentGmsOperator.role : null,
      analogSnapshot: { ...lastPtByTag },
      screenKey: cfg.screenKey,
      screenTitle: progressHeader ? progressHeader.textContent : '',
      statusLabel: '',
      buttonLabel: gotoIdx !== -1 ? `"조건 불충족 - Step ${gotoStepNo}로 이동"` : `"알람 발생(TEST) - Alarm Seq. ${code}"`,
      subSeqId,
      subSeqStepNo: step ? String(step.no) : null,
      subSeqElapsedSec: elapsedSec,
    }),
  }).catch(() => { /* 이력 기록 실패가 처리를 막으면 안 됨 */ });

  if (gotoIdx !== -1) {
    subSeqClearTimer(ns); // 이 Step의 카운트다운만 정리 - 마스터 타이머/밸브/Cycle 상태는 그대로 유지
    // 진행횟수 카운트 자체는 subSeqEvalOneCondition에서 조건을 평가하는 순간(반복이 막
    // 끝난 시점)에 이미 늘어났다 - 여기서는 "다음 반복이 새로 시작된다"는 뜻으로 플래그만
    // 되돌려서, 다음 번 "진행횟수"를 참조할 때 그 반복분을 새로 셀 수 있게 한다.
    if (subSeqUsesCycleCounter(step) && rt) {
      rt.cycleCountedThisIteration = false;
      rt.cycleIterElapsedSec = 0; // 새 반복 시작 - "N분 SS초" 표시도 이번 분의 초를 0부터 다시 센다
    }
    toast(`Step ${step ? step.no : '-'} 조건 불충족 - Step ${gotoStepNo}로 이동합니다.`, '');
    subSeqRunStepAt(ns, gotoIdx);
    return;
  }

  const hasAlarmSeqInExcel = step && step.alarmSeq !== undefined && step.alarmSeq !== null && String(step.alarmSeq).trim() !== '';
  let lastAlarmText = '';
  if (hasAlarmSeqInExcel) {
    const failedTags = subSeqCollectFailedTags(ns, step, side);
    const alarmMessageWithTags = failedTags.length
      ? `${step.alarmMessage || ''} (${failedTags.join(', ')})`.trim()
      : (step.alarmMessage || '');
    lastAlarmText = alarmMessageWithTags;
    fetch('/api/gms/errorlog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitId: selectedUnitId,
        side: side || null,
        mainStepType,
        subSeqId,
        subSeqStepNo: step ? String(step.no) : null,
        subSeqElapsedSec: elapsedSec,
        alarmSeqCode: code,
        alarmMessage: alarmMessageWithTags,
        operatorName: currentGmsOperator ? currentGmsOperator.name : null,
        operatorRole: currentGmsOperator ? currentGmsOperator.role : null,
        analogSnapshot: { ...lastPtByTag },
        screenKey: cfg.screenKey,
        screenTitle: progressHeader ? progressHeader.textContent : '',
      }),
    }).catch(() => { /* 이력 기록 실패가 알람 처리 자체를 막으면 안 됨 */ });
  }

  subSeqClearTimer(ns);
  subSeqStopMasterTimer(ns);

  // idle로 돌아간 뒤에도 운영자가 "왜 멈췄는지" 확인할 수 있도록 idle 화면에 남겨둔다
  // (사용자 지적 - 예전엔 토스트만 잠깐 뜨고 사라져서 알람 내용을 놓치면 확인할 방법이
  // 없었다). "실행"을 다시 누르면(subSeqWireOnce의 executeBtn 핸들러) 지워진다.
  const nowLabel = new Date().toLocaleTimeString('ko-KR', { hour12: false });
  subSeqSetLastAlarm(ns, `[${nowLabel}] Step ${step ? step.no : '-'}: ${lastAlarmText || '알람 발생'} (Alarm Seq. ${code})`);
  subSeqSetIdleCycleInfo(ns, cycleTarget, cycleCurrent);

  if (code === 2) {
    subSeqPendingResumes[ns] = { mainStepType, side, stepIndex, valveOpenState: { ...valveOpenState }, elapsedSec, cycleTarget, cycleCurrent, cycleCheckStepIndex };
    toast(`알람 발생 - Step ${step ? step.no : '-'}에서 정지. "실행"을 다시 누르면 이어서 진행합니다.`, 'err');
  } else {
    subSeqPendingResumes[ns] = null;
    const closedTags = subSeqCloseAllOpenValves(valveOpenState, side, data);
    const closeNote = closedTags.length ? ` (밸브 ${closedTags.length}개 CLOSE)` : '';
    toast((code === 3 ? 'SHUTDOWN 알람 - 초기화 후 메인 화면으로 이동합니다.' : '알람 발생 - 서브시퀀스를 초기화합니다.') + closeNote, 'err');
    // Alarm Seq. 1(초기화)은 밸브를 방금 전부 CLOSE했으므로, 다음 "실행"은 보통 밸브
    // 초기화인 Step 1을 건너뛰고 Step 2부터 시작한다(사용자 요청). SHUTDOWN(code 3)은
    // 메인 화면으로 나가 전체 흐름을 다시 밟아야 하므로 대상에서 제외(Step 1부터).
    if (code === 1) subSeqRestartFromStepNo[ns] = data.steps[1] ? data.steps[1].no : null;
  }

  subSeqRunStates[ns] = null;

  // 알람이 나도 화면(idle) 전환 없이 지금 보던 패널을 그대로 두고 배너만 추가로 띄운다
  // (사용자 요청 - "화면 변경없이 기존 화면에 알람 메세지만 추가로 띄어 주시고, 확인을
  // 누르면 시퀀스 다시 재진행"). SHUTDOWN(code 3)은 원래도 메인 화면으로 나가야 하므로
  // 예외적으로 기존 idle 전환 그대로 둔다(패널에 배너를 띄워봐야 곧장 화면을 떠나므로 의미
  // 없음). panelAlarmBanner가 없는 네임스페이스(조정모드/idleCheck)는 기존 동작 그대로.
  if (code !== 3 && cfg.panelAlarmBanner) {
    subSeqShowAlarmBanner(ns, `Step ${step ? step.no : '-'}: ${lastAlarmText || '알람 발생'} (Alarm Seq. ${code})`);
  } else {
    subSeqSetPanelVisible(ns, false);
  }

  if (code === 3) showProgressMainMenu(side);
}

function subSeqGetDefaultCallbacks(ns) {
  const side = (typeof progressCurrentSide !== 'undefined' && progressCurrentSide) || 'A';
  if (ns === 'puls') {
    return {
      onFinish: (finishedSide) => {
        if (typeof window.advanceOnePChain === 'function') window.advanceOnePChain(null, finishedSide || side);
        else if (typeof window.advanceToNextEnabledStatus === 'function') window.advanceToNextEnabledStatus(finishedSide || side);
      },
      onCancel: () => {
        if (typeof window.cancelPreCcToPassword === 'function') window.cancelPreCcToPassword();
        else {
          if (typeof resetCylinderStepStatus === 'function') resetCylinderStepStatus(side);
          if (typeof showProgressMainMenu === 'function') showProgressMainMenu(side);
        }
      }
    };
  }
  if (ns === 'oneP') {
    return {
      onFinish: (finishedSide) => {
        if (typeof window.advanceOnePChain === 'function') window.advanceOnePChain('onePAutoRun', finishedSide || side);
        else if (typeof window.advanceToNextEnabledStatus === 'function') window.advanceToNextEnabledStatus(finishedSide || side);
      },
      onCancel: () => {
        if (typeof window.cancelPreCcToPassword === 'function') window.cancelPreCcToPassword();
        else {
          if (typeof resetCylinderStepStatus === 'function') resetCylinderStepStatus(side);
          if (typeof showProgressMainMenu === 'function') showProgressMainMenu(side);
        }
      }
    };
  }
  if (ns === 'onePPurge') {
    return {
      onFinish: (finishedSide) => {
        if (typeof window.advanceOnePChain === 'function') window.advanceOnePChain('onePPurgeAutoRun', finishedSide || side);
        else if (typeof window.advanceToNextEnabledStatus === 'function') window.advanceToNextEnabledStatus(finishedSide || side);
      },
      onCancel: () => {
        if (typeof window.cancelPreCcToPassword === 'function') window.cancelPreCcToPassword();
        else {
          if (typeof resetCylinderStepStatus === 'function') resetCylinderStepStatus(side);
          if (typeof showProgressMainMenu === 'function') showProgressMainMenu(side);
        }
      }
    };
  }
  if (ns === 'onePPumping') {
    return {
      onFinish: (finishedSide) => {
        if (typeof window.advanceOnePChain === 'function') window.advanceOnePChain('onePPumpingAutoRun', finishedSide || side);
        else if (typeof window.advanceToNextEnabledStatus === 'function') window.advanceToNextEnabledStatus(finishedSide || side);
      },
      onCancel: () => {
        if (typeof window.cancelPreCcToPassword === 'function') window.cancelPreCcToPassword();
        else {
          if (typeof resetCylinderStepStatus === 'function') resetCylinderStepStatus(side);
          if (typeof showProgressMainMenu === 'function') showProgressMainMenu(side);
        }
      }
    };
  }
  if (ns === 'onePPrimaryPurge') {
    return {
      onFinish: (finishedSide) => {
        if (typeof window.advanceOnePChain === 'function') window.advanceOnePChain('onePPrimaryPurgeAutoRun', finishedSide || side);
        else if (typeof window.advanceToNextEnabledStatus === 'function') window.advanceToNextEnabledStatus(finishedSide || side);
      },
      onCancel: () => {
        if (typeof window.cancelPreCcToPassword === 'function') window.cancelPreCcToPassword();
        else {
          if (typeof resetCylinderStepStatus === 'function') resetCylinderStepStatus(side);
          if (typeof showProgressMainMenu === 'function') showProgressMainMenu(side);
        }
      }
    };
  }
  if (ns === 'exchangePressureTest' || ns === 'vtTest') {
    return {
      onFinish: (finishedSide) => {
        const s = finishedSide || side;
        if (typeof markStepComplete === 'function' && typeof cylinderCurrentStepIndex !== 'undefined') markStepComplete(s, cylinderCurrentStepIndex[s]);
        if (typeof advanceToNextEnabledStatus === 'function') advanceToNextEnabledStatus(s);
      },
      onCancel: () => {
        if (typeof window.cancelPreCcToPassword === 'function') window.cancelPreCcToPassword();
        else {
          if (typeof resetCylinderStepStatus === 'function') resetCylinderStepStatus(side);
          if (typeof showProgressMainMenu === 'function') showProgressMainMenu(side);
        }
      }
    };
  }
  if (ns === 'twoP') {
    return {
      onFinish: () => {
        if (typeof proceedPastPasswordGate === 'function' && window.advanceCylinderExchangeDone) {
          proceedPastPasswordGate('cylinderExchangeDone', window.advanceCylinderExchangeDone);
        } else if (typeof advanceToNextEnabledStatus === 'function') {
          advanceToNextEnabledStatus(side);
        }
      },
      onCancel: () => {
        if (typeof window.cancelPreCcToPassword === 'function') window.cancelPreCcToPassword();
        else {
          if (typeof resetCylinderStepStatus === 'function') resetCylinderStepStatus(side);
          if (typeof showProgressMainMenu === 'function') showProgressMainMenu(side);
        }
      }
    };
  }
  if (ns === 'bypass' || ns === 'afterThreeP' || ns === 'afterPlusL' || ns === 'afterPuls' || ns === 'afterVtTest' || ns === 'afterFourP') {
    return {
      onFinish: (finishedSide) => {
        const s = finishedSide || side;
        if (ns === 'afterFourP') {
          if (typeof proceedPastPasswordGate === 'function' && window.advanceExchangeFourthPurgeDone) {
            proceedPastPasswordGate('exchangeFourthPurgeDone', window.advanceExchangeFourthPurgeDone);
            return;
          }
        }
        if (typeof markStepComplete === 'function' && typeof cylinderCurrentStepIndex !== 'undefined') markStepComplete(s, cylinderCurrentStepIndex[s]);
        if (typeof advanceToNextEnabledStatus === 'function') advanceToNextEnabledStatus(s);
      },
      onCancel: () => {
        if (typeof window.cancelExchangeAfterToPassword === 'function') {
          window.cancelExchangeAfterToPassword(SUBSEQ_NS[ns].screenKey);
        } else if (typeof showProgressCylExchangePurgeStep === 'function') {
          showProgressCylExchangePurgeStep(CYL_EXCHANGE_PURGE_STEPS.findIndex((step) => step.key === 'cylReplaceCheck'));
        }
      }
    };
  }
  if (ns === 'hpLpPump') {
    return {
      onFinish: (finishedSide) => {
        const s = finishedSide || side;
        if (typeof markStepComplete === 'function' && typeof cylinderCurrentStepIndex !== 'undefined') markStepComplete(s, cylinderCurrentStepIndex[s]);
        if (typeof advanceToNextEnabledStatus === 'function') advanceToNextEnabledStatus(s);
      },
      onCancel: () => {
        if (typeof cancelPostPcToPassword === 'function') cancelPostPcToPassword('hpLpPump');
        else if (typeof cancelGasSupply === 'function') cancelGasSupply();
      }
    };
  }
  if (ns === 'idleCheck') {
    return {
      onFinish: () => {
        if (typeof showProgressCylExchangePurgeStep === 'function' && typeof CYL_EXCHANGE_PURGE_STEPS !== 'undefined') {
          showProgressCylExchangePurgeStep(CYL_EXCHANGE_PURGE_STEPS.findIndex((s) => s.key === 'pulsAutoRun'));
        }
      },
      onCancel: () => {
        if (typeof window.cancelPreCcToPassword === 'function') window.cancelPreCcToPassword();
        else if (typeof advanceCylinderLockCheckExit === 'function') advanceCylinderLockCheckExit();
      }
    };
  }
  if (ns === 'adjustMode') {
    return {
      onFinish: () => {
        if (typeof exitAdjustMode === 'function') exitAdjustMode();
      },
      onCancel: () => {
        if (typeof exitAdjustMode === 'function') exitAdjustMode();
      }
    };
  }
  return {
    onFinish: (finishedSide) => { if (typeof advanceToNextEnabledStatus === 'function') advanceToNextEnabledStatus(finishedSide || side); },
    onCancel: (cancelledSide) => { if (typeof showProgressMainMenu === 'function') showProgressMainMenu(cancelledSide || side); }
  };
}

// 이 화면의 마크업은 Operation.js의 loadOperationScreens()가 페이지 로드 후 fetch로 늦게
// 주입한다 - 이 스크립트가 로드되는 시점엔 아직 DOM에 없을 수 있어 top-level에서 바로
// wiring하면 안 된다. 대신 시작/정지 함수가 호출될 때(=이미 주입 완료된 뒤) 매번 호출하되
// dataset.wired로 중복 바인딩을 막는다.
function subSeqWireOnce(ns) {
  const cfg = SUBSEQ_NS[ns];
  if (!cfg) return;
  const ackBtn = el(ns, 'ackBtn');
  const stopBtn = el(ns, 'stopBtn');
  if (stopBtn && !stopBtn.dataset.wired) {
    stopBtn.dataset.wired = '1';
    stopBtn.addEventListener('click', () => {
      const rt = subSeqRunStates[ns];
      const side = rt ? rt.side : ((typeof progressCurrentSide !== 'undefined' && progressCurrentSide) || 'A');
      // 알람 배너가 떠 있는 동안엔 이 버튼이 "실행"으로 바뀌어 재시작을 담당한다(사용자
      // 요청 - "확인 key를 삭제하시고, 하단 버튼에 취소를 실행으로 변경하여 버튼을 누르면
      // 다시 서브 시퀀스가 동작"). 정상 진행 중일 때의 취소/중지 동작과는 분기된다.
      if (subSeqAlarmActive[ns]) {
        logWorkAction(cfg.stopBtn, side);
        const cb = subSeqCallbacks[ns] && subSeqCallbacks[ns].onFinish ? subSeqCallbacks[ns] : subSeqGetDefaultCallbacks(ns);
        window.startNamespacedSubSequenceRunner(ns, cfg.mainStepType, side, cb);
        return;
      }
      logWorkAction(cfg.stopBtn, side);
      if (cfg.stopBtnMode === 'cancel') {
        const cb = subSeqCallbacks[ns] && typeof subSeqCallbacks[ns].onCancel === 'function' ? subSeqCallbacks[ns] : subSeqGetDefaultCallbacks(ns);
        if (cb && typeof cb.onCancel === 'function') {
          // 취소 버튼을 누르면 비밀번호 확인 화면으로 이동하되,
          // 시퀀스는 강제 종료되지 않고 백그라운드에서 계속 진행된다.
          cb.onCancel(side);
        } else {
          window.stopNamespacedSubSequenceRunner(ns);
        }
      } else {
        window.stopNamespacedSubSequenceRunner(ns);
      }
    });
  }
  if (ackBtn && !ackBtn.dataset.wired) {
    ackBtn.dataset.wired = '1';
    ackBtn.addEventListener('click', () => {
      const rt = subSeqRunStates[ns];
      if (!rt || !rt.running || rt.paused) return;
      const steps = rt.data.steps || [];
      const step = steps[rt.stepIndex];
      logWorkAction(cfg.ackBtn, rt.side);
      subSeqRunStepAt(ns, subSeqNextIndex(step, steps, rt.stepIndex));
    });
  }

  // 테스트용 "일시정지" 버튼(패널에만 있음) - pauseBtn id가 없는 네임스페이스는 조용히 무시.
  const pauseBtn = el(ns, 'pauseBtn');
  if (pauseBtn && !pauseBtn.dataset.wired) {
    pauseBtn.dataset.wired = '1';
    pauseBtn.addEventListener('click', () => subSeqTogglePause(ns));
  }

  // 테스트 기간 전용 "초기화" 버튼(일시정지 옆) - Step 1로 즉시 되돌아가 다시 시작한다.
  const resetBtn = el(ns, 'resetBtn');
  if (resetBtn && !resetBtn.dataset.wired) {
    resetBtn.dataset.wired = '1';
    resetBtn.addEventListener('click', () => subSeqResetToStart(ns));
  }

  // idle 화면의 "실행" 버튼 - 자동 시작(auto-start) 구간(puls/oneP)이 알람으로 초기화된 뒤
  // 다시 실행할 방법이 없던 문제를 조정모드 idle과 동일한 방식으로 해결.
  // 콜백(onFinish/onCancel)은 처음 등록된 콜백 또는 기본 정의 콜백을 사용한다.
  const executeBtn = el(ns, 'executeBtn');
  if (executeBtn && !executeBtn.dataset.wired) {
    executeBtn.dataset.wired = '1';
    executeBtn.addEventListener('click', () => {
      const side = (typeof progressCurrentSide !== 'undefined' && progressCurrentSide) || 'A';
      logWorkAction(cfg.executeBtn, side);
      const cb = subSeqCallbacks[ns] && subSeqCallbacks[ns].onFinish ? subSeqCallbacks[ns] : subSeqGetDefaultCallbacks(ns);
      window.startNamespacedSubSequenceRunner(ns, cfg.mainStepType, side, cb);
    });
  }

  // idle 화면의 "취소" - 조정모드 idle의 취소/압력조정 버튼과 같은 줄 배치.
  // 등록된 onCancel 콜백 또는 네임스페이스별 기본 취소 동작을 반드시 100% 호출한다.
  const idleCancelBtn = el(ns, 'idleCancelBtn');
  if (idleCancelBtn && !idleCancelBtn.dataset.wired) {
    idleCancelBtn.dataset.wired = '1';
    idleCancelBtn.addEventListener('click', () => {
      const side = (typeof progressCurrentSide !== 'undefined' && progressCurrentSide) || 'A';
      logWorkAction(cfg.idleCancelBtn, side);
      const cb = subSeqCallbacks[ns] && typeof subSeqCallbacks[ns].onCancel === 'function' ? subSeqCallbacks[ns] : subSeqGetDefaultCallbacks(ns);
      if (cb && typeof cb.onCancel === 'function') {
        cb.onCancel(side);
      }
    });
  }

  // 알람 발생(TEST) - 실제 알람 신호가 아직 없어 가상으로 Alarm Seq. 1/2/3 동작(및 Alarm Goto가
  // 있으면 가벼운 이동)을 검증하는 컨트롤. 이 컨트롤이 없는 네임스페이스(예: puls - 조건/알람이
  // 아직 없는 구간)는 cfg.alarmTestBtn이 null이라 자연히 건너뛴다.
  const alarmTestBtn = el(ns, 'alarmTestBtn');
  const alarmTestSelect = el(ns, 'alarmTestSelect');
  if (alarmTestBtn && alarmTestSelect && !alarmTestBtn.dataset.wired) {
    alarmTestBtn.dataset.wired = '1';
    alarmTestBtn.addEventListener('click', () => {
      const rt = subSeqRunStates[ns];
      const curStep = rt ? (rt.data.steps || [])[rt.stepIndex] : null;
      subSeqHandleAlarm(ns, Number(alarmTestSelect.value), curStep ? curStep.alarmGoto : null);
    });
  }

  // 이 네임스페이스에 연결된 서브시퀀스를 엑셀로 내보내기/불러오기 - 불러오기는 서버가 즉시
  // 저장까지 마친다(Main 시퀀스 편집기와 달리 별도 "저장" 단계 없음 - src/server.js의 import
  // 라우트 참고). 서버 라우트는 mainStepType에 무관한 범용 구조라 네임스페이스마다 그대로
  // 재사용된다. idle 화면에도 같은 버튼이 있을 수 있어(cfg.idleExportBtn 등) 로직을
  // subSeqWireExcelButtons로 뽑아 두 군데 다 같은 방식으로 연결한다.
  subSeqWireExcelButtons(ns, cfg, el(ns, 'exportBtn'), el(ns, 'importBtn'), el(ns, 'fileInput'));
  subSeqWireExcelButtons(ns, cfg, el(ns, 'idleExportBtn'), el(ns, 'idleImportBtn'), el(ns, 'idleFileInput'));
}

function subSeqWireExcelButtons(ns, cfg, exportBtn, importBtn, fileInput) {
  if (exportBtn && !exportBtn.dataset.wired) {
    exportBtn.dataset.wired = '1';
    exportBtn.addEventListener('click', async () => {
      const selRes = await fetch('/api/gms/sub-sequence-selection');
      const selJson = await selRes.json();
      const subSeqId = selJson.ok && selJson.selection ? selJson.selection[cfg.mainStepType] : null;
      if (!subSeqId) { toast(`"${cfg.mainStepType}"에 연결된 서브시퀀스가 없습니다.`, 'err'); return; }
      await fetchAndSave(
        `/api/gms/sub-sequences/${encodeURIComponent(subSeqId)}/export/xlsx`,
        { method: 'GET' },
        `GMS_SubSequence_${subSeqId}_${Date.now()}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    });
  }
  if (importBtn && fileInput && !importBtn.dataset.wired) {
    importBtn.dataset.wired = '1';
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      try {
        const fileBase64 = await fileToBase64(file);
        const res = await fetch('/api/gms/sub-sequences/import/xlsx', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileBase64 }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || '불러오기 실패');
        const savedMsg = data.saved.length ? `${data.saved.join(', ')} 저장됨` : '저장된 시트 없음';
        toast(data.skipped.length ? `${savedMsg} (건너뜀 ${data.skipped.length}건 - 콘솔 참고)` : savedMsg, data.saved.length ? 'ok' : 'err');
        if (data.skipped.length) console.warn('[서브시퀀스 불러오기] 건너뜀:', data.skipped);
        // 안전장치: 엑셀 시트 이름이 그대로 저장 id가 되므로(예: "AdjustMode_v1" 이름의
        // 시트를 편집해서 만들었는데 시트 탭 이름을 안 바꾸고 그대로 불러오면 이 화면이 아닌
        // 엉뚱한 서브시퀀스가 덮어써진다) - 이 화면이 기대하는 id가 실제로 저장됐는지 확인해서
        // 다르면 눈에 띄게 경고한다(실사용 중 AdjustMode_v1이 잘못 덮어써진 사고로 추가함).
        try {
          const selRes = await fetch('/api/gms/sub-sequence-selection');
          const selJson = await selRes.json();
          const expectedId = selJson.ok && selJson.selection ? selJson.selection[cfg.mainStepType] : null;
          if (expectedId && !data.saved.includes(expectedId)) {
            toast(`⚠ 이 화면은 "${expectedId}"용인데 방금 불러온 파일에는 그 시트가 없습니다 - 대신 ${data.saved.join(', ') || '(없음)'}이(가) 저장됐습니다. 엑셀 시트 탭 이름을 확인하세요(다른 서브시퀀스가 덮어써졌을 수 있습니다).`, 'err');
          }
        } catch (e) { /* 확인용 부가 체크 실패는 무시 - 원래 불러오기 결과는 이미 위에서 안내함 */ }
      } catch (e) {
        toast('불러오기 실패: ' + e.message, 'err');
      }
    });
  }
}

/** ns 네임스페이스로 서브시퀀스를 시작한다. opts.onFinish(side)는 모든 Step이 정상 완료됐을
    때(subSeqFinish), opts.onCancel(side)는 "취소"류 버튼(stopBtnMode:'cancel'인 네임스페이스)을
    눌렀을 때 호출된다 - 둘 다 선택 사항(없으면 아무 것도 안 함, 조정모드는 지금까지 그래왔음). */
window.startNamespacedSubSequenceRunner = async function startNamespacedSubSequenceRunner(ns, mainStepType, side, opts) {
  subSeqCallbacks[ns] = opts || {};
  subSeqWireOnce(ns);
  const resolvedSide = side || progressCurrentSide || 'A';
  try {
    const selRes = await fetch('/api/gms/sub-sequence-selection');
    const selJson = await selRes.json();
    const subSeqId = selJson.ok && selJson.selection ? selJson.selection[mainStepType] : null;
    if (!subSeqId) {
      toast(`"${mainStepType}"에 연결된 서브시퀀스가 없습니다.`, 'err');
      return;
    }
    const [dataRes, cfgRes, calibRes] = await Promise.all([
      fetch(`/api/gms/sub-sequences/${encodeURIComponent(subSeqId)}`),
      fetch('/api/gms/sub-sequence-config'),
      fetch('/api/gms/pt-calibration'),
    ]);
    const data = await dataRes.json();
    if (!data.ok || !Array.isArray(data.steps) || data.steps.length === 0) {
      toast('서브시퀀스 데이터를 불러오지 못했습니다.', 'err');
      return;
    }
    const cfgData = await cfgRes.json();
    subSeqConfigRows = cfgData.ok && Array.isArray(cfgData.rows) ? cfgData.rows : [];
    const calibData = await calibRes.json();
    subSeqPtCalibRows = calibData.ok && Array.isArray(calibData.rows) ? calibData.rows : [];

    // Alarm Seq. 코드 2(이어서 재진행)로 멈춘 적이 있으면 처음부터가 아니라 그 Step부터
    // 다시 시작한다(같은 Main Step + 같은 측일 때만).
    const pending = subSeqPendingResumes[ns];
    const resume = pending && pending.mainStepType === mainStepType && pending.side === resolvedSide ? pending : null;
    subSeqPendingResumes[ns] = null;

    const msgEl = el(ns, 'message');
    const opEl = el(ns, 'operation');
    if (msgEl && !resume) msgEl.textContent = ''; // 새로 시작할 때만 이전 실행의 메시지 잔상을 지운다
    if (opEl && !resume) opEl.textContent = '';
    if (!resume) subSeqSetLastAlarm(ns, ''); // 새로 "실행"을 눌렀다는 것은 알람을 확인했다는 뜻 - 지운다
    if (!resume) subSeqHideAlarmBanner(ns); // 패널 알람 배너도 같은 이유로 지운다
    const cfg = SUBSEQ_NS[ns];
    // [요구사항 5] 모든 시퀀스 시작을 할 때: 모든 공정 밸브 즉시 전폐 (All Valve CLOSE)
    if (!resume) {
      subSeqCloseAllOpenValves({}, resolvedSide, data);
    }

    // [요구사항 1] 알람/재시작/새 시작 시 무조건 Step 1부터 깨끗하게 시작
    let freshStartIndex = 0;
    subSeqRestartFromStepNo[ns] = null;

    subSeqRunStates[ns] = {
      mainStepType,
      subSeqId,
      side: resolvedSide,
      data,
      stepIndex: resume ? resume.stepIndex : freshStartIndex,
      valveOpenState: resume ? { ...resume.valveOpenState } : {},
      elapsedSec: resume ? resume.elapsedSec : 0,
      // 반복문(Step "진행횟수" 감시)이 있는 서브시퀀스면 처음부터 설정/진행 횟수 박스가
      // 보이도록 미리 계산해 둔다(사용자 요청 - "처음 화면 진행을 할 때부터 2번 그림처럼").
      cycleTarget: resume && resume.cycleTarget != null ? resume.cycleTarget : subSeqPrescanCycleTarget(data.steps || [], resolvedSide),
      // 진행횟수는 "완료된 반복 횟수"를 뜻해야 한다(사용자 지적 - 실제로 1번만 반복했는데
      // 2로 찍히는 오류). 예전엔 1부터 시작해서 한 번도 안 돌았을 때도 이미 1이었고, 그
      // 결과 조건("진행횟수 >= 설정횟수")도 설정횟수보다 한 번 이르게 소진 처리됐다(설정
      // 횟수=2인데 실제로는 1번만 반복하고 끝남). 0부터 시작해야 "설정 횟수만큼 정확히
      // 반복"이 맞아떨어진다.
      cycleCurrent: resume && resume.cycleCurrent != null ? resume.cycleCurrent : 0,
      // 한 시퀀스 안에 서로 다른 '진행횟수' 반복구간이 여러 개 있을 수 있다(예:
      // ExchL_v1.json의 감압 안정화 시간 구간 → 감압 시간 구간) - 어느 Step에서 마지막으로
      // 카운트했는지 기억해 뒀다가, 다음 구간으로 넘어가면(카운트하는 Step 번호가 바뀌면)
      // subSeqEvalOneCondition이 누적치를 새로 시작한다(아래 참고). 알람 재개(resume) 중엔
      // 그 시점의 값을 그대로 이어받아야 잘못 리셋되지 않는다.
      cycleCheckStepIndex: resume && resume.cycleCheckStepIndex != null ? resume.cycleCheckStepIndex : null,
      cycleCountedThisIteration: false,
      timerId: null,
      masterTimerId: null,
      running: true,
      // 테스트용 일시정지 상태 - 새로 시작할 때는 항상 초기화된다(이전 실행에서 일시정지된
      // 채로 남아있던 흔적이 다음 실행에 이어지면 안 되므로).
      paused: false,
      stepRemainingSec: null,
      wasCountingDown: false,
      // Pumping의 초기값/현재값(HPT) 캡처 - 새로 시작할 때마다 비운다(이전 실행의 초기값이
      // 다음 실행에 남아있으면 안 되므로 - Step 7에 다시 도달했을 때 새로 캡처해야 한다).
      captureValues: {},
      captureTag: null,
      // "N분 SS초" 표시(cycleCurrentAsTime 네임스페이스)용 - Cycle열에 "CAPTURE:<태그>"가
      // 있는 Step(재사용 가능한 "분 단위 대기" Step)이 몇 초째 대기 중인지. 새 반복이
      // 시작될 때마다(subSeqHandleAlarm) 0으로 리셋된다.
      cycleIterElapsedSec: 0,
    };
    const pauseBtn = el(ns, 'pauseBtn');
    if (pauseBtn) { pauseBtn.textContent = '일시정지'; pauseBtn.disabled = false; pauseBtn.style.display = ''; }
    const captureInitialEl = el(ns, 'captureInitial');
    if (captureInitialEl) captureInitialEl.textContent = '-';
    const captureCurrentEl = el(ns, 'captureCurrent');
    if (captureCurrentEl) captureCurrentEl.textContent = '-';
    const captureLimitEl = el(ns, 'captureLimit');
    if (captureLimitEl) {
      let defaultKey = '';
      if (ns === 'afterPlusL') defaultKey = '가압 시험-압력 변동 기준';
      else if (ns === 'exchangePressureTest') defaultKey = '감압 시험-압력 변동 기준';
      else if (ns === 'vtTest' || ns === 'afterVtTest') defaultKey = 'VT 누출 압력 변동 기준';
      if (defaultKey) {
        const { configRow } = subSeqFindConfigRow(defaultKey, resolvedSide);
        if (configRow && configRow.value !== '' && configRow.value !== null && configRow.value !== undefined) {
          captureLimitEl.textContent = `${Number(configRow.value).toFixed(cfg.captureDecimals || 2)} ${configRow.unit || 'PSI'}`;
        }
      }
    }
    if (cfg && cfg.screenKey && typeof showProgressScreen === 'function') {
      const title = (typeof sideScreenTitle === 'function') ? sideScreenTitle(cfg.screenKey, cfg.mainStepType, resolvedSide) : cfg.mainStepType;
      showProgressScreen(cfg.screenKey, title);
    }
    subSeqSetPanelVisible(ns, true);
    subSeqStartMasterTimer(ns);
    subSeqRenderCycleStatus(ns);
    if (resume) toast(`이전 알람 지점(Step ${data.steps[resume.stepIndex] ? data.steps[resume.stepIndex].no : '-'})부터 이어서 진행합니다.`, 'ok');
    subSeqRunStepAt(ns, subSeqRunStates[ns].stepIndex);
  } catch (err) {
    toast(`서브시퀀스 시작 실패: ${err.message}`, 'err');
  }
};

window.stopNamespacedSubSequenceRunner = function stopNamespacedSubSequenceRunner(ns) {
  subSeqWireOnce(ns); // 화면 진입 시마다 호출돼도 안전 - 버튼도 그때 같이 연결된다
  subSeqPendingResumes[ns] = null; // 수동 중지/취소는 알람 상황이 아니므로 이어서 재개할 지점을 남기지 않는다
  const rt = subSeqRunStates[ns];
  if (!rt) {
    subSeqSetPanelVisible(ns, false);
    return;
  }
  subSeqClearTimer(ns);
  subSeqStopMasterTimer(ns);
  const closedTags = subSeqCloseAllOpenValves(rt.valveOpenState);
  if (closedTags.length) toast(`중지 - 밸브 ${closedTags.length}개 CLOSE`, 'ok');
  subSeqRunStates[ns] = null;
  subSeqSetPanelVisible(ns, false);
  // 일시정지된 채로 중지/취소됐을 수 있으니 버튼 상태를 다음 실행을 위해 되돌려 둔다.
  const ackBtn = el(ns, 'ackBtn');
  if (ackBtn) ackBtn.disabled = false;
  const pauseBtn = el(ns, 'pauseBtn');
  if (pauseBtn) { pauseBtn.textContent = '일시정지'; pauseBtn.style.display = ''; }
};

// Status Jump 인터락용 - side에서 실행 중인 서브시퀀스가 하나라도 있으면 true.
// (사용자 요청 - 서브시퀀스 진행 중에 CYLINDER STEP STATUS 배지로 다른 Status로 건너뛰면
// 실행 중이던 밸브/타이머/진행횟수 상태가 붕 뜬 채 남아 다음 재진입 때 꼬일 수 있다.)
window.isSubSequenceRunningForSide = function isSubSequenceRunningForSide(side) {
  return Object.keys(SUBSEQ_NS).some((ns) => {
    const rt = subSeqRunStates[ns];
    return !!(rt && rt.running && rt.side === side);
  });
};

/** 현재 실행 중인 모든 서브시퀀스를 완전히 중단하고 밸브를 CLOSE한다 (비밀번호 확인 통과 시 호출). */
window.stopAllSubSequences = function stopAllSubSequences() {
  Object.keys(SUBSEQ_NS).forEach((ns) => {
    if (subSeqRunStates[ns]) {
      window.stopNamespacedSubSequenceRunner(ns);
    }
  });
};

/** 비밀번호 화면에서 [취소]하여 이전 화면으로 복귀했을 때, 실행 중인 서브시퀀스 패널을 다시 보이도록 복원한다. */
window.restoreRunningSubSequencePanel = function restoreRunningSubSequencePanel() {
  Object.keys(SUBSEQ_NS).forEach((ns) => {
    const rt = subSeqRunStates[ns];
    if (rt && (rt.running || rt.paused)) {
      subSeqSetPanelVisible(ns, true);
    }
  });
  // idleCheck 네임스페이스가 실행/복원 중인 경우 추가 확인
  const idleRt = subSeqRunStates['idleCheck'];
  if (idleRt && (idleRt.running || idleRt.paused)) {
    const lockIdle = document.getElementById('cylinderLockIdle');
    if (lockIdle) lockIdle.style.display = 'none';
    const lockPanel = document.getElementById('cylinderLockPanel');
    if (lockPanel) lockPanel.style.display = 'flex';
  }
};

/** 특정 스텝 인덱스로 서브시퀀스를 강제 재개하거나 복원한다. */
window.resumeSubSequenceRunnerStepAt = async function resumeSubSequenceRunnerStepAt(ns, stepIndex) {
  const cfg = SUBSEQ_NS[ns];
  const side = (typeof progressCurrentSide !== 'undefined' && progressCurrentSide) || 'A';
  if (cfg && cfg.screenKey && typeof showProgressScreen === 'function') {
    const title = (typeof sideScreenTitle === 'function') ? sideScreenTitle(cfg.screenKey, cfg.mainStepType, side) : cfg.mainStepType;
    showProgressScreen(cfg.screenKey, title);
  }
  const rt = subSeqRunStates[ns];
  if (rt) {
    rt.running = true;
    rt.stepIndex = stepIndex;
    subSeqSetPanelVisible(ns, true);
    subSeqRunStepAt(ns, stepIndex);
    return true;
  } else if (cfg) {
    subSeqPendingResumes[ns] = {
      mainStepType: cfg.mainStepType,
      side: side,
      stepIndex: stepIndex,
      valveOpenState: {},
      elapsedSec: 0,
      cycleTarget: null,
      cycleCurrent: 0,
      cycleCheckStepIndex: null
    };
    await window.startNamespacedSubSequenceRunner(ns, cfg.mainStepType, subSeqPendingResumes[ns].side, subSeqCallbacks[ns] || subSeqGetDefaultCallbacks(ns));
    subSeqSetPanelVisible(ns, true);
    return true;
  }
  return false;
};

// 하위호환 래퍼 - 조정모드 쪽 기존 호출부(Operation.js의 adjustModeExecuteBtn/
// showProgressAdjustMode)는 시그니처를 그대로 쓴다. 항상 ns='adjustMode'에 바인딩된다.
window.startSubSequenceRunner = function startSubSequenceRunner(mainStepType, side) {
  return window.startNamespacedSubSequenceRunner('adjustMode', mainStepType, side);
};
window.stopSubSequenceRunner = function stopSubSequenceRunner() {
  return window.stopNamespacedSubSequenceRunner('adjustMode');
};

/** 모든 서브시퀀스 네임스페이스의 버튼(idle 실행/취소, 패널 취소/확인/일시정지/초기화/엑셀 등)을
 *  단 한 번의 호출로 안전하게 바인딩한다. DOM 주입 전후 언제든 안심하고 호출 가능. */
window.wireAllSubSequenceButtons = function wireAllSubSequenceButtons() {
  Object.keys(SUBSEQ_NS).forEach((ns) => {
    try {
      subSeqWireOnce(ns);
    } catch (e) {
      console.warn(`[SubSeqRunner] wireOnce failed for ${ns}:`, e);
    }
  });
};

// 스크립트 로드 즉시, DOM 준비 시, 그리고 150ms 후 자동 실행하여
// 어떤 화면에 복원되거나 새로고침되더라도 버튼이 100% 확실히 바인딩되도록 보장
window.wireAllSubSequenceButtons();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.wireAllSubSequenceButtons());
} else {
  setTimeout(() => window.wireAllSubSequenceButtons(), 150);
}

