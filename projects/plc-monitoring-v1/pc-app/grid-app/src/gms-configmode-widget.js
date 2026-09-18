import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import sheetsCoreKoKR from '@univerjs/preset-sheets-core/locales/ko-KR';
import '@univerjs/preset-sheets-core/lib/index.css';
import './gms-configmode-widget.css';

/**
 * 보조메뉴 "설정모드 A/B" 화면의 설정값 표(Univer 그리드). data/gmsSubSequenceConfig.json
 * (CONFIG 탭과 같은 데이터)을 side(A/B/공통)와 OPTION 표시여부로 걸러서 보여주고, 값 칸을
 * 클릭하면 gms-configmode-tab.js(우측 도킹 키패드)가 값을 채워넣는다.
 *
 * 설정값이 많을 때 "2단/3단/4단"으로 나눠 보는 요청 - Univer 인스턴스를 여러 개 동시에 띄우는
 * 대신(이 앱에서 한 화면에 Univer를 여러 개 동시 마운트한 전례가 없어 위험 부담이 큼), 시트
 * 하나 안에서 4열짜리(구분/설정명/값/단위) 블록을 열 방향으로 나란히 반복 배치한다 - 2단이면
 * A0:D.. 블록과 F0:I.. 블록 두 개가 한 시트에 같이 보이는 식(BLOCK_WIDTH=5, 4데이터열+간격1열).
 *
 * 셀 선택 감지는 이 앱에서 실제로 쓰인 적은 없지만 번들에 존재가 확인된
 * univerAPI.Event.SelectionChanged를 쓰되, 이벤트 payload 구조에 기대지 않고 항상
 * sheet.getSelection().getActiveRange()로 다시 읽는다(gms-worklog-widget.js의
 * getSelectedDataRowIndex()가 이미 이 방식으로 프로덕션에서 쓰이고 있음 - 검증된 경로).
 */

const HEADER = ['구분', '설정명', '값', '단위'];
const GROUP_COL = 0;
const NAME_COL = 1;
const VALUE_COL = 2;
const UNIT_COL = 3;
const BLOCK_DATA_COLS = HEADER.length;
const BLOCK_GAP = 1;
const BLOCK_WIDTH = BLOCK_DATA_COLS + BLOCK_GAP; // 5
const MAX_COLUMNS = 4;
const MAX_ROWS_PER_BLOCK = 80;
const SHEET_COL_COUNT = MAX_COLUMNS * BLOCK_WIDTH;
const SHEET_ROW_COUNT = MAX_ROWS_PER_BLOCK + 2;
const DIRTY_BG = '#ffd6d6';
// 2/3/4단일 때 블록끼리 한눈에 구분되도록(요청사항 - 간격 열 하나만으론 잘 안 보임) 블록마다
// 옅은 배경색을 다르게 준다. 변경행 빨간색(DIRTY_BG)은 renderLayout()에서 이 색 위에 나중에
// 덮어써서 항상 우선한다.
const BLOCK_BG_COLORS = ['#eaf2ff', '#fff6e0', '#e9f9ee', '#fdecf3'];

function toastMsg(message, kind = '') {
  if (typeof window.toast === 'function') window.toast(message, kind);
  else console.log(`[gms-configmode-grid] ${message}`);
}

let univerAPI = null;
let workbook = null;
let mounted = false;
let currentSide = 'A';
let allRows = []; // 서버가 가진 전체 설정값(양측 다 포함) - A→B 복사 등에서 상대측 행을 찾을 때 씀
let dirtyIds = new Set();
let columnCount = 1;
let blocks = []; // blocks[blockIndex] = 그 블록에 배치된 config row 배열
let idToPos = new Map(); // id -> { row, col } (값 칸의 시트 좌표)

function getSheet() {
  return workbook.getActiveSheet();
}

