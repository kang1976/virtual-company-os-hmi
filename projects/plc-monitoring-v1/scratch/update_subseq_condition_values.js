const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../data/gmsSubSequences');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

const commonNames = [
  'Puls vent 설정횟수',
  'Pulse Vent Stop (psi)',
  '교환전 2차측 퍼지 횟수',
  'PUMPING 시간[분]',
  '교환전 1차 퍼지진행 횟수',
  '교환전 2차 퍼지진행 횟수',
  '감압 안정화 시간[분]',
  '감압 시간[분]',
  'Bypass 진공유지 확인시간[분]'
];

let updatedFilesCount = 0;

files.forEach(f => {
  const filePath = path.join(dir, f);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let modified = false;

  (content.steps || []).forEach(s => {
    if (s.conditionValue) {
      commonNames.forEach(cn => {
        // 단독으로 쓰이거나 & 로 나뉘어 쓰인 경우 cn_{side}로 치환 (이미 _{side}가 붙은 경우는 제외)
        if (s.conditionValue === cn) {
          s.conditionValue = `${cn}_{side}`;
          modified = true;
        } else if (s.conditionValue.includes(cn) && !s.conditionValue.includes(`${cn}_{side}`) && !s.conditionValue.includes(`${cn}_A`) && !s.conditionValue.includes(`${cn}_B`)) {
          s.conditionValue = s.conditionValue.replace(new RegExp(cn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `${cn}_{side}`);
          modified = true;
        }
      });
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
    updatedFilesCount++;
    console.log(`Updated: ${f}`);
  }
});

console.log(`총 ${updatedFilesCount}개 서브시퀀스 파일 conditionValue _{side} 템플릿 표준화 완료!`);
