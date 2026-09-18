# 작업 이력 · 문제점 해결 기록 · 디자인 표준

_최종 갱신: 2026-07-17 (그리드 스냅샷/비교판정, 메모리 영역별 개별 설정(areaViews),
수동 폴링 시작/정지, 전체 값 채우기, 내보내기 저장위치 선택, 연결 버튼 방어 로직까지
정리 — 12절 추가)_

> ⚠️ 과거 버전에서 `docs/PROJECT_SUMMARY_AND_PROTOCOL.md`(FINS 프로토콜 상세 문서)를 참고하라는
> 안내가 여러 곳에 남아있었지만, 저장소에는 실제로 이 파일이 존재한 적이 없다(git 이력
> 확인됨). FINS 프로토콜 상세는 프로젝트 루트 `CLAUDE.md`의 "프로토콜 핵심" 절과 본 문서 2-3절에
> 압축되어 있으니 그쪽을 참고할 것. 이 문서는
> **그 이후 진행된 백엔드 구조 변경 / 화면 기능 추가 / 버그와 원인 / 화면 디자인 규칙**을
> 항목별로 자세히 정리한 문서다. 새 대화를 시작할 때 이 문서를 함께 참고하면
> "왜 이렇게 만들었는지"와 "무엇이 아직 가정치/제약사항인지"를 빠르게 파악할 수 있다.

---

## 1. 연결 아키텍처 변천사

### 1-1. 문제 상황
원래 서버(`src/server.js`)는 클라이언트 인스턴스(`UsbFinsClient`/`UdpFinsClient`/`TcpFinsClient`)
하나를 전역으로 공유했다. "PLC 모니터링"(메인 대시보드)과 "PLC 변수관리 그리드" 두 화면이
같은 연결을 나눠 썼기 때문에, 그리드 화면은 자체 연결 UI 없이 "메인 화면에서 먼저 연결하세요"
안내만 보여주는 식이었고, 한쪽에서 연결/해제하면 다른 쪽도 그대로 영향을 받았다.

### 1-2. 1차 변경 - 완전 독립 세션 (`src/plcSession.js`)
사용자가 "USB 포함해서 두 화면이 완전히 독립적인 연결을 갖게 해달라"고 명시적으로 요청해서,
연결 상태/카운터/통신이력 관리를 `createPlcSession({ broadcast, logFile, wsTypes, stopDependents })`
팩토리로 분리하고, `server.js`에서 `mainSession`/`gridSession` 두 개를 각각 생성했다.

- 각 세션은 자기 자신의 `client`, `counters`(send/recvSuccess/recvError), `latencyMs`, 로그 버퍼,
  로그 파일(`logs/session_main_*.log` / `logs/session_grid_*.log`)을 가진다.
- 그리드 페이지에 `/api/grid/connect`·`/api/grid/disconnect`·`/api/grid/counters/reset`·
  `/api/grid/logs/clear`·`/api/grid/conn-status` 엔드포인트를 신설하고, 화면에도
  호스트/포트/타입/연결·해제 버튼 UI(`grid-app/index.html`의 `.conn-toolbar`)를 새로 만들었다.
- **지연시간(latency) 측정**: 클라이언트 3종(`usbFinsClient.js`/`udpFinsClient.js`/`tcpFinsClient.js`)을
  전혀 건드리지 않고, `plcSession.js`의 `pushLog(direction, ...)`에서 `'SEND'` 로그 시각을
  기억해뒀다가 다음 `'RECV'` 로그에서 그 차이를 `state.latencyMs`로 계산하는 방식으로 구현했다.
  각 클라이언트는 `_requestChain`으로 요청을 하나씩만 순차 처리하므로, SEND 다음에 오는 RECV는
  항상 그 요청의 응답이라는 전제가 성립해서 이 방식이 안전하다. `WARN`/`SYSTEM`/`ERROR` 로그가
  끼어들면 `lastSendAt`을 무효화해서 다음 요청의 지연시간이 오염되지 않게 했다.

### 1-3. 2차 변경 - 다시 상호 배타적 연결로 복귀
독립 연결로 바꾼 뒤 실사용해보니, "한 화면에서 연결하면 다른 화면 연결이 자동으로 끊기고
그 화면만 연결되어야 한다"는 요구가 다시 나왔다(동시 연결 시 실사용상 불편함/부하 문제 때문으로
추정). 그래서 **세션 객체(`plcSession.js`) 자체는 그대로 두고**, `server.js`의
`POST /api/connect`/`POST /api/grid/connect` 핸들러 안에서 상대 세션이 연결되어 있으면
연결 시도 직전에 먼저 `disconnect()`하도록 한 줄씩만 추가했다:

```js
// POST /api/connect 안
if (gridSession.getStatus().connected) {
  gridSession.disconnect();
  broadcast({ type: 'gridConnStatus', payload: gridSession.getStatus() });
}
await mainSession.connect(req.body || {});
```

```js
// POST /api/grid/connect 안
if (mainSession.getStatus().connected) {
  mainSession.disconnect();
  broadcast({ type: 'status', payload: getStatus() });
}
const status = await gridSession.connect(req.body || {});
```

**왜 세션 구조를 되돌리지 않고 이렇게 했나**: `plcSession.js`(독립된 client/counters/latency 관리)는
여전히 유용하다 — 두 화면이 각자 다른 연결 타입(USB/UDP/TCP)을 선택하고 자신만의 카운터를 볼 수
있다는 장점은 그대로 살리면서, "동시에 둘 다 연결되어 있는 상태"만 막으면 되는 문제였기
때문이다. 그래서 연결 API 레벨에서 "상대방을 먼저 끊는다"는 시�퀀스 하나만 추가하는 것으로
충분했다.

**참고**: USB는 하드웨어 특성상(libusb 배타적 claim) 어차피 한 프로세스만 물 수 있어서 항상
동시 사용이 불가능했지만, 지금은 UDP/TCP를 포함해 **모든 연결 타입에서** 상호 배타적으로
동작한다.

---

## 2. 메모리 탐색기 (PLC 모니터링 화면 확장)

### 2-1. 배경
기존에는 D/H/W/CIO/E0~E3 8개 영역을 각각 0~127번지(128워드) 고정으로만 폴링했다
(`TEST_GROUPS` 하드코딩). 사용자가 CX-Programmer의 메모리 뷰(시작주소 입력 + 비트/헥스
테이블)를 참고 삼아 "영역 전체 주소를 브라우징하고 싶다"고 요청했다.

### 2-2. 설계 - "활성 뷰(activeView)" 하나만 폴링
8개 영역을 동시에 항상 다 폴링하는 대신, **탭으로 선택한 영역 하나 + 그 안의 한 페이지
범위**만 폴링하도록 바꿨다(`src/server.js`의 `activeView = { area, startAddr, pageSize,
dataType, length }`). 이렇게 하면 "전체 메모리 브라우징"이 가능하면서도 실제 폴링 트래픽은
오히려 예전보다 줄어든다(예전: 8개 영역×128워드 항상 폴링 / 지금: 탭 1개×페이지크기만 폴링).

