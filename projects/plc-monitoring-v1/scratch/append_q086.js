const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-086] 배관 가스 흐름(적색) 오버레이가 검정색 원본 배관을 벗어나는 현상 수정 (2026-08-23)

**질문/요청 내용:**
- 적색 가스 흐름선이 검정색 배관 바깥으로 삐져나오거나 분기점/상단 라인을 벗어난 원인 파악 및 조치

**원인 분석:**
1. **두께 불일치:** 원본 검정색 배관의 \`stroke-width\`는 \`4.5px\`인데, 적색 오버레이 레이어가 \`5.5px\`로 1px 더 두껍게 렌더링되어 양쪽으로 삐져나왔음.
2. **좌표 불일치:**
   - 상단 FPV_A 수직선이 분기 교차점(\`y=144\`)을 넘어 \`y=85\`까지 불필요하게 위로 뻗어 나갔음.
   - 하단 NPT/PGI 수직선이 배관 끝점(\`y=749\`)을 넘어 \`y=770\`까지 내려가 NPT 박스를 침범했음.
   - V/S 실린더 상단 및 LPV/HPV 분기선의 소수점 좌표가 원본 SVG와 미세한 차이가 있었음.

**조치 내역 (\`public/Operation.js\`):**
1. **선 두께 1:1 일치:** 적색 오버레이 선 두께를 원본과 동일한 \`stroke-width: 4.5px\`로 일치.
2. **좌표 1:1 정밀 보정:** 원본 \`gms-diagram.svg\`의 벡터 패스 좌표(\`M 254.9 656.4...\`, \`M 367 749...\`, \`M 367 144 L 700.3 144\`, \`M 700.3 144 L 700.3 58.2\` 등)와 소수점 단위까지 100% 일치시켜 검정색 배관 라인 내부에 완벽하게 피팅 완료.
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-086 appended to QNA.md');
