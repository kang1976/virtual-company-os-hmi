import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import sheetsCoreKoKR from '@univerjs/preset-sheets-core/locales/ko-KR';
import '@univerjs/preset-sheets-core/lib/index.css';
import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation';
import sheetsDataValidationKoKR from '@univerjs/preset-sheets-data-validation/locales/ko-KR';
import './gms-user-widget.css';

/**
 * GMS 조작화면(public/gms.html) CONFIG↔OPTION 사이 "USER" 탭의 작업자 계정(성명/Password/
 * 권한) 관리 Univer 시트. gms-trend-widget.js와 동일하게 관심사를 분리한 별도 위젯이다.
 *
 * 이 탭은 기본적으로 hidden(.tab-panel[hidden])이라 gms-trend-widget.js처럼 스스로 즉시
 * 마운트하지 않는다(hidden 컨테이너에 마운트하면 크기가 0이 됨) - 대신 gms.js가 USER 탭을
 * 처음 클릭할 때 window.initGmsUserGrid(containerId)를 호출해서 그때 마운트한다.
 *
 * 저장/불러오기/행추가/선택삭제 버튼은 gms.html에 정적 마크업으로 이미 있고(gmsUserSaveBtn 등),
 * 이 위젯이 마운트 시점에 한 번 wiring한다(trend-widget.js의 bindToolbarButtons()와 동일 패턴).
 */

const HEADER = ['선택', '성명', 'Password', '권한'];
const SELECT_COL = 0;
const NAME_COL = 1;
const PASSWORD_COL = 2;
const ROLE_COL = 3;
const COL_COUNT = HEADER.length;
const MAX_ROWS = 150; // 초기 90명 + 추후 등록 여유
const ROLE_OPTIONS = ['MASTER', 'SUPERVISOR', 'USER'];

function toastMsg(message, kind = '') {
  if (typeof window.toast === 'function') window.toast(message, kind);
  else console.log(`[gms-user-grid] ${message}`);
}

/** File 객체를 base64 문자열로 읽는다(data URL 접두어는 잘라냄) - trend-widget.js와 동일. */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** 파일 Blob을 저장한다(가능하면 "다른 이름으로 저장" 창) - trend-widget.js와 동일. */
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

function filenameFromResponse(res, fallback) {
  const cd = res.headers.get('content-disposition') || '';
  const m = cd.match(/filename="?([^";]+)"?/i);
  return m ? decodeURIComponent(m[1]) : fallback;
}

function isChecked(v) {
  return v === 1 || v === true || v === '1' || String(v).trim().toUpperCase() === 'TRUE';
}

let univerAPI = null;
let workbook = null;
let mounted = false;

function getSheet() {
  return workbook.getActiveSheet();
}

function applyTemplate(sheet) {
  sheet.getRange(0, 0, 1, COL_COUNT).setValues([HEADER]);
  try {
    const selectRule = univerAPI.newDataValidation().requireCheckbox('1', '0').build();
    sheet.getRange(1, SELECT_COL, MAX_ROWS - 1, 1).setDataValidation(selectRule);
  } catch (e) {
    console.warn('[gms-user-grid] 체크박스 열 적용 실패:', e);
  }
  try {
    // 권한 열은 드롭다운 3개(MASTER/SUPERVISOR/USER)로 제한한다.
    const roleRule = univerAPI.newDataValidation().requireValueInList(ROLE_OPTIONS, false, true).build();
    sheet.getRange(1, ROLE_COL, MAX_ROWS - 1, 1).setDataValidation(roleRule);
  } catch (e) {
    console.warn('[gms-user-grid] 권한 드롭다운 적용 실패:', e);
  }
  try {
    // Password 열은 "0854"처럼 0으로 시작하는 4자리 숫자가 흔한데, 기본 숫자 서식이면
    // Univer가 선행 0을 지워버린다(854로 저장됨) - 텍스트 서식("@")으로 고정해 그대로 보존한다.
    sheet.getRange(1, PASSWORD_COL, MAX_ROWS - 1, 1).setNumberFormat('@');
  } catch (e) {
    console.warn('[gms-user-grid] Password 열 텍스트 서식 적용 실패:', e);
  }
}

