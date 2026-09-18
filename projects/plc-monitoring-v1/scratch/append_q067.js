const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-067] GSP 서브시퀀스 상단 배지 헤더 타이틀 '[A] 가스공급 진행'으로 전면 수정 (2026-08-23)

**질문/요청 내용:**
- "자동진행인데 이부분도 이제부터 [A] 가스공급 진행 으로 수정을 해달라 요청을 했는데 잘 반영이 안되었네요"

**원인 분석:**
- 코드 상의 기본 fallback 타이틀은 수정되었으나, 서버의 화면 제목 설정 파일(\`data/gmsScreenTitles.json\`)에 \`gasSupplyPressureCheck\` 등 가스공급 7개 단계의 화면 제목이 기존 \`"자동 진행"\`으로 저장되어 있어 서버 설정값이 우선 적용되었음

**조치 내역 (\`data/gmsScreenTitles.json\`, \`public/Operation.js\`):**
- \`data/gmsScreenTitles.json\` 내 가스공급 관련 모든 화면(\`gasSupplyPressureCheck\`, \`gasSupplyValveShutter\`, \`gasSupplyRegulatorClose\`, \`gasSupplyCylinderOpen\`, \`gasSupplyRegulatorAdjust\`, \`gasSupplyPmvOpen\`, \`gasSupplyReady\`, \`gasSupplyActive\`, \`gasSupplyConfirmAction\`)의 타이틀을 \`"가스공급 진행"\`으로 일괄 수정
- 상단 헤더 배지가 정확하게 \`[A] 가스공급 진행\` / \`[B] 가스공급 진행\`으로 표시되도록 조치 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-067 appended to QNA.md');
