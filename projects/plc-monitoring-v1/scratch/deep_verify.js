const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const srcDir = 'c:\\Users\\rokaf\\OneDrive\\바탕 화면\\PLC monitoring_01\\plc-monitoring ver1.0 - google';
const dstDir = 'D:\\02. AI 작업\\PLC monitoring_01\\plc-monitoring ver1.0 - google';

function getAllFiles(dir, base = '') {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const dirent of list) {
    const relPath = base ? path.join(base, dirent.name) : dirent.name;
    const fullPath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      results.push({ relPath, isDir: true });
      results = results.concat(getAllFiles(fullPath, relPath));
    } else {
      const stats = fs.statSync(fullPath);
      results.push({ relPath, isDir: false, size: stats.size });
    }
  }
  return results;
}

console.log('1. 전체 파일 스캔 중 (node_modules 포함)...');
const srcAll = getAllFiles(srcDir);
const dstAll = getAllFiles(dstDir);

console.log(`C 드라이브 총 항목 수: ${srcAll.length} (파일: ${srcAll.filter(x => !x.isDir).length}, 폴더: ${srcAll.filter(x => x.isDir).length})`);
console.log(`D 드라이브 총 항목 수: ${dstAll.length} (파일: ${dstAll.filter(x => !x.isDir).length}, 폴더: ${dstAll.filter(x => x.isDir).length})`);

const dstMap = new Map(dstAll.map(x => [x.relPath, x]));
let missingInDst = [];
let sizeMismatch = [];

for (const f of srcAll) {
  // 임시 scratch 파일 제외
  if (f.relPath.startsWith('scratch')) continue;
  const dstItem = dstMap.get(f.relPath);
  if (!dstItem) {
    missingInDst.push(f.relPath);
  } else if (!f.isDir && f.size !== dstItem.size) {
    sizeMismatch.push({ file: f.relPath, srcSize: f.size, dstSize: dstItem.size });
  }
}

console.log('2. 누락된 파일 수 (scratch 제외):', missingInDst.length);
if (missingInDst.length > 0) console.log('누락 목록:', missingInDst.slice(0, 10));
console.log('3. 크기 불일치 파일 수:', sizeMismatch.length);
if (sizeMismatch.length > 0) console.log('불일치 목록:', sizeMismatch.slice(0, 10));

// .git 존재 여부
console.log('4. D 드라이브 .git 존재 여부:', fs.existsSync(path.join(dstDir, '.git')));

// D 드라이브의 실제 디스크 사용량
let totalDstBytes = dstAll.filter(x => !x.isDir).reduce((acc, x) => acc + x.size, 0);
console.log(`5. D 드라이브 총 데이터 크기: ${(totalDstBytes / (1024 * 1024)).toFixed(2)} MB`);
