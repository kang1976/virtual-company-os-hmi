const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-027] 서브시퀀스 '초기화' 버튼 클릭 시 밸브 전체 Close, 누적/진행시간, 초기값/현재값 완전 리셋 처리 (2026-08-22)

**요청 내용:**
- 서브시퀀스 진행 화면에서 '초기화' 버튼을 누르면 밸브(Valve), 진행시간/누적시간, 초기값/현재값(HPT/LPT/VPT 캡처값 및 설정값)이 전부 깨끗하게 초기화된 후 처음부터 진행되도록 개선 요청

**처리 내역 (\`public/gms-sub-sequence-runner.js\`):**
1. **전 밸브(Valve) 안전 Close**:
   - 실행 중 열려있던 밸브뿐만 아니라 해당 서브시퀀스에 정의된 전체 밸브(\`data.valveTags\`)를 모두 \`CLOSE\`(\`value: false\`) 명령 전송
2. **진행시간 / 누적시간(Acc. Time) 완전 초기화**:
   - \`elapsedSec = 0\` 및 \`accTime\` 엘리먼트를 즉시 \`"누적 경과시간: 0초"\`로 리셋
   - Step 카운트다운 타이머 즉시 \`"-"\`로 초기화
3. **진행 횟수 / 진행 시간(분) (Cycle) 초기화**:
   - \`cycleCurrent = 0\`, \`cycleIterElapsedSec = 0\` 리셋 및 Cycle 패널 즉시 갱신
4. **초기값 / 현재값 / 설정값 (Capture / Setting) 초기화**:
   - \`captureValues = {}\`, \`captureTag = null\`
   - \`captureInitial\` / \`captureCurrent\` / \`settingValue\` 텍스트를 \`"-"\`로 즉시 초기화
5. **텍스트 / 알람 배너 / 재개 캐시 초기화**:
   - \`valveDiff\`, \`message\`, \`operation\`, 알람 배너, 마지막 알람 문구, \`pendingResumes\` 전부 비우고 Step 1부터 완벽하게 새로 시작
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-027 appended to QNA.md');
