'use strict';

/**
 * Excel(.xlsx) 변수 목록 파일을 공통 방식으로 파싱한다.
 * 그리드(gridManager.js)와 트렌드(trendManager.js) 둘 다 "1행 헤더 텍스트로 열 매핑" 방식이
 * 동일해서, 파싱 로직만 공용으로 뽑아내고 헤더-필드 매핑표만 호출부에서 다르게 넘긴다.
 */

const ExcelJS = require('exceljs');
const XLSX = require('xlsx');

/**
 * @param {Buffer} buffer .xlsx 파일 바이너리
 * @param {Record<string,string>} headerToField 헤더 텍스트 -> 필드 이름 매핑 (예: {'영역':'area'})
 * @param {string[]} [ignoreHeaders] 매핑에 없어도 extra로 수집하지 않고 그냥 무시할 헤더(예: '현재값')
 * @returns {Promise<{ rows: Array<object>, extraHeaders: string[] }>}
 *   rows의 각 객체는 headerToField로 매핑된 필드 + 매핑 안 된 열은 `extra: {헤더텍스트: 값}`에 모인다.
 */
async function parseVariablesXlsx(buffer, headerToField, ignoreHeaders = []) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return { rows: [], extraHeaders: [] };

  const ignoreSet = new Set(ignoreHeaders);
  const colFieldMap = {}; // colNumber -> fieldName(string) 또는 { extra: headerText }
  const extraHeaders = [];
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const text = String(cell.value === null || cell.value === undefined ? '' : cell.value).trim();
    if (!text || ignoreSet.has(text)) return;
    if (headerToField[text]) {
      colFieldMap[colNumber] = headerToField[text];
    } else {
      colFieldMap[colNumber] = { extra: text };
      extraHeaders.push(text);
    }
  });

  const rows = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // 헤더 행
    const obj = { extra: {} };
    let hasAny = false;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const mapping = colFieldMap[colNumber];
      if (!mapping) return;
      const value = cell.value === null || cell.value === undefined ? '' : cell.value;
      if (typeof mapping === 'string') {
        obj[mapping] = value;
      } else {
        obj.extra[mapping.extra] = value;
      }
      hasAny = true;
    });
    if (hasAny) rows.push(obj);
  });

  return { rows, extraHeaders };
}

/**
 * xlsx뿐 아니라 xls(구버전 바이너리)/xlsm/xlsb/csv까지 폭넓게 지원하는 범용 파서.
 * SheetJS(xlsx 패키지)는 파일 시그니처로 형식을 스스로 판별하므로 확장자를 몰라도 된다
 * (ExcelJS는 xlsx/xlsm 계열의 OOXML 형식만 읽을 수 있어 구버전 xls·바이너리 xlsb는 못 읽는다).
 * @param {Buffer} buffer 파일 바이너리
 * @param {Record<string,string>} headerToField 헤더 텍스트 -> 필드 이름 매핑
 * @param {string[]} [ignoreHeaders] 매핑에 없어도 extra로 수집하지 않고 무시할 헤더
 * @returns {{ rows: Array<object>, extraHeaders: string[] }}
 */
function parseVariablesAny(buffer, headerToField, ignoreHeaders = []) {
  // codepage 65001(UTF-8) 지정 - CSV처럼 인코딩이 필요한 텍스트 포맷에서 한글이 깨지는 것을
  // 방지한다(xlsx/xlsm/xlsb 같은 바이너리 포맷은 자체 인코딩을 쓰므로 이 옵션의 영향을 받지 않음).
  const wb = XLSX.read(buffer, { type: 'buffer', codepage: 65001 });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], extraHeaders: [] };
  const ws = wb.Sheets[sheetName];
  // header:1 → 셀 서식 대신 배열의 배열(AOA)로 받아, 기존 ExcelJS 파서와 동일한 방식으로 직접 매핑한다.
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  if (aoa.length === 0) return { rows: [], extraHeaders: [] };

  const ignoreSet = new Set(ignoreHeaders);
  const colFieldMap = {}; // colIndex(0-based) -> fieldName(string) 또는 { extra: headerText }
  const extraHeaders = [];
  (aoa[0] || []).forEach((cellVal, colIndex) => {
    const text = String(cellVal === null || cellVal === undefined ? '' : cellVal).trim();
    if (!text || ignoreSet.has(text)) return;
    if (headerToField[text]) {
      colFieldMap[colIndex] = headerToField[text];
    } else {
      colFieldMap[colIndex] = { extra: text };
      extraHeaders.push(text);
    }
  });

  const rows = [];
  for (let r = 1; r < aoa.length; r++) {
    const rowArr = aoa[r];
    if (!rowArr) continue;
    const obj = { extra: {} };
    let hasAny = false;
    rowArr.forEach((cellVal, colIndex) => {
      const mapping = colFieldMap[colIndex];
      if (!mapping) return;
      const value = cellVal === null || cellVal === undefined ? '' : cellVal;
      if (value === '') return; // includeEmpty:false와 동일하게, 빈 셀은 값이 있는 것으로 치지 않음
      if (typeof mapping === 'string') {
        obj[mapping] = value;
      } else {
        obj.extra[mapping.extra] = value;
      }
      hasAny = true;
    });
    if (hasAny) rows.push(obj);
  }

  return { rows, extraHeaders };
}

module.exports = { parseVariablesXlsx, parseVariablesAny };
