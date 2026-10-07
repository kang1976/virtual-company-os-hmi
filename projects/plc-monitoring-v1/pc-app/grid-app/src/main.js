import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import sheetsCoreKoKR from '@univerjs/preset-sheets-core/locales/ko-KR';
import '@univerjs/preset-sheets-core/lib/index.css';
import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation';
import sheetsDataValidationKoKR from '@univerjs/preset-sheets-data-validation/locales/ko-KR';

// ── 컬럼 정의 ──
// A:선택(체크박스) B:변수명 C:영역 D:주소(워드 또는 "워드.비트") E:타입 F:길이(STRING전용,워드수)
// G:설명(코멘트) H:현재값 I:설정값(쓰기) J:Snapshots(Start) K:Snapshots(End) L:비교판정(OK/NG)
const HEADER = [
  '선택', '변수명', '영역(D/H/W/CIO/E0..)', '주소 (예: 100 또는 100.5)', '타입', '길이(STRING, 워드수)',
  '설명(코멘트)', '현재값', '설정값(쓰기)', 'Snapshots(Start)', 'Snapshots(End)', '비교판정',
];
const COL_COUNT = HEADER.length;
const SELECT_COL = 0; // 여러 행을 체크해서 한 번에 삭제/비교하기 위한 선택 열
const AREA_COL = 2;
const ADDR_COL = 3;
const TYPE_COL = 4;
const DESC_COL = 6;
const VALUE_COL = 7;
const SETTING_COL = 8;
const SNAP_START_COL = 9;
const SNAP_END_COL = 10;
const COMPARE_COL = 11;
const MAX_ROWS = 200;

export const DATA_TYPES = [
  'INT', 'BOOL', 'DINT', 'LINT', 'UINT', 'UDINT', 'ULINT',
  'UBCD', 'UDBCD', 'ULBCD', 'WORD', 'DWORD', 'LWORD', 'REAL', 'LREAL', 'STRING',
];
const AREA_OPTIONS = ['D', 'H', 'W', 'CIO', ...Array.from({ length: 25 }, (_, i) => `E${i}`)];

// ── Univer 초기화 ──
const { univerAPI } = createUniver({
  locale: LocaleType.KO_KR,
  locales: {
    [LocaleType.KO_KR]: mergeLocales(sheetsCoreKoKR, sheetsDataValidationKoKR),
  },
  presets: [
    UniverSheetsCorePreset({ container: 'univer-container' }),
    UniverSheetsDataValidationPreset(),
  ],
});

const workbook = univerAPI.createWorkbook({
  id: 'plc-variables',
  name: 'PLC 변수 목록',
  sheets: {
    'sheet-1': {
      id: 'sheet-1',
      name: '변수 목록',
      rowCount: MAX_ROWS,
      columnCount: COL_COUNT,
    },
  },
});

function getSheet() {
  return workbook.getActiveSheet();
}

function writeHeader(sheet) {
  sheet.getRange(0, 0, 1, COL_COUNT).setValues([HEADER]);
}

// ── 영역/타입 컬럼에 드롭다운(데이터 유효성 검사) + 선택 컬럼에 체크박스 적용 ──
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
    // 선택 열: 체크박스. 체크=1, 해제=0 으로 저장되며, "선택 삭제" 버튼이 이 값을 읽는다.
    const checkboxRule = univerAPI.newDataValidation().requireCheckbox('1', '0').build();
    sheet.getRange(1, SELECT_COL, MAX_ROWS - 1, 1).setDataValidation(checkboxRule);
  } catch (e) {
    console.warn('선택 열 체크박스 적용 실패:', e);
  }
}

/** 새 시트든 처음 시트든, 변수 목록용 서식(헤더+드롭다운)을 동일하게 적용 */
function applyTemplate(sheet) {
  writeHeader(sheet);
  applyDropdowns(sheet);
}

applyTemplate(getSheet());

// 시트 탭의 "+"로 새 시트를 추가해도 빈 엑셀 시트가 아니라
// 변수 목록과 같은 헤더/드롭다운 서식이 자동으로 적용되도록 한다.
univerAPI.addEvent(univerAPI.Event.SheetCreated, ({ worksheet }) => {
  try {
    applyTemplate(worksheet);
  } catch (e) {
    console.warn('새 시트에 서식 적용 실패:', e);
  }
});

// 컨테이너 레이아웃(flex) 계산이 끝난 뒤 Univer 캔버스 크기가 확실히 맞춰지도록
// 다음 프레임에 한 번 더 resize 이벤트를 강제로 보냄 (초기 렌더 타이밍 이슈 방지용 안전장치)
requestAnimationFrame(() => {
  window.dispatchEvent(new Event('resize'));
});

// 사용자가 셀(특히 "설정값" 컬럼)을 편집 중일 때 폴링이 setValues()로 다른 셀을 갱신하면
// 편집 중이던 셀의 입력이 취소되는 문제가 있었다. 편집 시작~종료 구간에는 값 반영을
// 잠시 멈춰서, 타이핑 도중 매 폴링 주기마다 선택/입력이 끊기지 않도록 한다.
let isEditingCell = false;
univerAPI.addEvent(univerAPI.Event.SheetEditStarted, () => {
  isEditingCell = true;
});
univerAPI.addEvent(univerAPI.Event.SheetEditEnded, () => {
  isEditingCell = false;
});

// ── 유틸 ──
function toast(message, kind = '') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast show ${kind}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.className = 'toast';
  }, 2500);
}

/**
 * 파일 Blob을 저장한다. Chrome/Edge(File System Access API 지원)에서는 실제 "다른 이름으로
 * 저장" 창이 떠서 폴더/파일명을 직접 고를 수 있고, 미지원 브라우저(Firefox 등)에서는 기존처럼
 * 앵커 다운로드로 대체된다(브라우저 기본 다운로드 폴더로 저장됨).
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
      // 그 외 실패 시 기존 다운로드 방식으로 폴백
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
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

function rowToVariable(row) {
  // 첫 요소(선택 체크박스 열)는 변수 데이터가 아니므로 건너뛴다.
  const [, label, area, addressRaw, dataType, length] = row;
  if (label === null || label === undefined || String(label).trim() === '') return null;
  const { address, bit } = parseAddress(addressRaw);
  const description = row[DESC_COL];
  return {
    label: String(label).trim(),
    area: String(area || '').trim().toUpperCase(),
    address,
    bit,
    dataType: String(dataType || 'WORD').trim().toUpperCase(),
    length: Number(length) || 1,
    description: description === null || description === undefined ? '' : String(description),
  };
}

/** L열(비교판정) 뒤에 사용자가 자유롭게 추가한 열들의 1행 헤더 텍스트 목록 */
function currentExtraHeaders(sheet) {
  const maxCols = sheet.getMaxColumns();
  if (maxCols <= COL_COUNT) return [];
  const row = sheet.getRange(0, COL_COUNT, 1, maxCols - COL_COUNT).getValues()[0];
  return row.map((h) => (h === null || h === undefined ? '' : String(h).trim()));
}

