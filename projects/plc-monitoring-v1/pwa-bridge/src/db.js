'use strict';
// Design Ref: docs/02-design/design.md §2, §5 — SQLite(Node 내장 node:sqlite)로 User/Tag/Command/AuditLog 관리
// better-sqlite3(네이티브 addon)는 이 Node 버전에서 소켓 I/O와 결합 시 크래시가 발생해
// Node 내장 node:sqlite로 교체함 (별도 컴파일/의존성도 필요 없어져 무료 원칙에도 더 부합)

const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.join(__dirname, '..', 'data', 'app.db');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  user_id     TEXT PRIMARY KEY,
  login_id    TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role        TEXT NOT NULL CHECK(role IN ('ADMIN','OPERATOR','VIEWER')),
  status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Design Ref: schema.md §2 — 태그는 symbol 기준으로 우선 등록, address는 매핑표 도착 전까지 NULL
CREATE TABLE IF NOT EXISTS tags (
  tag_id      TEXT PRIMARY KEY,
  symbol      TEXT NOT NULL,
  name        TEXT,
  address     TEXT,
  bit_index   INTEGER,
  area_type   TEXT,
  data_type   TEXT,
  access      TEXT NOT NULL CHECK(access IN ('read','write','read_write')),
  description TEXT,
  -- Design Ref: schema.md §2-1 — 쓰기 태그 기본값은 항상 'caution'(2단계 확인 필수)
  risk_level  TEXT NOT NULL DEFAULT 'caution' CHECK(risk_level IN ('safe','caution','danger')),
  source      TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('import','manual')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_symbol ON tags(symbol);

-- OPERATOR가 쓰기 가능한 태그 화이트리스트 (schema.md §5 미확정 항목 4 — 값은 비어있는 채로 시작)
CREATE TABLE IF NOT EXISTS operator_whitelist (
  tag_id TEXT PRIMARY KEY REFERENCES tags(tag_id)
);

-- Design Ref: design.md §4 — 위험 Command 2단계 확인 흐름
CREATE TABLE IF NOT EXISTS commands (
  command_id   TEXT PRIMARY KEY,
  tag_id       TEXT NOT NULL REFERENCES tags(tag_id),
  user_id      TEXT NOT NULL REFERENCES users(user_id),
  value        TEXT NOT NULL,
  requires_confirmation INTEGER NOT NULL DEFAULT 0,
  confirm_token TEXT,
  confirm_expires_at TEXT,
  confirmed_at TEXT,
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  result       TEXT NOT NULL DEFAULT 'pending' CHECK(result IN ('pending','success','failed','rejected','expired'))
);

-- Design Ref: design.md §5 — 삭제 API 없음(조회만), 위변조/삭제 방지
CREATE TABLE IF NOT EXISTS audit_log (
  log_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT,
  action_type TEXT NOT NULL CHECK(action_type IN ('login','logout','login_failed','command_request','command_confirm','command_reject','permission_denied')),
  target      TEXT,
  before_value TEXT,
  after_value  TEXT,
  result      TEXT NOT NULL,
  timestamp   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Design Ref: design.md §9 — 트렌드 로깅. 태그 테이블과 독립: 주소(영역/워드/타입/비트)를 직접 지정.
-- 서버가 1초마다 enabled 시리즈를 읽어 trend_sample에 적재, 72시간 넘은 샘플은 주기적으로 삭제.
CREATE TABLE IF NOT EXISTS trend_series (
  series_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  label       TEXT NOT NULL,
  area_type   TEXT NOT NULL,
  address     TEXT NOT NULL,
  data_type   TEXT NOT NULL DEFAULT 'UINT',
  bit_index   INTEGER,
  color       TEXT,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS trend_sample (
  series_id   INTEGER NOT NULL REFERENCES trend_series(series_id) ON DELETE CASCADE,
  ts          INTEGER NOT NULL,   -- epoch millis
  value       REAL,               -- 숫자 해석값(없으면 NULL)
  raw         TEXT                 -- 원본 표시값(HEX/문자 등)
);
CREATE INDEX IF NOT EXISTS idx_trend_sample ON trend_sample(series_id, ts);
`);

module.exports = db;
