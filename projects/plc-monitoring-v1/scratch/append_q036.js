const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-036] Bypass 서브시퀀스 마지막 완료 Step 밸브 Close 해제(Open 상태 유지) 변경 (2026-08-23)

**요청 내용:**
- Bypass 완료(SubStep 25 / Step 22) 시 All Valve Close 하지 않고, 현재 열려있는 Valve Open 상태를 그대로 유지한 채 후속 +L 가압 Check 서브시퀀스로 연결되도록 변경 요청

**처리 내역 (\`data/gmsSubSequences/Bypass_v1.json\`):**
1. **SubStep 25 (Step 22) 밸브 유지 설정:**
   - 기존: \`valves: { "HPIV": "C", "PGII_{side}": "C", "PIV": "C", "PNBV": "C" }\` (All Close)
   - 변경: **\`valves: {}\` (현재 열린 밸브 Open 상태 그대로 보존)**
   - \`message: "Bypass 시퀀스가 완료되었습니다(현재 밸브 상태 유지)."\`
   - \`remarks: "Bypass 완료 후 현재 Valve Open 상태 유지한 채 다음 Status로 진행"\`
2. **마스터 엑셀 및 내보내기 동기화 완료:** \`docs/GMS_Cylinder_Exchange_Master_Total.xlsx\`
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-036 appended to QNA.md');
