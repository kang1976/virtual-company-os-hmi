const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-065] GSP 1단계 아날로그 패널 하단(버튼 위) 정렬 및 MPT / Weight 옵션별 표시/자동 간격 축소 구현 (2026-08-23)

**질문/요청 내용:**
- "아날로그 값 나타나는 부분은 아래 버튼 위에부터 정렬"
- "MPT / WEIGHT는 옵션 처리해서 보이기/감추기, 만일 없으면 빈자리를 땡겨서 붙여서 자동 간격 조정"

**조치 내역 (\`public/OPERATION HTML/가스공급_압력확인.html\`, \`public/Operation.js\`):**
1. **아날로그 계측값 패널 하단(버튼 바로 위) 정렬:**
   - \`.gsp-readout-panel\`에 \`margin-top: auto; margin-bottom: 12px;\` 적용하여, 상단 설명문과 분리되어 하단 4개 버튼 바로 위에 밀착 정렬되도록 배치
2. **MPT / Weight(W/I) 옵션 연동 및 빈자리 자동 축소 (Auto-collapse):**
   - \`isAnalogTagEnabled('MPT_' + side)\` 및 \`isAnalogTagEnabled('Weight_' + side)\` 함수를 통해 OPTION 탭의 활성 여부 확인
   - 미적용(비활성) 시 해당 행을 \`display: none\` 처리하며, Flexbox (\`gap: 8px\`)에 의해 빈 공간 없이 나머지 행들(\`HPT\`, \`LPT\`, \`NPT\`)이 자동으로 착 당겨져서 붙는 유연한 레이아웃 완성
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-065 appended to QNA.md');
