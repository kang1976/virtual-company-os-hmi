const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-084] 가스공급 준비(READY) 화면 진입(정상 진행 또는 점프) 시 V/S, HPI, LPI 밸브 일괄 OPEN 및 배관 착색 연동 (2026-08-23)

**질문/요청 내용:**
- 가스공급 준비(READY) 화면으로 Status 점프 또는 Step 1~6 정상 진행을 통해 들어왔을 때, \`V/S\`, \`HPI\`, \`LPI\` 3개 밸브가 자동으로 모두 OPEN되어야 함.

**조치 내역 (\`public/Operation.js\`):**
- \`showProgressGasSupplyStep(index)\`의 \`gasSupplyReady\` 진입 분기에서 해당 측의 공급 밸브 3종(\`V/S_{side}\`, \`HPI_{side}\`, \`LPI_{side}\`)에 대해 \`writeValveDirect\`로 \`value: true\` (OPEN) 명령을 일괄 전송하도록 구현.
- FPV 앞단까지의 가스 유입 배관 적색 착색(\`updateGspPipeColors(side, 4)\`)도 함께 동기화 완료.
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-084 appended to QNA.md');
