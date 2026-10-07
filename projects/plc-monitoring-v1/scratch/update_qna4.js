const fs = require('fs');
const p = 'D:/AI_Work/Antigravity/plc-monitoring/docs/QNA.md';
let content = fs.readFileSync(p, 'utf8');

const q129 = `
## [Q-129] 상단 헤더 컨트롤 세로 가운데 정렬(Vertical Center) 및 32px 높이 일괄 통일 (2026-09-14)

**요청 내용:**
- 상단 헤더의 배율 컨트롤(\`[−] [100%] [+]\`), 전체 화면 버튼(\`[⛶ 전체 화면]\`), 상단 탭(\`[GMS] [PLC 모니터링] ...\`) 간에 세로 정렬이 어긋나고 높이가 불일치하던 현상 개선 요청.

**원인 분석 (Root Cause Analysis):**
1. **과거 레거시 CSS 잔재**:
   - 구버전 \`gms.css\` 및 HTML 인라인 스타일의 \`.page-tabs\`에 \`align-items: flex-end\` 및 \`.page-tab { position: relative; top: 3px; }\` (폴더 탭 방식) 규칙이 잔존해 있어, 활성 탭(\`top: 0\`)과 비활성 탭(\`top: 3px\`) 간에 단차가 생기고 옆에 있는 배율 컨트롤 및 전체화면 버튼과 수직 기준선이 틀어졌음.
2. **컨트롤별 명시적 높이 미지정**:
   - \`.ui-zoom\`(32px), \`.fullscreen-btn\`(padding 기반 가변), \`.page-tabs\`(padding 합산 약 38px)의 높이가 제각각이었음.

**처리 내역:**
1. **레거시 탭 스타일 완전 정격화**:
   - \`gms.css\`, \`index.html\`, \`monitoring.html\`, \`grid/index.html\`, \`gms-select.html\`, \`settings.html\`에서 과거의 \`top: 3px\` 및 \`align-items: flex-end\` 스타일을 일괄 제거.
2. **헤더 컨트롤 일괄 32px 높이 통일 및 정렬 적용 (\`theme-3d.css\`)**:
   - \`header > div\`: \`display: inline-flex; align-items: center; gap: 10px; height: 32px;\`로 완벽한 세로 중앙 배치.
   - \`.ui-zoom\`, \`.fullscreen-btn\`, \`#helpBtn\`, \`#themeSelect\`, \`.page-tabs\` 모두 **정확히 \`32px\` 고정 높이(\`box-sizing: border-box\`)**로 통일.
   - \`.page-tabs\` 내부의 \`.page-tab\`은 \`height: 100%\`로 슬롯 내부에서 완벽하게 상하/좌우 센터링되도록 완성.
`;

if (!content.includes('[Q-129]')) {
  content += q129;
  fs.writeFileSync(p, content, 'utf8');
  console.log('QNA.md updated with [Q-129]');
} else {
  console.log('Q-129 already present');
}
