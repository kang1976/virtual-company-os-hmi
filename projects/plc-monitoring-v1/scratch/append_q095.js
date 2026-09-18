const fs = require('fs');
const path = require('path');

const qnaPathSrc = path.join(__dirname, '../docs/QNA.md');
const qnaPathDst = 'D:\\02. AI 작업\\PLC monitoring_01\\plc-monitoring ver1.0 - google\\docs\\QNA.md';

const appendContent = `
## [Q-095] 작업 폴더 이전 (D 드라이브) 및 파일 전수 무결성 검증 (2026-08-27)

**질문/요청 내용:**
- 작업 폴더를 \`D:\\02. AI 작업\\PLC monitoring_01\\plc-monitoring ver1.0 - google\`로 이전 완료 후 누락된 파일이 없는지 전수 검증 요청

**검증 및 조치 내역:**
1. **전체 파일 876개 전수 비교 검증:**
   - 소스코드(\`src/\`), 배관도 및 프론트엔드(\`public/\`, \`OPERATION HTML/\`), 데이터(\`data/\`), 문서(\`docs/\`), 라이브러리(\`node_modules/\`) 전수 대조.
2. **복사 중단 파일 1건 자동 복구:**
   - \`public/grid/assets/ru-v4l-ayaq-DLdM0nWP.js\` 파일의 크기가 잘려 있던 현상(65KB)을 확인하여 정상 원본(84.9KB)으로 복사 및 동기화 완료.
3. **핵심 파일 SHA-256 해시 검증 (100% 일치 확인):**
   - \`public/gms.js\`, \`public/Operation.js\`, \`public/gms.css\`, \`public/gms-diagram.svg\`, \`docs/QNA.md\`, \`data/gmsValves/unit1.json\`, \`src/server.js\`, \`package.json\` 모두 정상.
4. **문법 검사 (\`node -c\`):**
   - D 드라이브 환경에서 서버 및 클라이언트 JS 문법 검사 이상 없음(Exit 0).
`;

if (fs.existsSync(qnaPathSrc)) fs.appendFileSync(qnaPathSrc, appendContent, { encoding: 'utf8' });
if (fs.existsSync(qnaPathDst)) fs.appendFileSync(qnaPathDst, appendContent, { encoding: 'utf8' });
console.log('Q-095 appended to QNA.md in both locations');
