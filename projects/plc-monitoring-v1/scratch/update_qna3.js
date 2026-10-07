const fs = require('fs');
const p = 'D:/AI_Work/Antigravity/plc-monitoring/docs/QNA.md';
let content = fs.readFileSync(p, 'utf8');

const q128 = `
## [Q-128] 전체 화면(F11) / 창 모드 토글 버튼 전 화면(6종) 일괄 추가 및 3D HMI 디자인 연동 (2026-09-14)

**요청 내용:**
- GMS 모니터링(\`gms.html\`) 화면 상단에 위치한 **[⛶ 전체 화면 / 🗗 창 모드]** 버튼을 다른 모든 화면(\`index.html\`, \`monitoring.html\`, \`grid/index.html\`, \`gms-select.html\`, \`settings.html\`)에도 동일하게 추가 요구.

**원인 분석 및 설계:**
- 기존에는 \`gms.html\`에만 상단 \`#fullscreenToggleBtn\`이 탑재되어 있었음.
- 산업 현장 및 제어실 환경에서 모니터링 화면을 브라우저 툴바 없이 풀스크린(F11)으로 띄우거나 창 모드로 복귀하는 조작이 모든 화면에서 동일한 위치에 제공될 필요가 있음.
- 공용 스크립트 \`appSettings.js\`에서 \`document.fullscreenElement\` 및 \`fullscreenchange\` 이벤트를 자동 감지하여 버튼 텍스트(\`⛶ 전체 화면\` ↔ \`🗗 창 모드\`)를 실시간 동기화하도록 중앙 집중화.

**처리 내역:**
1. **전체 6개 화면 상단 헤더에 \`#fullscreenToggleBtn\` 마크업 탑재**:
   - \`public/index.html\` (PLC 모니터링)
   - \`public/monitoring.html\` (트렌드 모니터링)
   - \`public/grid/index.html\` (레시피 배포 및 비교)
   - \`public/gms.html\` (GMS 밸브/공정 모니터링)
   - \`public/gms-select.html\` (GMS 장비 선택)
   - \`public/settings.html\` (환경 설정)
2. **공용 스크립트(\`appSettings.js\`) 전체화면 바인딩 로직 구축**:
   - 브라우저 Fullscreen API(\`requestFullscreen\`, \`exitFullscreen\`) 연동.
   - 키보드 \`F11\` 또는 \`Esc\`로 전체화면을 빠져나가도 버튼 상태가 즉시 갱신되도록 처리.
3. **\`public/theme-3d.css\` 스타일 적용**:
   - 3D 베벨 및 촉각 피드백 스타일을 적용하여 일관된 3D HMI 룩앤필 완성.
`;

if (!content.includes('[Q-128]')) {
  content += q128;
  fs.writeFileSync(p, content, 'utf8');
  console.log('QNA.md updated with [Q-128]');
} else {
  console.log('Q-128 already present');
}
