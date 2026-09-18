const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-093] 밸브 기호 불투명화 및 배관 상위 선명 노출 조치 (2026-08-24)

**질문/요청 내용:**
- F5 새로고침 시 밸브들이 검정색 배관 밑으로 들어가 가려져 보이는 현상 개선

**원인 분석:**
- \`gms.css\`에서 초기/닫힘 상태의 밸브 스타일(\`.gms-valve.state-unknown .body\`)에 \`opacity: 0.5\`(반투명)가 설정되어 있어서, 밸브 뒤를 통과하는 검정색 배관선이 밸브를 뚫고 지나가 밸브가 배관 밑에 깔린 것처럼 흐릿하게 비쳐 보였던 문제.

**조치 내역 (\`public/gms.css\`, \`public/gms-diagram.svg\`):**
1. **밸브 심볼 100% 불투명 채움 (\`gms.css\`):**
   - \`.gms-valve .body\` 및 \`.state-closed\`, \`.state-unknown\` 상태에서 \`fill: #ffffff;\`, \`opacity: 1;\`, \`stroke-width: 1.8px\`로 수정하여 배관선이 밸브 내부를 투과하지 못하도록 차단.
   - 밸브 기호가 배관선 위에 또렷하게 얹어져 보이도록 개선.
2. **SVG 레이어 완벽 적층 (\`gms-diagram.svg\`):**
   - \`pipesBaseLayer\`(검정 배관선) ➔ \`gasFlowLayer\`(적색선) ➔ \`staticPartsLayer\`(레귤레이터/필터) ➔ \`valveLayer\`(동적 밸브) ➔ \`ptLayer\`(센서) 순서로 확실하게 계층화 완료.
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-093 appended to QNA.md');
