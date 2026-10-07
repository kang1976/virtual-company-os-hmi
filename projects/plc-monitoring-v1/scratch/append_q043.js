const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-043] Puls 2 화면의 하단 정렬(Flex Layout) CSS 누락 수정 및 표준 정렬 규칙 반영 (2026-08-23)

**요청 내용:**
- 신규 생성된 Puls 2 화면의 설정/진행횟수 패널 및 조작 버튼이 화면 중간에 떠 있는 현상 해결 및 다른 표준 화면들과 동일하게 화면 하단으로 밀착 정렬되도록 CSS 수정 요청
- **[신규 화면 생성 표준 규칙]**: 화면 생성 시 반드시 CSS 패널 셀렉터에 등록하여 하단 정렬(\`margin-top: auto\` 및 Flex Column Layout)을 보장할 것

**원인 분석:**
- \`public/gms.css\`의 flex-column 컨테이너 셀렉터(#...Idle, #...Panel) 목록에 \`#exchangeAfterPulsIdle\`, \`#exchangeAfterPulsPanel\`이 누락되어, \`.progress-btn-group\`의 \`margin-top: auto\`가 작동하지 않고 상단에 머물렀음

**조치 내역:**
1. **CSS 패널 셀렉터 등록 (\`public/gms.css\`):**
   - \`#exchangeAfterPulsIdle, #exchangeAfterPulsPanel\`을 Flex Column 컨테이너 셀렉터 목록에 추가하여 하단 밀착 정렬 적용
2. **TREND 버튼 추가 (\`public/OPERATION HTML/교환후_Puls2.html\`, \`public/Operation.js\`):**
   - 패널 내 \`TREND\` 버튼 추가 및 이벤트 리스너 연결
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-043 appended to QNA.md');
