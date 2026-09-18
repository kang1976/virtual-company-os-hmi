# GMS 조작화면 — 아키텍처 문서 (GMS 관련 작업의 단일 참고 문서)

이 파일은 GMS(Gas Monitoring System) 조작화면 작업 전체의 **단일 참고 문서**다. `gms.html`의
**조작화면**(진행 메뉴 → 메인 메뉴 → 실린더 교환/유지보수/가스공급으로 이어지는 자동 진행
시퀀스, Status/PASSWORD 상태 머신)과, 그 위에서 실제 밸브/타이머/판정 로직을 수행하는
**서브시퀀스 실행 엔진**(SUBSEQ_NS 패턴, 11절) 두 계층을 모두 다룬다. `.claude/agents/`의
planner·implementer 에이전트도 이 문서를 참조한다 — 관례를 바꿀 땐 이 문서 하나만 고치면
된다(에이전트 파일에는 복붙하지 않는다). PLC 모니터링/그리드/트렌드 등 GMS 이외의 앱 구조는
프로젝트 루트 `CLAUDE.md` 참고. 전체 진행 상태·남은 일 요약은 `docs/PLAN.md` 참고(이 문서는
"어떻게 동작하는지"를, PLAN.md는 "어디까지 됐는지"를 다룬다).

## 1. 핵심 파일

| 파일 | 역할 |
|---|---|
| `public/gms.html` | 조작화면 전체 골격 — 우측 CYLINDER STEP STATUS 패널(상단 작은 배지 바), 각 하위 화면의 **빈 컨테이너 div**(`id="progress...Body"`)들이 전부 여기 있다. 실제 내용은 `OPERATION HTML/*.html`을 fetch해서 주입 |
| `public/Operation.js` | **이 문서가 다루는 로직 전부**가 여기 있다 — 화면 전환, Status(진행 단계) 상태 머신, PASSWORD 게이트, 옵션 반영. `gms.js` 다음, `gms-editor.js` 이전에 로드됨 |
| `public/gms.js` | 배관도(P&ID) 렌더링, 밸브/PT 값, 연결/폴링, 알람 이력, **OPTION 탭(우측 패널) 옵션 전체**(VT 사용/GC Type/각 PASSWORD 게이트 개별 토글) |
| `public/OPERATION HTML/*.html` | 화면 하나당 파일 하나 — Figma 등에서 화면별로 따로 열어 디자인만 편집 가능. `../gms.css`를 그대로 참조(복사 아님) |
| `public/gms.css` | 공용 스타일 — `.step-badge-lg`(큰 배지), `.valve-turn-icon`/`.gas-flow-icon`(밸브 회전/가스 흐름 장식 아이콘), `.gas-readout-*`(계측값 목록) 등 |

## 2. 상태 모델 (Status 시스템)

### 2.1 `CYLINDER_STEP_ORDER` (Operation.js)

```js
['IDLE', '1P', '-L', '-VT', '2P', 'CC', '3P', '+L', '-VT', '4P', 'PC', 'READY', 'Service']
```

- **배열 위치(인덱스)가 곧 진행 순서**다. `-VT`가 두 번 나오므로(교환전 index 3 / 교환후
  index 8) **텍스트로 찾지 말고 항상 인덱스로 구분**할 것 — 안 그러면 `indexOf`가 항상
  첫 번째(교환전)만 찾아서 교환후 화면이 깨진다. 이미 여러 번 겪은 버그이니 새 코드를
  추가할 때 반드시 주의.
- `cylinderCurrentStepIndex = { A: number, B: number }` — A/B 측 각각 현재 Status의
  인덱스. 기본값은 둘 다 `0`(IDLE) — **절대 데모용으로 한쪽만 다른 값으로 미리 채워두지
  말 것**(과거에 A만 1P로 미리 채워뒀다가 "취소 눌렀는데 IDLE이 아니라 1P로 보인다"는
  버그가 났었다).
- `CYLINDER_STEP_LABELS`: 각 Status 코드의 한글 풀네임(우측 "A : ○○" 텍스트, 조작화면
  상태박스에 쓰임). READY=`공급준비`, Service=`가스공급`.

### 2.2 "완료(.done)" vs "진행 중(.blinking)" 배지 규칙

각 화면 상단의 큰 배지(`.step-badge-lg`, 예: `1P -L -VT 2P`)는:
- **`.blinking`** = 현재 화면이 표시 중인 바로 그 Status.
- **`.done`**(적색 채움, 점멸 없음) = **그 스텝을 실제로 정상 완료했을 때만**. 단순히
  "현재 인덱스보다 앞선 위치"라고 무조건 채우지 않는다 — `completedStatusSteps = { A: Set,
  B: Set }`에 `markStepComplete(side, idx)`로 명시적으로 기록된 인덱스만 `.done`이 된다.
  **Status Jump**(아래 4절)로 건너뛴 스텝은 이 Set에 없으므로 색이 채워지지 않는다(사용자가
  명시적으로 요구한 규칙 — "정상 진행 안 하고 Jump했으면 색이 있으면 안 된다").
  `resetCylinderStepStatus(side)`가 IDLE로 되돌릴 때 이 Set도 함께 비운다.
  `markStepComplete`는 각 단계의 **실제 "실행"/PASSWORD 확인 성공 지점**에서만 호출한다
  (버튼 클릭 시점이 아니라 — PASSWORD가 걸린 전환은 취소 가능하므로 **advance 함수 안**에서
  호출해야 한다).
