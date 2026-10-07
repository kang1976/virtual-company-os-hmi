const fs = require('fs');
const path = require('path');

const qnaPath = 'D:\\02. AI 작업\\PLC monitoring_01\\plc-monitoring ver1.0 - google\\docs\\QNA.md';

const appendContent = `
## [Q-098] Omron CJ2H Direct Mobile App 프로젝트 통합 이관 및 문서 전체 업데이트 (2026-08-30)

**질문/요청 내용:**
- 서버 재가동(Start) 및 \`01. 핸드폰 어플\` 프로젝트에서 이관받은 내용과 관련하여 프로젝트 문서 전체 업데이트 요청

**이관 및 통합 내역 요약:**
1. **모바일 앱 프로젝트 (\`mobile-app/\`):**
   - **기종 및 프로토콜**: Omron CJ2H PLC 직결 FINS/UDP (포트: 9600) 모바일 통신 엔진
   - **타겟 디바이스**: 갤럭시 Z 폴드5 (SM-F946N, 커버 904×2316 / 메인 펼침 1812×2176 듀얼 반응형 레이아웃)
   - **프레임워크**: Flutter 3.47.2 / Dart 3.11.0 (Material 3 다크 모드, 네온 시안 & 오므론 딥블루 테마)
   - **주요 기능**:
     - **0101/0104 다중 영역 읽기**: D, H, W, CIO, E0 메모리 영역 실시간 모니터링
     - **0102 비트/워드 쓰기**: 밸브 개폐, 수동 조작 및 비트 토글
     - **실시간 트렌드 차트**: Syncfusion Flutter Charts 기반 다채널 압력/온도 실시간 파형 모니터링
     - **0601/0501 CPU 상태 및 진단**: RUN/MONITOR/STOP 모드 제어 및 PLC 에러 로그 조회
2. **배포 산출물 및 PDCA 문서 통합 (\`Omron_CJ2H_Direct_Monitor.apk\`, \`docs/mobile/\`):**
   - 최신 APK 파일: 루트 디렉토리 \`Omron_CJ2H_Direct_Monitor.apk\`
   - 모바일 PDCA 문서: \`docs/mobile/\` 아래 5단계 폴더 구조(\`00-start\`, \`01-plan\`, \`02-design\`, \`04-check\`, \`05-act\`)로 보존
   - \`QA_LOG.md\`: Q-001 ~ Q-031까지 모바일 개발 전 과정 기록 보존
3. **문서 일원화 업데이트 (\`README.md\`, \`CLAUDE.md\`):**
   - PC 웹 모니터링 시스템(Node.js/Express/WebSocket)과 모바일 직결 앱(Flutter/FINS)의 듀얼 아키텍처 문서화 완료.
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-098 appended to QNA.md');
