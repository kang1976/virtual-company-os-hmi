import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import sheetsCoreKoKR from '@univerjs/preset-sheets-core/locales/ko-KR';
import '@univerjs/preset-sheets-core/lib/index.css';
import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation';
import sheetsDataValidationKoKR from '@univerjs/preset-sheets-data-validation/locales/ko-KR';
import './trend-widget.css';

/**
 * 트렌드 모니터링 페이지(public/monitoring.html)에 임베드되는 Univer 변수 목록 그리드.
 * grid-app/src/main.js("Recipes & Snapshots" 그리드)와 동일한 조건(컬럼 방식, 전체선택/
 * 전체해제/비교판정/초기화 버튼)으로 작성하되, 아래 차이가 있다:
 *   - 폴링 시작/일시정지/정지/폴링주기 컨트롤은 만들지 않는다. 트렌드 페이지의 기존
 *     #monStartBtn 등이 유일한 컨트롤이고, monitoring.js가 window.trendGridApi를 통해
 *     이 위젯에 값 반영/시작값·종료값 캡처를 요청한다.
 *   - 그리드는 "설정값(쓰기)" 컬럼 + 스냅샷 버튼으로 시작/종료 값을 수동 캡처하지만,
 *     트렌드는 이미 시작/정지 버튼 자체가 그 역할을 하므로 스냅샷 버튼이 없다.
 *   - 비교판정은 시작==종료 단순 일치가 아니라, (시작값-종료값) 변화량의 절댓값이
 *     허용오차(±) 이내인지로 판정한다(기준최대값/기준최소값 두 컬럼 대신 허용오차 한 컬럼 사용).
 */

// ── 컬럼 정의 ──
// A:선택 B:차트 C:영역 D:주소 E:타입 F:길이(STRING전용) G:설명
// H:허용오차(±) I:현재값 J:시작값 K:종료값 L:비교판정
const HEADER = [
  '선택', '차트', '영역(D/H/W/CIO/E0..)', '주소 (예: 100 또는 100.5)', '타입', '길이(STRING, 워드수)',
  '설명(코멘트)', '허용오차(±)', '현재값', '시작값', '종료값', '비교판정',
];
const COL_COUNT = HEADER.length;
const SELECT_COL = 0;
const CHART_COL = 1;
const AREA_COL = 2;
const ADDR_COL = 3;
const TYPE_COL = 4;
const LENGTH_COL = 5;
const DESC_COL = 6;
const TOLERANCE_COL = 7;
const VALUE_COL = 8;
const START_COL = 9;
const END_COL = 10;
const COMPARE_COL = 11;
const MAX_ROWS = 200;

const DATA_TYPES = [
  'INT', 'BOOL', 'DINT', 'LINT', 'UINT', 'UDINT', 'ULINT',
  'UBCD', 'UDBCD', 'ULBCD', 'WORD', 'DWORD', 'LWORD', 'REAL', 'LREAL', 'STRING',
];
const AREA_OPTIONS = ['D', 'H', 'W', 'CIO', ...Array.from({ length: 25 }, (_, i) => `E${i}`)];

function toastMsg(message, kind = '') {
  if (typeof window.toast === 'function') window.toast(message, kind);
  else console.log(`[trend-grid] ${message}`);
}

/** "100" 또는 "100.5"(워드.비트) 형식의 주소 문자열을 { address, bit }로 변환 */
function parseAddress(raw) {
  const s = String(raw === undefined || raw === null ? '' : raw).trim();
  if (s.includes('.')) {
    const [a, b] = s.split('.');
    return { address: Number(a) || 0, bit: Number(b) || 0 };
  }
  return { address: Number(s) || 0, bit: 0 };
}

function formatAddress(address, bit, dataType) {
  if (dataType === 'BOOL' || bit) return `${address}.${bit || 0}`;
  return String(address);
}