- 상단 CYLINDER STEP STATUS 패널의 작은 배지(`#cylStepBadgesA/B`)는 다른 규칙 —
  IDLE부터 현재 인덱스까지 **무조건 누적 점등**(`i <= idx`, DOM 자식 위치 기반이라 `-VT`
  중복 문제 없음). 이건 그대로 둔 의도적 설계(고수준 진행률 표시).

### 2.3 화면 ↔ Status 매핑

두 개의 독립된 "단계 배열"이 있다 — 서로 다른 배열이라 원소를 공유하지 않는다:

- **`CYL_EXCHANGE_PURGE_STEPS`**: 교환전(1P~2P) → 용기교체(CC) → 교환후(3P~PC)까지 한
  배열에 순서대로 들어있다(실제 진행은 항상 `findIndex`로 key를 찾아 이동하므로 배열
  순서 자체가 순서를 강제하진 않는다). `showProgressCylExchangePurgeStep(index)`가
  화면 전환 + `CYL_STEP_STATUS_MAP`으로 Status 인덱스 갱신을 같이 한다.
- **`GAS_SUPPLY_STEPS`**: 가스공급 준비 7단계(압력확인~준비완료). Status와 무관하게
  진행하다가 **`gasSupplyReady`(마지막) 화면에 들어올 때만** Status를 READY로 올린다.
  `showProgressGasSupplyStep(index)`가 담당.
- **Service(가스공급 중)**과 **READY(가스공급준비)**는 위 두 배열 어디에도 속하지 않는
  "독립 화면"이다 — `showProgressGasSupplyActive(side)` / `showProgressGasSupplyStep`이
  직접 `showProgressScreen()`을 호출한다. Status Jump·B선택 계열 함수(`performStatusJump`,
  `showScreenForSideStatus`)에서 `CYLINDER_STEP_ORDER[idx] === 'Service'` /
  `=== 'READY'`를 **별도로 특수 처리**해준다 — `STATUS_JUMP_TARGETS` 배열(교환전/CC/교환후
  전용, 인덱스 0~10만 커버)에는 안 들어있다.

## 3. 전체 화면 흐름

```
[진행 메뉴] --"A/B 진행"--> [메인 메뉴]
  ├─ "실린더 교환" --PASSWORD(cylinderExchange)--> [실린더 잠금 check] (Status IDLE)
  │     "실행" --> 교환전 1P 5단계(잔류가스Check→PulseVent→2차측Purge→Pumping→1차측Purge)
  │     └─"실행"(1차측 Purge) --> [감압시험](-L)
  │           "실행" --VT옵션 적용--> [VT 감압시험](-VT, 교환전) --"실행"--> [2차 배관청소](2P)
  │           "실행" --VT옵션 미적용--------------------------------------> [2차 배관청소](2P)
  │                 "실행" --PASSWORD(cylinderExchangeDone)--> 용기교체(CC) 6단계
  │                     실린더 확인 → Valve Open 확인 → Auto Guard 확인(Open)
  │                     → 실린더 분리 및 교체 → Gas name 확인 → Auto Guard 확인(Close)
  │                     ("실린더 확인" 화면의 "Force Purge" 버튼 → 별도 화면, 취소 시 복귀)
  │                     "확인"(Auto Guard Close) --PASSWORD(cylReplaceDone)-->
  │                 교환후 4단계: [3차 배관청소](3P) --"실행"--> [가압시험](+L)
  │                     "실행" --VT옵션 적용--> [VT 감압시험](-VT, 교환후) --> [4차 배관청소](4P)
  │                     "실행" --VT옵션 미적용-------------------------------> [4차 배관청소](4P)
  │                         "실행" --PASSWORD(exchangeFourthPurgeDone)-->
  │                     [퍼지완료/가스공급 메뉴](PC) — 헤더 "[측] 가스 공급"
  │                         메인 메뉴와 같은 버튼 구성(가스공급/"B"선택/유지보수/TREND/보조메뉴/취소)
  │                         "취소"는 2단 확인(한 번은 경고 토스트만, 두 번째에 IDLE+메인메뉴)
  │
  └─ "유지 보수" --PASSWORD(mainMenu)--> [유지보수 메뉴] (수동밸브조작/바코드체크/Maintenance Purge)

[퍼지완료/가스공급 메뉴]의 "가스공급" --PASSWORD(gasSupplyEntry)--> 가스공급준비 7단계
  압력확인(4버튼:가스공급/조정모드/LineVent/취소) → Valve shutter 장착 → Regulator Close
  → Cylinder Open → Regulator 조정 → PMV Open 확인 → [가스공급준비 완료](READY, "공급준비")
      "확인" 시 GC Type 옵션 확인(6.3절) --> [가스공급 중](Service, "가스공급")
          버튼: 일시정지/공급중지/강제교체(전부 PASSWORD→재확인창)/"B"선택/강제교체/보조메뉴/TREND
          일시정지 실행 --> [퍼지완료/가스공급 메뉴](PC)로 복귀
          공급중지 실행 --> IDLE + 메인 메뉴
          강제교체 실행 --> 이 측 IDLE+메인메뉴, 반대 측 [가스공급 중] 화면으로 전환
```

