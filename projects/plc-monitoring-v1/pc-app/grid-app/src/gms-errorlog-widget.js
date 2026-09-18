import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import sheetsCoreKoKR from '@univerjs/preset-sheets-core/locales/ko-KR';
import '@univerjs/preset-sheets-core/lib/index.css';
import './gms-worklog-widget.css';

/**
 * GMS 조작화면(public/gms.html) "보조 메뉴 > 에러사항" 화면 - public/gms-sub-sequence-runner.js의
 * subSeqHandleAlarm이 서브시퀀스(조정모드 등)에서 실제 Alarm Seq. 동작(초기화/이어서재진행/
 * SHUTDOWN)을 수행할 때만 서버(src/gmsHistory.js error_log 테이블)에 남긴 기록을 보여준다
 * (조회 전용). Alarm Goto로 밸브/상태를 안 건드리고 가볍게 다른 Step으로 이동하는 경우
 * (반복문, Option 분기 등)는 알람이 아니므로 여기 안 남는다(요청사항) - 그 Step 자신의
 * Alarm Seq.(엑셀 AE열)이 비어있으면 기록되지 않는다.
 *
 * "작업이력" 화면(gms-worklog-widget.js)과 완전히 같은 구조(Univer 그리드, A/B 탭, 기간 필터,
 * Data Clear, 엑셀 내보내기, "복귀", 열 폭 자동맞춤)를 그대로 따르되 DB 테이블만 별개다
 * (요청사항 - "화면은 작업이력과 동일한 구조로 설계, DB만 별도로"). 열: 시각 / HTML화면 /
 * Step / 측 / 조작자 / 권한 / Alarm Seq. / 알람 메시지 / 누적시간(초) / PT·Weight·히터 센서
 * 개별 열(작업이력과 동일한 OPTION 반영 규칙 - window.isAnalogTagEnabled, computeColumns()).
 * "구분"(터치키/자동진행) 열은 없다 - 이 화면의 행은 전부 서브시퀀스 알람이라 구분이 필요 없다.
 *
 * 이 화면은 Operation.js의 progressScreens 중 하나(OPERATION_SCREEN_FILES가 fetch로 늦게
 * 주입하는 fragment)라 gms-worklog-widget.js와 동일하게 스스로 즉시 마운트하지 않는다 - 보조
 * 메뉴의 "에러사항"을 처음 누를 때 Operation.js가 window.initGmsErrorLogGrid(containerId)를
 * 호출해서 그때 마운트한다.
 */

const BASE_HEADER = ['시각', 'HTML화면', 'Step', '측', '조작자', '권한', 'Alarm Seq.', '알람 메시지', '누적시간(초)'];
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
const MAX_ROWS = 600; // GET /api/gms/errorlog의 기본 limit(500)보다 여유 있게

function isAnalogEnabled(tag) {
  return typeof window.isAnalogTagEnabled !== 'function' || window.isAnalogTagEnabled(tag);
}

/** OPTION 탭에서 PT/Weight/히터를 "미적용" 처리하면(gms.js의 window.isAnalogTagEnabled) 이
    그리드 열에서도 뺀다(작업이력 화면과 동일한 규칙). 이 화면은 처음 열 때 한 번만
    마운트되므로 열 구성도 그 시점에 한 번만 계산된다 - 마운트 후 OPTION 설정을 바꾸면
    새로고침해야 반영된다. */
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

function toastMsg(message, kind = '') {
  if (typeof window.toast === 'function') window.toast(message, kind);
  else console.log(`[gms-errorlog-grid] ${message}`);
}

function parseSnapshot(raw) {
  if (!raw) return {};
  try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
}

// tag -> type('PT'|'VT'|'Weight') - 작업이력 화면과 동일하게 gms.js의 ptDisplayDecimals()와
// 같은 자릿수(VT=3, 그 외=2)를 맞추기 위한 조회표.
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
// 다시 볼 수 있다). 작업이력 화면과 동일한 패턴.
let dataClearedByTab = { A: false, B: false };

function getSheet() {
  return workbook.getActiveSheet();
}

function applyTemplate(sheet) {
  sheet.getRange(0, 0, 1, COL_COUNT).setValues([HEADER]);
}

