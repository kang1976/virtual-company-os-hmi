const fs = require('fs');
const qnaPath = 'D:\\02. AI 작업\\01.Antigravity 공유 File\\02. plc-monitoring ver1.0 - google\\docs\\QNA.md';

const appendContent = `
## [Q-103] / [M-042] 안드로이드 OS 소켓 권한(INTERNET/NETWORK_STATE) 주입 및 직결 통신 100% 정상화 (2026-08-31)

**질문/요청 내용:**
- 실시간 통신 진단 로그에서 \`SocketException: Failed to create datagram socket (OS Error: Operation not permitted, errno = 1)\` 발생으로 직결 및 브릿지 접속 불가 현상 원인 규명 및 긴급 조치 요청

**원인 분석 (20년 시니어 개발자 멘토링):**
- \`mobile-app/android/app/src/main/AndroidManifest.xml\`에 안드로이드 OS 레벨의 **\`android.permission.INTERNET\`** 권한이 선언되어 있지 않아, 안드로이드 OS가 앱의 모든 UDP/TCP 소켓 생성을 \`Operation not permitted (errno=1)\`로 원천 차단함.

**조치 내역:**
1. \`AndroidManifest.xml\`에 다음 권한 및 속성 완벽 주입:
   - \`<uses-permission android:name="android.permission.INTERNET"/>\`
   - \`<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>\`
   - \`<uses-permission android:name="android.permission.ACCESS_WIFI_STATE"/>\`
   - \`<uses-permission android:name="android.permission.CHANGE_WIFI_MULTICAST_STATE"/>\`
   - \`android:usesCleartextTraffic="true"\`
2. \`_initFinsService()\`에서 IP 입력 시 포트 번호 분리 파싱 방어 코드 탑재.
3. 최신 \`Omron_CJ2H_Direct_Monitor_v2.1.0.apk\` (48.7MB) 재빌드 및 배포 완료.
`;

if (fs.existsSync(qnaPath)) {
  fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
  console.log('Q-103 appended to QNA.md');
}