function readAllVariables() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  const extraHeaders = currentExtraHeaders(sheet);
  if (lastRow < 1) return { variables: [], errors: [], extraHeaders };
  const totalCols = COL_COUNT + extraHeaders.length;
  const rows = sheet.getRange(1, 0, lastRow, totalCols).getValues();
  const variables = [];
  const errors = [];
  rows.forEach((row, idx) => {
    const v = rowToVariable(row);
    if (!v) return;
    if (!v.area) {
      errors.push(`${idx + 2}행: 영역이 비어 있습니다.`);
      return;
    }
    if (!DATA_TYPES.includes(v.dataType)) {
      errors.push(`${idx + 2}행: 타입 "${v.dataType}"은(는) 지원하지 않습니다.`);
      return;
    }
    if (extraHeaders.length > 0) {
      const extra = {};
      extraHeaders.forEach((h, i) => {
        if (!h) return;
        const cell = row[COL_COUNT + i];
        extra[h] = cell === null || cell === undefined ? '' : cell;
      });
      v.extra = extra;
    }
    variables.push(v);
  });
  return { variables, errors, extraHeaders };
}

/** 설정값(SETTING_COL)까지 포함해서 읽음 - 적용(쓰기) 버튼용 */
function readAllVariablesWithSetting() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];
  const rows = sheet.getRange(1, 0, lastRow, COL_COUNT).getValues();
  const result = [];
  rows.forEach((row) => {
    const v = rowToVariable(row);
    if (!v) return;
    const setting = row[SETTING_COL];
    result.push({ ...v, value: setting === undefined || setting === null ? '' : setting });
  });
  return result;
}

function loadVariablesIntoSheet(variables, extraHeaders = [], layout = null) {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  const currentMaxCols = sheet.getMaxColumns();
  const totalCols = COL_COUNT + extraHeaders.length;
  if (lastRow >= 1) {
    sheet.getRange(1, 0, lastRow, Math.max(currentMaxCols, totalCols)).clearContent();
  }
  // 저장되어 있던 사용자 정의 열 개수만큼 시트 열이 부족하면 늘려서 헤더를 복원한다.
  // (사용자가 그 뒤로 열을 더 추가했을 수도 있으니 줄이지는 않는다)
  if (currentMaxCols < totalCols) {
    sheet.insertColumnsAfter(currentMaxCols - 1, totalCols - currentMaxCols);
  }
  if (extraHeaders.length > 0) {
    sheet.getRange(0, COL_COUNT, 1, extraHeaders.length).setValues([extraHeaders]);
  }
  if (variables && variables.length > 0) {
    const rows = variables.map((v) => {
      // 맨 앞은 선택 체크박스 열 - 불러올 때는 항상 체크 해제 상태('')로 채운다.
      // 현재값/설정값/스냅샷/비교판정은 세션 중 계산되는 값이라 변수 목록 자체에는 저장되지 않고,
      // 불러올 때는 항상 빈 칸에서 시작한다(설명(코멘트)만 변수 정의의 일부로 함께 저장/복원됨).
      const base = [
        '', v.label, v.area, formatAddress(v.address, v.bit, v.dataType), v.dataType, v.length || 1,
        v.description || '', '', '', '', '', '',
      ];
      const extra = extraHeaders.map((h) => (v.extra && v.extra[h] !== undefined ? v.extra[h] : ''));
      return [...base, ...extra];
    });
    sheet.getRange(1, 0, rows.length, totalCols).setValues(rows);
  }
  applyLayout(sheet, layout, variables ? variables.length : 0);
}

// ── 서버와 변수 목록 동기화 ──
async function fetchVariables() {
  try {
    const res = await fetch('/api/variables');
    const data = await res.json();
    if (data.ok) {
      loadVariablesIntoSheet(data.variables, data.extraHeaders || [], data.layout || null);
      // 화면을 열 때 열 폭을 내용에 맞게 자동조정한다("그리드 화면을 열 때 열폭 자동맞춤"
      // 요청) - 단, 저장된 사용자 지정 열 폭(data.layout)이 있으면 그걸 우선한다(이미
      // 그 목적으로 만들어진 기능이라 자동맞춤이 덮어쓰면 안 됨).
      if (!data.layout) {
        try { getSheet().autoResizeColumns(0, COL_COUNT + (data.extraHeaders || []).length); } catch (e) { /* 무시 */ }
      }
      toast(`변수 ${data.variables.length}개 불러옴`, 'ok');
    }
  } catch (e) {
    toast('변수 목록 조회 실패: ' + e.message, 'err');
  }
}

// ── 셀 서식(열 너비/행 높이) 저장·복원 ──
// 변수 목록을 저장할 때 셀 값만 저장되고 사용자가 조정한 열 너비/행 높이가 초기화되는
// 문제가 있어서, 시트 서식도 함께 저장해 불러올 때 그대로 복원한다.
function captureLayout(sheet, totalCols) {
  const colWidths = [];
  for (let c = 0; c < totalCols; c++) {
    try {
      colWidths.push(sheet.getColumnWidth(c));
    } catch (e) {
      colWidths.push(null);
    }
  }
  let headerHeight = null;
  let rowHeight = null;
  try { headerHeight = sheet.getRowHeight(0); } catch (e) { /* ignore */ }
  try { rowHeight = sheet.getRowHeight(1); } catch (e) { /* ignore */ }
  return { colWidths, headerHeight, rowHeight };
}

function applyLayout(sheet, layout, totalRows) {
  if (!layout) return;
  try {
    if (Array.isArray(layout.colWidths)) {
      layout.colWidths.forEach((w, c) => {
        if (typeof w === 'number' && w > 0) sheet.setColumnWidth(c, w);
      });
    }
    if (typeof layout.headerHeight === 'number' && layout.headerHeight > 0) {
      sheet.setRowHeightsForced(0, 1, layout.headerHeight);
    }
    if (typeof layout.rowHeight === 'number' && layout.rowHeight > 0 && totalRows > 0) {
      sheet.setRowHeightsForced(1, totalRows, layout.rowHeight);
    }
  } catch (e) {
    console.warn('셀 서식 복원 실패:', e);
  }
}

async function saveVariables() {
  const { variables, errors, extraHeaders } = readAllVariables();
  if (errors.length > 0) {
    toast(`저장 실패 - ${errors[0]}${errors.length > 1 ? ` 외 ${errors.length - 1}건` : ''}`, 'err');
    return false;
  }
  const sheet = getSheet();
  const layout = captureLayout(sheet, COL_COUNT + extraHeaders.length);
  try {
    const res = await fetch('/api/variables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variables, extraHeaders, layout }),
    });
    const data = await res.json();
    if (data.ok) {
      toast(`변수 ${variables.length}개 저장 완료`, 'ok');
      return true;
    }
    toast('저장 실패: ' + data.error, 'err');
    return false;
  } catch (e) {
    toast('저장 실패: ' + e.message, 'err');
    return false;
  }
}