- `GET /api/memory/areas` — 접속된 CPU 모델에 따라 영역 목록(D/H/W/CIO + EM 뱅크들)을 반환.
- `POST /api/memory/view` — 탭 전환/시작주소/페이지크기/데이터타입/길이 변경 시 호출, 영역
  최대 크기를 벗어나면 거부.
- `POST /api/memory/write` — 현재 페이지에서 편집한 값들을 실제로 PLC에 씀.
- `GET /api/memory/export/xlsx` — 현재 페이지 값을 Excel로 내보냄.

### 2-3. CPU 모델별 EM 뱅크 자동 감지 (`src/memoryAreas.js`)
`docs/PROJECT_SUMMARY_AND_PROTOCOL.md` 4-7에 정리되어 있던 "CJ2H-CPU6@-EIP 모델별 EM 뱅크
개수" 표(예: CPU65=E0~E3, CPU68=E0~E18(hex))를 그대로 코드화했다. 연결 직후 조회되는
`controllerInfo.model` 문자열로 매칭하고, 모르는 모델이면 기본값(4뱅크, 기존 E0~E3 동작)으로
폴백한다.

```js
const CPU_EM_BANKS = {
  'CJ2H-CPU64-EIP': 4, 'CJ2H-CPU65-EIP': 4,
  'CJ2H-CPU66-EIP': 10, 'CJ2H-CPU67-EIP': 15, 'CJ2H-CPU68-EIP': 25,
};
```

**⚠️ 가정치(실기 검증 필요)**: 각 영역의 워드 개수(D=32768, H=512, W=512, CIO=6144, EM
뱅크=뱅크당 32768)는 Omron CS/CJ 시리즈 표준 스펙 기준 가정이다. CJ2H가 이 표준과 다른 부분이
있으면 범위 끝 주소에서 PLC가 에러를 반환할 것이므로, 그때 `AREA_WORD_COUNTS`/
`EM_BANK_WORD_COUNT` 상수만 조정하면 된다(구조 변경 불필요).

### 2-4. 데이터 타입별 표시 (BOOL/STRING 특별 처리)
`src/dataTypes.js`의 `wordCountFor`/`decodeValue`/`encodeValue`(그리드 페이지가 이미 쓰고
있던 함수)를 그대로 재사용해서, 선택한 데이터 타입에 맞춰 서버가 값을 디코딩해 보낸다.

- **BOOL 표시 모드**: 그리드 페이지의 "BOOL 변수"(비트 하나만 읽음)와는 의미가 다르다.
  메모리 탐색기의 BOOL 모드는 "이 워드를 16비트로 펼쳐서 보여줘"라는 뜻이므로, **항상 워드
  영역 코드로 워드 전체를 읽고**, 그 정수값을 그대로 클라이언트에 보내 프론트엔드가
  `(word >> bit) & 1` 로 비트 테이블(bit15~bit0 + Hex)을 그린다. 주소당 비트 16개를 따로
  읽는 것보다 훨씬 효율적이다.
- **STRING 모드**: "길이(워드)" 입력이 추가로 나타나고, ASCII 텍스트로 디코딩되어 표시된다.

### 2-5. 쓰기(적용) 기능
`POST /api/memory/write`는 그리드의 `writeVariable`(read-modify-write BOOL 쓰기)과 같은
패턴을 재사용한다 — BOOL은 `writeBit()`으로 비트 하나만 바꾸고, 그 외 타입은
`encodeValue()`로 워드 배열을 만들어 `writeWord()`를 순서대로 호출한다.

---

## 3. 그리드(변수 관리) 화면 버그와 해결

### 3-1. 변수명 중복 시 값이 서로 덮어써지는 문제
**증상**: 변수를 "변수추가" 버튼으로 여러 개 만들면 기본값 "NEW_VAR"가 그대로 남는데, 이
상태에서는 서로 다른 행의 값이 뒤섞이거나 마지막 행 값만 갱신됐다.

**원인**: `gridManager.js`가 값을 매핑할 때 변수의 표시 이름(label)을 키로 썼다. label은
사용자가 자유롭게(중복 가능하게) 입력하는 텍스트라서, 여러 변수가 같은 이름이면 JS 객체 키가
겹쳐써졌다.

**해결**: `buildReadPlan`/`pollOnce`(서버)와 `rebuildIndexToRow`/`applyGridValues`
(`grid-app/src/main.js`) 양쪽 모두, label 대신 **variables 배열 내 위치(index)**를 키로
쓰도록 바꿨다. 저장 시점의 유효한 변수 순서가 서버/프론트 양쪽에서 동일하다는 전제로
동작한다.

### 3-2. 설정값 입력이 폴링마다 취소되는 문제 (그리드 페이지, Univer)
**증상**: "설정값" 열에 값을 입력하려고 하면 폴링 주기(기본 1초)마다 입력/선택이 취소됐다.

**원인**: 그리드 페이지가 매 폴링 사이클마다 Univer의 `setValues()`로 "현재값" 열을
갱신하는데, 이 호출이 사용자가 다른 셀(설정값 열)을 편집 중이던 상태를 강제로 종료시켰다.

**해결**: Univer가 제공하는 `SheetEditStarted`/`SheetEditEnded` 이벤트로 "지금 셀 편집
중인지" 플래그(`isEditingCell`)를 추적하고, `applyGridValues()` 맨 앞에서 편집 중이면
이번 폴링 반영을 통째로 건너뛰도록 했다. 편집이 끝나면 다음 폴링부터 다시 정상 반영된다.

```js
let isEditingCell = false;
univerAPI.addEvent(univerAPI.Event.SheetEditStarted, () => { isEditingCell = true; });
univerAPI.addEvent(univerAPI.Event.SheetEditEnded, () => { isEditingCell = false; });

function applyGridValues(values) {
  if (isEditingCell) return; // 편집 중이면 이번 폴링 반영은 건너뜀
  ...
}
```

### 3-3. 같은 종류의 버그가 PLC 모니터링(메모리 탐색기) 화면에도 있었음
**증상**: 메모리 탐색기의 "설정값" 입력창도, **연결된 채로는** 값을 입력할 수 없고
연결 해제 → 값 입력 → 재연결 → 적용을 해야만 동작했다.

**원인**: `renderValueGrid()`가 매 폴링(`memoryValues` WS 메시지)마다
`valueGrid.innerHTML = ''`로 그리드 전체를 지우고 새로 그렸다. Univer가 아니라 순수 DOM
`<input>`이라 별도 "편집 중" 이벤트가 없고, DOM 노드 자체가 통째로 교체되면서 타이핑
중이던 내용과 포커스가 사라졌다(연결을 끊으면 폴링이 멈추니 재렌더가 없어서 우연히
동작했던 것).

