const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-062] 상단바 높이 축소 시 탭 메뉴 버튼 짤림 방지 - 3행 통합 인라인 배치 (2026-08-23)

**질문/요청 내용:**
- "세로폭을 조절하면 메뉴 버튼이 따라다니다가 어느 정도 올라가면 아래로 숨겨져 버린다. 조치 바랍니다."

**원인 분석:**
- 기존에는 \`A Side\`(1행) ➔ \`B Side\`(2행) ➔ \`etc\`(3행) 아래에 \`tab-switch-bar\`가 4번째 행으로 분리 배치되어 있었음
- 이에 따라 상단 바 높이를 컴팩트하게 줄이면 4번째 행에 있던 탭 메뉴 버튼의 아랫부분이 바닥에 가려져 숨겨지는 현상이 발생함

**조치 내역 (\`public/gms.html\`, \`public/gms.css\`):**
- \`etc\` 행(3번째 행)의 우측 남는 공간에 \`tab-switch-bar\`(진행 메뉴, CONFIG, USER 등)를 **인라인(동일 3행)으로 나란히 통합 배치**
  - **1행**: \`A Side\` + 배지 19개
  - **2행**: \`B Side\` + 배지 19개
  - **3행**: \`[etc] [비상정지] [강제] [PM] [SETUP]\` ─── (우측 정렬) ─── \`[진행 메뉴] [CONFIG] [USER]...\`
- **결과**: 전체 상단 대시보드가 정확히 3개 행으로 완벽하게 수용되어, 상단 바 높이를 아무리 낮게 줄여도 탭 메뉴가 아래로 떨어지거나 짤리지 않고 항상 100% 온전하게 노출됨
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-062 appended to QNA.md');