// ── 툴바 동작 ──
document.getElementById('addRowBtn').addEventListener('click', () => {
  const sheet = getSheet();
  const newRowIndex = sheet.getLastRow() + 1;
  sheet.getRange(newRowIndex, 0, 1, COL_COUNT).setValues([['', 'NEW_VAR', 'D', '0', 'WORD', 1, '', '', '', '', '', '']]);
});

// ── 전체 타입 일괄 변경 (그리드 맨 위 툴바) ──
const bulkTypeSelect = document.getElementById('bulkTypeSelect');
for (const t of DATA_TYPES) {
  const opt = document.createElement('option');
  opt.value = t;
  opt.textContent = t;
  bulkTypeSelect.appendChild(opt);
}
document.getElementById('bulkTypeApplyBtn').addEventListener('click', () => {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) {
    toast('변경할 행이 없습니다.', 'err');
    return;
  }
  const type = bulkTypeSelect.value;
  const rows = Array.from({ length: lastRow }, () => [type]);
  sheet.getRange(1, TYPE_COL, lastRow, 1).setValues(rows);
  toast(`${lastRow}개 행의 타입을 전부 ${type}(으)로 변경했습니다.`, 'ok');
});

/** 선택 열 체크박스 값이 체크 상태인지 판정 (체크=1/'1'/true/'TRUE' 등 다양한 표현 허용) */
function isRowChecked(v) {
  return v === 1 || v === true || v === '1' || String(v).trim().toUpperCase() === 'TRUE';
}

document.getElementById('deleteSelectedBtn').addEventListener('click', () => {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) {
    toast('삭제할 행이 없습니다.', 'err');
    return;
  }
  // 선택 열(A열)에서 체크된 행을 찾아 아래에서부터 삭제한다.
  const selValues = sheet.getRange(1, SELECT_COL, lastRow, 1).getValues();
  const rows = [];
  selValues.forEach((r, i) => {
    if (isRowChecked(r[0])) rows.push(i + 1); // getRange가 1행부터라 시트 실제 행 = i+1
  });
  if (rows.length === 0) {
    toast('선택 열(A열)에 체크한 행이 없습니다.', 'err');
    return;
  }
  rows.sort((a, b) => b - a).forEach((row) => sheet.deleteRows(row, 1));
  toast(`${rows.length}개 행 삭제됨`, 'ok');
});

/** 시트 실제 행 번호(1부터) 목록. 데이터가 있는(label이 채워진) 행만 대상으로 한다. */
function getDataRowNumbers(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];
  const labels = sheet.getRange(1, 1, lastRow, 1).getValues();
  const rows = [];
  labels.forEach((r, i) => {
    if (r[0] !== null && r[0] !== undefined && String(r[0]).trim() !== '') rows.push(i + 1);
  });
  return rows;
}

/** A열(선택) 체크박스를 데이터가 있는 모든 행에 대해 일괄로 켜거나(checked='1') 끈다('0'). */
function setAllChecks(checked) {
  const sheet = getSheet();
  const rows = getDataRowNumbers(sheet);
  if (rows.length === 0) return 0;
  const value = checked ? '1' : '0';
  // 연속 구간별로 묶어서 한 번에 setValues (행마다 개별 호출하지 않도록)
  let i = 0;
  while (i < rows.length) {
    let j = i;
    while (j + 1 < rows.length && rows[j + 1] === rows[j] + 1) j++;
    const startRow = rows[i];
    const count = j - i + 1;
    sheet.getRange(startRow, SELECT_COL, count, 1).setValues(Array.from({ length: count }, () => [value]));
    i = j + 1;
  }
  return rows.length;
}

document.getElementById('selectAllBtn').addEventListener('click', () => {
  const n = setAllChecks(true);
  if (n === 0) { toast('선택할 행이 없습니다.', 'err'); return; }
  toast(`${n}개 행 전체 선택됨`, 'ok');
});

document.getElementById('deselectAllBtn').addEventListener('click', () => {
  const n = setAllChecks(false);
  if (n === 0) { toast('해제할 행이 없습니다.', 'err'); return; }
  toast(`${n}개 행 전체 선택 해제됨`, 'ok');
});

document.getElementById('addColBtn').addEventListener('click', () => {
  const sheet = getSheet();
  const maxCols = sheet.getMaxColumns();
  const newColIndex = maxCols; // 새로 추가될 열의 0-based 위치
  sheet.insertColumnAfter(maxCols - 1);
  sheet.getRange(0, newColIndex, 1, 1).setValues([[`열${newColIndex - COL_COUNT + 1}`]]);
  toast('열이 추가되었습니다. 1행 헤더 텍스트를 원하는 이름(예: 비고)으로 바꿔보세요.', 'ok');
});

document.getElementById('clearAllBtn').addEventListener('click', () => {
  if (!confirm('전체 변수를 삭제하시겠습니까? (저장 전까지는 서버에 반영되지 않습니다)')) return;
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow >= 1) {
    sheet.getRange(1, 0, lastRow, COL_COUNT).clearContent();
  }
  toast('전체 삭제됨 (저장 버튼을 눌러야 서버에 반영됩니다)', 'ok');
});

document.getElementById('saveBtn').addEventListener('click', saveVariables);

