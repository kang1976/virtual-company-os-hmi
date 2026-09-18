const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-042] 가압시험 후 Puls Vent를 독립 Status "Puls 2"로 분리 및 화면/배지/서브시퀀스 신설 (2026-08-23)

**요청 내용:**
- "가압시험후PulsVent"는 화면 전환 및 상단 배지가 별도로 구분되어야 하므로, 가압시험(\`+L\`) 시퀀스에서 분리하고 상단 배지 **\`Puls 2\`** 및 전용 화면을 신규 생성 요청

**처리 내역:**
1. **\`+L\` 가압시험 시퀀스 정리 (\`data/gmsSubSequences/AfterPlusL_v1.json\`):**
   - Step 1~11A 본 가압시험 완료 ➔ Step 12 (밸브 전체 Close) ➔ Step 13 (\`[ 교환 후 가압시험 Sequence Complet ]\` 완료 후 다음 Status인 \`Puls 2\`로 이동)
2. **신규 Status "Puls 2" 서브시퀀스 신설 (\`data/gmsSubSequences/AfterPuls_v1.json\`):**
   - Main Step: 14 (\`AfterPuls\`, ID: \`AfterPuls_v1\`)
   - Step 1 (\`PNV: O\`, VPT 체크) ➔ Step 2 (\`PNV: C\`) ➔ Step 3 (\`HPV: O\`) ➔ Step 4 (\`HPV: C\`) ➔ Step 5 (\`HPT <= Pulse Vent Stop\` 체크) ➔ Step 6 (진행횟수 체크 / 미달 시 Step 1 반복) ➔ Step 7 (초과 시 정지) ➔ Step 8 (밸브 전체 Close) ➔ Step 9 (완료 ➔ \`-VT\` 또는 \`4P\`로 이동)
3. **독립 화면 생성 (\`public/OPERATION HTML/교환후_Puls2.html\`):**
   - 상단 배지: \`3P\` ➔ \`+L\` ➔ \`Puls 2 (점멸)\` ➔ \`-VT\` ➔ \`4P\` ➔ \`PC\`
   - 설정/진행횟수 패널 및 서브시퀀스 러너 UI 장착
4. **시스템 및 화면 제어 연동 (\`public/Operation.js\`, \`public/gms.html\`, \`public/gms-sub-sequence-runner.js\`):**
   - \`CYLINDER_STEP_ORDER\`에 \`Puls 2\` 배지 추가 (\`['IDLE', 'Puls', '1P', '-L', '-VT', '2P', 'CC', 'Bypass', '3P', '+L', 'Puls 2', '-VT', '4P', 'PC', 'READY', 'Service']\`)
   - \`CYLINDER_STEP_LABELS['Puls 2'] = '가압 후 Puls'\`
   - \`STATUS_ENTRY_SCREEN_BY_TYPE['Puls 2'] = 'exchangeAfterPuls'\`
   - \`SUBSEQ_NS.afterPuls\` 러너 네임스페이스 등록
   - \`data/gmsMainSequence.json\` 및 \`data/gmsSubSequenceSelection.json\` 등록
5. **마스터 엑셀 및 다이어그램 동기화:** \`docs/GMS_Cylinder_Exchange_Master_Total.xlsx\`, \`docs/AfterPlusL_Sequence.mmd\`, \`docs/AfterPlusL_Sequence.txt\`
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-042 appended to QNA.md');
