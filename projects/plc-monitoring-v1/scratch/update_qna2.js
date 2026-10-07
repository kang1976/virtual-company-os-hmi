const fs = require('fs');
const p = 'D:/AI_Work/Antigravity/plc-monitoring/docs/QNA.md';
let content = fs.readFileSync(p, 'utf8');

const q127 = `
## [Q-127] 스마트 팩토리 HMI 3D 모던 디자인 전면 도입 및 GMS 모니터링(gms.html) 화면 확대/축소(Zoom) 엔진 정상화 (2026-09-14)

**요청 내용:**
1. 기존의 평면적(Flat)이고 밋밋한 사각형 버튼 및 화면 스타일을 시인성과 촉각(Tactile) 피드백이 뛰어난 **3D 모던 HMI 스타일**로 전면 업그레이드 요청.
2. GMS 모니터링 화면(\`gms.html\`)에서 상단 배율 선택 시 화면 확대/축소 기능이 작동하지 않고 100%에 머무르는 현상 해결 요청.

**원인 분석 (Root Cause Analysis):**
1. **GMS 모니터링(\`gms.html\`) Zoom 미작동 원인**:
   - \`gms.html\` 내부 \`apply(z)\` 함수에서 \`document.body.style.zoom = ''\`으로 초기화된 상태로 방치되어 있어 상단 드롭다운이나 \`Ctrl+휠\`로 배율을 변경해도 실제 DOM 요소 및 배관도(SVG), 조작 패널이 확대되지 않았음.
2. **구형 Flat UI의 시인성 및 촉각 피드백 부족**:
   - 단색 배경의 1px 평면 박스 형태로 구성되어 있어 기계식 푸시 버튼의 누름감(Haptic Feedback)과 설비 상태(LED)의 시각적 구분이 부족했음.

**처리 내역:**
1. **프리미엄 3D 모던 HMI 스타일시트(\`public/theme-3d.css\`) 신설 및 전 화면 일괄 적용**:
   - **3D 물리 버튼(Tactile Buttons)**: 상단 광원 하이라이트 + 부드러운 입체 그라데이션 + \`3px\` 솔리드 베벨 그림자 적용. 클릭 시 \`translateY(2px)\` 물리적 푹 들어가는 누름 모션 구현.
   - **기능별 컬러 코딩**: Primary(사이버 블루 3D), Success(에메랄드 그린 3D), Danger(루비 레드 3D), Warn/Paused(앰버 옐로우 3D), Surface(메탈릭 실버 3D).
   - **3D 돔형 LED 램프**: 원형 점 대신 유리 돔 질감 광원 반사 + 정상 통신 시 \`ledPulse\` 네온 글로우 펄스 애니메이션 적용.
   - **3D 음각 슬롯형 탭 & 베젤형 배율 컨트롤러**: 콘솔 하드웨어 스위치 느낌의 입체 탭 구성.
   - **적용 화면**: \`index.html\`, \`monitoring.html\`, \`grid/index.html\`, \`gms.html\`, \`gms-select.html\`, \`settings.html\` 전체 6종 화면.
2. **GMS 모니터링(\`gms.html\`) 화면 확대/축소 엔진 정상화**:
   - \`apply(z)\`에 \`document.body.style.zoom = String(z)\` 및 \`height = (100 / z) + 'vh'\` 적용하여 배관도(SVG), 단계별 진행 화면, 제어 패널 전체가 지정된 배율(125%, 150%, 200% 등)로 시원하게 확대되도록 복원.
   - GMS 내부의 Univer 그리드 컨테이너(\`#gmsTrendGridContainer\`, \`#gmsUserGridContainer\`, \`#gmsWorkLogGridContainer\`, \`#gmsErrorLogGridContainer\`, \`#gmsConfigModeGridContainer\`)에 \`zoom: calc(1 / var(--ui-zoom, 1));\`을 적용하여 마우스 클릭 좌표 왜곡 0% 격리 보장.
`;

if (!content.includes('[Q-127]')) {
  content += q127;
  fs.writeFileSync(p, content, 'utf8');
  console.log('QNA.md updated with [Q-127]');
} else {
  console.log('Q-127 already present');
}
