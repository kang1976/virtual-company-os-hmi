const bcrypt = require('bcrypt');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'app.db');
const db = new DatabaseSync(dbPath);

const hash1 = bcrypt.hashSync('admin', 10);
db.prepare('UPDATE users SET password_hash = ? WHERE login_id = ?').run(hash1, 'admin');

const hash2 = bcrypt.hashSync('test1234', 10);
db.prepare('UPDATE users SET password_hash = ? WHERE login_id = ?').run(hash2, 'test1234');

console.log('admin / admin UPDATE OK');
console.log('test1234 / test1234 UPDATE OK');
