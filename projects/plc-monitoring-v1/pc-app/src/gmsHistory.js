'use strict';

/**
 * GMS 데이터 이력 저장소 (SQLite / better-sqlite3).
 *
 * 계획서(docs/GMS_DEVELOPMENT_PLAN.md 5장)의 5개 테이블을 구현한다:
 *  - alarm_history : 알람 발생/해제 (현재 소스: 밸브 cmd≠fb 불일치. IO MAP Alert 연동 시 확장)
 *  - pt_samples    : PT/무게/온도 아날로그 원본 샘플 (보존 N일)
 *  - pt_samples_1m : 1분 다운샘플(min/max/avg) - 장기 보존
 *  - work_log      : 조작 이력 (밸브 쓰기, 폴링 시작/정지, 연결/해제 등 - 무엇을/결과)
 *  - sequence_log  : Side_Step 전환 이력 (Phase 2에서 스텝 비트 연동 시 기록 시작)
 *  - live_events   : 기타 이벤트 (연결/해제, 통신 오류, 자동 재연결 등)
 *
 * better-sqlite3는 동기 API라 기존 코드 스타일(파일 동기 저장)과 맞고, WAL 모드로
 * 폴링 주기(1초)마다의 INSERT도 문제 없다. DB 파일은 data/gms-history.db 하나.
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { nowLocalIso } = require('./timeUtils');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const DB_FILE = path.join(dataDir, 'gms-history.db');

// 원본 PT 샘플 보존 기간(일). 지나면 삭제 - 1분 다운샘플(pt_samples_1m)은 계속 보존.
const RAW_RETENTION_DAYS = 7;
// 보존 정리 실행 주기(ms) - 서버가 오래 떠 있어도 하루 한 번이면 충분.
const RETENTION_INTERVAL_MS = 6 * 60 * 60 * 1000;

let db = null;
let retentionTimer = null;

function init() {
  if (db) return db;
  db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL'); // 쓰기 중에도 조회가 막히지 않도록
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS alarm_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      grade INTEGER NOT NULL DEFAULT 2,      -- 1=Shutdown급 2=경보 3=주의 (IO MAP 등급 연동 전 기본 2)
      message TEXT NOT NULL,
      raised_at TEXT NOT NULL,               -- ISO 시각
      cleared_at TEXT                        -- NULL이면 아직 활성
    );
    CREATE INDEX IF NOT EXISTS idx_alarm_unit_raised ON alarm_history(unit_id, raised_at DESC);
    CREATE INDEX IF NOT EXISTS idx_alarm_active ON alarm_history(unit_id, tag) WHERE cleared_at IS NULL;

    CREATE TABLE IF NOT EXISTS pt_samples (
      unit_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      ts INTEGER NOT NULL,                   -- epoch ms
      value REAL
    );
    CREATE INDEX IF NOT EXISTS idx_pt_tag_ts ON pt_samples(unit_id, tag, ts);

    CREATE TABLE IF NOT EXISTS pt_samples_1m (
      unit_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      minute INTEGER NOT NULL,               -- epoch ms를 60000으로 나눈 몫
      min_v REAL, max_v REAL, sum_v REAL, cnt INTEGER NOT NULL,
      PRIMARY KEY (unit_id, tag, minute)
    );

    CREATE TABLE IF NOT EXISTS work_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id TEXT,
      ts TEXT NOT NULL,
      action TEXT NOT NULL,                  -- 예: 'VALVE_WRITE', 'POLL_START', 'CONNECT'
      target TEXT,                           -- 예: 밸브 태그, 조작화면 조작은 side('A'/'B')
      detail TEXT,                           -- 예: 'OPEN', '1000ms', 조작화면 조작은 메시지 문구
      result TEXT NOT NULL DEFAULT 'OK'      -- 'OK' | 'FAIL: ...'
    );
    CREATE INDEX IF NOT EXISTS idx_work_ts ON work_log(ts DESC);

    CREATE TABLE IF NOT EXISTS sequence_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id TEXT NOT NULL,
      side TEXT NOT NULL,                    -- 'A' | 'B'
      step TEXT NOT NULL,                    -- 예: '1P', '-L', 'READY'
      entered_at TEXT NOT NULL,
      left_at TEXT                           -- 다음 스텝 진입 시 채움
    );
    CREATE INDEX IF NOT EXISTS idx_seq_unit ON sequence_log(unit_id, entered_at DESC);

    CREATE TABLE IF NOT EXISTS live_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id TEXT,
      ts TEXT NOT NULL,
      grade TEXT NOT NULL DEFAULT 'INFO',    -- 'INFO' | 'WARN' | 'ERROR'
      message TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_ts ON live_events(ts DESC);

    -- "에러 사항" 화면 전용(보조 메뉴) - 서브시퀀스(조정모드 등)가 실제 Alarm Seq. 동작
    -- (초기화/이어서재진행/SHUTDOWN)을 수행할 때만 기록한다. Alarm Goto로 밸브/상태를 안 건드리고
    -- 가볍게 다른 Step으로 이동하는 경우(반복문, Option 분기 등)는 알람이 아니므로 여기 남기지
    -- 않는다(gms-sub-sequence-runner.js의 subSeqHandleAlarm이 판단). work_log와 컬럼 구성이
    -- 거의 같지만(화면/조회 구조를 그대로 재사용하기 위해) 완전히 별개의 테이블이다(요청사항 -
    -- "DB만 별도로").
    CREATE TABLE IF NOT EXISTS error_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id TEXT,
      ts TEXT NOT NULL,
      side TEXT,                             -- 'A' | 'B'
      main_step_type TEXT,                   -- 예: 'AdjustMode'
      sub_seq_id TEXT,
      sub_seq_step_no TEXT,                  -- 알람이 발생한 Step No
      sub_seq_elapsed_sec INTEGER,           -- 알람 시점까지의 누적 경과시간(초)
      alarm_seq_code INTEGER,                -- 1=초기화 2=이어서재진행 3=SHUTDOWN
      alarm_message TEXT,                    -- 엑셀 Alarm Message 열 값
      operator_name TEXT,
      operator_role TEXT,
      analog_snapshot TEXT,                  -- 알람 시점 PT/Weight/히터 값(JSON)
      screen_key TEXT,                       -- "복귀"가 원래 화면(조정모드)으로 돌아갈 때 씀
      screen_title TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_error_log_ts ON error_log(ts DESC);
  `);

  // work_log에 조작화면 작업이력용 열 3개를 추가한다("작업이력" 화면 - 누가/무엇을 조작했는지 +
  // 그 순간 아날로그값). 기존 892건짜리 테이블에 나중에 추가된 열이라 ALTER TABLE로
  // 덧붙인다 - SQLite는 "IF NOT EXISTS" 열 문법이 없어 이미 있으면 나는 예외를 무시한다
  // (재시작마다 안전하게 반복 실행 가능).
  // screen_key/screen_title/status_label 3개는 "작업이력" 그리드 열 재구성(HTML화면/조작Key/
  // 측=Status 메시지, 그리고 행별 "복귀" 기능이 screen_key로 원래 화면을 찾아간다) 때 추가됐다.
  // op_source: "작업이력" 화면(logWorkAction)이 남긴 행인지 구분하는 표식. 예전에는
  // operator_name IS NOT NULL로 구분했는데, 세션에서 아직 PASSWORD를 한 번도 확인하지
  // 않은 상태(currentGmsOperator=null)에서 누른 버튼은 operator_name이 NULL로 기록되어
  // 조회에서 통째로 빠지는 버그가 있었다 - 이제 이 열로 명시적으로 표시한다.
  // button_label: buttonId 접미사로 추측한 한글(실행/확인/취소 등)이 아니라, 클릭 당시
  // 그 버튼에 실제로 표시돼 있던 문구 그대로("작업이력" 그리드 "조작 Key" 열에 큰따옴표로
  // 표시 - 요청사항: "정확하게 어떤 것을 눌렀는지 사람이 알 수 있도록"). 배지 클릭처럼
  // buttonId가 실제 DOM id가 아닌 경우는 null로 남고, 그리드가 메시지 설정으로 대체 표시한다.
  // sub_seq_id/sub_seq_step_no/sub_seq_elapsed_sec: 서브시퀀스(자동진행) Step 전환 이력 -
  // "터치키 조작이력"과 "자동진행 이력"을 하나의 work_log/작업이력 그리드에서 함께 보여주기로
  // 결정(별도 DB 대신 이 테이블 확장 - 이미 시간순 통합 조회/필터/엑셀 내보내기 인프라가
  // 있어서 그대로 재사용). 터치키 행은 이 3열이 전부 NULL, 자동진행 행만 채워진다 - 작업이력
  // 그리드가 이 값으로 "자동진행만 보기" 필터와 구분 표시를 한다.
  ['operator_name TEXT', 'operator_role TEXT', 'analog_snapshot TEXT', 'screen_key TEXT', 'screen_title TEXT', 'status_label TEXT', 'op_source TEXT', 'button_label TEXT', 'sub_seq_id TEXT', 'sub_seq_step_no TEXT', 'sub_seq_elapsed_sec INTEGER'].forEach((colDef) => {
    try { db.exec(`ALTER TABLE work_log ADD COLUMN ${colDef}`); } catch (e) { /* 이미 있으면 무시 */ }
  });
  // 위 버그가 고쳐지기 전에 기록된 기존 작업이력 행들을 소급 표시(op_source 열 자체가
  // 없던 시절 기록이라도 operator_name/screen_key/analog_snapshot 중 하나라도 있으면
  // logWorkAction이 남긴 행이 맞다 - recordWork()가 남기는 연결/밸브 이력은 이 열들을 쓰지 않음).
  try {
    db.exec(`UPDATE work_log SET op_source = 'ui' WHERE op_source IS NULL
      AND (operator_name IS NOT NULL OR screen_key IS NOT NULL OR analog_snapshot IS NOT NULL)`);
  } catch (e) { /* 무시 */ }

  // 준비된 문장(prepared statement) - 폴링마다 호출되므로 매번 파싱하지 않게 캐시
  stmts.insertPt = db.prepare('INSERT INTO pt_samples (unit_id, tag, ts, value) VALUES (?, ?, ?, ?)');
  stmts.upsert1m = db.prepare(`
    INSERT INTO pt_samples_1m (unit_id, tag, minute, min_v, max_v, sum_v, cnt)
    VALUES (?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(unit_id, tag, minute) DO UPDATE SET
      min_v = MIN(min_v, excluded.min_v),
      max_v = MAX(max_v, excluded.max_v),
      sum_v = sum_v + excluded.sum_v,
      cnt = cnt + 1
  `);
  stmts.findActiveAlarm = db.prepare('SELECT id FROM alarm_history WHERE unit_id = ? AND tag = ? AND cleared_at IS NULL');
  stmts.raiseAlarm = db.prepare('INSERT INTO alarm_history (unit_id, tag, grade, message, raised_at) VALUES (?, ?, ?, ?, ?)');
  stmts.clearAlarm = db.prepare('UPDATE alarm_history SET cleared_at = ? WHERE id = ?');
  stmts.insertWork = db.prepare('INSERT INTO work_log (unit_id, ts, action, target, detail, result) VALUES (?, ?, ?, ?, ?, ?)');
  stmts.insertOperatorAction = db.prepare(`
    INSERT INTO work_log (unit_id, ts, action, target, detail, result, operator_name, operator_role, analog_snapshot, screen_key, screen_title, status_label, op_source, button_label, sub_seq_id, sub_seq_step_no, sub_seq_elapsed_sec)
    VALUES (?, ?, ?, ?, ?, 'OK', ?, ?, ?, ?, ?, ?, 'ui', ?, ?, ?, ?)
  `);
  stmts.insertEvent = db.prepare('INSERT INTO live_events (unit_id, ts, grade, message) VALUES (?, ?, ?, ?)');
  stmts.insertErrorLog = db.prepare(`
    INSERT INTO error_log (unit_id, ts, side, main_step_type, sub_seq_id, sub_seq_step_no, sub_seq_elapsed_sec, alarm_seq_code, alarm_message, operator_name, operator_role, analog_snapshot, screen_key, screen_title)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmts.openSeq = db.prepare('INSERT INTO sequence_log (unit_id, side, step, entered_at) VALUES (?, ?, ?, ?)');
  stmts.closeSeq = db.prepare(`
    UPDATE sequence_log SET left_at = ? WHERE id = (
      SELECT id FROM sequence_log WHERE unit_id = ? AND side = ? AND left_at IS NULL ORDER BY id DESC LIMIT 1
    )`);

  // 보존 정리: 시작 시 1회 + 주기 실행
  runRetention();
  retentionTimer = setInterval(runRetention, RETENTION_INTERVAL_MS);
  if (retentionTimer.unref) retentionTimer.unref(); // 이 타이머 때문에 프로세스가 안 죽는 일이 없도록

  return db;
}

const stmts = {};

function runRetention() {
  if (!db) return;
  try {
    const cutoff = Date.now() - RAW_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    db.prepare('DELETE FROM pt_samples WHERE ts < ?').run(cutoff);
  } catch (e) { /* 정리 실패는 치명적이지 않음 - 다음 주기에 재시도 */ }
}

// ── 기록 API ──────────────────────────────────────────────────────────────

/** PT(아날로그) 샘플 일괄 기록 - 원본 + 1분 다운샘플 동시 갱신. ptValues: { tag: number|null } */
function recordPtSamples(unitId, ptValues) {
  if (!db || !unitId || !ptValues) return;
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const tx = db.transaction(() => {
    for (const [tag, v] of Object.entries(ptValues)) {
      if (v === null || v === undefined || Number.isNaN(v)) continue;
      stmts.insertPt.run(unitId, tag, now, v);
      stmts.upsert1m.run(unitId, tag, minute, v, v, v);
    }
  });
  try { tx(); } catch (e) { /* 이력 기록 실패가 폴링을 멈추면 안 됨 */ }
}

/**
 * 알람 on/off 에지 기록. active=true인데 활성 알람이 없으면 발생, active=false인데
 * 활성 알람이 있으면 해제. 상태가 그대로면 아무것도 안 한다(에지 검출).
 * @returns {'raised'|'cleared'|null} 실제로 상태가 바뀌었는지 (브로드캐스트 판단용)
 */
function setAlarmState(unitId, tag, active, { grade = 2, message = '' } = {}) {
  if (!db || !unitId || !tag) return null;
  try {
    const existing = stmts.findActiveAlarm.get(unitId, tag);
    if (active && !existing) {
      stmts.raiseAlarm.run(unitId, tag, grade, message || tag, nowLocalIso());
      return 'raised';
    }
    if (!active && existing) {
      stmts.clearAlarm.run(nowLocalIso(), existing.id);
      return 'cleared';
    }
  } catch (e) { /* 무시 */ }
  return null;
}

/** 조작 이력 기록. result는 'OK' 또는 'FAIL: 사유'. */
function recordWork(unitId, action, target, detail, result = 'OK') {
  if (!db) return;
  try { stmts.insertWork.run(unitId || null, nowLocalIso(), action, target || null, detail || null, result); }
  catch (e) { /* 무시 */ }
}

/**
 * 조작화면(GMS Operation.js)의 "작업이력" 기록 - recordWork와 컬럼은 같은 테이블을 쓰지만
 * 조작자/아날로그값/화면정보까지 남긴다. side는 target 열에, message는 detail 열에 들어간다
 * (기존 열 재사용 - work_log는 이미 이 두 열이 범용 문자열이라 그대로 맞는다). screenKey는
 * Operation.js의 progressScreens 키(예: 'cylReplaceCheck') - "작업이력" 그리드의 "복귀"가
 * showProgressScreen(screenKey, screenTitle)로 그 화면을 다시 보여줄 때 쓴다.
 * @param {string} unitId
 * @param {{action:string, side?:string, detail?:string, operatorName?:string,
 *          operatorRole?:string, analogSnapshot?:object, screenKey?:string,
 *          screenTitle?:string, statusLabel?:string, buttonLabel?:string,
 *          subSeqId?:string, subSeqStepNo?:string, subSeqElapsedSec?:number}} entry
 */
function recordOperatorAction(unitId, entry) {
  if (!db || !entry || !entry.action) return;
  try {
    stmts.insertOperatorAction.run(
      unitId || null,
      nowLocalIso(),
      entry.action,
      entry.side || null,
      entry.detail || null,
      entry.operatorName || null,
      entry.operatorRole || null,
      entry.analogSnapshot ? JSON.stringify(entry.analogSnapshot) : null,
      entry.screenKey || null,
      entry.screenTitle || null,
      entry.statusLabel || null,
      entry.buttonLabel || null,
      entry.subSeqId || null,
      entry.subSeqStepNo || null,
      Number.isFinite(entry.subSeqElapsedSec) ? entry.subSeqElapsedSec : null
    );
  } catch (e) { /* 이력 기록 실패가 조작 자체를 막으면 안 됨 */ }
}

/**
 * "에러 사항" 화면 전용 기록 - 서브시퀀스가 실제 Alarm Seq. 동작(초기화/이어서재진행/SHUTDOWN)을
 * 수행할 때만 호출한다(Alarm Goto로 가볍게 이동하는 반복문/분기는 여기 안 남음 - 호출부인
 * gms-sub-sequence-runner.js의 subSeqHandleAlarm이 판단해서 조건부로 호출).
 * @param {string} unitId
 * @param {{side?:string, mainStepType?:string, subSeqId?:string, subSeqStepNo?:string,
 *          subSeqElapsedSec?:number, alarmSeqCode?:number, alarmMessage?:string,
 *          operatorName?:string, operatorRole?:string, analogSnapshot?:object,
 *          screenKey?:string, screenTitle?:string}} entry
 */
function recordErrorLog(unitId, entry) {
  if (!db || !entry) return;
  try {
    stmts.insertErrorLog.run(
      unitId || null,
      nowLocalIso(),
      entry.side || null,
      entry.mainStepType || null,
      entry.subSeqId || null,
      entry.subSeqStepNo || null,
      Number.isFinite(entry.subSeqElapsedSec) ? entry.subSeqElapsedSec : null,
      Number.isFinite(entry.alarmSeqCode) ? entry.alarmSeqCode : null,
      entry.alarmMessage || null,
      entry.operatorName || null,
      entry.operatorRole || null,
      entry.analogSnapshot ? JSON.stringify(entry.analogSnapshot) : null,
      entry.screenKey || null,
      entry.screenTitle || null
    );
  } catch (e) { /* 이력 기록 실패가 알람 처리 자체를 막으면 안 됨 */ }
}

/** "에러 사항" 화면 조회. filters: { unitId, from, to, limit } */
function queryErrorLog(filters = {}) {
  if (!db) return { rows: [], total: 0 };
  const cond = [];
  const args = [];
  if (filters.unitId) { cond.push('unit_id = ?'); args.push(filters.unitId); }
  if (filters.from) { cond.push('ts >= ?'); args.push(filters.from); }
  if (filters.to) { cond.push('ts <= ?'); args.push(filters.to); }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const limit = clampLimit(filters.limit, 500, 5000);
  const total = db.prepare(`SELECT COUNT(*) AS c FROM error_log ${where}`).get(...args).c;
  const rows = db.prepare(
    `SELECT id, unit_id, ts, side, main_step_type, sub_seq_id, sub_seq_step_no, sub_seq_elapsed_sec,
            alarm_seq_code, alarm_message, operator_name, operator_role, analog_snapshot, screen_key, screen_title
     FROM error_log ${where} ORDER BY ts DESC, id DESC LIMIT ?`
  ).all(...args, limit);
  return { rows, total };
}

/** Live Events 기록. grade: 'INFO'|'WARN'|'ERROR' */
function recordEvent(unitId, grade, message) {
  if (!db) return;
  try { stmts.insertEvent.run(unitId || null, nowLocalIso(), grade || 'INFO', String(message || '')); }
  catch (e) { /* 무시 */ }
}

/** 스텝 전환 기록 - 이전 스텝을 닫고 새 스텝을 연다. (Phase 2에서 스텝 비트 연동 시 사용) */
function recordSequenceStep(unitId, side, step) {
  if (!db) return;
  const now = nowLocalIso();
  try {
    stmts.closeSeq.run(now, unitId, side);
    stmts.openSeq.run(unitId, side, step, now);
  } catch (e) { /* 무시 */ }
}

// ── 조회 API ──────────────────────────────────────────────────────────────

function clampLimit(limit, def, max) {
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), max);
}

/** 알람 이력 조회. filters: { unitId, from, to, grade, q, activeOnly, limit, offset } */
function queryAlarms(filters = {}) {
  if (!db) return { rows: [], total: 0 };
  const cond = [];
  const args = [];
  if (filters.unitId) { cond.push('unit_id = ?'); args.push(filters.unitId); }
  if (filters.from) { cond.push('raised_at >= ?'); args.push(filters.from); }
  if (filters.to) { cond.push('raised_at <= ?'); args.push(filters.to); }
  if (filters.grade) { cond.push('grade = ?'); args.push(Number(filters.grade)); }
  if (filters.q) { cond.push('(tag LIKE ? OR message LIKE ?)'); args.push(`%${filters.q}%`, `%${filters.q}%`); }
  if (filters.activeOnly) cond.push('cleared_at IS NULL');
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const limit = clampLimit(filters.limit, 100, 1000);
  const offset = Math.max(0, Number(filters.offset) || 0);
  const total = db.prepare(`SELECT COUNT(*) AS c FROM alarm_history ${where}`).get(...args).c;
  const rows = db.prepare(
    `SELECT id, unit_id, tag, grade, message, raised_at, cleared_at
     FROM alarm_history ${where} ORDER BY raised_at DESC, id DESC LIMIT ? OFFSET ?`
  ).all(...args, limit, offset);
  return { rows, total };
}

/** Live Events 조회. filters: { unitId, from, to, grade, q, limit, offset } */
function queryEvents(filters = {}) {
  if (!db) return { rows: [], total: 0 };
  const cond = [];
  const args = [];
  if (filters.unitId) { cond.push('unit_id = ?'); args.push(filters.unitId); }
  if (filters.from) { cond.push('ts >= ?'); args.push(filters.from); }
  if (filters.to) { cond.push('ts <= ?'); args.push(filters.to); }
  if (filters.grade) { cond.push('grade = ?'); args.push(filters.grade); }
  if (filters.q) { cond.push('message LIKE ?'); args.push(`%${filters.q}%`); }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const limit = clampLimit(filters.limit, 100, 1000);
  const offset = Math.max(0, Number(filters.offset) || 0);
  const total = db.prepare(`SELECT COUNT(*) AS c FROM live_events ${where}`).get(...args).c;
  const rows = db.prepare(
    `SELECT id, unit_id, ts, grade, message FROM live_events ${where} ORDER BY ts DESC, id DESC LIMIT ? OFFSET ?`
  ).all(...args, limit, offset);
  return { rows, total };
}

/** 조작 이력 조회. filters: { unitId, from, to, action, q, limit, offset } */
function queryWorkLog(filters = {}) {
  if (!db) return { rows: [], total: 0 };
  const cond = [];
  const args = [];
  if (filters.unitId) { cond.push('unit_id = ?'); args.push(filters.unitId); }
  if (filters.from) { cond.push('ts >= ?'); args.push(filters.from); }
  if (filters.to) { cond.push('ts <= ?'); args.push(filters.to); }
  if (filters.action) { cond.push('action = ?'); args.push(filters.action); }
  if (filters.q) { cond.push('(target LIKE ? OR detail LIKE ? OR result LIKE ?)'); args.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`); }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const limit = clampLimit(filters.limit, 100, 1000);
  const offset = Math.max(0, Number(filters.offset) || 0);
  const total = db.prepare(`SELECT COUNT(*) AS c FROM work_log ${where}`).get(...args).c;
  const rows = db.prepare(
    `SELECT id, unit_id, ts, action, target, detail, result, operator_name, operator_role, analog_snapshot
     FROM work_log ${where} ORDER BY ts DESC, id DESC LIMIT ? OFFSET ?`
  ).all(...args, limit, offset);
  return { rows, total };
}

