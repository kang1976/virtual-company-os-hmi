const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-080] Step 7 READY(공급준비 완료) 화면 아날로그 계측 카드 UI 개편 (2026-08-23)

**질문/요청 내용:**
- Step 7 READY(가스공급준비 완료) 화면의 압력/무게 표시 UI를 Step 1(공급 압력 확인)과 동일한 아날로그 계측 카드 UI(HPT, MPT, LPT, NPT, WI)로 통일하고 실시간 값 연동

**조치 내역 (\`public/OPERATION HTML/가스공급_준비완료.html\`, \`public/Operation.js\`):**
1. **HTML 템플릿 개편 (\`가스공급_준비완료.html\`):**
   - 구형 정적 리스트를 제거하고, Step 1과 완벽히 동일한 \`.gsp-readout-panel\` 카드 컴포넌트 탑재
   - \`HPT_{side} :\`, \`MPT_{side} :\`, \`LPT_{side} :\`, \`NPT_{side} :\`, \`WI_{side} :\` 구조 및 단위(\`psi\`, \`kg\`) 박스 레이아웃 반영
2. **실시간 계측값 및 옵션 연동 (\`Operation.js\`):**
   - \`updateGspPressureCheckReadouts()\`에서 Step 7의 \`gspReady...\` 요소들까지 실시간 일괄 갱신하도록 확장
   - MPT 및 WI(무게) 옵션 미적용 시 행을 숨기고 간격을 자동 축소/정렬하도록 처리
   - Step 7 진입 시 및 실시간 PT 수신 시 계측값 동기화 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-080 appended to QNA.md');
