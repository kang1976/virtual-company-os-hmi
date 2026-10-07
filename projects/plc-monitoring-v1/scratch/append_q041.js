const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-041] 교환 후 +L 가압시험 내 Puls Vent 미니시퀀스 구조를 Main 2 Puls_v1 7번 스텝 규격으로 재구성 (2026-08-23)

**요청 내용:**
- +L 가압완료 후 Puls Vent 미니시퀀스를 \`Main 2 Puls_v1\` 구조와 일치하도록:
  1. \`PNV\` Open ➔ \`PNV\` Close
  2. \`HPV\` Open ➔ \`HPV\` Close
  3. 이후 \`Main 2 Puls_v1\`의 7번 Step(\`HPT <= Pulse Vent Stop (psi)\` 확인 ➔ \`진행횟수 >= Puls vent 설정횟수\` 반복 판정 ➔ 완료)과 완전히 동일한 로직으로 수정 요청

**처리 내역 (\`data/gmsSubSequences/AfterPlusL_v1.json\`):**
- **Step 15**: Puls Vent 옵션 확인 (On ➔ Step 17 / Off ➔ Step 30)
- **Step 17**: \`PNV: O\` (VPT 진공확인, \`VPT <= 진공하한치\`, 반복 진입점)
- **Step 18**: \`PNV: C\` (Pump 배관 진공 Check)
- **Step 19**: \`HPV: O\` (HPV Valve Open)
- **Step 20**: \`HPV: C\` (HPV Valve Close)
- **Step 21 (Puls_v1 Step 7 동일)**: \`[ 배관내 잔류 가스 Check ]\` (\`HPT <= Pulse Vent Stop (psi)\`, 참 ➔ Step 30 완료 / 거짓 ➔ Step 21A)
- **Step 21A (Puls_v1 Step 7A 동일)**: \`[ Pulse Vent 진행 횟수 Check ]\` (\`진행횟수 >= Puls vent 설정횟수\`, 참 ➔ Step 21B 정지 / 거짓 ➔ Step 17로 되돌아가 반복)
- **Step 21B (Puls_v1 Step 7B 동일)**: \`[ Puls Vent 설정횟수 초과 ]\` (정지 전용 Step, Alarm Seq 1 발동)
- **Step 30**: \`[ 교환 후 가압시험 Sequence Complet ]\` (완료 후 -VT 또는 4P로 자동 진행)
- **마스터 엑셀 및 다이어그램 동기화:** \`docs/GMS_Cylinder_Exchange_Master_Total.xlsx\`, \`docs/AfterPlusL_Sequence.mmd\`, \`docs/AfterPlusL_Sequence.txt\`
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-041 appended to QNA.md');
