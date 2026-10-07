const fs = require('fs');
const path = require('path');

// src 디렉토리 내의 모든 .js 파일을 읽어 require 문을 정적 분석합니다.
const srcDir = path.join(__dirname, '../src');
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js'));

const dependencyGraph = {};

files.forEach(file => {
  const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
  const requires = [];
  
  // require regex
  const regex = /require\(['"]([^'"]+)['"]\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    requires.push(match[1]);
  }
  
  dependencyGraph[file] = requires;
});

console.log(JSON.stringify(dependencyGraph, null, 2));
