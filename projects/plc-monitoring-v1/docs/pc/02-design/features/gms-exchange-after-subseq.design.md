---
template: design
version: 1.3
---

# 교환후 3P/+L/4P 서브시퀀스 엔진 전환 Design Document

> **Summary**: 교환후(Status 3P/+L/4P) 3개 뼈대 화면을 기존 SUBSEQ_NS 서브시퀀스 엔진 패턴으로 전환한다.
>
> **Project**: plc-monitoring-usb (Omron CJ2H-65EIP GMS 조작화면)
> **Version**: 0.1.0
> **Author**: —
> **Date**: 2026-08-09
> **Status**: Draft
> **Planning Doc**: [gms-exchange-after-subseq.plan.md](../01-plan/features/gms-exchange-after-subseq.plan.md)

> Pipeline(9-phase)/bkend.ai/Next.js 관련 섹션은 이 프로젝트(Node.js/Express + 바닐라 JS)에
> 해당하지 않아 생략하거나 "해당 없음"으로 표시했다.

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 교환후 3P/+L/4P가 뼈대 상태라 GMS 자동 진행 시퀀스가 교환전에서 끊긴다 |
| **WHO** | GMS 조작화면을 실제로 조작하는 현장 오퍼레이터, 이후 실기 PLC 연동을 담당할 개발자 |
| **RISK** | 실제 PLC I/O 매핑이 없어 밸브 태그/CONFIG 값이 전부 추정치(플레이스홀더) — 실기 검토 시 전면 수정 필요 |
| **SUCCESS** | 3개 화면 모두 SUBSEQ_NS 패턴으로 동작하고, 4P 완료 시 PASSWORD(`exchangeFourthPurgeDone`) 게이트를 거쳐 PC Status로 정상 전환됨 |
| **SCOPE** | 3P→+L→4P 3개 화면 Step JSON 작성 + 네임스페이스 등록까지. 가스공급 이후 단계·실제 PLC I/O 매핑·VT 태그 매핑은 범위 밖 |

---

## 1. Overview

### 1.1 Design Goals

- 3개 화면이 기존 교환전 서브시퀀스(1P~2P)와 **동일한 코드 경로**(SUBSEQ_NS 엔진)를 타도록 만든다 — 별도 분기 로직을 새로 만들지 않는다.
- 실제 PLC I/O 매핑이 없는 상태에서도 "값 없으면 조건 건너뜀" 관례로 안전하게 동작하게 한다.
- 4P 완료 → PC Status 전환 등 기존 `Operation.js` 상태 머신과의 접점을 깨지 않는다.

### 1.2 Design Principles

- **패턴 재사용 우선**: `TwoP_v1.json`(Purge형)과 `ExchL_v1.json`(압력시험형, CAPTURE+진행횟수 반복구간)이 이미 검증된 구조이므로 새 구조를 설계하지 않는다.
- **회귀 방지**: 5개 공용 레지스트리(`subSeqAlarmActive` 등)에 새 키를 추가할 뿐, 기존 키의 동작을 변경하지 않는다.
- **관례 우선 명시**: 실제 값을 모르는 태그/CONFIG는 반드시 "예시값, 실제 값은 엔지니어링 검토 후 교체 필요"를 remarks/desc에 남긴다(11.4절 관례).

---

## 2. Architecture Options

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal | Option B: Clean | Option C: Pragmatic |
|----------|:-:|:-:|:-:|
| Approach | TwoP/ExchL 거의 그대로 복제 | 엔진 공용 패턴을 헬퍼로 분리 | 기존 구조 재사용 + 화면별 맞춤 |
| New Files | 3 | 3 | 3 |
| Modified Files | 2 | 3+ | 2 |
| Complexity | Low | High | Medium |
| Risk | Low | Medium(회귀 위험) | Low |

**Selected**: Option C — **Rationale**: 이미 11개 이상의 화면이 이 패턴을 쓰고 있고 핸드오프 문서가 표준으로 못박음. 엔진 리팩터(Option B)는 지금 규모에서 과잉이고 기존 1P~2P 회귀 위험만 늘림.

### 2.1 Component Diagram

```
public/OPERATION HTML/교환후3P_배관청소.html  ─┐
public/OPERATION HTML/교환후+L_가압시험.html   ─┼─▶ public/gms-sub-sequence-runner.js
public/OPERATION HTML/교환후4P_배관청소.html   ─┘        (SUBSEQ_NS 엔진, 신규 네임스페이스 3개)
                                                       │
                                                       ▼
                                    data/gmsSubSequences/AfterThreeP_v1.json
                                    data/gmsSubSequences/AfterPlusL_v1.json
                                    data/gmsSubSequences/AfterFourP_v1.json
                                                       │
                                                       ▼
                                    data/gmsSubSequenceConfig.json (CONFIG 값)
                                                       │
                                                       ▼
                               public/Operation.js (Status 상태 머신, PASSWORD 게이트 진입/이탈)
```

### 2.2 Data Flow