**해결**: "같은 뷰(영역/시작주소/개수/타입)를 보고 있는 동안"에는 기존 DOM(입력창 포함)을
그대로 두고 **`.value` 텍스트만** 갱신하도록 바꿨다. 뷰 자체가 바뀔 때(탭 전환, 페이지
이동, 타입 변경)만 전체를 다시 그린다. `lastValueGridKey`(예: `"W|50|4|INT"`)로 이전
렌더와 같은 뷰인지 비교해서 판단한다.

```js
let lastValueGridKey = null;
function renderValueGrid(cells, viewKey) {
  if (viewKey !== lastValueGridKey) {
    // 뷰가 바뀐 경우에만 전체 재구성 (입력창 새로 만듦)
    ...
    lastValueGridKey = viewKey;
  }
  // 값 텍스트만 갱신 - 입력창은 건드리지 않음
  for (const c of cells) { ... ref.valueEl.textContent = text; ... }
}
```

> **패턴 정리**: "폴링/실시간 갱신 UI에서 사용자가 입력 중인 셀을 건드리면 입력이 끊긴다"는
> 같은 종류의 버그가 그리드(Univer)와 메모리 탐색기(순수 DOM) 두 군데서 각각 다른 형태로
> 나타났다. 앞으로 실시간 갱신 + 사용자 편집이 공존하는 화면을 새로 만들 때는 항상 이
> 패턴을 먼저 고려할 것 — ①에디터 상태를 추적해서 갱신을 잠시 멈추거나, ②편집 중인
> 요소는 건드리지 않고 나머지만 갱신하는 두 가지 방법이 있다.

### 3-4. 카운터(SEND/RECV/에러/지연) 표시 깜빡임
**증상**: PLC 모니터링 화면에서 "지연" 값이 "Nms"로 잠깐 보이다가 곧바로 "—"로 바뀌길
반복해서 읽을 수가 없었다.

**원인**: `public/app.js`의 `setStatus()`가 매 폴링마다 오는 `status` WS 메시지를 처리할
때 `setCounters(status.counters)`만 호출했는데, `status.latencyMs`는 `counters`와
**별개의 최상위 필드**라서 이렇게 넘기면 지연시간이 빠진 채로 카운터가 덮어써졌다. 반면
`counters` 타입 메시지는 `{ ...counters, latencyMs }`로 이미 합쳐서 보내고 있었어서,
그 직후 오는 `status` 메시지가 다시 지워버리는 경합이 발생했다(그리드 페이지의
`setConnStatus()`는 처음부터 올바르게 병합하고 있어서 이 버그가 없었다).

**해결**: `setStatus()`에서도 `setCounters({ ...status.counters, latencyMs:
status.latencyMs })`로 병합해서 넘기도록 한 줄 수정.

### 3-5. 변수 그리드에 사용자 정의 열(비고 등) 추가
G열(설정값)까지 고정되어 있던 것을, "열 추가" 버튼으로 임의 개수·이름의 열을 자유롭게
추가할 수 있게 확장했다.

- `sheet.insertColumnAfter()`로 새 열을 만들고 기본 헤더 텍스트(`열N`)를 넣어준다 — 사용자가
  1행 헤더를 원하는 이름(예: "비고")으로 직접 바꾼다.
- `readAllVariables()`가 G열 이후의 헤더 텍스트를 훑어서(`currentExtraHeaders`) 각 행의
  값을 `variable.extra = { [헤더명]: 값 }` 형태로 함께 수집한다.
- 저장 파일(`data/variables.json`)에 `extraHeaders` 배열을 추가로 저장해서, 변수가 하나도
  없어도(빈 그리드 상태) 열 구성 자체는 다음 로드 때 복원된다(`loadVariablesIntoSheet`).
  - `src/gridManager.js`에 `loadExtraHeaders()`를 새로 추가하고, `saveVariablesToFile
    (variables, extraHeaders)`로 시그니처를 확장했다.
- Excel/PDF 내보내기(`exportXlsx`/`exportPdf`)도 사용자 정의 열을 자동으로 포함하도록
  확장했다.

---

## 4. 지연시간 트렌드 팝업

지연시간 숫자가 폴링마다(초당 여러 번) 바뀌어 눈으로 읽기 어렵다는 피드백에 따라, "지연"
숫자를 클릭하면 뜨는 실시간 선 그래프 팝업을 추가했다(별도 차트 라이브러리 없이 캔버스로
직접 그림 — `public/app.js`, `grid-app/src/main.js` 양쪽에 동일한 로직을 중복 구현).

- **열기/토글**: "지연" 숫자 클릭 → 팝업이 열리며 자동으로 기록 시작. 팝업이 이미 열려
  있으면 클릭할 때마다 기록 실행/일시정지 토글.
- **팝업 컨트롤**: 시작/일시정지/정지(정지 시 데이터 초기화) 버튼, 닫기(✕) 버튼.
- **Y축**: 자동(데이터 범위에 여유를 두고 자동 스케일) ↔ 체크 해제 시 min/max 직접 입력.
- **X축**: "구간(초)" 입력으로 최근 N초 슬라이딩 윈도우(기본 60초)를 자동으로 보여줌.
- **드래그 이동**: 팝업 헤더(`.trend-header`)를 마우스로 잡고 끌면 위치 이동 가능
  (`mousedown`/`mousemove`/`mouseup`로 직접 구현, 닫기 버튼 클릭은 드래그로 취급하지
  않도록 예외 처리).

---

## 5. UI/디자인 표준

### 5-1. 테마 시스템 (라이트/다크/오렌지 선택형 — 10절 참고)
세 화면(`public/index.html`, `public/monitoring.html`, `grid-app/index.html`) 모두 CSS
커스텀 프로퍼티로 색을 정의하고, `:root`에 라이트 값을, `:root[data-theme='dark']`/
`:root[data-theme='orange']`에 각각 오버라이드하는 방식을 쓴다. `<head>` 최상단에 인라인
`<script>`로 `localStorage.getItem('plcTheme')`를 읽어 즉시 `data-theme` 속성을 적용해서
FOUC(테마 적용 전 깜빡임)를 방지한다. 세 페이지가 같은 origin이라 `localStorage` 키
(`plcTheme`)를 공유하므로, 한 곳에서 고른 테마가 나머지 페이지에도 그대로 적용된다.
테마 선택 UI는 버튼 토글이 아니라 `<select id="themeSelect">` 드롭다운(light/dark/orange).

**공통 토큰 목록** (세 페이지 모두 동일한 이름 사용, 값만 페이지마다 약간 다를 수 있음):

