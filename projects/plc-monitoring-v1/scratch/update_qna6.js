const fs = require('fs');
const p = 'D:/AI_Work/Antigravity/plc-monitoring/docs/QNA.md';
let content = fs.readFileSync(p, 'utf8');

const q131 = `
## [Q-131] 「사이버네틱 다크(Cyber Dark)」 테마 정식 탑재 및 전 화면 레이아웃/텍스트 넘침 전수 점검 완료 (2026-09-14)

**요청 내용:**
1. 제안된 **「Velocity Grid (사이버네틱 다크 텔레메트리 대시보드)」** 스타일을 시스템의 공식 테마로 정식 추가 요청.
2. 시스템 전체 6개 화면에 대해 텍스트 깨짐, 넘침(Overflow), 버튼 크기 찌그러짐 현상이 있는지 전수 재점검 및 완벽 조치 요청.

**원인 분석 및 조치:**
1. **사이버네틱 다크(Cyber Dark) 테마 토큰 및 UI 정식 연동**:
   - \`theme-3d.css\`에 \`:root[data-theme='cyber']\` 전용 딥 네이비 배경(\`#0b0f19\`), 사이안(\`#00f0ff\`) 네온 글로우, 다크 패널(\`#131b2e\`), 3D 네온 버튼 스타일 구축.
   - \`settings.js\` 및 \`appSettings.js\`에 \`cyber\` 프리셋을 정식 등록하고, \`settings.html\`의 테마 스와치 및 상단 헤더 드롭다운에 \`[🌌 사이버 다크]\` 옵션 추가.
2. **전 화면 레이아웃 & 텍스트 오버플로우 전수 안전 가드 적용**:
   - **모달 & 팝업**: \`.mode-modal-box\`, \`.help-modal-box\`, \`.gm-modal-box\`, \`#compareResultBox\`에 \`max-width: 94vw\`, \`overflow-y: auto\` 및 다중행 카드 버튼(\`.mode-choice-btn\`, \`.gm-choice-btn\`) 높이 자동화(\`height: auto; min-height: 88px\`) 적용.
   - **툴바 & 입력 필드**: 모든 툴바 버튼에 \`white-space: nowrap\` 및 \`box-sizing: border-box\`를 적용하여 창 크기나 줌 배율이 변해도 텍스트 줄바꿈이나 버튼 깨짐이 발생하지 않도록 100% 방지.
   - **테이블 & Univer 컨테이너**: 표준 좌표계 격리 및 헤더 정렬 안정화.
`;

if (!content.includes('[Q-131]')) {
  content += q131;
  fs.writeFileSync(p, content, 'utf8');
  console.log('QNA.md updated with [Q-131]');
} else {
  console.log('Q-131 already present');
}
