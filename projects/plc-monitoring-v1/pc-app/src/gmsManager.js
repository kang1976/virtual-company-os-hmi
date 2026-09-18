'use strict';

/**
 * GMS(Gas Monitoring System) 페이지 전용 밸브 목록 저장/폴링/쓰기 관리자.
 * src/gridManager.js의 "지금 값 스냅샷" 폴링 패턴(인덱스 기반 값 매핑)을 그대로 가져다 쓰되,
 * 변수 하나가 아니라 밸브 하나당 제어(쓰기) 비트 + 개폐 상태 피드백(읽기) 비트 2개를 다룬다.
 * 장비(가스캐비닛)마다 배관/태그 구조가 달라서 밸브 목록은 장비 id별로 별도 파일
 * (data/gmsValves/<unitId>.json)에 저장한다. 이 파일 자체는 도면 구조를 전혀 모른다(밸브 태그/주소만 다룬다).
 */

const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { reconnectPolicy } = require('./settingsManager');
const { wordCountFor, decodeValue } = require('./dataTypes');
const history = require('./gmsHistory');
const { AREA_CODES, emAreaCode } = require('./usbFinsClient');
const { nowLocalIso, nowLocalStamp } = require('./timeUtils');

/** 'D','H','W','CIO','E0'~'E24' 같은 문자열을 FINS 워드 영역 코드로 변환(PT 등 아날로그 값용). */
function areaNameToWordCode(name) {
  const key = String(name || '').trim().toUpperCase();
  if (AREA_CODES[key] !== undefined) return AREA_CODES[key];
  const m = key.match(/^E(\d{1,2})$/);
  if (m) return emAreaCode(Number(m[1]));
  throw new Error(`알 수 없는 영역: "${name}" (D/H/W/CIO/E0~E24 형식이어야 합니다)`);
}

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const GMS_VALVES_DIR = path.join(dataDir, 'gmsValves');
if (!fs.existsSync(GMS_VALVES_DIR)) fs.mkdirSync(GMS_VALVES_DIR, { recursive: true });
const GMS_EQUIPMENT_FILE = path.join(dataDir, 'gmsEquipment.json');
const GMS_MAIN_SEQUENCE_FILE = path.join(dataDir, 'gmsMainSequence.json');
const GMS_SUB_SEQUENCES_DIR = path.join(dataDir, 'gmsSubSequences');
if (!fs.existsSync(GMS_SUB_SEQUENCES_DIR)) fs.mkdirSync(GMS_SUB_SEQUENCES_DIR, { recursive: true });
// 서브시퀀스 저장(수동 저장/엑셀 불러오기 공용 경로)이 실수로 다른 id를 덮어쓰는 사고를
// 겪은 뒤 추가된 안전장치 - 덮어쓰기 직전의 내용을 id별 폴더에 타임스탬프로 남겨 둔다.
const GMS_SUB_SEQUENCE_BACKUP_DIR = path.join(dataDir, 'gmsSubSequenceBackups');
if (!fs.existsSync(GMS_SUB_SEQUENCE_BACKUP_DIR)) fs.mkdirSync(GMS_SUB_SEQUENCE_BACKUP_DIR, { recursive: true });
const GMS_SUB_SEQUENCE_SELECTION_FILE = path.join(dataDir, 'gmsSubSequenceSelection.json');

/** unitId를 파일 경로에 안전하게 쓸 수 있도록 영文/숫자/-/_만 허용한다(경로 조작 방지). */
function sanitizeUnitId(unitId) {
  const s = String(unitId || '');
  if (!/^[A-Za-z0-9_-]+$/.test(s)) {
    throw new Error(`잘못된 장비 id: "${unitId}"`);
  }
  return s;
}

/** 서브시퀀스 id를 파일 경로에 안전하게 쓸 수 있도록 영文/숫자/-/_만 허용한다(경로 조작 방지). */
function sanitizeSubSequenceId(id) {
  const s = String(id || '');
  if (!/^[A-Za-z0-9_-]+$/.test(s)) {
    throw new Error(`잘못된 서브시퀀스 id: "${id}"`);
  }
  return s;
}

const MAX_ITEMS_PER_READ = 32; // server.js/gridManager.js와 동일한 기준으로 청크 분할
const RECONNECT_AFTER_CYCLES = 2; // 한 폴링 사이클의 모든 청크가 이 횟수만큼 연속 실패하면 자동 재연결

// ── 장비 선택 화면용 장비(가스 캐비닛) 목록 저장/로드 - 밸브 목록과 별개로, 배관도로
// 들어가기 전 "어떤 장비를 볼지" 고르는 화면에 쓰는 간단한 카드 정보(고정 라벨)만 담는다. ──
function loadGmsEquipment() {
  try {
    if (!fs.existsSync(GMS_EQUIPMENT_FILE)) return [];
    const raw = fs.readFileSync(GMS_EQUIPMENT_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.equipment) ? data.equipment : [];
  } catch (e) {
    return [];
  }
}

function saveGmsEquipmentToFile(equipment) {
  fs.writeFileSync(
    GMS_EQUIPMENT_FILE,
    JSON.stringify({ equipment, savedAt: nowLocalIso() }, null, 2)
  );
}

// ── Main 시퀀스(CYLINDER STEP STATUS) 순서/적용 설정 - GMS관련 사진/Main Sequence.csv의
// 16행("대표심볼" 열)을 기본값으로 시드한다. 장비마다 다르지 않고 설비 사양 자체라 장비 id
// 구분 없이 전역 파일 하나로 관리한다(gmsEquipment.json과 동일한 패턴). order는 같은 타입이
// 여러 번 들어갈 수 있어 각 항목에 고유 id를 둔 인스턴스 배열이고, enabledTypes는 타입별
// 적용/미적용 - OPTION 탭과 동일한 개념이지만 여러 사람이 봐야 하는 설비 설정이라
// localStorage가 아니라 여기(서버 파일)에 저장한다. ──
const MAIN_SEQUENCE_DEFAULT_ORDER = [
  { id: 'seq1', type: 'IDLE' },
  { id: 'seq2', type: 'Puls' },
  { id: 'seq3', type: '1P' },
  { id: 'seq4', type: '-L' },
  { id: 'seq5', type: '-VT' },
  { id: 'seq6', type: '2P' },
  { id: 'seq7', type: 'CC' },
  { id: 'seq8', type: 'Bypass' },
  { id: 'seq9', type: '+L' },
  { id: 'seq10', type: '3P' },
  { id: 'seq11', type: '-VT' },
  { id: 'seq12', type: '4P' },
  { id: 'seq13', type: 'PC' },
  { id: 'seq14', type: 'RGV' },
  { id: 'seq14b', type: 'GSP' },
  { id: 'seq15', type: 'READY' },
  { id: 'seq16', type: 'Service' },
];
const MAIN_SEQUENCE_DEFAULT_ENABLED_TYPES = Object.fromEntries(
  Array.from(new Set(MAIN_SEQUENCE_DEFAULT_ORDER.map((s) => s.type))).map((type) => [type, true])
);
// 엑셀 내보내기의 KOR/ENG 열 + 가져오기 시 "대표심볼" 유효성 검사에 쓴다 - public/gms.js의
// MAIN_SEQUENCE_TYPE_DEFS와 동일한 값(같은 방식으로 클라/서버 양쪽에 중복 정의된 다른
// 상수들과 동일한 패턴).
const MAIN_SEQUENCE_TYPE_DEFS = [
  { type: 'IDLE', korLabel: '준비전', engLabel: 'IDLE' },
  { type: 'Puls', korLabel: '잔류가스 제거(Puls Vent)', engLabel: 'Removal Gas' },
  { type: '1P', korLabel: '교환전 1차 배관 청소', engLabel: '1ST PRE PURGE' },
  { type: '-L', korLabel: '교환전 PT 감압 시험', engLabel: 'PT PRE VACUUM DECAY CHECK' },
  { type: '-VT', korLabel: 'VT 감압 시험(교환전/교환후 공용)', engLabel: 'VT-LEAK CHECK' },
  { type: '2P', korLabel: '교환전 2차 배관 청소', engLabel: '2ND PRE PURGE' },
  { type: 'CC', korLabel: '실린더 교체', engLabel: 'CYLINDER CHANGE' },
  { type: 'Bypass', korLabel: '배관 By-pass 체크', engLabel: 'Part By-pass check' },
  { type: '+L', korLabel: '교환후 가압 시험', engLabel: 'POST PRESSURE DECAY CHECK' },
  { type: '3P', korLabel: '교환후 1차 배관 청소', engLabel: '1ST POST PURGE' },
  { type: '4P', korLabel: '교환후 2차 배관 청소', engLabel: '2ND POST PURGE' },
  { type: 'PC', korLabel: '퍼지 완료', engLabel: 'PURGE COMPLETE' },
  { type: 'RGV', korLabel: 'Real Gas Vent', engLabel: 'PROCESS GAS VENT' },
  { type: 'GSP', korLabel: '가스공급 진행', engLabel: 'GAS SUPPLY PREPARATION' },
  { type: 'READY', korLabel: '공급 준비', engLabel: 'STANDBY' },
  { type: 'Service', korLabel: '가스 공급', engLabel: 'GAS SUPPLY' },
];

function loadGmsMainSequence() {
  try {
    if (!fs.existsSync(GMS_MAIN_SEQUENCE_FILE)) {
      return { order: MAIN_SEQUENCE_DEFAULT_ORDER, enabledTypes: MAIN_SEQUENCE_DEFAULT_ENABLED_TYPES };
    }
    const raw = fs.readFileSync(GMS_MAIN_SEQUENCE_FILE, 'utf8');
    const data = JSON.parse(raw);
    return {
      order: Array.isArray(data.order) && data.order.length ? data.order : MAIN_SEQUENCE_DEFAULT_ORDER,
      enabledTypes: data.enabledTypes && typeof data.enabledTypes === 'object'
        ? data.enabledTypes : MAIN_SEQUENCE_DEFAULT_ENABLED_TYPES,
    };
  } catch (e) {
    return { order: MAIN_SEQUENCE_DEFAULT_ORDER, enabledTypes: MAIN_SEQUENCE_DEFAULT_ENABLED_TYPES };
  }
}

