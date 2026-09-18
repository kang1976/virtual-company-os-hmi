import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import sheetsCoreKoKR from '@univerjs/preset-sheets-core/locales/ko-KR';
import '@univerjs/preset-sheets-core/lib/index.css';
import './gms-worklog-widget.css';

/**
 * GMS 조작화면(public/gms.html) "보조 메뉴 > 작업이력" 화면 - Operation.js의 logWorkAction()
 * 이 실행/확인 버튼을 누를 때마다, 그리고 public/gms-sub-sequence-runner.js가 서브시퀀스
 * (자동진행) Step이 바뀔 때마다 서버(src/gmsHistory.js work_log 테이블)에 남긴 기록을 같은
 * Univer 시트에 시간순으로 함께 보여준다(조회 전용 - 편집해도 서버에 반영되지 않는다). 열:
 * 구분(터치키/자동진행) / HTML화면 / 조작 Key / 측(그 순간 그 측 Status 메시지) / 시각 /
 * 조작자 / 권한 / 자동진행 Step / 자동진행 누적(초) / PT·Weight·히터(온도) 센서 개별 열
 * (VT/VPT/FPT/L_H_2nd/LPT/NPT/HPT/MPT/WI/M_H/J_H - LPT~J_H는 지금 보는 탭(A/B) 기준, L_H_2nd는
 * 히터 중 유일하게 측 구분 없는 공통 태그(Operation.js의 HEATER_GRID_LAYOUT 참고)). OPTION 탭에서
 * 미적용 처리한 채널은 열 자체가 빠진다(window.isAnalogTagEnabled, computeColumns() 참고 - 마운트
 * 시점에 한 번만 계산됨). A/B
 * 탭으로 나뉘고 side가 없는(공통) 조작은 두 탭 모두에 표시되며, 전체/자동진행만/터치조작만
 * 라디오 그룹으로 둘 중 하나만 걸러 볼 수 있다. "복귀"는 선택한 행이 속한 화면(screen_key)으로 Operation.js를
 * 통해 되돌아간다(자동진행 행은 screen_key가 'adjustMode' 고정이라 조정모드 화면으로 복귀).
 *
 * 이 화면은 Operation.js의 progressScreens 중 하나(OPERATION_SCREEN_FILES가 fetch로 늦게
 * 주입하는 fragment)라 gms-trend-widget.js와 동일하게 스스로 즉시 마운트하지 않는다 - 보조
 * 메뉴의 "작업이력"을 처음 누를 때 Operation.js가 window.initGmsWorkLogGrid(containerId)를
 * 호출해서 그때 마운트한다.
 */

const BASE_HEADER = ['구분', 'HTML화면', '조작 Key', '측', '시각', '조작자', '권한', '자동진행 Step', '자동진행 누적(초)'];
// 측 구분 없는 공통 아날로그 열 - tag는 tagValue() 조회에 그대로 쓰인다.
const COMMON_ANALOG_COLUMNS = [
  { label: 'VT', tag: 'VT' },
  { label: 'VPT', tag: 'VPT' },
  { label: 'FPT', tag: 'FPT' },
  { label: 'L/H_2nd', tag: 'L/H_2nd' },
];
// 측별 아날로그 열 - base가 sideTags()의 접두어(activeTab에 따라 _A/_B를 갈아끼운다).
const SIDE_ANALOG_COLUMNS = [
  { label: 'LPT', base: 'LPT' },
  { label: 'NPT', base: 'NPT' },
  { label: 'HPT', base: 'HPT' },
  { label: 'MPT', base: 'MPT' },
  { label: 'WI', base: 'WI' },
  { label: 'M/H', base: 'M/H' },
  { label: 'J/H', base: 'J/H' },
];
const MAX_ROWS = 600; // GET /api/gms/worklog의 기본 limit(500)보다 여유 있게

function isAnalogEnabled(tag) {
  return typeof window.isAnalogTagEnabled !== 'function' || window.isAnalogTagEnabled(tag);
}

