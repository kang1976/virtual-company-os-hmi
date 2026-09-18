const bcrypt = require('bcrypt');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'app.db');
const db = new DatabaseSync(dbPath);

// admin 사용자 생성 또는 갱신
const password = 'admin';
const hash = bcrypt.hashSync(password, 10);

console.log('Testing bcrypt.compareSync("admin", hash) ->', bcrypt.compareSync('admin', hash));

// DB 업데이트
db.prepare('DELETE FROM users WHERE login_id = ?').run('admin');
db.prepare('INSERT INTO users (user_id, login_id, name, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)')
  .run('user_admin_root', 'admin', '관리자', hash, 'ADMIN', 'active');

console.log('Admin account created with login_id="admin" and password="admin"');