function saveGmsMainSequenceToFile(order, enabledTypes) {
  fs.writeFileSync(
    GMS_MAIN_SEQUENCE_FILE,
    JSON.stringify({ order, enabledTypes, savedAt: nowLocalIso() }, null, 2)
  );
}

// ── 서브시퀀스(Sub Sequence) - Main Step 하나(예: "조정모드") 안에서 벨브를 열고 닫으며
// 진행하는 상세 Step 목록. 실제 엔지니어링 문서(GMS관련 사진/Purge_Sequence_GC_2022_07.xlsx)의
// 4행 합성 헤더 포맷을 그대로 따른다. 같은 mainStepType에 여러 버전(v1/v2/v3 등)이 있을 수
// 있어 서브시퀀스 하나당 파일 하나(data/gmsSubSequences/<id>.json)로 저장하고, 어떤
// mainStepType이 어떤 서브시퀀스 id를 쓰는지는 별도 선택 매핑 파일에 저장한다. 파일 내용
// (steps 등)의 상세 구조는 여기서 강제하지 않는다 - 읽고 쓴 그대로 보존한다. ──
function listGmsSubSequences() {
  try {
    const files = fs.readdirSync(GMS_SUB_SEQUENCES_DIR).filter((f) => f.endsWith('.json'));
    return files.map((f) => {
      const id = f.slice(0, -5);
      try {
        const data = JSON.parse(fs.readFileSync(path.join(GMS_SUB_SEQUENCES_DIR, f), 'utf8'));
        return {
          id,
          label: data.label || id,
          mainStepType: data.mainStepType || '',
          stepCount: Array.isArray(data.steps) ? data.steps.length : 0,
          savedAt: data.savedAt || null,
        };
      } catch (e) {
        return { id, label: id, mainStepType: '', stepCount: 0, savedAt: null };
      }
    });
  } catch (e) {
    return [];
  }
}

function loadGmsSubSequence(id) {
  const safeId = sanitizeSubSequenceId(id);
  const file = path.join(GMS_SUB_SEQUENCES_DIR, `${safeId}.json`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw);
}

// ── 서브시퀀스 엑셀 왕복(export/import) 열 구성 - 실제 엔지니어링 문서(Purge_Sequence_GC_2022_07.xlsx)와
// 같은 다단 헤더 형식(그룹행 2개 + 실제 열이름행)을 그대로 따른다. server.js의 export/import
// 라우트와 아래 백업용 buildSubSequenceWorkbook()이 이 정의를 공유한다(다른 곳에서 각자
// 만들면 두 포맷이 갈라질 위험이 있어 한 곳에만 둔다). ──
const SUB_SEQ_FIXED_COLUMNS = [
  { key: 'no', header: 'S/No.' },
  { key: 'mainStep', header: 'Main Step' },
  { key: 'subStep', header: 'Sub Step' },
  { key: 'nextStep', header: 'Next Step' },
  { key: 'operation', header: 'Operations' },
  { key: 'cycle', header: 'Cycle' },
  { key: 'advance', header: '진행방식' },
  { key: 'ackGoto', header: 'Ack Goto' },
  { key: 'alarmGoto', header: 'Alarm Goto' },
  { key: 'message', header: 'Message at Controller' },
  { key: 'timeSec', header: 'Time (Sec)' },
  { key: 'accTimeSec', header: 'Acc,Time (Sec)' },
];
const SUB_SEQ_TRAILING_COLUMNS = [
  { key: 'alarmMonitoring', header: 'Alarm Monitoring' },
  { key: 'conditionOp', header: '비교연산자' },
  { key: 'conditionValue', header: '설정명(비교대상ID)' },
  { key: 'earlyPass', header: '조기통과' },
  { key: 'alarmSeq', header: 'Alarm Seq.' },
  { key: 'alarmMessage', header: 'Alarm Message' },
  { key: 'remarks', header: 'Remarks' },
];
const SUB_SEQ_ADVANCE_ACK = new Set(['확인', '확인대기', '수동', 'ACK', 'ack']);

