const bcrypt = require('bcrypt');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'app.db');
const db = new DatabaseSync(dbPath);

const hash = bcrypt.hashSync('admin1234!', 10);
db.prepare('UPDATE users SET password_hash = ? WHERE login_id = ?').run(hash, 'admin');

console.log('admin password reset to admin1234! successfully!');
