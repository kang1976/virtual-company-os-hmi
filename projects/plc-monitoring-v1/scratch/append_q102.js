const fs = require('fs');
const qnaPath = 'D:\\02. AI 작업\\01.Antigravity 공유 File\\02. plc-monitoring ver1.0 - google\\docs\\QNA.md';

const appendContent = `
## [Q-102] / [M-041] 앱 화면 내 버전 명기(v2.1.0) 및 실시간 통신 진단 콘솔(Live Diag) 탑재 (2026-08-31)

**질문/요청 내용:**
- 어플 실행 화면(상단 바, 설정 탭)에 설치 버전 표기 요청
- 유선/무선 공유기 환경에서 직결 통신 원격 점검 및 진단 로그 가시화 요청

**원격 점검 결과 (20년 시니어 개발자 멘토링):**
1. **PLC(\`192.168.0.80:9600\`) FINS/UDP 통신 무결성 검증**:
   - PC에서 UDP 패킷 직접 송수신 결과: \`c0 00 02 00 d3 00 00 50 00 01 01 01 00 00 19 ae\` (Response Code \`0x0000\` 성공, DM0 정상 읽기 100% 확인).
   - PLC는 송신측 노드 번호(\`SA1\`)로 정확하게 응답을 반송함.
2. **스마트폰 직결 점검 및 개선 조치**:
   - FINS UDP 응답 시 CPU 모델 읽기 외에 표준 DM0 읽기 폴백 탑재.
   - 설정 탭에 **\`실시간 통신 진단 로그(Live Diagnostic Log)\`** 콘솔을 내장하여, 패킷 송수신 내역 및 소켓 에러를 스마트폰 화면에서 직접 육안 확인 가능하도록 구현.
   - 상단 AppBar 및 설정 탭 하단에 **\`App Version v2.1.0\`** 공식 버전 뱃지 명기.
`;

if (fs.existsSync(qnaPath)) {
  fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
  console.log('Q-102 appended to QNA.md');
}