function visibleRows() {
  return allRows.filter((r) => {
    if (r.side !== currentSide && r.side !== 'common') return false;
    return typeof window.isConfigOptionVisible !== 'function' || window.isConfigOptionVisible(r.option);
  });
}

/** columnCount(1~4)만큼 순서대로 나눠 blocks를 다시 만들고, id→시트좌표 맵도 다시 만든다.
    그룹(구분)이 최대한 한 블록 안에 붙어있도록, 원본 배열 순서 그대로 앞에서부터 잘라 나눈다
    (데이터 자체가 이미 구분별로 정렬돼 있는 것을 전제 - 과한 최적화 없이 단순하게). */
function computeBlocks() {
  const rows = visibleRows();
  const n = Math.max(1, Math.min(MAX_COLUMNS, columnCount));
  const perBlock = Math.ceil(rows.length / n) || 1;
  blocks = [];
  for (let i = 0; i < n; i++) {
    blocks.push(rows.slice(i * perBlock, (i + 1) * perBlock));
  }
  idToPos = new Map();
  blocks.forEach((block, blockIndex) => {
    const baseCol = blockIndex * BLOCK_WIDTH;
    block.forEach((row, dataRow) => {
      if (row.id) idToPos.set(row.id, { row: dataRow + 1, col: baseCol + VALUE_COL, blockIndex, dataRow });
    });
  });
}

function clearSheetContent() {
  const sheet = getSheet();
  try {
    sheet.getRange(0, 0, SHEET_ROW_COUNT, SHEET_COL_COUNT).setValues(
      Array.from({ length: SHEET_ROW_COUNT }, () => Array(SHEET_COL_COUNT).fill(''))
    );
    sheet.getRange(0, 0, SHEET_ROW_COUNT, SHEET_COL_COUNT).setBackgroundColor(null);
  } catch (e) { console.warn('[gms-configmode-grid] 시트 초기화 실패:', e); }
}

function renderLayout() {
  computeBlocks();
  const sheet = getSheet();
  clearSheetContent();
  blocks.forEach((block, blockIndex) => {
    const baseCol = blockIndex * BLOCK_WIDTH;
    try {
      sheet.getRange(0, baseCol, 1, BLOCK_DATA_COLS).setValues([HEADER]);
    } catch (e) { /* 무시 */ }
    // 블록 배경색 - 헤더 포함 그 블록이 실제로 쓰는 행까지만(빈 행까지 칠하면 표가 지저분해짐).
    try {
      sheet.getRange(0, baseCol, Math.max(1, block.length + 1), BLOCK_DATA_COLS)
        .setBackgroundColor(BLOCK_BG_COLORS[blockIndex % BLOCK_BG_COLORS.length]);
    } catch (e) { /* 무시 */ }
    if (block.length === 0) return;
    const values = block.map((row) => [row.group || '', row.name || '', row.value == null ? '' : row.value, row.unit || '']);
    try {
      sheet.getRange(1, baseCol, values.length, BLOCK_DATA_COLS).setValues(values);
    } catch (e) { console.warn('[gms-configmode-grid] 블록 렌더 실패:', e); }
  });
  applyStoredColumnWidths();
  applyStoredRowHeight();
  reapplyDirtyHighlight();
}

// ── 열 폭/행 높이 - 한 번 조절하면 계속 고정(요청사항). 블록마다 폭이 달라지면 헷갈리므로
// (블록1 "값" 열이 블록2 "값" 열보다 좁으면 이상해 보임) 블록0에서 조절한 폭/높이를 모든
// 블록에 그대로 적용해서 공유한다. ──
const COL_WIDTH_KEY = 'gmsConfigModeColWidths'; // JSON [구분,설정명,값,단위] px
const ROW_HEIGHT_KEY = 'gmsConfigModeRowHeight'; // px 숫자 1개(공통)

