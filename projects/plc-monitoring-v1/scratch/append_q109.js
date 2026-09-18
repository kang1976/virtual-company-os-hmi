const fs = require('fs');
const qnaPath = 'D:\\02. AI 작업\\01.Antigravity 공유 File\\02. plc-monitoring ver1.0 - google\\docs\\QNA.md';

const appendContent = `
## [Q-109] / [M-048] 모바일 앱 트렌드 증권사 차트 스타일 핀치 줌(Zoom) & 패닝(Pan) 엔진 탑재, 과거 탐색 시 실시간 튕김(원복) 방지 락(Lock), [전체 보기] 전용 상시 버튼 및 축 설정 내 X축 시간(분) 직접 입력 기능 구현 (v2.3.3) (2026-08-31)

**질문/요청 내용:**
1. PWA처럼 상단에 \`[전체 보기]\` 전용 버튼이 상시 노출되어 원터치로 실시간 복귀가 가능해야 함.
2. \`[축 설정]\` 다이얼로그에 Y축뿐만 아니라 X축 표시 구간(분 단위, 예: 5분, 10분, 30분)을 직접 숫자로 설정하는 기능 필요.
3. 과거 데이터를 드래그하여 탐색할 때, 1초마다 화면이 실시간 최신 시점으로 강제 원복(튕김)되는 버그 수정 요청.
4. 두 손가락(양손) 핀치 줌으로 확대/축소하고 한 손가락으로 드래그할 때 증권사(토스/키움/TradingView) 차트처럼 버터처럼 부드럽게 움직이도록 최적화 요청.

**원인 분석 (20년 시니어 엔지니어링):**
1. **과거 탐색 시 1초마다 실시간으로 튕기는(원복) 원인**:
   - 백그라운드 폴링 타이머(\`_pollingTimer\`)가 1초마다 새 PLC 데이터를 적층하면서 \`_trendTimeCounter += 1.0\`을 증가시키는데, 사용자가 과거를 보고 있는 상태(\`!_isLiveTracking\`)에서도 \`_viewportPanOffset\`이 고정되어 있어 화면 기준점이 1초마다 최신 쪽으로 밀려 튕기던 문제.
   - ➔ **해결**: \`!_isLiveTracking\`일 때 \`_viewportPanOffset += 1.0\`을 함께 증가시켜 **사용자가 보고 있는 과거 시점의 데이터를 화면에 완벽히 고정(Lock)**!
2. **양손 조작 핀치 줌 및 패닝 부드러움 부재 원인**:
   - 기존의 단순 드래그 제스처는 1손가락 이동만 감지하고 2손가락 확대/축소(Pinch Scale)를 처리하지 못함.
   - ➔ **해결**: \`GestureDetector\`의 \`onScaleUpdate\` 엔진으로 교체하여, \`scale != 1.0\`일 때는 시간창(\`_trendWindowSeconds\`)을 연속 확대/축소하고, \`focalPointDelta.dx\`로는 부드럽게 과거/미래로 슬라이딩하도록 구현.

**상세 조치 및 구현 내역 (v2.3.3):**

\`\`\`mermaid
graph TD
    UserTouch["👆 사용자 터치 인터랙션 (증권사 차트 엔진)"]

    subgraph GestureEngineV233 ["트렌드 인터랙션 엔진 (v2.3.3)"]
        PinchZoom["✌️ 2손가락 핀치 줌<br/>(details.scale ➔ 10초 ~ 72시간 실시간 연속 확대/축소)"]
        OneFingerPan["☝️ 1손가락 드래그 이동<br/>(focalPointDelta.dx ➔ 부드러운 과거 시계열 탐색)"]
        PastLock["🔒 과거 구간 시점 고정(Lock)<br/>(!_isLiveTracking 시 1초 타이머 밀림 원천 차단)"]
        FullViewBtn["🔘 [전체 보기] 독립 버튼<br/>(원터치 실시간 0초 복귀)"]
        XAxisModal["⏱️ [축 설정] X축 시간(분) 직접 입력<br/>(5분, 10분, 30분, 60분 등 자유 지정)"]
    end

    UserTouch --> PinchZoom
    UserTouch --> OneFingerPan
    OneFingerPan --> PastLock
    FullViewBtn --> GestureEngineV233
    XAxisModal --> GestureEngineV233
\`\`\`

1. **PWA 100% 동등 [전체 보기] 전용 독립 버튼 상시 배치**:
   - 트렌드 상단 1행에 **\`[전체 보기]\`** 버튼을 상시 노출하여, 과거 데이터를 탐색하다가 언제든지 클릭 한 번으로 최신 실시간 차트로 복귀 가능.
2. **[축 설정] 모달에 X축 표시 구간(분) 직접 설정 기능 추가**:
   - \`표시 구간 (분) — X축\` 입력 필드를 추가하여 1분, 5분, 15분, 60분 등 원하는 표시 구간을 분 단위로 정밀하게 직접 입력 가능.
3. **과거 데이터 탐색 시 실시간 튕김(원복) 완전 해결 (타임 락 엔진)**:
   - 과거 데이터를 보고 있는 동안에는 백그라운드 1초 폴링 타이머가 돌아도 **보고 있는 과거 시간 위치가 화면에 그대로 고정(Lock)**되어 덜컹거림이나 튕김이 100% 사라짐.
4. **증권사 차트 방식 핀치 줌 & 패닝 엔진 탑재**:
   - **두 손가락(양손) 벌리기/오므리기**: 시간 축이 10초에서 72시간까지 즉각적으로 확대/축소됨.
   - **한 손가락 좌우 스와이프**: 부드러운 하드웨어 가속으로 과거 파형을 탐색.
5. **배포 산출물**:
   - **\`Omron_CJ2H_Direct_Monitor_v2.3.3.apk\`** (49.5MB) 정식 빌드 및 배포 완료.
`;

if (fs.existsSync(qnaPath)) {
  fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
  console.log('Q-109 appended to QNA.md');
}
