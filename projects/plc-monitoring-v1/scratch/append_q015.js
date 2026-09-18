const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-015] 상단 메뉴 테마 선택 제거 및 [설정] 화면 내 테마/색상 선택으로 일원화 및 간소화 (2026-08-22)

**요청 내용:**
- 상단 메뉴 정리: 상단 헤더의 테마선정 버튼(드롭다운)을 마지막 [설정] 화면 안으로 이동
- [설정] 화면의 두 번째 항목과 중복되는 부분 확인 및 간소화 정리

**처리 내역:**
1. **상단 네비게이션 헤더 메뉴 간소화:**
   - \`index.html\`, \`monitoring.html\`, \`settings.html\`, \`gms.html\`, \`gms-select.html\`, \`grid/index.html\` 전체 6개 페이지 상단 헤더에서 불필요하게 자리를 차지하던 \`#themeSelect\` 드롭다운 및 CSS 일괄 제거
2. **설정 화면(\`settings.html\`) 테마/색상 일원화:**
   - 상단 바와 설정 화면 본문에 이중으로 존재하던 테마 제어 방식을 **[설정] 화면 본문의 [테마 / 색상] 스와치(라이트/다크/오렌지/블루/그린/그레이 원형 버튼)로 단일화**
3. **자바스크립트 Null-Safety 방어 보강:**
   - \`app.js\`, \`monitoring.js\`, \`gms.js\`, \`gms-select.js\`, \`settings.js\`, 그리드 번들(\`index-B7rPQVR9.js\`)에서 헤더 드롭다운 제거 후에도 예외 없이 안전하게 동작하도록 가드 처리 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-015 appended to QNA.md');