/**
 * 파일 Blob을 저장한다. Chrome/Edge(File System Access API 지원)에서는 실제 "다른 이름으로
 * 저장" 창이 떠서 폴더/파일명을 직접 고를 수 있고, 미지원 브라우저에서는 기존처럼 앵커
 * 다운로드로 대체된다(브라우저 기본 다운로드 폴더로 저장됨). 그리드 페이지(main.js)와 동일한 방식.
 */
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
      if (e && e.name === 'AbortError') throw e; // 사용자가 저장 창을 취소함
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
  const m = cd.match(/filename="?([^";]+)"?/i);
  return m ? decodeURIComponent(m[1]) : fallback;
}

/** 서버 GET 내보내기 엔드포인트를 fetch로 받아 Save As(가능하면)로 저장한다. */
async function fetchAndSave(url, fallbackName, mimeType) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toastMsg('내보내기 실패: ' + (err.error || res.statusText), 'err');
      return;
    }
    const blob = await res.blob();
    const suggestedName = filenameFromResponse(res, fallbackName);
    await saveBlobWithPicker(blob, suggestedName, mimeType);
    toastMsg('저장 완료', 'ok');
  } catch (e) {
    if (e && e.name === 'AbortError') return; // 사용자가 저장 창을 취소함
    toastMsg('내보내기 실패: ' + e.message, 'err');
  }
}

/** 두 값이 같은 표현이면 true (숫자 비교 우선, 안 되면 문자열 비교) */
function toNumberOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

let univerAPI;
let workbook;
let isEditingCell = false;
let containerElId = null;

function getSheet() {
  return workbook.getActiveSheet();
}

function writeHeader(sheet) {
  sheet.getRange(0, 0, 1, COL_COUNT).setValues([HEADER]);
}

function applyDropdowns(sheet) {
  try {
    const areaRule = univerAPI.newDataValidation().requireValueInList(AREA_OPTIONS, false, true).build();
    sheet.getRange(1, AREA_COL, MAX_ROWS - 1, 1).setDataValidation(areaRule);
    const typeRule = univerAPI.newDataValidation().requireValueInList(DATA_TYPES, false, true).build();
    sheet.getRange(1, TYPE_COL, MAX_ROWS - 1, 1).setDataValidation(typeRule);
  } catch (e) {
    console.warn('데이터 유효성 검사(드롭다운) 적용 실패:', e);
  }
  try {
    // 두 열에 같은 규칙 객체를 재사용하면 두 번째 setDataValidation 호출이 앞서 적용된
    // 범위를 덮어써서 첫 번째 열(선택)의 체크박스가 사라지므로, 열마다 별도 인스턴스를 만든다.
    const selectCheckboxRule = univerAPI.newDataValidation().requireCheckbox('1', '0').build();
    sheet.getRange(1, SELECT_COL, MAX_ROWS - 1, 1).setDataValidation(selectCheckboxRule);
    const chartCheckboxRule = univerAPI.newDataValidation().requireCheckbox('1', '0').build();
    sheet.getRange(1, CHART_COL, MAX_ROWS - 1, 1).setDataValidation(chartCheckboxRule);
  } catch (e) {
    console.warn('체크박스 열 적용 실패:', e);
  }
}

function applyTemplate(sheet) {
  writeHeader(sheet);
  applyDropdowns(sheet);
}

/** 라벨(area+address(+bit)) 형식 - monitoring.js의 기존 labelFor()와 동일한 규칙 */
function labelFor(v) {
  return `${v.area}${v.address}${v.dataType === 'BOOL' && v.bit ? '.' + v.bit : ''}`;
}

