const fs = require('fs');
const qnaPath = 'D:\\02. AI 작업\\01.Antigravity 공유 File\\02. plc-monitoring ver1.0 - google\\docs\\QNA.md';

const appendContent = `
## [Q-105] / [M-044] 모바일 앱 PWA 100% 동등 기능(태그 등록/편집/삭제 & 트렌드 변수관리/CSV/일시정지) 완비 (v2.2.0) (2026-08-31)

**질문/요청 내용:**
- 모바일 앱에 PWA와 동일한 **태그 등록/편집/삭제/제어** 및 **트렌드 변수 등록/삭제/CSV 내보내기/일시정지/재개** 기능 반영 요청

**조치 내역 (20년 시니어 개발자 멘토링):**
1. **모니터링 탭 (Monitoring - PWA 동등)**:
   - 상단 **\`[＋ 태그]\`** 등록 다이얼로그 추가 (심볼, 명칭, 설명, 영역 D/CIO/W/H/A/E0, 워드주소, 비트, 타입 BOOL/INT/UINT/REAL/WORD, 위험등급 safe/caution/danger, 권한 read/write).
   - 각 태그 카드별 **\`[편집]\`**, **\`[삭제]\`**, **\`[쓰기]\` (2단계 안전확인)** 버튼 완비.
2. **트렌드 탭 (Trend - PWA 동등)**:
   - 상단 **\`[＋ 변수]\`** 등록 다이얼로그 (태그 선택, 곡선 색상 6종 선택, 레이블 입력).
   - **\`[일시정지 / 재개]\`** 스트리밍 토글 버튼 탑재.
   - **\`[⬇ CSV]\`** 데이터 내보내기 및 클립보드 복사 다이얼로그 탑재.
   - 하단 레전드(Legend) 목록에서 등록된 변수별 실시간 값 표시 및 **\`[X (삭제)]\`** 버튼 제공.
   - 실제 등록된 변수들의 실시간 PLC 시계열 멀티 차트 렌더링.
3. **배포 산출물**:
   - **\`Omron_CJ2H_Direct_Monitor_v2.2.0.apk\`** (48.9MB) 정식 빌드 및 배포 완료.
`;

if (fs.existsSync(qnaPath)) {
  fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
  console.log('Q-105 appended to QNA.md');
}