/** "작업이력" 화면 전용 조회 - work_log 중 recordOperatorAction으로 기록된(operator_name이
    있는) 행만 뽑는다. side 필터를 안 주면 A/B/공통(side NULL) 전부 반환하고, 화면에서
    탭(A/B)별로 "그 side + 공통"을 걸러서 보여준다("공통인 것은 함께 표시" 요구사항 - 여기가
    아니라 클라이언트에서 거른다, PT 교정 화면의 공통 태그 표시 방식과 동일). */
function queryOperatorActions(filters = {}) {
  if (!db) return { rows: [], total: 0 };
  const cond = ["op_source = 'ui'"];
  const args = [];
  if (filters.unitId) { cond.push('unit_id = ?'); args.push(filters.unitId); }
  if (filters.from) { cond.push('ts >= ?'); args.push(filters.from); }
  if (filters.to) { cond.push('ts <= ?'); args.push(filters.to); }
  const where = `WHERE ${cond.join(' AND ')}`;
  const limit = clampLimit(filters.limit, 500, 5000);
  const total = db.prepare(`SELECT COUNT(*) AS c FROM work_log ${where}`).get(...args).c;
  const rows = db.prepare(
    `SELECT id, unit_id, ts, action, target AS side, detail AS message, operator_name, operator_role,
            analog_snapshot, screen_key, screen_title, status_label, button_label,
            sub_seq_id, sub_seq_step_no, sub_seq_elapsed_sec
     FROM work_log ${where} ORDER BY ts DESC, id DESC LIMIT ?`
  ).all(...args, limit);
  return { rows, total };
}

