const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-054] 시퀀스 진행 중 CONFIG 설정값(진공하한치/설정시간 등) 실시간 동적 반영 개선 (2026-08-23)

**질문 내용:**
- "시퀀스 진행 중에 진공하한치 값을 변경을 해도 현재 반영이 안 되고 있는 것인가요?"

**원인 분석:**
- 기존에는 서브시퀀스 러너가 처음 실행(start)될 때만 \`/api/gms/sub-sequence-config\`에서 설정값을 한 번 불러와 내부 캐시 변수에 보관하고 있었음
- 이에 따라 시퀀스가 동작 중인 도중에 CONFIG 탭에서 진공하한치, PUMPING 시간 등을 수정하고 저장하더라도 진행 중인 실행에는 즉시 반영되지 않고 다음 실행부터 반영되는 구조였음

**조치 내역 (\`public/gms-sub-sequence-runner.js\`, \`public/gms-config-tab.js\`):**
- \`subSeqFindConfigRow\` 함수가 조건식을 평가할 때마다 브라우저의 최신 \`window.configRows\`(실시간 편집 배열) 및 동기화된 최신 캐시를 직접 조회하도록 전면 개선
- 이제 **시퀀스가 진행 중인 도중에도 CONFIG 탭에서 진공하한치나 설정시간을 변경하고 저장하면, 다음 1초 판정 주기부터 즉각 새로운 기준값이 실시간으로 100% 반영**됨
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-054 appended to QNA.md');
