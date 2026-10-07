const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-061] Cylinder Step Status 내 etc 행 B Side 직하단 고정 배치 및 탭 메뉴 분리 (2026-08-23)

**요청 내용:**
- "\`etc\`는 \`B Side\` 바로 아래 행으로 딱 붙여서 배치해 주세요. 함께 움직이는 것이 아니며, \`Cylinder Step Status\`의 고유 항목입니다."

**조치 내역 (\`public/gms.html\`, \`public/gms.css\`):**
1. **\`Cylinder Step Status\` 그룹화 구조 확립 (\`.cyl-step-status-group\`):**
   - \`A Side\` 행, \`B Side\` 행, \`etc\` 행을 하나의 \`.cyl-step-status-group\`으로 묶어 \`B Side\` 바로 밑에 \`etc (비상정지/강제/PM/SETUP)\`가 완벽하게 일렬로 밀착 배치되도록 개선
2. **탭 전환 바(\`.tab-switch-bar\`) 독립 배치:**
   - 우측 하단 탭 메뉴는 \`margin-top: auto\`로 상단 바 우측 바닥에 독립적으로 정렬되어, 상단 바 높이를 조절하더라도 \`A Side / B Side / etc\`의 밀착 배치가 흐트러지지 않도록 분리 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-061 appended to QNA.md');
