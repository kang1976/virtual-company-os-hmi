const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-082] 가스공급 중(Service) 화면 진입 시 가스공급 밸브(V/S, HPI, LPI, FPV) 일괄 OPEN 및 배관 착색 유지 (2026-08-23)

**질문/요청 내용:**
- 가스공급 준비 완료 후 서비스(가스공급 중) 화면으로 이동했을 때, 가스공급에 필수적인 밸브들(\`V/S\`, \`HPI\`, \`LPI\`, \`FPV\`)이 모두 열린(OPEN) 상태로 유지되어야 함.

**조치 내역 (\`public/Operation.js\`):**
- \`showProgressGasSupplyActive(side)\` 함수에서 서비스(가스공급 중) 화면으로 진입할 때 해당 측의 공급 라인 밸브들(\`V/S_{side}\`, \`HPI_{side}\`, \`LPI_{side}\`, \`FPV_{side}\`) 전체에 대해 확실하게 \`value: true\` (OPEN) 쓰기 명령을 전송하도록 보강.
- 가스 유입 배관 적색 착색(\`Stage 4\`) 및 화면 타이틀(\`[A/B] 가스공급 진행\`)을 동기화 완료.
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-082 appended to QNA.md');