/** activeTab에 해당하는 행만 걸러서 시트를 다시 그린다. */
function renderRows() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow >= 1) sheet.getRange(1, 0, lastRow, COL_COUNT).clearContent();
  if (dataClearedByTab[activeTab]) { renderedMeta = []; return; }

  const filtered = allRows.filter((r) => !r.side || r.side === activeTab);
  renderedMeta = filtered.map((r) => ({ screenKey: r.screen_key, screenTitle: r.screen_title, side: r.side }));
  if (filtered.length === 0) return;
  const rows = filtered.map((r) => {
    const snap = parseSnapshot(r.analog_snapshot);
    const baseCells = [
      r.ts, r.screen_title || '', r.sub_seq_step_no || '', r.side || '공통',
      r.operator_name || '', r.operator_role || '',
      r.alarm_seq_code != null ? r.alarm_seq_code : '', r.alarm_message || '',
      r.sub_seq_elapsed_sec != null ? r.sub_seq_elapsed_sec : '',
    ];
    const commonCells = activeCommonColumns.map((c) => tagValue(snap, c.tag));
    const sideCells = activeSideColumns.map((c) => tagValue(snap, `${c.base}_${activeTab}`));
    return [...baseCells, ...commonCells, ...sideCells];
  });
  sheet.getRange(1, 0, rows.length, COL_COUNT).setValues(rows);
}

function renderTabs() {
  document.getElementById('errorLogTabABtn').classList.toggle('active', activeTab === 'A');
  document.getElementById('errorLogTabBBtn').classList.toggle('active', activeTab === 'B');
}

/** datetime-local 입력값을 서버가 ts와 비교할 수 있는 문자열로 바꾼다(작업이력 화면과 동일한
    이유 - error_log.ts도 이제 UTC가 아니라 PC 시계 그대로 '+09:00' 표기로 남기므로, 여기서도
    UTC 변환 없이 formatLocalIso(gms.js 전역 함수)로 같은 형식을 맞춘다). */
function localInputToIso(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : formatLocalIso(d);
}

async function fetchErrorLog() {
  try {
    const unit = new URLSearchParams(window.location.search).get('unit') || '';
    const fromInput = document.getElementById('errorLogFromInput');
    const toInput = document.getElementById('errorLogToInput');
    const from = localInputToIso(fromInput && fromInput.value);
    const to = localInputToIso(toInput && toInput.value);
    const params = new URLSearchParams({ unit, limit: '500' });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await fetch(`/api/gms/errorlog?${params.toString()}`);
    const data = await res.json();
    if (data.ok) {
      allRows = data.rows;
      dataClearedByTab = { A: false, B: false };
      renderRows();
      toastMsg(`에러사항 ${data.rows.length}건 불러옴${from || to ? ' (기간 필터 적용)' : ''}`, 'ok');
    } else {
      toastMsg('에러사항 조회 실패: ' + data.error, 'err');
    }
  } catch (e) {
    toastMsg('에러사항 조회 실패: ' + e.message, 'err');
  }
}

/** 지금 선택된 셀이 속한 시트 행 번호(0-indexed 데이터 인덱스)를 찾는다 - 작업이력 화면과
    동일한 방식(Univer 파사드 API 버전별 메서드 이름 차이를 순서대로 시도). */
