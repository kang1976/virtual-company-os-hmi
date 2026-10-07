const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-035] Bypass 서브시퀀스 SubStep 23(Step 21) HPT 진공하한치 & NPT 가압시험 압력하한 중복 비교 조건 반영 (2026-08-22)

**요청 내용:**
- SubStep 23(Step 21) HPT 진공유지 확인 단계에서, 기존 HPT 진공하한치뿐만 아니라 \`NPT > 가압 시험-압력 하한\` 조건도 동시에 만족해야 하는 중복 조건(\`&\`) 반영 요청

**처리 내역 (\`data/gmsSubSequences/Bypass_v1.json\`):**
1. **중복 비교 조건 설정 (SubStep 23 / Step 21):**
   - \`alarmMonitoring: "HPT_{side} & NPT_{side}"\`
   - \`conditionOp: "<= & >"\`
   - \`conditionValue: "진공하한치_{side} & 가압 시험-압력 하한_{side}"\`
   - \`alarmMessage: "PGI Valve bypass 의심 - HPT 진공유지 또는 NPT 압력 불량"\`
2. **동작 원리:**
   - 60초 대기 중 및 실시간 감시 시:
     - \`HPT_{side} <= 진공하한치_{side}\` (HPT 진공 유지 확인)
     - **AND** \`NPT_{side} > 가압 시험-압력 하한_{side}\` (NPT 질소 공급 가압 상태 확인)
     - 두 조건이 모두 충족될 때만 정상 통과하며, 둘 중 하나라도 이탈 시 Alarm Seq. 1(안전 차단 및 정지) 발동
3. **마스터 엑셀 및 내보내기 동기화:** \`docs/GMS_Cylinder_Exchange_Master_Total.xlsx\` 최신화 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-035 appended to QNA.md');