function rowToUser(row) {
  const name = row[NAME_COL];
  if (name === null || name === undefined || String(name).trim() === '') return null;
  return {
    name: String(name).trim(),
    password: row[PASSWORD_COL] === null || row[PASSWORD_COL] === undefined ? '' : String(row[PASSWORD_COL]).trim(),
    role: row[ROLE_COL] === null || row[ROLE_COL] === undefined ? '' : String(row[ROLE_COL]).trim().toUpperCase(),
  };
}

function readAllUsers() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return { users: [], errors: [] };
  const rows = sheet.getRange(1, 0, lastRow, COL_COUNT).getValues();
  const users = [];
  const errors = [];
  rows.forEach((row, idx) => {
    const u = rowToUser(row);
    if (!u) return;
    if (!ROLE_OPTIONS.includes(u.role)) {
      errors.push(`${idx + 2}행(${u.name}): 권한 "${u.role || '(비어있음)'}"은(는) MASTER/SUPERVISOR/USER 중 하나여야 합니다.`);
      return;
    }
    if (!/^\d{4}$/.test(u.password)) {
      errors.push(`${idx + 2}행(${u.name}): Password는 4자리 숫자여야 합니다.`);
      return;
    }
    users.push(u);
  });
  return { users, errors };
}

function loadUsersIntoSheet(users) {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow >= 1) sheet.getRange(1, 0, lastRow, COL_COUNT).clearContent();
  if (!users || users.length === 0) return;
  const rows = users.map((u) => ['0', u.name, u.password, u.role]);
  sheet.getRange(1, 0, rows.length, COL_COUNT).setValues(rows);
}

async function fetchUsers() {
  try {
    const res = await fetch('/api/gms/users');
    const data = await res.json();
    if (data.ok) {
      loadUsersIntoSheet(data.users);
      toastMsg(`계정 ${data.users.length}명 불러옴`, 'ok');
    } else {
      toastMsg('불러오기 실패: ' + data.error, 'err');
    }
  } catch (e) {
    toastMsg('계정 목록 조회 실패: ' + e.message, 'err');
  }
}

async function saveUsers() {
  const { users, errors } = readAllUsers();
  if (errors.length > 0) {
    toastMsg(`저장 실패 - ${errors[0]}${errors.length > 1 ? ` 외 ${errors.length - 1}건` : ''}`, 'err');
    return false;
  }
  // id는 저장 시점 행 순서로 새로 매긴다(그리드에서 자유롭게 추가/삭제/재정렬해도 항상 유효).
  const withIds = users.map((u, i) => ({ id: `user_${String(i + 1).padStart(3, '0')}`, ...u }));
  try {
    const res = await fetch('/api/gms/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: withIds }),
    });
    const data = await res.json();
    if (data.ok) {
      toastMsg(`계정 ${withIds.length}명 저장 완료`, 'ok');
      // PASSWORD 화면(Operation.js)이 인증에 쓰는 gms.js의 gmsUsersList를 즉시 갱신한다 -
      // 안 그러면 방금 등록/수정한 계정으로 새로고침 전까지 로그인할 수 없다.
      if (window.reloadGmsUsersConfig) window.reloadGmsUsersConfig();
      return true;
    }
    toastMsg('저장 실패: ' + data.error, 'err');
    return false;
  } catch (e) {
    toastMsg('저장 실패: ' + e.message, 'err');
    return false;
  }
}

/** 엑셀로 내보내기 - 지금 그리드에 있는(저장 전이어도 그대로) 내용을 서버에 보내
    xlsx로 만들어 받는다. 유효성 검사 없이 있는 그대로 내보낸다(내보내기는 백업 목적이라
    저장과 달리 막을 이유가 없음). */
