const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-014] Mermaid 파일 포맷(.mmd vs .txt) 차이 및 향후 다이어그램 제공 표준 규칙 수립 (2026-08-22)

**요청 내용:**
- \`cylinder_flowchart.mmd\`와 \`cylinder_flowchart.txt\`의 차이점 설명 요청
- 앞으로 Mermaid Flow 요청 시 어떤 표준 규칙으로 제공할 것인지 프로토콜 수립 요청

**처리 내역:**
1. **파일 확장자 차이 정의:**
   - \`.mmd\` (Mermaid Document): VS Code 확장(Mermaid Previewer) 및 CLI 툴에서 실시간 그래픽 렌더링 및 문법 강조 지원
   - \`.txt\` (Plain Text): 윈도우 메모장 등 기본 편집기에서 즉시 열어 간편하게 복사(\`Ctrl+A\` ➔ \`Ctrl+C\`) 가능한 범용 포맷
   - 두 파일의 내부 소스 코드는 100% 동일함
2. **향후 Mermaid 다이어그램 제공 표준 프로토콜 확립:**
   - **1) 채팅창 실시간 그래픽 렌더링**: 즉시 직관적으로 흐름을 확인할 수 있도록 출력
   - **2) 복사용 전용 파일 자동 생성**: \`docs/<파일명>.mmd\` (및 \`.txt\`) 파일 생성 후 바로가기 링크 제공
   - **3) 프로젝트 마스터 문서 자동 반영**: \`docs/PROJECT_MASTER_PDCA.md\` 및 \`docs/QNA.md\` (\`[Q-xxx]\`)에 설계 사유와 함께 영구 보존
   - **4) UTF-8 인코딩 무결성 준수**: 한글 깨짐 방지
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-014 appended to QNA.md');