**Status Jump**: 우측 CYLINDER STEP STATUS 패널의 작은 배지를 클릭하면(옵션 적용 시
PASSWORD 확인 후) 그 Status의 "첫 화면"으로 조작화면이 바로 이동한다(4절).

## 4. Status Jump / "B"·"A" 선택 (측 전환) 공통 로직

실행을 여러 번 눌러 단계를 하나씩 밟지 않고 원하는 화면으로 바로 이동하는 두 가지 진입점이
있고, 둘 다 같은 두 헬퍼 함수를 쓴다:

- **`performStatusJump()`** — 상단 배지를 **클릭**했을 때(`requestStatusJump(side, idx)`가
  호출). Status를 **실제로 바꾼다**(IDLE로 점프하면 `resetCylinderStepStatus`로 초기화까지
  함). PASSWORD 게이트 `statusJump` 옵션 적용 시 비밀번호 확인 후 진행.
- **`showScreenForSideStatus(side)`** — "B"/"A" 선택 버튼(메인 메뉴, PC/가스공급 화면,
  가스공급 중 화면에 각각 있음)이 호출. **Status를 건드리지 않고** 그 측의 "현재 실제
  Status"에 해당하는 화면을 그대로 보여주기만 한다(양쪽 진행 상태 완전 보존 — "상태 유지").
  PASSWORD 없음.
  - `IDLE`/`CC` → 메인 메뉴(재개는 반드시 "실린더 교환" 버튼 + PASSWORD를 거쳐야 함 —
    `advanceCylinderExchangeEntry()`가 Status가 CC면 실린더 확인 화면으로, 아니면 실린더
    잠금 check로 보낸다)
  - `Service` → `showProgressGasSupplyActive(side)`
  - `READY` → `showProgressGasSupplyStep(...gasSupplyReady...)`
  - 그 외(1P~4P, PC) → `STATUS_JUMP_TARGETS[idx]`로 `CYL_EXCHANGE_PURGE_STEPS`에서 찾아 이동
  - 대응하는 화면이 아예 없으면(현재는 없음) 메인 메뉴로 대체

**새 Status/화면을 추가할 때 이 두 함수 모두에 분기를 추가해야 한다** — 하나만 고치면
배지 클릭과 "B"선택 버튼의 동작이 서로 달라지는 버그가 난다(실제로 이 세션에서 한 번
발생 — Service 버튼 라벨이 안 바뀌던 것과는 별개로, 처음엔 `showScreenForSideStatus`에만
분기를 넣고 `performStatusJump`를 깜빡했었다. 지금은 둘 다 맞춰져 있음).

## 5. PASSWORD 게이트 시스템 (전부 개별 옵션화됨)

**모든** PASSWORD 진입점이 `proceedPastPasswordGate(gateKey, directAction)` 한 함수를
거친다:

```js
function proceedPastPasswordGate(gateKey, directAction) {
  if (passwordGateEnabled(gateKey)) showProgressPassword(gateKey);
  else directAction();
}
```

`passwordGateEnabled(key)`(gms.js)가 OPTION 탭의 개별 토글 값을 읽는다 — **각 게이트마다
"적용"(기존처럼 PASSWORD 확인)/"미적용"(PASSWORD 없이 바로 진행)을 따로 켜고 끌 수 있다**.
기본값은 전부 `true`(적용) — 기존 동작과 동일하게 유지하기 위함.

`PASSWORD_GATE_DEFS`(gms.js)에 정의된 15개 게이트:

| key | OPTION 탭 라벨 | 트리거 |
|---|---|---|
| `mainMenu` | 유지보수 진입 비밀번호 | 메인 메뉴 "유지 보수" |
| `cylinderExchange` | 실린더 교환 진입 비밀번호 | 메인 메뉴 "실린더 교환" |
| `cylinderExchangeDone` | 용기교체 진입 비밀번호 | 2차 배관청소 "실행"(2P→CC) |
| `cylReplaceDone` | 교환후 진입 비밀번호 | Auto Guard Close "확인"(CC→3P) |
| `exchangeFourthPurgeDone` | 퍼지완료 진입 비밀번호 | 4차 배관청소 "실행"(4P→PC) |
| `manualValve` | 수동밸브 조작 취소 비밀번호 | 수동밸브 조작 화면 취소(여러 지점) |
| `heater` | 히터 조작 취소 비밀번호 | 히터 조작 화면 취소 |
| `cylinderLockCheck` | 교환전 취소 비밀번호 | 실린더 잠금 check 취소(→IDLE+메인메뉴) |
| `cylReplace` | 용기교체 취소 비밀번호 | CC 6화면 취소(→메인메뉴, Status는 CC 유지) |
| `exchangeAfterCancel` | 교환후 취소 비밀번호 | 교환후 4화면 취소(→CC 첫 화면) |
| `statusJump` | Status Jump | 상단 배지 클릭 |
| `gasSupplyEntry` | 가스공급 진입 비밀번호 | PC/가스공급 화면 "가스공급" 버튼 |
| `gasSupplyPauseEntry` | 일시정지 진입 비밀번호 | 가스공급 중 "일시정지" |
| `gasSupplyStopEntry` | 공급중지 진입 비밀번호 | 가스공급 중 "공급중지" |
| `gasSupplyForceChangeEntry` | 강제교체 진입 비밀번호 | 가스공급 중 "강제교체"(조건 통과 후) |