document.getElementById('applyBtn').addEventListener('click', async () => {
  const rows = readAllVariablesWithSetting().filter((r) => r.value !== '');
  if (rows.length === 0) {
    toast('설정값 컬럼에 쓸 값을 입력하세요.', 'err');
    return;
  }
  if (!confirm(`${rows.length}개 변수에 값을 쓰겠습니다. 계속할까요?`)) return;
  try {
    const res = await fetch('/api/grid/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    const data = await res.json();
    if (!data.ok) {
      toast('쓰기 실패: ' + data.error, 'err');
      return;
    }
    const failed = data.results.filter((r) => !r.ok);
    if (failed.length === 0) {
      toast(`${data.results.length}개 변수 쓰기 완료`, 'ok');
    } else {
      toast(`${failed.length}개 실패 (${failed[0].label}: ${failed[0].error})`, 'err');
    }
  } catch (e) {
    toast('쓰기 실패: ' + e.message, 'err');
  }
});

// ── 스냅샷 · 비교판정 ──
// 간단한 모달 열기/닫기 헬퍼 (스냅샷 선택 모달 + 비교판정 결과 모달 공용)
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
document.getElementById('snapshotModalClose').addEventListener('click', () => closeModal('snapshotModal'));
document.getElementById('compareResultClose').addEventListener('click', () => closeModal('compareResultModal'));

// ── 비교판정 결과 창 드래그 이동 (크기 조절은 CSS resize: both가 처리) ──
// 헤더를 누른 채 드래그하면 position:fixed로 전환해 마우스를 따라 옮긴다. 창을 닫았다가 다시
// 열어도 마지막으로 옮긴 위치가 유지된다(다시 가운데로 돌아가지 않음).
(function setupDraggableModal() {
  const box = document.getElementById('compareResultBox');
  const header = document.getElementById('compareResultHeader');
  if (!box || !header) return;
  let dragging = false;
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;

  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return; // 닫기 버튼 클릭은 드래그로 취급하지 않음
    dragging = true;
    const rect = box.getBoundingClientRect();
    // 첫 드래그 시점에 현재 화면상 위치를 그대로 fixed 좌표로 고정해서, 드래그 시작과 동시에
    // 위치가 튀지 않게 한다.
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
})();

/** 데이터가 있는 모든 행을 { rowNum, label, area, addr, dataType, description, value, setting, snapStart, snapEnd, checked } 로 읽는다 */
function readFullGridRows() {
  const sheet = getSheet();
  const rowNums = getDataRowNumbers(sheet);
  if (rowNums.length === 0) return [];
  const lastRow = sheet.getLastRow();
  const all = sheet.getRange(1, 0, lastRow, COL_COUNT).getValues();
  return rowNums.map((rowNum) => {
    const row = all[rowNum - 1];
    return {
      rowNum,
      checked: isRowChecked(row[SELECT_COL]),
      label: row[1],
      area: row[AREA_COL],
      addr: row[ADDR_COL],
      dataType: row[TYPE_COL],
      description: row[DESC_COL] || '',
      value: row[VALUE_COL],
      setting: row[SETTING_COL],
      snapStart: row[SNAP_START_COL],
      snapEnd: row[SNAP_END_COL],
    };
  });
}

document.getElementById('snapshotBtn').addEventListener('click', () => {
  const rows = readFullGridRows();
  if (rows.length === 0) {
    toast('스냅샷을 찍을 변수가 없습니다.', 'err');
    return;
  }
  openModal('snapshotModal');
});

async function takeSnapshot(target) {
  closeModal('snapshotModal');
  const sheet = getSheet();
  const rows = readFullGridRows();
  const targetCol = target === 'start' ? SNAP_START_COL : SNAP_END_COL;

  // 현재값(H열)을 선택한 스냅샷 열로 복사 (연속 구간 단위로 setValues)
  const rowNums = rows.map((r) => r.rowNum);
  let i = 0;
  while (i < rowNums.length) {
    let j = i;
    while (j + 1 < rowNums.length && rowNums[j + 1] === rowNums[j] + 1) j++;
    const startRow = rowNums[i];
    const chunk = rows.slice(i, j + 1).map((r) => [r.value === undefined || r.value === null ? '' : r.value]);
    sheet.getRange(startRow, targetCol, chunk.length, 1).setValues(chunk);
    i = j + 1;
  }

  // 파일 저장용 페이로드 - 방금 복사한 값을 반영해서 보낸다
  const filePayload = rows.map((r) => ({
    label: r.label, area: r.area, addr: r.addr, dataType: r.dataType, description: r.description,
    value: r.value ?? '',
    snapStart: target === 'start' ? (r.value ?? '') : (r.snapStart ?? ''),
    snapEnd: target === 'end' ? (r.value ?? '') : (r.snapEnd ?? ''),
  }));

  try {
    const res = await fetch('/api/variables/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: filePayload }),
    });
    const data = await res.json();
    if (!data.ok) { toast('스냅샷 저장 실패: ' + data.error, 'err'); return; }
    toast(`Snapshots(${target === 'start' ? 'Start' : 'End'})에 ${rows.length}개 값 복사 + 파일 저장 완료`, 'ok');
  } catch (e) {
    toast('스냅샷 저장 실패: ' + e.message, 'err');
  }
}
document.getElementById('snapshotPickStart').addEventListener('click', () => takeSnapshot('start'));
document.getElementById('snapshotPickEnd').addEventListener('click', () => takeSnapshot('end'));

document.getElementById('clearSnapshotBtn').addEventListener('click', () => {
  const sheet = getSheet();
  const rows = getDataRowNumbers(sheet);
  if (rows.length === 0) { toast('지울 데이터가 없습니다.', 'err'); return; }
  if (!confirm(`Snapshots(Start)·Snapshots(End)·비교판정(J~L열) 내용을 모두 지울까요? (${rows.length}개 행)`)) return;
  let i = 0;
  while (i < rows.length) {
    let j = i;
    while (j + 1 < rows.length && rows[j + 1] === rows[j] + 1) j++;
    const startRow = rows[i];
    const count = j - i + 1;
    sheet.getRange(startRow, SNAP_START_COL, count, 3).clearContent(); // J,K,L 3개 열
    i = j + 1;
  }
  toast(`${rows.length}개 행의 스냅샷·비교판정 내용을 지웠습니다.`, 'ok');
});

/** 두 값이 완전히 같은지(문자열 기준) 판정한다. null/undefined는 빈 문자열로 취급. */
function valuesEqual(a, b) {
  const norm = (v) => (v === null || v === undefined ? '' : String(v).trim());
  return norm(a) === norm(b);
}

let lastCompareSummary = null;

document.getElementById('compareJudgeBtn').addEventListener('click', () => {
  const rows = readFullGridRows().filter((r) => r.checked);
  if (rows.length === 0) {
    toast('A열(선택)에 체크된 행이 없습니다. 비교할 행을 먼저 선택하세요.', 'err');
    return;
  }
  const sheet = getSheet();
  const items = [];
  let okCount = 0;
  rows.forEach((r) => {
    const ok = valuesEqual(r.snapStart, r.snapEnd);
    if (ok) okCount++;
    items.push({
      label: r.label, description: r.description, snapStart: r.snapStart ?? '', snapEnd: r.snapEnd ?? '',
      result: ok ? 'OK' : 'NG',
    });
    sheet.getRange(r.rowNum, COMPARE_COL, 1, 1).setValues([[ok ? 'OK' : 'NG']]);
    const cell = sheet.getRange(r.rowNum, COMPARE_COL, 1, 1);
    if (cell.setFontColor) cell.setFontColor(ok ? null : '#c23c3c');
  });
  const ngCount = rows.length - okCount;
  const matchPct = rows.length > 0 ? Math.round((okCount / rows.length) * 1000) / 10 : 0;
  lastCompareSummary = { total: rows.length, okCount, ngCount, matchPct, items };
  renderCompareResult(lastCompareSummary);
  openModal('compareResultModal');
});