/**
 * PT 트렌드 조회. res='raw'면 원본(보존기간 내), 'auto'/'1m'이면 1분 다운샘플.
 * 반환: [{ ts, value }] (1m은 { ts, min, max, avg })
 */
function queryPtTrend({ unitId, tag, from, to, res = 'auto', limit = 5000 } = {}) {
  if (!db || !unitId || !tag) return [];
  const fromMs = from ? new Date(from).getTime() : Date.now() - 60 * 60 * 1000;
  const toMs = to ? new Date(to).getTime() : Date.now();
  const lim = clampLimit(limit, 5000, 50000);
  const useRaw = res === 'raw' || (res === 'auto' && toMs - fromMs <= 2 * 60 * 60 * 1000);
  if (useRaw) {
    return db.prepare(
      'SELECT ts, value FROM pt_samples WHERE unit_id = ? AND tag = ? AND ts BETWEEN ? AND ? ORDER BY ts LIMIT ?'
    ).all(unitId, tag, fromMs, toMs, lim);
  }
  return db.prepare(
    `SELECT minute * 60000 AS ts, min_v AS min, max_v AS max, sum_v / cnt AS avg
     FROM pt_samples_1m WHERE unit_id = ? AND tag = ? AND minute BETWEEN ? AND ? ORDER BY minute LIMIT ?`
  ).all(unitId, tag, Math.floor(fromMs / 60000), Math.floor(toMs / 60000), lim);
}

function close() {
  if (retentionTimer) { clearInterval(retentionTimer); retentionTimer = null; }
  if (db) { try { db.close(); } catch (e) { /* 무시 */ } db = null; }
}

module.exports = {
  init,
  close,
  recordPtSamples,
  setAlarmState,
  recordWork,
  recordOperatorAction,
  recordErrorLog,
  recordEvent,
  recordSequenceStep,
  queryAlarms,
  queryEvents,
  queryWorkLog,
  queryOperatorActions,
  queryErrorLog,
  queryPtTrend,
};
