---
template: plan
version: 1.3
---

# 교환후 3P/+L/4P 서브시퀀스 엔진 전환 Planning Document

> **Summary**: GMS 조작화면의 교환후(Status 3P/+L/4P) 3개 화면을 뼈대(스텁) 상태에서
> 교환전과 동일한 서브시퀀스 실행 엔진(SUBSEQ_NS 패턴) 기반으로 전환한다.
>
> **Project**: plc-monitoring-usb (Omron CJ2H-65EIP GMS 조작화면)
> **Version**: 0.1.0
> **Author**: —
> **Date**: 2026-08-09
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 교환후 3P(배관청소)/+L(가압시험)/4P(배관청소) 3개 화면이 여전히 뼈대 상태 — 밸브/타이머/판정 조건이 없어 클릭하면 바로 다음 화면으로 넘어간다. 교환전(1P/-L/-VT/2P)은 이미 서브시퀀스 엔진으로 전환되어 실제 밸브 개폐·타이머·판정이 동작하는 것과 대비된다. |
| **Solution** | **3P/4P는 2P(`TwoP_v1.json`)와 완전히 동일한 시퀀스**임을 사용자가 확인함(2026-08-09) — 밸브/타이머/조건 구조를 그대로 복제하고, 상단 큰 배지·중간 화면 표시 문구와 CONFIG 반복횟수 항목명만 화면별로 교체한다(`AfterThreeP_v1.json`/`AfterFourP_v1.json`). +L은 별도로 `ExchL_v1.json`(감압시험) 구조를 참고해 `AfterPlusL_v1.json`을 작성한다. `gms-sub-sequence-runner.js`의 `SUBSEQ_NS`에 3개 네임스페이스를 추가하고, CONFIG에 신규 반복횟수 항목을 추가한다. 실제 반복횟수 값 자체는 아직 없으므로 플레이스홀더로 둔다. |
| **Function/UX Effect** | 교환후 구간도 교환전과 동일하게 실시간 밸브 상태 배지, 진행 타이머, 반복 판정, 알람 시퀀스가 동작하게 된다. 조작화면 사용자 입장에서 3P/+L/4P가 "실행하면 그냥 넘어가는 화면"에서 "실제로 감시하는 화면"으로 바뀐다. |
| **Core Value** | GMS 자동 진행 시퀀스의 커버리지를 교환전에서 교환후까지 확장 — 실제 밸브 명령/PLC 연동 전 단계까지 시뮬레이션 및 UI 검증이 가능해진다. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 교환후 3P/+L/4P가 뼈대 상태라 GMS 자동 진행 시퀀스가 교환전에서 끊긴다 |
| **WHO** | GMS 조작화면을 실제로 조작하는 현장 오퍼레이터, 이후 실기 PLC 연동을 담당할 개발자 |
| **RISK** | 실제 PLC I/O 매핑이 없어 밸브 태그/CONFIG 값이 전부 추정치(플레이스홀더) — 나중에 실기 검토 시 전면 수정 필요 |
| **SUCCESS** | 3개 화면 모두 `SUBSEQ_NS` 패턴으로 동작하고, 교환후4P 완료 시 PASSWORD(`exchangeFourthPurgeDone`) 게이트를 거쳐 PC(퍼지완료) Status로 정상 전환됨 |
| **SCOPE** | 이번 계획은 3P→+L→4P 3개 화면 Step JSON 작성 + 네임스페이스 등록까지. 가스공급(READY/Service) 이후 단계, 실제 PLC I/O 매핑, VT 관련 태그 매핑은 범위 밖 |

---

## 1. Overview

### 1.1 Purpose

GMS(Gas Monitoring System) 조작화면의 실린더 교환 시퀀스 중 "교환후" 구간(Status 3P/+L/4P)을
현재의 정적 뼈대 화면에서, 교환전 구간과 동일한 서브시퀀스 실행 엔진 기반 자동 진행 화면으로
전환한다.

### 1.2 Background

`docs/GMS_AUTO_SEQUENCE_HANDOFF.md` 9절 기준, 교환전(1P/-L/-VT/2P)은 전부 서브시퀀스 엔진
전환이 완료되었으나 교환후(3P/+L/4P)는 "여전히 밸브/조건 미정 뼈대"로 남아 있다.

