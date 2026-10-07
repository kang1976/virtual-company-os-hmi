const fs = require('fs');
const p = 'D:/AI_Work/Antigravity/plc-monitoring/docs/QNA.md';
let content = fs.readFileSync(p, 'utf8');

const q130 = `
## [Q-130] GMS 진입 모드 선택 모달(.mode-choice-btn) 버튼 텍스트 깨짐 및 높이 제한 해제 (2026-09-14)

**요청 내용:**
- GMS 장비 선택 화면(\`gms-select.html\`)에서 장비 클릭 시 나타나는 **「진입 모드 선택」 팝업창의 모니터링 Mode / Operation Mode 버튼 텍스트가 버튼 밖으로 넘치며 깨지는 현상** 해결 요청.

**원인 분석 (Root Cause Analysis):**
- 3D 스타일시트(\`theme-3d.css\`)에서 툴바 및 헤더 버튼 높이를 일괄 \`height: 30px\`로 지정하는 범용 규칙에 \`.mode-choice-btn\`(제목+설명문 2~3줄 카드형 버튼)이 포함되어, 버튼 높이가 강제로 30px로 찌그러지면서 내부 글자들이 위아래로 삐져나오는 오버플로우 현상이 발생함.

**처리 내역:**
1. **다중행 카드 버튼(.mode-choice-btn, .gm-choice-btn) 전용 3D 스타일 분리**:
   - 단일행 툴바 버튼 높이 목록에서 \`.mode-choice-btn\`을 완전히 분리.
   - \`height: auto !important; min-height: 86px !important;\` 지정 및 \`flex-direction: column\`, \`padding: 14px 16px\`로 텍스트가 완벽하게 감싸지도록 처리.
   - 내부 \`.mode-choice-title\`(15px bold)과 \`.mode-choice-desc\`(12px)의 대비 및 3D 입체 음영을 복원하여 가독성 100% 확보.
`;

if (!content.includes('[Q-130]')) {
  content += q130;
  fs.writeFileSync(p, content, 'utf8');
  console.log('QNA.md updated with [Q-130]');
} else {
  console.log('Q-130 already present');
}
