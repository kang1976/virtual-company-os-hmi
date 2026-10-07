const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-083] 가스공급 화면에서 공급중지/강제교체 시 밸브 일괄 CLOSE 및 배관 적색 램프 OFF 조치 (2026-08-23)

**질문/요청 내용:**
- 가스공급(Service) 화면에서 [공급중지]를 실행했을 때, 열려 있던 모든 밸브가 Close되고 배관의 적색 가스 유입 램프/라인이 전부 OFF되어야 함.

**원인 분석:**
- 가스공급 동작 재확인 핸들러(\`GAS_SUPPLY_ACTIONS.stop\`)에서 \`resetCylinderStepStatus\` 및 메인 메뉴 이동만 수행하고 \`closeAllProcessValvesDirect\`를 호출하지 않아 밸브와 배관 착색이 남아있던 문제.

**조치 내역 (\`public/Operation.js\`):**
1. \`GAS_SUPPLY_ACTIONS.stop\`의 \`perform\` 콜백에 \`closeAllProcessValvesDirect(side)\`를 추가하여, [공급중지] 실행 시 모든 밸브 일괄 CLOSE 및 배관 적색 착색 완전 OFF 처리.
2. \`GAS_SUPPLY_ACTIONS.forceChange\`(강제 교체) 시에도 이전 측 밸브 일괄 CLOSE 및 배관 적색 착색 OFF(\`closeAllProcessValvesDirect(fromSide)\`) 연동 완료.
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-083 appended to QNA.md');
