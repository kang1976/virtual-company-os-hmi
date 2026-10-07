const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-055] Pumping 대기 중 진공하한치 변경 시 매초 즉각 알람 판정 보강 (2026-08-23)

**질문 내용:**
- "근데 왜 알람이 걸리지 않나요? 제가 진공하한치를 밸브를 전부 open하고 나고 10초 정도 후에 설정값을 -12에서 -15로 변경을 했는데 왜 알람이 걸리지 않나요?"

**원인 분석:**
1. 기존 실시간 안전 감시(\`subSeqCheckLiveSafety\`)는 PT 센서 폴링 수신 이벤트에만 의존하고 있었으며, 타이머 자체의 1초 주기(\`setInterval\`) 루프 안에서는 직접 호출되지 않았음
2. 또한 변경 전 러너 코드가 캐시된 초기 설정값을 들고 있어, 진행 도중 CONFIG에서 값을 변경해도 타이머가 도는 동안에는 조건이 즉시 재평가되지 않았음

**조치 내역 (\`public/gms-sub-sequence-runner.js\`):**
- \`subSeqStartStepCountdown\`의 1초 카운트다운 타이머 인터벌 내부에서 매초마다 최신 CONFIG 설정값(\`window.configRows\`)을 기반으로 \`subSeqEvalCondition\`을 직접 재평가하도록 로직 보강
- 이제 **Step 7 등 Pumping 대기 진행 도중 작업자가 진공하한치를 -12에서 -15로 변경하고 저장하면, 현재 HPT 압력(-14.70 psi)이 새로운 하한치(-15.00 psi)를 만족하지 못함을 1초 이내에 즉각 감지하여 \`Alarm Seq 1 (배관라인불량)\` 알람을 발생시키고 모든 밸브를 즉시 전폐(All CLOSE)** 함
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-055 appended to QNA.md');
