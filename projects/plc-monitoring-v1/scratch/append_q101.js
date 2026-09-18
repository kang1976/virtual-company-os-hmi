const fs = require('fs');
const qnaPath = 'D:\\02. AI 작업\\01.Antigravity 공유 File\\02. plc-monitoring ver1.0 - google\\docs\\QNA.md';

const appendContent = `
## [Q-101] / [M-040] 모바일 배포 APK 파일명 버전 명기 (v2.1.0) 적용 (2026-08-31)

**질문/요청 내용:**
- APK 파일명에 명시적인 버전 번호 표기 요청

**조치 내역:**
1. \`mobile-app/pubspec.yaml\` 버전 \`version: 2.1.0+2\`로 판올림.
2. 배포 산출물 파일명을 **\`Omron_CJ2H_Direct_Monitor_v2.1.0.apk\`** (48.7MB)로 명명하여 루트에 공식 배포.
3. 기존 \`Omron_CJ2H_Direct_Monitor.apk\`도 최신 링크 호환성을 위해 동일 유지.
`;

if (fs.existsSync(qnaPath)) {
  fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
  console.log('Q-101 appended to QNA.md');
}
