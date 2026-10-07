const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-088] 가스공급 화면에서 일시정지 실행 시 GSP 1단계(공급 압력 확인) 화면으로 바로 점프 전환 (2026-08-23)

**질문/요청 내용:**
- 가스공급(Service) 화면에서 [일시정지] 실행 시, 퍼지완료(PC) 화면이 아닌 **GSP 스텝 단계(Step 1: 공급 압력 확인 / Status: GSP)로 바로 점프하여 진입**하도록 수정

**조치 내역 (\`public/Operation.js\`):**
- \`GAS_SUPPLY_ACTIONS.pause\`의 \`perform\` 핸들러를 수정:
  1. 열려 있던 밸브 일괄 CLOSE 및 배관 적색 램프 OFF (\`closeAllProcessValvesDirect(side)\`)
  2. 실린더 Status를 \`GSP\`(가스공급 진행)로 전환 (\`applyCylinderStepStatus\`)
  3. GSP 1단계 화면(\`showProgressGasSupplyStep(0)\` ➔ \`gasSupplyPressureCheck\`)으로 즉시 점프 진입 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-088 appended to QNA.md');
