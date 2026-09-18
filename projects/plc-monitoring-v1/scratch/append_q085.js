const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-085] A/B 가스공급준비 및 A/B 가스공급(Service) 4종 배관 FILL 적색 착색 완성 (2026-08-23)

**질문/요청 내용:**
- 이미지의 4가지 가스 유입 배관 FILL 상태 완벽 반영:
  1. **A 가스공급준비 (READY / Step 7)**: V/S_A ➔ HPI_A ➔ REG1/2A ➔ LPI_A ➔ \`FPV_A\` 앞단까지 적색 착색
  2. **A 가스공급 (Service)**: \`FPV_A\`를 통과하여 \`LF2\` 필터 ➔ \`FPT\` 앞단을 거쳐 최상단 \`PROCESS\` 라인까지 적색 착색
  3. **B 가스공급준비 (READY / Step 7)**: V/S_B ➔ HPI_B ➔ REG1/2B ➔ LPI_B ➔ \`FPV_B\` 앞단까지 적색 착색
  4. **B 가스공급 (Service)**: \`FPV_B\`를 통과하여 우회 라인을 타고 \`LF2\` 필터 ➔ \`FPT\` 앞단을 거쳐 최상단 \`PROCESS\` 라인까지 적색 착색

**조치 내역 (\`public/Operation.js\`):**
- \`GSP_PIPE_SEGMENTS\`에 Stage 4(가스공급준비: FPV 앞단)와 Stage 5(가스공급: FPV 통과 후 LF2~PROCESS 최상단 라인) 좌표를 A측/B측 각각 정확히 분리 정의.
- \`showProgressGasSupplyStep(gasSupplyReady)\` 시 Stage 4 착색, \`showProgressGasSupplyActive(side)\` 진입 시 Stage 5 착색을 자동 호출하도록 연동 완료.
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-085 appended to QNA.md');
