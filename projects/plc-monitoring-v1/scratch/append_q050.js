const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-050] HP&LP Pump 시퀀스 완료 시 전체 PT 센서 진공하한치 도달 검증(Step 7B) 추가 (2026-08-23)

**요청 내용:**
- "HP&LP Pump 시퀀스에서 진행시간 완료될 때까지 PT 센서 전부 진공하한치 이하가 안 되면 알람을 띄어야 합니다."

**조치 내역 (\`data/gmsSubSequences/HpLpPump_v1.json\`):**
1. **진행시간 판정 스텝(Step 7A) 분기 변경:**
   - \`진행시간 >= PUMPING 시간[분]\` 도달 시 바로 밸브를 닫지 않고 신규 검증 스텝인 **\`Step 7B\`**로 전이
2. **전체 PT 센서 진공도 최종 검증 스텝(Step 7B) 신설:**
   - **스텝 내용**: \`[전체 PT 센서 진공도 Check]\` (2초)
   - **검사 조건식**: \`VPT & LPT_{side} & HPT_{side} & NPT_{side} <= 진공하한치_{side}\` (4개 센서 전체 AND 조건)
   - **판정 결과**:
     - **정상(전부 진공하한치 이하)**: Step 8(밸브 역순 차단 ➔ 완료)로 진행
     - **이상(하나라도 진공하한치 초과)**: 즉시 **\`Alarm Seq 1 (배관진공 불량 - PT 진공하한치 미달)\`** 알람 발생 및 시퀀스 안전 완전 정지(STOP)
3. **마스터 엑셀 동기화:** \`docs/GMS_Cylinder_Exchange_Master_Total.xlsx\` 빌드 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-050 appended to QNA.md');
