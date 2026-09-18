const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-044] 교환 후 화면 상단 큰 배지(step-badges-lg) 목록에 "Bypass" 및 "Puls 2" 전체 반영 (2026-08-23)

**요청 내용:**
- 교환 후 화면 상단 큰 배지 목록에 \`Bypass\` 중간 배지 추가 요청 (\`3P\`와 \`+L\` 사이)

**배지 배열 순서 표준화:**
\`\`\`
[3P] ➔ [Bypass] ➔ [+L] ➔ [Puls 2] ➔ [-VT] ➔ [4P] ➔ [PC]
\`\`\`

**조치 내역 (HTML 파일 전수 수정):**
1. **\`교환후_Puls2.html\`**: \`[3P] [Bypass] [+L] [Puls 2 (점멸)] [-VT] [4P] [PC]\`
2. **\`교환후3P_배관청소.html\`**: \`[3P (점멸)] [Bypass] [+L] [Puls 2] [-VT] [4P] [PC]\`
3. **\`시퀀스_Bypass.html\`**: \`[3P] [Bypass (점멸)] [+L] [Puls 2] [-VT] [4P] [PC]\`
4. **\`교환후+L_가압시험.html\`**: \`[3P] [Bypass] [+L (점멸)] [Puls 2] [-VT] [4P] [PC]\`
5. **\`교환후-VT_VT감압시험.html\`**: \`[3P] [Bypass] [+L] [Puls 2] [-VT (점멸)] [4P] [PC]\`
6. **\`교환후4P_배관청소.html\`**: \`[3P] [Bypass] [+L] [Puls 2] [-VT] [4P (점멸)] [PC]\`
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-044 appended to QNA.md');