```
화면 진입(Operation.js showProgressCylExchangePurgeStep)
  → SUBSEQ_NS 네임스페이스 초기화 → Step 1부터 순차 평가
  → 조건 참: nextStep / 조건 거짓: alarmGoto(경량 이동) 또는 실제 Alarm(정지)
  → 마지막 Step(Sequence Complete) 도달 → advanceToNextEnabledStatus
  → 4P 완료 시에만 PASSWORD(exchangeFourthPurgeDone) 게이트 → PC Status
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `AfterThreeP_v1.json`/`AfterPlusL_v1.json`/`AfterFourP_v1.json` | `data/gmsSubSequenceConfig.json` | Step의 `conditionValue`가 CONFIG 항목명과 정확히 일치해야 함 |
| SUBSEQ_NS 신규 네임스페이스 3개 | 5개 공용 레지스트리 | 등록 누락 시 해당 네임스페이스만 조용히 오동작(11.1절 경고) |
| `Operation.js` 진입점 로직 | `CYL_EXCHANGE_PURGE_STEPS`, `CYL_STEP_STATUS_MAP` | 화면 전환 + Status 인덱스 갱신을 같이 담당 |

---

## 3. Data Model

> 이 기능은 DB/ORM을 쓰지 않는다 — 데이터 모델은 `data/gmsSubSequences/*.json`의 Step 배열 스키마다(이미 `TwoP_v1.json`/`ExchL_v1.json`에 확립된 형식, 신규 설계 없음).

### 3.1 Step 엔티티 정의 (기존 스키마 재사용)

```
Step {
  no: string|number        // Step 번호("6A"처럼 서브스텝도 가능)
  valves: { [tag]: "O"|"C" }  // 이 Step에서 여닫을 밸브
  mainStep: number         // 화면 내 대분류 단계 번호
  subStep: number          // 화면 내 세부 단계 번호
  nextStep: string|number  // 조건 참일 때 이동할 Step no
  operation: string        // 화면 상단 모드 표시 문구
  cycle: string            // "" | "CAPTURE:<태그>"
  advance: "auto"          // 항상 auto(수동 ack 없음, 이 3화면 범위에서)
  ackGoto / alarmGoto: string  // ack/alarm 시 이동할 Step no
  message: string          // 화면에 표시할 안내 문구
  timeSec / accTimeSec: number  // 이 Step 소요시간 / 누적시간(검증 필요)
  alarmMonitoring: string  // 감시 태그명 | "진행횟수"(예약어)
  conditionOp: string      // 비교 연산자(<=, >=, & 병렬 등)
  conditionValue: string   // CONFIG 항목명 또는 리터럴
  alarmSeq: number|string  // 실패 시 알람 시퀀스 코드
  alarmMessage: string
  remarks: string          // 플레이스홀더 안내 필수 포함
}
```

### 3.2 3개 화면의 Step 흐름 개요

> **사용자 확인(2026-08-09)**: 3P/4P는 2P(`TwoP_v1.json`)와 **완전히 동일한 시퀀스**다 —
> `valves`/`timeSec`/`accTimeSec`/`alarmMonitoring`/`conditionOp` 등 모든 필드 값을 그대로
> 복제한다. 화면마다 반드시 바꿔야 하는 필드는 셋뿐이다: (1) `mainStep`(겹치지 않는 새 번호),
> (2) `operation`/`message`(상단 배지·중간 화면에 보이는 문구), (3) Step17의
> `conditionValue`(반복 종료 판정에 쓰는 CONFIG 항목명). +L은 3P/4P와 무관하게 별도 구조
> (`ExchL_v1.json`)를 따른다 — 구조만 확정, 실제 시간/조건 값은 플레이스홀더.

| 화면 | mainStep | 원형 | 복제 방식 | 흐름 |
|---|---|---|---|---|
| 교환후3P (배관청소) | 16 (임시) | `TwoP_v1.json`(2차 배관청소) | **값까지 그대로 복제**, `operation`/`message`/Step17 `conditionValue`만 교체 | 배관진공 형성 확인(Step1~4) → N2 Purge 밸브 개폐(Step5~16) → 반복 종료 판정("진행횟수" 예약어, Step17, CONFIG="교환후 3차 퍼지진행 횟수") → 완료(Step20) |
| 교환후+L (가압시험) | 17 (임시) | `ExchL_v1.json`(감압시험) | 구조만 참고(값은 새로 추정) | Mode 시작 → 안정화 대기(CAPTURE+실시간 안전감시, 60s) → 분단위 반복판정(6A류) → 시험 구간(7류) → 분단위 반복판정(7A류) → 완료 |
| 교환후4P (배관청소) | 18 (임시) | `TwoP_v1.json`(3P와 동일 원형) | **값까지 그대로 복제**, `operation`/`message`/Step17 `conditionValue`만 교체 | 3P와 완전히 동일 구조, 반복 종료 CONFIG만 다름("교환후 4차 퍼지진행 횟수") |

> `mainStep` 번호는 기존 화면들과 겹치지 않는 값으로 Do 단계에서 실제 배정(현재 1P~2P가 14까지 사용 중으로 추정, 15는 ExchL 사용 중 — Do 단계에서 실제 JSON들을 스캔해 다음 빈 번호 확인 필요).

### 3.3 CONFIG 항목 (신규, 플레이스홀더)

| name | 대상 | desc |
|---|---|---|
| `교환후 3차 퍼지진행 횟수` | 3P 반복 판정 | 예시값입니다. 실제 값은 엔지니어링 검토 후 교체 필요 |
| `가압 안정화 시간[분]` | +L 안정화 구간 | 예시값입니다. 실제 값은 엔지니어링 검토 후 교체 필요 |
| `가압 시간[분]` | +L 시험 구간 | 예시값입니다. 실제 값은 엔지니어링 검토 후 교체 필요 |
| `교환후 4차 퍼지진행 횟수` | 4P 반복 판정 | 예시값입니다. 실제 값은 엔지니어링 검토 후 교체 필요 |

측(A/B)별로 다르면 `_A`/`_B` 접미사 관례를 따른다(11.4절).

---

## 4. API Specification

해당 없음 — 이 기능은 REST API를 추가하지 않는다. 클라이언트(`gms-sub-sequence-runner.js`)가
서버 폴링으로 이미 확보된 PLC 태그 실시간 값(`gms.js`의 기존 폴링 경로)을 그대로 참조하고,
Step 데이터는 정적 JSON 파일(`data/gmsSubSequences/*.json`)을 fetch해서 읽는다 — 기존 화면들과
동일한 방식이라 신규 엔드포인트가 필요 없다.

---

## 5. UI/UX Design

### 5.0 필수 UI 규칙 (사용자 명시 반복 지적 — 이 절은 매번 재확인 없이 그대로 적용할 것)

> **버튼 하단 고정**: 이 프로젝트의 모든 GMS 조작화면(`public/OPERATION HTML/*.html`)은
> 버튼을 화면 **맨 아래부터** 채워야 한다(`[[feedback_button_layout_bottom_anchored]]` 메모리
> 참고). idle/panel처럼 상태 토글용 래퍼 div를 새로 넣을 때마다 `public/gms.css`의
> flex-chain 선택자 목록(`#exchangePressureTestIdle, #exchangePressureTestPanel, ...`)에
> **그 자리에서 바로** 새 id 쌍을 추가한다 — Risk 표에 적어두는 것만으로는 부족하고, 실제로
> CSS를 고치고 브라우저로 버튼-프레임바닥 간격을 확인해야 "완료"로 표시할 수 있다.
>
> **"동일 구조" = UI 요소까지 동일**: Plan/Design 문서가 "화면 A는 화면 B와 완전히 동일한
> 시퀀스"라고 명시하면, 이는 Step 데이터(밸브/타이머/조건)뿐 아니라 **화면의 UI 요소 배치
> (카운트 패널, 캡처 패널 등)까지 포함**한다. 아래 5.4절 체크리스트는 이 원칙에 따라 참조
> 화면(2P/-L)의 idle+panel HTML을 **통째로 복제**해서 얻은 목록이다 — 새로 지어내지 않는다.

### 5.1 화면 목록 (이미 존재, idle/panel 구조로 전면 교체)

- `public/OPERATION HTML/교환후3P_배관청소.html` — 참조: `교환전2P_2차 배관청소.html`(twoP)
- `public/OPERATION HTML/교환후+L_가압시험.html` — 참조: `교환전-L_감압시험.html`(exchangePressureTest)
- `public/OPERATION HTML/교환후4P_배관청소.html` — 참조: `교환전2P_2차 배관청소.html`(twoP, 3P와 동일 원형)

기존 마크업은 단일 패널짜리 뼈대(설정/진행 횟수 입력 + 실행 버튼)라 `SUBSEQ_NS` 엔진이
요구하는 idle/panel 2단 구조가 없다 — 참조 화면의 idle+panel 마크업을 그대로 복제하고
id 접두어만 치환한다(5.0절 원칙). Do 단계에서 각 화면의 idle/panel DOM id를 `SUBSEQ_NS`
매핑(11.1절 필드)에 정확히 일치시키고, `public/gms.css`의 flex-chain 선택자 목록에도
새 id 쌍을 추가한다(빠뜨리면 버튼이 화면 위쪽에 쌓임).

### 5.2 User Flow

```
[2차 배관청소(2P) 완료] → PASSWORD(cylinderExchangeDone) → [용기교체 CC 6화면]
  → PASSWORD(cylReplaceDone) → [교환후3P] → [교환후+L] → [교환후4P]
  → PASSWORD(exchangeFourthPurgeDone) → [PC 퍼지완료/가스공급 메뉴]
```

### 5.4 Page UI Checklist

> 아래 항목은 전부 참조 화면(2P/-L)의 idle+panel 구조를 그대로 복제해서 나온 것 — 화면별로
> 빠짐없이 포함해야 하며, 브라우저에서 버튼이 화면 하단에 붙어 있는지 반드시 확인한다.

#### 교환후3P_배관청소.html (참조: 2P)
- [ ] idle 상태: 안내문 + `sub-seq-last-alarm` + `purge-count-panel`(idleCycleInfo, 기본 숨김) + 실행/취소/TREND 버튼 + 엑셀 내보내기/불러오기 버튼
- [ ] panel 상태: `sub-seq-step-label`/`sub-seq-operation`/`sub-seq-message`/`sub-seq-valve-diff`/`sub-seq-timer`/`sub-seq-acc-time` + 알람 배너
- [ ] 상단 큰 배지(`.step-badge-lg`): 현재 Status(3P) `.blinking` 표시
- [ ] 반복 진행 표시(`purge-count-panel`): **설정 횟수 / 진행 횟수** 박스(2P와 동일 레이아웃)
- [ ] 확인/일시정지/초기화/취소/TREND 버튼 + 엑셀 내보내기/불러오기 버튼(panel 쪽)
- [ ] 알람 발생 시 알람 메시지 표시(`alarmMessage`)
- [ ] 버튼 묶음이 화면 하단에 고정(`gms.css` flex-chain에 `exchangeThirdPurgeIdle`/`exchangeThirdPurgePanel` 등록)

#### 교환후+L_가압시험.html (참조: -L)
- [ ] idle 상태: 안내문 + `sub-seq-last-alarm` + `purge-count-panel`(설정시간(분)/진행시간(분), 기본 숨김) + 실행/취소/TREND + 엑셀 버튼
- [ ] panel 상태: **초기값(HPT)/현재값(HPT)** 캡처 패널(`captureInitial`/`captureCurrent`) + **설정시간(분)/진행시간(분)** 박스(`cycleCurrentAsTime`으로 "N분 SS초" 표시)
- [ ] 확인/일시정지/초기화/취소/TREND 버튼 + 엑셀 내보내기/불러오기 버튼(panel 쪽)
- [ ] 버튼 묶음이 화면 하단에 고정(`gms.css` flex-chain에 `exchangeAfterPressureTestIdle`/`exchangeAfterPressureTestPanel` 등록)

#### 교환후4P_배관청소.html (참조: 2P, 3P와 동일)
- 교환후3P와 완전히 동일한 체크리스트(id 접두어만 `exchangeFourthPurge*`) — 버튼 하단 고정 포함

---

## 6. Error Handling

이 기능은 HTTP 에러가 아니라 GMS 자체 **알람 시퀀스(Alarm Seq.)** 체계를 따른다(기존 관례 그대로):

| Alarm Seq | 의미 | 처리 |
|---|---|---|
| (없음, alarmGoto만 있음) | 조건 미충족이지만 정상 반복/대기 | 밸브·누적시간 유지한 채 alarmGoto Step으로 가볍게 이동, 알람 안 남음 |
| 1 (또는 CONFIG에 정의된 코드) | 진짜 알람 — 안전조건 위반 | 시퀀스 정지, `alarmMessage` 표시, 사용자 개입 필요 |

값이 없는 신규 태그(PLC 미매핑)는 조건을 조용히 건너뛰고 콘솔에 경고만 남긴다 — 이것은
오작동이 아니라 이 프로젝트의 명시적 관례다(핸드오프 문서 11.5절).

---

## 7. Security Considerations

- [ ] 이 3개 화면은 이미 존재하는 PASSWORD 게이트(`cylReplaceDone` 진입, `exchangeFourthPurgeDone` 이탈) 범위 안에 있으므로 신규 인증/인가 로직 불필요
- [ ] 신규 CONFIG 항목은 `data/gmsSubSequenceConfig.json`(로컬 파일)에만 저장 — 외부 노출 없음
- [ ] N/A: XSS/SQLi/HTTPS — 신규 사용자 입력 폼이나 서버 엔드포인트 없음

---

## 8. Test Plan

> 이 프로젝트에는 Playwright 등 자동화 테스트 인프라가 없다(package.json에 테스트 스크립트 없음).
> 검증은 기존 GMS 작업 관례대로 **브라우저 수동 확인 + 콘솔 로그 확인**으로 진행한다.

### 8.1 Test Scope

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| 수동 화면 검증 | 3P→+L→4P→PC 전체 흐름 | 브라우저(gms.html) 직접 조작 | Do |
| 콘솔 로그 검증 | 값 없는 태그의 "조건 건너뜀" 경고가 정상 출력되는지 | 브라우저 개발자 도구 콘솔 | Do |
| 회귀 확인 | 기존 1P~2P 서브시퀀스가 여전히 정상 동작하는지 | 브라우저 수동 확인 | Do 완료 후 |

### 8.2 수동 검증 시나리오

| # | 시나리오 | 절차 | 성공 기준 |
|---|---|---|---|
| 1 | 3P 정상 진행 | 2차 배관청소 완료 → CC 6화면 통과 → 3P 진입 | 밸브 배지/반복 카운트가 Step 데이터대로 갱신됨 |
| 2 | +L 안정화+시험 반복구간 | 3P 완료 → +L 진입, CONFIG 시간을 짧게(예: 1분) 임시 설정 후 진행 | 초기값 캡처 1회만, 분단위 진행시간이 올라감, 설정시간 도달 시 다음 구간 진행 — **검증 후 CONFIG 값 원복 필수**(10절 관례) |
| 3 | 4P → PC 전환 | 4P 완료 → PASSWORD(`exchangeFourthPurgeDone`) 확인창 → 확인 | PC(퍼지완료/가스공급 메뉴) 화면으로 전환, Status가 PC로 갱신 |
| 4 | Status Jump / B선택 | 상단 배지 클릭(3P/+L/4P) 및 "B"선택 버튼으로 각 Status 진입 | `performStatusJump`/`showScreenForSideStatus` 둘 다 올바른 화면 표시(4절 관례 — 두 함수 모두 분기 필요) |
| 5 | 값 없는 태그 안전성 | 신규 태그(예: 3P용 압력 태그)가 아직 `memoryAreas.js`에 없는 상태로 진행 | 조건 평가를 조용히 건너뛰고 콘솔 경고만 남음, 시퀀스가 죽지 않음 |
| 6 | 기존 서브시퀀스 회귀 | 1P~2P 서브시퀀스를 처음부터 끝까지 재실행 | 이번 변경(공용 레지스트리 키 추가) 전과 동일하게 동작 |

### 8.5 CONFIG(시드) 요구사항

| CONFIG 항목 | 필요 여부 | 비고 |
|---|---|---|
| `교환후 3차 퍼지진행 횟수` | 필수 | 3P 반복 판정 |
| `가압 안정화 시간[분]` / `가압 시간[분]` | 필수 | +L 반복구간 판정 |
| `교환후 4차 퍼지진행 횟수` | 필수 | 4P 반복 판정 |

Do 단계에서 `data/gmsSubSequenceConfig.json`에 시드 후 테스트, 완료 후 원래(실제 운영) 값으로
되돌린다(테스트용 임시 시간 축소 시 특히 주의 — 11.5절 관례).

---

## 9. Clean Architecture

> 이 프로젝트는 Layer(Presentation/Application/Domain/Infrastructure) 분리를 쓰지 않는
> 단순 정적 프론트엔드 + Express 서버 구조다. 대신 GMS 서브시퀀스 엔진 자체의 레이어를 표로 정리한다.

### 9.1 Layer Structure (GMS 서브시퀀스 엔진 기준)

| Layer | Responsibility | Location |
|-------|---------------|----------|
| **화면(Presentation)** | 마크업, DOM id | `public/OPERATION HTML/*.html` |
| **상태 머신(Status)** | 화면 전환, Status 인덱스, PASSWORD 게이트 | `public/Operation.js` |
| **서브시퀀스 엔진(Engine)** | Step 순회, 조건 평가, 타이머, CAPTURE | `public/gms-sub-sequence-runner.js` |
| **Step 데이터(Data)** | 밸브/타이머/판정 조건 정의 | `data/gmsSubSequences/*.json`, `data/gmsSubSequenceConfig.json` |

### 9.2 Dependency Rules

```
화면(HTML id) ──▶ Operation.js(Status) ──▶ gms-sub-sequence-runner.js(Engine) ──▶ Step JSON/CONFIG
Rule: 화면은 Engine을 직접 참조하지 않는다(Operation.js가 중개). Engine은 Step 데이터를
      fetch로만 읽고, 화면 마크업을 직접 알지 못한다(id 매핑은 SUBSEQ_NS 등록 시점에만 연결).
```

### 9.4 이번 기능의 등록 대상

| Component | Layer | Location |
|-----------|-------|----------|
| `AfterThreeP`/`AfterPlusL`/`AfterFourP` 네임스페이스 | Engine 등록 | `public/gms-sub-sequence-runner.js`의 `SUBSEQ_NS` |
| 3개 Step JSON | Data | `data/gmsSubSequences/` |
| `progress...Body`/`progressScreens`/`OPERATION_SCREEN_FILES` 3개 화면 항목 | Status 연결 | `public/Operation.js` |
| flex-chain CSS 선택자(신규 idle/panel id, 필요 시) | Presentation 보강 | `public/gms.css` |

---

## 10. Coding Convention Reference

> 이 프로젝트는 ESLint/Prettier/TS 설정이 없다 — 기존 GMS 코드의 관례를 그대로 따른다
> (`docs/GMS_AUTO_SEQUENCE_HANDOFF.md` 10절).

### 10.4 이번 기능의 관례 적용

| Item | Convention Applied |
|------|-------------------|
| 화면 파일명 | `<Status코드>_<화면이름>.html` (이미 존재, 변경 없음) |
| Step JSON 파일명 | `<mainStepType>_v1.json` (예: `AfterThreeP_v1.json`) |
| 신규 화면 추가 시 5곳 동시 반영 | (1) HTML 파일(기존) (2) `gms.html` 컨테이너 div(기존) (3) `Operation.js` 3개 맵 (4) `CYL_EXCHANGE_PURGE_STEPS` 등 (5) `wireOperationScreens()` 버튼 배선 — HTML/컨테이너는 이미 있으므로 (3)~(5)만 신규 작업 |
| 밸브 태그 이름 | 관례 접미사(`_{side}`) 유지, 실주소 없는 태그는 이름만 관례대로 |

---

## 11. Implementation Guide

### 11.1 File Structure

```
data/gmsSubSequences/
├── AfterThreeP_v1.json   (신규)
├── AfterPlusL_v1.json    (신규)
└── AfterFourP_v1.json    (신규)

public/
├── gms-sub-sequence-runner.js   (SUBSEQ_NS 3개 네임스페이스 + 5개 레지스트리 추가)
├── Operation.js                 (3개 화면 진입점 로직 교체)
└── gms.css                      (flex-chain 선택자, 필요 시)

data/gmsSubSequenceConfig.json   (CONFIG 항목 4개 추가)
```

### 11.2 Implementation Order

1. [x] 기존 `mainStep` 번호 스캔(모든 `data/gmsSubSequences/*.json`) → 3개 화면에 겹치지 않는 번호 배정(17/18/19 — 16은 `CylReplace_v1.json`이 이미 사용 중이라 회피)
2. [x] `AfterThreeP_v1.json` 작성 — `TwoP_v1.json`을 그대로 복제(값 포함), `mainStep`/`operation`/`message`/Step17 `conditionValue`("교환 후 1차 Purge 횟수_{side}")만 교체
3. [x] `AfterFourP_v1.json` 작성 — 위와 동일 원리로 `TwoP_v1.json` 복제, `conditionValue`만 "교환 후 2차 Purge 횟수_{side}"로 교체
4. [x] `AfterPlusL_v1.json` 작성(`ExchL_v1.json` 구조 복제 — CAPTURE+진행횟수 2단계 반복구간, 값은 새로 추정, 안전조건 방향은 가압이라 반대(`>=`))
5. [x] **CONFIG는 신규 추가하지 않음** — 사용자 확인(2026-08-09)에 따라 `data/gmsSubSequenceConfig.json`에 이미 시드돼 있던 측별 항목을 그대로 재사용: 3P="교환 후 1차 Purge 횟수_A/B"(`postExchangeFirstPurgeCount_A/B`), 4P="교환 후 2차 Purge 횟수_A/B"(`postExchangeSecondPurgeCount_A/B`), +L="가압 시험-안정화/시험 시간_A/B"+"가압 시험-압력 하한_A/B"
6. [x] `gms-sub-sequence-runner.js`에 네임스페이스 3개(`afterThreeP`/`afterPlusL`/`afterFourP`) + 5개 레지스트리 등록(기존 `twoP`/`exchangePressureTest` 항목과 diff 비교로 누락 확인 완료)
7. [x] 3개 화면 HTML을 참조 화면(2P/-L)의 idle+panel 구조로 전면 재작성(5.0/5.4절 원칙 — 기존 단일 패널 뼈대에서 교체, id 접두어만 치환)
8. [x] `public/gms.css`의 flex-chain 선택자 목록에 새 idle/panel id 3쌍 등록(누락 시 버튼이 화면 위로 쌓이는 재발 버그 — `[[feedback_button_layout_bottom_anchored]]` 참고)
9. [x] `Operation.js`의 3P/+L/4P 진입점을 뼈대 로직에서 엔진 호출(`startNamespacedSubSequenceRunner`)로 교체, `advanceExchangeFourthPurgeDone`를 `window`에 노출(`CYL_EXCHANGE_PURGE_STEPS` 등 인덱스 기반 유지)
10. [x] 4P 완료 → PASSWORD(`exchangeFourthPurgeDone`) → PC Status 전환을 브라우저에서 확인(2026-08-09) — Status Jump로 4P 진입 → 완료 → PASSWORD "4321" → `[A] 가스 공급`(PC) 화면 정상 전환 확인
11. [x] §8.2 수동 검증 시나리오 6개 수행(2026-08-09) — 아래 "브라우저 검증 결과" 참고. 시나리오 2(+L 완주)만 알려진 한계로 미완주, 나머지 5개는 통과
12. [ ] `docs/GMS_AUTO_SEQUENCE_HANDOFF.md` 7절/9절 갱신(3P/4P는 스텁 목록에서 제거, +L은 "구조 완료·밸브 로직 placeholder"로 갱신)

### 11.4 브라우저 검증 결과 (2026-08-09)

검증 중 이 기능 범위 밖의 **기존 데이터 버그 2건**을 추가로 발견해서 함께 고쳤다(코드 버그
아님 — Do 단계 코드는 정상이었고, 두 데이터 파일이 문제였다):

| 발견한 문제 | 원인 | 조치 |
|---|---|---|
| CC 완료 후 3P가 아니라 **+L이 먼저** 뜸 | `data/gmsMainSequence.json`의 `order` 배열에 `+L`이 `3P`보다 앞에 등록돼 있었음(2026-08-01 생성, 이 기능과 무관하게 이미 잘못돼 있던 데이터) | `order` 배열에서 `3P`/`+L` 두 항목의 `type`을 맞바꿔 `...→Bypass→3P→+L→-VT→4P→PC`로 수정 |
| +L 화면 진입 시 즉시 `"AfterPlusL"에 연결된 서브시퀀스가 없습니다` 토스트만 뜨고 엔진이 전혀 시작 안 됨(3P/4P도 동일 증상) | `data/gmsSubSequenceSelection.json`에 `AfterThreeP`/`AfterPlusL`/`AfterFourP` 항목 자체가 없었음 — `startNamespacedSubSequenceRunner`가 이 매핑으로 실제 Step 파일을 찾는데, 매핑이 없으면 즉시 종료함(module-1/2 구현 시 Step JSON만 만들고 이 등록을 빠뜨림) | `selection`에 `"AfterThreeP": "AfterThreeP_v1"`/`"AfterPlusL": "AfterPlusL_v1"`/`"AfterFourP": "AfterFourP_v1"` 3줄 추가 |

이 두 가지를 고치기 전까지는 3P/+L/4P가 전부 **엔진이 아예 시작되지 않는 상태**였다 — 코드
리뷰나 정적 검증(accTimeSec 합계, mainStep 충돌, CONFIG 이름 존재 확인)만으로는 못 잡는
유형의 버그였고, 실제 브라우저 실행으로만 발견됐다.

**시나리오별 결과** (CONFIG 반복횟수/시간을 임시로 1로 낮춰서 검증, 완료 후 원복함):

| # | 시나리오 | 결과 |
|---|---|---|
| 1 | 3P 정상 진행 | ✅ 통과 — Status Jump로 3P 진입, `설정 횟수:1/진행 횟수:0`→완료 시 `1`, PNV/PGII_A 등 밸브 배지가 SVG 배관도에 실시간 반영됨, 완료 후 자동으로 +L로 전환 |
| 2 | +L 안정화+시험 반복구간 완주 | ⚠️ 부분 통과 — 패널 UI(초기값/현재값/설정시간/진행시간)는 정상 표시되지만, Step3의 준비 구간(`HPT_{side} <= 진공하한치_{side}`, ExchL 구조를 그대로 참고한 부분)이 PLC 미연결 상태에서 기본값(대기압 근사치)과 비교돼 즉시 Alarm Seq.1로 정지함 — **설계 시점에 이미 "실제 가압 준비 절차와 맞지 않을 수 있음"으로 명시한 알려진 한계**(§3.2, JSON `remarks`)이지 이번에 새로 생긴 버그가 아님. 엔진 자체(조건 평가/알람 배너/CAPTURE)는 정상 동작 |
| 3 | 4P → PC 전환 | ✅ 통과 — 4P 완료 → PASSWORD(`exchangeFourthPurgeDone`, "4321") → `[A] 가스 공급`(PC) 화면 정상 진입 |
| 4 | Status Jump / B선택 | ✅ 통과 — 상단 배지 클릭 → PASSWORD → 3P/4P 각각 정상 진입 확인(`performStatusJump` 경로) |
| 5 | 값 없는 태그 안전성 | ✅ 통과(단, 정정) — 실제로는 HPT_A 등 태그가 "완전히 없는" 게 아니라 PLC 미연결 시 기본값(대기압 근사치)을 반환함 — 이 값이 진공/가압 판정 조건에 맞지 않으면 "조용히 건너뜀"이 아니라 **정상적으로 Alarm Seq.1이 발생**한다(엔진이 죽지 않고 배너로 안내, 설계된 대로). "값이 아예 없으면 건너뛴다"는 관례는 조건에 쓰인 CONFIG/태그가 진짜로 존재하지 않을 때만 해당됨 |
| 6 | 기존 서브시퀀스(1P~2P) 회귀 | ✅ 통과(간접 확인) — CC 6화면(별도 기능, `gms-cc-replace-subseq`)이 이번 세션에서 처음부터 끝까지 정상 동작해 공용 레지스트리 변경으로 인한 회귀가 없음을 확인 |

### 11.3 Session Guide

#### Module Map

| Module | Scope Key | Description | Estimated Turns |
|--------|-----------|-------------|:---------------:|
| Step 데이터 작성 (3개 JSON + CONFIG) | `module-1` | 3P/+L/4P Step JSON + CONFIG 항목 작성 | 15-20 |
| 엔진/상태머신 연결 | `module-2` | SUBSEQ_NS 등록, Operation.js 진입점 교체, 화면 검증 | 20-25 |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| Session 1 | Plan + Design | 전체 | 완료 |
| Session 2 | Do | `--scope module-1` | 15-20 |
| Session 3 | Do | `--scope module-2` (+ 브라우저 검증) | 20-25 |
| Session 4 | Check + Report | 전체 | 15-20 |

---

## 12. 확장: Bypass 신규 화면 + 실제 가압시퀀스 (2026-08-09)

> §3.2/§3.3의 +L 관련 내용은 이 절이 **대체**한다 — 사용자가 `docs/TASK.md`에 실제 엔지니어링
> 스펙(밸브 순서/옵션/CONFIG 이름/시간값)을 직접 제공했으므로 더 이상 "구조만 참고, 값은
> 추정"이 아니다. 범위가 원래 계획을 넘어 Status "Bypass"(배관 By-pass 체크) 신규 구현까지
> 포함한다(Plan 문서 §10 참고).

### 12.1 아키텍처 — 왜 새 엔진 기능을 추가하지 않았는가

옵션(Bypass 사용/고압 HE Leak check/가압시험후 Puls Vent)에 따른 분기가 필요했지만, 이미
`gms-sub-sequence-runner.js`에 **정확히 이 용도로 만들어진 메커니즘**(`SUB_SEQ_OPTION_TAGS`
레지스트리 — OPTION 탭 토글을 Step의 `alarmMonitoring`에서 "가상 bit 태그"처럼 ON/OFF
연산자로 참조)이 이미 존재했다. 새 엔진 개념을 도입하는 대신:

1. gms.js에 옵션 변수 3개 + OPTION 탭 UI만 추가
2. `SUB_SEQ_OPTION_TAGS`에 3줄만 추가(주석에 "새 OPTION 스위치를 추가하면 여기 한 줄만
   적으면 된다"고 이미 문서화돼 있던 그대로)
3. Step 데이터에서 `alarmMonitoring="<옵션태그>"`, `conditionOp="ON"|"OFF"`,
   `nextStep`/`alarmGoto`로 분기(예: OFF가 참이면 nextStep, ON이면 alarmGoto — alarmGoto가
   있으므로 실제 알람은 안 남고 조용히 분기)

유일한 실제 엔진 확장은 `:CAPOFFSET` 비교대상 앞에 `-` 부호를 허용한 것(예:
`"-가압 시험-압력 변동 기준_{side}"` → 목표값 = 초기값 - CONFIG값) — 기존 VT 누출시험은
"초기값+허용증가"(양의 방향)만 지원했는데, 가압시험은 "초기값-허용감소"(음의 방향, 압력
하락=누출)가 필요했기 때문이다. 3~4줄 추가로 하위호환(기존 파일은 `-` 없이 그대로 동작).

### 12.2 Bypass 신규 Step 흐름 (`data/gmsSubSequences/Bypass_v1.json`, 34 Step)

```
Step 1~24  1P_2차측Purge 재확인(OneP2_v1.json 그대로 복제, CONFIG "교환전 2차측 퍼지 횟수" 공유)
Step 25    분기: 고압HELeakCheck 옵션 OFF → Step26(PNBV) / ON → Step28(HPIV)
Step 26-27 PNBV(2s)→PIV(2s) → Step30
Step 28    HPIV(2s) → Step30
Step 30/30A NPT 진공유지 확인(60s×N분, "Bypass 진공유지 확인시간[분]" CONFIG, 신규)
             실패 시 alarmMessage "PGII Valve bypass 의심"
Step 31    PGII(2s)
Step 32/32A HPT 진공유지 확인(동일 시간) - 실패 시 "PGI Valve bypass 의심"
             (PGI는 아직 Close 상태 - 그 밀폐를 간접 검증)
Step 33    완료 → advanceToNextEnabledStatus(3P, 단순 연결)
```

- mainStep=20(기존 파일들과 충돌 없음 확인 완료)
- 밸브 태그/신규 CONFIG("Bypass 진공유지 확인시간[분]", 기본 5분) 전부 §10.3(Plan) 참고
- 알람 발생 시 사용자가 "실행"을 다시 누르면 Alarm Seq.1 관례상 Step 1(1P_2차측Purge
  처음)부터 재확인한다(TASK.md 지시 그대로, 별도 재시작 힌트 로직 불필요)

### 12.3 +L 신규 Step 흐름 (`data/gmsSubSequences/AfterPlusL_v1.json`, 23 Step, 전면 재작성)

```
Step 1     Mode 시작
Step 2     분기: Bypass사용 옵션 OFF → Step3(HPIV부터) / ON → Step6B(PGI부터, Bypass가
           이미 HPIV/PGII/NPT 확인 완료로 간주)
Step 3-5   (OFF만) HPIV(2s)→PGII(2s)→NPT 범위확인(하한<NPT<상한, 기존 시드 CONFIG)
Step 6/6B  PGI(2s) - 두 분기가 여기 이후 Step7에서 합류
Step 7     HPT 범위확인(공용)
Step 8/8A  압력안정화시간(CAPTURE+실시간 안전감시, 하한 이탈 시 즉시 FAIL·정지)
Step 9/9A  시험시간(CAPOFFSET 부호확장 - 초기값-압력변동기준 밑으로 벗어나면 FAIL)
Step 15    분기: 가압시험후PulsVent 옵션 OFF → Step30(완료) / ON → Step17(Puls Vent)
Step 17-23 Puls Vent 미니시퀀스(Puls_v1.json Step2~8 구조 재사용, 이 구간에서 연 밸브만 Close
           - 가압시험 본 구간에서 연 HPIV/PGII/PGI 등은 건드리지 않음)
Step 30    공용 완료(Puls Vent 유무 두 경로 합류) → advanceToNextEnabledStatus(-VT 또는 4P)
```

- mainStep=18(기존 유지), CONFIG는 전부 기존 시드 항목 재사용(§10.3 Plan 참고) - 신규 CONFIG 없음
- Step 9의 CAPTURE는 Step 8과 별개로 재캡처한다(안정화 종료 시점 값을 시험 구간의 새
  "초기값"으로 삼음 - ExchL의 두 CAPTURE 구간과 동일한 기존 패턴, TASK.md 문구("가압시험
  초기값") 자체는 단일 값을 암시하지만 기존 엔진 관례를 우선해 통일함 - 필요시 향후 조정)

### 12.4 검증 결과

Plan 문서 §10.4 참고(구현/브라우저 검증 결과), §10.5(남은 검증 항목).

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-09 | 최초 작성 (Option C 채택) | Claude |
| 0.2 | 2026-08-09 | §11.4 브라우저 검증 결과 추가, Implementation Order 실제 완료 반영 | Claude |
| 0.3 | 2026-08-09 | §12 확장 — 사용자 제공 실제 가압시험/Bypass 스펙(TASK.md) 전면 반영, §3.2/§3.3 대체 | Claude |