function renderCompareResult(summary) {
  const summaryEl = document.getElementById('compareSummary');
  summaryEl.innerHTML = `
    <div class="gm-summary-item"><div class="num">${summary.total}</div><div class="lbl">비교 항목</div></div>
    <div class="gm-summary-item"><div class="num">${summary.matchPct}%</div><div class="lbl">일치율</div></div>
    <div class="gm-summary-item ok"><div class="num">${summary.okCount}</div><div class="lbl">OK</div></div>
    <div class="gm-summary-item ng"><div class="num">${summary.ngCount}</div><div class="lbl">NG</div></div>
  `;
  const ngWrap = document.getElementById('compareNgWrap');
  const ngItems = summary.items.filter((i) => i.result === 'NG');
  if (ngItems.length === 0) {
    ngWrap.innerHTML = '<p style="color:var(--accent);">NG 항목이 없습니다 (전체 일치)</p>';
    return;
  }
  const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  ngWrap.innerHTML = `
    <table class="gm-ng-table">
      <tr><th>변수명</th><th>Start</th><th>End</th><th>설명(코멘트)</th></tr>
      ${ngItems.map((i) => `<tr><td>${esc(i.label)}</td><td class="ng-val">${esc(i.snapStart)}</td><td class="ng-val">${esc(i.snapEnd)}</td><td>${esc(i.description)}</td></tr>`).join('')}
    </table>
  `;
}

async function downloadCompareReport(format) {
  if (!lastCompareSummary) return;
  try {
    const res = await fetch('/api/variables/compare-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: lastCompareSummary, format }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast('리포트 생성 실패: ' + (err.error || res.statusText), 'err');
      return;
    }
    const blob = await res.blob();
    const ext = format === 'pdf' ? 'pdf' : 'xlsx';
    const suggestedName = `비교_결과_Report_${Date.now()}.${ext}`;
    await saveBlobWithPicker(blob, suggestedName, format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    toast('리포트 저장 완료', 'ok');
  } catch (e) {
    if (e && e.name === 'AbortError') return; // 사용자가 저장 창을 취소함 - 조용히 무시
    toast('리포트 저장 실패: ' + e.message, 'err');
  }
}
document.getElementById('compareExportXlsxBtn').addEventListener('click', () => downloadCompareReport('xlsx'));
document.getElementById('compareExportPdfBtn').addEventListener('click', () => downloadCompareReport('pdf'));

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
      toast('내보내기 실패: ' + (err.error || res.statusText), 'err');
      return;
    }
    const blob = await res.blob();
    const suggestedName = filenameFromResponse(res, fallbackName);
    await saveBlobWithPicker(blob, suggestedName, mimeType);
    toast('저장 완료', 'ok');
  } catch (e) {
    if (e && e.name === 'AbortError') return; // 사용자가 저장 창을 취소함
    toast('내보내기 실패: ' + e.message, 'err');
  }
}

