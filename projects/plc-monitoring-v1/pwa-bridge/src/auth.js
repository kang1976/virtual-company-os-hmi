'use strict';
// Design Ref: docs/02-design/design.md §3 — 세션 기반 인증 + 3단계 RBAC(ADMIN/OPERATOR/VIEWER)

const express = require('express');
const bcrypt = require('bcrypt');
const db = require('./db');
const auditLog = require('./auditLog');

const router = express.Router();

const findUserStmt = db.prepare('SELECT * FROM users WHERE login_id = ? AND status = \'active\'');

router.post('/login', async (req, res) => {
  const { loginId, password } = req.body || {};
  if (!loginId || !password) {
    return res.status(400).json({ error: 'loginId, password는 필수입니다.' });
  }

  const user = findUserStmt.get(loginId);
  const passwordOk = user ? await bcrypt.compare(password, user.password_hash) : false;

  if (!user || !passwordOk) {
    auditLog.record({ userId: user ? user.user_id : null, actionType: 'login_failed', target: loginId, result: 'failed' });
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  }

  req.session.user = { userId: user.user_id, loginId: user.login_id, name: user.name, role: user.role };
  auditLog.record({ userId: user.user_id, actionType: 'login', result: 'success' });
  res.json({ user: req.session.user });
});

router.post('/logout', (req, res) => {
  const user = req.session.user;
  req.session.destroy(() => {
    if (user) auditLog.record({ userId: user.userId, actionType: 'logout', result: 'success' });
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  res.json({ user: req.session.user });
});

/** 로그인된 사용자만 통과. req.session.user를 req.user로도 노출 */
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  req.user = req.session.user;
  next();
}

/** roles 배열에 포함된 role만 통과. requireAuth 이후에 사용 */
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      auditLog.record({
        userId: req.user ? req.user.userId : null,
        actionType: 'permission_denied',
        target: req.originalUrl,
        result: 'rejected',
      });
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    next();
  };
}

module.exports = { router, requireAuth, requireRole };
