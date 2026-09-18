const Database = require('node:sqlite').DatabaseSync;
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'app.db');
const db = new Database(dbPath);

const rows = db.prepare('SELECT user_id, login_id, name, role, status FROM users').all();
console.log('=== Registered Users in PWA Bridge ===');
console.table(rows);