function applyStoredColumnWidths() {
  const sheet = getSheet();
  let widths = null;
  try { widths = JSON.parse(localStorage.getItem(COL_WIDTH_KEY) || 'null'); } catch (e) { /* 무시 */ }
  if (!Array.isArray(widths) || widths.length !== BLOCK_DATA_COLS) return;
  for (let b = 0; b < MAX_COLUMNS; b++) {
    for (let c = 0; c < BLOCK_DATA_COLS; c++) {
      try { sheet.setColumnWidth(b * BLOCK_WIDTH + c, widths[c]); } catch (e) { /* 무시 - 이 버전에 없을 수 있음 */ }
    }
  }
}
function saveColumnWidthsFromSheet() {
  const sheet = getSheet();
  try {
    const widths = [];
    for (let c = 0; c < BLOCK_DATA_COLS; c++) widths.push(sheet.getColumnWidth(c));
    localStorage.setItem(COL_WIDTH_KEY, JSON.stringify(widths));
    for (let b = 1; b < MAX_COLUMNS; b++) {
      for (let c = 0; c < BLOCK_DATA_COLS; c++) {
        try { sheet.setColumnWidth(b * BLOCK_WIDTH + c, widths[c]); } catch (e) { /* 무시 */ }
      }
    }
  } catch (e) { /* 이 Univer 버전이 getColumnWidth를 지원하지 않으면 조용히 건너뜀 */ }
}
function applyStoredRowHeight() {
  const sheet = getSheet();
  const h = Number(localStorage.getItem(ROW_HEIGHT_KEY));
  if (!Number.isFinite(h) || h <= 0) return;
  for (let r = 1; r < SHEET_ROW_COUNT; r++) {
    try { sheet.setRowHeight(r, h); } catch (e) { /* 무시 */ }
  }
}
function saveRowHeightFromSheet() {
  const sheet = getSheet();
  try {
    const h = sheet.getRowHeight(1);
    if (!Number.isFinite(h) || h <= 0) return;
    localStorage.setItem(ROW_HEIGHT_KEY, String(h));
    for (let r = 1; r < SHEET_ROW_COUNT; r++) {
      try { sheet.setRowHeight(r, h); } catch (e) { /* 무시 */ }
    }
  } catch (e) { /* 무시 */ }
}

// ── 변경된(아직 저장 안 한) 행 빨간 배경 표시 ──
function highlightRow(id, on) {
  const pos = idToPos.get(id);
  if (!pos) return;
  const sheet = getSheet();
  try {
    sheet.getRange(pos.row, pos.blockIndex * BLOCK_WIDTH, 1, BLOCK_DATA_COLS).setBackgroundColor(on ? DIRTY_BG : null);
  } catch (e) { /* 무시 */ }
}
function reapplyDirtyHighlight() {
  dirtyIds.forEach((id) => highlightRow(id, true));
}

// ── 값 셀 선택 감지 → 키패드 컨트롤러(gms-configmode-tab.js)에 알림 ──
function handleSelectionChanged() {
  const sheet = getSheet();
  let range = null;
  try {
    if (typeof sheet.getSelection === 'function') {
      const sel = sheet.getSelection();
      range = sel && (typeof sel.getActiveRange === 'function' ? sel.getActiveRange() : sel);
    }
  } catch (e) { /* 무시 */ }
  if (!range || typeof range.getRow !== 'function' || typeof range.getColumn !== 'function') return;
  const row = range.getRow();
  const col = range.getColumn();
  if (row < 1) return; // 헤더 행
  const blockIndex = Math.floor(col / BLOCK_WIDTH);
  const colInBlock = col % BLOCK_WIDTH;
  if (colInBlock !== VALUE_COL) return; // "값" 열이 아니면 키패드를 열지 않음
  const block = blocks[blockIndex];
  const dataRow = row - 1;
  if (!block || dataRow < 0 || dataRow >= block.length) return;
  const configRow = block[dataRow];
  if (typeof window.gmsConfigModeOnCellSelected === 'function') window.gmsConfigModeOnCellSelected(configRow);
}