function getSelectedDataRowIndex() {
  const sheet = getSheet();
  try {
    if (typeof sheet.getSelection === 'function') {
      const sel = sheet.getSelection();
      const range = sel && (typeof sel.getActiveRange === 'function' ? sel.getActiveRange() : sel);
      if (range && typeof range.getRow === 'function') {
        const row = range.getRow();
        if (row >= 1) return row - 1;
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
  // screen_key 기반으로 원래 화면으로 돌아가는 로직은 화면에 상관없이 동일하므로(Operation.js의
  // window.returnToWorkLogScreen이 progressScreens[screenKey]만 조회) 그대로 재사용한다.
  if (window.returnToWorkLogScreen) {
    window.returnToWorkLogScreen(meta.screenKey, meta.screenTitle, meta.side);
  }
}

async function exportErrorLogExcel() {
  const unit = new URLSearchParams(window.location.search).get('unit') || '';
  const fromInput = document.getElementById('errorLogFromInput');
  const toInput = document.getElementById('errorLogToInput');
  const from = localInputToIso(fromInput && fromInput.value);
  const to = localInputToIso(toInput && toInput.value);
  const params = new URLSearchParams({ unit, limit: '2000' });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const url = `/api/gms/errorlog/export/xlsx?${params.toString()}`;
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
    const suggestedName = m ? decodeURIComponent(m[1]) : `GMS_에러사항_${Date.now()}.xlsx`;
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

function wireOnce() {
  const refreshBtn = document.getElementById('errorLogRefreshBtn');
  if (!refreshBtn || refreshBtn.dataset.wired) return;
  refreshBtn.dataset.wired = '1';

  refreshBtn.addEventListener('click', fetchErrorLog);
  document.getElementById('errorLogFilterBtn')?.addEventListener('click', fetchErrorLog);
  document.getElementById('errorLogFilterResetBtn')?.addEventListener('click', () => {
    const fromInput = document.getElementById('errorLogFromInput');
    const toInput = document.getElementById('errorLogToInput');
    if (fromInput) fromInput.value = '';
    if (toInput) toInput.value = '';
    fetchErrorLog();
  });
  document.getElementById('errorLogReturnBtn')?.addEventListener('click', returnToSelectedRow);
  // "Data Clear" - 지금 보고 있는 탭(A/B)만 화면에서 비운다(DB는 그대로 - 작업이력 화면과
  // 동일한 원칙). PASSWORD 확인은 Operation.js의 window.requestErrorLogDataClear로 넘긴다.
  document.getElementById('errorLogDataClearBtn')?.addEventListener('click', () => {
    if (window.requestErrorLogDataClear) window.requestErrorLogDataClear(activeTab);
  });
  document.getElementById('errorLogExcelExportBtn')?.addEventListener('click', exportErrorLogExcel);
  document.getElementById('errorLogTabABtn')?.addEventListener('click', () => {
    activeTab = 'A'; renderTabs(); renderRows();
  });
  document.getElementById('errorLogTabBBtn')?.addEventListener('click', () => {
    activeTab = 'B'; renderTabs(); renderRows();
  });

  // 그리드 높이 조절 핸들 - 작업이력 화면과 동일한 gms.js(classic script)의
  // window.initGridHeightResizer를 여기서 연결한다(fragment가 늦게 주입되므로 마운트
  // 시점에 해야 컨테이너가 실제로 존재한다).
  if (window.initGridHeightResizer) {
    window.initGridHeightResizer({
      splitterId: 'gmsErrorLogGridResizeHandle',
      boxId: 'gmsErrorLogGridContainer',
      storageKey: 'gmsErrorLogGridHeight',
    });
  }
}

async function mountGmsErrorLogGrid(containerId) {
  computeColumns();
  const { univerAPI: api } = createUniver({
    locale: LocaleType.KO_KR,
    locales: { [LocaleType.KO_KR]: mergeLocales(sheetsCoreKoKR) },
    presets: [UniverSheetsCorePreset({ container: containerId })],
  });
  univerAPI = api;

  workbook = univerAPI.createWorkbook({
    id: 'gms-errorlog',
    name: 'GMS 에러사항',
    sheets: {
      'sheet-1': { id: 'sheet-1', name: '에러사항', rowCount: MAX_ROWS, columnCount: COL_COUNT },
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
  await fetchErrorLog();
  // 화면을 열 때 열 폭을 내용에 맞게 자동조정한다(작업이력 화면과 동일 - 처음 열 때만).
  try { getSheet().autoResizeColumns(0, COL_COUNT); } catch (e) { /* 무시 */ }
  mounted = true;

  // 디버그 편의 - 브라우저 콘솔에서 바로 확인할 수 있게 노출한다.
  window.__gmsErrorLogDebug = { getSheet, univerAPI };
}

let mounting = false;
window.initGmsErrorLogGrid = async function initGmsErrorLogGrid(containerId) {
  if (mounted) { fetchErrorLog(); return; } // 이미 마운트되어 있으면 최신 데이터만 다시 조회
  if (mounting) return;
  mounting = true;
  try {
    await mountGmsErrorLogGrid(containerId);
  } finally {
    mounting = false;
  }
};

/** PASSWORD 확인 후 Operation.js(window.requestErrorLogDataClear)가 호출한다 - 그 탭(A/B)만
    화면에서 비운다. */
window.clearErrorLogTabData = function clearErrorLogTabData(side) {
  if (!mounted || (side !== 'A' && side !== 'B')) return;
  dataClearedByTab[side] = true;
  renderRows();
};
