const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-019] GMS 상하 프레임 스플리터 조절 시 상단 탭 메뉴(진행메뉴/CONFIG/OPTION 등) 잘림 및 숨김 현상 개선 (2026-08-22)

**요청 내용:**
- 프레임 상하 조절 시 상단에 있는 탭 메뉴가 같이 움직이지 않아 아래로 가려지거나 숨겨지는 문제 조치 요청

**원인 분석:**
- 상단 상태 바(\`.equip-status-bar\`)의 최소 높이가 \`90px\`로 너무 낮게 설정되어 있었고, 스플리터 바를 위로 줄였을 때 \`overflow: hidden;\`으로 인해 맨 하단에 위치한 탭 메뉴 바(\`.tab-switch-bar\`)가 아래로 잘려나가는 현상 발생

**처리 내역:**
1. **CSS 레이아웃 및 탭 메뉴 고정 (\`public/gms.css\`):**
   - \`.equip-status-bar\`에 \`min-height: 125px\` 지정
   - \`.cyl-step-box\`를 \`justify-content: space-between\`으로 개선
   - \`.tab-switch-bar\` 및 버튼에 \`flex-shrink: 0\`, \`margin-top: auto\`를 적용하여 상하 높이 축소 시에도 찌그러지거나 잘리지 않고 온전하게 노출 보장
2. **자바스크립트 스플리터 하한선 안전 가드 (\`public/gms.js\`):**
   - \`initEquipStatusSplitter\`의 최소 높이 제한을 \`90px\` ➔ \`130px\`로 상향
   - 과거에 저장된 로컬스토리지 높이(\`gmsEquipStatusBarHeight\`)가 130px 미만일 경우 자동으로 최소 130px 이상으로 보정하도록 방어 코드 적용 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-019 appended to QNA.md');
