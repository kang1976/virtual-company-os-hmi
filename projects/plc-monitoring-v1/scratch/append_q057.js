const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-057] 모든 서브시퀀스 5대 안전 운영 규칙 전수 검증 및 적용 완료 (2026-08-23)

**요청 내용:**
- 모든 서브시퀀스(감압, 가압, VT, Pumping, HP&LP Pump, 1P~4P, Puls, Bypass 등)에 대해 아래 5개 항목 전수 검증 및 반영 요청
  1. **[알람 발생 시]**: 모든 밸브 즉시 전폐 / 화면 표시값 유지 / '취소' ➔ '실행' 버튼 전환 / '실행' 클릭 시 0/- 초기화 후 Step 1부터 다시 시작
  2. **[초기화 버튼 클릭 시]**: 모든 밸브 즉시 전폐 / 모든 표시값 즉시 완전 초기화
  3. **[진행시간 동안 실시간 감시]**: 매초 실시간으로 알람 조건 계속 체크
  4. **[진행시간 완료 직후 최종 1회 추가 검증]**: 진행시간 완료 직후 전체 센서(VPT, LPT, HPT, NPT) 최종 1회 추가 검증 후 정상 시 완료 / 밸브 All CLOSE
  5. **[모든 시퀀스 시작을 할 때]**: 모든 공정 밸브 즉시 전폐 (All Valve CLOSE)

**전수 검증 및 조치 내역 (\`public/gms-sub-sequence-runner.js\`, \`data/gmsSubSequences/*.json\`):**
1. **시퀀스 시작 시 전폐 (규칙 5):**
   - \`startNamespacedSubSequenceRunner\` 시작 시점에 \`subSeqCloseAllOpenValves\`를 즉시 호출하여 시작 전 잔류 개방 밸브를 100% 강제 전폐(All CLOSE)
2. **알람 및 재시작 (규칙 1):**
   - 알람 발생 즉시 모든 밸브 전폐 및 화면 표시값(\`초기값, 현재값, 설정시간, 진행시간, 누적시간\`) 유지
   - 알람 상태에서 '실행' 클릭 시 완전 초기화 후 Step 1부터 깨끗하게 재시작
3. **초기화 버튼 (규칙 2):**
   - '초기화' 클릭 시 모든 밸브 전폐 및 모든 화면 표시값 즉시 완전 초기화(\`-\`, \`0분 00초\`, \`0초\`)
4. **매초 실시간 감시 (규칙 3):**
   - 공통 엔진 \`subSeqStartStepCountdown\`의 1초 주기 타이머 루프 내에서 최신 CONFIG 설정값을 기반으로 매초 실시간 안전 조건 재평가
5. **최종 1회 검증 (규칙 4):**
   - \`HpLpPump_v1.json\` 및 \`OneP3_v1.json\`에 \`Step 7B\`(전체 PT 센서 진공도 Check)를 표준 적용하여 진행시간 완료 직후 전체 센서 최종 1회 검증
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-057 appended to QNA.md');
