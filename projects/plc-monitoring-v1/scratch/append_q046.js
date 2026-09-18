const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-046] Puls Vent 설정횟수(10회) 초과 시 알람 미발생 버그 원인 규명 및 수정 (2026-08-23)

**요청/질문 내용:**
- "Puls vent 현재 설정값이 횟수 설정횟수 10회 인데 진행 횟수 10되었을 때 Pulse Vent Stop (psi) 보다 압력이 큰데 왜 알람이 발생하지 않나요?"

**원인 분석:**
1. **정지 스텝 진입 시 카운터 초기화 버그**:
   - 10회 반복 후 Step 7A(또는 Step 6)에서 \`진행횟수(10) >= 설정횟수(10)\`가 참이 되어 정지 트리거 스텝인 Step 7B(또는 Step 7)로 이동함
   - 그러나 러너 엔진(\`subSeqEvalOneCondition\`)에서 "Step 번호가 바뀌면 다른 반복구간으로 판단하고 \`cycleCurrent = 0\`으로 리셋"하는 로직이 오작동하여, Step 7B 진입 시 진행 횟수가 0(➔ 1)으로 리셋되었음
   - 그 결과 Step 7B의 정지 조건식인 \`진행횟수 < 설정횟수\` (\`1 < 10\`)가 **참(True)**으로 판정되어 알람(\`Alarm Seq 1\`)이 발동하지 않고 다음 스텝(정상 완료)으로 넘어가 버렸음

**조치 내역 (\`public/gms-sub-sequence-runner.js\`):**
- **정지 트리거 스텝 전이 시 카운터 유지**:
  - 반복 검사 스텝(7A 등)에서 정지 스텝(7B 등)으로 전이될 때는 \`cycleCurrent\`를 리셋하지 않고 현재 진행횟수(10)를 온전히 보존하도록 수정
  - 이제 10회 도달 후에도 압력이 높으면 Step 7B에서 \`진행횟수(10) < 설정횟수(10)\`가 정상적으로 **거짓(False)**으로 판정되어 **\`Alarm Seq 1 (Puls Vent Fail - 설정횟수 초과)\` 알람이 정확하게 발동**함
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-046 appended to QNA.md');
