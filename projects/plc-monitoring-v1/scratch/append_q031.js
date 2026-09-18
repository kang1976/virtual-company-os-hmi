const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-031] 고압 HE Leak check 옵션 적용(ON) 시 HPIV/PNBV/PIV 밸브가 전부 열리던 버그 원인 규명 및 수정 (2026-08-22)

**요청 내용:**
- 옵션 탭에서 '고압 HE Leak check 라인 유무'를 '적용(ON)'으로 설정했음에도 HPIV뿐만 아니라 PNBV, PIV까지 전부 다 켜지는 문제 원인 규명 및 수정 요청

**원인 분석 (2가지 치명적 원인 발견 및 조치):**
1. **서브시퀀스 러너 엔진의 \`nextStep\` 점프 로직 결함 (\`public/gms-sub-sequence-runner.js\`):**
   - Step 카운트다운 만료 시 \`condResult === true\`일 때만 \`subSeqResolveNextStepIndex\`를 평가하도록 되어 있었음
   - 조건식(\`alarmMonitoring\`)이 없는 일반 스텝(Step 16A)은 \`condResult\`가 \`null\`(조건 없음)로 판정되어, Step 16A의 \`nextStep: "19"\`가 무시되고 **다음 인덱스 행인 Step 16B(PNBV Open) ➔ Step 17(PIV Open)으로 순차 실행되어 버림**
   - **조치**: 조건식이 없거나(\`null\`) 참(\`true\`)일 때 모두 지정된 \`nextStep\`으로 정상 점프하도록 러너 엔진 수정 완료
2. **Step 15번의 선제 밸브 Open 정의 (\`data/gmsSubSequences/Bypass_v1.json\`):**
   - Step 15에 \`PNBV: "O"\`가 정의되어 있어 분기 판단(Step 16) 전에 PNBV가 이미 열려 있었음
   - **조치**: Step 15는 \`valves: {}\`로 안전 배기 완료 상태를 유지하고, \`PNBV: "O"\`는 오직 **Off 분기(Step 16B)** 에서만 열리도록 수정 완료

**결과:**
- **옵션 적용(ON)**: Step 16 ➔ Step 16A (\`HPIV\`만 Open) ➔ **Step 19로 직행** (PNBV, PIV는 절대 열리지 않음!)
- **옵션 미적용(OFF)**: Step 16 ➔ Step 16B (\`PNBV\` Open) ➔ Step 17 (\`PIV\` Open) ➔ **Step 19로 합류** (HPIV는 절대 열리지 않음!)
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-031 appended to QNA.md');
