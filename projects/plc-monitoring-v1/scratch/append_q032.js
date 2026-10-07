const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-032] Bypass 서브시퀀스 SubStep 20(Step 19) NPT 초기값 캡처 및 실시간 현재값 변화량 모니터링 반영 (2026-08-22)

**요청 내용:**
- Bypass 서브시퀀스 SubStep 20번(Step 19)에서 NPT 압력값을 초기값으로 캡처/저장하고, 현재값은 실시간으로 변화량을 확인할 수 있도록 화면 및 엑셀 시트 수정, 매뉴얼 문서 업데이트 요청

**처리 내역:**
1. **서브시퀀스 Step 데이터 수정 (\`data/gmsSubSequences/Bypass_v1.json\`):**
   - SubStep 20 (Step 19): \`operation: "[ NPT 진공유지 확인 ]"\`, \`cycle: "CAPTURE:NPT"\`, \`alarmMonitoring: "NPT_{side}"\`, \`conditionOp: "<="\`, \`conditionValue: "진공하한치_{side}"\`
   - Step 진입 즉시 \`NPT_{side}\` 압력값이 초기값에 캡처 저장되고, 현재값은 1초 주기로 실시간 갱신되어 변화량 확인 가능
2. **화면 UI 레이블 업데이트 (\`public/OPERATION HTML/시퀀스_Bypass.html\`):**
   - \`초기값(HPT)\` ➔ \`초기값(NPT)\`, \`현재값(HPT)\` ➔ \`현재값(NPT)\`로 텍스트 명칭 변경
3. **마스터 엑셀 및 매뉴얼 문서 갱신:**
   - \`docs/GMS_Cylinder_Exchange_Master_Total.xlsx\` 최신화 완료
   - \`docs/GMS_SUBSEQUENCE_EXCEL_GUIDE.md\` 및 \`docs/GMS_SubSequence_Total_기능_예시_메뉴얼.md\`에 Bypass Step 19 \`CAPTURE:NPT\` 가이드 반영 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-032 appended to QNA.md');
