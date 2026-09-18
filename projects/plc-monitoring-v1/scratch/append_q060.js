const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-060] 전체 화면 전환 버튼 추가, etc 행 수직 일렬 정렬 및 상단바/조작패널 슬림화 (2026-08-23)

**요청 내용:**
1. 전체 화면을 한 번에 볼 수 있는 버튼 추가 요청
2. 상단 \`etc\` 버튼 영역을 \`B Side\` 바로 밑(세로 정렬)에 배치 요청
3. 상단행 리사이징 시 높이 제한(리미트)으로 더 좁히지 못하는 현상 개선 및 서브시퀀스 조작화면에 스크롤바가 생기지 않도록 최적화

**조치 내역 (\`public/gms.html\`, \`public/gms.js\`, \`public/gms.css\`):**
1. **전체 화면 전환 버튼 (\`#fullscreenToggleBtn\`):**
   - 상단 헤더 배율 조절 컨트롤 우측에 \`⛶ 전체 화면\` 토글 버튼 추가 (클릭 시 브라우저 Fullscreen API 구동, 전환 시 \`🗗 창 모드\`로 상태 자동 변경)
2. **\`etc\` 행 수직 일렬 정렬:**
   - \`etc\` 라벨 폭을 \`A Side\`, \`B Side\`와 동일한 \`44px\`로 일치시켜 \`B Side\` 바로 밑에 깔끔하게 수직 일렬 정렬 완료
   - 탭 전환 버튼 묶음(\`tab-switch-bar\`)은 행의 오른쪽 끝으로 자동 밀착 정렬
3. **상단바 높이 리사이징 리미트 완화 & 조작패널 컴팩트화:**
   - \`gms.js\`의 \`initEquipStatusSplitter\` 최소 높이 리미트를 \`130px\` ➔ \`65px\`로 대폭 완화하여 사용자가 원하는 만큼 상단 바를 슬림하게 줄일 수 있도록 개선
   - 조작 패널(\`.op-panel\`) 및 가스공급/서브시퀀스 진행 화면 내부의 패딩, 버튼 마진, 폰트 크기를 컴팩트하게 조정하여 125% 확대 배율에서도 세로 스크롤바 없이 100% 한눈에 들어오도록 최적화 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-060 appended to QNA.md');
