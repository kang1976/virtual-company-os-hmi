const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-087] A/B 가스공급준비(READY) 시 FPV 하단(밑)까지만 적색 착색 제한 및 Service 시 통과 연결 (2026-08-23)

**질문/요청 내용:**
- B side를 포함하여 가스공급준비(READY) 단계에서는 FPV 위로 가스가 넘어가지 않고 **FPV 밑까지만 Lamp/배관이 적색으로 착색**되도록 정리 (A Side, B Side 동일 적용)

**조치 내역 (\`public/Operation.js\`):**
- \`unit1.json\`의 FPV 실제 Y좌표(\`FPV_A: y=256\`, \`FPV_B: y=253\`)를 바탕으로,
  1. **가스공급준비(READY / Step 7)** 단계(\`Stage 4\`):
     - A측: \`LPI_A\` 통과 ➔ **\`FPV_A\` 하단 플랜지(\`y=271\`)까지만** 착색 멈춤
     - B측: \`LPI_B\` 통과 ➔ **\`FPV_B\` 하단 플랜지(\`y=268\`)까지만** 착색 멈춤
  2. **가스공급(Service / 가스공급 중)** 단계(\`Stage 5\`):
     - A측: \`FPV_A\` 하단(\`y=271\`)에서부터 \`FPV_A\`를 통과하여 상단 프로세스 라인으로 연결
     - B측: \`FPV_B\` 하단(\`y=268\`)에서부터 \`FPV_B\`를 통과하여 상단 우회 프로세스 라인으로 연결
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-087 appended to QNA.md');
