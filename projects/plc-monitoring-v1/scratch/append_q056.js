const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-056] 전 시퀀스(감압/가압/VT/Pumping/HP&LP Pump 등) 1초 주기 타이머 실시간 안전 감시 전수 적용 및 검증 (2026-08-23)

**요청 내용:**
- "매 1초 카운트다운 타이머 인터벌 내 즉시 감시 추가는 현재 전체 시퀀스(감압, 가압, VT, Pumping, HP&LP Pump 등) 시간이 카운트 되는 모든 시퀀스에 해당 조건이 전부 반영이 되었는지 전부 확인하시고 검증 바랍니다."

**전수 검증 및 적용 내역 (\`public/gms-sub-sequence-runner.js\`):**
1. **공통 엔진 레벨 표준화 (\`subSeqStartStepCountdown\`):**
   - 모든 서브시퀀스(감압시험, 가압시험, VT 감압시험, Pumping, HP&LP Pump, 1P~4P 배관청소, Bypass, 조정모드 등)의 시간 카운트다운을 담당하는 핵심 함수에 전면 적용
   - **스텝 진입 시점(0초)**: 진입 즉시 1차 안전 조건(\`alarmMonitoring\`, \`conditionOp\`, \`conditionValue\`) 검증
   - **카운트다운 중(매 1초 주기)**: \`setInterval\` 루프 내에서 최신 \`CONFIG\` 설정값 및 실시간 압력 센서(\`lastPtByTag\`)를 바탕으로 매초 즉각 재평가
2. **시퀀스별 적용 효과:**
   - **감압시험 (-L)**: 안정화 및 시험 시간 동안 \`HPT <= 진공하한치\` 매초 실시간 감시
   - **가압시험 (+L)**: 압력범위 확인 및 가압 누출 시험 중 \`HPT:CAPOFFSET >= -가압 시험-압력 변동 기준\` 매초 실시간 감시
   - **VT 감압시험 (-VT)**: 안정화 및 VT 누출 시험 중 \`VPT:CAPOFFSET <= VT 누출 압력 변동 기준\` 매초 실시간 감시
   - **Pumping & HP&LP Pump**: 60초 Pumping 대기 중 \`HPT <= 진공하한치\` 매초 실시간 감시 및 완료 시 전체 PT 센서 검증
   - **기타 배관청소/퍼지**: 카운트다운 중 압력 상하한 및 인터록 조건 매초 실시간 감시
3. **결과**: 시간이 카운트되는 모든 시퀀스의 모든 스텝에서 진행 도중 CONFIG 값을 변경하거나 센서 압력이 기준을 벗어나는 즉시 **1초 이내에 알람이 발생하여 전 밸브가 전폐(All CLOSE)** 됨
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-056 appended to QNA.md');
