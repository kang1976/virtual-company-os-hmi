const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-037] 교환 후 +L 가압시험(AfterPlusL_v1) 서브시퀀스 분기회로, 밸브 역순 Close, 안정화/가압시험 루틴 재구성 (2026-08-23)

**요청 내용:**
- +L 가압시험 서브시퀀스에 대해:
  1. "고압 HE Leak check 라인 유무" 옵션 체크 (On: \`HPIV\` Open / Off: \`PNBV\` ➔ \`PIV\` Open)
  2. \`PGII\` Open ➔ NPT 압력범위 확인 (\`가압시험-압력하한 <= NPT <= 가압시험-압력상한\`)
  3. \`PGI\` Open ➔ HPT 압력범위 확인 (\`가압시험-압력하한 <= HPT <= 가압시험-압력상한\`)
  4. 밸브 역순 Close (\`PGI\` Close ➔ \`PGII\` Close ➔ \`HPIV/PIV/PNBV\` Close)
  5. HPT 압력 안정화 시간 루틴 Check (\`CAPTURE:HPT_{side}\`, 안정화 시간[분] 카운트)
  6. 본 가압시험 루틴 Check (\`HPT_{side}:CAPOFFSET\`, 시험 시간[분] 카운트, 압력변동기준 이탈 감시)

**처리 내역 (\`data/gmsSubSequences/AfterPlusL_v1.json\`):**
- **Step 1**: \`[ 고압 HE Leak check 라인 확인 ]\` (On: Step 1A / Off: Step 1B)
- **Step 1A (On)**: \`HPIV: O\` ➔ Step 3
- **Step 1B (Off 1단계)**: \`PNBV: O\` ➔ Step 2
- **Step 2 (Off 2단계)**: \`PIV: O\` ➔ Step 3
- **Step 3 (공통)**: \`PGII: O\` ➔ Step 4
- **Step 4**: \`[ NPT 압력범위 확인 ]\` (\`가압 시험-압력 하한 <= NPT <= 가압 시험-압력 상한\`) ➔ Step 5
- **Step 5**: \`PGI: O\` ➔ Step 6
- **Step 6**: \`[ HPT 압력범위 확인 ]\` (\`가압 시험-압력 하한 <= HPT <= 가압 시험-압력 상한\`) ➔ Step 7
- **Step 7 (역순 Close 1단계)**: \`PGI: C\` ➔ Step 8
- **Step 8 (역순 Close 2단계)**: \`PGII: C\` ➔ Step 9
- **Step 9 (역순 Close 3단계)**: \`HPIV: C, PIV: C, PNBV: C\` ➔ Step 10
- **Step 10 / 10A**: \`[ HPT 압력 안정화 시간 확인 ]\` (\`CAPTURE:HPT_{side}\`, \`HPT >= 가압 시험-압력 하한\`, 안정화 시간 카운트) ➔ Step 11
- **Step 11 / 11A**: \`[ 가압시험 진행 (압력강하 확인) ]\` (\`CAPTURE:HPT_{side}\`, \`HPT:CAPOFFSET >= -가압 시험-압력 변동 기준\`, 시험 시간 카운트) ➔ Step 15
- **Step 15**: Puls Vent 옵션 확인 (On: Step 17~23 Puls Vent 진행 / Off: Step 30 직행)
- **Step 30**: \`[ 교환 후 가압시험 Sequence Complet ]\` (완료 후 -VT 또는 4P로 진행)
- **다이어그램 산출물 생성**: \`docs/AfterPlusL_Sequence.mmd\`, \`docs/AfterPlusL_Sequence.txt\`
- **마스터 엑셀 동기화 완료**: \`docs/GMS_Cylinder_Exchange_Master_Total.xlsx\`
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-037 appended to QNA.md');