**사용자 확인(2026-08-09)**: 교환후 3P/4P는 교환전 2P(`TwoP_v1.json`)와 **완전히 동일한
시퀀스**다 — 밸브 개폐/타이머/반복 판정 조건을 그대로 복제하면 되고, 다른 점은 오직
(1) 상단 큰 배지(`.step-badge-lg`)에 표시되는 Status 코드, (2) 화면 중간(`operation`/
`message` 필드)에 표시되는 문구, (3) 반복 종료 판정에 쓰이는 CONFIG 항목명(신규 추가 필요)
뿐이다. +L(가압시험)은 3P/4P와 다른 구조(`ExchL_v1.json`의 CAPTURE+분단위 반복판정 2단계)를
따른다.

### 1.3 Related Documents

- `docs/GMS_AUTO_SEQUENCE_HANDOFF.md` — 7절(화면 목록)/9절(스텁 목록)/11절(서브시퀀스 엔진 상세)
- `docs/GMS_SUBSEQUENCE_EXCEL_GUIDE.md` — Step 데이터 엑셀 편집 가이드
- 참고 Step 데이터: `data/gmsSubSequences/TwoP_v1.json`, `ExchL_v1.json`

---

## 2. Scope

### 2.1 In Scope

- [ ] `교환후3P_배관청소.html` — `TwoP_v1.json`(2차 배관청소)을 **그대로 복제** — 밸브/타이머/조건 값 동일, 상단 배지·중간 화면 문구·CONFIG 반복횟수 항목명만 3P용으로 교체
- [ ] `교환후+L_가압시험.html` — `ExchL_v1.json`(감압시험)과 동일 구조로 Step 데이터 작성 (안정화 → 시험 2단계 반복구간, 3P/4P와는 별개 구조)
- [ ] `교환후4P_배관청소.html` — `TwoP_v1.json`을 **그대로 복제**(3P와 동일한 원리) — 상단 배지·중간 화면 문구·CONFIG 반복횟수 항목명만 4P용으로 교체
- [ ] `data/gmsSubSequenceConfig.json`에 **신규 CONFIG 항목 추가**: "교환후 3차 퍼지진행 횟수", "교환후 4차 퍼지진행 횟수"(2P가 쓰는 "교환전 2차 퍼지진행 횟수"와 별개 항목으로 신규 추가 — 값은 플레이스홀더)
- [ ] 3개 화면 각각 `gms-sub-sequence-runner.js`의 `SUBSEQ_NS`에 네임스페이스 추가 + 5개 레지스트리(`subSeqAlarmActive`/`subSeqRestartFromStepNo`/`subSeqRunStates`/`subSeqPendingResumes`/`subSeqCallbacks`) 반영
- [ ] `Operation.js`의 `progress...Body`/`progressScreens`/`OPERATION_SCREEN_FILES` 맵에 반영(이미 화면 자체는 존재하므로 로직만 교체)
- [ ] 4P 완료 시 PASSWORD(`exchangeFourthPurgeDone`) 게이트를 거쳐 PC(퍼지완료) Status로 정상 전환되는지 확인

### 2.2 Out of Scope

- 가스공급(READY/Service) 이후 단계(유량 실시간 모니터링, 실제 밸브 명령 등) — 별도 계획
- 실제 PLC I/O 주소 매핑(밸브 태그 → `memoryAreas.js` 실주소) — 실기 엔지니어링 검토 후 별도 진행
- VT 관련 태그(`VT_{side}`) 실주소 매핑
- 용기교체 CC 6화면의 바코드/Lot No. 관련 미구현 항목

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 교환후3P 화면이 2P(`TwoP_v1.json`)와 동일한 밸브/타이머/반복 판정으로 동작하며, 배지·문구·CONFIG명만 3P용이다 | High | Pending |
| FR-02 | 교환후+L 화면이 안정화→시험 2단계 반복구간 구조로 동작한다(`ExchL_v1.json` 패턴) | High | Pending |
| FR-03 | 교환후4P 화면이 2P와 동일한 밸브/타이머/반복 판정으로 동작하며, 배지·문구·CONFIG명만 4P용이다 | High | Pending |
| FR-04 | 4P 완료 시 PASSWORD(`exchangeFourthPurgeDone`) 게이트 → PC Status 전환이 기존 로직(`Operation.js`)과 그대로 맞물린다 | High | Pending |
| FR-05 | CONFIG 탭에 "교환후 3차 퍼지진행 횟수"/"교환후 4차 퍼지진행 횟수"가 신규 항목으로 추가되어 조정 가능하다 | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 일관성 | 기존 `SUBSEQ_NS` 패턴(11.1~11.4절)과 동일한 필드/네이밍 규칙 준수 | 코드 리뷰, 기존 네임스페이스와 diff 비교 |
| 안전성 | 값 없는 신규 태그는 조건을 조용히 건너뛰고 로그만 남김(오작동 아님) | 브라우저 콘솔 로그 확인 |
| 검증 가능성 | `accTimeSec`가 Step별 `timeSec` 누적 합과 일치 | Node 스크립트로 검증(이 환경엔 Python 없음) |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [x] 3개 Step JSON 파일(`data/gmsSubSequences/`) 작성 완료
- [x] `gms-sub-sequence-runner.js` 네임스페이스 3개 + 5개 레지스트리 등록 완료
- [x] `data/gmsSubSequenceConfig.json`에 CONFIG 값 추가 — **재확인: 신규 추가가 아니라 기존
      시드 항목 재사용으로 확정**(2026-08-09)
