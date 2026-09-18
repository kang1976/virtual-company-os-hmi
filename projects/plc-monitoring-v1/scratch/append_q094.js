const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-094] PLC 모니터링 서버 재시작 위치 및 터미널 명령어 안내 (2026-08-24)

**질문/요청 내용:**
- 서버를 재시작하려면 터미널 어디서 어떤 명령어를 넣어야 하는지 안내

**안내 내용:**
1. **작업 폴더 위치:**
   \`\`\`
   C:\\Users\\rokaf\\OneDrive\\바탕 화면\\PLC monitoring_01\\plc-monitoring ver1.0 - google
   \`\`\`
2. **서버 시작 명령어:**
   - \`node src/server.js\` (권장)
   - 또는 \`npm start\`
3. **서버 중지(종료) 방법:**
   - 실행 중인 터미널에서 \`Ctrl + C\`
4. **접속 주소:**
   - \`http://localhost:3000/gms.html\`
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-094 appended to QNA.md');