| 토큰 | 용도 |
|---|---|
| `--bg` | 전체 배경 |
| `--panel` | 패널/카드 배경 (헤더, 팝업 등) |
| `--panel-border` | 기본 테두리 |
| `--panel-border-strong` | (grid-app 전용) 더 진한 테두리 |
| `--text` / `--muted` | 기본 텍스트 / 흐린 텍스트 |
| `--accent` / `--accent-dim` | 강조색(연결됨, 활성 탭 등) / 그 배경톤 |
| `--warn` / `--error` | 경고 / 에러 색 |
| `--input-bg` / `--bg-alt` | 입력창 배경 / 보조 배경(서브 툴바 등) |
| `--danger-bg` / `--danger-text` | 위험 버튼 배경 / 그 위 텍스트 |
| `--primary-text` | accent-dim 배경 위에 쓰는 텍스트 |
| `--send-tag` / `--hex-text` | 통신 로그의 SEND 태그색 / hex 텍스트색 |
| `--mono` | 고정폭 폰트 스택 |

**주의**: 버튼 배경색(`--accent-dim`, `--danger-bg` 등)과 그 위 텍스트색(`--primary-text`,
`--danger-text`)은 반드시 **짝**으로 관리한다 — 라이트 모드에서 배경이 밝아지면 텍스트도
반드시 어두운 색으로 같이 바뀌어야 하므로, 텍스트 색을 하드코딩(`#eafff2` 등)하지 말고
항상 대응하는 텍스트 토큰을 쓸 것.

### 5-2. 공통 레이아웃 패턴
세 화면 모두 위에서부터 다음 순서의 가로 바(bar)들로 구성된다:

1. `<header>` — 페이지 제목(h1) + (오른쪽) 실시간 시계 + 테마 선택 드롭다운 + 화면 전환
   탭(`.page-tabs`, 3개 페이지 전부)
2. `.conn-toolbar` — 이 화면만의 독립 연결 UI: 호스트/포트/타입/연결·해제/상태 pill/카운터
3. (PLC 모니터링 화면만) `.area-tabs` — 메모리 영역 탭
4. `.sub-toolbar`/`.toolbar` — 화면별 기능 툴바(시작주소/페이지크기/데이터타입 또는
   시작/일시정지/정지/변수추가 등)

`header`는 `display:flex; justify-content:space-between;`으로 좌우 배치하되, 오른쪽
그룹(테마 버튼+탭)에는 **`margin-left:auto`를 반드시 함께 준다** — `space-between`만
믿으면 좁은 화면에서 줄바꿈(`flex-wrap:wrap`)이 일어났을 때 오른쪽 그룹이 새 줄의
왼쪽 끝에 붙어버릴 수 있는데, `margin-left:auto`가 있으면 줄바꿈이 일어나도 그 줄
안에서는 항상 오른쪽 끝으로 밀린다.

### 5-3. 화면 전환 탭 ("책갈피" 스타일)
헤더 오른쪽에 세 화면(PLC 모니터링 / 변수 관리 그리드 / 트렌드 모니터링)을 오가는 탭을
폴더 책갈피 모양으로 배치한다. 현재 페이지의 탭에 `.active` 클래스를 줘서 강조색 배경 + 위로
살짝 올라온(`top` 값을 줄여서) 형태로 표시한다.

```css
.page-tabs { display: flex; align-items: flex-end; gap: 2px; }
.page-tabs .page-tab {
  padding: 6px 14px; font-size: 12px; text-decoration: none; color: var(--muted);
  background: var(--bg-alt); border: 1px solid var(--panel-border); border-bottom: none;
  border-radius: 8px 8px 0 0; position: relative; top: 3px;
}
.page-tabs .page-tab.active {
  background: var(--accent-dim); color: var(--primary-text); font-weight: 700;
  border-color: var(--accent); top: 0; z-index: 1;
}
```

### 5-4. 카운터(숫자) 표시 규칙 - 자릿수 흔들림 방지
SEND/RECV/에러/지연 같이 실시간으로 자릿수가 바뀌는 숫자는 `<b>` 태그에 고정 폭을 줘서
옆 텍스트가 좌우로 밀리지 않게 한다.

```css
.counters b {
  display: inline-block; min-width: 3.5ch; text-align: right;
  font-variant-numeric: tabular-nums;
}
```

### 5-5. 실시간 갱신 + 사용자 편집 공존 화면의 원칙 (3-3 참고)
값이 초 단위로 갱신되는 화면에 사용자가 값을 입력/편집하는 UI를 같이 둘 때는, 반드시
"편집 중인 요소는 재갱신 시 건드리지 않는다"는 원칙을 지킬 것. 구체적 방법은 위 3-3
항목의 두 가지 패턴(에디터 상태 추적 후 전체 일시정지 / 뷰-키 비교 후 값만 부분 갱신)
중 상황에 맞는 쪽을 쓴다.

---

## 6. 알려진 제약사항 / 향후 과제

- **Univer 자체 툴바(리본)의 아이콘 반응형 접힘 동작은 우리가 직접 제어할 수 없다.**
  `@univerjs/preset-sheets-core`가 지원하는 공개 설정은 `ribbonType`
  (`'classic' | 'simple' | 'collapsed'`, 탭 자체의 스타일만 바꿈)뿐이고, 도구모음 아이콘이
  창 너비에 따라 `ResizeObserver`로 자동으로 "더보기(more)" 드롭다운에 접히는 로직은
  Univer 내부(`@univerjs/ui`의 `Ribbon` 컴포넌트)에 하드코딩되어 있어 끄는 옵션이 없다.
  "시작/수식/데이터" 탭이 항상 왼쪽 고정으로 보이는 반면 아이콘들이 창 크기에 따라
  움직이는 것처럼 보이는 건 이 때문이며, 우리가 만든 커스텀 UI(`.toolbar`,
  `.conn-toolbar` 등)와는 무관한 Univer 라이브러리 자체의 의도된 반응형 설계다. 굳이
  바꾸려면 Univer 내부 DOM 구조에 의존하는 비공식적인 CSS/JS 오버라이드가 필요한데,
  라이브러리 업데이트 시 깨질 위험이 커서 권장하지 않는다.
- **메모리 영역 최대 워드 수는 표준 스펙 기준 가정치**이며 실기로 경계값 검증이 필요하다
  (2-3 참고).
- **NX/NJ 시리즈 EtherNet/IP-CIP 지원은 실기 미검증** — 참조 캡처 없이 ODVA 공개 규격만
  근거로 구현됨 (9절 참고). 실기 확보 전까지는 "코드는 있으나 검증 안 된 기능"으로 취급할 것.
- **여러 브라우저 창에서 서로 다른 PLC에 동시 연결하는 기능은 아직 미구현** — 세션
  레지스트리 방식으로 설계 제안까지만 됨 (PROJECT_SUMMARY_AND_PROTOCOL.md 5절 참고).
