const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-022] By-pass 체크 화면 상단 큰 배지 추가 및 가압시험(+L) 배지 점멸 연동 (2026-08-22)

**요청 내용:**
- 바이패스(By-pass 체크) 화면에서 상단 배지가 누락되어 있던 부분에 가압시험(+L) 배지가 점멸하도록 화면 및 로직 수정 요청

**처리 내역:**
1. **By-pass 화면 상단 큰 배지 마크업 추가 (\`public/OPERATION HTML/시퀀스_Bypass.html\`):**
   - \`[ 3P(done) ] [ +L(blinking) ] [ -VT ] [ 4P ]\` 큰 배지 영역(\`.step-badges-lg\`) 배치
2. **Bypass 공정 실행 시 +L 배지 실시간 점멸 연동 (\`public/Operation.js\`):**
   - \`applyCylinderStepStatus()\`에서 \`stepKey === 'Bypass'\`일 때 \`+L\` 배지가 점멸(\`blinking\`)하도록 공유 매핑 추가 (\`isSharedPlusLBlink\`)
   - 앞선 3P 공정은 완료(\`done\`, 적색 고정) 상태로 유지되고, 뒤따르는 -VT / 4P는 대기 상태로 깔끔하게 표시됨
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-022 appended to QNA.md');
