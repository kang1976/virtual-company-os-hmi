import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import sheetsCoreKoKR from '@univerjs/preset-sheets-core/locales/ko-KR';
import '@univerjs/preset-sheets-core/lib/index.css';
import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation';
import sheetsDataValidationKoKR from '@univerjs/preset-sheets-data-validation/locales/ko-KR';
import './gms-trend-widget.css';

/**
 * GMS 조작화면 TREND(public/OPERATION HTML/TREND.html)의 태그 체크리스트를 Univer 시트로
 * 그린다. monitoring.html의 trend-widget.js(변수 "정의"용, 12열)와 달리 GMS는 태그가
 * unit1.json의 pts로 고정이라 열 4개(선택/태그/태그설명/현재값)로 단순하다. 태그설명은
 * 기존 체크박스 목록(trend-tag-row)에 있던 p.label을 그대로 옮긴 것 - 값(실시간)과는
 * 별도 열이라 설명은 고정, 현재값만 매 틱 갱신된다.
 *
 * TREND.html은 Operation.js가 fetch로 늦게 주입하는 fragment라 마운트 대상 컨테이너가
 * 스크립트 로드 시점엔 아직 DOM에 없을 수 있다 - 그래서 trend-widget.js처럼 스스로
 * 자동 마운트하지 않고, gms.js가 화면을 열 때(openGmsTrend) window.initGmsTrendGrid()를
 * 직접 호출해서 마운트를 요청하는 방식으로 만들었다.
 */

const HEADER = ['선택', '태그', '태그설명', '현재값'];
const SELECT_COL = 0;
const TAG_COL = 1;
const DESC_COL = 2;
const VALUE_COL = 3;
const COL_COUNT = HEADER.length;
const MAX_ROWS = 30; // 고정 태그(보통 15개) + 추후 추가할 여유 행

let univerAPI = null;
let workbook = null;
let mounted = false;

function getSheet() {
  return workbook.getActiveSheet();
}

function isChecked(v) {
  return v === 1 || v === true || v === '1' || String(v).trim().toUpperCase() === 'TRUE';
}

function applyTemplate(sheet) {
  sheet.getRange(0, 0, 1, COL_COUNT).setValues([HEADER]);
  try {
    const rule = univerAPI.newDataValidation().requireCheckbox('1', '0').build();
    sheet.getRange(1, SELECT_COL, MAX_ROWS - 1, 1).setDataValidation(rule);
  } catch (e) {
    console.warn('[gms-trend-grid] 체크박스 열 적용 실패:', e);
  }
}

async function mountGmsTrendGrid(containerId) {
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
    id: 'gms-trend-tags',
    name: 'GMS TREND 태그',
    sheets: {
      'sheet-1': { id: 'sheet-1', name: '태그 목록', rowCount: MAX_ROWS, columnCount: COL_COUNT },
    },
  });

  applyTemplate(getSheet());
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  mounted = true;
}

/** 초기 태그 목록을 채운다 - 이미 데이터가 있으면(재방문) 건드리지 않아 체크 상태를 보존한다.
    descByTag는 {tag: 태그설명} - 기존 체크리스트의 p.label과 동일한 값을 넘겨받는다. */
function setTags(tags, descByTag) {
  const sheet = getSheet();
  if (sheet.getLastRow() >= 1) return;
  const rows = (tags || []).map((tag) => ['1', tag, (descByTag && descByTag[tag]) || '', '--']);
  if (rows.length === 0) return;
  sheet.getRange(1, 0, rows.length, COL_COUNT).setValues(rows);
}

/** 태그별 실시간 값을 현재값(D열)에 반영한다 - gms.js가 1초마다 한 번씩 몰아서 호출한다. */
function applyValues(valuesByTag) {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 1 || !valuesByTag) return;
  const tagCells = sheet.getRange(1, TAG_COL, lastRow, 1).getValues();
  tagCells.forEach((r, i) => {
    const tag = r[0];
    if (tag && Object.prototype.hasOwnProperty.call(valuesByTag, tag)) {
      const v = valuesByTag[tag];
      sheet.getRange(i + 1, VALUE_COL, 1, 1).setValues([[v === null || v === undefined ? '--' : v]]);
    }
  });
}

/** 선택(A열)이 체크된 행의 태그 목록 - gms.js가 매 틱마다 폴링해서 gmsTrendSelected와 동기화한다. */
function getSelectedTags() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];
  const rows = sheet.getRange(1, 0, lastRow, COL_COUNT).getValues();
  return rows.filter((r) => r[TAG_COL] && isChecked(r[SELECT_COL])).map((r) => r[TAG_COL]);
}

window.initGmsTrendGrid = async function initGmsTrendGrid(containerId, tags, descByTag) {
  if (!mounted) await mountGmsTrendGrid(containerId);
  setTags(tags, descByTag);
  // 화면을 열 때 열 폭을 내용에 맞게 자동조정한다("그리드 화면을 열 때 열폭 자동맞춤" 요청).
  try { getSheet().autoResizeColumns(0, COL_COUNT); } catch (e) { /* 무시 */ }
  window.gmsTrendGridApi = { applyValues, getSelectedTags, setTags };
  window.dispatchEvent(new CustomEvent('gmsTrendGridReady', { detail: window.gmsTrendGridApi }));
  return window.gmsTrendGridApi;
};
