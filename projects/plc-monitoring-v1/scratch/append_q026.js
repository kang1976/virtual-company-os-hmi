const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-026] Bypass 서브시퀀스 15번 스텝 완료 후 16번 스텝 '고압 HE Leak check 라인 유무' On/Off 분기 재구성 (2026-08-22)

**요청 내용:**
- 바이패스 서브시퀀스의 15번 스텝이 끝나고 16번 스텝에서 옵션 "고압 HE Leak check 라인 유무 (Bypass 밸브 분기)" 분기 처리:
  - **On (적용)**: \`HPIV\` Valve Open
  - **Off (미적용)**: \`PNBV\` Open ➔ \`PIV\` Open 순차 진행 후 합류

**처리 내역 (\`data/gmsSubSequences/Bypass_v1.json\`):**
1. **Step 1~15**: 2차측 배관 Purge 및 감압/배기 단계 완료
2. **Step 16 (옵션 분기)**:
   - \`alarmMonitoring: "고압HELeakCheck"\`, \`conditionOp: "ON"\`
   - **On 일 때** ➔ \`Next Step: 16A\` 이동
   - **Off 일 때** ➔ \`Alarm Goto: 16B\` 이동 (분기 이동, 알람 발생 없음)
3. **분기 1 (On)**:
   - **Step 16A**: \`HPIV: "O"\` (고압 HE Leak check 라인 사용) ➔ Step 17로 합류
4. **분기 2 (Off)**:
   - **Step 16B**: \`PNBV: "O"\` ➔ Step 16C로 이동
   - **Step 16C**: \`PIV: "O"\` ➔ Step 17로 합류
5. **공통 합류 및 완료 (Step 17~19)**:
   - **Step 17**: \`PGII: "O"\`
   - **Step 18/18A**: NPT/HPT 진공유지 확인 (Bypass 진공유지 확인시간[분] 카운트)
   - **Step 19**: \`HPIV: "C"\`, \`PGII: "C"\`, \`PIV: "C"\`, \`PNBV: "C"\` 전 밸브 안전 Close 및 Bypass 완료 처리
6. **마스터 엑셀 동기화:** \`docs/GMS_Cylinder_Exchange_Master_Total.xlsx\` 갱신 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-026 appended to QNA.md');