- Univer 스프레드시트 캔버스(`#univer-container`, 흰 배경)는 라이트/다크 테마 토글
  범위 밖이다 — Univer 자체 테마 시스템이 따로 있어서, 이번 CSS 변수 토글로는 다루지
  않는다.

---

## 7. 파일 구조 (2026-07-15 세션 기준 추가/변경분)

```
src/plcSession.js        연결 세션 팩토리 (client/counters/latency/로그 관리, main/grid 공용)
src/memoryAreas.js        CPU 모델별 영역 목록/워드 크기 (순수 데이터, I/O 없음)
src/gridManager.js        (변경) index 기반 값 매핑, 사용자 정의 열(extraHeaders) 저장/불러오기/내보내기
src/server.js             (변경) activeView 기반 메모리 탐색기 폴링, mainSession/gridSession, 상호 배타적 연결
public/index.html, app.js PLC 모니터링 화면 - 메모리 탐색기, 트렌드 팝업, 책갈피 탭, 테마
grid-app/index.html,
  grid-app/src/main.js    변수 관리 그리드 - 독립 연결 UI, 사용자 정의 열, 트렌드 팝업, 책갈피 탭, 테마
```

---

## 8. 트렌드 모니터링 페이지 (신규 3번째 화면, `public/monitoring.html`/`monitoring.js`)

### 8-1. 세 번째 독립 연결 세션
그리드와 같은 패턴으로 `trendSession`(`src/plcSession.js` 재사용) + `trendManager.js`
(`gridManager.js`를 본떠 작성, 시계열 축적 추가)를 신설했다. USB 상호배타 로직
(`disconnectOtherSessions`)도 2자에서 3자로 확장 — 세 페이지 중 USB로 연결하려는 페이지가
있으면 다른 페이지 중 USB로 연결된 것만 끊고, UDP/TCP는 계속 완전 독립.

### 8-2. 서버측 시계열 버퍼 ("트렌드 진행 중 페이지 이동해도 안 사라지게")
처음엔 브라우저 탭의 JS 변수(`seriesBuffers`)에만 시계열을 쌓았는데, 다른 페이지로 이동했다
돌아오면 새로고침되어 그래프가 사라지는 문제가 있었다. **해결**: `trendManager.js`가 서버
쪽에 `valueHistory`(최근 3600개 포인트 캡)를 들고 있다가, 새 WebSocket 연결마다
`trendValuesHistory` 메시지로 통째로 넘겨준다 — 폴링 자체는 페이지 이동과 무관하게 서버에서
계속 진행되므로, 클라이언트는 그 기록을 받아 자기 버퍼를 복원하기만 하면 된다.

### 8-3. 다중 팝업 아키텍처
처음엔 팝업 하나만 띄울 수 있는 싱글턴 설계(`activeCanvas`/`popupSeriesIndex` 전역 변수)로
만들었으나, "변수마다 동시에 여러 개 팝업을 띄울 수 있어야 한다"는 요청으로 전면 재설계했다.
`createChartPopup(seriesIndex, savedState)` 팩토리가 완전히 독립된 클로저(자기만의
`draw()`/이벤트 핸들러/state 객체)를 만들고, `openPopups`라는 `Map`(key=seriesIndex)으로
관리한다. 각 팝업은 Total 트렌드와 동일한 기능(휠 줌, 드래그 팬/줌, 호버 툴팁, 우클릭 메뉴,
시작/일시정지/정지, Auto Fit/Y Set/X Set)을 전부 갖는다. 컨텍스트 메뉴 관련 헬퍼
(`makeItem`/`makeSep`/`closeCtxMenu`/`setCtxMenu`)는 모듈 스코프로 빼서 Total과 모든
팝업이 공유한다.

### 8-4. 팝업 상태 영속화 (페이지 이동 + 리사이즈)
`localStorage`(`plcTrendPopupsState`)에 열린 팝업들의 `yMode/yMin/yMax/xMode/xWindowSec/
mouseMode/showGrid/viewStatus/position/size` 등을 2초마다 저장하고, 페이지 로드 시
`restoreOpenPopups()`로 복원한다. 팝업 리사이즈는 커스텀 JS 없이 CSS `resize: both;
overflow: hidden;`만으로 구현 — 캔버스는 매 `draw()` 호출마다 `getBoundingClientRect()`로
현재 크기를 다시 재는 기존 로직이 그대로 대응한다.

### 8-5. 우클릭 메뉴가 트렌드 진행 중에만 바로 사라지는 버그
**증상**: 트렌드가 "시작" 상태일 때 우클릭 메뉴가 뜬 직후 마우스를 움직이면 바로 닫힘 —
"일시정지" 상태에서는 재현 안 됨.

**원인**: `document.addEventListener('scroll', closeMenu, true)`(페이지 스크롤 시 메뉴를
닫으려는 의도)가 통신 이력 로그 리스트의 **프로그래밍적 자동 스크롤**(`appendLog()`의
`logList.scrollTop = logList.scrollHeight`)도 캡처링 단계에서 같이 잡아버렸다. 폴링 중에는
매 사이클마다 새 로그가 쌓여 스크롤 이벤트가 계속 발생하므로 메뉴가 열리자마자 닫혔고,
일시정지 중에는 새 로그가 안 쌓이니 재현되지 않았다.

**해결**: 스크롤 시 메뉴를 닫는 리스너를 완전히 제거.

### 8-6. 개별 저장 vs Total 저장 분리 (CSV 자동 기록)
`trendManager.js`의 `stop()`(실제 폴링 정지)이 정지 시점에 그동안 쌓인 기록을
`logs/trend/Trend_시작시간_종료시간.csv`로 자동 저장한다. 처음엔 이 함수가 전체 변수 목록을
순회하며 변수별 파일까지 한 번에 다 저장했는데, "개별 팝업의 정지 버튼을 누르면 그 변수
하나만 저장돼야 한다"는 요청으로 분리했다:
- **Total 저장**: 실제 폴링 정지(`POST /api/trend/stop`) 시에만, `saveHistoryLogs()`가
  Total 파일 하나만 저장
- **개별 저장**: 각 팝업의 "정지" 버튼(순수 클라이언트 뷰 상태, 실제 폴링과 무관)이 자기
  버퍼(`seriesBuffers[seriesIndex]`)를 `POST /api/trend/history/save-single`로 보내
  `saveSingleSeriesLog()`가 그 변수 하나만 저장
- 파일명 형식: `주소(설명)_시작시간_종료시간.csv` (예: `CIO0(PT4)_20260716_081528_20260716_082200.csv`)
  — 저장 "누른 시각"이 아니라 그 기록의 **실제 첫/마지막 데이터 시각**을 쓴다

**⚠️ 사고 기록**: 이 기능을 테스트하던 중 fake 테스트 스크립트가 실수로 실제
`data/trendVariables.json`(진짜 변수 목록)을 테스트 데이터로 덮어쓴 적이 있다. **트렌드/
그리드 변수 목록 파일에 쓰기 작업을 하는 스크립트는 실행 전 반드시 파일을 백업할 것.**

