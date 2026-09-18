const fs = require('fs');
const path = require('path');

const qnaPathDst = 'D:\\02. AI 작업\\PLC monitoring_01\\plc-monitoring ver1.0 - google\\docs\\QNA.md';

const appendContent = `
## [Q-097] D 드라이브 이전 후 서버 재가동 및 전체 엔드포인트 동작 완벽 검증 (2026-08-27)

**질문/요청 내용:**
- 서버를 재가동하여 전체적으로 이전과 동일하게 제대로 구동되는지 재확인 요청

**검증 및 테스트 결과 (\`http://localhost:3000\`):**
1. **서버 백그라운드 프로세스 정상 가동:**
   - 실행 디렉터리: \`D:\\02. AI 작업\\PLC monitoring_01\\plc-monitoring ver1.0 - google\`
   - 실행 파일: \`node src/server.js\` (포트 3000 정상 리슨)
2. **웹 화면 및 주요 리소스 응답 테스트 (Status 200 OK):**
   - \`/gms.html\` (GMS 메인 화면) ➔ 200 OK (61,963 bytes)
   - \`/gms.js\` & \`/gms.css\` ➔ 200 OK
   - \`/Operation.js\` (가스공급 시퀀스 및 배관 착색 로직) ➔ 200 OK (154,763 bytes)
   - \`/gms-diagram.svg\` (P&ID 배관도 레이어) ➔ 200 OK (22,527 bytes)
   - \`/OPERATION HTML/가스공급_준비완료.html\` (스텝 7 UI) ➔ 200 OK (3,322 bytes)
   - \`/grid/\` (유니버 그리드 에디터) ➔ 200 OK (42,479 bytes)
3. **API 데이터 연동 검증 (Status 200 OK):**
   - \`/api/variables\` ➔ 200 OK
   - \`/api/gms/valves?unit=1\` ➔ 200 OK
   - \`/api/gms/sub-sequence-config?unit=1\` ➔ 200 OK
   - \`/api/gms/main-sequence\` ➔ 200 OK
   - \`/api/gms/users\` ➔ 200 OK
`;

if (fs.existsSync(qnaPathDst)) fs.appendFileSync(qnaPathDst, appendContent, { encoding: 'utf8' });
console.log('Q-097 appended to QNA.md');