function rowToVariable(row) {
  const area = row[AREA_COL];
  if (area === null || area === undefined || String(area).trim() === '') return null;
  const { address, bit } = parseAddress(row[ADDR_COL]);
  return {
    area: String(area).trim().toUpperCase(),
    address,
    bit,
    dataType: String(row[TYPE_COL] || 'WORD').trim().toUpperCase(),
    length: Number(row[LENGTH_COL]) || 1,
    description: row[DESC_COL] === null || row[DESC_COL] === undefined ? '' : String(row[DESC_COL]),
    tolerance: row[TOLERANCE_COL] === null || row[TOLERANCE_COL] === undefined ? '' : row[TOLERANCE_COL],
    chart: isChecked(row[CHART_COL]),
    startValue: row[START_COL] === null || row[START_COL] === undefined ? '' : row[START_COL],
    endValue: row[END_COL] === null || row[END_COL] === undefined ? '' : row[END_COL],
    compareValue: row[COMPARE_COL] === null || row[COMPARE_COL] === undefined ? '' : row[COMPARE_COL],
  };
}

function isChecked(v) {
  return v === 1 || v === true || v === '1' || String(v).trim().toUpperCase() === 'TRUE';
}

/** 시트 실제 행 번호(1부터) 목록. 영역(C열)이 채워진 행만 "데이터 있는 행"으로 취급한다. */
function getDataRowNumbers(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];
  const areas = sheet.getRange(1, AREA_COL, lastRow, 1).getValues();
  const rows = [];
  areas.forEach((r, i) => {
    if (r[0] !== null && r[0] !== undefined && String(r[0]).trim() !== '') rows.push(i + 1);
  });
  return rows;
}

function readAllVariables() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return { variables: [], errors: [] };
  const rows = sheet.getRange(1, 0, lastRow, COL_COUNT).getValues();
  const variables = [];
  const errors = [];
  rows.forEach((row, idx) => {
    const v = rowToVariable(row);
    if (!v) return;
    if (!DATA_TYPES.includes(v.dataType)) {
      errors.push(`${idx + 2}행: 타입 "${v.dataType}"은(는) 지원하지 않습니다.`);
      return;
    }
    variables.push(v);
  });
  return { variables, errors };
}

function loadVariablesIntoSheet(variables) {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow >= 1) {
    sheet.getRange(1, 0, lastRow, COL_COUNT).clearContent();
  }
  if (variables && variables.length > 0) {
    const rows = variables.map((v) => [
      '', v.chart !== false ? '1' : '0', v.area, formatAddress(v.address, v.bit, v.dataType), v.dataType,
      // 예전(기준최대값/기준최소값 두 컬럼) 형식으로 저장된 파일을 불러올 때는 기준최대값을
      // 허용오차 값으로 이어받는다(완전히 동일하진 않지만 값을 그냥 잃는 것보단 낫다).
      v.length || 1, v.description || '', v.tolerance ?? v.maxRef ?? '', '',
      v.startValue ?? '', v.endValue ?? '', v.compareValue ?? '',
    ]);
    sheet.getRange(1, 0, rows.length, COL_COUNT).setValues(rows);
  }
}

async function fetchVariables() {
  try {
    const res = await fetch('/api/trend/variables');
    const data = await res.json();
    if (data.ok) {
      loadVariablesIntoSheet(data.variables);
      // 화면을 열 때 열 폭을 내용에 맞게 자동조정한다("그리드 화면을 열 때 열폭 자동맞춤" 요청).
      try { getSheet().autoResizeColumns(0, COL_COUNT); } catch (e) { /* 무시 */ }
      toastMsg(`변수 ${data.variables.length}개 불러옴`, 'ok');
    }
  } catch (e) {
    toastMsg('변수 목록 조회 실패: ' + e.message, 'err');
  }
}

async function saveVariables() {
  const { variables, errors } = readAllVariables();
  if (errors.length > 0) {
    toastMsg(`저장 실패 - ${errors[0]}${errors.length > 1 ? ` 외 ${errors.length - 1}건` : ''}`, 'err');
    return false;
  }
  try {
    const res = await fetch('/api/trend/variables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variables }),
    });
    const data = await res.json();
    if (data.ok) {
      toastMsg(`변수 ${variables.length}개 저장 완료`, 'ok');
      return true;
    }
    toastMsg('저장 실패: ' + data.error, 'err');
    return false;
  } catch (e) {
    toastMsg('저장 실패: ' + e.message, 'err');
    return false;
  }
}

