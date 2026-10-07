const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-052] 전 시퀀스 알람 전폐·값 유지 및 초기화/진행시간 검증 표준 규칙 확립 (2026-08-23)

**요청 내용:**
1. "알람이 걸리면 모든 밸브는 전부 닫힌다. 초기값 / 현재값 / 설정시간 / 지연 시간 유지 >> 실행을 누르면 전부 초기화 하고 다시 시작"
2. "초기화 버튼을 누르면 전부 닫힌다. 초기값 / 현재값 / 설정시간 / 지연 시간 초기화"
3. "모든 시퀀스에 전부 적용이 되어야 함."
4. "진행시간에 알람조건은 계속 체크를 해야 함....다끝난 직후는 최종 한번더 체크하고 완료 한다"

**조치 내역 (\`public/gms-sub-sequence-runner.js\`, \`data/gmsSubSequences/HpLpPump_v1.json\`):**
1. **알람 발생 시 동작 표준화:**
   - 모든 밸브 즉시 All CLOSE (\`subSeqCloseAllOpenValves\`)
   - 화면의 \`초기값\`, \`현재값\`, \`설정시간\`, \`진행시간\`, \`누적시간\`을 리셋하지 않고 정지 시점 상태 그대로 유지
   - 알람 배너 표출 및 취소 버튼이 '실행' 버튼으로 자동 전환
   - 알람 상태에서 '실행' 버튼 클릭 시 모든 값을 0/- 로 초기화하고 Step 1부터 깨끗하게 재시작
2. **초기화 버튼 동작 표준화:**
   - 모든 밸브 즉시 All CLOSE
   - \`초기값(-)\`, \`현재값(-)\`, \`진행시간(0분 00초/0)\`, \`누적시간(0초)\`, \`타이머(-)\` 등 모든 패널 UI를 즉시 완전 초기화 후 Step 1부터 시작
3. **HP&LP Pump 시퀀스 구조 표준화:**
   - Step 2~6: 조기 2초 알람 제거 ➔ \`PNV ➔ LPV ➔ HPI ➔ HPV ➔ PGI ➔ PGII\` 순차 개방
   - Step 7: 60초 Pumping 대기 중 실시간 HPT 안전 감시 (\`CAPTURE:HPT_{side}\`)
   - Step 7A: 진행시간(분) 도달 시 \`Step 7B\`로 이동
   - Step 7B: 진행시간 종료 직후 \`VPT & LPT & HPT & NPT <= 진공하한치\` 전체 PT 센서 최종 1회 추가 검증 ➔ 이상 시 즉시 All CLOSE 알람, 정상 시 Step 8(정상 완료) 진행
4. **마스터 엑셀 동기화:** \`docs/GMS_Cylinder_Exchange_Master_Total.xlsx\` 빌드 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-052 appended to QNA.md');
