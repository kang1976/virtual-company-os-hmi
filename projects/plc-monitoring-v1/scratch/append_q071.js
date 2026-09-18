const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-071] '가스공급_압력확인' 화면 내 Line Vent 버튼 수동밸브 조작 화면 연동 및 취소 시 원복 네비게이션 구현 (2026-08-23)

**질문/요청 내용:**
- "Line Vent는 수동밸브조작 화면으로 이동하면 됩니다. 수동밸브 조작에서 취소하면 다시 원래 화면으로 이동하면 됩니다. 이번에 '가스공급_압력확인.html'에서 진입했으므로 이 화면으로 오면 됩니다."

**조치 내역 (\`public/Operation.js\`):**
1. **수동 밸브 조작 진입 출처 추적 (\`manualValvePrevScreen\`):**
   - \`gasSupplyPressureCheck\` 화면의 "Line Vent" 버튼 클릭 시 \`manualValvePrevScreen = 'gasSupplyPressureCheck'\`를 기록하고 수동 밸브 조작 화면(\`manualValve\`)으로 이동
   - 유지보수 메뉴에서 진입할 때는 \`manualValvePrevScreen = 'maintenanceMenu'\`로 구분 기록
2. **수동 밸브 조작 취소 시 원래 화면 안전 복귀 (\`exitManualValve\`):**
   - 수동 밸브 조작 화면에서 "취소" 클릭 시(및 밸브 CLOSE 확인/비밀번호 게이트 통과 시) \`exitManualValve()\` 호출
   - \`manualValvePrevScreen\`이 \`'gasSupplyPressureCheck'\`인 경우 **\`가스공급_압력확인.html\` 화면으로 즉시 복귀**하며, \`updateGspPressureCheckReadouts()\`를 통해 실시간 압력 및 WI 무게 센서 수치 동시 갱신 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-071 appended to QNA.md');
