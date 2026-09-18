'use strict';
// 사용법: node scripts/importTags.js <태그목록.json>
// JSON 형식: [{ "symbol": "...", "name": "...", "access": "read|write|read_write", ... }, ...]

const path = require('path');
const fs = require('fs');
const { importTags } = require(path.join(__dirname, '..', 'src', 'tagImport'));

const [, , filePath] = process.argv;
if (!filePath) {
  console.error('사용법: node scripts/importTags.js <태그목록.json>');
  process.exit(1);
}

const records = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const result = importTags(records);
console.log(`가져오기 완료: 신규 ${result.inserted}건, 갱신 ${result.updated}건, 건너뜀 ${result.skipped}건`);
