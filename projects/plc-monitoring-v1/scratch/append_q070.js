const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-070] '가스공급_압력확인' 화면 내 조정모드 버튼 비밀번호 게이트 연동 및 취소 시 원복 네비게이션 구현 (2026-08-23)

**질문/요청 내용:**
- "가스공급_압력확인.html의 조정모드 버튼은 기존 보조메뉴의 조정모드 시퀀스처럼 비밀번호 묻고 조정모드 화면으로 이동하면 됩니다."
- "조정모드 화면에서 취소를 누르면 기존 화면과 동일한 화면으로 이동해야 합니다. 이번에 '가스공급_압력확인.html'에서 진입했으므로 이 화면으로 오면 됩니다."

**조치 내역 (\`public/Operation.js\`):**
1. **조정모드 진입 비밀번호 게이트 연동:**
   - \`gasSupplyPressureCheckAdjustModeBtn\` 클릭 시 \`requestAdjustMode(progressCurrentSide)\` 호출
   - 진입 전 현재 화면(\`gasSupplyPressureCheck\`)과 헤더(\`[A] 가스공급 진행\`)를 \`adjustModePrevScreen\`에 자동 저장
   - \`proceedPastPasswordGate('adjustMode', ...)\`를 통해 OPTION 탭의 '조정모드 진입 비밀번호' 활성 여부에 따라 PASSWORD 입력 후 조정모드 화면으로 진입
2. **조정모드 취소 시 가스공급_압력확인 화면 안전 복귀:**
   - 조정모드 화면에서 "취소" 클릭 시 \`exitAdjustMode()\`가 호출되어 기억해 둔 \`gasSupplyPressureCheck\` 화면으로 정확하게 복귀
   - 복귀 시 \`updateGspPressureCheckReadouts()\`를 실행하여 실시간 압력 및 WI 무게 센서 계측값도 즉시 복원되도록 처리 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-070 appended to QNA.md');
