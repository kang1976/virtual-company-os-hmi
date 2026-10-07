const fs = require('fs');
const qnaPath = 'D:\\AI_Work\\Antigravity\\plc-monitoring\\docs\\QNA.md';

const appendContent = `
## [Q-112] / [M-051] Flutter 빌드, 에뮬레이터 파일 생성 및 프로젝트 작업 D 드라이브(D:\\AI_Work\\Antigravity\\plc-monitoring) 전용 고정 수칙 수립 (2026-09-04)

**질문/요청 내용:**
- 앞으로 Flutter 에뮬레이터 파일 생성과 빌드 및 모든 관련 작업은 C 드라이브를 배제하고 D 드라이브 프로젝트 폴더(\`D:\\AI_Work\\Antigravity\\plc-monitoring\`)에서 전담 진행하도록 규칙 지정 요청.

**엔지니어링 수칙 및 조치 내역 (20년 시니어 개발자 멘토링):**

\`\`\`mermaid
graph TD
    CDrive["❌ C 드라이브 (사용 금지)<br/>• 용량 부족 위험 (0 GB 락 발생 경험)<br/>• 사용자 임시 폴더 간섭 및 OneDrive 락"]
    DDrive["✅ D 드라이브 전담 환경 (700GB+ 여유)<br/>👉 D:\\AI_Work\\Antigravity\\plc-monitoring"]

    subgraph D_Drive_Workspaces ["D 드라이브 전용 작업 영역"]
        FlutterApp["📱 mobile-app/ (Flutter 소스 & 테스트)"]
        BuildOut["📦 build/ (APK 릴리스 출력 & 캐시)"]
        EmulatorAVD["💻 D:\\android_avd (에뮬레이터 가상 디바이스 이미지)"]
        PCBridge["🖥️ pc-app/ & pwa-bridge/ (Node 서버 환경)"]
    end

    CDrive -.->|금지 및 차단| D_Drive_Workspaces
    DDrive --> D_Drive_Workspaces
\`\`\`

1. **D 드라이브 전용 고정 규칙 공식 채택**:
   - \`AGENTS.md\` (제7조), \`.agents/rules/senior_developer_mentoring.md\` (제7조), \`docs/00-start/SKILL_TREE.md\`에 본 수칙을 영구 불변 규칙으로 등록.
   - 모든 Flutter 패키지 분석, 컴파일(\`.dill\`), 단위/위젯 테스트, 릴리스 APK 빌드(\`flutter build apk\`), 에뮬레이터 AVD 파일 저장을 \`D:\\AI_Work\\Antigravity\\plc-monitoring\`에서만 수행.
2. **효과**:
   - C 드라이브의 용량 부족 에러(\`errno = 112 디스크 공간 부족\`) 및 한글/공백 경로 인코딩 깨짐을 100% 영구 원천 차단.
   - 700GB 이상의 쾌적한 고속 I/O 디스크 공간에서 안정적인 개발 및 빌드 보장.
`;

if (fs.existsSync(qnaPath)) {
  fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
  console.log('Q-112 appended to QNA.md');
}