- [x] 브라우저에서 3P→+L→4P→PC 전체 흐름 확인(2026-08-09) — 3P/4P는 완주, PASSWORD→PC 전환
      정상. +L은 엔진/UI는 정상이나 준비 구간 Step이 알려진 한계로 Alarm 발생(§11.4 Design
      문서 "브라우저 검증 결과" 참고) — 이 과정에서 이 기능과 무관한 기존 데이터 버그 2건
      (`gmsMainSequence.json` 순서, `gmsSubSequenceSelection.json` 등록 누락)도 함께 발견/수정
- [x] `docs/GMS_AUTO_SEQUENCE_HANDOFF.md` 7절/9절 갱신 — 3P/4P는 스텁 목록에서 제거, +L은
      "엔진 구조 완료·밸브 로직은 여전히 placeholder"로 갱신

### 4.2 Quality Criteria

- [x] 새 태그는 전부 관례 이름(`{side}` 접미사 등)만 사용, 주소를 지어내지 않음
- [x] `public/gms.css`의 flex-chain 선택자에 새 idle/panel id 누락 없음(10절 관례) — 실제로
      CSS를 고치고 브라우저 스크린샷으로 버튼이 화면 하단에 붙어 있는 것까지 확인함
      (`[[feedback_button_layout_bottom_anchored]]` 메모리 — 이 프로젝트에서 반복 재발한 실수,
      이번에도 처음엔 빠뜨렸다가 사용자 지적으로 발견/수정)
