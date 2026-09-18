const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const srcDir = path.resolve(__dirname, '..');
const dstDir = 'D:\\02. AI 작업\\PLC monitoring_01\\plc-monitoring ver1.0 - google';

function getFiles(dir, base = '') {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const dirent of list) {
    const relPath = base ? path.join(base, dirent.name) : dirent.name;
    const fullPath = path.join(dir, dirent.name);
    // .git, node_modules, logs, .gemini 등 비교 대상 필터링
    if (dirent.name === '.git' || dirent.name === 'node_modules' || dirent.name === 'logs' || dirent.name === '.gemini' || dirent.name === 'scratch') {
      results.push({ relPath, isDir: true, skipped: true });
      continue;
    }
    if (dirent.isDirectory()) {
      results.push({ relPath, isDir: true });
      results = results.concat(getFiles(fullPath, relPath));
    } else {
      const stats = fs.statSync(fullPath);
      results.push({ relPath, isDir: false, size: stats.size, mtime: stats.mtime });
    }
  }
  return results;
}

const srcFiles = getFiles(srcDir);
const dstFiles = getFiles(dstDir);

const dstMap = new Map(dstFiles.map(f => [f.relPath, f]));
const srcMap = new Map(srcFiles.map(f => [f.relPath, f]));

const missingInDst = [];
const sizeMismatch = [];
const extraInDst = [];

for (const src of srcFiles) {
  if (src.skipped) continue;
  const dst = dstMap.get(src.relPath);
  if (!dst) {
    missingInDst.push(src.relPath);
  } else if (!src.isDir && src.size !== dst.size) {
    sizeMismatch.push({ file: src.relPath, srcSize: src.size, dstSize: dst.size });
  }
}

for (const dst of dstFiles) {
  if (dst.skipped) continue;
  if (!srcMap.has(dst.relPath)) {
    extraInDst.push(dst.relPath);
  }
}

console.log('=== 검사 결과 ===');
console.log('새 위치(D 드라이브):', dstDir);
console.log('총 비교 파일/폴더 수 (src):', srcFiles.filter(f => !f.skipped && !f.isDir).length);
console.log('총 비교 파일/폴더 수 (dst):', dstFiles.filter(f => !f.skipped && !f.isDir).length);
console.log('누락된 파일 수:', missingInDst.length);
if (missingInDst.length > 0) {
  console.log('누락 목록:', missingInDst);
}
console.log('크기 불일치 파일 수:', sizeMismatch.length);
if (sizeMismatch.length > 0) {
  console.log('크기 불일치 목록:', sizeMismatch);
}
console.log('D 드라이브에만 있는 추가 파일 수:', extraInDst.length);
if (extraInDst.length > 0) {
  console.log('추가 파일 목록:', extraInDst);
}

// node_modules 존재 여부 확인
const dstNodeModules = fs.existsSync(path.join(dstDir, 'node_modules'));
console.log('node_modules 존재 여부:', dstNodeModules);