async function fetchAllRows() {
  try {
    const res = await fetch('/api/gms/sub-sequence-config');
    const data = await res.json();
    if (data.ok && Array.isArray(data.rows)) allRows = data.rows;
  } catch (e) {
    toastMsg('설정값 불러오기 실패: ' + e.message, 'err');
  }
}

const api = {
  getSide: () => currentSide,
  getAllRows: () => allRows,
  getVisibleRows: () => visibleRows(),
  getDirtyIds: () => Array.from(dirtyIds),
  /** 키패드가 값 하나를 확정(ENTER)했을 때 호출 - 시트도 갱신하고 빨간 배경 표시. */
  setCellValue(id, value) {
    const row = allRows.find((r) => r.id === id);
    if (!row) return false;
    row.value = value;
    dirtyIds.add(id);
    const pos = idToPos.get(id);
    if (pos) {
      try { getSheet().getRange(pos.row, pos.col, 1, 1).setValues([[value]]); } catch (e) { /* 무시 */ }
    }
    highlightRow(id, true);
    return true;
  },
  /** "A값 전체 복사" - 지금 화면(currentSide)에 보이는 짝(반대 side, id의 _A/_B 접미사 기준)의
      값을 지금 화면 쪽으로 덮어쓴다. 반환값은 복사된 개수. */
  copyFromOppositeSide() {
    const oppositeSide = currentSide === 'A' ? 'B' : 'A';
    let count = 0;
    visibleRows().forEach((row) => {
      if (row.side !== currentSide) return; // 공통 행은 짝이 없으므로 건너뜀
      if (!row.id || !row.id.endsWith(`_${currentSide}`)) return;
      const pairId = row.id.slice(0, -2) + `_${oppositeSide}`;
      const pairRow = allRows.find((r) => r.id === pairId);
      if (!pairRow) return;
      api.setCellValue(row.id, pairRow.value);
      count++;
    });
    return count;
  },
  /** 키패드의 상하좌우 이동 버튼이 쓴다 - 지금 블록 배치를 id 배열로만 돌려준다(각 블록이
      화면에서 몇 번째 열에 있는지는 keypad 쪽이 이미 알 필요 없고, 위/아래는 같은 블록 안에서,
      좌/우는 같은 줄(dataRow)의 옆 블록으로 이동하면 되므로 이 2차원 배열이면 충분하다). */
  getBlocksSnapshot: () => blocks.map((block) => block.map((r) => r.id)),
  /** id가 가리키는 값 칸으로 Univer 선택을 옮긴다(가능하면) - 실패해도 키패드 자체 동작에는
      지장 없다(활성 셀 API가 이 버전에 없을 수도 있어 best-effort). */
  focusRow(id) {
    const pos = idToPos.get(id);
    if (!pos) return null;
    try {
      const range = getSheet().getRange(pos.row, pos.col, 1, 1);
      if (typeof range.activate === 'function') range.activate();
    } catch (e) { /* 무시 */ }
    return allRows.find((r) => r.id === id) || null;
  },
  setColumnCount(n) {
    columnCount = Math.max(1, Math.min(MAX_COLUMNS, Number(n) || 1));
    try { localStorage.setItem('gmsConfigModeColumnCount', String(columnCount)); } catch (e) { /* 무시 */ }
    renderLayout();
  },
  getColumnCount: () => columnCount,
  /** 저장 성공 후 호출 - dirty 표시를 지우고 서버 최신값으로 다시 그린다. */
  async refresh() {
    await fetchAllRows();
    dirtyIds = new Set();
    renderLayout();
  },
  clearDirty() {
    dirtyIds.forEach((id) => highlightRow(id, false));
    dirtyIds = new Set();
  },
};
window.gmsConfigModeGrid = api;

