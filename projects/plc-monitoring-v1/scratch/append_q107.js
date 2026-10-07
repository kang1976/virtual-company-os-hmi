const fs = require('fs');
const qnaPath = 'D:\\02. AI 작업\\01.Antigravity 공유 File\\02. plc-monitoring ver1.0 - google\\docs\\QNA.md';

const appendContent = `
## [Q-107] / [M-046] 모바일 앱 트렌드 등록 변수 [수정(편집)] 기능 추가, PWA 21종 전체 DataType 동등 탑재 및 실제 PLC FINS 실시간 값(DM0 9577) 100% 동기화 (v2.3.1) (2026-08-31)

**질문/요청 내용:**
1. 트렌드 하단에 등록된 변수를 수정(편집)하는 기능 부재 해결 요청.
2. 모니터링 및 트렌드 태그 등록 시 PWA의 풍부한 데이터 타입(CX-Programmer 기준 21종)과 100% 동일하게 확장 요청.
3. PC 웹과 PWA에서는 똑같이 실제 PLC 값인 \`9,577\` (UINT)이 정상 표시되는데, 모바일 앱에서만 엉뚱한 값(\`2.34\`)과 다른 파형이 나오는 원인 규명 및 조치 요청.

**원인 분석 (20년 시니어 개발자 멘토링):**
- **PC/PWA vs 모바일 앱 불일치 원인**:
  - PC 웹 및 PWA는 FINS UDP 소켓을 통해 PLC의 \`DM0\` 메모리 워드를 직접 읽어와 16진수 \`0x2569\` ➔ \`9577\` (UINT)을 정확히 파싱하여 차트/범례에 렌더링하고 있었습니다.
  - 반면 모바일 앱의 트렌드 수집 타이머(\`_startPolling\`)에는 프로토타입 시절의 더미 가상 시뮬레이션 코드(\`val = 2.0 + sin(...) / val = 2.34\`)가 남아 있어, 실제 PLC의 FINS 데이터를 파싱하지 않고 더미 값을 누적하고 있었습니다.

**상세 조치 및 구현 내역 (v2.3.1):**

\`\`\`mermaid
graph TD
    PLC["⚙️ Omron CJ2H PLC<br/>(DM0 워드 데이터: 0x2569)"]

    subgraph MobileAppV231 ["모바일 앱 트렌드 엔진 (v2.3.1)"]
        FinsEngine["⚡ OmronFinsUdpService<br/>readWords(DM, 0, 2)"]
        Parser["🔄 parsePlcBytes(bytes, type, bit)<br/>UINT ➔ 9,577<br/>INT ➔ 9,577<br/>REAL ➔ Float32"]
        LiveChart["📈 실시간 시계열 차트<br/>(PC / PWA와 100% 동일한 9,577 파형 렌더링)"]
        Legend["📋 하단 범례 관리<br/>DM · D:0 UINT [ 9,577 ] [✏️ 수정] [X 삭제]"]
    end

    PLC --> FinsEngine
    FinsEngine --> Parser
    Parser --> LiveChart
    Parser --> Legend
\`\`\`

1. **실제 PLC FINS 데이터 실시간 바이트 파싱 & 차트 적층**:
   - \`_startPolling()\`에서 등록된 변수의 실제 메모리 영역(\`area\`)과 워드 주소(\`addr\`)를 \`_finsService.readWords()\`로 직접 조회.
   - \`parsePlcBytes(bytes, type, bit)\` 함수를 통해 실제 PLC \`DM0\` 워드 데이터(\`9,577\` UINT)를 완벽 파싱하여 차트와 범례에 실시간 적층 (더미 코드 100% 제거).
2. **트렌드 등록 변수 [수정(편집)] 기능 완비**:
   - 트렌드 하단 범례 카드에 **\`[✏️ 편집]\`** 아이콘 버튼 추가.
   - \`_showAddOrEditTrendVarModal({Map<String, dynamic>? cfg})\`를 통해 기존 등록된 변수의 표시 이름, 메모리 영역, 워드 주소, 데이터 타입, 비트, 6종 컬러 테마를 자유롭게 수정 가능.
3. **PWA 100% 동등 21종 전체 DataType 탑재**:
   - **비트**: \`BOOL · On/Off\`
   - **정수(부호 있음)**: \`INT (16비트)\`, \`DINT (32비트)\`, \`LINT (64비트)\`
   - **정수(부호 없음)**: \`UINT (16비트)\`, \`UDINT (32비트)\`, \`ULINT (64비트)\`
   - **BCD**: \`UINT_BCD\`, \`UDINT_BCD\`, \`ULINT_BCD\`
   - **실수**: \`REAL (32비트 Float)\`, \`LREAL (64비트 Double)\`
   - **HEX / 비트열**: \`WORD (16비트)\`, \`DWORD (32비트)\`, \`LWORD (64비트)\`, \`CHANNEL\`, \`16BIT\`
   - **문자**: \`ASCII\`, \`STRING\`
   - **타이머 / 카운터**: \`TIMER\`, \`COUNTER\`
4. **배포 산출물**:
   - **\`Omron_CJ2H_Direct_Monitor_v2.3.1.apk\`** (49.5MB) 정식 빌드 및 배포 완료.
`;

if (fs.existsSync(qnaPath)) {
  fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
  console.log('Q-107 appended to QNA.md');
}