/** 엑셀 시트 이름에 못 쓰는 문자를 제거하고 31자로 자른다(엑셀 제약). */
function sanitizeSheetName(name) {
  return String(name || '').replace(/[\\/*?:[\]]/g, '_').slice(0, 31) || 'Sheet1';
}

/** 1부터 시작하는 열 번호를 엑셀 열 문자(1→A, 27→AA)로 바꾼다. */
function excelColLetter(colNumber) {
  let n = colNumber;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** id/data(서브시퀀스 JSON 내용)로부터 export 라우트와 동일한 형식의 ExcelJS 워크북을 만든다.
    응답 스트림에 쓰는 것은 호출한 쪽(서버 라우트 또는 백업 로직)의 몫이다. */
function buildSubSequenceWorkbook(id, data) {
  const valveTags = Array.isArray(data.valveTags) ? data.valveTags : [];
  const columns = [
    ...SUB_SEQ_FIXED_COLUMNS,
    ...valveTags.map((tag) => ({ key: tag, header: tag })),
    ...SUB_SEQ_TRAILING_COLUMNS,
  ];
  const totalCols = columns.length;
  const valveStartCol = SUB_SEQ_FIXED_COLUMNS.length + 1;
  const valveEndCol = valveStartCol + valveTags.length - 1;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sanitizeSheetName(id));
  ws.columns = columns.map((c) => ({ key: c.key, width: c.key === 'operation' || c.key === 'message' || c.key === 'remarks' ? 26 : 14 }));

  ws.mergeCells(1, 1, 1, totalCols);
  ws.getCell(1, 1).value = `${data.label || id} (${data.mainStepType || ''}) - GMS 서브시퀀스`;
  ws.getCell(1, 1).font = { bold: true };

  ws.mergeCells(2, 2, 2, 4);
  ws.getCell(2, 2).value = 'STEP';
  ws.mergeCells(2, 6, 2, 12);
  ws.getCell(2, 6).value = 'TIMING / CONDITION';
  if (valveTags.length) {
    ws.mergeCells(2, valveStartCol, 2, valveEndCol);
    ws.getCell(2, valveStartCol).value = 'VALVE (O=Open, C=Close, 공백=이전 상태 유지, O+n/C+n=n초 뒤 순차 적용)';
  }
  ws.mergeCells(2, valveEndCol + 1, 2, totalCols);
  ws.getCell(2, valveEndCol + 1).value = 'ALARM / REMARKS';
  ws.getRow(2).font = { bold: true };
  ws.getRow(2).alignment = { horizontal: 'center' };

  const timeSecCol = SUB_SEQ_FIXED_COLUMNS.findIndex((c) => c.key === 'timeSec') + 1;
  const accTimeSecCol = SUB_SEQ_FIXED_COLUMNS.findIndex((c) => c.key === 'accTimeSec') + 1;
  ws.getCell(3, timeSecCol).value = 'Sec';
  ws.getCell(3, accTimeSecCol).value = 'Sec';

  columns.forEach((c, i) => {
    ws.getCell(4, i + 1).value = c.header;
  });
  ws.getRow(4).font = { bold: true };

  const timeSecColLetter = excelColLetter(timeSecCol);
  let cumulativeSec = 0;
  (data.steps || []).forEach((step, i) => {
    const rowValues = {};
    rowValues.no = step.no != null ? step.no : '';
    rowValues.mainStep = step.mainStep != null ? step.mainStep : '';
    rowValues.subStep = step.subStep != null ? step.subStep : '';
    rowValues.nextStep = step.nextStep || '';
    rowValues.operation = step.operation || '';
    rowValues.cycle = step.cycle || '';
    rowValues.advance = step.advance === 'ack' ? '확인' : '자동';
    rowValues.ackGoto = step.ackGoto || '';
    rowValues.alarmGoto = step.alarmGoto || '';
    rowValues.message = step.message || '';
    rowValues.timeSec = step.timeSec != null ? step.timeSec : '';
    valveTags.forEach((tag) => {
      rowValues[tag] = (step.valves && step.valves[tag]) || '';
    });
    rowValues.alarmMonitoring = step.alarmMonitoring || '';
    rowValues.conditionOp = step.conditionOp || '';
    rowValues.conditionValue = step.conditionValue || '';
    rowValues.earlyPass = step.earlyPass || '';
    rowValues.alarmSeq = step.alarmSeq || '';
    rowValues.remarks = step.remarks || '';
    rowValues.alarmMessage = step.alarmMessage || '';
    const rowNumber = 5 + i;
    const row = ws.getRow(rowNumber);
    columns.forEach((c, idx) => {
      if (c.key === 'accTimeSec') return;
      row.getCell(idx + 1).value = rowValues[c.key];
    });
    const stepSec = Number(step.timeSec);
    cumulativeSec += Number.isFinite(stepSec) ? stepSec : 0;
    row.getCell(accTimeSecCol).value = {
      formula: `SUM($${timeSecColLetter}$5:${timeSecColLetter}${rowNumber})`,
      result: cumulativeSec,
    };
  });

  return wb;
}


function saveGmsSubSequenceToFile(id, data) {
  const safeId = sanitizeSubSequenceId(id);
  const file = path.join(GMS_SUB_SEQUENCES_DIR, `${safeId}.json`);
  if (fs.existsSync(file)) {
    try {
      const backupDir = path.join(GMS_SUB_SEQUENCE_BACKUP_DIR, safeId);
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      const stamp = nowLocalStamp();
      const oldData = JSON.parse(fs.readFileSync(file, 'utf8'));
      fs.copyFileSync(file, path.join(backupDir, `${safeId}_${stamp}.json`));
      // JSON 백업과 함께 엑셀본도 같이 남긴다 - 엑셀만 열어봐도 바로 예전 Step 내용을
      // 확인/재사용할 수 있게(사용자 요청 - "서브시퀀스별로 하위 폴더 안에 엑셀로도 백업").
      const backupWb = buildSubSequenceWorkbook(safeId, oldData);
      backupWb.xlsx.writeFile(path.join(backupDir, `${safeId}_${stamp}.xlsx`)).catch((e) => {
        console.warn(`[gmsManager] 서브시퀀스 엑셀 백업 실패 (id=${safeId}): ${e.message}`);
      });
    } catch (e) {
      // 백업 실패가 저장 자체를 막으면 안 된다 - 경고만 남기고 계속 진행.
      console.warn(`[gmsManager] 서브시퀀스 백업 실패 (id=${safeId}): ${e.message}`);
    }
  }
  fs.writeFileSync(
    file,
    JSON.stringify({ ...data, id: safeId, savedAt: nowLocalIso() }, null, 2)
  );
}

/** mainStepType(예: "AdjustMode") -> 실제 사용할 서브시퀀스 id 매핑. 전역 파일 하나로 관리한다. */
function loadGmsSubSequenceSelection() {
  try {
    if (!fs.existsSync(GMS_SUB_SEQUENCE_SELECTION_FILE)) return {};
    const raw = fs.readFileSync(GMS_SUB_SEQUENCE_SELECTION_FILE, 'utf8');
    const data = JSON.parse(raw);
    return data.selection && typeof data.selection === 'object' ? data.selection : {};
  } catch (e) {
    return {};
  }
}

function saveGmsSubSequenceSelectionToFile(selection) {
  fs.writeFileSync(
    GMS_SUB_SEQUENCE_SELECTION_FILE,
    JSON.stringify({ selection, savedAt: nowLocalIso() }, null, 2)
  );
}

// ── CONFIG 탭(gms.html 상단 탭 전환 바의 "CONFIG.") 설정값 - 서브시퀀스가 조건 판단(예:
// "VPT < 진공하한치")에 쓰는 설정값을 조작자가 직접 입력/수정하는 곳이다. 예전엔 정적
// 예시 표(Item/Status)였는데 실제 편집 가능한 값으로 교체한다. id는 서브시퀀스 Step의
// "비교문"이 참조하는 안정적인 키(예: 'vacuumLowerLimit'), group/name/unit/desc는 화면
// 표시용이라 자유롭게 편집해도 된다. 장비 구분 없이 전역 파일 하나로 관리한다(Main
// 시퀀스와 동일한 패턴 - 설비 사양 자체라 여러 사람이 같은 값을 봐야 함). ──
const GMS_SUB_SEQUENCE_CONFIG_FILE = path.join(dataDir, 'gmsSubSequenceConfig.json');
const SUB_SEQUENCE_CONFIG_DEFAULT_ROWS = [
  {
    id: 'vacuumLowerLimit', group: '설정값', name: '진공하한치(VPT)', value: 50, unit: 'Torr',
    desc: '배관진공 형성 Step에서 VPT 값을 이 값과 비교해 진공 형성 완료 여부를 판단한다(예시값 - 실제 값은 엔지니어링 검토 후 교체 필요).',
  },
];

function loadGmsSubSequenceConfig() {
  try {
    if (!fs.existsSync(GMS_SUB_SEQUENCE_CONFIG_FILE)) return { rows: SUB_SEQUENCE_CONFIG_DEFAULT_ROWS };
    const raw = fs.readFileSync(GMS_SUB_SEQUENCE_CONFIG_FILE, 'utf8');
    const data = JSON.parse(raw);
    return { rows: Array.isArray(data.rows) ? data.rows : SUB_SEQUENCE_CONFIG_DEFAULT_ROWS };
  } catch (e) {
    return { rows: SUB_SEQUENCE_CONFIG_DEFAULT_ROWS };
  }
}

function saveGmsSubSequenceConfigToFile(rows) {
  fs.writeFileSync(
    GMS_SUB_SEQUENCE_CONFIG_FILE,
    JSON.stringify({ rows, savedAt: nowLocalIso() }, null, 2)
  );
}

// ── PT/Weight 아날로그 교정(캘리브레이션) 설정 - "조정모드 > 압력조정" 화면(조정모드 A-1/A-2)
// 에서 편집한다. gmsValves/unit1.json의 실제 pts[] 태그(VT/VPT/FPT는 공통, LPT_·NPT_·HPT_는
// 측별 PT, WI_는 측별 Weight)를 기본값으로 시드한다. 아직 raw 아날로그(mA/V) 배선 전이라
// analogValue(0~resolution 카운트)는 사용자가 직접 입력하는 테스트값이고, 여기서 max/offset과
// 함께 반영해 "현재값"을 계산한다(공식은 public/gms-pt-calibration.js와 동일하게 유지 -
// rangeMin + (analogValue/resolution)*(maxValue-rangeMin) + offset, rangeMin은 type별
// PT=-14.7, VT=0, Weight=0). 장비마다 다르지 않고 설비 사양이라 Main 시퀀스와 동일하게 전역
// 파일 하나로 관리한다. ──
const GMS_PT_CALIBRATION_FILE = path.join(dataDir, 'gmsPtCalibration.json');
const PT_CALIBRATION_DEFAULT_ROWS = [
  { tag: 'VT', type: 'VT', side: 'common', maxValue: 1.0, resolution: 8000, analogValue: 0, offset: 0 },
  { tag: 'VPT', type: 'PT', side: 'common', maxValue: 3000.0, resolution: 8000, analogValue: 0, offset: 0 },
  { tag: 'FPT', type: 'PT', side: 'common', maxValue: 250.0, resolution: 8000, analogValue: 0, offset: 0 },
  { tag: 'LPT_A', type: 'PT', side: 'A', maxValue: 250.0, resolution: 8000, analogValue: 0, offset: 0 },
  { tag: 'NPT_A', type: 'PT', side: 'A', maxValue: 3000.0, resolution: 8000, analogValue: 0, offset: 0 },
  { tag: 'HPT_A', type: 'PT', side: 'A', maxValue: 3000.0, resolution: 8000, analogValue: 0, offset: 0 },
  { tag: 'MPT_A', type: 'PT', side: 'A', maxValue: 3000.0, resolution: 8000, analogValue: 0, offset: 0 },
  { tag: 'WI_A', type: 'Weight', side: 'A', maxValue: 100.0, resolution: 8000, analogValue: 0, offset: 0 },
  { tag: 'LPT_B', type: 'PT', side: 'B', maxValue: 250.0, resolution: 8000, analogValue: 0, offset: 0 },
  { tag: 'NPT_B', type: 'PT', side: 'B', maxValue: 3000.0, resolution: 8000, analogValue: 0, offset: 0 },
  { tag: 'HPT_B', type: 'PT', side: 'B', maxValue: 3000.0, resolution: 8000, analogValue: 0, offset: 0 },
  { tag: 'MPT_B', type: 'PT', side: 'B', maxValue: 3000.0, resolution: 8000, analogValue: 0, offset: 0 },
  { tag: 'WI_B', type: 'Weight', side: 'B', maxValue: 100.0, resolution: 8000, analogValue: 0, offset: 0 },
];

function loadGmsPtCalibration() {
  try {
    if (!fs.existsSync(GMS_PT_CALIBRATION_FILE)) return { rows: PT_CALIBRATION_DEFAULT_ROWS };
    const raw = fs.readFileSync(GMS_PT_CALIBRATION_FILE, 'utf8');
    const data = JSON.parse(raw);
    return { rows: Array.isArray(data.rows) && data.rows.length ? data.rows : PT_CALIBRATION_DEFAULT_ROWS };
  } catch (e) {
    return { rows: PT_CALIBRATION_DEFAULT_ROWS };
  }
}

function saveGmsPtCalibrationToFile(rows) {
  fs.writeFileSync(
    GMS_PT_CALIBRATION_FILE,
    JSON.stringify({ rows, savedAt: nowLocalIso() }, null, 2)
  );
}

// ── PT/Weight/Heater 사용 옵션(OPTION 탭) - 개별 아날로그 채널을 켜고 끈다. 미적용이면
// 배관도/PT 교정 표/작업이력 그리드 열/TREND 태그 목록/히터 조작 화면 등 앱 전체에서 그
// 태그가 보이지 않아야 한다(요청사항). PT 교정과 마찬가지로 여러 사람이 같은 값을 봐야
// 하는 설비 사양이라 localStorage가 아니라 전역 파일 하나로 관리한다. 태그 목록은
// gmsValves/unit1.json의 pts[](PT/VT/Weight) + HEATER_GRID_LAYOUT(Operation.js, M/H·J/H·
// L/H_2nd) 전부를 합친 것과 동일하게 맞춘다. ──
const GMS_ANALOG_ENABLE_FILE = path.join(dataDir, 'gmsAnalogEnableConfig.json');
const ANALOG_ENABLE_DEFAULT_ROWS = [
  { tag: 'VT', category: 'PT', enabled: true },
  { tag: 'VPT', category: 'PT', enabled: true },
  { tag: 'FPT', category: 'PT', enabled: true },
  { tag: 'LPT_A', category: 'PT', enabled: true },
  { tag: 'LPT_B', category: 'PT', enabled: true },
  { tag: 'NPT_A', category: 'PT', enabled: true },
  { tag: 'NPT_B', category: 'PT', enabled: true },
  { tag: 'HPT_A', category: 'PT', enabled: true },
  { tag: 'HPT_B', category: 'PT', enabled: true },
  { tag: 'MPT_A', category: 'PT', enabled: true },
  { tag: 'MPT_B', category: 'PT', enabled: true },
  { tag: 'WI_A', category: 'Weight', enabled: true },
  { tag: 'WI_B', category: 'Weight', enabled: true },
  { tag: 'M/H_A', category: 'Heater', enabled: true },
  { tag: 'M/H_B', category: 'Heater', enabled: true },
  { tag: 'J/H_A', category: 'Heater', enabled: true },
  { tag: 'J/H_B', category: 'Heater', enabled: true },
  { tag: 'L/H_2nd', category: 'Heater', enabled: true },
];

function loadGmsAnalogEnableConfig() {
  try {
    if (!fs.existsSync(GMS_ANALOG_ENABLE_FILE)) return { rows: ANALOG_ENABLE_DEFAULT_ROWS };
    const raw = fs.readFileSync(GMS_ANALOG_ENABLE_FILE, 'utf8');
    const data = JSON.parse(raw);
    return { rows: Array.isArray(data.rows) && data.rows.length ? data.rows : ANALOG_ENABLE_DEFAULT_ROWS };
  } catch (e) {
    return { rows: ANALOG_ENABLE_DEFAULT_ROWS };
  }
}

function saveGmsAnalogEnableConfigToFile(rows) {
  fs.writeFileSync(
    GMS_ANALOG_ENABLE_FILE,
    JSON.stringify({ rows, savedAt: nowLocalIso() }, null, 2)
  );
}

// ── 실PLC 아날로그 배선 전 대체값 - pollOnce가 실제 읽기에 실패(주소 미설정/통신 두절 등)한
// PT/Weight 태그는 null 대신 이 값을 쓴다(밸브의 valveBuffer와 같은 임시 조치 - 실PLC가
// 응답하기 시작하면 pollOnce가 그 값을 그대로 쓰므로 자동으로 대체되어 별도 전환 작업이
// 필요 없다). 공식은 public/gms-pt-calibration.js의 computeCurrentValue와 반드시 동일하게
// 유지한다(화면에 보여주는 "현재값"과 실제 배관도/트렌드/DB에 쓰이는 값이 일치해야 하므로). ──
function rangeMinForCalibType(type) {
  return type === 'PT' ? -14.7 : 0;
}
function computeCalibratedCurrentValue(row) {
  const resolution = Number(row.resolution) || 1;
  const analog = Number(row.analogValue) || 0;
  const percent = Math.max(0, Math.min(1, analog / resolution));
  const rangeMin = rangeMinForCalibType(row.type);
  const max = Number(row.maxValue) || 0;
  const offset = Number(row.offset) || 0;
  return rangeMin + percent * (max - rangeMin) + offset;
}
/** 저장된 캘리브레이션 파일(data/gmsPtCalibration.json) 기준으로 { tag: 현재값 } 맵을 만든다.
    서버가 막 켜졌거나(폴링이 아직 한 사이클도 안 돌아서 gmsState.ptValues가 비어있는 상태) PT
    저장 직후(다음 폴링 사이클 전) 새로 접속한 클라이언트가 배관도에서 "--"를 보지 않도록,
    "폴링이 최소 한 번은 돌아야 값이 채워진다"는 전제 없이 항상 마지막 저장값을 즉시 알 수 있게
    한다. */
function seedPtValuesFromCalibration() {
  const seeded = {};
  try {
    loadGmsPtCalibration().rows.forEach((row) => {
      if (row && row.tag) seeded[row.tag] = computeCalibratedCurrentValue(row);
    });
  } catch (e) { /* 실패해도 pollOnce가 다음 사이클에 채워줌 */ }
  return seeded;
}

// ── USER 등록(작업자 계정) - CONFIG↔OPTION 사이 "USER" 탭의 Univer 그리드(성명/Password/
// 권한)가 쓴다. 마스터 비밀번호 하나(MAINTENANCE_PASSWORD) 대신 작업자별 계정을 두기 위한
// 것 - 장비 구분 없이 전역 파일 하나로 관리한다(Main 시퀀스와 동일한 패턴). data/gmsUsers.json
// 이 없으면 빈 배열로 시작한다(기본 시드 90명은 이미 파일로 만들어져 있음 - 하드코딩 기본값을
// 두지 않는다, 비밀번호가 섞인 데이터라 소스에 박아두지 않기 위함).
const GMS_USERS_FILE = path.join(dataDir, 'gmsUsers.json');

function loadGmsUsers() {
  try {
    if (!fs.existsSync(GMS_USERS_FILE)) return [];
    const raw = fs.readFileSync(GMS_USERS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.users) ? data.users : [];
  } catch (e) {
    return [];
  }
}

function saveGmsUsersToFile(users) {
  fs.writeFileSync(
    GMS_USERS_FILE,
    JSON.stringify({ users, savedAt: nowLocalIso() }, null, 2)
  );
}

// ── 작업이력(work_log) 표시 메시지 설정 - "조작화면 Key 조작 할 때" 어떤 문구로 남길지
// 버튼ID → 메시지로 매핑한다. 코드에 문구를 박아두지 않고 이 파일(엑셀로도 내보내기/
// 불러오기 가능 - server.js의 /api/gms/worklog-messages/export|import/xlsx)로 관리해서
// 나중에 코드 수정 없이 문구만 고칠 수 있게 한다. 장비 구분 없이 전역 파일 하나.
const GMS_WORK_LOG_MESSAGES_FILE = path.join(dataDir, 'gmsWorkLogMessages.json');
const WORK_LOG_MESSAGES_DEFAULT = [
  { buttonId: 'cylinderLockReturnBtn', message: '실린더 잠금 확인 실행' },
  { buttonId: 'residualGasRunBtn', message: '잔류가스 Check 실행' },
  { buttonId: 'pulseVentRunBtn', message: 'Pulse Vent 실행' },
  { buttonId: 'secondaryPurgeRunBtn', message: '2차측 Purge 실행' },
  { buttonId: 'pumpingRunBtn', message: 'Pumping 실행' },
  { buttonId: 'primaryPurgeRunBtn', message: '1차측 Purge 실행' },
  { buttonId: 'exchangePressureTestRunBtn', message: 'PT 감압 시험(교환전) 실행' },
  { buttonId: 'exchangeVtTestRunBtn', message: 'VT 감압 시험(교환전) 실행' },
  { buttonId: 'exchangeSecondPurgeRunBtn', message: '2차 배관청소 실행' },
  { buttonId: 'cylReplaceCheckConfirmBtn', message: '실린더 확인' },
  { buttonId: 'cylReplaceValveOpenConfirmBtn', message: 'Valve Open 확인' },
  { buttonId: 'cylReplaceAutoGuardOpenConfirmBtn', message: 'Auto Guard 확인(Open)' },
  { buttonId: 'cylReplaceSwapConfirmBtn', message: '실린더 분리 및 교체 확인' },
  { buttonId: 'cylReplaceGasNameRunBtn', message: 'Gas name 확인 실행' },
  { buttonId: 'cylReplaceAutoGuardCloseConfirmBtn', message: 'Auto Guard 확인(Close)' },
  { buttonId: 'exchangeThirdPurgeRunBtn', message: '3차 배관청소 실행' },
  { buttonId: 'exchangeAfterPressureTestRunBtn', message: '가압 시험(교환후) 실행' },
  { buttonId: 'exchangeAfterVtTestRunBtn', message: 'VT 감압 시험(교환후) 실행' },
  { buttonId: 'exchangeFourthPurgeRunBtn', message: '4차 배관청소 실행' },
  { buttonId: 'sequencePulsRunBtn', message: '잔류가스 제거(Puls Vent) 실행' },
  { buttonId: 'sequenceBypassRunBtn', message: '배관 By-pass 체크 실행' },
  { buttonId: 'sequenceRgvRunBtn', message: 'Real Gas Vent 실행' },
  { buttonId: 'gasSupplyPressureCheckRunBtn', message: '가스공급 압력 확인 실행' },
  { buttonId: 'gasSupplyValveShutterConfirmBtn', message: 'Valve Shutter 장착 확인' },
  { buttonId: 'gasSupplyRegulatorCloseConfirmBtn', message: 'Regulator Close 확인' },
  { buttonId: 'gasSupplyCylinderOpenConfirmBtn', message: 'Cylinder Open 확인' },
  { buttonId: 'gasSupplyRegulatorAdjustConfirmBtn', message: 'Regulator 조정 확인' },
  { buttonId: 'gasSupplyPmvOpenConfirmBtn', message: 'PMV Open 확인' },
  { buttonId: 'gasSupplyReadyConfirmBtn', message: '가스공급 시작 확인' },
  { buttonId: 'gasSupplyConfirmActionRunBtn', message: '가스공급 중 동작(일시정지/공급중지/강제교체) 실행' },
  { buttonId: 'adjustModeExecuteBtn', message: '영점조정모드 시퀀스 실행' },
  { buttonId: 'manualValveConfirmBtn', message: '수동 밸브 조작 확인' },
  { buttonId: 'heaterConfirmBtn', message: '히터 조작 확인' },
  { buttonId: 'pipeCleanConfirmBtn', message: '수동 배관 청소 확인' },
  { buttonId: 'leakTestConfirmBtn', message: '누출 시험 확인' },
  { buttonId: 'vtTestRunBtn', message: '수동 VT 감압 시험 실행' },
  { buttonId: 'ptTestConfirmBtn', message: '수동 감압 시험(PT) 확인' },
  { buttonId: 'pressureTestConfirmBtn', message: '수동 가압 시험 확인' },
  { buttonId: 'barcodeCheckConfirmBtn', message: '바코드 체크 확인' },
  // ── 취소 버튼 - 위 실행/확인류와 1:1로 대응한다("취소key를 눌렀는데 이력이 남지 않음"
  // 요청으로 추가) ──
  { buttonId: 'mainMenuCancelBtn', message: '메인 메뉴 취소' },
  { buttonId: 'maintenanceMenuCancelBtn', message: '유지보수 메뉴 취소' },
  { buttonId: 'adjustModeCancelBtn', message: '영점조정모드 취소' },
  { buttonId: 'sequencePulsCancelBtn', message: '잔류가스 제거(Puls Vent) 취소' },
  { buttonId: 'sequenceBypassCancelBtn', message: '배관 By-pass 체크 취소' },
  { buttonId: 'sequenceRgvCancelBtn', message: 'Real Gas Vent 취소' },
  { buttonId: 'manualValveCancelBtn', message: '수동 밸브 조작 취소' },
  { buttonId: 'heaterCancelBtn', message: '히터 조작 취소' },
  { buttonId: 'maintenancePurgeCancelBtn', message: 'Maintenance Purge 취소' },
  { buttonId: 'pipeCleanCancelBtn', message: '수동 배관 청소 취소' },
  { buttonId: 'leakTestCancelBtn', message: '누출 시험 취소' },
  { buttonId: 'vtTestCancelBtn', message: '수동 VT 감압 시험 취소' },
  { buttonId: 'ptTestCancelBtn', message: '수동 감압 시험(PT) 취소' },
  { buttonId: 'pressureTestCancelBtn', message: '수동 가압 시험 취소' },
  { buttonId: 'barcodeCheckCancelBtn', message: '바코드 체크 취소' },
  { buttonId: 'cylinderLockCancelBtn', message: '실린더 잠금 확인 취소' },
  { buttonId: 'residualGasCancelBtn', message: '잔류가스 Check 취소' },
  { buttonId: 'pulseVentCancelBtn', message: 'Pulse Vent 취소' },
  { buttonId: 'secondaryPurgeCancelBtn', message: '2차측 Purge 취소' },
  { buttonId: 'pumpingCancelBtn', message: 'Pumping 취소' },
  { buttonId: 'primaryPurgeCancelBtn', message: '1차측 Purge 취소' },
  { buttonId: 'exchangePressureTestCancelBtn', message: 'PT 감압 시험(교환전) 취소' },
  { buttonId: 'exchangeVtTestCancelBtn', message: 'VT 감압 시험(교환전) 취소' },
  { buttonId: 'exchangeSecondPurgeCancelBtn', message: '2차 배관청소 취소' },
  { buttonId: 'cylReplaceForcePurgeCancelBtn', message: '강제 Purge 취소' },
  { buttonId: 'cylReplaceCheckCancelBtn', message: '실린더 확인 취소' },
  { buttonId: 'cylReplaceValveOpenCancelBtn', message: 'Valve Open 취소' },
  { buttonId: 'cylReplaceAutoGuardOpenCancelBtn', message: 'Auto Guard 취소(Open)' },
  { buttonId: 'cylReplaceSwapCancelBtn', message: '실린더 분리 및 교체 취소' },
  { buttonId: 'cylReplaceGasNameCancelBtn', message: 'Gas name 확인 취소' },
  { buttonId: 'cylReplaceAutoGuardCloseCancelBtn', message: 'Auto Guard 취소(Close)' },
  { buttonId: 'exchangeThirdPurgeCancelBtn', message: '3차 배관청소 취소' },
  { buttonId: 'exchangeAfterPressureTestCancelBtn', message: '가압 시험(교환후) 취소' },
  { buttonId: 'exchangeAfterVtTestCancelBtn', message: 'VT 감압 시험(교환후) 취소' },
  { buttonId: 'exchangeFourthPurgeCancelBtn', message: '4차 배관청소 취소' },
  { buttonId: 'exchangePurgeCompleteCancelBtn', message: 'PC 완료 화면 취소(준비전으로 초기화)' },
  { buttonId: 'gasSupplyPressureCheckCancelBtn', message: '가스공급 압력 확인 취소' },
  { buttonId: 'gasSupplyValveShutterCancelBtn', message: 'Valve Shutter 장착 취소' },
  { buttonId: 'gasSupplyRegulatorCloseCancelBtn', message: 'Regulator Close 취소' },
  { buttonId: 'gasSupplyCylinderOpenCancelBtn', message: 'Cylinder Open 취소' },
  { buttonId: 'gasSupplyRegulatorAdjustCancelBtn', message: 'Regulator 조정 취소' },
  { buttonId: 'gasSupplyPmvOpenCancelBtn', message: 'PMV Open 취소' },
  { buttonId: 'gasSupplyReadyCancelBtn', message: '가스공급 시작 취소' },
  { buttonId: 'gasSupplyConfirmActionCancelBtn', message: '가스공급 중 동작 취소' },
  { buttonId: 'workLogDataClearBtn', message: '작업이력 화면 Data Clear' },
  { buttonId: 'pmModeOnBtn', message: 'PM Mode 적용' },
  { buttonId: 'pmModeOffBtn', message: 'PM Mode 미적용' },
  { buttonId: 'setupModeOnBtn', message: 'Set-up Mode 적용' },
  { buttonId: 'setupModeOffBtn', message: 'Set-up Mode 미적용' },
  { buttonId: 'workLogCloseBtn', message: '작업이력 닫기' },
  { buttonId: 'auxMaintenanceModeCloseBtn', message: '유지보수모드 이전화면 복귀' },
  { buttonId: 'optionDisplayRefreshBtn', message: 'OPTION DISPLAY 새로고침' },
  { buttonId: 'optionDisplayCloseBtn', message: 'OPTION DISPLAY 닫기' },
  { buttonId: 'trendBackBtn', message: 'TREND 화면 이전화면 복귀' },
  { buttonId: 'cylinderLockTrendBtn', message: '실린더 잠금 check TREND' },
  { buttonId: 'residualGasTrendBtn', message: '잔류가스 Check TREND' },
  { buttonId: 'pulseVentTrendBtn', message: 'Pulse Vent TREND' },
  { buttonId: 'secondaryPurgeTrendBtn', message: '2차측 Purge TREND' },
  { buttonId: 'pumpingTrendBtn', message: 'Pumping TREND' },
  { buttonId: 'primaryPurgeTrendBtn', message: '1차측 Purge TREND' },
  { buttonId: 'exchangePressureTestTrendBtn', message: 'PT 감압 시험(교환전) TREND' },
  { buttonId: 'exchangeSecondPurgeTrendBtn', message: '2차 배관청소 TREND' },
  { buttonId: 'exchangeThirdPurgeTrendBtn', message: '3차 배관청소 TREND' },
  { buttonId: 'exchangeAfterPressureTestTrendBtn', message: '가압 시험(교환후) TREND' },
  { buttonId: 'exchangeFourthPurgeTrendBtn', message: '4차 배관청소 TREND' },
  { buttonId: 'exchangePurgeCompleteTrendBtn', message: 'PC 완료 화면 TREND' },
  { buttonId: 'gasSupplyActiveTrendBtn', message: '가스공급 중 TREND' },
  { buttonId: 'sequencePulsTrendBtn', message: '잔류가스 제거(Puls Vent) TREND' },
  { buttonId: 'sequenceBypassTrendBtn', message: '배관 By-pass 체크 TREND' },
  { buttonId: 'sequenceRgvTrendBtn', message: 'Real Gas Vent TREND' },
  { buttonId: 'manualValveExitCloseBtn', message: '수동 밸브 조작 나가기(밸브 CLOSE 후 종료)' },
  { buttonId: 'manualValveExitKeepBtn', message: '수동 밸브 조작 나가기(상태 유지)' },
  { buttonId: 'manualValveQcBtn', message: '수동 밸브 조작 Q/C' },
  { buttonId: 'heaterToValveBtn', message: '히터 조작 → 수동 밸브 조작(V/V) 전환' },
  { buttonId: 'heaterQcBtn', message: '히터 조작 Q/C' },
  { buttonId: 'cylReplaceSwapZeroBtn', message: 'Load Cell Offset Zero Setting' },
  { buttonId: 'cylReplaceGasNameLotSkipBtn', message: 'Gas name 확인 Lot No. Skip' },
  { buttonId: 'cylReplaceGasNameManualBtn', message: 'Gas name 확인 바코드 수동입력' },
  { buttonId: 'cylReplaceGasNameCheckBtn', message: 'Gas name 확인 바코드 확인' },
  { buttonId: 'gasSupplyPressureCheckAdjustModeBtn', message: '가스공급 압력 확인 조정모드' },
  { buttonId: 'gasSupplyPressureCheckLineVentBtn', message: '가스공급 압력 확인 Line Vent' },
  { buttonId: 'exchangePurgeCompleteGasSupplyBtn', message: 'PC 완료 화면 가스공급 진입' },
  { buttonId: 'exchangePurgeCompleteSwitchSideBtn', message: 'PC 완료 화면 반대 측 전환' },
  { buttonId: 'exchangePurgeCompleteMaintenanceBtn', message: 'PC 완료 화면 유지보수 진입' },
  { buttonId: 'gasSupplyActivePauseBtn', message: '가스공급 중 일시정지 요청' },
  { buttonId: 'gasSupplyActiveStopBtn', message: '가스공급 중 공급중지 요청' },
  { buttonId: 'gasSupplyActiveSwitchSideBtn', message: '가스공급 중 반대 측 전환' },
  { buttonId: 'gasSupplyActiveForceChangeBtn', message: '가스공급 중 강제교체 요청' },
  { buttonId: 'cylReplaceCheckModeBtn', message: '실린더 확인 준비전 모드변경' },
  { buttonId: 'cylReplaceCheckForcePurgeBtn', message: '실린더 확인 Force Purge 진입' },
  { buttonId: 'statusJumpBadge', message: 'CYLINDER STEP STATUS 배지 Status Jump' },
  { buttonId: 'progressABtn', message: '진행 메뉴에서 "A" 선택' },
  { buttonId: 'progressBBtn', message: '진행 메뉴에서 "B" 선택' },
  { buttonId: 'progressAuxBtn', message: '진행 메뉴 보조 메뉴 열기' },
  { buttonId: 'mainMenuAuxBtn', message: '메인 메뉴 보조 메뉴 열기' },
  { buttonId: 'mainMenuSwitchSideBtn', message: '메인 메뉴 반대 측 전환' },
  { buttonId: 'exchangePurgeCompleteAuxBtn', message: 'PC 완료 화면 보조 메뉴 열기' },
  { buttonId: 'gasSupplyActiveAuxBtn', message: '가스공급 중 화면 보조 메뉴 열기' },
  { buttonId: 'mainMenuCylinderExchangeBtn', message: '메인 메뉴 실린더 교환 진입' },
  { buttonId: 'mainMenuMaintenanceEntryBtn', message: '메인 메뉴 유지 보수 진입' },
  { buttonId: 'mainMenuTrendBtn', message: '메인 메뉴 TREND 진입' },
  { buttonId: 'maintenanceMenuManualValveBtn', message: '유지보수 메뉴 수동밸브 조작 진입' },
  { buttonId: 'maintenanceMenuBarcodeBtn', message: '유지보수 메뉴 바코드 체크 진입' },
  { buttonId: 'maintenanceMenuPurgeBtn', message: '유지보수 메뉴 Maintenance Purge 진입' },
  { buttonId: 'auxMenuAdjustABtn', message: '보조 메뉴 조정모드 A 진입' },
  { buttonId: 'auxMenuAdjustBBtn', message: '보조 메뉴 조정모드 B 진입' },
  { buttonId: 'auxMenuWorkLogBtn', message: '보조 메뉴 작업이력 진입' },
  { buttonId: 'auxMenuOptionDisplayBtn', message: '보조 메뉴 OPTION DISPLAY 진입' },
  { buttonId: 'auxMenuMaintenanceBtn', message: '보조 메뉴 유지보수모드 진입' },
  { buttonId: 'etcPmBtn', message: 'etc행 PM 램프 클릭(유지보수모드로 이동)' },
  { buttonId: 'etcSetupBtn', message: 'etc행 SETUP 램프 클릭(유지보수모드로 이동)' },
];

function loadGmsWorkLogMessages() {
  try {
    if (!fs.existsSync(GMS_WORK_LOG_MESSAGES_FILE)) return WORK_LOG_MESSAGES_DEFAULT;
    const raw = fs.readFileSync(GMS_WORK_LOG_MESSAGES_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.messages) && data.messages.length ? data.messages : WORK_LOG_MESSAGES_DEFAULT;
  } catch (e) {
    return WORK_LOG_MESSAGES_DEFAULT;
  }
}

function saveGmsWorkLogMessagesToFile(messages) {
  fs.writeFileSync(
    GMS_WORK_LOG_MESSAGES_FILE,
    JSON.stringify({ messages, savedAt: nowLocalIso() }, null, 2)
  );
}

// ── 화면 제목("작업이력" 그리드 A열 "HTML화면") - 위 작업이력 메시지 설정과 완전히 동일한
// 패턴(JSON 파일 + 엑셀 export/import). Operation.js의 showProgressScreen(screenKey, 제목)
// 호출 ~50곳이 이 제목을 하드코딩 대신 조회해서 쓴다(screenTitleFor/sideScreenTitle) - A/B
// 측 접두사([A]/[B])는 화면단에서 별도로 붙이므로 여기 저장되는 title은 접두사 없는
// 기본 문구다(예: "실린더 잠금 check", "자동 진행"). ──
const GMS_SCREEN_TITLES_FILE = path.join(dataDir, 'gmsScreenTitles.json');
const SCREEN_TITLES_DEFAULT = [
  { screenKey: 'root', title: '진행 메뉴' },
  { screenKey: 'mainMenu', title: '메인 메뉴' },
  { screenKey: 'password', title: 'PASSWORD' },
  { screenKey: 'maintenanceMenu', title: '유지보수 메뉴' },
  { screenKey: 'manualValve', title: '수동 밸브 조작' },
  { screenKey: 'heater', title: '히터 조작' },
  { screenKey: 'maintenancePurge', title: 'Maintenance Purge' },
  { screenKey: 'pipeClean', title: '수동 배관 청소' },
  { screenKey: 'leakTest', title: '수동 누출 시험' },
  { screenKey: 'vtTest', title: '수동 VT 감압시험' },
  { screenKey: 'ptTest', title: '수동 감압 시험' },
  { screenKey: 'pressureTest', title: '수동 가압 시험' },
  { screenKey: 'barcodeCheck', title: '수동 바코드 체크' },
  { screenKey: 'cylinderLockCheck', title: '실린더 잠금 check' },
  { screenKey: 'residualGasCheck', title: '잔류가스 Check' },
  { screenKey: 'pulseVent', title: 'Pulse Vent' },
  { screenKey: 'secondaryPurge', title: '2차측 Purge' },
  { screenKey: 'pumping', title: 'Pumping' },
  { screenKey: 'primaryPurge', title: '1차측 Purge' },
  { screenKey: 'exchangePressureTest', title: '자동 진행' },
  { screenKey: 'exchangeVtTest', title: '자동 진행' },
  { screenKey: 'exchangeSecondPurge', title: '자동 진행' },
  { screenKey: 'cylReplaceCheck', title: '자동 진행' },
  { screenKey: 'cylReplaceValveOpen', title: '자동 진행' },
  { screenKey: 'cylReplaceAutoGuardOpen', title: '자동 진행' },
  { screenKey: 'cylReplaceSwap', title: '자동 진행' },
  { screenKey: 'cylReplaceGasName', title: '자동 진행' },
  { screenKey: 'cylReplaceAutoGuardClose', title: '자동 진행' },
  { screenKey: 'exchangeThirdPurge', title: '자동 진행' },
  { screenKey: 'exchangeAfterPressureTest', title: '자동 진행' },
  { screenKey: 'exchangeAfterVtTest', title: '자동 진행' },
  { screenKey: 'exchangeFourthPurge', title: '자동 진행' },
  { screenKey: 'exchangePurgeComplete', title: '가스 공급' },
  { screenKey: 'sequencePuls', title: '자동 진행' },
  { screenKey: 'sequenceBypass', title: '자동 진행' },
  { screenKey: 'sequenceRgv', title: '자동 진행' },
  { screenKey: 'cylReplaceForcePurge', title: '자동 진행' },
  { screenKey: 'gasSupplyPressureCheck', title: '자동 진행' },
  { screenKey: 'gasSupplyValveShutter', title: '자동 진행' },
  { screenKey: 'gasSupplyRegulatorClose', title: '자동 진행' },
  { screenKey: 'gasSupplyCylinderOpen', title: '자동 진행' },
  { screenKey: 'gasSupplyRegulatorAdjust', title: '자동 진행' },
  { screenKey: 'gasSupplyPmvOpen', title: '자동 진행' },
  { screenKey: 'gasSupplyReady', title: '자동 진행' },
  { screenKey: 'gasSupplyActive', title: '자동 진행' },
  { screenKey: 'gasSupplyConfirmAction', title: '자동 진행' },
  { screenKey: 'trend', title: 'TREND' },
  { screenKey: 'adjustMode', title: '압력 조정 모드' },
  { screenKey: 'workLog', title: '작업이력' },
  { screenKey: 'optionDisplay', title: 'OPTION DISPLAY' },
  { screenKey: 'auxMaintenanceMode', title: '유지보수모드' },
];

function loadGmsScreenTitles() {
  try {
    if (!fs.existsSync(GMS_SCREEN_TITLES_FILE)) return SCREEN_TITLES_DEFAULT;
    const raw = fs.readFileSync(GMS_SCREEN_TITLES_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.titles) && data.titles.length ? data.titles : SCREEN_TITLES_DEFAULT;
  } catch (e) {
    return SCREEN_TITLES_DEFAULT;
  }
}

function saveGmsScreenTitlesToFile(titles) {
  fs.writeFileSync(
    GMS_SCREEN_TITLES_FILE,
    JSON.stringify({ titles, savedAt: nowLocalIso() }, null, 2)
  );
}

// ── 밸브 목록 파일 저장/로드 - 장비(가스캐비닛)마다 태그 구조가 달라서 장비 id별로 별도
// 파일(data/gmsValves/<unitId>.json)에 저장한다. ──
function loadGmsValves(unitId) {
  try {
    const file = path.join(GMS_VALVES_DIR, `${sanitizeUnitId(unitId)}.json`);
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.valves) ? data.valves : [];
  } catch (e) {
    return [];
  }
}

/** 배관도 위 PT(압력 트랜스미터) 등 아날로그 표시값 목록. 밸브와 같은 파일(pts 필드)에 저장된다. */
function loadGmsPts(unitId) {
  try {
    const file = path.join(GMS_VALVES_DIR, `${sanitizeUnitId(unitId)}.json`);
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.pts) ? data.pts : [];
  } catch (e) {
    return [];
  }
}

function saveGmsValvesToFile(unitId, valves, pts) {
  const file = path.join(GMS_VALVES_DIR, `${sanitizeUnitId(unitId)}.json`);
  // pts를 명시적으로 넘기지 않으면(맵 에디터가 아닌 밸브 목록만 저장하는 호출) 기존 값을 보존한다.
  let ptsToSave = pts;
  if (!Array.isArray(ptsToSave)) {
    ptsToSave = [];
    try {
      if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (Array.isArray(data.pts)) ptsToSave = data.pts;
      }
    } catch (e) { /* 무시 - 새 파일이거나 손상된 경우 pts 없이 진행 */ }
  }
  fs.writeFileSync(file, JSON.stringify({ valves, pts: ptsToSave, savedAt: nowLocalIso() }, null, 2));
}

