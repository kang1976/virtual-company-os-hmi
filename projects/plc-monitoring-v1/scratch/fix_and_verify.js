const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '..');
const dstDir = 'D:\\02. AI 작업\\PLC monitoring_01\\plc-monitoring ver1.0 - google';

// 깨진 파일 복사
const brokenFile = 'public/grid/assets/ru-v4l-ayaq-DLdM0nWP.js';
const srcBroken = path.join(srcDir, brokenFile);
const dstBroken = path.join(dstDir, brokenFile);

if (fs.existsSync(srcBroken)) {
  fs.copyFileSync(srcBroken, dstBroken);
  console.log(`복사 완료: ${brokenFile} (크기: ${fs.statSync(dstBroken).size} bytes)`);
}

// 주요 핵심 파일들 해시 검증
const crypto = require('crypto');
function getHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

const keyFiles = [
  'public/gms.js',
  'public/Operation.js',
  'public/gms.css',
  'public/gms-diagram.svg',
  'docs/QNA.md',
  'data/gmsValves/unit1.json',
  'src/server.js',
  'package.json'
];

console.log('\n=== 주요 핵심 파일 무결성(SHA-256) 검증 ===');
for (const rel of keyFiles) {
  const h1 = getHash(path.join(srcDir, rel));
  const h2 = getHash(path.join(dstDir, rel));
  const match = h1 === h2;
  console.log(`${rel}: ${match ? '일치 (정상)' : '불일치!'}`);
}
