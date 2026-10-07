const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-047] Puls Vent 설정횟수 초과 시 시퀀스 즉시 정지(STOP) 및 안전 인터록 동작 확인 (2026-08-23)

**요청 내용:**
- "알람 발생을 하면서 해당 서브 시퀀스는 STOP되어야 했다" - 알람 발생 시 시퀀스가 다음 단계로 넘어가지 않고 즉시 완전 정지(STOP)되어야 함을 지적

**동작 보장 확인:**
1. **기존 이상 현상**: 진행횟수 판정 버그로 알람이 누락되어 정지하지 않고 다음 Step(마무리 및 완료)으로 통과해 버렸음
2. **수정 후 정상 정지(STOP) 프로세스**:
   - 10회 도달 후 압력 미달 시 Step 7B(또는 Step 7)에서 \`Alarm Seq 1\` 즉시 발동
   - **타이머 즉시 중지 (\`subSeqClearTimer\`, \`subSeqStopMasterTimer\`)** ➔ 시퀀스 진행 완전 정지(STOP)
   - **열려 있는 모든 밸브 즉시 전폐 (\`subSeqCloseAllOpenValves\`)** ➔ 안전 인터록 가동
   - **실행 상태 초기화 (\`subSeqRunStates[ns] = null\`)** ➔ 다음 단계 자동 진행 원천 차단
   - 화면에 **빨간색 알람 배너** 표시 및 작업자 수동 조치 대기 상태로 유지
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-047 appended to QNA.md');
