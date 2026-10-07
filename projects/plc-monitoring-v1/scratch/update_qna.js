const fs = require('fs');
const p = 'D:/AI_Work/Antigravity/plc-monitoring/docs/QNA.md';
let content = fs.readFileSync(p, 'utf8');

const q126 = `
## [Q-126] Univer 그리드 100% 표준 좌표계 격리 + 일반 UI 배율 확대/축소 및 레시피 화면 헤더 컨트롤 신설 / 설정 화면 배율 실시간 연동 (2026-09-14)

**요청 내용:**
1. 트렌드 모니터링(\`monitoring.html\`)에서 상단 뱃지/헤더/툴바/차트는 사용자가 선택한 배율(125%, 150%, 200% 등)로 확대/축소되면서도, Univer 그리드는 마우스 오클릭 왜곡이 없도록 100% 표준 좌표계로 완벽 격리 요구.
2. 레시피 배포 및 비교 화면(\`grid/index.html\`)에 누락되어 있던 상단 확대/축소([−], [100%], [+]) 드롭다운/버튼 UI 신설 및 동일 격리 줌 엔진 적용.
3. 설정 화면(\`settings.html\`)에서 [화면 기본 배율]을 변경 및 저장했을 때 모든 화면 및 그리드에 즉시 동기화되도록 연동 개선.

**원인 분석 (Root Cause Analysis):**
1. **Canvas 마우스 오프셋과 UI Zoom 공존 문제**:
   - \`body\`에 \`zoom: 1.25\`가 걸리면 \`<canvas>\`의 마우스 클릭 좌표(\`clientX/Y\`)가 왜곡되어 마우스 클릭 위치와 실제 클릭되는 셀 간에 오차가 발생함.
   - **해결책 (Isolation Pattern)**: \`body\`에는 \`document.body.style.zoom = String(z)\`를 주어 헤더/뱃지/차트 등 일반 UI를 시원하게 확대하되, Univer 스프레드시트 컨테이너(\`trendGridContainer\`, \`univer-container\`)에 \`zoom: calc(1 / var(--ui-zoom, 1));\`을 적용하면 Univer의 실효 배율은 \`z * (1/z) = 1.0\`(100% 표준 좌표계)으로 고정되어 마우스 클릭 위치 왜곡이 **0%로 영구 박멸**되고 일반 UI는 원하는 배율로 확대됨.
2. **\`grid/index.html\` 상단 줌 컨트롤 누락**:
   - 상단 헤더에 \`.ui-zoom\` 마크업 및 관련 CSS가 누락되어 있어 사용자가 배율을 조작할 수 없었음.
3. **\`settings.html\` 저장 시 배율 동기화**:
   - \`settings.js\`의 \`populate()\` 및 \`persistClientSide()\`에서 \`localStorage.getItem('plcUiZoom')\`과의 연동을 강화하여 설정 저장 즉시 모든 탭에 실시간 적용되도록 보장.

**처리 내역:**
1. **\`public/monitoring.html\`**:
   - \`#trendGridContainer\`에 \`zoom: calc(1 / var(--ui-zoom, 1));\` 적용.
   - 상단 UI 및 차트는 사용자가 선택한 배율로 확대되면서 그리드는 100% 표준 좌표계로 마우스 클릭 정확도 100% 유지.
2. **\`public/grid/index.html\`**:
   - 상단 헤더에 \`.ui-zoom\` 컨트롤([−], [100%], [+]) 추가 및 \`.ui-zoom\` CSS 스타일 삽입.
   - \`#univer-container\`에 \`zoom: calc(1 / var(--ui-zoom, 1));\` 적용하여 레시피 그리드 마우스 좌표 왜곡 완벽 방지.
   - \`apply(z)\`에서 \`document.body.style.zoom = String(z)\` 및 \`(100 / z)vh\` 정상 연동.
3. **\`public/settings.js\` & \`settings.html\`**:
   - \`populate()\` 시 \`localStorage\`의 \`plcUiZoom\` 값을 우선 읽어와 표시.
   - \`persistClientSide()\` 시 \`localStorage.setItem('plcUiZoom', ...)\` 및 \`window.__setUiZoom(...)\` 즉시 호출.
   - \`#zoomPct\` 인풋 이벤트 및 다른 창에서의 변경 감지(\`storage\` 이벤트) 연동 완료.
`;

if (!content.includes('[Q-126]')) {
  content += q126;
  fs.writeFileSync(p, content, 'utf8');
  console.log('QNA.md updated with [Q-126]');
} else {
  console.log('Q-126 already present');
}
