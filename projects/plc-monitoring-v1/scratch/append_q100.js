const fs = require('fs');
const qnaPath = 'D:\\02. AI 작업\\01.Antigravity 공유 File\\02. plc-monitoring ver1.0 - google\\docs\\QNA.md';

const appendContent = `
## [Q-100] / [M-039] 설치형 모바일 앱에 'PC 브릿지 경유 모드' 듀얼 통신 엔진 탑재 및 최신 APK 배포 (2026-08-30)

**질문/요청 내용:**
- 스마트폰 모바일 핫스팟 환경에서 스마트폰이 PLC 유선망(192.168.0.xxx)으로 직접 갈 수 없어 오프라인이 뜨는 문제 해결을 위해, 설치형 모바일 앱에도 **"PC 브릿지 경유 모드"**를 추가 요청.

**원인 분석 (20년 시니어 개발자 멘토링):**
- 스마트폰에서 핫스팟을 켜고 모바일 데이터를 사용할 때 스마트폰 내부 라우팅 테이블에는 PLC 유선 IP(\`192.168.0.80\`) 대역의 물리적 경로가 존재하지 않음.
- 따라서 스마트폰 ➔ PC 브릿지(\`https://10.219.30.135:3001\`) ➔ PLC(\`192.168.0.80\`)로 PC가 중계하는 하이브리드 엔진이 필요함.

**조치 및 구현 내역:**
1. **하이브리드 듀얼 통신 엔진 구현 (\`mobile-app/lib/bridge_service.dart\` & \`main.dart\`):**
   - **모드 1: 🌐 PC 브릿지 경유 모드 (기본 활성화)**:
     - PC 브릿지 서버(\`https://10.219.30.135:3001\`)로 HTTPS REST/Session 인증 및 실시간 폴링.
     - 자체 서명 SSL 인증서 무결성 허용 및 2단계 쓰기 확인 API(\`/api/command\`) 완벽 연동.
   - **모드 2: ⚡ PLC 직결 모드 (P2P FINS UDP)**:
     - 공장/사무실 Wi-Fi(\`192.168.0.xxx\`) 접속 시 스마트폰 ➔ PLC 0.01초 초저지연 FINS 직접 통신.
2. **UI 모드 전환 스위치 탑재:**
   - 로그인 카드 및 설정 탭에서 원터치로 [🌐 PC 브릿지 모드] ↔ [⚡ PLC 직결 모드] 전환 가능.
3. **최신 Release APK 빌드 및 배포 완료:**
   - 산출물: \`Omron_CJ2H_Direct_Monitor.apk\` (48.7MB)
`;

if (fs.existsSync(qnaPath)) {
  fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
  console.log('Q-100 appended to QNA.md');
}