### 8-7. 팝업/Total 정지 버튼은 "뷰 상태"이지 실제 폴링 제어가 아님
각 팝업과 Total의 시작/일시정지/정지 버튼은 `state.viewStatus`라는 **클라이언트 전용** 상태를
바꿀 뿐, 실제 PLC 폴링(서버 쪽 전역 메커니즘, `trendManager.js`)은 건드리지 않는다. 팝업을
"일시정지"해도 서버는 계속 폴링하고 있고, 그 팝업만 화면 갱신을 멈춘 것이다. 실제 폴링을
멈추는 건 상단 툴바의 전체 시작/일시정지/정지뿐이다.

### 8-8. 로그 패널 2분할 (통신이력 / PLC 에러 로그)
`public/index.html`의 하단 로그 영역을 `.log-panel`로 좌우 2분할했다 — 왼쪽 "통신 이력",
오른쪽 "PLC 에러 로그"(각자 자기 버튼을 자기 패널 우측 상단에 둠). 처음엔 모달(팝업창)
방식으로 만들었다가, "분할해서 항상 보이게 해달라"는 요청으로 다시 인라인 분할로
바꿨다(`#errorLogModal` 제거). 두 컬럼 다 `#logSplitter`/`#errorLogSplitter`로 마우스
드래그 폭 조절 가능하며, `localStorage`(`plcLogPanelHeight`/`plcErrorLogColWidth`)에
저장되어 페이지 이동 후에도 유지된다.

---

## 9. NX/NJ 시리즈 EtherNet/IP(CIP) 지원 추가

CJ 시리즈 전용이던 프로젝트에 Omron NX/NJ 시리즈(EtherNet/IP 내장) 지원을 추가했다.
`src/nxCipClient.js`가 CIP 캡슐화 프로토콜(세션 등록/Unregister, Multiple Service Packet)을
구현하고, `src/plcSession.js`의 `connect()`가 `series: 'NX'`를 받으면 FINS 클라이언트 대신
이 클라이언트를 생성한다 — **세션/카운터/로그 관리 팩토리는 그대로 재사용**되고 프로토콜
구현체만 바뀌는 구조다. CJ의 "영역+주소" 대신 "태그 이름" 하나로 접근하므로 변수 스키마가
다르고(`src/nxTags.js`, `data/nxTags.json`), 새 엔드포인트 `GET/POST /api/nx/tags`,
`POST /api/nx/tags/read`, `POST /api/nx/tags/write`를 메인 대시보드에 추가했다.

**⚠️ 실기 미검증**: CJ 프로토콜은 Wireshark로 실제 캡처한 데이터로 역공학·검증했지만, NX/NJ는
참조용 실기 캡처가 없는 상태에서 ODVA 공개 규격 문서만 근거로 구현했다. 실기 확보 시 가장
먼저 확인할 것: 단일 태그 읽기 → Multiple Service Packet 다중 태그 읽기 → 태그 쓰기 순서로
검증.

---

## 10. 테마 시스템: 라이트/다크 토글 → 3색 선택형으로 확장

기존에는 `<button id="themeToggle">`로 라이트/다크만 토글했는데, "테마 변경을 색상 선택형
드롭다운으로 개선해달라"는 요청에 따라 `<select id="themeSelect">`(light/dark/orange)로
바꿨다. `:root[data-theme='orange']` CSS 블록을 3페이지(+grid-app) 모두에 추가하고,
`localStorage.getItem('plcTheme')`가 여전히 한 origin에서 공유되므로 한 페이지에서 고른
테마가 나머지 페이지에도 그대로 적용된다. 처음 오렌지 테마 색상이 분홍빛으로 보이는 버그가
있어서 강조색/시계 그라데이션 값을 순수 오렌지 계열(`#d2691e` ~ `#ffb400`)로 다시 조정했다.

DATA_TYPES 배열도 이 기회에 재정렬 — 기존에는 WORD가 맨 앞이었는데, INT를 맨 앞으로
옮겼다(3페이지 + grid-app 4곳 모두 동일하게 반영).

---

## 11. Windows 설치 프로그램 (`installer/`, `scripts/build-installer.ps1`)

### 11-1. 왜 필요했나
신규 PC에서 개발 환경(Node.js, Build Tools, Python, Zadig 수동 설정)을 전부 갖추는
`docs/NEW_PC_SETUP_GUIDE.md`의 수동 과정 대신, "설치 파일 하나 실행하면 끝"이 되는 배포
방식을 요청받았다.

### 11-2. 패키징 방식 — 포터블 Node 폴더 + Inno Setup
`usb`(node-usb) 네이티브 모듈 때문에 `pkg` 같은 단일 exe 압축 방식은 네이티브 addon 분리가
까다롭고 깨지기 쉬워서 피했다. 대신:
- `node.exe`(현재 개발 PC의 것, 단일 파일로 완전히 독립 실행 가능)를 그대로 복사
- `src/`, `public/`, `node_modules/`(이미 빌드된 `usb`의 win32-x64 N-API 프리빌드 포함),
  `data/`(현재 변수 목록을 기본값으로 포함), `package.json`을 통째로 스테이징
