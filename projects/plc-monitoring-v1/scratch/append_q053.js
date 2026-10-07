const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-053] Pumping 진행시간 분·초 중복 가산 표시 오류(3분 표기 버그) 수정 (2026-08-23)

**요청/질문 내용:**
- "설정시간은 2분인데 왜 3분 때 체크 되나요?" - 설정시간이 2분인데 최종 체크 단계(Step 7B)에서 진행시간이 \`3분 00초\`로 표시되는 문제 수정 요청

**원인 분석:**
- 실제 공정 동작 시간은 Step 7을 2회(60초 x 2 = 120초) 정확히 수행하여 누적시간 \`138초\`(사전 밸브 개방 11초 + 120초 + Step 7A 2초 + Step 7B 2초)가 소요되어 정상적으로 2분이 흐른 상태였음
- 그러나 진행시간 UI 렌더링 함수(\`subSeqRenderCycleStatus\`)에서 완료된 분(\`cycleCurrent\` = 2분)에 직전 60초 대기 스텝의 초 누적 변수(\`cycleIterElapsedSec\` = 60초)가 초기화되지 않고 그대로 더해져 \`2분 + 60초 = 3분 00초\`로 과다 계산되어 표시되었음

**조치 내역 (\`public/gms-sub-sequence-runner.js\`):**
1. \`subSeqRenderCycleStatus\`: 대기 스텝이 아닌 판정/검증 스텝(Step 7A, 7B 등)에서는 완료된 분(\`rt.cycleCurrent * 60\`)만을 정확하게 표시하도록 분리
2. \`subSeqStartStepCountdown\`: 대기 스텝(60초) 타이머 만료 시 \`cycleIterElapsedSec\`를 즉시 0으로 리셋하여 초 누적분이 다음 스텝에 중복 가산되지 않도록 조치 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-053 appended to QNA.md');
