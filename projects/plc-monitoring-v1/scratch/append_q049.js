const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-049] HP&LP Pump 화면 진입 시 빈 화면(백지) 발생 원인 수정 (2026-08-23)

**요청/지적 내용:**
- "화면구성은 왜 안되어 있나요?" - 퍼지완료(PC)에서 가스공급 진행 시 HP&LP Pump 화면 컨테이너가 표시되지 않고 빈 화면(백지)으로 남는 현상 해결 요청

**원인 분석:**
- \`public/Operation.js\`의 화면 딕셔너리 객체인 \`progressScreens\` 맵에 신규 화면 매핑인 \`hpLpPump: progressHpLpPumpBody\`가 누락되어 있어, \`showProgressScreen('hpLpPump', ...)\` 호출 시 표시할 DOM 컨테이너를 찾지 못하고 화면이 비어 있었음

**조치 내역 (\`public/Operation.js\`):**
- \`progressScreens\` 맵에 \`hpLpPump: progressHpLpPumpBody\` 등록 완료
- 이제 \`PC\` 화면에서 "가스공급" 클릭 시 \`HP&LP Pump\` 화면(상단 배지, Pumping 대기 패널, 조작 버튼 등)이 완벽하게 렌더링됨
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-049 appended to QNA.md');
