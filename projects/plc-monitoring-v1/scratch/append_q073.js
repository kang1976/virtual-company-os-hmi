const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-073] Line Vent 전용 6개 밸브 표시 및 수동밸브 조작 취소 시 가스공급_압력확인 화면 복귀 버그 수정 (2026-08-23)

**질문/요청 내용:**
- "Line Vent로 진입된 수동 벨브 조작 화면에는 PNV / LPV / HPV / HPI / PGI / PGII 만 표현 되도록 해주세요"
- "수동조작 화면에서 취소를 눌렀는데 유지보수 메뉴로 복귀를 했다... 이러면 안됨... 가스공급_압력확인.html 화면에서 진입을 하면 다시 원복을 할 때 기존 화면으로 이동을 해야 한다"

**원인 분석:**
- 수동 밸브 조작 취소 시 PASSWORD 게이트를 거친 후 \`passwordConfirmBtn\` 분기 처리에서 \`manualValve\` 전용 분기가 누락되어 기본값인 \`showProgressMaintenanceMenu()\`(유지보수 메뉴)로 이동하던 결함이 있었음

**조치 내역 (\`public/Operation.js\`):**
1. **Line Vent 전용 6개 밸브 격자 레이아웃 구성 (\`LINE_VENT_VALVE_GRID_LAYOUT\`):**
   - \`gasSupplyPressureCheck\` ("Line Vent")에서 진입 시 \`PNV\`, \`LPV\`, \`HPV\`, \`HPI\`, \`PGI\`, \`PGII\` 6개 밸브만 표시되도록 동적 전환
   - 유지보수 메뉴에서 진입할 때는 기존 전체 밸브(25개) 그리드를 그대로 표시
2. **취소 시 원복 네비게이션 및 비밀번호 확인 분기 수정:**
   - \`passwordConfirmBtn\`에 \`if (passwordCancelTarget === 'manualValve') { exitManualValve(); return; }\` 추가
   - \`exitManualValve()\`에서 \`manualValvePrevScreen === 'gasSupplyPressureCheck'\`인 경우 원래 화면인 **\`가스공급_압력확인.html\` 화면으로 정확하게 복귀**하도록 수정 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-073 appended to QNA.md');
