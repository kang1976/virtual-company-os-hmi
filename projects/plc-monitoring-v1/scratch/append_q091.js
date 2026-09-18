const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-091] 가스 흐름(적색) 레이어 부품 하위 배치 및 PGI/PGII 하단 라인 제거 (2026-08-24)

**질문/요청 내용:**
1. 적색 Lamp(가스 흐름선)가 밸브, 레귤레이터, 필터 등 도면 파트 기호 위에 겹쳐서 기호를 덮는 현상 수정 ➔ **적색선을 배관 파트들 밑(하위 레이어)으로 배치**
2. **PGII_B/A 밑부분까지 내려와 있던 적색선 삭제**
3. 실린더에서 나온 가스가 밸브를 열 때 실제로 도달하는 배관 영역만 1:1로 정확히 표시

**원인 분석:**
1. SVG 상에서 \`<g id="gasFlowLayer"></g>\`가 정적 필터(\`LF1\`, \`LF2\`), 레귤레이터(\`REG1\`, \`REG2\`), 체크밸브보다 뒤(상위 레이어)에 위치하여 파트 기호들을 덮고 지나갔음.
2. Step 4 진입 시 \`M 367 646.1 L 367 749\` 및 \`M 700.3 646.1 L 700.3 749\`로 설정되어 있어, 닫혀 있는 \`PGI\` 밸브를 통과해 맨 밑바닥 \`NPT\` 및 \`PGII\` 아래 라인까지 불필요하게 착색되었음.

**조치 내역 (\`public/gms-diagram.svg\`, \`public/Operation.js\`):**
1. **레이어 순서 변경 (\`gms-diagram.svg\`):**
   - \`<g id="gasFlowLayer"></g>\`를 SVG \`<defs>\` 직후(기본 배관선 직후)로 이동.
   - 모든 밸브(\`valveLayer\`), 센서 박스(\`ptLayer\`), 레귤레이터, 필터(\`LF1\`, \`LF2\`), 체크밸브, 텍스트 라벨들이 적색 가스선 위에 렌더링되도록 처리.
2. **PGI/PGII 하단 라인 완전 삭제 (\`Operation.js\`):**
   - 실린더 가스가 \`V/S\`를 거쳐 주배관(\`y=646.1\`)으로 유입될 때, 하단으로는 **\`PGI\` 밸브 상단 입구(\`PGI_A: y=698\`, \`PGI_B: y=694\`)까지만** 가스가 닿도록 제한하고 \`PGI\` 아래 및 \`PGII\` 하단 라인은 완전 삭제.
3. **가스 유입 도달 경계 정밀 동기화:**
   - \`HPV\`/\`LPV\` 분기는 해당 밸브 앞단까지만 착색
   - 가스공급준비(READY) 시에는 \`FPV\` 하단 입구까지만 착색
   - 가스공급(Service) 시에만 \`FPV\`를 통과하여 \`LF2\` ➔ \`PROCESS\` 라인으로 연결
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-091 appended to QNA.md');