- [x] 화면 추가 시 5곳(HTML/gms.html 컨테이너/Operation.js 3개 맵/버튼 wiring) 전부 반영
- [x] **"화면 A는 화면 B와 완전히 동일한 시퀀스"라는 확인은 Step 데이터뿐 아니라 UI 요소
      배치(설정횟수/진행횟수 패널, 초기값/현재값 캡처 패널 등)까지 포함한다** — 참조 화면의
      idle+panel HTML을 통째로 복제해서 만들었고, 브라우저 검증으로 3P/4P 둘 다 설정 횟수/
      진행 횟수 패널이 정상 표시됨을 확인

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| (+L만 해당) 실제 밸브/판정 조건을 모르는 채로 Step을 지어내면 실기 검토 시 전면 재작성 필요 — 3P/4P는 2P와 동일 구조로 확정되어 이 리스크 해당 없음 | Medium | Medium | CONFIG/Step 값에 "예시값, 실제 값은 엔지니어링 검토 후 교체 필요"를 명시하고, 구조(Step 흐름)만 확정, 값은 플레이스홀더로 유지 |
| 3P/4P Step 데이터를 복제하면서 `mainStep`/CONFIG 항목명 등 화면별로 반드시 바꿔야 하는 값을 하나라도 빠뜨리면 3P·4P가 서로 같은 CONFIG를 참조하는 사고 발생 | Medium | Medium | 복제 직후 3P/4P 두 JSON을 diff해서 값이 다른 필드(배지 문구, CONFIG명, mainStep)만 정확히 표시되는지 확인 |
| `-VT` 텍스트 중복 인덱스 버그(8절 기존 사고)와 유사한 인덱스 실수 재발 | Medium | Low | `CYLINDER_STEP_ORDER`/`CYL_EXCHANGE_PURGE_STEPS` 관련 코드는 반드시 인덱스 기반으로 작성, 텍스트 매칭 금지 |
| 네임스페이스 추가 시 5개 레지스트리 중 하나 누락 → 조용한 오동작 | Medium | Medium | 기존 네임스페이스(`twoP`/`exchangePressureTest`)와 체크리스트 diff로 등록 여부 확인 |
| 새 idle/panel 화면 CSS flex-chain 누락 → 버튼이 위로 쌓임([[feedback_button_layout_bottom_anchored]] 참고) | Low | Medium | `public/gms.css` 선택자 목록에 반드시 추가 후 브라우저로 육안 확인 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `data/gmsSubSequences/AfterThreeP_v1.json`(신규) | Data(JSON) | 교환후3P Step 데이터 신규 작성 |
| `data/gmsSubSequences/AfterPlusL_v1.json`(신규) | Data(JSON) | 교환후+L Step 데이터 신규 작성 |
| `data/gmsSubSequences/AfterFourP_v1.json`(신규) | Data(JSON) | 교환후4P Step 데이터 신규 작성 |
| `public/gms-sub-sequence-runner.js` | Frontend Logic | `SUBSEQ_NS`에 네임스페이스 3개 + 레지스트리 5종 추가 |
| `public/Operation.js` | Frontend Logic | 3개 화면의 `progress...Body`/맵 진입점을 뼈대 로직에서 서브시퀀스 엔진 호출로 교체 |
| `data/gmsSubSequenceConfig.json` | Data(JSON) | 3개 화면용 CONFIG 항목 추가 |
| `public/gms.css` | Style | 3개 화면 idle/panel flex-chain 선택자 추가(필요 시) |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| `CYL_EXCHANGE_PURGE_STEPS` | READ/UPDATE | `Operation.js` → `showProgressCylExchangePurgeStep` | Needs verification — 3P/+L/4P 항목의 진입 로직이 뼈대에서 엔진 호출로 바뀜 |
| `OPERATION_SCREEN_FILES` | READ | `Operation.js` → 화면 fetch 매핑 | None — 파일 경로는 그대로, 내부 로직만 교체 |
| PASSWORD 게이트 `exchangeFourthPurgeDone` | READ | `Operation.js` → 4P "실행" 버튼 | Needs verification — 4P 완료 조건이 "클릭"에서 "Step 엔진 완료"로 바뀜 |

### 6.3 Verification

- [ ] 3P→+L→4P 전체 흐름을 브라우저에서 실행해 기존 PASSWORD 게이트/Status 전환이 그대로 동작하는지 확인
- [ ] 교환전 쪽(1P~2P) 서브시퀀스 엔진 동작에 회귀가 없는지 확인(공용 레지스트리 수정이므로)
- [ ] "B"선택/Status Jump로 3P/+L/4P Status에 진입 시에도 정상 화면이 뜨는지 확인(`showScreenForSideStatus`/`performStatusJump` 둘 다)

---

## 7. Architecture Considerations

> 이 프로젝트는 Node.js/Express + 정적 프론트엔드(바닐라 JS) 구조이며, bkit 템플릿의
> Next.js/BaaS 전제는 해당하지 않는다. 아래는 실제 프로젝트 구조에 맞게 대체한 내용이다.

### 7.1 프로젝트 구조

기존 GMS 서브시퀀스 엔진 패턴을 그대로 따른다(신규 아키텍처 도입 없음):

```
data/gmsSubSequences/<mainStepType>_v1.json   Step 데이터
public/gms-sub-sequence-runner.js             SUBSEQ_NS 엔진(신규 네임스페이스만 추가)
public/Operation.js                           Status 상태 머신(진입점 로직 교체)
public/OPERATION HTML/<Status>_<화면이름>.html  화면 마크업(이미 존재, 로직만 교체)
```

### 7.2 주요 결정 사항

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| Step 구조 | 신규 설계 / 기존 패턴 재사용 | 기존 패턴 재사용 | 3P/4P는 `TwoP_v1.json`, +L은 `ExchL_v1.json`과 구조적으로 동일 — 핸드오프 문서가 이미 명시 |
| CONFIG 값 | 실측값 / 플레이스홀더 | 플레이스홀더 | 실기 I/O 매핑 미완료 — "값 없으면 조건 건너뜀" 관례로 안전하게 처리 |
| 진행 순서 | 3개 화면 순차 계획 / 동시 계획 | 동시 계획 | 사용자 확인 — 3P→+L→4P가 한 흐름이라 하나의 계획으로 묶음 |

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [x] `CLAUDE.md`(프로젝트 루트)에 작업 규칙 명시됨
- [x] `docs/GMS_AUTO_SEQUENCE_HANDOFF.md`가 GMS 관련 단일 참고 문서(10절에 관례 정리됨)
- [ ] ESLint/Prettier/TypeScript 설정 — 해당 없음(바닐라 JS, 별도 린트 설정 없음)

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| Step JSON 필드 규칙 | 존재(11.2절) | 신규 3개 파일도 동일 필드셋 준수 | High |
| 네임스페이스 등록 규칙 | 존재(11.1절, 5개 레지스트리) | 신규 3개 네임스페이스 등록 시 누락 없는지 체크리스트로 확인 | High |
| CSS flex-chain 규칙 | 존재(10절) | 신규 idle/panel id 추가 여부 확인 | Medium |