/** OPTION 탭에서 PT/Weight/히터를 "미적용" 처리하면(gms.js의 window.isAnalogTagEnabled) 이
    그리드 열에서도 뺀다. 측별 열(LPT~J/H)은 A/B 둘 다 미적용일 때만 열 자체를 숨기고, 한쪽만
    미적용이면 열은 남긴다(다른 쪽 값은 여전히 필요하므로 - 그 쪽 셀은 tagValue()가 원래
    빈칸으로 채운다). 이 화면은 처음 열 때 한 번만 마운트되므로(gms-trend-widget.js와 동일한
    지연 마운트 패턴) 열 구성도 그 시점에 한 번만 계산된다 - 마운트 후 OPTION 설정을 바꾸면
    새로고침해야 반영된다(다른 서버 설정 캐시들과 동일한 절충). */
let activeCommonColumns = COMMON_ANALOG_COLUMNS;
let activeSideColumns = SIDE_ANALOG_COLUMNS;
let HEADER = BASE_HEADER.slice();
let COL_COUNT = HEADER.length;
function computeColumns() {
  activeCommonColumns = COMMON_ANALOG_COLUMNS.filter((c) => isAnalogEnabled(c.tag));
  activeSideColumns = SIDE_ANALOG_COLUMNS.filter((c) => isAnalogEnabled(`${c.base}_A`) || isAnalogEnabled(`${c.base}_B`));
  HEADER = [...BASE_HEADER, ...activeCommonColumns.map((c) => c.label), ...activeSideColumns.map((c) => c.label)];
  COL_COUNT = HEADER.length;
}

// 구분 필터 상태 - 터치키 조작이력과 서브시퀀스(자동진행) Step 이력이 같은 테이블(work_log)에
// 함께 기록되므로, 'all'|'auto'|'touch' 중 하나로 sub_seq_id 유무에 따라 걸러서 보여준다.
let kindFilter = 'all';

function toastMsg(message, kind = '') {
  if (typeof window.toast === 'function') window.toast(message, kind);
  else console.log(`[gms-worklog-grid] ${message}`);
}

function parseSnapshot(raw) {
  if (!raw) return {};
  try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
}

// tag -> type('PT'|'VT'|'Weight') - VT/VPT/FPT/LPT/NPT/HPT/WI 표시 자릿수를 gms.js의
// ptDisplayDecimals()/gms-pt-calibration.js의 decimalsForType()과 동일하게(VT=3, 그 외=2)
// 맞추기 위한 조회표("추후 모든 data값에 해당 값으로 유지" 요청 - 배관도뿐 아니라 작업이력
// 그리드의 기록값도 같은 자릿수를 쓴다).
let calibrationTypeByTag = {};
async function loadCalibrationTypes() {
  try {
    const res = await fetch('/api/gms/pt-calibration');
    const data = await res.json();
    if (data.ok && Array.isArray(data.rows)) {
      calibrationTypeByTag = {};
      data.rows.forEach((r) => { calibrationTypeByTag[r.tag] = r.type; });
    }
  } catch (e) { /* 실패해도 tagValue가 원값 그대로 표시하는 것으로 폴백 */ }
}

function tagValue(snapshot, tag) {
  const v = snapshot[tag];
  if (v === undefined || v === null) return '';
  const type = calibrationTypeByTag[tag];
  if (!type) return v;
  return Number(v).toFixed(type === 'VT' ? 3 : 2);
}

/** "조작 Key" 열 표시 - buttonLabel이 있으면(클릭 당시 그 버튼에 실제로 보이던 문구) 그걸
    큰따옴표로 그대로 보여준다("정확하게 어떤 것을 눌렀는지 사람이 알 수 있도록" 요청) -
    예: "닫기"(workLogCloseBtn). buttonLabel이 없으면(배지 클릭처럼 buttonId가 실제 DOM id가
    아니었거나, 이 열이 추가되기 전 기록) buttonId 접미사(...RunBtn/ConfirmBtn/CancelBtn/
    ReturnBtn/ExecuteBtn)로 추측한 한글 동작유형으로 대체한다. */