/** A/B열(선택/차트) 체크박스를 데이터가 있는 모든 행에 대해 일괄로 켜거나 끈다. */
function setAllChecks(col, checked) {
  const sheet = getSheet();
  const rows = getDataRowNumbers(sheet);
  if (rows.length === 0) return 0;
  const value = checked ? '1' : '0';
  let i = 0;
  while (i < rows.length) {
    let j = i;
    while (j + 1 < rows.length && rows[j + 1] === rows[j] + 1) j++;
    const startRow = rows[i];
    const count = j - i + 1;
    sheet.getRange(startRow, col, count, 1).setValues(Array.from({ length: count }, () => [value]));
    i = j + 1;
  }
  return rows.length;
}

// ── 모달 헬퍼 ──
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

/** 헤더를 드래그해서 옮길 수 있게 하고(크기 조절은 CSS resize:both), 마지막 위치를 유지한다. */
function setupDraggableModal(boxId, headerId) {
  const box = document.getElementById(boxId);
  const header = document.getElementById(headerId);
  if (!box || !header) return;
  let dragging = false;
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;
  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    dragging = true;
    const rect = box.getBoundingClientRect();
    box.classList.add('dragging');
    box.style.left = rect.left + 'px';
    box.style.top = rect.top + 'px';
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const maxLeft = window.innerWidth - 60;
    const maxTop = window.innerHeight - 40;
    box.style.left = Math.min(Math.max(0, startLeft + dx), maxLeft) + 'px';
    box.style.top = Math.min(Math.max(0, startTop + dy), maxTop) + 'px';
  });
  window.addEventListener('mouseup', () => { dragging = false; });
}

/** 데이터가 있는 모든 행을 읽는다 (비교판정/전체선택 등에서 공용으로 사용) */
function readFullRows() {
  const sheet = getSheet();
  const rowNums = getDataRowNumbers(sheet);
  if (rowNums.length === 0) return [];
  const lastRow = sheet.getLastRow();
  const all = sheet.getRange(1, 0, lastRow, COL_COUNT).getValues();
  return rowNums.map((rowNum) => {
    const row = all[rowNum - 1];
    return {
      rowNum,
      checked: isChecked(row[SELECT_COL]),
      area: row[AREA_COL],
      addr: row[ADDR_COL],
      dataType: row[TYPE_COL],
      description: row[DESC_COL] || '',
      tolerance: row[TOLERANCE_COL],
      value: row[VALUE_COL],
      startValue: row[START_COL],
      endValue: row[END_COL],
    };
  });
}

function renderCompareResult(summary) {
  const summaryEl = document.getElementById('trendCompareSummary');
  summaryEl.innerHTML = `
    <div class="gm-summary-item"><div class="num">${summary.total}</div><div class="lbl">비교 항목</div></div>
    <div class="gm-summary-item"><div class="num">${summary.matchPct}%</div><div class="lbl">일치율</div></div>
    <div class="gm-summary-item ok"><div class="num">${summary.okCount}</div><div class="lbl">OK</div></div>
    <div class="gm-summary-item ng"><div class="num">${summary.ngCount}</div><div class="lbl">NG</div></div>
  `;
  const ngWrap = document.getElementById('trendCompareNgWrap');
  const ngItems = summary.items.filter((i) => i.result === 'NG');
  if (ngItems.length === 0) {
    ngWrap.innerHTML = '<p style="color:var(--accent);">NG 항목이 없습니다 (전체 일치)</p>';
    return;
  }
  const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  ngWrap.innerHTML = `
    <table class="gm-ng-table">
      <tr><th>주소</th><th>시작값</th><th>종료값</th><th>변화량</th><th>허용오차(±)</th><th>설명(코멘트)</th></tr>
      ${ngItems.map((i) => `<tr><td>${esc(i.addr)}</td><td class="ng-val">${esc(i.startValue)}</td><td class="ng-val">${esc(i.endValue)}</td><td class="ng-val">${esc(i.diff)}</td><td>±${esc(i.tolerance)}</td><td>${esc(i.description)}</td></tr>`).join('')}
    </table>
  `;
}

