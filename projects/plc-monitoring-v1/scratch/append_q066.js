const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-066] GSP 1단계 W/I 표기를 WI_A/WI_B로 수정 및 OPTION 태그 연동 / 0.00kg 정상 표시 (2026-08-23)

**질문/요청 내용:**
- "W/I_A를 WI_A로 수정을 해주고 옵션과 연결.. 값이 0.00kg인데 표시는 --kg으로 나오는 부분도 수정 바랍니다."

**원인 분석:**
- 라벨 표기가 \`W/I_A\`로 되어 있었고, 데이터 조회 키가 서버 및 OPTION 등록 태그명(\`WI_A\`, \`WI_B\`)과 불일치하여 무게 계측값이 전달되지 못하고 \`--\`로 표시되었음

**조치 내역 (\`public/OPERATION HTML/가스공급_압력확인.html\`, \`public/Operation.js\`):**
1. **라벨 명칭 수정:** \`W/I_A :\` ➔ \`WI_A :\` (B측 진입 시 \`WI_B :\`)
2. **OPTION 탭 연동 정확화:** \`isAnalogTagEnabled('WI_' + side)\`를 통해 OPTION 탭의 \`WI_A (Weight)\` / \`WI_B (Weight)\` 토글과 정확히 1:1 매칭
3. **실시간 계측값 정상 표시:** \`lastPtByTag['WI_' + side]\`를 바인딩하여 \`0.00 kg\`이 온전하게 표시되도록 조치 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-066 appended to QNA.md');