const ACTION_TYPE_SUFFIX_LABELS = [
  ['ReturnBtn', '복귀'],
  ['ConfirmBtn', '확인'],
  ['CancelBtn', '취소'],
  ['ExecuteBtn', '실행'],
  ['RunBtn', '실행'],
];
function formatActionKey(buttonId, buttonLabel) {
  if (!buttonId && !buttonLabel) return '';
  if (buttonLabel) {
    if (buttonLabel.startsWith('[Main ') || buttonLabel.startsWith('[')) {
      return buttonLabel;
    }
    return `"${buttonLabel}" (${buttonId})`;
  }
  const hit = ACTION_TYPE_SUFFIX_LABELS.find(([suffix]) => buttonId.endsWith(suffix));
  const label = hit ? hit[1] : '조작';
  return `${label}(${buttonId}) key`;
}

let univerAPI = null;
let workbook = null;
let mounted = false;
let allRows = [];
let activeTab = 'A';
// renderRows()가 실제로 그린 행 순서와 1:1로 맞는 메타데이터(screenKey 등) - "복귀"가 이
// 배열의 인덱스로 원본 행을 찾는다(시트 행 번호(1부터) - 1 = 이 배열 인덱스).
let renderedMeta = [];
// "Data Clear" - 탭(A/B)별로 따로 지워진 상태를 기억한다(서버 데이터(allRows)는 그대로 두고
// 화면 표시만 비운다 - DB는 절대 건드리지 않으므로 "새로고침"/"기간 조회"를 누르면 언제든
// 다시 볼 수 있다). fetchWorkLog()가 새로 불러올 때마다 초기화된다(요청에 따라 새로 조회하면
// 다시 보이는 게 자연스러우므로) - PASSWORD 확인 직후 경로만 예외적으로 fetchWorkLog을
// 거치지 않고 이 플래그만 세운다(Operation.js의 workLogClear 분기 참고).
let dataClearedByTab = { A: false, B: false };

function getSheet() {
  return workbook.getActiveSheet();
}

function applyTemplate(sheet) {
  sheet.getRange(0, 0, 1, COL_COUNT).setValues([HEADER]);
}

/** activeTab에 해당하는 행만 걸러서 시트를 다시 그린다 - side가 없는(공통) 조작은 양쪽
    탭 모두에 나온다. LPT~WI(측별)는 지금 보는 탭 기준 태그를 보여준다(그 조작 자체의
    side와 무관하게, 그 순간 그 측 센서가 어떤 값이었는지가 궁금한 것이므로). */
function renderRows() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow >= 1) sheet.getRange(1, 0, lastRow, COL_COUNT).clearContent();
  if (dataClearedByTab[activeTab]) { renderedMeta = []; return; }

  const filtered = allRows
    .filter((r) => !r.side || r.side === activeTab)
    .filter((r) => {
      if (kindFilter === 'auto') return !!r.sub_seq_id;
      if (kindFilter === 'touch') return !r.sub_seq_id;
      return true;
    });
  renderedMeta = filtered.map((r) => ({ screenKey: r.screen_key, screenTitle: r.screen_title, side: r.side }));
  if (filtered.length === 0) return;
  const rows = filtered.map((r) => {
    const snap = parseSnapshot(r.analog_snapshot);
    const sideLabel = r.side ? `[${r.side}] ${r.status_label || ''}` : '공통';
    const baseCells = [
      r.sub_seq_id ? '자동진행' : '터치키',
      r.screen_title || '', formatActionKey(r.action, r.button_label), sideLabel, r.ts, r.operator_name || '', r.operator_role || '',
      r.sub_seq_step_no || '', r.sub_seq_elapsed_sec != null ? r.sub_seq_elapsed_sec : '',
    ];
    const commonCells = activeCommonColumns.map((c) => tagValue(snap, c.tag));
    const sideCells = activeSideColumns.map((c) => tagValue(snap, `${c.base}_${activeTab}`));
    return [...baseCells, ...commonCells, ...sideCells];
  });
  sheet.getRange(1, 0, rows.length, COL_COUNT).setValues(rows);
}

