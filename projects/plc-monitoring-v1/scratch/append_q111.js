const fs = require('fs');
const qnaPath = 'D:\\AI_Work\\Antigravity\\plc-monitoring\\docs\\QNA.md';

const appendContent = `
## [Q-111] / [M-050] 전체 Antigravity 프로젝트 영문 표준 디렉토리(D:\\AI_Work\\Antigravity\\plc-monitoring) 무손실 마이그레이션 및 PC/PWA 서버 재가동·Flutter 무결성 전면 검증 완료 (2026-09-04)

**질문/요청 내용:**
1. 기존 프로젝트 경로에 한글(\`02. AI 작업\`, \`01.Antigravity 공유 File\`, \`바탕 화면\`) 및 공백이 포함되어 있어 빌드 도구 오류 및 인코딩 충돌이 발생하는 문제 해결 요청.
2. 대상 영문 경로 \`D:\\AI_Work\\Antigravity\\plc-monitoring\`으로 전체 Antigravity 프로젝트를 일괄 이관(마이그레이션) 요청.
3. PC 모니터링 서버 및 PWA 브릿지 서버 상태 점검 및 새 영문 경로에서 재실행.

**원인 분석 (20년 시니어 엔지니어링):**
1. **한글/공백 경로 문제**:
   - Windows의 기본 콘솔 인코딩(CP949)과 Node.js/Dart/Gradle(UTF-8) 간 경로 바이트 불일치 및 공백 분리 오류로 인해 빌드 도구 실행 중 간헐적 오류 발생.
2. **C 드라이브 용량 부족 발견**:
   - 점검 과정에서 C 드라이브 여유 공간이 \`0 GB\`로 꽉 차서 임시 컴파일 파일(\`.dill\`) 쓰기 오류가 발생하던 치명적 원인 규명 ➔ C Temp 캐시 정리(2.67GB 확보) 및 706GB의 넉넉한 D 드라이브 표준 영문 경로(\`D:\\AI_Work\\Antigravity\`)로 마이그레이션하여 근본 문제 100% 해결.

**상세 조치 및 구현 내역:**

\`\`\`mermaid
graph TD
    OldPaths["❌ 기존 한글/공백 경로<br/>• D:\\02. AI 작업\\01.Antigravity 공유 File<br/>• C:\\Users\\rokaf\\OneDrive\\바탕 화면"]
    NewPath["✅ 신규 영문 표준 경로 (706GB 여유 공간)<br/>👉 D:\\AI_Work\\Antigravity\\plc-monitoring"]

    subgraph ServiceVerification ["새 경로 무결성 검증 (All Green)"]
        PCServer["🖥️ PC 모니터링 서버 (Port 3000)<br/>http://localhost:3000 (PID 33224)"]
        PWAServer["📱 PWA 브릿지 서버 (Port 3001)<br/>https://localhost:3001 (PID 41348)"]
        FlutterTests["🧪 Flutter Test Suite (All 3 Passed)<br/>• UI Flow Test<br/>• Y-Axis Auto Margin Test<br/>• Time-Lock Past Browsing Test"]
    end

    OldPaths -->|무손실 Robocopy 동기화| NewPath
    NewPath --> PCServer
    NewPath --> PWAServer
    NewPath --> FlutterTests
\`\`\`

1. **전체 Antigravity 프로젝트 무손실 동기화 이관**:
   - **메인 프로젝트**: \`D:\\AI_Work\\Antigravity\\plc-monitoring\`
   - **서브 브릿지 프로젝트**: \`D:\\AI_Work\\Antigravity\\03. mobile-pwa-bridge\`
   - **자동화 프로젝트**: \`D:\\AI_Work\\Antigravity\\01. ...\`
   - 소스 코드, 문서(docs), 데이터베이스(app.db), APK 배포 파일 6종 및 \`node_modules\` 전체 무손실 복사 완료.
2. **새 영문 경로에서 서비스 기동 및 검증**:
   - **PC 모니터링 서버 (Port 3000)**: \`http://localhost:3000\` (PID: 33224, 정상 가동 중 ✅)
   - **PWA 브릿지 서버 (Port 3001)**: \`https://localhost:3001\` (PID: 41348, 정상 가동 중 ✅)
   - **Flutter 테스트 (\`mobile-app\`)**: \`00:01 +3: All tests passed!\` 100% 통과 ✅
`;

if (fs.existsSync(qnaPath)) {
  fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
  console.log('Q-111 appended to QNA.md');
}
