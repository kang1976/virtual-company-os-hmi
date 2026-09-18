const bcrypt = require('bcrypt');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'app.db');
const db = new DatabaseSync(dbPath);

function setOrAddUser(loginId, password, name, role) {
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('DELETE FROM users WHERE login_id = ?').run(loginId);
  db.prepare('INSERT INTO users (user_id, login_id, name, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)')
    .run('user_' + loginId, loginId, name, hash, role, 'active');
  console.log(`User [${loginId}] set with password [${password}]`);
}

// 1. admin / admin
setOrAddUser('admin', 'admin', '관리자', 'ADMIN');

// 2. admin / admin1234! 는 별칭으로 admin1234 계정 추가
setOrAddUser('admin1234', 'admin1234!', '관리자(보조)', 'ADMIN');

// 3. test1234 / test1234
setOrAddUser('test1234', 'test1234', '테스트유저', 'ADMIN');

console.log('All login accounts updated successfully!');