document.getElementById('exportExcelBtn').addEventListener('click', async () => {
  await saveVariables();
  await fetchAndSave(
    '/api/variables/export/xlsx',
    `Recipe_${Date.now()}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
});

/** File 객체를 base64 문자열로 읽는다 (data URL 접두어는 잘라냄) */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const importExcelFile = document.getElementById('importExcelFile');
document.getElementById('importExcelBtn').addEventListener('click', () => {
  importExcelFile.value = '';
  importExcelFile.click();
});
importExcelFile.addEventListener('change', async () => {
  const file = importExcelFile.files && importExcelFile.files[0];
  if (!file) return;
  try {
    const fileBase64 = await fileToBase64(file);
    const res = await fetch('/api/variables/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileBase64 }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || '불러오기 실패');
    loadVariablesIntoSheet(data.variables, data.extraHeaders || []);
    toast(`Excel에서 변수 ${data.variables.length}개 불러옴`, 'ok');
  } catch (e) {
    toast('Excel 불러오기 실패: ' + e.message, 'err');
  }
});

document.getElementById('exportPdfBtn').addEventListener('click', async () => {
  await saveVariables();
  await fetchAndSave('/api/variables/export/pdf', `variables_${Date.now()}.pdf`, 'application/pdf');
});

// ── 폴링 시작/일시정지/정지 ──
const intervalInput = document.getElementById('intervalInput');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');

// 일시정지 버튼은 눌렀다고 끝이 아니라 "지금 일시정지 상태"라는 걸 다른 버튼과 다르게
// 강조색+테두리로 계속 보여줘야 해서, 서버가 broadcast하는 gridStatus를 반영해 갱신한다.
function setGridPollStatusUI(status) {
  startBtn.disabled = status === 'running';
  pauseBtn.disabled = status !== 'running';
  stopBtn.disabled = status === 'stopped';
  pauseBtn.classList.toggle('paused', status === 'paused');
}
setGridPollStatusUI('stopped');

document.getElementById('startBtn').addEventListener('click', async () => {
  const ok = await saveVariables();
  if (!ok) return;
  const ms = Number(intervalInput.value) || 1000;
  try {
    const res = await fetch('/api/grid/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intervalMs: ms }),
    });
    const data = await res.json();
    if (!data.ok) toast('시작 실패: ' + data.error, 'err');
  } catch (e) {
    toast('시작 실패: ' + e.message, 'err');
  }
});

document.getElementById('pauseBtn').addEventListener('click', async () => {
  await fetch('/api/grid/pause', { method: 'POST' });
});

document.getElementById('stopBtn').addEventListener('click', async () => {
  await fetch('/api/grid/stop', { method: 'POST' });
});

// ── 연결 UI (이 화면만의 독립된 USB/UDP/TCP 연결 - 메인 대시보드와 완전히 분리됨) ──
const plcSeriesSelect = document.getElementById('plcSeriesSelect');
const connType = document.getElementById('connType');
const connHost = document.getElementById('connHost');
const connPort = document.getElementById('connPort');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const connStatusPill = document.getElementById('connStatusPill');
const connStatusText = document.getElementById('connStatusText');
const gridCntSend = document.getElementById('gridCntSend');
const gridCntRecv = document.getElementById('gridCntRecv');
const gridCntErr = document.getElementById('gridCntErr');
const gridCntLatency = document.getElementById('gridCntLatency');
const resetCountersBtn = document.getElementById('resetCountersBtn');
const themeSelect = document.getElementById('themeSelect');

function updateConnFieldsVisibility() {
  const needsHost = connType.value === 'UDP' || connType.value === 'TCP';
  connHost.disabled = !needsHost || connectBtn.disabled;
  connPort.disabled = !needsHost || connectBtn.disabled;
  connHost.placeholder = needsHost ? 'PLC IP (예: 192.168.0.80)' : 'USB는 IP 불필요';
}
connType.addEventListener('change', updateConnFieldsVisibility);
updateConnFieldsVisibility();

// NX 시리즈는 USB(CJ 전용 프로토콜)로 연결할 수 없고 반드시 Ethernet(UDP/TCP)로만 연결하므로,
// NX를 선택하면 USB 옵션을 감춰서 잘못된 조합을 아예 고를 수 없게 한다.
const connTypeUsbOption = Array.from(connType.options).find((o) => o.value === 'USB');
function applySeriesConstraints() {
  const isNx = plcSeriesSelect.value === 'NX';
  if (connTypeUsbOption) connTypeUsbOption.hidden = isNx;
  if (isNx && connType.value === 'USB') connType.value = 'UDP';
  updateConnFieldsVisibility();
}
plcSeriesSelect.addEventListener('change', applySeriesConstraints);
applySeriesConstraints();

function setGridCounters(c) {
  gridCntSend.textContent = c.send;
  gridCntRecv.textContent = c.recvSuccess;
  gridCntErr.textContent = c.recvError;
  gridCntLatency.textContent = c.latencyMs != null ? c.latencyMs + 'ms' : '—';
  trendPush(c.latencyMs);
}

// ── 지연시간 트렌드 팝업 ──
// 지연 숫자는 폴링마다(초당 여러 번) 바뀌어서 눈으로 읽기 어려우므로, 값을 눌러
// 최근 N초 구간의 변화를 선 그래프로 보여준다. 별도 라이브러리 없이 캔버스로 직접 그린다.
const trendPopup = document.getElementById('trendPopup');
const trendCanvas = document.getElementById('trendCanvas');
const trendCtx = trendCanvas.getContext('2d');
const trendStartBtn = document.getElementById('trendStartBtn');
const trendPauseBtn = document.getElementById('trendPauseBtn');
const trendStopBtn = document.getElementById('trendStopBtn');
const trendCloseBtn = document.getElementById('trendCloseBtn');
const trendYAutoChk = document.getElementById('trendYAutoChk');
const trendYMinInput = document.getElementById('trendYMinInput');
const trendYMaxInput = document.getElementById('trendYMaxInput');
const trendWindowInput = document.getElementById('trendWindowInput');

const trend = { status: 'stopped', samples: [] }; // status: 'stopped' | 'running' | 'paused'

function setTrendStatus(status) {
  trend.status = status;
  trendStartBtn.disabled = status === 'running';
  trendPauseBtn.disabled = status !== 'running';
  trendStopBtn.disabled = status === 'stopped';
  trendPauseBtn.classList.toggle('paused', status === 'paused');
}
setTrendStatus('stopped');

function trendPush(value) {
  if (trend.status !== 'running' || value === null || value === undefined) return;
  trend.samples.push({ t: Date.now(), v: value });
  const windowMs = (Number(trendWindowInput.value) || 60) * 1000;
  const cutoff = Date.now() - windowMs;
  while (trend.samples.length > 0 && trend.samples[0].t < cutoff) trend.samples.shift();
  if (trendPopup.style.display !== 'none') drawTrend();
}

function drawTrend() {
  const w = trendCanvas.width;
  const h = trendCanvas.height;
  trendCtx.clearRect(0, 0, w, h);

  const style = getComputedStyle(document.documentElement);
  const gridColor = style.getPropertyValue('--panel-border').trim() || '#ccc';
  const textColor = style.getPropertyValue('--muted').trim() || '#888';
  const lineColor = style.getPropertyValue('--accent').trim() || '#3ddc84';

  const padding = { left: 46, right: 12, top: 10, bottom: 20 };
  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;

  const windowMs = (Number(trendWindowInput.value) || 60) * 1000;
  const now = Date.now();
  const xMin = now - windowMs;
  const xMax = now;

  const values = trend.samples.map((s) => s.v);
  let yMin, yMax;
  if (trendYAutoChk.checked) {
    yMin = values.length ? Math.min(...values) : 0;
    yMax = values.length ? Math.max(...values) : 10;
    if (yMin === yMax) {
      yMin -= 1;
      yMax += 1;
    }
    const margin = (yMax - yMin) * 0.15;
    yMin -= margin;
    yMax += margin;
  } else {
    yMin = Number(trendYMinInput.value) || 0;
    yMax = Number(trendYMaxInput.value) || 100;
    if (yMax <= yMin) yMax = yMin + 1;
  }

  const xPix = (t) => padding.left + ((t - xMin) / (xMax - xMin)) * plotW;
  const yPix = (v) => padding.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  trendCtx.strokeStyle = gridColor;
  trendCtx.fillStyle = textColor;
  trendCtx.font = '10px sans-serif';
  trendCtx.lineWidth = 1;
  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const v = yMin + ((yMax - yMin) * i) / yTicks;
    const y = yPix(v);
    trendCtx.beginPath();
    trendCtx.moveTo(padding.left, y);
    trendCtx.lineTo(w - padding.right, y);
    trendCtx.stroke();
    trendCtx.fillText(Math.round(v) + 'ms', 2, y + 3);
  }

  if (trend.samples.length > 1) {
    trendCtx.strokeStyle = lineColor;
    trendCtx.lineWidth = 1.5;
    trendCtx.beginPath();
    trend.samples.forEach((s, i) => {
      const x = xPix(s.t);
      const y = yPix(s.v);
      if (i === 0) trendCtx.moveTo(x, y);
      else trendCtx.lineTo(x, y);
    });
    trendCtx.stroke();
  }

  if (trend.samples.length > 0) {
    const last = trend.samples[trend.samples.length - 1];
    trendCtx.fillStyle = lineColor;
    trendCtx.font = 'bold 12px sans-serif';
    trendCtx.fillText(`${last.v}ms`, w - padding.right - 42, padding.top + 12);
  }
}

// running 상태에서는 새 데이터가 없어도 시간축이 계속 흘러야 하므로 주기적으로 다시 그린다
setInterval(() => {
  if (trend.status === 'running' && trendPopup.style.display !== 'none') drawTrend();
}, 500);

gridCntLatency.addEventListener('click', () => {
  if (trendPopup.style.display === 'none') {
    trendPopup.style.display = 'block';
    setTrendStatus('running');
    drawTrend();
  } else {
    // 팝업이 이미 열려 있으면 클릭할 때마다 기록 실행/일시정지를 토글한다
    setTrendStatus(trend.status === 'running' ? 'paused' : 'running');
  }
});
trendCloseBtn.addEventListener('click', () => {
  trendPopup.style.display = 'none';
});

// ── 팝업 드래그 이동 (헤더를 잡고 끌기) ──
(function makeTrendPopupDraggable() {
  const handle = trendPopup.querySelector('.trend-header');
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  handle.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return; // 닫기 버튼 클릭은 드래그로 취급하지 않음
    dragging = true;
    const rect = trendPopup.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    trendPopup.style.right = 'auto';
    trendPopup.style.left = rect.left + 'px';
    trendPopup.style.top = rect.top + 'px';
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    trendPopup.style.left = e.clientX - offsetX + 'px';
    trendPopup.style.top = e.clientY - offsetY + 'px';
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
  });
})();

trendStartBtn.addEventListener('click', () => setTrendStatus('running'));
trendPauseBtn.addEventListener('click', () => setTrendStatus('paused'));
trendStopBtn.addEventListener('click', () => {
  setTrendStatus('stopped');
  trend.samples = [];
  drawTrend();
});
trendYAutoChk.addEventListener('change', () => {
  trendYMinInput.disabled = trendYAutoChk.checked;
  trendYMaxInput.disabled = trendYAutoChk.checked;
  drawTrend();
});
trendYMinInput.addEventListener('change', drawTrend);
trendYMaxInput.addEventListener('change', drawTrend);
trendWindowInput.addEventListener('change', drawTrend);

function setConnStatus(status) {
  if (!status) return;
  connStatusPill.classList.remove('connected', 'error');
  if (status.connected) {
    connStatusPill.classList.add('connected');
    if ((status.connectionType === 'UDP' || status.connectionType === 'TCP') && status.connectionParams) {
      connStatusText.textContent = `${status.connectionType} 연결됨 (${status.connectionParams.host}:${status.connectionParams.port})`;
    } else {
      connStatusText.textContent = 'USB 연결됨';
    }
    connectBtn.disabled = true;
    disconnectBtn.disabled = false;
    connType.disabled = true;
  } else if (status.lastError) {
    connStatusPill.classList.add('error');
    connStatusText.textContent = '오류: ' + status.lastError;
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
    connType.disabled = false;
  } else {
    connStatusText.textContent = '연결 안 됨';
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
    connType.disabled = false;
  }
  // 헤더 CPU 정보 표시(클릭하면 plcInfo.js가 세부 정보 팝업을 연다)
  const cpuInfoEl = document.getElementById('cpuInfo');
  if (cpuInfoEl) {
    if (status.connected && status.controllerInfo && status.controllerInfo.model) {
      const v = status.controllerInfo.version ? ` (Ver. ${status.controllerInfo.version})` : '';
      cpuInfoEl.textContent = `— ${status.controllerInfo.model}${v}`;
    } else if (status.connected) {
      cpuInfoEl.textContent = '— CPU 정보 확인 중...';
    } else {
      cpuInfoEl.textContent = '— 연결 전';
    }
  }
  updateConnFieldsVisibility();
  if (status.connectionType && document.activeElement !== connType) connType.value = status.connectionType;
  if (status.connectionParams && document.activeElement !== connHost) connHost.value = status.connectionParams.host || '';
  if (status.connectionParams && document.activeElement !== connPort) connPort.value = status.connectionParams.port || 9600;
  if (status.counters) setGridCounters({ ...status.counters, latencyMs: status.latencyMs });
}

async function fetchGridConnStatus() {
  try {
    const res = await fetch('/api/grid/conn-status');
    const data = await res.json();
    if (data.ok) setConnStatus(data.status);
  } catch (e) {
    connStatusPill.classList.remove('connected');
    connStatusPill.classList.add('error');
    connStatusText.textContent = '상태 조회 실패';
  }
}

// 연결 요청이 응답 없이 무한정 걸리지 않도록 클라이언트 쪽에서도 타임아웃을 둔다
// (서버 쪽 타임아웃(8초)보다 여유 있게 잡아, 서버가 보내는 실제 에러 메시지를 먼저 받는다).
const CONNECT_FETCH_TIMEOUT_MS = 12000;
async function postJsonWithTimeout(url, body, timeoutMs = CONNECT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

connectBtn.addEventListener('click', async () => {
  const type = connType.value;
  const body = { type, series: plcSeriesSelect.value };
  if (type === 'UDP' || type === 'TCP') {
    const host = connHost.value.trim();
    if (!host) {
      alert(`${type} 연결에는 PLC IP 주소를 입력해야 합니다.`);
      return;
    }
    body.host = host;
    body.port = connPort.value ? Number(connPort.value) : 9600;
  }
  connectBtn.disabled = true;
  try {
    const data = await postJsonWithTimeout('/api/grid/connect', body);
    if (!data.ok) {
      alert('연결 실패: ' + data.error);
    }
  } catch (e) {
    alert('연결 요청이 응답하지 않습니다(타임아웃). 네트워크 상태를 확인하고 다시 시도하세요.');
  } finally {
    // 성공/실패/타임아웃 어떤 경우든 서버의 실제 상태로 화면을 강제 재동기화한다.
    await fetchGridConnStatus();
  }
});

disconnectBtn.addEventListener('click', async () => {
  await fetch('/api/grid/disconnect', { method: 'POST' });
});

resetCountersBtn.addEventListener('click', async () => {
  await fetch('/api/grid/counters/reset', { method: 'POST' });
});

function applyTheme(t) {
  // 표준 테마를 고르면 사용자 지정 테마 흔적(속성/스타일/모드)을 지운다.
  document.documentElement.removeAttribute('data-custom-theme');
  const customEl = document.getElementById('__customTheme');
  if (customEl) customEl.textContent = '';
  localStorage.removeItem('plcThemeMode');
  document.documentElement.dataset.theme = t;
  localStorage.setItem('plcTheme', t);
  themeSelect.value = t;
}
// 사용자 지정 테마가 활성이면 인라인 스크립트가 이미 적용했으니 드롭다운 표시값만 맞춘다.
if (localStorage.getItem('plcThemeMode') === 'custom') {
  try {
    themeSelect.value = JSON.parse(localStorage.getItem('plcCustomTheme') || '{}').fallback === 'dark' ? 'dark' : 'light';
  } catch (e) { themeSelect.value = 'light'; }
} else {
  // 로컬에 저장된 테마가 있으면 그것을, 없으면(신규 브라우저) localStorage를 건드리지 않고
  // appSettings.js가 서버 기본 테마를 적용하도록 드롭다운 표시값만 맞춘다.
  const storedTheme = localStorage.getItem('plcTheme');
  if (storedTheme) applyTheme(storedTheme);
  else themeSelect.value = document.documentElement.dataset.theme || 'light';
}
themeSelect.addEventListener('change', () => {
  applyTheme(themeSelect.value);
});

// ── 헤더 시계 (제목 오른쪽) ──
(function initClock() {
  const clockEl = document.getElementById('clockDisplay');
  if (!clockEl) return;
  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
  function render() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ampm = d.getHours() < 12 ? 'AM' : 'PM';
    const hour12 = d.getHours() % 12 || 12;
    clockEl.textContent =
      `${d.getFullYear()}년 ${pad(d.getMonth() + 1)}월 ${pad(d.getDate())}일 ${WEEKDAYS[d.getDay()]}요일 ` +
      `${ampm} ${pad(hour12)}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  render();
  setInterval(render, 1000);
})();

// ── 사용 방법(Operation Manual) 모달 ──
const helpBtn = document.getElementById('helpBtn');
const helpModal = document.getElementById('helpModal');
const helpCloseBtn = document.getElementById('helpCloseBtn');
helpBtn.addEventListener('click', () => helpModal.classList.add('show'));
helpCloseBtn.addEventListener('click', () => helpModal.classList.remove('show'));
helpModal.querySelector('.help-modal-backdrop').addEventListener('click', () => helpModal.classList.remove('show'));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') helpModal.classList.remove('show');
});

