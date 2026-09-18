const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-016] 실린더 교환 옵션 분기 순서 변경(CC ➔ 3P ➔ Bypass) 반영 및 Mermaid 플로우차트 파일 갱신 (2026-08-22)

**요청 내용:**
- 실린더 교환 공정 옵션에서 3P 순서를 CC 바로 다음으로 변경 반영
- Mermaid Flow(플로우차트) 재작성 및 기존 최종 파일(\`docs/cylinder_flowchart.mmd\`, \`docs/cylinder_flowchart.txt\`) 갱신 요청

**처리 내역:**
1. **공정 순서 변경 및 분기 구조 재설계:**
   - 기존: CC(용기교체) ➔ Bypass 옵션 분기 ➔ 3P ➔ +L
   - **변경: CC(용기교체) ➔ 3P(교환후 배관청소) ➔ Bypass 옵션 분기(고압He라인 세부옵션) ➔ +L(가압시험)**
2. **Mermaid 소스 파일 일괄 갱신 완료:**
   - \`docs/cylinder_flowchart.mmd\` (Mermaid 전용 뷰어용)
   - \`docs/cylinder_flowchart.txt\` (복사용 텍스트 파일)
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-016 appended to QNA.md');
