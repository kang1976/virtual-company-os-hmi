const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-058] 엑셀(.xlsx) 바이너리 에디터 뷰어 깨짐 현상 안내 및 UTF-8 BOM CSV 자동 생성 규칙 수립 (2026-08-23)

**질문/요청 내용:**
- "\`docs/GMS_Cylinder_Exchange_Master_Total.xlsx\` 글씨가 전부 깨짐.. 이 부분도 규칙에 넣어줘"

**원인 분석:**
- \`.xlsx\` 파일은 마이크로소프트 엑셀 전용 **바이너리 ZIP 압축 포맷**입니다. 따라서 VS Code나 텍스트 에디터에서 텍스트 파일로 열면 \`PK...\` 형태의 바이너리 코드가 깨진 문자처럼 표시됩니다. (Microsoft Excel 프로그램이나 VS Code 확장 프로그램인 'Excel Viewer'로 열면 정상적인 엑셀 표로 표시됨)

**조치 내역 및 영구 표준 규칙 수립 (\`scratch/build_master_excel.js\`):**
1. **UTF-8 with BOM 마스터 CSV 자동 동기화 규칙 수립:**
   - 마스터 엑셀 빌드 시 \`.xlsx\` 파일뿐만 아니라, 에디터 및 텍스트 뷰어에서 한글 깨짐 없이 바로 열어볼 수 있는 **\`docs/GMS_Cylinder_Exchange_Master_Total.csv\`** (UTF-8 with BOM)를 항상 100% 자동 동시 생성하도록 빌드 규칙 확립
2. **개별 서브시퀀스 CSV 생성 (\`docs/csv_subsequences/*.csv\`):**
   - 각 서브시퀀스별로 에디터에서 바로 열어보고 편집할 수 있는 개별 CSV 파일 묶음도 함께 자동 빌드 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-058 appended to QNA.md');
