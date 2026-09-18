'use strict';
// Design Ref: docs/02-design/design.md §5 — 모든 로그인/Command/권한거부 이벤트를 여기서 기록

const db = require('./db');

const insertStmt = db.prepare(`
  INSERT INTO audit_log (user_id, action_type, target, before_value, after_value, result)
  VALUES (@userId, @actionType, @target, @beforeValue, @afterValue, @result)
`);

/**
 * @param {object} entry
 * @param {string|null} entry.userId
 * @param {string} entry.actionType login|logout|login_failed|command_request|command_confirm|command_reject|permission_denied
 * @param {string|null} [entry.target] 대상(tag_id 등)
 * @param {*} [entry.beforeValue]
 * @param {*} [entry.afterValue]
 * @param {string} entry.result success|failed|rejected 등
 */
function record(entry) {
  insertStmt.run({
    userId: entry.userId ?? null,
    actionType: entry.actionType,
    target: entry.target ?? null,
    beforeValue: entry.beforeValue === undefined ? null : JSON.stringify(entry.beforeValue),
    afterValue: entry.afterValue === undefined ? null : JSON.stringify(entry.afterValue),
    result: entry.result,
  });
}

function list({ limit = 100, offset = 0 } = {}) {
  return db
    .prepare('SELECT * FROM audit_log ORDER BY log_id DESC LIMIT ? OFFSET ?')
    .all(limit, offset);
}

module.exports = { record, list };
