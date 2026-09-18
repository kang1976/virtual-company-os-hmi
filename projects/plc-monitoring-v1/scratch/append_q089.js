const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-089] 일시정지 ➔ 퍼지완료(PC) 이동 및 가스공급 시 HPLP 점프 후 GSP 1단계 진입 구현 (2026-08-23)

**질문/요청 내용:**
- 가스공급(Service) 중 [일시정지] ➔ 비밀번호 통과 ➔ **퍼지완료(PC)** 화면으로 이동
- 퍼지완료(PC) 화면에서 **[가스공급]** 버튼을 누르면, **HPLP(HP&LP Pump) 서브시퀀스를 점프(건너뛰고)하여 GSP 1 step(공급 압력 확인 / Step 1)으로 바로 이동**하도록 구현

**조치 내역 (\`public/Operation.js\`):**
1. **일시정지 실행 (\`GAS_SUPPLY_ACTIONS.pause\`):**
   - \`cancelGasSupply()\` 호출을 통해 모든 밸브 일괄 CLOSE, 배관 램프 OFF, Status를 \`PC\`로 갱신하고 퍼지완료(\`exchangePurgeComplete\`) 화면으로 안전하게 복귀.
2. **퍼지완료 화면 [가스공급] 버튼 (\`exchangePurgeCompleteGasSupplyBtn\`):**
   - \`gasSupplyEntry\` 비밀번호 게이트 통과 후, HPLP 단계를 점프하여 곧바로 GSP 1단계 화면(\`showProgressGasSupplyStep(0)\` ➔ \`gasSupplyPressureCheck\`)으로 직행하도록 수정 완료.
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-089 appended to QNA.md');
