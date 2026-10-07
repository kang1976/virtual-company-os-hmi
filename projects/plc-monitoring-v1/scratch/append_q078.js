const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-078] GSP CONFIG 실시간 연동 동기화 및 인터락 판정 버그 수정 (2026-08-23)

**질문/요청 내용:**
- CONFIG 탭에서 HPT/LPT 저압 및 고압 값을 수정한 후 저장했는데도, 가스공급 진행 인터락 검사 시 기본값(100~2500 PSI)이 적용되면서 통과되지 않는 현상

**원인 분석:**
1. \`gms-config-tab.js\`에서 관리하는 \`configRows\`가 전역 객체로 노출되지 않아, \`Operation.js\`의 \`getGspConfigValue()\`가 내부 캐시/전역 참조를 찾지 못하고 기본값(\`defaultValue: 100\`)을 반환함.
2. \`Operation.js\`가 로드될 때 \`/api/gms/sub-sequence-config\`를 직접 비동기 페치하여 로컬 캐시(\`gspConfigRowsCache\`)에 보관하지 않아서 초기 동기화가 누락됨.

**조치 내역 (\`public/gms-config-tab.js\`, \`public/Operation.js\`):**
1. \`gms-config-tab.js\`의 \`loadGmsSubSequenceConfigRows()\` 및 \`saveGmsSubSequenceConfigRows()\`에서 \`window.gmsSubSequenceConfigRows\` 및 \`window.configRows\`로 전역 즉시 바인딩하도록 수정.
2. \`Operation.js\` 로드 시 \`loadGspConfigRowsFromApi()\`를 자동 호출하여 서버 설정값을 즉시 캐싱하도록 개선.
3. \`getGspConfigValue(name, defaultValue)\`에서 전역 객체(\`window.gmsSubSequenceConfigRows\`, \`window.configRows\`, \`window.subSeqConfigRows\`) 및 캐시 배열을 우선 탐색하고 \`name\`과 \`id\`를 모두 매칭하도록 보강.
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-078 appended to QNA.md');
