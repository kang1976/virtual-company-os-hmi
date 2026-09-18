const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-028] Bypass 서브시퀀스 엑셀 내보내기 규격 검증 및 16번 옵션 분기 정밀 점검 (2026-08-22)

**요청 내용:**
- 사용자가 웹 화면에서 "서브시퀀스 엑셀 내보내기"를 실행하여 "고압 HE Leak check 라인 유무 (Bypass 밸브 분기)" 분기가 정확히 되었는지 직접 검증할 수 있도록 엑셀 내보내기/불러오기 데이터 규격 최종 점검 및 동기화 요청

**점검 및 반영 내역:**
1. **엑셀 다단 헤더 및 열 매핑 규격 100% 검증:**
   - 4행 헤더 규격: \`S/No.\`, \`Main Step\`, \`Sub Step\`, \`Next Step\`, \`Operations\`, \`Cycle\`, \`진행방식\`, \`Ack Goto\`, \`Alarm Goto\`, \`Message at Controller\`, \`Time (Sec)\`, \`Acc,Time (Sec)\`, 밸브 열들 (\`HPIV\`, \`PNBV\`, \`PIV\`, \`PGII_{side}\` 등 16종), \`Alarm Monitoring\`, \`비교연산자\`, \`설정명(비교대상ID)\`, \`조기통과\`, \`Alarm Seq.\`, \`Alarm Message\`, \`Remarks\`
2. **Step 15 ➔ 16 옵션 분기 엑셀 행 완벽 구성:**
   - **Step 15**: \`[ 2차측 배관 Purge 완료 ]\` (\`Next Step: 16\`)
   - **Step 16**: \`[ 고압 HE Leak check 라인 확인 ]\` (\`Alarm Monitoring: 고압HELeakCheck\`, \`비교연산자: ON\`, \`Next Step: 16A\`, \`Alarm Goto: 16B\`)
   - **Step 16A (On 분기)**: \`HPIV: O\` (\`Next Step: 17\`, 고압 HE Leak check 사용)
   - **Step 16B (Off 분기 1)**: \`PNBV: O\` (\`Next Step: 16C\`)
   - **Step 16C (Off 분기 2)**: \`PIV: O\` (\`Next Step: 17\`)
   - **Step 17 (공통 합류)**: \`PGII_{side}: O\` (\`Next Step: 18\`)
   - **Step 18/18A**: NPT/HPT 진공유지 확인 (Bypass 진공유지 확인시간[분] 카운트)
   - **Step 19**: \`HPIV: C\`, \`PGII_{side}: C\`, \`PIV: C\`, \`PNBV: C\` 전 밸브 Close 및 완료
3. **내보내기 테스트:** \`Bypass_v1\` 엑셀 내보내기가 오류 없이 완벽한 엑셀 파일로 생성됨을 사전 검증 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-028 appended to QNA.md');
