const fs = require('fs');
const path = require('path');

// 1. gmsSubSequenceConfig.json 읽기
const configPath = path.join(__dirname, '../data/gmsSubSequenceConfig.json');
const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const configRows = configData.rows || [];

console.log(`총 등록된 설정값 수: ${configRows.length}`);

// 2. 16개 서브시퀀스 파일에서 사용되는 conditionValue 수집
const subSeqDir = path.join(__dirname, '../data/gmsSubSequences');
const subSeqFiles = fs.readdirSync(subSeqDir).filter(f => f.endsWith('.json'));

const referencedConditionValues = new Set();
const conditionValueSources = {};

subSeqFiles.forEach(file => {
  const content = JSON.parse(fs.readFileSync(path.join(subSeqDir, file), 'utf8'));
  const steps = content.steps || [];
  steps.forEach(step => {
    if (step.conditionValue) {
      // & 로 나뉜 다중 조건 분리
      const parts = String(step.conditionValue).split('&').map(s => s.trim()).filter(Boolean);
      parts.forEach(p => {
        referencedConditionValues.add(p);
        if (!conditionValueSources[p]) conditionValueSources[p] = [];
        conditionValueSources[p].push(`${file} (Step ${step.no})`);
      });
    }
  });
});

console.log(`\n서브시퀀스에서 참조 중인 고유 conditionValue 목록:`);
referencedConditionValues.forEach(val => {
  console.log(`- "${val}" -> 사용처: ${conditionValueSources[val].slice(0, 3).join(', ')}${conditionValueSources[val].length > 3 ? ' 외' : ''}`);
});

// 3. 각 conditionValue가 configRows와 어떻게 매칭되는지 분석 ({side} 치환 포함 A/B)
const usedConfigIdsOrNames = new Set();

referencedConditionValues.forEach(ref => {
  if (ref === '-' || ref === '' || !isNaN(Number(ref))) return; // 숫자 리터럴이나 빈 값은 제외
  
  // 템플릿 {side} 치환: A, B
  const possibleRefs = [ref];
  if (ref.includes('{side}')) {
    possibleRefs.push(ref.replace('{side}', 'A'));
    possibleRefs.push(ref.replace('{side}', 'B'));
  }
  
  possibleRefs.forEach(target => {
    configRows.forEach(row => {
      if (row.id === target || row.name === target) {
        usedConfigIdsOrNames.add(row.id || row.name);
      }
    });
  });
});

console.log(`\n========================================`);
console.log(`실제 서브시퀀스에서 사용 중인 설정값 (${usedConfigIdsOrNames.size}개):`);
configRows.filter(r => usedConfigIdsOrNames.has(r.id) || usedConfigIdsOrNames.has(r.name)).forEach(r => {
  console.log(`  [사용중] name: "${r.name}", id: "${r.id}", value: ${r.value}, unit: "${r.unit}"`);
});

console.log(`\n========================================`);
console.log(`미사용 설정값 (${configRows.length - usedConfigIdsOrNames.size}개):`);
configRows.filter(r => !usedConfigIdsOrNames.has(r.id) && !usedConfigIdsOrNames.has(r.name)).forEach(r => {
  console.log(`  [미사용] name: "${r.name}", id: "${r.id}", value: ${r.value}`);
});
