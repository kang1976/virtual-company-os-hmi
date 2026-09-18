'use strict';
// Design Ref: docs/02-design/design.md §4 — 위험 Command 2단계 확인 흐름
// Plan SC: plan.md F4 — 위험 태그는 2단계 확인 필수, OPERATOR는 화이트리스트만

const crypto = require('crypto');
const db = require('./db');
const auditLog = require('./auditLog');
const { AREA_CODES } = require('./plcClient/tcpFinsClient');

const CONFIRM_TTL_MS = 30 * 1000;

const getTagStmt = db.prepare('SELECT * FROM tags WHERE tag_id = ?');
const isWhitelistedStmt = db.prepare('SELECT 1 FROM operator_whitelist WHERE tag_id = ?');
const insertCommandStmt = db.prepare(`
  INSERT INTO commands (command_id, tag_id, user_id, value, requires_confirmation, confirm_token, confirm_expires_at, result)
  VALUES (@commandId, @tagId, @userId, @value, @requiresConfirmation, @confirmToken, @confirmExpiresAt, @result)
`);
const getCommandStmt = db.prepare('SELECT * FROM commands WHERE command_id = ?');
const updateCommandResultStmt = db.prepare(
  'UPDATE commands SET result = ?, confirmed_at = ? WHERE command_id = ?'
);

/** ADMIN=전체, OPERATOR=화이트리스트만, VIEWER=쓰기불가. 반환: {allowed, reason} */
function checkWritePermission(tag, user) {
  if (tag.access !== 'write' && tag.access !== 'read_write') {
    return { allowed: false, reason: '읽기 전용 태그입니다.' };
  }
  if (user.role === 'ADMIN') return { allowed: true };
  if (user.role === 'OPERATOR') {
    if (tag.risk_level === 'danger') return { allowed: false, reason: 'danger 등급은 OPERATOR가 접근할 수 없습니다.' };
    if (!isWhitelistedStmt.get(tag.tag_id)) return { allowed: false, reason: '화이트리스트에 없는 태그입니다.' };
    return { allowed: true };
  }
  return { allowed: false, reason: 'VIEWER는 쓰기 권한이 없습니다.' };
}

/**
 * 1단계: Command 요청. risk_level='safe'면 즉시 실행 대상으로 표시,
 * 그 외(caution/danger, schema.md §2-1 기본값)는 confirmToken 발급 후 대기.
 */
function requestCommand({ tag, user, value }) {
  const permission = checkWritePermission(tag, user);
  if (!permission.allowed) {
    auditLog.record({
      userId: user.userId,
      actionType: 'permission_denied',
      target: tag.tag_id,
      afterValue: value,
      result: 'rejected',
    });
    return { status: 403, body: { error: permission.reason } };
  }

  const commandId = 'cmd_' + crypto.randomUUID();
  const requiresConfirmation = tag.risk_level !== 'safe';

  if (!requiresConfirmation) {
    insertCommandStmt.run({
      commandId,
      tagId: tag.tag_id,
      userId: user.userId,
      value: String(value),
      requiresConfirmation: 0,
      confirmToken: null,
      confirmExpiresAt: null,
      result: 'pending',
    });
    return { status: 200, body: { commandId, requiresConfirmation: false } };
  }

  const confirmToken = crypto.randomUUID();
  const confirmExpiresAt = new Date(Date.now() + CONFIRM_TTL_MS).toISOString();
  insertCommandStmt.run({
    commandId,
    tagId: tag.tag_id,
    userId: user.userId,
    value: String(value),
    requiresConfirmation: 1,
    confirmToken,
    confirmExpiresAt,
    result: 'pending',
  });
  auditLog.record({
    userId: user.userId,
    actionType: 'command_request',
    target: tag.tag_id,
    afterValue: value,
    result: 'pending',
  });
  return {
    status: 409,
    body: { commandId, requiresConfirmation: true, confirmToken, expiresInSec: CONFIRM_TTL_MS / 1000 },
  };
}

/** 2단계: confirmToken 검증 후 실제 PLC 쓰기 실행 */
async function confirmCommand({ commandId, confirmToken, user, plcClient }) {
  const command = getCommandStmt.get(commandId);
  if (!command) return { status: 404, body: { error: '요청을 찾을 수 없습니다.' } };
  if (command.user_id !== user.userId) return { status: 403, body: { error: '본인 요청만 확인할 수 있습니다.' } };
  if (command.result !== 'pending') return { status: 409, body: { error: '이미 처리된 요청입니다.', result: command.result } };
  if (command.confirm_token !== confirmToken) return { status: 400, body: { error: '확인 토큰이 일치하지 않습니다.' } };
  if (new Date(command.confirm_expires_at).getTime() < Date.now()) {
    updateCommandResultStmt.run('expired', new Date().toISOString(), commandId);
    return { status: 410, body: { error: '확인 시간이 만료되었습니다. 다시 요청해 주세요.' } };
  }

  const tag = getTagStmt.get(command.tag_id);
  // 재확인: 확인 대기 중 권한이 바뀌었을 수 있으므로 다시 검사
  const permission = checkWritePermission(tag, user);
  if (!permission.allowed) {
    updateCommandResultStmt.run('rejected', new Date().toISOString(), commandId);
    auditLog.record({ userId: user.userId, actionType: 'command_reject', target: tag.tag_id, result: 'rejected' });
    return { status: 403, body: { error: permission.reason } };
  }

  try {
    await writeTagValue(tag, command.value, plcClient);
    updateCommandResultStmt.run('success', new Date().toISOString(), commandId);
    auditLog.record({
      userId: user.userId,
      actionType: 'command_confirm',
      target: tag.tag_id,
      afterValue: command.value,
      result: 'success',
    });
    return { status: 200, body: { commandId, result: 'success' } };
  } catch (err) {
    updateCommandResultStmt.run('failed', new Date().toISOString(), commandId);
    auditLog.record({
      userId: user.userId,
      actionType: 'command_confirm',
      target: tag.tag_id,
      afterValue: command.value,
      result: 'failed',
    });
    return { status: 502, body: { error: 'PLC 쓰기 실패: ' + err.message } };
  }
}

/** 실제 PLC 쓰기. address/area_type 매핑표가 아직 없으면 명확한 에러를 던짐(schema.md 미확정 항목 1) */
async function writeTagValue(tag, value, plcClient) {
  if (!tag.address || !tag.area_type) {
    throw new Error(`태그 "${tag.symbol}"는 아직 실제 PLC 주소가 배정되지 않았습니다(매핑표 대기 중).`);
  }
  const areaCode = tag.bit_index != null ? AREA_CODES[tag.area_type] - 0x80 : AREA_CODES[tag.area_type];
  const addr = Number(tag.address);
  if (tag.bit_index != null) {
    await plcClient.writeBit(areaCode, addr, tag.bit_index, Number(value) ? 1 : 0);
  } else {
    await plcClient.writeWord(areaCode, addr, Number(value));
  }
}

module.exports = { requestCommand, confirmCommand, checkWritePermission };
