const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-063] 상단바 높이 조절 시 메뉴 탭 버튼 가려짐 방지 최소 높이(112px) 제한 적용 (2026-08-23)

**질문/요청 내용:**
- "메뉴는 폭과 함께 움직여야지 기존처럼... 가려지면 폭 좁히는 것을 멈춰달라"

**원인 및 의도 파악:**
- 메뉴 탭(\`tab-switch-bar\`)은 상단 바 하단에 붙어서 높이 조절 시 함께 움직여야 함
- 사용자가 상단 바 높이를 위로 줄일 때, 메뉴 탭 버튼이 아래 경계선에 걸려 잘리거나 가려지지 않도록 **메뉴가 온전히 다 보이는 최소 높이(112px)에서 더 이상 좁아지지 않고 드래그가 멈추도록 리미트 보호**를 원함

**조치 내역 (\`public/gms.html\`, \`public/gms.js\`, \`public/gms.css\`):**
1. **메뉴 탭 하단 위치 원복:**
   - \`tab-switch-bar\`를 상단 바 우측 하단(\`align-self: flex-end; margin-top: auto;\`)에 배치하여 높이 조절 시 바닥을 따라 움직이도록 복원
2. **리사이징 최소 높이 안전 리미트 설정 (\`MIN_HEIGHT = 112px\`):**
   - \`gms.js\`의 \`initEquipStatusSplitter\`에서 최소 높이 제한을 \`112px\`로 설정
   - 사용자가 상단 바 구분선을 위로 드래그할 때, \`A Side\`, \`B Side\`, \`etc\` 및 \`메뉴 탭 버튼\`이 100% 온전하게 보이는 높이(\`112px\`)에 도달하면 더 이상 줄어들지 않고 딱 멈추도록 보호 조치 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-063 appended to QNA.md');