### 8.3 Environment Variables Needed

해당 없음 — 이 프로젝트는 환경변수 대신 `data/settings.json`(설정 페이지 편집)으로 런타임 설정을 관리한다.

### 8.4 Pipeline Integration

해당 없음 — 이 프로젝트는 bkit 9-phase Pipeline이 아니라 자체 `docs/TASK.md` 기반 작업 지시 방식을 쓴다.

---

## 9. Next Steps

1. [x] Design 문서 작성(`gms-exchange-after-subseq.design.md`) — 3개 Step JSON의 구체적 Step 흐름/밸브 태그 목록 설계
2. [x] 사용자 검토(밸브 태그 이름 관례, CONFIG 항목명)
3. [x] 구현 시작 및 완료(`/pdca do gms-exchange-after-subseq`) — 3P/+L/4P 모두 브라우저 검증까지 완료
4. [x] 사용자가 TASK.md에 +L(가압시험)의 실제 밸브/옵션 스펙 직접 제공(2026-08-09) → §10 확장으로 반영

---

## 10. 확장: Bypass 실제 화면 + 가압시퀀스 정식 반영(2026-08-09)

> 사용자가 `docs/TASK.md`에 실제 엔지니어링 스펙을 직접 작성해 제공(더 이상 placeholder가
> 아님) — 아래는 그 지시를 그대로 반영한 확장 요구사항이다. 범위가 원래 계획(3P/+L/4P)을
> 넘어 **Status "Bypass"(배관 By-pass 체크)를 신규로 실제 구현**하는 것까지 커졌으므로
> Plan 갱신 절차에 따라 이 절에 정리한다(새 기능 문서를 따로 만들지 않고 이 기능의 확장으로
> 처리 — +L과 Bypass가 옵션/로직을 공유하기 때문).

### 10.1 신규 요구사항

- **FR-06**: Status "Bypass"가 "Bypass 사용 옵션"(신규 OPTION 토글, 기본 미적용) 적용 시에만
  CYLINDER_STEP_ORDER에 실제로 등장한다(-VT/vtUseOption과 동일한 런타임 스킵 패턴). 적용
  시 1P_2차측Purge 재확인 → "고압 HE Leak check 라인 유무" 옵션 분기(HPIV vs PNBV+PIV) →
  NPT/HPT 진공유지 확인("Bypass 진공유지 확인시간[분]" CONFIG, 신규)을 거쳐 3P로 넘어간다.
- **FR-07**: +L(가압시험)이 더 이상 뼈대가 아니라 실제 가압 시퀀스로 동작한다 —
  Bypass 사용 옵션에 따라 시작 지점이 갈리고(OFF: HPIV부터, ON: PGI부터), NPT/HPT 압력
  범위 확인 → 압력안정화시간(CAPTURE+실시간 감시, 하한 이탈 시 FAIL) → 시험시간(초기값
  대비 압력변동기준 이탈 시 FAIL)까지 수행한다.
- **FR-08**: 가압시험 완료 후 "가압시험 완료후 Puls Vent 옵션"(신규)이 적용이면 Puls Vent
  미니시퀀스(기존 `Puls_v1.json` 구조 재사용)를 한 번 더 거친 뒤 다음 Status로 넘어간다.

### 10.2 신규 OPTION 3개 (OPTION 탭)

| 옵션 | 기본값 | 역할 |
|---|---|---|
| Bypass 사용 옵션 | 미적용 | Bypass Status 실행 여부(런타임 스킵) + +L 시작 지점 결정 |
| 고압 HE Leak check 라인 유무 | 미적용 | Bypass 내 밸브 분기(HPIV vs PNBV+PIV) |
| 가압시험 완료후 Puls Vent | 미적용 | +L 완료 후 Puls Vent 추가 실행 여부 |

