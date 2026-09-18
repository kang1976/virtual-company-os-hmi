const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-038] 설정값(CONFIG) 테이블에 "가압 시험-압력 변동 기준" 항목 추가 (2026-08-23)

**요청 내용:**
- 설정모드/CONFIG 테이블에 +L 본 가압시험(Step 11)에서 사용하는 "가압 시험-압력 변동 기준" 설정값 추가 요청

**처리 내역 (\`data/gmsSubSequenceConfig.json\`):**
1. **A측/B측 설정 항목 등록:**
   - **A측**:
     - 구분: \`설정값\`
     - 설정명: \`가압 시험-압력 변동 기준_A\`
     - ID: \`pressureTestVariationLimit_A\`
     - 기본값: \`0.5\` (단위: \`PSI\`)
     - 설명: \`[적용 공정] Main 13(AfterPlusL_v1) 교환 후 +L 본 가압시험 단계(Step 11) | [판정 기준] HPT_A 압력 강하폭 <= 설정값(PSI) (초기값 대비 압력 강하가 기준치 이내 유지) | [알람/분기] 기준 초과 하락 시 Alarm Seq 1 발동(가압시험 FAIL 및 밸브 CLOSE).\`
     - 측: \`A\`
   - **B측**:
     - 구분: \`설정값\`
     - 설정명: \`가압 시험-압력 변동 기준_B\`
     - ID: \`pressureTestVariationLimit_B\`
     - 기본값: \`0.5\` (단위: \`PSI\`)
     - 설명: \`[적용 공정] Main 13(AfterPlusL_v1) 교환 후 +L 본 가압시험 단계(Step 11) | [판정 기준] HPT_B 압력 강하폭 <= 설정값(PSI) (초기값 대비 압력 강하가 기준치 이내 유지) | [알람/분기] 기준 초과 하락 시 Alarm Seq 1 발동(가압시험 FAIL 및 밸브 CLOSE).\`
     - 측: \`B\`
2. **마스터 엑셀 및 설정 테이블 동기화 완료:** \`docs/GMS_Cylinder_Exchange_Master_Total.xlsx\`
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-038 appended to QNA.md');
