const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-030] Bypass 서브시퀀스 원본 1~15번 스텝 100% 원상 복원 및 16번 분기/19번 이동 정밀 정렬 (2026-08-22)

**요청 내용:**
- Bypass 1~15번 스텝을 기존 원본 데이터 그대로 100% 보존하고 건드리지 않도록 복원 요청

**처리 내역 (\`data/gmsSubSequences/Bypass_v1.json\`):**
1. **1~15번 스텝 원본 100% 복원**:
   - Step 1: \`[ Bypass - 2차측 Purge Mode ]\`
   - Step 2: \`PNV: O\` (VPT 진공 Check)
   - Step 3: \`LPV: O\` (LPT 진공 Check)
   - Step 4: (HPT 진공 Check)
   - Step 5: \`HPI: O\`
   - Step 6: \`HPV: O\` (NPT 진공 Check)
   - Step 7: \`PGI: O\` (전체 진공 Check)
   - Step 8: \`PGII: O\`
   - Step 9: \`PGII: C\`
   - Step 10: \`PGI: C\`
   - Step 11: \`HPV: C\`
   - Step 12: \`HPI: C\`
   - Step 13: \`LPV: C\`
   - Step 14: \`PNV: C\`
   - Step 15: \`PNBV: O\` (Purge N2 공급 Check)
2. **15번 이후 분기 구조 유지**:
   - **Step 16**: 옵션 분기 (\`고압HELeakCheck\` == \`ON\`)
   - **Step 16A (On 분기)**: \`HPIV: O\` ➔ **Step 19** 이동
   - **Step 16B (Off 분기 1)**: \`PNBV: O\` ➔ **Step 17** 이동
   - **Step 17 (Off 분기 2)**: \`PIV: O\` ➔ **Step 19** 이동
   - **Step 19**: HPT 진공유지 확인 (\`CAPTURE:HPT\`, 60초 단위 실시간 초/분 흐름)
   - **Step 19A**: 진행시간 카운트 판정
   - **Step 20**: Bypass 완료 및 전 밸브 Close
3. **마스터 엑셀 및 내보내기 동기화 완료:** \`docs/GMS_Cylinder_Exchange_Master_Total.xlsx\`
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-030 appended to QNA.md');
