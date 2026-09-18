const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-020] 작업이력 스텝별 밸브 개별 OPEN 및 CLOSE 동작 정밀 추적/표기 엔진 전면 개편 (2026-08-22)

**요청 내용:**
- 작업이력에서 왜 Valve Open 작동 메시지가 누락되었는지 및 Close가 왜 "전 밸브 Close"로만 일률 표기되는지 원인 분석 요청
- 각 스텝에 정의된 개별 밸브 Open(O) / Close(C) 동작이 작업이력 C열에 정확하게 개별 반영되도록 수정 요청

**원인 분석:**
- 기존 포맷팅 함수에서 \`step.output\` 문자열에 단순 나열된 항목만 \`[OPEN]\`으로 인식하고, 비어 있거나 CLOSE 동작인 경우 일괄 \`전 밸브 [CLOSE]\`로 처리하여 \`step.valves\`에 지정된 개별 O/C 변경분(\`PGII_A OPEN\`, \`PGII_A CLOSE\`, \`PNBV CLOSE\` 등)이 누락되었음

**처리 내역:**
1. **스텝별 밸브 O(Open)/C(Close) 개별 추적 엔진 탑재 (\`public/gms-sub-sequence-runner.js\`):**
   - \`step.valves\` 객체를 정밀 분석하여 이번 스텝에서 실제 열리는 밸브와 닫히는 밸브를 개별 분리
   - **Open 밸브만 있을 때**: \`밸브 동작: PNV [OPEN]\`, \`밸브 동작: HPV_A [OPEN]\`
   - **Close 밸브만 있을 때**: \`밸브 동작: PGII_A [CLOSE]\`, \`밸브 동작: PNBV [CLOSE]\`
   - **Open과 Close가 동시 발생할 때**: \`밸브 동작: AV1_A [OPEN] / AV2_A [CLOSE]\`
   - **밸브 변경이 없는 스텝**: 현재 실시간 열림 상태를 파악하여 \`밸브 상태: PNV, HPV_A [OPEN 유지]\` 또는 \`밸브 상태: 전 밸브 [CLOSE]\`로 명확히 구분 표기
2. **러너 스텝 실행 단계(\`subSeqRunStepAt\`)와 실시간 동기화:**
   - \`subSeqApplyValves\`의 실제 PLC 밸브 쓰기 결과(\`diffLabels\`)를 \`subSeqLogStep\`에 직접 전달하여 작업이력과 실제 제어 상태 100% 일치
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-020 appended to QNA.md');
