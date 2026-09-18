const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-029] Bypass 서브시퀀스 16번 분기 -> 19번 스텝 진공유지 이동 및 초/분 단위 실시간 시간 카운트 연동 (2026-08-22)

**요청 내용:**
1. "고압 HE Leak check 라인 유무 (Bypass 밸브 분기)" 옵션이:
   - **On 일 때**: \`HPIV\` Open 후 ➔ **19번 스텝**으로 이동
   - **Off 일 때**: \`PNBV\` Open ➔ \`PIV\` Open 순차 진행 후 ➔ **19번 스텝**으로 이동
2. **19번 스텝 시간 카운트**: 다른 가압/감압 화면처럼 초/분 단위 시간이 실시간으로 흘러가도록 수정

**처리 내역:**
1. **스텝 분기 및 넘버링 재구성 (\`data/gmsSubSequences/Bypass_v1.json\`):**
   - **Step 16**: 옵션 분기 (\`고압HELeakCheck\` == \`ON\`)
   - **Step 16A (On 분기)**: \`HPIV: "O"\` ➔ \`Next Step: 19\`
   - **Step 16B (Off 분기 1단계)**: \`PNBV: "O"\` ➔ \`Next Step: 17\`
   - **Step 17 (Off 분기 2단계)**: \`PIV: "O"\` ➔ \`Next Step: 19\`
   - **Step 19 (진공유지 대기)**: \`Cycle: "CAPTURE:HPT"\`, \`Time: 60초\`, \`Next Step: 19A\`
   - **Step 19A (반복 판정)**: \`진행횟수 >= Bypass 진공유지 확인시간[분]\`, 미달 시 19 반복, 도달 시 Step 20
   - **Step 20 (완료)**: \`HPIV: "C"\`, \`PGII: "C"\`, \`PIV: "C"\`, \`PNBV: "C"\` 전 밸브 Close
2. **초/분 단위 실시간 타이머 및 캡처 연동 (\`public/gms-sub-sequence-runner.js\`):**
   - \`SUBSEQ_NS.bypass\`에 \`cycleCurrentAsTime: true\`를 활성화하여 가압시험(+L) / 감압시험(-L)과 동일하게 \`60초 후 다음 Step\` 카운트다운 및 진행시간 \`0분 15초\` 등 초 단위 실시간 흐름 적용
3. **마스터 엑셀 및 내보내기 동기화:** \`docs/GMS_Cylinder_Exchange_Master_Total.xlsx\` 갱신 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-029 appended to QNA.md');