- `usb` 패키지는 **N-API 기반**이라 Node 버전에 상관없이 동작 — ABI 호환성 걱정 없음
- Inno Setup(`installer/setup.iss`)으로 위 폴더 전체를 인스톨러 하나로 감쌈
- 설치 위치는 관리자 권한이 필요 없는 `{localappdata}\PLC Monitoring`으로 기본 설정 —
  앱이 실행 중 계속 `data\`/`logs\`에 파일을 쓰기 때문에, Program Files처럼 일반 사용자가
  못 쓰는 폴더에 두면 실행 중 쓰기 실패가 남

### 11-3. USB WinUSB 드라이버 자동화 — 완전 무클릭은 불가능
`wdi-simple.exe`(libwdi 커맨드라인 도구)로 완전 자동 설치를 시도했으나, 이 도구는 사전
빌드된 배포판이 없고 Windows Driver Kit(WDK) + Visual Studio로 직접 빌드해야 하며, 빌드해도
결국 자체 서명 인증서를 만들어 신뢰하는 과정이 필요해 "완전 무클릭"은 Windows 드라이버 서명
정책상 애초에 불가능하다는 결론. 대신:
- Zadig(`installer/driver/zadig.exe`, 서명 확인함 — Akeo Consulting)를 그대로 번들
- `zadig.ini`를 미리 만들어 넣어서(`advanced_mode=true`, `list_all=true`,
  `default_driver=0`=WinUSB) Zadig을 열자마자 "모든 장치 보기 + WinUSB 기본 선택" 상태가
  되게 함 — `zadig.ini`는 zadig.exe와 같은 폴더에 있으면 시작 시 자동으로 읽힌다
  (`zadig.c`의 `parse_ini()`, `INI_NAME = "zadig.ini"`로 하드코딩됨을 소스에서 확인)
- 남은 사용자 작업은 "목록에서 장치 선택 + Install Driver 클릭" 단 2번뿐
- `zadig.exe`는 매니페스트에 `requestedExecutionLevel="requireAdministrator"`가 박혀있어
  실행되는 순간 자체적으로 UAC 창이 뜬다 — 그래서 인스톨러 본체는
  `PrivilegesRequired=lowest`로 관리자 권한 없이 진행해도 무방함 (처음엔 `admin`으로
  했다가, Inno Setup이 "admin 권한 + localappdata 설치는 충돌 소지가 있다"는 경고를
  띄워서 `lowest`로 수정)

### 11-4. 검증
`/VERYSILENT` 무음 설치 → 설치된 폴더에서 `node.exe src\server.js` 직접 실행 → 3페이지
모두 200 응답 확인 → 언인스톨러 실행 → 폴더 깨끗이 삭제 확인, 순서로 전체 파이프라인을
실제로 테스트했다. (테스트 중 로그 파일 경로를 `C:\` 드라이브 루트로 잘못 잡아서
"액세스가 거부되었습니다" 에러가 났던 것은 테스트 스크립트 자체의 실수였고, 실제 설치
프로그램 로직 문제는 아니었음 — 일반 사용자 권한으로 `C:\` 루트에 파일을 못 쓰는 것은
Windows의 정상 동작.)

---

## 12. 설정 페이지 / PLC 정보 팝업 / 그리드 스냅샷·비교판정 / 메모리 영역별 개별 설정 /
    수동 폴링 제어 (2026-07-17 세션)

이번 세션에서 4번째 화면(설정)과 그리드 페이지의 대규모 기능 확장, 메인 대시보드의
메모리 탐색기 구조 개선을 진행했다. 사용자 요청 항목별 완료 체크리스트는
`docs/HANDOFF.md`의 "작업 요청 체크리스트" 절을 참고 — 여기서는 설계/원인 위주로만 정리한다.

### 12-1. 설정 페이지 신설 (`public/settings.html`/`settings.js`, `src/settingsManager.js`)
앱 전역 설정(내보내기 파일명 접두사, 스냅샷 폴더, 재연결 동작, 리포트 로고/제목 등)을
그동안 코드에 흩어져 있던 상수 대신 **`data/settings.json` 한 파일**로 관리하도록
`settingsManager.js`를 새로 만들고, 4번째 화면(`settings.html`)에서 폼으로 편집 후
`GET/POST /api/settings`로 저장한다. 테마 선택(`plcTheme`, 10절)과는 별개 — 테마는
`localStorage`, 이 설정들은 서버측 파일이다.

### 12-2. PLC 상세 정보 팝업 (`public/plcInfo.js`, `src/finsCommands.js`)
헤더의 CPU 정보 텍스트를 클릭하면 뜨는 팝업으로, CX-Programmer의 "PLC 정보" 창처럼
CPU 유닛 상세(모델/버전/스캔타임/메모리 사용량 등)를 조회한다. `finsCommands.js`가
CJ 시리즈 FINS 공통 명령(상태 읽기, CPU 유닛 데이터 읽기 등)을 캡슐화하고, `plcInfo.js`는
자체적으로 모달 DOM/스타일을 주입하므로 각 페이지는 `<script src="plcInfo.js">` 한 줄만
추가하면 된다(3페이지 + 설정 페이지까지 총 4페이지에 삽입).

### 12-3. 그리드 스냅샷/비교판정 시스템
"레시피 적용 및 스냅샷 비교" 기능 — 그리드에 시작(J열)/종료(K열) 스냅샷 값과 비교판정
결과(L열)를 저장할 열을 추가하고, 각 행(변수)에 "선택" 체크박스(A열 앞)를 둬서 비교
대상을 고를 수 있게 했다.
- **전체선택/전체해제**: 선택 열의 모든 체크박스를 일괄 on/off. `setAllChecks(checked)`
  공용 헬�퍼로 두 버튼이 로직을 공유한다.
- **스냅샷**: 선택된 행들의 "현재값"을 시작(J) 또는 종료(K) 열에 기록 (버튼 2개, 서버에
  저장 API 있음).
- **비교판정**: J/K 스냅샷 값을 비교해서 일치/불일치를 L열과 결과 팝업에 표시. 결과 팝업은
  처음엔 고정 크기/위치였다가, 이번 세션에 CSS `resize: both` + 커스텀 드래그(마우스
  down/move/up, `#compareResultHeader`를 손잡이로 사용)로 크기조절·이동 가능하게 개선했다.
- **JKL 초기화 버튼**: 스냅샷 버튼 바로 다음에 위치, `sheet.getRange(startRow,
  SNAP_START_COL, count, 3).clearContent()`로 J~L 3열을 한 번에 지운다.
- **불러오기/내보내기**: 그리드 페이지 이름과 함께 리포트 내보내기 흐름을 "템플릿
  내보내기"에서 "비교판정 리포트 내보내기"로 전환.

### 12-4. 메모리 탐색기 — 영역별 개별 설정 (`areaViews`, 근본 원인 수정)
**증상**: 시작주소/페이지크기를 영역(D/H/W/CIO/EM)마다 다르게 설정하고 싶은데, 한 영역에서
바꾸면 다른 영역을 선택했을 때도 그 설정이 그대로 적용되어 있었다(사실상 전역 설정 하나를
모든 영역이 공유).

**원인 (두 가지가 겹쳐 있었음)**:
1. 서버(`src/server.js`)가 활성 뷰를 `activeView` **객체 하나**로만 들고 있어서, 영역이
   바뀌어도 이전 영역의 `startAddr`/`pageSize`/`dataType`이 그대로 이어졌다.
2. 클라이언트(`public/app.js`)의 영역 탭 클릭 핸들러가 `sendViewChange({ area: a.key,
   startAddr: 0 })`처럼 **이전 영역의 나머지 설정값(`clientView`)을 그대로 펼쳐서** 새
   영역 요청에 같이 보내고 있었다 — 서버가 영역별로 값을 나눠 저장하게 고쳐도, 클라이언트가
   매번 "이 값 그대로 새 영역에도 적용해줘"라고 보내는 셈이라 증상이 없어지지 않았다.

**해결**:
```js
// src/server.js
function defaultAreaView() {
  return { startAddr: 0, pageSize: 128, dataType: 'WORD', length: 1 };
}
const areaViews = { D: defaultAreaView() };
let currentAreaKey = 'D';
function getActiveView() {
  if (!areaViews[currentAreaKey]) areaViews[currentAreaKey] = defaultAreaView();
  return { area: currentAreaKey, ...areaViews[currentAreaKey] };
}
```
`POST /api/memory/view`가 `areaViews[areaKey] || defaultAreaView()`를 기준으로 병합하고,
결과를 `areaViews[areaKey]`에 저장 + `currentAreaKey`만 갱신하도록 바꿨다.