function renderTabs() {
  document.getElementById('workLogTabABtn').classList.toggle('active', activeTab === 'A');
  document.getElementById('workLogTabBBtn').classList.toggle('active', activeTab === 'B');
}

/** datetime-local 입력값("YYYY-MM-DDTHH:mm[:ss]", 로컬 시각, 타임존 없음)을 서버가 ts와
    비교할 수 있는 문자열로 바꾼다 - work_log.ts는 이제 UTC('Z')가 아니라 PC 시계 그대로
    ('+09:00' 표기, src/timeUtils.js의 nowLocalIso())로 남기므로, 여기서도 UTC로 변환하지
    않고(예전엔 d.toISOString()이 UTC로 바꿔서 9시간 어긋났었다 - 사용자 지적) 입력값의
    로컬 시각 그대로 같은 형식으로 맞춰야 from/to 부등호 비교가 시간순으로 맞는다.
    formatLocalIso는 gms.js(메인 페이지, toast()와 동일하게 최상위 함수라 전역으로 접근
    가능)에 정의돼 있다. */
function localInputToIso(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : formatLocalIso(d);
}

async function fetchWorkLog() {
  try {
    const unit = new URLSearchParams(window.location.search).get('unit') || '';
    const fromInput = document.getElementById('workLogFromInput');
    const toInput = document.getElementById('workLogToInput');
    const from = localInputToIso(fromInput && fromInput.value);
    const to = localInputToIso(toInput && toInput.value);
    const params = new URLSearchParams({ unit, limit: '500' });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await fetch(`/api/gms/worklog?${params.toString()}`);
    const data = await res.json();
    if (data.ok) {
      allRows = data.rows;
      dataClearedByTab = { A: false, B: false };
      renderRows();
      toastMsg(`작업이력 ${data.rows.length}건 불러옴${from || to ? ' (기간 필터 적용)' : ''}`, 'ok');
    } else {
      toastMsg('작업이력 조회 실패: ' + data.error, 'err');
    }
  } catch (e) {
    toastMsg('작업이력 조회 실패: ' + e.message, 'err');
  }
}

/** 지금 선택된 셀이 속한 시트 행 번호(1부터, 헤더 제외한 데이터 행 기준 - 헤더가 1행이므로
    시트 행 번호 2 = 데이터 첫 행)를 찾는다. Univer 파사드 API가 버전에 따라 메서드 이름이
    다를 수 있어 몇 가지를 순서대로 시도하고, 전부 실패하면 null을 돌려준다(호출부가 안내
    토스트를 띄운다). */
function getSelectedDataRowIndex() {
  const sheet = getSheet();
  try {
    if (typeof sheet.getSelection === 'function') {
      const sel = sheet.getSelection();
      const range = sel && (typeof sel.getActiveRange === 'function' ? sel.getActiveRange() : sel);
      if (range && typeof range.getRow === 'function') {
        const row = range.getRow(); // 0-indexed 시트 행
        if (row >= 1) return row - 1; // 헤더(0행) 제외한 데이터 인덱스
      }
    }
  } catch (e) { /* 다음 방법 시도 */ }
  try {
    if (typeof sheet.getActiveCell === 'function') {
      const cell = sheet.getActiveCell();
      if (cell && typeof cell.getRow === 'function') {
        const row = cell.getRow();
        if (row >= 1) return row - 1;
      }
    }
  } catch (e) { /* 무시 */ }
  return null;
}

function returnToSelectedRow() {
  const idx = getSelectedDataRowIndex();
  if (idx === null || idx === undefined || !renderedMeta[idx]) {
    toastMsg('먼저 표에서 되돌아갈 행의 셀을 클릭해 선택하세요.', 'err');
    return;
  }
  const meta = renderedMeta[idx];
  if (!meta.screenKey) {
    toastMsg('이 행은 특정 화면과 연결되어 있지 않습니다.', 'err');
    return;
  }
  if (window.returnToWorkLogScreen) {
    window.returnToWorkLogScreen(meta.screenKey, meta.screenTitle, meta.side);
  }
}

