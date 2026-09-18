const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-045] 교환 후 상단 큰 배지 목록 원복 (5개 구성) 및 Bypass/Puls 2의 "+L" 점멸 공유 정책 적용 (2026-08-23)

**요청 내용:**
- 상단 큰 배지가 너무 길어지는 문제를 방지하기 위해 기존 5개 구성(\`[3P] [+L] [-VT] [4P] [PC]\`)으로 원복
- \`Bypass\`, \`+L\`, \`Puls 2\` 세 구간 진행 시 상단 큰 배지에서 **\`+L\`** 이 점멸하도록 통일

**상단 큰 배지(step-badges-lg) 최종 표준 규격:**
\`\`\`
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│  3P  │ │  +L  │ │ -VT  │ │  4P  │ │  PC  │
└──────┘ └──────┘ └──────┘ └──────┘ └──────┘
\`\`\`

**구간별 점멸(Blinking) 상태:**
1. **3차 배관청소(3P)**: \`[3P (점멸)] [+L] [-VT] [4P] [PC]\`
2. **배관 By-pass 체크(Bypass)**: \`[3P (완료)] [+L (점멸)] [-VT] [4P] [PC]\`
3. **교환 후 가압시험(+L)**: \`[3P (완료)] [+L (점멸)] [-VT] [4P] [PC]\`
4. **가압 후 Puls Vent(Puls 2)**: \`[3P (완료)] [+L (점멸)] [-VT] [4P] [PC]\`
5. **교환 후 VT 감압시험(-VT)**: \`[3P (완료)] [+L (완료)] [-VT (점멸)] [4P] [PC]\`
6. **교환 후 4차 배관청소(4P)**: \`[3P (완료)] [+L (완료)] [-VT (완료)] [4P (점멸)] [PC]\`
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-045 appended to QNA.md');
