'use strict';
// 사용자 생성 CLI (회원가입 API를 따로 만들지 않음 — 제어 시스템이라 관리자만 계정을 만들 수 있어야 함)
// 사용법: node scripts/createUser.js <loginId> <password> <name> <ADMIN|OPERATOR|VIEWER>

const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require(path.join(__dirname, '..', 'src', 'db'));

const [, , loginId, password, name, role] = process.argv;

if (!loginId || !password || !name || !role) {
  console.error('사용법: node scripts/createUser.js <loginId> <password> <name> <ADMIN|OPERATOR|VIEWER>');
  process.exit(1);
}
if (!['ADMIN', 'OPERATOR', 'VIEWER'].includes(role)) {
  console.error('role은 ADMIN, OPERATOR, VIEWER 중 하나여야 합니다.');
  process.exit(1);
}

(async () => {
  const passwordHash = await bcrypt.hash(password, 12);
  const userId = 'user_' + crypto.randomUUID().slice(0, 8);

  db.prepare(
    'INSERT INTO users (user_id, login_id, name, password_hash, role) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, loginId, name, passwordHash, role);

  console.log(`생성됨: ${loginId} (${name}, ${role})`);
})();