**패턴**: 새 PASSWORD 지점을 추가하려면 (1) `PASSWORD_GATE_DEFS`에 항목 추가, (2) 트리거
지점에서 `proceedPastPasswordGate(key, directAction)` 호출, (3) `passwordConfirmBtn`
핸들러에 `if (passwordCancelTarget === key) { ...; return; }` 분기(직접 호출과 PASSWORD
통과 후 양쪽이 **같은 advance 함수**를 호출하도록 — 로직 중복 금지), (4)
`passwordCancelBtn`(취소) 핸들러에도 "PASSWORD를 취소하면 어디로 돌아가는지" 분기 추가.
비밀번호는 현재 고정값 `4321`(`MAINTENANCE_PASSWORD`, 실제 PLC 연동 전까지 임시).

## 6. OPTION 탭(우측 패널) 전체 옵션 (gms.js `renderOptionTable()`)

기본 패턴: `let xxxOption = true/false;` + localStorage 키 + 토글 버튼(텍스트 "적용"/
"미적용" 또는 커스텀 텍스트) + 클릭 시 반전 후 저장.

1. **수동조작 상태 유지 옵션**(`manualStateHoldOption`, 기본 미적용) — 수동밸브 조작
   화면 취소 시 열린 밸브 유지 여부 확인을 건너뛸지.
2. **VT 사용 옵션**(`vtUseOption`, 기본 미적용) — 교환전/교환후 각각 `-L`/`+L` 다음에
   `-VT`(VT 감압시험) 단계를 거칠지. 켜지면 모든 교환전/교환후 화면의 `-VT` 배지가
   보이고(`data-vt-badge` 속성, `applyVtBadgeVisibility()`), 꺼지면 숨는다.
3. **GC Type**(`gcTypeOption`, 기본 **적용=`2B2P`**) — 버튼 텍스트 자체가 "2B2P"/"2B1P"
   (다른 옵션처럼 "적용/미적용"이 아님). `2B2P`: A/B 양측이 완전히 독립적으로 가스공급
   가능(기존 동작). `2B1P`: 포트가 하나뿐이라는 뜻 — 가스공급준비 완료 화면 "확인" 시
   반대 측이 이미 `Service`(가스공급 중)면 이 측은 진행 못 하고 화면이 반대 측 가스공급
   중 화면으로 전환된다(`gasSupplyReadyConfirmBtn` 핸들러).
4. **PASSWORD 게이트 15개**(5절 표) — `PASSWORD_GATE_DEFS.map()`으로 자동 렌더링.

## 7. 화면 목록 (`OPERATION HTML/`) — 2026-08 기준 현재 상태

### 교환전(Status Puls~2P) — 전부 서브시퀀스 엔진 화면(11절), 뼈대 아님
- `교환전1P_실린더 잠금 check.html` — Status 진입점(IDLE 사전확인 7단계, ns=`idleCheck`)
- `Puls_자동진행.html` — 잔류가스 Check + Pulse Vent 2단계(ns=`puls`, Status `Puls`)
- `1P_자동진행.html` — 1P 구간 1/4: 1-2차측 Vent Mode(ns=`oneP`, `OneP_v1.json`)
- `1P_2차측Purge_자동진행.html` — 1P 구간 2/4: 2차측 Purge(ns=`onePPurge`, `OneP2_v1.json`)
- `1P_Pumping_자동진행.html` — 1P 구간 3/4: Pumping, 초기값/현재값/설정시간/진행시간
  4값 패널(ns=`onePPumping`, `OneP3_v1.json`)
- `1P_1차측Purge_자동진행.html` — 1P 구간 4/4: 1차측 Purge(ns=`onePPrimaryPurge`, `OneP4_v1.json`)
  — 위 4개는 OPTION 탭 "1P 서브시퀀스 사용 여부"로 개별 on/off 가능(`ONE_P_SUBSEQ_DEFS`,
  `firstEnabledOnePStageKey`/`nextEnabledOnePStageKey`/`advanceOnePChain`이 체이닝을 담당)
- `교환전-L_감압시험.html` — 감압시험, 2단계 반복구간(안정화→시험, ns=`exchangePressureTest`,
  `ExchL_v1.json`)
- `교환전-VT_VT 감압시험.html` — VT 감압시험, VT 사용 옵션 적용 시만(3단계, ns=`vtTest`,
  `VtTest_v1.json`)
- `교환전2P_2차 배관청소.html` — 2차 배관청소, 1P의 1차측 Purge와 동일 구조(ns=`twoP`,
  `TwoP_v1.json`)

### 용기교체(Status CC, 배지 없음)
- `용기교체CC_실린더 확인.html`(신규, "준비전 모드변경"/"Force Purge" 버튼 포함)
- `용기교체CC_Valve Open 확인.html` / `Auto Guard Open 확인.html` /
  `실린더 분리 및 교체.html` / `Gas name 확인.html` / `Auto Guard Close 확인.html`(전부 신규)
- `용기교체CC_Force Purge.html`(신규, "실린더 확인" 화면의 Force Purge 버튼 대상)

