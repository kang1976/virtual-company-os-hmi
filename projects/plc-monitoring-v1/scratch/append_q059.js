const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-059] 상단 대시보드 해상도/배치 최적화 및 중복 PLC Firmware Version 삭제 (2026-08-23)

**요청 내용:**
1. 해상도가 125% 확대 시 짤리는 현상 개선 및 A Side / B Side 행 배치 최적화 검토
2. \`PLC Firmware Version\` 행이 최상단 헤더(서버 연결됨 옆)에 이미 표시되므로 \`Equipment Info.\` 박스에서 중복 삭제

**조치 내역 (\`public/gms.html\`, \`public/gms.js\`, \`public/gms.css\`):**
1. **중복 항목 삭제:**
   - \`Equipment Info.\` 박스에서 \`PLC Firmware Version\` 행 제거
2. **상단 대시보드 공간 확보 및 컴팩트화:**
   - \`Equipment Info.\` 및 \`BAR CODE / IP ADDR\` 폭과 여백을 최적화하여 \`CYLINDER STEP STATUS\` 배지 영역의 가로 공간을 대폭 확보
   - 상단 바 최소 높이를 \`125px\` ➔ \`102px\`로 슬림화하여 배관도 및 우측 조작화면의 세로 작업 공간 확대
3. **A Side / B Side 배지 및 하단 버튼 행 재배치:**
   - 배지 19개가 1줄에 안정적으로 들어가도록 배지 폰트 및 패딩 미세 조정
   - \`etc\` 버튼(비상정지, 강제, PM, SETUP)과 \`tab-switch-bar\`(진행 메뉴, CONFIG, USER 등 탭 전환 버튼)를 하단 1개 행(\`.step-bottom-bar\`)으로 좌우 통합 배치하여 125% 배율에서도 스크롤 없이 시원하고 깔끔하게 표시되도록 개선
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-059 appended to QNA.md');
