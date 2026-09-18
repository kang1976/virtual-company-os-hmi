const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-072] Operation.js 내 함수 구문 오류 수정 및 F5 로드 정상화 (2026-08-23)

**질문/요청 내용:**
- "F5를 눌렀는데 왜 이런 화면으로 이동을 하여 멈추나" (조작화면 패널이 빈 상태로 멈춤)

**원인 분석:**
- 이전 코드 교체 과정에서 \`showProgressHeater()\` 함수의 닫는 중괄호(\`}\`)가 누락되어 JavaScript SyntaxError가 발생함
- 이로 인해 스크립트 실행이 중단되어 페이지 로드 시 조작화면이 초기화되지 않고 멈춤 현상이 발생하였음

**조치 내역 (\`public/Operation.js\`):**
1. \`showProgressHeater()\` 함수 구문 완전 복구
2. \`node -c\`를 통해 \`Operation.js\`, \`gms.js\`, \`gms-sub-sequence-runner.js\` 전체 스크립트 문법 무결성 검증 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-072 appended to QNA.md');