// ── 통신 이력 패널 높이 조절 (드래그 스플리터) ──
(function initLogSplitter() {
  const splitter = document.getElementById('logSplitter');
  const logPanel = document.querySelector('.log-panel');
  const STORAGE_KEY = 'plcLogPanelHeight';

  // 페이지를 옮겼다 돌아와도(새로고침 포함) 마지막으로 조절한 높이를 그대로 유지한다.
  const savedHeight = Number(localStorage.getItem(STORAGE_KEY));
  if (Number.isFinite(savedHeight) && savedHeight > 0) {
    logPanel.style.flexBasis = savedHeight + 'px';
    logPanel.style.height = savedHeight + 'px';
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }

  let dragging = false;
  let startY = 0;
  let startHeight = 0;
  splitter.addEventListener('mousedown', (e) => {
    dragging = true;
    splitter.classList.add('dragging');
    startY = e.clientY;
    startHeight = logPanel.getBoundingClientRect().height;
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const delta = startY - e.clientY;
    const maxHeight = window.innerHeight * 0.7;
    const newHeight = Math.min(Math.max(startHeight + delta, 80), maxHeight);
    logPanel.style.flexBasis = newHeight + 'px';
    logPanel.style.height = newHeight + 'px';
    localStorage.setItem(STORAGE_KEY, String(newHeight));
    // Univer 캔버스가 남은 공간에 맞춰 다시 그려지도록 resize 이벤트를 강제로 보낸다.
    window.dispatchEvent(new Event('resize'));
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    splitter.classList.remove('dragging');
    document.body.style.userSelect = '';
  });
})();

