const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-033] Bypass 서브시퀀스 SubStep 20 초기값/현재값 NPT 태그 매핑 누락 원인 규명 및 수정 (2026-08-22)

**요청 내용:**
- SubStep 20에서 \`초기값(NPT) : [ -- ]\`, \`현재값(NPT) : [ -- ]\`로 표시되고 실제 센서 값이 나오지 않는 원인 규명 및 수정 요청

**원인 분석:**
- 실제 PLC/시스템의 압력 센서 태그명은 Side 접미사가 붙은 \`NPT_A\` (또는 \`NPT_B\`)임
- 서브시퀀스 Cycle 열에 \`CAPTURE:NPT\`로만 기재되어 있어, 러너 엔진이 Side 접미사를 찾지 못해 \`lastPtByTag["NPT"]\`(undefined)를 참조하여 \`--\`가 출력되었음

**조치 내역:**
1. **서브시퀀스 Cycle 태그명 Side 명시 (\`data/gmsSubSequences/Bypass_v1.json\`):**
   - \`cycle: "CAPTURE:NPT_{side}"\`로 수정하여 실행 중인 Side(A측/B측)에 맞춰 \`NPT_A\` / \`NPT_B\`로 정확히 바인딩되도록 조치
2. **러너 엔진 스마트 Fallback 도입 (\`public/gms-sub-sequence-runner.js\`):**
   - \`subSeqResolvePtTag\` 함수를 추가하여, 사용자가 엑셀에서 \`CAPTURE:NPT\` 처럼 \`_{side}\`를 생략하더라도 현재 Side에 맞는 \`NPT_A\` / \`NPT_B\`를 자동으로 탐색하여 값을 매핑하도록 방어 로직 강화
3. **마스터 엑셀 갱신:** \`docs/GMS_Cylinder_Exchange_Master_Total.xlsx\` 최신화 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-033 appended to QNA.md');
