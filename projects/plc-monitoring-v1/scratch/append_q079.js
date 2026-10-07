const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-079] GSP 진행 중 취소 시 열려 있던 모든 밸브 일괄 CLOSE 조치 (2026-08-23)

**질문/요청 내용:**
- GSP(가스공급 진행) 진행 중에 [취소]를 누르고 비밀번호를 입력해 빠져나왔을 때, 이전에 열려 있던 밸브들(V/S, HPI, LPI 등)이 닫히지 않고 배관 색상만 없어지던 문제

**원인 분석:**
- 퍼지완료 이후 취소 핸들러(\`advancePostPcCancelExit\`)에서 \`closeAllProcessValvesDirect\`를 호출하도록 되어 있었으나, 해당 함수가 구현되어 있지 않아 \`typeof === 'function'\` 검사에서 제외되어 실제 밸브 CLOSE 명령이 전송되지 않음.

**조치 내역 (\`public/Operation.js\`):**
1. \`closeAllProcessValvesDirect(side)\` 함수를 구현하여 해당 측 및 공용 공정 밸브(\`V/S\`, \`HPI\`, \`HPV\`, \`LPI\`, \`LPV\`, \`FPV\`, \`PGI\`, \`PGII\`, \`AV1~AV15\`, \`PNV\`, \`VN1\`, \`VN2\` 등) 전체에 대해 \`value: false\` (CLOSE) 쓰기 명령을 일괄 전송하도록 처리.
2. \`cancelGasSupply()\` 호출 시에도 \`closeAllProcessValvesDirect(side)\`를 무조건 호출하여 가스공급 진행 중 열렸던 모든 밸브가 즉시 CLOSE되고 배관 착색도 원상 복구되도록 구현 완료.
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-079 appended to QNA.md');