### 용기교체~교환후 사이(Status Bypass, 배지 없음) — "Bypass 사용 옵션" 적용 시만 등장
- `시퀀스_Bypass.html` — 용기교체(CC) 완료 직후, 실제 서브시퀀스 엔진 화면(ns=`bypass`,
  `Bypass_v1.json`, 2026-08-09 실제 로직 반영 완료). 1P_2차측Purge 재확인(OneP2_v1.json
  그대로 복제) → "고압 HE Leak check 라인 유무" 옵션 분기(HPIV vs PNBV+PIV) → NPT/HPT
  진공유지 확인("Bypass 진공유지 확인시간[분]" CONFIG, 신규). "Bypass 사용 옵션"(OPTION 탭,
  기본 미적용)이 꺼져 있으면 이 Status 자체가 `nextStatusIndexAfter`에서 건너뛰어진다
  (-VT/vtUseOption과 동일한 런타임 스킵 패턴). 완료되면 3P로 단순 연결.

### 교환후(Status 3P~PC)
- `교환후3P_배관청소.html` — 교환전 2P와 완전히 동일한 서브시퀀스 엔진 화면(ns=`afterThreeP`,
  `AfterThreeP_v1.json` = `TwoP_v1.json` 값을 그대로 복제, CONFIG만 "교환 후 1차 Purge
  횟수_{side}" 재사용). 실기 검증 완료(2026-08-09).
- `교환후+L_가압시험.html` — **실제 로직 완료**(ns=`afterPlusL`, `AfterPlusL_v1.json`,
  2026-08-09 사용자 제공 스펙 전면 반영). Bypass 사용 옵션에 따라 시작 지점이 갈리고(OFF:
  HPIV부터, ON: PGI부터), NPT/HPT 압력범위 확인 → 압력안정화시간(CAPTURE+실시간 안전감시,
  하한 이탈 시 FAIL) → 시험시간(초기값 대비 압력변동기준 이탈 시 FAIL) → "가압시험 완료후
  Puls Vent 옵션" 적용 시 Puls Vent 미니시퀀스까지 수행한다. CONFIG는 전부 기존 시드 항목
  재사용("가압 시험-압력 하한/상한/변동 기준/안정화·시험 시간_{side}") — 신규 CONFIG 없음.
  자세한 Step 흐름은 `docs/02-design/features/gms-exchange-after-subseq.design.md` §12 참고.
- `교환후4P_배관청소.html` — 3P와 완전히 동일한 서브시퀀스 엔진 화면(ns=`afterFourP`,
  `AfterFourP_v1.json`, CONFIG는 "교환 후 2차 Purge 횟수_{side}"). 완료 시 PASSWORD
  (`exchangeFourthPurgeDone`) → PC 전환 실기 검증 완료(2026-08-09).
- `교환후-VT_VT감압시험.html` — 교환전-VT와 완전히 동일한 로직(ns=`afterVtTest`,
  `AfterVtTest_v1.json`), VT 사용 옵션 적용 시만 진입
- `PC_퍼지완료.html`(퍼지완료지만 실제로는 "가스공급" 메뉴 화면 — 6.1절 시나리오 참고,
  버튼: 가스공급/"B"선택/유지 보수/TREND/보조메뉴/취소)

### 가스공급(Status READY, Service) — 전부 신규
- `가스공급_압력확인.html`(4버튼: 가스공급/조정모드/Line Vent/취소)
- `가스공급_Valve shutter 장착.html`, `가스공급_Regulator Close.html`,
  `가스공급_Cylinder Open.html`, `가스공급_Regulator 조정.html`,
  `가스공급_PMV Open 확인.html`(전부 `.valve-turn-icon` 4분면 아이콘 사용,
  검정=닫힘/초록=열림, 화면마다 분면 조합 다름)
- `가스공급_준비완료.html`(READY 진입 화면, HPT/LPT/W-S 계측값 목록)
- `가스공급_공급중.html`(Service 진입 화면, `.gas-flow-icon` 4색 팬휠 + "[측] Cylinder
  flow!" 문구)
- `가스공급_동작재확인.html`(일시정지/공급중지/강제교체 공용 재확인 화면, 안내 문구만
  `gasSupplyPendingAction`에 따라 JS가 동적으로 바꿈)

## 8. 이번 세션에서 고친 버그 (재발 방지용 메모)

- **`-VT` 텍스트 중복 인덱스 버그**: `CYLINDER_STEP_ORDER.indexOf('-VT')`가 항상 교환전
  쪽(index 3)만 찾아서 교환후 VT 화면의 Status/배지가 전부 틀리게 나왔다. →
  `lastIndexOf`(상태 인덱스 설정) 또는 "현재 idx와 가장 가까운 occurrence" 방식(배지
  `.done` 판정)으로 수정. **새로 인덱스 매칭 코드를 짤 때 이 패턴을 항상 의심할 것.**
- **A측 기본 Status가 1P로 미리 채워져 있던 문제** → 양측 다 IDLE(0)로 기본값 통일.
- **Status Jump로 건너뛴 스텝이 `.done`(완료 표시)으로 잘못 채워지던 문제** →
  `completedStatusSteps` Set 도입, 실제 완료 지점에서만 `markStepComplete()` 호출.
- **PC/가스공급 화면 "B"선택 버튼이 눌러도 라벨이 안 바뀌어서 "전환이 안 되는 것처럼"
  보이던 문제** → `showProgressGasSupplyActive()`에 라벨 갱신 로직 누락, 추가함. **새
  화면에 "B"/"A" 선택 버튼을 넣을 때마다 라벨 갱신을 반드시 같이 넣을 것.**
- **CYLINDER STEP STATUS 상단 바의 실제 HTML 마크업이 `CYLINDER_STEP_ORDER` 배열
  순서와 어긋난 적 있음**(3P/+L 순서 변경 시 배열만 고치고 `gms.html`의 정적 배지
  마크업을 안 고쳤었다) → 항상 **배열을 바꾸면 `gms.html`의 두 `#cylStepBadgesA/B`
  마크업도 같이 바꿀 것**.
- **새 서브시퀀스 네임스페이스를 추가하고 `data/gmsSubSequenceSelection.json`에 등록하는
  걸 빠뜨림**(교환후 3P/+L/4P 작업, 2026-08-09) — Step JSON 파일과 `SUBSEQ_NS` 등록까지만
  하고 이 selection 매핑을 빠뜨리면, `startNamespacedSubSequenceRunner`가 `subSeqId`를
  못 찾아 `"{mainStepType}"에 연결된 서브시퀀스가 없습니다` 토스트만 띄우고 **조용히 아무
  것도 하지 않는다**(에러도 안 남, 콘솔도 조용함) — 코드 리뷰/정적 검증으로는 못 잡고
  실제 브라우저 실행으로만 드러난다. **새 mainStepType을 추가할 때마다 (1) Step JSON
  (2) `SUBSEQ_NS` 등록 (3) 5개 레지스트리 (4) `gmsSubSequenceSelection.json` 이 4가지를
  한 세트로 취급할 것.**
- **`data/gmsMainSequence.json`의 `order` 배열 순서가 실제 문서화된 흐름과 다를 수 있음**
  (교환후 `+L`이 `3P`보다 앞에 등록돼 있던 사고, 2026-08-01 생성 당시부터 잘못됨) —
  `advanceToNextEnabledStatus`는 이 배열 순서를 그대로 따르므로, 배지/문서/CONFIG 이름이
  다 맞아도 이 파일 하나가 틀리면 화면이 엉뚱한 순서로 넘어간다. Main Sequence 편집기로
  순서를 바꾼 적이 없는데도 흐름이 이상하면 이 파일부터 확인할 것.

## 9. 남은 뼈대(스텁) 상태인 것들 — 2026-08 기준

교환전(1P/-L/-VT/2P), 교환후 3P/+L/4P, Bypass는 전부 서브시퀀스 엔진으로 전환 완료(7절,
11절, 12절 — 2026-08-09 사용자 제공 실제 스펙 반영). 남은 것:
- +L/Bypass 모두 아직 **실기 PLC 없이** 검증했다 — Chrome 백그라운드 탭 타이머 스로틀링으로
  NPT/HPT 5분 유지확인·압력안정화/시험 전체 구간 실시간 완주까지는 못 했다(로직/참조
  무결성은 스크립트로 검증 완료). "고압 HE Leak check 라인 유무" ON 분기, "가압시험 완료후
  Puls Vent" ON 분기, FAIL 알람 실제 유발도 아직 미검증(`gms-exchange-after-subseq.plan.md`
  §10.5 참고).
- 가스공급 관련: "조정모드", "Line Vent", "강제 교체"(가스공급 중 화면의, 강제교체 자체는
  구현됨), "보조메뉴", TREND 전부
- 용기교체 CC 6화면의 "준비전 모드변경"(실제로는 실행됨, IDLE+메인메뉴로), "바코드
  수동입력", "바코드 확인", "Lot No. Skip"
- `Service`(가스공급 중) 다음 단계(PC/READY 등 표준 절차상 그 이후, 예: 유량 실시간
  모니터링, 실제 밸브 명령 등)는 설계되지 않음 — 현재는 화면 전환/Status만 시뮬레이션
- 비밀번호는 고정값 `4321` — 실제 PLC/IO MAP 연동 값으로 교체 필요
- `VT_{side}`(VT 감압시험의 고진공 게이지 값) 태그가 아직 `memoryAreas.js`에 실제 PLC
  주소로 매핑돼 있지 않음 — 값이 없으면 조건 평가를 조용히 건너뛴다(오작동 아님, 로그에
  경고만 남음). 사용자가 "나중에 한 번에 매핑 예정"이라고 확인함(2026-08).

## 10. 작업 시 지켜온 관례

- 화면 파일명은 `<Status코드>_<화면이름>.html`(예: `교환전-L_감압시험.html`) — 접두사가
  "그 화면이 속한 현재 Status"를 나타낸다.
- 새 화면 추가 시 항상 5곳을 같이 고친다: (1) `OPERATION HTML/*.html` 파일, (2)
  `gms.html`에 빈 컨테이너 div, (3) `Operation.js`의 `progress...Body` const +
  `progressScreens` 맵 + `OPERATION_SCREEN_FILES` 맵, (4) 필요하면 `CYL_EXCHANGE_PURGE_STEPS`
  /`GAS_SUPPLY_STEPS`/`CYL_STEP_STATUS_MAP`, (5) 버튼 이벤트 wiring(`wireOperationScreens()`
  안).
- 확인/취소, 실행/취소 버튼 뒤에 실제로 상태가 바뀌는 지점(예: `advanceXxx()`,
  `GAS_SUPPLY_ACTIONS.xxx.perform`)은 재사용 가능한 **이름 붙은 함수**로 뽑아서, PASSWORD
  게이트 on/off 양쪽 경로(`proceedPastPasswordGate`)와 `passwordConfirmBtn` 분기가 **같은
  함수를 호출**하도록 만든다 — 로직 두 벌 관리하지 않기 위함.
- 사용자가 첨부한 실제 HMI 참고 사진은 문구/버튼 배치는 최대한 그대로 따르되, 아이콘
  등 순수 장식 요소는 완벽히 재현하기보다 CSS로 합리적으로 근사(예: `.valve-turn-icon`
  4분면 clip-path 삼각형)했다 — 필요하면 더 다듬을 수 있음.

## 11. 서브시퀀스 실행 엔진 (SUBSEQ_NS 패턴)

Status 상태 머신(2~5절)이 "어느 화면을 보여줄지"를 결정한다면, 이 엔진은 그 화면 **안에서
실제로 밸브를 열고 닫고 타이머를 재고 판정하는** 부분을 담당한다. 조정모드에서 시작해서
지금은 1P 4단계/-L/-VT/2P 등 대부분의 "자동진행" 화면이 이 패턴을 쓴다. `.claude/agents/`의
planner·implementer 에이전트가 새 화면을 만들 때 이 절을 기준으로 삼는다.

### 11.1 네임스페이스(`SUBSEQ_NS`)
`public/gms-sub-sequence-runner.js`의 `SUBSEQ_NS` 객체에 화면 하나당 네임스페이스 1개.
각 네임스페이스는:
- `mainStepType` — `data/gmsSubSequences/<mainStepType>_v1.json`을 가리키는 키(예: `OneP3`)
- `screenKey` — `Operation.js`의 `CYL_EXCHANGE_PURGE_STEPS`/`STATUS_ENTRY_SCREEN_BY_TYPE` key
- idle/panel/stepLabel/operation/message/valveDiff/timer/accTime/cycleInfo/cycleTarget/
  cycleCurrent/ackBtn/stopBtn/stopBtnMode/pauseBtn/resetBtn/exportBtn/importBtn/fileInput 등
  DOM id 매핑(전부 그 화면 HTML의 실제 id와 문자열이 정확히 일치해야 함)
- 선택 필드: `captureInitial`/`captureCurrent`/`captureDecimals`(초기값/현재값 캡처 표시,
  기본 2자리·VT류는 3자리), `cycleCurrentAsTime`(진행시간을 "N분 SS초"로 표시),
  `settingValue`(지금 감시 중인 비교 기준값 표시)

네임스페이스를 추가하면 **5개 레지스트리**(`subSeqAlarmActive`/`subSeqRestartFromStepNo`/
`subSeqRunStates`/`subSeqPendingResumes`/`subSeqCallbacks`)에도 같은 키를 반드시 추가한다
— 하나라도 빠뜨리면 그 네임스페이스만 조용히 오동작한다.

### 11.2 Step 데이터(`data/gmsSubSequences/<Id>_v1.json`)
`steps` 배열의 Step 하나는: `no/valves/mainStep/subStep/nextStep/operation/cycle/advance/
ackGoto/alarmGoto/message/timeSec/accTimeSec/alarmMonitoring/conditionOp/conditionValue/
earlyPass/alarmSeq/alarmMessage/remarks`. 조건 평가 결과가 **참이면 `nextStep`**으로,
**거짓이면 `alarmGoto`**가 있으면 그 Step으로 가볍게 이동(밸브/누적시간 유지, 실 알람 안
남음), `alarmGoto`가 없으면 진짜 `Alarm Seq.`(보통 1)가 발생해 시퀀스가 멈춘다. `accTimeSec`
는 Step들의 `timeSec` 누적 합이어야 한다(하나 바꾸면 이후 전부 재계산 — Node로 검증할 것,
이 환경엔 Python이 없다).

### 11.3 예약 문법
- `alarmMonitoring: "진행횟수"` — 실제 센서가 아니라 이 Step이 몇 번째 반복인지(엔진이
  `rt.cycleCurrent`로 자동 관리). 카운트하는 Step 번호가 바뀌면(=새 반복구간 진입) 자동으로
  0부터 다시 센다 — 한 시퀀스 안에 반복구간이 여러 개 있어도(예: `ExchL_v1.json`의 안정화→
  시험 2단계) 서로 섞이지 않는다.
- `cycle: "CAPTURE:<태그>"` — 이 Step에 최초 도달한 순간(반복 재진입 시 무시) 태그의 실시간
  값을 "초기값"으로 한 번만 저장, "현재값"은 계속 갱신(`subSeqApplyCapture`/
  `subSeqRefreshLiveCaptures`). CAPTURE Step에 안전조건(`alarmMonitoring`)이 같이 있으면
  60초 타이머 만료를 기다리지 않고 PT 값이 들어올 때마다(~1초 주기) 실시간으로도 검사한다
  (`subSeqCheckLiveSafety`).
- `:OFFSET` 접미사(비교 대상 태그에 붙임) — 원시 PT 값이 아니라 압력조정표 기준 계산값과 비교.
- `:CAPOFFSET` 접미사 — 이번 실행에서 `CAPTURE:`로 저장해 둔 초기값 + CONFIG 오프셋을
  목표값으로 삼아 비교(예: 누출시험 "초기값+허용변동 이내인가"). `:OFFSET`의 자매 문법.

### 11.4 CONFIG 값 매칭
`data/gmsSubSequenceConfig.json`의 `name` 또는 `id`가 Step의 `conditionValue` 문자열과
정확히 일치해야 한다. 측(A/B)별로 다르면 `_A`/`_B` 접미사 관례. 실제 설비 값을 모르면
`desc`에 "예시값입니다. 실제 값은 엔지니어링 검토 후 교체 필요"라고 명시.

### 11.5 자주 나는 사고
- 화면 구조를 바꾸면서 옛 정적 버튼 id에 건 `document.getElementById('x').addEventListener(...)`
  를 안 지우면(그 id가 새 HTML엔 없음) `wireOperationScreens()` 전체가 그 지점에서 예외로
  죽어서 **이후 모든 버튼 배선이 먹통**이 된다. 반드시 새 HTML 실제 id로 교체하고 `?.` 가드.
- `wireOperationScreens()` 안의 지역 함수를 top-level 함수(`showProgressCylExchangePurgeStep`
  의 `onFinish`/`onCancel` 콜백 등)에서 불러야 하면 `window.함수이름 = 함수이름;`으로 노출
  (`cancelPreCcToPassword`/`advanceCylinderExchangeDone`/`cancelExchangeAfterToPassword`가
  기존 예시).
- 새 idle/panel 화면을 추가하면 `public/gms.css`의 flex-chain 선택자 목록
  (`#...Idle, #...Panel { display:flex; ... }`)에 반드시 추가한다 — 안 하면 버튼이 화면
  위쪽에 쌓인다.
- 실제 PLC I/O 매핑을 모르는 새 태그는 주소를 지어내지 말고 이름만 관례대로 만들어 쓰고,
  "값 없으면 조건 건너뜀 - 오작동 아님"으로 두고 사용자에게 실제 매핑이 필요하다고 알린다.
- 테스트용으로 CONFIG의 시간 값을 임시로 낮췄다면 검증 후 반드시 원래 값으로 되돌린다.

### 11.6 예외 패턴 - 화면 여러 개가 진입화면 데이터 하나를 공유해서 읽기(용기교체 CC)

"화면 1개 = 네임스페이스 1개"가 기본 관례(11.1)지만, **화면 전환이 여전히 사용자의 "확인"
버튼 클릭으로 이루어지고(타이머/알람 자동 진행이 필요 없고) 밸브 순서만 데이터로 관리하고
싶을 때**는 이 가벼운 예외 패턴을 쓴다(최초 사례: 용기교체 CC 6화면,
`docs/01-plan/features/gms-cc-replace-subseq.plan.md`).

- SUBSEQ_NS에 네임스페이스를 등록하지 않는다 - 5개 레지스트리, 타이머, 알람, Alarm Goto 등
  풀 엔진 기능이 전혀 관여하지 않는다.
- **진입화면 하나에만** Step 데이터 파일(`data/gmsSubSequences/<Id>_v1.json`)을 만들고,
  나머지 화면들은 자기 단계에 해당하는 `no`를 찾아 `valves` 필드만 읽기 전용으로 조회해서
  보여준다. Step 스키마(11.2)는 그대로 따르되 `advance`/`nextStep`/`alarmGoto`/타이머/알람
  필드는 실제로 아무 엔진도 소비하지 않는다(화면 전환은 여전히 버튼 클릭 핸들러가 담당).
- 엑셀 내보내기/불러오기는 진입화면에만 버튼을 두고, `gms-sub-sequence-runner.js`의
  `subSeqWireExcelButtons(ns, {mainStepType}, exportBtn, importBtn, fileInput)`을 네임스페이스
  등록 없이 그대로 재사용한다(이 함수는 `cfg.mainStepType`만 있으면 동작하는 범용 함수라
  가능하다) - `data/gmsSubSequenceSelection.json`에 `mainStepType` 매핑만 추가하면 된다.
- 밸브 상태는 화면에 텍스트 배지로 표시하지 않는다 - **SVG 배관도(`gms-diagram.svg`)의 실제
  밸브 아이콘**에 반영한다. `public/Operation.js`의 `applyCcStepValves(stepNo)`가
  `showProgressCylExchangePurgeStep`이 해당 화면을 보여줄 때마다 Step 데이터를 `fetch`해서
  `POST /api/gms/valve/write`(다른 서브시퀀스 엔진의 `subSeqApplyValves`와 동일한 API)를
  호출한다 - 서버가 `gmsState.valveBuffer`를 갱신하고 WS로 브로드캐스트하므로 SVG가 즉시
  갱신된다(별도 캐시/새로고침 불필요, 엑셀로 값을 바꾸면 다음 화면 진입 시 바로 반영).
- 밸브 값 문자열은 `"O"`/`"C"`(즉시 적용) 외에 `"O+2"`/`"C+4"`처럼 `+n` 접미사를 쓸 수 있다 -
  화면 진입 후 n초 뒤에 그 밸브만 적용한다. 같은 Step 안의 여러 밸브를 순차적으로
  열고/닫고 싶을 때(예: 용기교체 CC의 "Valve Open 확인" 단계에서 PIV→PGII→PGI를 2초
  간격으로 Open) 각 밸브 값에 서로 다른 지연을 주면 된다 - 엔지니어가 엑셀에서 이 접미사
  숫자만 바꾸면 실제 개폐 타이밍이 바뀐다. 새 화면을 열 때마다 대기 중인 지연 타이머는
  전부 초기화된다(같은 Step을 다시 보여줘도 중복 적용되지 않음).
- 밸브가 없는 Step(물리적 작업/확인만 하는 단계)은 `valves`가 빈 객체라 자연히 아무 일도
  하지 않는다.