function bindToolbarButtons() {
  document.getElementById('monAddRowBtn')?.addEventListener('click', () => {
    const sheet = getSheet();
    const newRowIndex = sheet.getLastRow() + 1;
    sheet.getRange(newRowIndex, 0, 1, COL_COUNT).setValues([['', '1', 'D', '0', 'WORD', 1, '', '', '', '', '', '']]);
  });

  document.getElementById('monDeleteSelectedBtn')?.addEventListener('click', () => {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 1) { toastMsg('삭제할 행이 없습니다.', 'err'); return; }
    const selValues = sheet.getRange(1, SELECT_COL, lastRow, 1).getValues();
    const rows = [];
    selValues.forEach((r, i) => { if (isChecked(r[0])) rows.push(i + 1); });
    if (rows.length === 0) { toastMsg('선택(A열)에 체크한 행이 없습니다.', 'err'); return; }
    rows.sort((a, b) => b - a).forEach((row) => sheet.deleteRows(row, 1));
    toastMsg(`${rows.length}개 행 삭제됨`, 'ok');
  });

  document.getElementById('monClearAllBtn')?.addEventListener('click', () => {
    if (!confirm('전체 변수를 삭제하시겠습니까? (저장 전까지는 서버에 반영되지 않습니다)')) return;
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow >= 1) sheet.getRange(1, 0, lastRow, COL_COUNT).clearContent();
    toastMsg('전체 삭제됨 (저장 버튼을 눌러야 서버에 반영됩니다)', 'ok');
  });

  document.getElementById('monSaveBtn')?.addEventListener('click', saveVariables);

  document.getElementById('monSelectAllBtn')?.addEventListener('click', () => {
    const n = setAllChecks(SELECT_COL, true);
    if (n === 0) { toastMsg('선택할 행이 없습니다.', 'err'); return; }
    toastMsg(`${n}개 행 전체 선택됨`, 'ok');
  });
  document.getElementById('monDeselectAllBtn')?.addEventListener('click', () => {
    const n = setAllChecks(SELECT_COL, false);
    if (n === 0) { toastMsg('해제할 행이 없습니다.', 'err'); return; }
    toastMsg(`${n}개 행 전체 선택 해제됨`, 'ok');
  });

  document.getElementById('monClearSnapshotBtn')?.addEventListener('click', () => {
    const sheet = getSheet();
    const rows = getDataRowNumbers(sheet);
    if (rows.length === 0) { toastMsg('지울 데이터가 없습니다.', 'err'); return; }
    if (!confirm(`시작값·종료값·비교판정(K~M열) 내용을 모두 지울까요? (${rows.length}개 행)`)) return;
    let i = 0;
    while (i < rows.length) {
      let j = i;
      while (j + 1 < rows.length && rows[j + 1] === rows[j] + 1) j++;
      const startRow = rows[i];
      const count = j - i + 1;
      sheet.getRange(startRow, START_COL, count, 3).clearContent(); // K,L,M 3개 열
      i = j + 1;
    }
    toastMsg(`${rows.length}개 행의 시작값·종료값·비교판정 내용을 지웠습니다.`, 'ok');
  });

  document.getElementById('monCompareBtn')?.addEventListener('click', () => {
    const rows = readFullRows().filter((r) => r.checked);
    if (rows.length === 0) {
      toastMsg('선택(A열)에 체크된 행이 없습니다. 비교할 행을 먼저 선택하세요.', 'err');
      return;
    }
    const sheet = getSheet();
    const items = [];
    let okCount = 0;
    rows.forEach((r) => {
      const start = toNumberOrNull(r.startValue);
      const end = toNumberOrNull(r.endValue);
      const tolerance = toNumberOrNull(r.tolerance);
      const diff = start !== null && end !== null ? Math.round((start - end) * 100) / 100 : null;
      // 시작값/종료값/허용오차 중 하나라도 없으면 판정 불가로 NG 처리한다.
      // 변화량(diff)의 절댓값이 허용오차 이내면 OK, 벗어나면(±) NG.
      const ok = diff !== null && tolerance !== null && Math.abs(diff) <= tolerance;
      if (ok) okCount++;
      items.push({
        addr: `${r.area}${r.addr}`, description: r.description,
        startValue: r.startValue ?? '', endValue: r.endValue ?? '', diff: diff ?? '',
        tolerance: r.tolerance ?? '', result: ok ? 'OK' : 'NG',
      });
      sheet.getRange(r.rowNum, COMPARE_COL, 1, 1).setValues([[ok ? 'OK' : 'NG']]);
      const cell = sheet.getRange(r.rowNum, COMPARE_COL, 1, 1);
      if (cell.setFontColor) cell.setFontColor(ok ? null : '#c23c3c');
    });
    const ngCount = rows.length - okCount;
    const matchPct = rows.length > 0 ? Math.round((okCount / rows.length) * 1000) / 10 : 0;
    renderCompareResult({ total: rows.length, okCount, ngCount, matchPct, items });
    openModal('trendCompareResultModal');
  });
  document.getElementById('trendCompareResultClose')?.addEventListener('click', () => closeModal('trendCompareResultModal'));
  setupDraggableModal('trendCompareResultBox', 'trendCompareResultHeader');

  // Excel 불러오기/내보내기 (기존 /api/trend/variables/* 엔드포인트 재사용)
  const importFile = document.getElementById('monImportFile');
  document.getElementById('monLoadBtn')?.addEventListener('click', () => {
    if (!importFile) return;
    importFile.value = '';
    importFile.click();
  });
  importFile?.addEventListener('change', async () => {
    const file = importFile.files && importFile.files[0];
    if (!file) return;
    try {
      const fileBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/trend/variables/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64 }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '불러오기 실패');
      loadVariablesIntoSheet(data.variables);
      toastMsg(`Excel에서 변수 ${data.variables.length}개 불러옴`, 'ok');
    } catch (e) {
      toastMsg('Excel 불러오기 실패: ' + e.message, 'err');
    }
  });

  document.getElementById('monExportExcelBtn')?.addEventListener('click', async () => {
    await saveVariables();
    await fetchAndSave(
      '/api/trend/variables/export/xlsx',
      `Trend_비교_${Date.now()}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  });
}

// ── 실시간 값 반영 (monitoring.js가 WS 'trendValues'를 받아서 호출) ──
// 서버(trendManager.js)는 label이 아니라 "저장 시점의 변수 순서(index)"로 값을 매겨 보낸다.
let indexToRow = new Map();
function rebuildIndexToRow() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  indexToRow.clear();
  if (lastRow < 1) return;
  const rows = sheet.getRange(1, 0, lastRow, COL_COUNT).getValues();
  let index = 0;
  rows.forEach((row, i) => {
    const v = rowToVariable(row);
    if (!v || !DATA_TYPES.includes(v.dataType)) return;
    indexToRow.set(index, i + 1);
    index += 1;
  });
}

function applyValues(values) {
  if (isEditingCell) return;
  rebuildIndexToRow();
  if (indexToRow.size === 0) return;
  const sheet = getSheet();
  const rowsToUpdate = [];
  for (const [key, value] of Object.entries(values)) {
    const row = indexToRow.get(Number(key));
    if (row === undefined) continue;
    rowsToUpdate.push({ row, value: value === null || value === undefined ? '' : value });
  }
  if (rowsToUpdate.length === 0) return;
  rowsToUpdate.sort((a, b) => a.row - b.row);
  let i = 0;
  while (i < rowsToUpdate.length) {
    let j = i;
    while (j + 1 < rowsToUpdate.length && rowsToUpdate[j + 1].row === rowsToUpdate[j].row + 1) j++;
    const startRow = rowsToUpdate[i].row;
    const chunk = rowsToUpdate.slice(i, j + 1).map((r) => [r.value]);
    sheet.getRange(startRow, VALUE_COL, chunk.length, 1).setValues(chunk);
    i = j + 1;
  }
}

/** 현재값(J열)을 시작값(K열)/종료값(L열)으로 복사한다 - 시작/정지 버튼과 연동. */
function captureSnapshot(target) {
  const sheet = getSheet();
  const rows = getDataRowNumbers(sheet);
  if (rows.length === 0) return;
  const targetCol = target === 'start' ? START_COL : END_COL;
  const all = sheet.getRange(1, 0, sheet.getLastRow(), COL_COUNT).getValues();
  let i = 0;
  while (i < rows.length) {
    let j = i;
    while (j + 1 < rows.length && rows[j + 1] === rows[j] + 1) j++;
    const startRow = rows[i];
    const count = j - i + 1;
    const chunk = [];
    for (let k = 0; k < count; k++) {
      const val = all[rows[i + k] - 1][VALUE_COL];
      chunk.push([val === undefined || val === null ? '' : val]);
    }
    sheet.getRange(startRow, targetCol, count, 1).setValues(chunk);
    i = j + 1;
  }
}

function getVariables() {
  return readAllVariables().variables;
}

// ── 마운트 ──
// 이 위젯은 monitoring.html의 #trendGridContainer 전용으로 만들어졌으므로, 스크립트가
// 로드되는 즉시 스스로 마운트한다(외부에서 별도로 호출할 필요 없음). module 스크립트는
// HTML 파싱이 끝난 뒤에야 실행되므로, monitoring.js(동기 classic 스크립트)가 이미 실행된
// 뒤에 window.trendGridApi가 채워진다 - monitoring.js는 'trendGridReady' 이벤트를 기다려
// 그 뒤에 API를 사용해야 한다.
async function mountTrendGrid(containerId) {
  containerElId = containerId;
  const { univerAPI: api } = createUniver({
    locale: LocaleType.KO_KR,
    locales: {
      [LocaleType.KO_KR]: mergeLocales(sheetsCoreKoKR, sheetsDataValidationKoKR),
    },
    presets: [
      UniverSheetsCorePreset({ container: containerId }),
      UniverSheetsDataValidationPreset(),
    ],
  });
  univerAPI = api;

  workbook = univerAPI.createWorkbook({
    id: 'trend-variables',
    name: '트렌드 변수 목록',
    sheets: {
      'sheet-1': { id: 'sheet-1', name: '변수 목록', rowCount: MAX_ROWS, columnCount: COL_COUNT },
    },
  });

  applyTemplate(getSheet());
  univerAPI.addEvent(univerAPI.Event.SheetCreated, ({ worksheet }) => {
    try { applyTemplate(worksheet); } catch (e) { console.warn('새 시트에 서식 적용 실패:', e); }
  });

  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));

  univerAPI.addEvent(univerAPI.Event.SheetEditStarted, () => { isEditingCell = true; });
  univerAPI.addEvent(univerAPI.Event.SheetEditEnded, () => { isEditingCell = false; });

  bindToolbarButtons();
  // 시트에 실제 변수 행이 채워지기 전에 window.trendGridApi가 먼저 공개되면, monitoring.js가
  // 연결 직후 빠르게 시작을 눌렀을 때 캡처/값반영이 빈 시트에 조용히 무시되는 경쟁 상태가
  // 있었다 - 불러오기가 끝난 뒤에야 API를 공개하고 'trendGridReady'를 알린다.
  await fetchVariables();

  window.trendGridApi = {
    applyValues,
    captureStart: () => captureSnapshot('start'),
    captureEnd: () => captureSnapshot('end'),
    getVariables,
    labelFor,
  };
  window.dispatchEvent(new CustomEvent('trendGridReady', { detail: window.trendGridApi }));
  return window.trendGridApi;
}

mountTrendGrid('trendGridContainer');