async function mountGmsConfigModeGrid(containerId, side) {
  currentSide = side || 'A';
  try {
    const storedCols = Number(localStorage.getItem('gmsConfigModeColumnCount'));
    if (Number.isFinite(storedCols) && storedCols >= 1 && storedCols <= MAX_COLUMNS) columnCount = storedCols;
  } catch (e) { /* 무시 */ }

  const { univerAPI: created } = createUniver({
    locale: LocaleType.KO_KR,
    locales: { [LocaleType.KO_KR]: mergeLocales(sheetsCoreKoKR) },
    presets: [UniverSheetsCorePreset({ container: containerId })],
  });
  univerAPI = created;

  workbook = univerAPI.createWorkbook({
    id: `gms-configmode-${currentSide}`,
    name: `설정모드 ${currentSide}`,
    sheets: {
      'sheet-1': { id: 'sheet-1', name: '설정값', rowCount: SHEET_ROW_COUNT, columnCount: SHEET_COL_COUNT },
    },
  });

  // 마우스/터치로 셀을 직접 더블클릭・더블탭해서 Univer 자체 편집 모드가 열리는 것을 막는다 -
  // 그러면 모바일에서 가상 키보드가 튀어나와 우측 도킹 키패드와 충돌하고, 범위(최소/최대값)・
  // 인터락 검증도 건너뛰고 값이 바뀔 수 있다. 값 입력은 항상 우측 키패드로만 하도록 강제한다
  // (셀 "선택"은 setEditable(false)와 무관하게 그대로 되므로, 탭 한 번으로 키패드를 여는
  // 흐름 자체는 안 막힌다 - PAD/휴대폰처럼 마우스가 없는 환경에서도 탭 → 키패드 입력만으로
  // 전체 조작이 가능해야 한다는 요청에 따른 설계).
  try { workbook.setEditable(false); } catch (e) { console.warn('[gms-configmode-grid] setEditable(false) 실패 - 셀을 직접 더블클릭하면 편집될 수 있습니다:', e); }

  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  const containerEl = document.getElementById(containerId);
  if (containerEl && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => window.dispatchEvent(new Event('resize'))).observe(containerEl);
  }
  // 열 폭/행 높이 드래그가 끝나는 시점(mouseup/touchend) - 정확한 리사이즈 완료 이벤트가 이
  // 버전에 확인되지 않아, 컨테이너에서 손을 뗄 때마다 지금 폭/높이를 읽어 저장한다(바뀐 게
  // 없으면 같은 값을 다시 쓸 뿐이라 낭비는 있어도 안전하다). touchend도 같이 들어야 터치
  // 환경에서 드래그로 조절했을 때도 저장된다.
  if (containerEl) {
    const saveSizes = () => { saveColumnWidthsFromSheet(); saveRowHeightFromSheet(); };
    containerEl.addEventListener('mouseup', saveSizes);
    containerEl.addEventListener('touchend', saveSizes);
  }

  try {
    univerAPI.addEvent(univerAPI.Event.SelectionChanged, handleSelectionChanged);
  } catch (e) {
    console.warn('[gms-configmode-grid] SelectionChanged 이벤트 등록 실패 - 셀 클릭 시 키패드가 자동으로 열리지 않을 수 있습니다:', e);
  }

  await fetchAllRows();
  renderLayout();
  mounted = true;
}

let mounting = false;
window.initGmsConfigModeGrid = async function initGmsConfigModeGrid(containerId, side) {
  if (mounted) {
    // 이미 마운트된 상태에서 A↔B를 오갈 때(같은 화면을 공유) - 새로 만들지 않고 side만 바꿔 다시 그린다.
    currentSide = side || 'A';
    dirtyIds = new Set();
    await fetchAllRows();
    renderLayout();
    return;
  }
  if (mounting) return;
  mounting = true;
  try {
    await mountGmsConfigModeGrid(containerId, side);
  } finally {
    mounting = false;
  }
};