async function exportWorkLogExcel() {
  const unit = new URLSearchParams(window.location.search).get('unit') || '';
  const fromInput = document.getElementById('workLogFromInput');
  const toInput = document.getElementById('workLogToInput');
  const from = localInputToIso(fromInput && fromInput.value);
  const to = localInputToIso(toInput && toInput.value);
  const params = new URLSearchParams({ unit, limit: '2000' });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const url = `/api/gms/worklog/export/xlsx?${params.toString()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toastMsg('내보내기 실패: ' + (err.error || res.statusText), 'err');
      return;
    }
    const blob = await res.blob();
    const cd = res.headers.get('content-disposition') || '';
    const m = cd.match(/filename="?([^";]+)"?/i);
    const suggestedName = m ? decodeURIComponent(m[1]) : `GMS_작업이력_${Date.now()}.xlsx`;
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [{ description: 'XLSX 파일', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        toastMsg('엑셀로 내보냈습니다', 'ok');
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(objUrl);
    toastMsg('엑셀로 내보냈습니다', 'ok');
  } catch (e) {
    toastMsg('내보내기 실패: ' + e.message, 'err');
  }
}

/** 버튼ID→메시지 설정 자체의 엑셀 내보내기/불러오기 - 표시 중인 로그가 아니라 앞으로
    새로 기록될 로그에 쓰일 문구를 관리한다(gmsManager.js의 loadGmsWorkLogMessages와
    동일한 데이터, server.js /api/gms/worklog-messages). */
async function exportMessagesExcel() {
  try {
    const res = await fetch('/api/gms/worklog-messages');
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || '조회 실패');
    const exportRes = await fetch('/api/gms/worklog-messages/export/xlsx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: data.messages }),
    });
    if (!exportRes.ok) {
      const err = await exportRes.json().catch(() => ({}));
      toastMsg('메시지 설정 내보내기 실패: ' + (err.error || exportRes.statusText), 'err');
      return;
    }
    const blob = await exportRes.blob();
    const cd = exportRes.headers.get('content-disposition') || '';
    const m = cd.match(/filename="?([^";]+)"?/i);
    const suggestedName = m ? decodeURIComponent(m[1]) : `GMS_작업이력메시지_${Date.now()}.xlsx`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(url);
    toastMsg('메시지 설정을 엑셀로 내보냈습니다', 'ok');
  } catch (e) {
    toastMsg('메시지 설정 내보내기 실패: ' + e.message, 'err');
  }
}

async function importMessagesExcel(file) {
  try {
    const fileBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const res = await fetch('/api/gms/worklog-messages/import/xlsx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileBase64 }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || '불러오기 실패');
    const saveRes = await fetch('/api/gms/worklog-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: data.messages }),
    });
    const saveData = await saveRes.json();
    if (!saveData.ok) throw new Error(saveData.error || '저장 실패');
    if (window.reloadWorkLogMessagesConfig) window.reloadWorkLogMessagesConfig();
    if (data.warnings && data.warnings.length > 0) {
      toastMsg(`메시지 ${data.messages.length}개 반영 - ${data.warnings.length}건 확인 필요: ${data.warnings[0]}`, 'err');
    } else {
      toastMsg(`메시지 설정 ${data.messages.length}개를 엑셀에서 불러와 반영했습니다`, 'ok');
    }
  } catch (e) {
    toastMsg('메시지 설정 불러오기 실패: ' + e.message, 'err');
  }
}

/** 화면 제목("HTML화면" 열, A열) 설정의 엑셀 내보내기/불러오기 - 메시지 설정과 완전히
    같은 패턴(gmsManager.js의 loadGmsScreenTitles, server.js /api/gms/screen-titles).
    Operation.js의 screenTitleFor()가 이 설정을 읽어서 showProgressScreen 제목에 반영한다. */
async function exportScreenTitlesExcel() {
  try {
    const res = await fetch('/api/gms/screen-titles');
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || '조회 실패');
    const exportRes = await fetch('/api/gms/screen-titles/export/xlsx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titles: data.titles }),
    });
    if (!exportRes.ok) {
      const err = await exportRes.json().catch(() => ({}));
      toastMsg('화면 제목 내보내기 실패: ' + (err.error || exportRes.statusText), 'err');
      return;
    }
    const blob = await exportRes.blob();
    const cd = exportRes.headers.get('content-disposition') || '';
    const m = cd.match(/filename="?([^";]+)"?/i);
    const suggestedName = m ? decodeURIComponent(m[1]) : `GMS_화면제목_${Date.now()}.xlsx`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(url);
    toastMsg('화면 제목을 엑셀로 내보냈습니다', 'ok');
  } catch (e) {
    toastMsg('화면 제목 내보내기 실패: ' + e.message, 'err');
  }
}

async function importScreenTitlesExcel(file) {
  try {
    const fileBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const res = await fetch('/api/gms/screen-titles/import/xlsx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileBase64 }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || '불러오기 실패');
    const saveRes = await fetch('/api/gms/screen-titles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titles: data.titles }),
    });
    const saveData = await saveRes.json();
    if (!saveData.ok) throw new Error(saveData.error || '저장 실패');
    if (window.reloadScreenTitlesConfig) window.reloadScreenTitlesConfig();
    if (data.warnings && data.warnings.length > 0) {
      toastMsg(`화면 제목 ${data.titles.length}개 반영 - ${data.warnings.length}건 확인 필요: ${data.warnings[0]}`, 'err');
    } else {
      toastMsg(`화면 제목 ${data.titles.length}개를 엑셀에서 불러와 반영했습니다`, 'ok');
    }
  } catch (e) {
    toastMsg('화면 제목 불러오기 실패: ' + e.message, 'err');
  }
}

function wireOnce() {
  const refreshBtn = document.getElementById('workLogRefreshBtn');
  if (!refreshBtn || refreshBtn.dataset.wired) return;
  refreshBtn.dataset.wired = '1';

  refreshBtn.addEventListener('click', fetchWorkLog);
  document.getElementById('workLogFilterBtn')?.addEventListener('click', fetchWorkLog);
  document.getElementById('workLogFilterResetBtn')?.addEventListener('click', () => {
    const fromInput = document.getElementById('workLogFromInput');
    const toInput = document.getElementById('workLogToInput');
    if (fromInput) fromInput.value = '';
    if (toInput) toInput.value = '';
    fetchWorkLog();
  });
  document.getElementById('workLogReturnBtn')?.addEventListener('click', returnToSelectedRow);
  // "Data Clear" - 지금 보고 있는 탭(A/B)만 화면에서 비운다. 실제로 지우기 전에 반드시
  // PASSWORD를 통과해야 하므로 여기서 직접 지우지 않고 Operation.js의
  // window.requestWorkLogDataClear로 넘긴다(확인 후 window.clearWorkLogTabData가 실제로
  // 지운다 - 아래 window.clearWorkLogTabData 참고). 서버에는 아무 요청도 보내지 않으므로
  // DB(work_log)는 그대로 남고, "새로고침"/"기간 조회"를 누르면 언제든 다시 불러와진다.
  document.getElementById('workLogDataClearBtn')?.addEventListener('click', () => {
    if (window.requestWorkLogDataClear) window.requestWorkLogDataClear(activeTab);
  });
  document.getElementById('workLogExcelExportBtn')?.addEventListener('click', exportWorkLogExcel);
  document.getElementById('workLogMsgExportBtn')?.addEventListener('click', exportMessagesExcel);
  document.getElementById('workLogMsgImportBtn')?.addEventListener('click', () => {
    const input = document.getElementById('workLogMsgImportFile');
    input.value = '';
    input.click();
  });
  document.getElementById('workLogMsgImportFile')?.addEventListener('change', () => {
    const input = document.getElementById('workLogMsgImportFile');
    const file = input.files && input.files[0];
    if (file) importMessagesExcel(file);
  });
  document.getElementById('workLogTitleExportBtn')?.addEventListener('click', exportScreenTitlesExcel);
  document.getElementById('workLogTitleImportBtn')?.addEventListener('click', () => {
    const input = document.getElementById('workLogTitleImportFile');
    input.value = '';
    input.click();
  });
  document.getElementById('workLogTitleImportFile')?.addEventListener('change', () => {
    const input = document.getElementById('workLogTitleImportFile');
    const file = input.files && input.files[0];
    if (file) importScreenTitlesExcel(file);
  });
  document.querySelectorAll('input[name="workLogKindFilter"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      if (!e.target.checked) return;
      kindFilter = e.target.value;
      renderRows();
    });
  });
  document.getElementById('workLogTabABtn')?.addEventListener('click', () => {
    activeTab = 'A'; renderTabs(); renderRows();
  });
  document.getElementById('workLogTabBBtn')?.addEventListener('click', () => {
    activeTab = 'B'; renderTabs(); renderRows();
  });

  // 그리드 높이 조절 핸들(#gmsWorkLogGridResizeHandle) - gms.js(classic script)의
  // window.initGridHeightResizer를 여기서 연결한다(fragment가 늦게 주입되므로 마운트
  // 시점에 해야 컨테이너가 실제로 존재한다).
  if (window.initGridHeightResizer) {
    window.initGridHeightResizer({
      splitterId: 'gmsWorkLogGridResizeHandle',
      boxId: 'gmsWorkLogGridContainer',
      storageKey: 'gmsWorkLogGridHeight',
    });
  }
}

async function mountGmsWorkLogGrid(containerId) {
  computeColumns();
  const { univerAPI: api } = createUniver({
    locale: LocaleType.KO_KR,
    locales: { [LocaleType.KO_KR]: mergeLocales(sheetsCoreKoKR) },
    presets: [UniverSheetsCorePreset({ container: containerId })],
  });
  univerAPI = api;

  workbook = univerAPI.createWorkbook({
    id: 'gms-worklog',
    name: 'GMS 작업이력',
    sheets: {
      'sheet-1': { id: 'sheet-1', name: '작업이력', rowCount: MAX_ROWS, columnCount: COL_COUNT },
    },
  });

  applyTemplate(getSheet());
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  const containerEl = document.getElementById(containerId);
  if (containerEl && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => window.dispatchEvent(new Event('resize'))).observe(containerEl);
  }

  wireOnce();
  renderTabs();
  await loadCalibrationTypes();
  await fetchWorkLog();
  // 화면을 열 때 열 폭을 내용에 맞게 자동조정한다("그리드 화면을 열 때 열폭 자동맞춤" 요청) -
  // 새로고침/기간조회 때마다는 다시 맞추지 않는다(사용자가 그 사이에 손으로 조절했을 수
  // 있으므로 - 처음 열 때만).
  try { getSheet().autoResizeColumns(0, COL_COUNT); } catch (e) { /* 무시 */ }
  mounted = true;

  // 디버그 편의 - "복귀"가 쓰는 셀 선택 API를 브라우저 콘솔에서 바로 확인할 수 있게 노출한다.
  window.__gmsWorkLogDebug = { getSheet, univerAPI };
}

let mounting = false;
window.initGmsWorkLogGrid = async function initGmsWorkLogGrid(containerId) {
  if (mounted) { fetchWorkLog(); return; } // 이미 마운트되어 있으면 최신 데이터만 다시 조회
  if (mounting) return;
  mounting = true;
  try {
    await mountGmsWorkLogGrid(containerId);
  } finally {
    mounting = false;
  }
};

/** PASSWORD 확인 후 Operation.js(window.requestWorkLogDataClear)가 호출한다 - 그 탭(A/B)만
    화면에서 비운다. 그리드가 아직 마운트 전이면(이 화면을 연 적조차 없는 상태에서 Data
    Clear를 호출할 방법은 없지만, 방어적으로) 아무 것도 하지 않는다. */
window.clearWorkLogTabData = function clearWorkLogTabData(side) {
  if (!mounted || (side !== 'A' && side !== 'B')) return;
  dataClearedByTab[side] = true;
  renderRows();
};