async function exportUsersToExcel() {
  const { users } = readAllUsers();
  try {
    const res = await fetch('/api/gms/users/export/xlsx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toastMsg('내보내기 실패: ' + (err.error || res.statusText), 'err');
      return;
    }
    const blob = await res.blob();
    const suggestedName = filenameFromResponse(res, `GMS_USER_${Date.now()}.xlsx`);
    await saveBlobWithPicker(blob, suggestedName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    toastMsg('엑셀로 내보냈습니다', 'ok');
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    toastMsg('내보내기 실패: ' + e.message, 'err');
  }
}

/** 엑셀에서 불러오기 - 서버가 파싱/검증한 결과를 그리드에만 반영한다(바로 저장되지 않음 -
    "저장"을 눌러야 실제 반영, "불러오기"로 되돌릴 수도 있음). */
async function importUsersFromExcel(file) {
  try {
    const fileBase64 = await fileToBase64(file);
    const res = await fetch('/api/gms/users/import/xlsx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileBase64 }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || '불러오기 실패');
    loadUsersIntoSheet(data.users);
    if (data.warnings && data.warnings.length > 0) {
      toastMsg(`엑셀에서 ${data.users.length}명 불러옴 - ${data.warnings.length}건 확인 필요: ${data.warnings[0]}`, 'err');
    } else {
      toastMsg(`엑셀에서 ${data.users.length}명 불러왔습니다. "저장"을 눌러야 반영됩니다.`, 'ok');
    }
  } catch (e) {
    toastMsg('엑셀 불러오기 실패: ' + e.message, 'err');
  }
}

function bindToolbarButtons() {
  document.getElementById('gmsUserSaveBtn')?.addEventListener('click', saveUsers);
  document.getElementById('gmsUserReloadBtn')?.addEventListener('click', () => {
    if (!confirm('편집 중인 내용을 버리고 서버에 저장된 목록을 다시 불러올까요?')) return;
    fetchUsers();
  });
  document.getElementById('gmsUserExcelExportBtn')?.addEventListener('click', exportUsersToExcel);
  document.getElementById('gmsUserExcelImportBtn')?.addEventListener('click', () => {
    const input = document.getElementById('gmsUserExcelImportFile');
    input.value = '';
    input.click();
  });
  document.getElementById('gmsUserExcelImportFile')?.addEventListener('change', () => {
    const input = document.getElementById('gmsUserExcelImportFile');
    const file = input.files && input.files[0];
    if (file) importUsersFromExcel(file);
  });
  document.getElementById('gmsUserAddRowBtn')?.addEventListener('click', () => {
    const sheet = getSheet();
    const newRowIndex = sheet.getLastRow() + 1;
    sheet.getRange(newRowIndex, 0, 1, COL_COUNT).setValues([['0', '', '', 'USER']]);
  });
  document.getElementById('gmsUserDeleteSelectedBtn')?.addEventListener('click', () => {
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 1) { toastMsg('삭제할 행이 없습니다.', 'err'); return; }
    const selValues = sheet.getRange(1, SELECT_COL, lastRow, 1).getValues();
    const rows = [];
    selValues.forEach((r, i) => { if (isChecked(r[0])) rows.push(i + 1); });
    if (rows.length === 0) { toastMsg('선택(첫 열)에 체크한 행이 없습니다.', 'err'); return; }
    rows.sort((a, b) => b - a).forEach((row) => sheet.deleteRows(row, 1));
    toastMsg(`${rows.length}명 삭제됨(저장을 눌러야 서버에 반영됩니다)`, 'ok');
  });
}

async function mountGmsUserGrid(containerId) {
  const { univerAPI: api } = createUniver({
    locale: LocaleType.KO_KR,
    locales: { [LocaleType.KO_KR]: mergeLocales(sheetsCoreKoKR, sheetsDataValidationKoKR) },
    presets: [
      UniverSheetsCorePreset({ container: containerId }),
      UniverSheetsDataValidationPreset(),
    ],
  });
  univerAPI = api;

  workbook = univerAPI.createWorkbook({
    id: 'gms-users',
    name: 'GMS USER 등록',
    sheets: {
      'sheet-1': { id: 'sheet-1', name: '계정 목록', rowCount: MAX_ROWS, columnCount: COL_COUNT },
    },
  });

  applyTemplate(getSheet());
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  // 컨테이너 실제 크기가 바뀔 때마다(탭 전환/패널 리사이즈/창 크기 변경 등) resize 이벤트를
  // 대신 쏴준다 - Univer 내부 캔버스가 마운트 시점 크기에 굳어버리는 것을 막는 보험.
  const containerEl = document.getElementById(containerId);
  if (containerEl && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => window.dispatchEvent(new Event('resize'))).observe(containerEl);
  }

  bindToolbarButtons();
  await fetchUsers();
  // 화면을 열 때 열 폭을 내용에 맞게 자동조정한다("그리드 화면을 열 때 열폭 자동맞춤" 요청).
  try { getSheet().autoResizeColumns(0, COL_COUNT); } catch (e) { /* 무시 */ }
  mounted = true;
}

let mounting = false;
window.initGmsUserGrid = async function initGmsUserGrid(containerId) {
  if (mounted || mounting) return;
  mounting = true;
  try {
    await mountGmsUserGrid(containerId);
  } finally {
    mounting = false;
  }
};