// ── 실시간 값 반영 (WebSocket) - 셀 하나씩이 아니라 한번에 batch로 반영 ──
// 서버(gridManager.js)는 값을 label이 아니라 "저장 시점의 유효한 변수 순서(index)"로 키를 매겨
// 보낸다. label을 키로 쓰면 사용자가 변수명을 안 바꿔서 "NEW_VAR"가 여러 행에 중복될 때
// 서로 다른 행의 값이 같은 키에 겹쳐써져 마지막 행만 갱신되던 문제가 있었다.
// 그래서 여기서도 readAllVariables()/saveVariables()가 서버로 보내는 것과 동일한 필터링
// (라벨 존재, 영역 존재, 지원 타입)으로 행을 훑어 index -> 실제 시트 행 번호를 계산한다.
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
    if (!v || !v.area || !DATA_TYPES.includes(v.dataType)) return;
    indexToRow.set(index, i + 1);
    index += 1;
  });
}

function applyGridValues(values) {
  if (isEditingCell) return; // 사용자가 셀을 편집 중이면 이번 폴링 반영은 건너뛴다
  rebuildIndexToRow();
  if (indexToRow.size === 0) return;
  const sheet = getSheet();

  // 셀 하나하나 setValue()를 반복 호출하면 매 사이클마다 명령이 계속 쌓여
  // (Undo 히스토리 등) 시간이 지날수록 화면 반영이 느려지거나 멈춘 것처럼 보일 수 있어서,
  // 실제로 값이 바뀐 행만 모아 range 하나로 한 번에 setValues() 한다.
  const rowsToUpdate = [];
  for (const [key, value] of Object.entries(values)) {
    const row = indexToRow.get(Number(key));
    if (row === undefined) continue;
    rowsToUpdate.push({ row, value: value === null || value === undefined ? '' : value });
  }
  if (rowsToUpdate.length === 0) return;

  // 연속된 행이면 range 하나로, 아니면 행별로 개별 setValues (그래도 setValue보다 적은 명령)
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

// ── 통신 이력 패널 (에러만 보기 필터 포함) ──
const logList = document.getElementById('logList');
const clearLogBtn = document.getElementById('clearLogBtn');
const filterErrorBtn = document.getElementById('filterErrorBtn');

let allLogs = [];
let errorOnlyFilter = false;

function renderLogEntry(entry) {
  const div = document.createElement('div');
  div.className = `log-entry ${entry.direction}`;
  const time = new Date(entry.time).toLocaleTimeString('ko-KR');
  div.innerHTML = `<span class="time">[${time}]</span> <span class="tag">${entry.direction}</span>${entry.message}` +
    (entry.hex ? `<span class="hex">${entry.hex}</span>` : '');
  logList.appendChild(div);
}

function renderAllLogs() {
  logList.innerHTML = '';
  const toShow = errorOnlyFilter ? allLogs.filter((e) => e.direction === 'ERROR') : allLogs;
  toShow.slice(-300).forEach(renderLogEntry);
  logList.scrollTop = logList.scrollHeight;
}

function appendLog(entry) {
  allLogs.push(entry);
  if (allLogs.length > 1000) allLogs.shift();
  if (!errorOnlyFilter || entry.direction === 'ERROR') {
    renderLogEntry(entry);
    logList.scrollTop = logList.scrollHeight;
    while (logList.children.length > 300) {
      logList.removeChild(logList.firstChild);
    }
  }
}

filterErrorBtn.addEventListener('click', () => {
  errorOnlyFilter = !errorOnlyFilter;
  filterErrorBtn.classList.toggle('active', errorOnlyFilter);
  filterErrorBtn.textContent = errorOnlyFilter ? '🔴 전체 보기' : '🔴 에러만 보기';
  renderAllLogs();
});

clearLogBtn.addEventListener('click', async () => {
  allLogs = [];
  logList.innerHTML = '';
  await fetch('/api/grid/logs/clear', { method: 'POST' });
});

let ws;
function connectWs() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.onmessage = (evt) => {
    let msg;
    try {
      msg = JSON.parse(evt.data);
    } catch (e) {
      return;
    }
    if (msg.type === 'gridStatus') {
      if (msg.payload.intervalMs) intervalInput.value = msg.payload.intervalMs;
      if (msg.payload.status) setGridPollStatusUI(msg.payload.status);
    } else if (msg.type === 'gridValues') {
      applyGridValues(msg.payload.values);
    } else if (msg.type === 'gridConnStatus') {
      setConnStatus(msg.payload);
    } else if (msg.type === 'gridConnLog') {
      appendLog(msg.payload);
    } else if (msg.type === 'gridConnLogHistory') {
      msg.payload.forEach(appendLog);
    } else if (msg.type === 'gridConnCounters') {
      setGridCounters(msg.payload);
    } else if (msg.type === 'gridConnLogsCleared') {
      allLogs = [];
      logList.innerHTML = '';
    }
  };
  ws.onclose = () => setTimeout(connectWs, 1000);
}
connectWs();

// ── 초기 로드 ──
fetchVariables();
fetchGridConnStatus();
setInterval(fetchGridConnStatus, 5000); // 혹시 브로드캐스트를 놓쳐도 5초마다 보정
fetch('/api/grid/status')
  .then((r) => r.json())
  .then((d) => {
    if (d.ok && d.intervalMs) intervalInput.value = d.intervalMs;
    if (d.ok && d.status) setGridPollStatusUI(d.status);
  })
  .catch(() => {});

// 상단 줌 컨트롤과의 동기화
window.addEventListener('setGridZoom', (e) => {
  try {
    const sheet = getSheet();
    if (sheet && typeof sheet.setZoomRatio === 'function' && e.detail && e.detail.zoom) {
      sheet.setZoomRatio(e.detail.zoom);
    }
  } catch (err) {
    console.warn('레시피 그리드 줌 적용 실패:', err);
  }
});