```js
// public/app.js
async function sendViewChange(patch) { await postViewChange({ ...clientView, ...patch }); } // 같은 영역 내 설정 변경(시작주소/페이지크기/타입)
async function sendAreaChange(areaKey) { await postViewChange({ area: areaKey }); } // 영역 탭 전환 — 이전 설정을 절대 같이 보내지 않음
```
영역 탭 클릭은 `sendAreaChange(a.key)`만 호출하도록 바꿔서, 서버가 그 영역에 저장해 둔
마지막 설정을 그대로 돌려받게 했다. 이제 D에서 시작주소 100·페이지 64로 설정하고 W로
넘어가 시작주소 0·페이지 128로 설정한 뒤 다시 D로 돌아오면, D의 설정(100/64)이 그대로
복원된다 — 다른 페이지를 갔다 와도 서버가 `areaViews`를 들고 있으므로 유지된다.

### 12-5. 메인 대시보드 — 수동 폴링 시작/정지 (`pollStatus` 상태 머신)
**변경 이유**: 기존에는 연결되자마자 메모리 값을 자동으로 읽기 시작했는데, 그리드/트렌드
페이지처럼 "연결 → (설정 확인) → 시작 버튼으로 직접 폴링 시작"이 필요하다는 요청.

그리드(`gridManager.js`)/트렌드(`trendManager.js`)가 이미 쓰고 있던 `'stopped' |
'running' | 'paused'` 상태 머신 패턴을 메인 대시보드에도 동일하게 적용했다(`pollStatus`
전역 변수 + `startPolling`/`pausePolling`/`stopPolling` 함수 + `/api/poll/start`,
`/api/poll/pause`, `/api/poll/stop` 라우트). `/api/connect`에서 자동으로 폴링을 시작하던
호출(`if (status.plcSeries !== 'NX') startPolling();`)을 제거해 "연결 ≠ 폴링 시작"이
되도록 분리했다. CSV 자동 기록은 `stopped→running` 전환에서만 새 파일을 열고,
`paused→running`(재개)에서는 기존 파일에 이어 쓴다 — 그리드/트렌드와 동일한 규칙.

### 12-6. 전체 값 채우기 (입력칸만 채움, 즉시 PLC 쓰기 아님)
"전체 값 채우기" 버튼 + 입력값(기본 "0")을 내보내기 버튼 바로 왼쪽에 추가했다. 클릭하면
현재 페이지에 표시된 모든 셀의 **입력칸(설정값 열)만** 그 값으로 채운다 — 실제 PLC에는
기존 [값 적용(쓰기)] 버튼을 별도로 눌러야 반영된다. (사용자에게 "입력칸만 채우고 [값
적용]은 따로 누르게 함" vs "바로 PLC에 씀" 중 선택하게 물어봤고, 안전한 전자를 선택함 —
실수로 전체 영역에 잘못된 값을 즉시 쓰는 사고를 방지하기 위함.) BOOL 모드는
`editedBits`, 나머지 타입은 `editedCells`/`cellRefs`를 채우는 방식으로 기존 "값 적용"
흐름을 그대로 재사용한다.

### 12-7. 내보내기 저장 위치 선택 + 파일명 규칙 통일
메모리 탐색기 내보내기(`GET /api/memory/export/xlsx`)가 기존에는 `window.location.href`로
바로 다운로드했는데, 그리드 페이지가 이미 쓰고 있던 File System Access API
(`window.showSaveFilePicker`) 패턴을 재사용해 저장 위치를 직접 고를 수 있게 했다
(`saveBlobWithPicker()` 헬퍼, 미지원 브라우저는 앵커 다운로드로 폴백, 사용자 취소 시
`AbortError`를 조용히 무시). 파일명은 `MEM_{영역}_{타임스탬프}.xlsx` 형식으로 통일했고
(`areaFileLabel()`이 D→"DM"으로 매핑, 나머지는 영역 코드 그대로), 한글 파일명이 섞여도
깨지지 않도록 기존 `setDownloadFilename()`(RFC 5987 `filename*=UTF-8''...` 인코딩)을
그대로 재사용했다.

### 12-8. 연결 버튼 방어적 강화 (트렌드 페이지 응답 없음 버그 대응)
**증상 보고**: 다른 페이지에서 이미 연결된 상태에서 트렌드 페이지의 연결 버튼(USB/UDP/TCP
공통)을 누르면 반응이 없고, 통신이력에도 아무 데이터가 안 남으며, 새로고침해야만 버튼이
다시 활성화됐다.

**재현 시도**: 실제 하드웨어(UDP, 192.168.0.80)로 메인 페이지 연결 후 트렌드 페이지에서
UDP/USB 연결을 시도하는 등 여러 시나리오로 재현을 시도했으나, 자동화 테스트에서는
재현되지 않았다(정확한 트리거를 특정하지 못함).

**방어적 조치**: 가장 유력한 두 원인(동시 연결 시도로 인한 경합, 네트워크 응답이 영원히
안 오는 경우 UI가 멈춰버림)을 겨냥해 세 페이지(main/grid/trend) 공통으로 다음을 추가했다:
- `plcSession.js`: `state.connecting` 가드 플래그로 동시 `connect()` 재진입을 막고,
  `withTimeout(promise, 8000, msg)`로 `client.connect()`/`readControllerData()`를
  8초 타임아웃으로 감쌈 — 응답이 영원히 안 오는 상황에서도 결국 에러로 풀려나게 함.
- 클라이언트(`app.js`/`monitoring.js`/`main.js`): `AbortController` 기반 fetch 타임아웃 +
  `try/catch/finally`로 감싸고, 성공/실패/타임아웃 **무엇이든** `finally`에서 서버에
  현재 상태를 다시 물어봐(`fetchConnStatus()` 등) 버튼 활성화 상태를 강제로 동기화한다.

⚠️ **정직한 한계**: 정확한 원인을 특정해서 고친 것이 아니라, 발생 가능한 원인들을 막고
"버튼이 멈춘 것처럼 보이는 증상" 자체를 구조적으로 재발하지 않도록 만든 방어적 수정이다.
같은 증상이 다시 나타나면 이 절을 우선 의심하되, 통신이력 로그와 서버 콘솔을 같이 확인할 것.

### 12-9. 용어 통일 — 트렌드 페이지 "인터벌" → "폴링주기"
다른 두 페이지(메인/그리드)가 이미 "폴링주기"라는 용어를 쓰고 있어서, 트렌드 페이지의
"인터벌" 라벨과 도움말 텍스트를 동일하게 "폴링주기"로 맞췄다(기능 변경 없음, 표기만 통일).
