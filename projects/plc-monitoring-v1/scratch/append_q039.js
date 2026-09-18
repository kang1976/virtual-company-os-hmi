const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-039] 가압시험(+L) / 감압시험(-L, Bypass) 화면 진행 패널에 "압력변동기준(설정값)" 행 추가 및 자동 연동 (2026-08-23)

**요청 내용:**
- 가압시험(Leak check) 및 감압시험 서브시퀀스 진행 시, 현재값 밑에 "압력변동기준" 설정값 항목을 한 줄 더 추가하여 작업자가 기준치를 직관적으로 확인할 수 있도록 화면 및 러너 수정 요청

**처리 내역:**
1. **진행 패널 UI에 \`압력변동기준\` 행 추가:**
   - **가압시험 화면** (\`public/OPERATION HTML/교환후+L_가압시험.html\`):
     - \`압력변동기준 : [ 0.50 PSI ]\` 행 추가
   - **감압시험 화면** (\`public/OPERATION HTML/교환전-L_감압시험.html\`):
     - \`압력변동기준 : [ 0.50 PSI ]\` 행 추가
   - **Bypass 화면** (\`public/OPERATION HTML/시퀀스_Bypass.html\`):
     - \`압력변동기준 : [ - ]\` 행 추가
2. **러너 엔진 실시간 CONFIG 연동 (\`public/gms-sub-sequence-runner.js\`):**
   - \`subSeqApplyCapture\` 실행 시, 해당 Step의 조건식 또는 네임스페이스에 해당하는 변동기준(\`가압 시험-압력 변동 기준_{side}\`, \`감압 시험-압력 변동 기준_{side}\`, \`VT 누출 압력 변동 기준_{side}\`) CONFIG 값을 찾아 \`[ 0.50 PSI ]\` 형태로 자동 출력
   - 초기화(\`Reset\`) 시 \`'-'\`로 안전 초기화
3. **마스터 엑셀 및 통합 동기화:** \`docs/GMS_Cylinder_Exchange_Master_Total.xlsx\`
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-039 appended to QNA.md');