function chunkItems(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** PT(아날로그) 목록을 FINS 워드 읽기 항목으로 펼친다. gridManager.js의 buildReadPlan과 동일 패턴. */
function buildPtReadPlan(pts) {
  const items = [];
  const plan = []; // { pt, index, startIdx, wordCount, error? }
  pts.forEach((p, index) => {
    let area;
    try {
      area = areaNameToWordCode(p.read.area);
    } catch (e) {
      plan.push({ pt: p, index, startIdx: -1, wordCount: 0, error: e.message });
      return;
    }
    const wordCount = wordCountFor(p.dataType || 'INT');
    const startIdx = items.length;
    for (let i = 0; i < wordCount; i++) {
      items.push({ label: `pt${index}#${i}`, area, addr: p.read.address + i, bit: 0 });
    }
    plan.push({ pt: p, index, startIdx, wordCount });
  });
  return { items, plan };
}

function createGmsManager({ getClient, broadcast, pushLog, recordRecvSuccess, reconnectClient }) {
  // 인스턴스별 상태 - 다중 세션에서 매니저를 여러 개 만들 수 있도록 모듈 레벨이 아니라 팩토리 안에 둔다.
  const gmsState = {
    status: 'stopped', // 'stopped' | 'running' | 'paused'
    intervalMs: 1000,
    timer: null,
    values: {}, // { tag: { cmd: bool|null, fb: bool|null } }
    // 밸브 개폐 상태 - 실PLC에 아직 프로그램이 없어(통신만 연결된 상태) CIO를 실제로 읽고
    // 써도 의미가 없다. 프로그램이 들어가기 전까지는 PC 쪽 이 버퍼값만으로 밸브 시퀀스를
    // 동작시킨다(writeValve가 채우고, pollOnce가 이 값을 그대로 cmd/fb에 반영). 한 번도
    // 조작하지 않은 태그는 CLOSE로 간주한다. { tag: bool }
    valveBuffer: {},
    // { tag: number|null } - PT(압력 트랜스미터) 등 아날로그 표시값. 서버가 막 켜진 시점에도
    // (아직 폴링이 한 사이클도 안 돌았어도) 배관도에 "--" 대신 저장된 캘리브레이션 기준값이
    // 바로 보이도록 빈 객체가 아니라 시드된 값으로 시작한다.
    ptValues: seedPtValuesFromCalibration(),
    faultCounters: {}, // { tag: 연속 불일치 사이클 수 } - 밸브 동작 중 순간 불일치로 알람이 튀지 않게 디바운스
    consecutiveCycleErrors: 0,
    reconnectAttempts: 0,
    lastReconnectAt: 0,
    activeUnitId: null, // 장비 선택 화면에서 고른 장비 - 폴링/쓰기가 이 장비의 밸브 목록을 기준으로 동작
    // 보조 메뉴 "유지보수모드"(기존 조작화면의 유지보수 메뉴와는 별개) - PASSWORD 통과 후
    // PM Mode/Set-up Mode를 각각 적용/미적용 할 수 있다. PM Mode: shutdown 알람센서 Test 중
    // 실제로 장비가 shutdown 되지 않게 하는 목적. Set-up Mode: GMS 모니터링이 상위로 올리는
    // 통신 프로토콜 중 Alarm 항목을 올리지 않게(차단) 하는 목적. 실제 shutdown 억제/상위
    // Alarm 전송 차단 로직은 아직 없음(뼈대) - 지금은 상태 보관 + 브로드캐스트 + 화면
    // 표시(램프)까지만. 서버 재시작 시 안전하게 둘 다 false로 초기화된다(persist 안 함).
    pmMode: false,
    setupMode: false,
  };

  /** 장비 선택 화면에서 넘어온 unitId를 "지금 보고 있는 장비"로 기록한다. */
  function setActiveUnit(unitId) {
    gmsState.activeUnitId = unitId;
  }

  function getMaintenanceMode() {
    return { pmMode: gmsState.pmMode, setupMode: gmsState.setupMode };
  }
  /** PM Mode/Set-up Mode를 켜고 끈다 - 어느 클라이언트가 눌렀든 연결된 모든 화면(배관도
      램프 포함)이 같은 상태를 보도록 브로드캐스트한다(밸브/PT 값과 같은 방식). 실제로
      "누가" 바꿨는지는 클라이언트(Operation.js의 logWorkAction)가 PASSWORD 확인 후
      work_log에 남긴다 - 여기서는 상태만 바꾼다. */
  function setMaintenanceMode(mode, active) {
    if (mode !== 'pm' && mode !== 'setup') {
      throw new Error(`알 수 없는 모드: "${mode}" (pm 또는 setup)`);
    }
    if (mode === 'pm') gmsState.pmMode = !!active;
    else gmsState.setupMode = !!active;
    const label = mode === 'pm' ? 'PM Mode' : 'Set-up Mode';
    pushLog('SYSTEM', `[GMS] ${label} ${active ? '적용' : '미적용'}`, null);
    emitEvent('INFO', `${label} ${active ? '적용' : '미적용'}`);
    broadcast({ type: 'gmsMaintenanceMode', payload: getMaintenanceMode() });
    return getMaintenanceMode();
  }

  async function tryAutoReconnect() {
    if (!reconnectClient) return;
    const { intervalMs, maxRetries } = reconnectPolicy();
    const now = Date.now();
    if (now - gmsState.lastReconnectAt < intervalMs) return;
    if (maxRetries > 0 && gmsState.reconnectAttempts >= maxRetries) {
      if (gmsState.reconnectAttempts === maxRetries) {
        pushLog('WARN', `[GMS] 자동 재연결 최대 시도(${maxRetries}회) 초과 - 자동 복구를 멈춥니다. 수동으로 다시 연결하세요.`, null);
        gmsState.reconnectAttempts += 1;
      }
      return;
    }
    gmsState.lastReconnectAt = now;
    gmsState.reconnectAttempts += 1;
    try {
      await reconnectClient();
      pushLog('SYSTEM', `[GMS] 자동 재연결 시도 ${gmsState.reconnectAttempts}회`, null);
      emitEvent('WARN', `자동 재연결 시도 ${gmsState.reconnectAttempts}회`);
    } catch (err) {
      pushLog('ERROR', `[GMS] 자동 재연결 실패(${gmsState.reconnectAttempts}회): ${err.message}`, null);
      emitEvent('ERROR', `자동 재연결 실패(${gmsState.reconnectAttempts}회): ${err.message}`);
    }
  }

  /** Live Events 기록 + 화면 실시간 갱신 브로드캐스트를 한 번에. */
  function emitEvent(grade, message) {
    const ts = nowLocalIso();
    history.recordEvent(gmsState.activeUnitId, grade, message);
    broadcast({ type: 'gmsEvent', payload: { unitId: gmsState.activeUnitId, ts, grade, message } });
  }

  // 밸브 cmd≠fb 불일치가 이 사이클 수만큼 연속되면 알람 발생(동작 중 순간 불일치 무시)
  const FAULT_DEBOUNCE_CYCLES = 3;

  /** 밸브 불일치 알람 에지 검출 - 현재 유일한 알람 소스. IO MAP Alert 연동 시 확장 지점. */
  function updateFaultAlarms(values) {
    const unitId = gmsState.activeUnitId;
    if (!unitId) return;
    for (const [tag, v] of Object.entries(values)) {
      const isFault = v && v.cmd !== null && v.fb !== null && v.cmd !== v.fb;
      const prev = gmsState.faultCounters[tag] || 0;
      gmsState.faultCounters[tag] = isFault ? prev + 1 : 0;
      const shouldAlarm = gmsState.faultCounters[tag] >= FAULT_DEBOUNCE_CYCLES;
      const change = history.setAlarmState(unitId, tag, shouldAlarm, {
        grade: 2,
        message: `${tag} 밸브 명령/피드백 불일치`,
      });
      if (change) {
        broadcast({
          type: 'gmsAlarm',
          payload: { unitId, tag, state: change, grade: 2, message: `${tag} 밸브 명령/피드백 불일치`, ts: nowLocalIso() },
        });
      }
    }
  }

  async function pollOnce(valves, pts) {
    const { items: ptItems, plan: ptPlan } = buildPtReadPlan(pts);
    const client = getClient();
    const rawByItemLabel = {};
    const chunks = chunkItems(ptItems, MAX_ITEMS_PER_READ);
    let anySuccess = false;

    for (const chunk of chunks) {
      if (gmsState.status !== 'running') break;
      try {
        const results = await client.readItems(chunk);
        results.forEach((r, idx) => {
          rawByItemLabel[chunk[idx].label] = r.value;
        });
        recordRecvSuccess();
        anySuccess = true;
      } catch (err) {
        pushLog('ERROR', `[GMS] 읽기 실패: ${err.message}`, null);
      }
    }

    // 통신이 몇 사이클 연속으로 전부 실패하면(예: 정지 후 재시작 시 USB/소켓이 응답 불능 상태로
    // 굳어버리는 경우) 사용자가 수동으로 하던 "연결 해제 후 재연결"을 자동으로 수행한다.
    if (chunks.length > 0) {
      if (anySuccess) {
        gmsState.consecutiveCycleErrors = 0;
        gmsState.reconnectAttempts = 0;
      } else {
        gmsState.consecutiveCycleErrors += 1;
        if (gmsState.consecutiveCycleErrors >= RECONNECT_AFTER_CYCLES && reconnectClient) {
          gmsState.consecutiveCycleErrors = 0;
          await tryAutoReconnect();
        }
      }
    }

    // 밸브 개폐 상태 - 실PLC 통신 없이 gmsState.valveBuffer(PC 쪽 임시 버퍼)를 그대로
    // cmd/fb에 반영한다(둘 다 항상 같은 값이라 불일치/FAULT가 날 수 없다). 아직 프로그램이
    // 없는 PLC의 CIO를 읽어봐야 의미가 없어서 내린 임시 조치 - 실PLC 프로그램이 들어가면
    // 이 블록을 실제 client.readItems 기반 읽기로 되돌려야 한다.
    const values = {};
    for (const v of valves) {
      const buffered = gmsState.valveBuffer[v.tag];
      const state = buffered === undefined ? false : buffered;
      values[v.tag] = { cmd: state, fb: state };
    }

    // 캘리브레이션 표(조정모드 > 압력조정)의 "현재값" - 실제 읽기 실패 시 대체값으로 쓴다.
    const calibrationByTag = new Map(loadGmsPtCalibration().rows.map((r) => [r.tag, r]));

    const ptValues = {};
    for (const p of ptPlan) {
      let value = null;
      if (!p.error) {
        const words = [];
        for (let i = 0; i < p.wordCount; i++) words.push(rawByItemLabel[`pt${p.index}#${i}`]);
        const raw = decodeValue(p.pt.dataType || 'INT', words, 0);
        const decimals = p.pt.decimals || 0;
        value = raw === undefined || raw === null ? null : raw / Math.pow(10, decimals);
      }
      if (value === null) {
        const calRow = calibrationByTag.get(p.pt.tag);
        if (calRow) value = computeCalibratedCurrentValue(calRow);
      }
      ptValues[p.pt.tag] = value;
    }

    gmsState.values = { ...gmsState.values, ...values };
    gmsState.ptValues = { ...gmsState.ptValues, ...ptValues };
    broadcast({ type: 'gmsValues', payload: { values, pts: ptValues, lastUpdate: nowLocalIso() } });

    // 데이터 이력: PT 샘플 기록 + 밸브 불일치 알람 에지 검출 (기록 실패가 폴링을 막지 않음)
    history.recordPtSamples(gmsState.activeUnitId, ptValues);
    updateFaultAlarms(values);
  }

  async function loopStep() {
    if (gmsState.status !== 'running') return;
    const valves = loadGmsValves(gmsState.activeUnitId);
    const pts = loadGmsPts(gmsState.activeUnitId);
    const startedAt = Date.now();
    try {
      await pollOnce(valves, pts);
    } catch (e) {
      pushLog('ERROR', '[GMS] 폴링 오류: ' + e.message, null);
    }
    if (gmsState.status !== 'running') return;
    const elapsed = Date.now() - startedAt;
    const wait = Math.max(0, gmsState.intervalMs - elapsed);
    gmsState.timer = setTimeout(loopStep, wait);
  }

  function start(intervalMs) {
    if (!gmsState.activeUnitId) {
      throw new Error('장비를 먼저 선택해야 GMS 폴링을 시작할 수 있습니다.');
    }
    const client = getClient();
    if (!client || !client.connected) {
      throw new Error('PLC에 먼저 연결해야 GMS 폴링을 시작할 수 있습니다.');
    }
    if (intervalMs) gmsState.intervalMs = intervalMs;
    if (gmsState.timer) clearTimeout(gmsState.timer);
    gmsState.status = 'running';
    gmsState.reconnectAttempts = 0;
    gmsState.lastReconnectAt = 0;
    pushLog('SYSTEM', `[GMS] 폴링 시작 (주기 ${gmsState.intervalMs}ms)`, null);
    history.recordWork(gmsState.activeUnitId, 'POLL_START', null, `${gmsState.intervalMs}ms`, 'OK');
    emitEvent('INFO', `폴링 시작 (주기 ${gmsState.intervalMs}ms)`);
    broadcast({ type: 'gmsStatus', payload: { status: gmsState.status, intervalMs: gmsState.intervalMs } });
    loopStep();
  }

  function pause() {
    if (gmsState.timer) {
      clearTimeout(gmsState.timer);
      gmsState.timer = null;
    }
    gmsState.status = 'paused';
    pushLog('SYSTEM', '[GMS] 폴링 일시정지', null);
    history.recordWork(gmsState.activeUnitId, 'POLL_PAUSE', null, null, 'OK');
    emitEvent('INFO', '폴링 일시정지');
    broadcast({ type: 'gmsStatus', payload: { status: gmsState.status, intervalMs: gmsState.intervalMs } });
  }

  function stop() {
    if (gmsState.timer) {
      clearTimeout(gmsState.timer);
      gmsState.timer = null;
    }
    gmsState.status = 'stopped';
    pushLog('SYSTEM', '[GMS] 폴링 정지', null);
    history.recordWork(gmsState.activeUnitId, 'POLL_STOP', null, null, 'OK');
    emitEvent('INFO', '폴링 정지');
    broadcast({ type: 'gmsStatus', payload: { status: gmsState.status, intervalMs: gmsState.intervalMs } });
  }

  function getStatus() {
    return { status: gmsState.status, intervalMs: gmsState.intervalMs };
  }

  function getValues() {
    return gmsState.values;
  }

  function getPtValues() {
    return gmsState.ptValues;
  }

  /** 압력조정 화면에서 캘리브레이션을 저장할 때(POST /api/gms/pt-calibration) 호출한다.
      pollOnce는 폴링이 실제로 돌고 있을 때만 gmsState.ptValues를 갱신하므로, 폴링이 정지된
      상태에서 저장하면(가상 테스트, 아직 연결 전) 이 저장이 서버 메모리엔 전혀 반영되지
      않고 브로드캐스트로 지금 붙어있는 클라이언트만 잠깐 최신값을 볼 뿐, 그 다음에 새로
      접속하는 클라이언트(또는 새로고침)는 다시 예전 값(또는 빈 값)을 받는 문제가 있었다. */
  function refreshPtValuesFromCalibration(rows) {
    if (!Array.isArray(rows)) return;
    rows.forEach((row) => {
      if (row && row.tag) gmsState.ptValues[row.tag] = computeCalibratedCurrentValue(row);
    });
  }

  /** 밸브 태그 하나에 개폐 명령(cmd 비트)을 쓴다. 성공/실패 모두 조작 이력에 남긴다. */
  /**
   * 밸브 태그 하나에 개폐 명령을 "쓴다" - 단, 실PLC에는 아직 프로그램이 없어(통신만 연결된
   * 상태) CIO로 실제 쓰기를 보내도 아무 의미가 없다. PLC 프로그램이 들어가기 전까지는 CIO에
   * 손대지 않고 gmsState.valveBuffer(PC 쪽 임시 버퍼)에만 값을 반영해 시퀀스를 PC에서
   * 자체적으로 마무리한다(요청에 따른 임시 조치 - 실PLC 프로그램이 들어가면 client.writeBit
   * 기반 실제 쓰기로 되돌려야 한다).
   */
  async function writeValve(tag, boolValue) {
    const detail = boolValue ? 'OPEN' : 'CLOSE';
    try {
      if (!gmsState.activeUnitId) {
        throw new Error('장비를 먼저 선택해야 밸브를 제어할 수 있습니다.');
      }
      const valves = loadGmsValves(gmsState.activeUnitId);
      const valve = valves.find((v) => v.tag === tag);
      if (!valve) throw new Error(`알 수 없는 밸브 태그: "${tag}"`);
      gmsState.valveBuffer[tag] = !!boolValue;
      // 배관도(SVG)/수동 밸브 조작 격자는 폴링 사이클(pollOnce)의 gmsValues 브로드캐스트를
      // 받아야 색이 바뀌는데, 폴링이 정지 상태이거나 주기가 길면 밸브를 써도 화면에 한참
      // 반영이 안 되는 것처럼 보인다(실IO 연결 전 가상 테스트 시 특히 체감). 폴링 상태와
      // 무관하게 지금 쓴 태그 하나만 즉시 브로드캐스트해서 다음 폴링 사이클을 기다리지 않고
      // 바로 반영되게 한다(다음 폴링 사이클이 와도 같은 값이라 덮어쓰기 문제는 없음).
      broadcast({ type: 'gmsValues', payload: { values: { [tag]: { cmd: !!boolValue, fb: !!boolValue } } } });
      pushLog('SYSTEM', `[GMS] 밸브 ${tag} ${detail} 명령 전송(PC 버퍼 - CIO 미전송)`, null);
      history.recordWork(gmsState.activeUnitId, 'VALVE_WRITE', tag, detail, 'OK');
      emitEvent('INFO', `밸브 ${tag} ${detail} 명령 전송(PC 버퍼)`);
    } catch (err) {
      history.recordWork(gmsState.activeUnitId, 'VALVE_WRITE', tag, detail, `FAIL: ${err.message}`);
      throw err;
    }
  }

  return {
    start, pause, stop, getStatus, getValues, getPtValues, writeValve, setActiveUnit,
    getMaintenanceMode, setMaintenanceMode, refreshPtValuesFromCalibration,
  };
}

module.exports = {
  loadGmsValves,
  saveGmsValvesToFile,
  loadGmsPts,
  loadGmsEquipment,
  saveGmsEquipmentToFile,
  loadGmsMainSequence,
  saveGmsMainSequenceToFile,
  MAIN_SEQUENCE_TYPE_DEFS,
  listGmsSubSequences,
  loadGmsSubSequence,
  saveGmsSubSequenceToFile,
  SUB_SEQ_FIXED_COLUMNS,
  SUB_SEQ_TRAILING_COLUMNS,
  SUB_SEQ_ADVANCE_ACK,
  sanitizeSheetName,
  excelColLetter,
  buildSubSequenceWorkbook,
  loadGmsSubSequenceSelection,
  saveGmsSubSequenceSelectionToFile,
  loadGmsSubSequenceConfig,
  saveGmsSubSequenceConfigToFile,
  loadGmsPtCalibration,
  saveGmsPtCalibrationToFile,
  computeCalibratedCurrentValue,
  loadGmsAnalogEnableConfig,
  saveGmsAnalogEnableConfigToFile,
  loadGmsUsers,
  saveGmsUsersToFile,
  loadGmsWorkLogMessages,
  saveGmsWorkLogMessagesToFile,
  loadGmsScreenTitles,
  saveGmsScreenTitlesToFile,
  createGmsManager,
};