### 10.3 CONFIG 처리 방침

- **신규 추가 1개**: "Bypass 진공유지 확인시간[분]"(common, 기본 5분)
- **기존 재사용**: "가압 시험-압력 하한/상한/변동 기준_{side}", "가압 시험-안정화/시험 시간_{side}"
  (모두 기존 시드 항목 — §5절 CONFIG 처리 방침과 동일한 원칙으로 새로 만들지 않음),
  "진공하한치_{side}", "교환전 2차측 퍼지 횟수"(Bypass의 1P_2차측Purge 재확인 구간이 1P
  본체와 동일 CONFIG를 공유)

### 10.4 구현 결과(Do, 2026-08-09)

- `data/gmsSubSequences/Bypass_v1.json` 신규 작성(34 Step) + `data/gmsSubSequences/AfterPlusL_v1.json`
  전면 재작성(23 Step, 기존 placeholder 대체)
- `gms-sub-sequence-runner.js`: 네임스페이스 `bypass` 신규 등록(+5개 레지스트리), `SUB_SEQ_OPTION_TAGS`에
  옵션 3개 등록, `:CAPOFFSET` 비교대상에 선행 `-` 부호로 "초기값에서 뺀 값"을 만드는 확장
  추가(가압시험의 하락 방향 FAIL 판정에 필요)
- `gms.js`: 옵션 3개 신규(전역 변수+OPTION 탭 UI+localStorage), `CONFIG_OPTION_LOOKUP` 등록
- `Operation.js`: `nextStatusIndexAfter`에 Bypass 런타임 스킵 추가, `sequenceBypass`를 기존
  Puls/RGV 공용 뼈대 루프에서 분리해 전용 엔진 자동시작 블록으로 교체
- `public/OPERATION HTML/시퀀스_Bypass.html` 전면 재작성(idle/panel 구조), `gms.css` flex-chain
  선택자에 등록(버튼 하단 고정)
- `data/gmsSubSequenceSelection.json`에 `Bypass` 항목 추가
- 브라우저 검증(2026-08-09): Bypass 실행 → 1P_2차측Purge 재확인 2회 반복 정상 진행(CONFIG
  재사용 확인) → 취소/재시작 정상. +L Status Jump → Bypass 미적용 옵션대로 HPIV→PGII 분기
  정상 진행. 콘솔 에러 없음. NPT/HPT 5분 유지확인·압력안정화/시험 전체 구간은 Chrome
  백그라운드 탭 타이머 스로틀링으로 실시간 완주까지는 검증하지 못함(로직/참조 무결성은
  스크립트로 별도 검증 — accTimeSec 합계, nextStep/alarmGoto 참조, CONFIG 이름 존재 전부 확인).
- `data/gmsSubSequences/Bypass_v1.xlsx`/`AfterPlusL_v1.xlsx` 신규 생성(앱 자체 엑셀 내보내기
  API로 생성 — "서브시퀀스 엑셀 내보내기" 버튼과 동일 산출물).

### 10.5 남은 검증(다음 세션)

- [ ] NPT/HPT 5분 유지확인 실시간 완주(포그라운드 탭에서, 또는 CONFIG를 1분으로 임시
      낮춰서) 및 실패 시 alarmMessage("PGII/PGI Valve bypass 의심") 정상 표시 확인
- [ ] +L 압력안정화/시험 구간 FAIL 조건(하한 이탈, 변동기준 이탈) 실제 유발 테스트
- [ ] "고압 HE Leak check 라인 유무" 옵션 ON 상태에서 Bypass HPIV 분기 확인
- [ ] "가압시험 완료후 Puls Vent" 옵션 ON 상태에서 +L 완료 후 Puls Vent 미니시퀀스 확인
- [ ] `docs/GMS_AUTO_SEQUENCE_HANDOFF.md` 갱신(Bypass를 스텁 목록에서 제거, +L을 "실제 로직
      완료"로 갱신 — §11.4 Design 문서 참고)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-09 | 최초 작성 | Claude |
| 0.2 | 2026-08-09 | 브라우저 검증 결과 반영, 발견한 데이터 버그 2건 기록 | Claude |
| 0.3 | 2026-08-09 | §10 확장 — 사용자 제공 실제 가압시험/Bypass 스펙(TASK.md) 전면 구현 | Claude |
