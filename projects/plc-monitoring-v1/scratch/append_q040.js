const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-040] 압력변동기준치 화면 표시 누락 버그 원인 규명 및 수정 (2026-08-23)

**요청 내용:**
- CONFIG 표에 "가압 시험-압력 변동 기준_A / _B"가 정상 등록되어 있음에도, 화면 진행 패널의 \`압력변동기준 : [ - ]\`로 값이 나오지 않는 원인 규명 및 수정 요청

**원인 분석:**
- \`subSeqFindConfigRow\` 함수가 객체 \`{ configRow, resolvedTargetRef }\`를 반환하는데, 러너 엔진에서 구조분해 할당 없이 \`row.value\`로 직접 참조하여 \`undefined\`가 반환되어 \`[ - ]\`로 출력되었음

**조치 내역 (\`public/gms-sub-sequence-runner.js\`):**
1. **CONFIG 반환값 구조분해 할당 수정:**
   - \`const { configRow } = subSeqFindConfigRow(...)\`로 수정하여 \`configRow.value\` 및 \`configRow.unit\`(\`0.50 PSI\`)을 정확히 취득하도록 조치
2. **시퀀스 시작 시 사전 렌더링 추가 (\`subSeqRunSequence\`):**
   - CAPTURE 스텝뿐만 아니라 가압시험/감압시험 서브시퀀스가 시작되는 순간부터 진행 패널에 \`[ 0.50 PSI ]\`가 즉시 선제 표시되도록 보강
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-040 appended to QNA.md');
