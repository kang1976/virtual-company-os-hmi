const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-074] 조정모드 비밀번호 입력 취소 시 이전 화면 복귀 및 Line Vent 진입 비밀번호 게이트 적용 (2026-08-23)

**질문/요청 내용:**
- "가스공급_압력확인.html 화면에서 조정모드 눌러서 비밀번호 화면 진입 거기서 취소를 누르면 원래 화면으로 이동을 하지 않고 메인 메뉴 화면으로 이동됨. 비밀번호 취소를 누르면 진입을 했던 원래 화면으로 이동해야 함."
- "Line Vent도 마찬가지로 버튼을 누르면 비밀번호를 누르고 진행을 해야 함."

**조치 내역 (\`public/gms.js\`, \`public/Operation.js\`):**
1. **조정모드 비밀번호 입력 취소 시 원래 화면 복귀:**
   - \`passwordCancelBtn\`에서 \`if (passwordCancelTarget === 'adjustMode') { exitAdjustMode(); return; }\` 분기 추가
   - PASSWORD 입력 화면에서 '취소'를 누르면 메인 메뉴로 빠지지 않고, 진입했던 원래 화면(\`gasSupplyPressureCheck\` 등)으로 정확하게 복귀 완료
2. **Line Vent 진입 비밀번호 게이트(\`lineVent\`) 추가 및 네비게이션 연동:**
   - \`PASSWORD_GATE_DEFS\`에 \`{ key: 'lineVent', label: 'Line Vent 진입 비밀번호' }\` 추가 (OPTION 탭에서 토글 가능)
   - "Line Vent" 버튼 클릭 시 \`proceedPastPasswordGate('lineVent', ...)\`를 통해 비밀번호 확인 절차 거침
   - PASSWORD 화면에서 취소 시 \`gasSupplyPressureCheck\` 화면으로 복귀, 확인(일치) 시 Line Vent 수동밸브 화면으로 진입하도록 조치 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-074 appended to QNA.md');
