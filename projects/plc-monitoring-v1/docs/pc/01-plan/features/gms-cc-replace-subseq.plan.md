---
template: plan
version: 1.3
---

# 용기교체(CC) 화면 진입점 Step 데이터 전환 Planning Document

> **Summary**: 용기교체(Status CC) 6화면의 화면 전환은 기존 방식(사용자가 "확인/실행" 버튼을
> 눌러 수동으로 넘김)을 그대로 유지하되, 6화면 전체의 순서·밸브 개폐 상태를 **진입화면
> (`용기교체CC_실린더 확인.html`) 하나에만** 만드는 Step 데이터(엑셀 내보내기/불러오기 지원)로
> 규정한다.
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
| **Problem** | 용기교체(CC) 6화면이 완전히 정적인 뼈대 상태 — 안내문/버튼만 있고 밸브 상태 데이터가 전혀 없다. 다른 서브시퀀스 화면(예: 교환전1P `idleCheck`)처럼 엑셀로 편집 가능한 구조화된 데이터가 없어, 밸브 순서를 코드에 하드코딩하지 않고선 밸브 개폐 상태를 표현할 방법이 없다. |
| **Solution** | 화면마다 별도 Step 데이터를 만드는 기존 서브시퀀스 패턴(1P~4P류) 대신, **진입화면 하나에만** Step 데이터 파일을 만들어 6화면 전체의 순서와 각 단계 밸브 개폐 상태를 담는다. 화면 간 이동은 지금처럼 사용자의 "확인" 버튼 클릭으로 유지 — 타이머/알람 기반 자동 진행 엔진(SUBSEQ_NS 풀 기능)은 이번 범위에 넣지 않는다. |
| **Function/UX Effect** | 오퍼레이터가 "확인"을 누를 때마다 다음 화면으로 넘어가는 조작감은 그대로지만, 각 화면에 텍스트로 밸브 상태를 표시하는 것이 아니라 SVG 배관도 화면에 그 단계에서 열려/닫혀 있어야 할 밸브 상태가 실제로 표시된다. 엔지니어는 엑셀로 밸브 개폐 순서(순차 개폐 타이밍 포함)를 수정할 수 있다. |
| **Core Value** | 무거운 풀 엔진(5개 레지스트리, 타이머, 알람)을 6번 복제하지 않고도 CC 구간의 밸브 순서를 구조화된 데이터로 관리할 수 있게 된다 — 유지보수 비용을 최소화하면서 엑셀 편집 워크플로의 이점만 가져온다. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | CC 6화면에 밸브 순서 데이터가 전혀 없어 엔지니어가 밸브 개폐 순서를 바꾸려면 코드를 직접 고쳐야 한다 |
| **WHO** | GMS 조작화면 오퍼레이터(화면 사용), 밸브 순서를 엑셀로 관리할 엔지니어 |
| **RISK** | "진입화면 하나에만 Step 데이터"가 기존 SUBSEQ_NS(화면 1개=네임스페이스 1개) 전제와 다름 — 여러 화면이 데이터 하나를 공유해서 읽는 방식은 이 프로젝트에 선례가 없어 Design 단계에서 구체적 연결 방식을 정해야 함 |
| **SUCCESS** | 실린더 확인 화면에서 엑셀 내보내기/불러오기로 6단계 전체(화면 순서+밸브 개폐)를 수정할 수 있고, 나머지 5개 화면은 각자 단계에 해당하는 밸브 상태를 그 데이터에서 읽어와 표시함 |
| **SCOPE** | CC 6화면(실린더 확인~Auto Guard Close 확인)의 밸브 순서 데이터화. 화면 전환 방식(버튼 클릭) 변경, 타이머/알람 자동 진행, Force Purge 화면, 실제 PLC 밸브 명령 연동은 범위 밖 |

---

## 1. Overview

### 1.1 Purpose

용기교체(CC) 6화면의 밸브 개폐 순서를 하드코딩 없이 데이터(엑셀 왕복 가능)로 관리할 수 있게
하여, 다른 서브시퀀스 화면들과 동일한 편집 워크플로를 제공한다.

### 1.2 Background

`docs/GMS_AUTO_SEQUENCE_HANDOFF.md` 9절에 "용기교체 CC 6화면의 '준비전 모드변경'(실제로는
실행됨), '바코드 수동입력', '바코드 확인', 'Lot No. Skip'"이 미구현으로 남아 있다고 명시돼
있다. 이번 작업은 그중 밸브 순서 데이터화 부분을 우선 다룬다. 사용자가 명시적으로 "각 화면에
Step 데이터를 만드는 게 아니라 처음 진입화면에만 만들면 된다", "화면 전환은 기존처럼 버튼
클릭 방식을 유지한다"고 범위를 좁혀 확인했다(2026-08-09).

### 1.3 Related Documents

- `docs/GMS_AUTO_SEQUENCE_HANDOFF.md` — 7절(화면 목록)/9절(스텁 목록)/11절(서브시퀀스 엔진 상세)
- 참고 데이터 예시(엑셀 왕복 워크플로): `data/gmsSubSequences/IdleCheck_v1.json`(ns=`idleCheck`)
- `docs/GMS_SUBSEQUENCE_EXCEL_GUIDE.md` — Step 데이터 엑셀 편집 가이드
- `docs/01-plan/features/gms-exchange-after-subseq.plan.md` / `.design.md` — 동일 세션에서 먼저
  진행 중인 별개 기능(교환후 3P/+L/4P). 서로 다른 화면 그룹이라 이 기능과 파일 충돌 없음.

---

## 2. Scope

### 2.1 In Scope

- [ ] 진입화면(`용기교체CC_실린더 확인.html`)에만 Step 데이터 파일 신규 작성 — 6단계
      (실린더 확인 → Valve Open 확인 → Auto Guard Open 확인 → 실린더 분리 및 교체 →
      Gas name 확인 → Auto Guard Close 확인) 전체의 순서와 단계별 밸브 개폐 상태를 담음
- [ ] "서브시퀀스 엑셀 내보내기/불러오기" 버튼을 실린더 확인 화면에 추가(`idleCheck` 화면과
      동일한 워크플로)
- [ ] 나머지 5개 화면이 각자 단계에 해당하는 밸브 개폐 상태를 이 하나의 데이터에서 읽어와
      표시할 수 있는 방법 마련(구체적 연결 방식은 Design 단계에서 결정)
- [ ] 밸브 태그는 관례대로 이름만 짓고 실주소는 플레이스홀더로 유지

### 2.2 Out of Scope

- 화면 간 전환 방식 변경 — 지금처럼 사용자가 "확인/실행" 버튼을 눌러 수동으로 넘기는 방식
  그대로 유지(타이머/알람 자동 진행 엔진 도입 안 함)
- `용기교체CC_Force Purge.html`("실린더 확인" 화면의 별도 버튼 대상)
- "바코드 수동입력"/"바코드 확인"/"Lot No. Skip"/"준비전 모드변경" 등 CC 6화면의 다른 미구현 기능
- 실제 PLC 밸브 명령 연동, 실주소 매핑
- 교환후 3P/+L/4P 작업(`gms-exchange-after-subseq`, 별도 기능으로 이미 진행 중)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 실린더 확인 화면에서 6단계 전체의 밸브 순서 데이터를 엑셀로 내보내고 다시 불러올 수 있다 | High | Pending |
| FR-02 | 각 화면은 자신의 단계에 해당하는 밸브 개폐 상태를 이 하나의 데이터에서 읽어와 표시한다 | High | Pending |
| FR-03 | 화면 간 전환(확인 버튼 클릭)은 기존 동작을 그대로 유지하며 회귀가 없다 | High | Pending |
| FR-04 | 값이 없는 신규 밸브 태그는 조건을 조용히 건너뛰고 로그만 남긴다(기존 관례) | Medium | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 일관성 | 데이터 파일 필드 스키마가 기존 Step 스키마(11.2절)와 최대한 호환 | 코드 리뷰, 기존 JSON과 필드 비교 |
| 편집 가능성 | 엑셀 내보내기/불러오기가 `idleCheck`와 동일한 방식으로 동작 | 실제 엑셀 왕복 테스트 |
| 안전성 | 화면 전환 로직(버튼 클릭 핸들러)을 건드리지 않아 기존 취소/PASSWORD 흐름에 영향 없음 | 브라우저 회귀 테스트 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] 진입화면에 Step 데이터 파일 1개 작성 완료(6단계 순서+밸브 개폐 전체 포함)
- [ ] 실린더 확인 화면에 엑셀 내보내기/불러오기 버튼 동작 확인
- [ ] 6개 화면 각각에서 해당 단계 밸브 상태가 데이터와 일치하게 표시됨
- [ ] 기존 취소/PASSWORD(`cylReplaceDone`, `cylReplace` 취소 게이트 등) 흐름에 회귀 없음

### 4.2 Quality Criteria

- [ ] 새 밸브 태그는 전부 관례 이름(`{side}` 접미사 등)만 사용, 주소를 지어내지 않음
- [ ] 데이터 파일 하나로 6화면을 규정하는 구조를 `docs/GMS_AUTO_SEQUENCE_HANDOFF.md`에 새 패턴으로 문서화(기존 "화면당 네임스페이스 1개" 관례의 예외임을 명시)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 기존 SUBSEQ_NS 패턴("네임스페이스=화면 1개")과 다른 새 패턴이라 5개 레지스트리 코드를 그대로 재사용할 수 없음 | Medium | High | Design 단계에서 "가벼운 조회용 데이터"로 취급(풀 엔진 등록 없이 5개 화면이 fetch로 직접 읽는 방식)할지, 엔진을 최소 확장할지 옵션 비교 |
| 나머지 5개 화면에 밸브 상태를 "어떻게" 표시할지 UI 요소가 아직 없음(현재 6화면 전부 안내문+버튼뿐) | Medium | High | Design 단계 UI/UX 섹션에서 최소한의 밸브 배지 UI를 정의(기존 `.valve-turn-icon` 재사용 검토) |
| 실제 밸브/PLC 매핑 없이 값을 지어내면 실기 검토 시 재작성 필요 | Medium | High | CONFIG/Step 값에 "예시값, 실제 값은 엔지니어링 검토 후 교체 필요" 명시 |
| 새 화면 데이터 추가 시 flex-chain CSS 등 기존 관례 누락 | Low | Low | `public/gms.css` 선택자 목록 확인(10절 관례) — 이번엔 신규 idle/panel 화면 추가가 아니라 기존 화면에 요소만 추가하므로 영향 적음 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `data/gmsSubSequences/CylReplace_v1.json`(신규, 파일명 가칭) | Data(JSON) | 6단계 전체 순서+밸브 개폐 Step 데이터 신규 작성, 진입화면에만 귀속 |
| `용기교체CC_실린더 확인.html` | Frontend | 엑셀 내보내기/불러오기 버튼 추가 |
| `용기교체CC_Valve Open 확인.html` 등 나머지 5개 화면 | Frontend | 해당 단계 밸브 상태 표시 요소 추가(구체 방식은 Design에서 결정) |
| `public/Operation.js` | Frontend Logic | 6화면 표시 시점에 공유 데이터에서 현재 단계를 읽어오는 최소 로직 추가(기존 화면 전환 핸들러 자체는 변경 없음) |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| `progressCylReplace*Body` 6개 컨테이너 | READ | `Operation.js` 312행/1400행 맵 | None — 컨테이너/파일 매핑은 그대로, 내용만 보강 |
| CC 6화면 버튼 이벤트(확인/취소/준비전 모드변경/Force Purge) | READ/UPDATE | `Operation.js` → `wireOperationScreens()` | Needs verification — 새 데이터 조회 로직 추가 시 기존 핸들러 순서/타이밍에 영향 없는지 확인 |
| PASSWORD 게이트 `cylReplaceDone`(CC→3P 진입), `cylReplace`(CC 취소) | READ | `Operation.js` | None — 이번 범위는 밸브 상태 표시일 뿐, PASSWORD 흐름 자체는 건드리지 않음 |

### 6.3 Verification

- [ ] CC 6화면 전체를 처음부터 끝까지(실린더 확인→...→Auto Guard Close 확인→3P 진입) 수동으로 실행해 기존 흐름이 그대로 동작하는지 확인
- [ ] CC 취소(`cylReplace` PASSWORD 게이트) 흐름이 영향받지 않는지 확인
- [ ] 엑셀 내보내기 → 값 수정 → 불러오기 후 6화면에 반영되는지 확인

---

## 7. Architecture Considerations

> Next.js/BaaS 전제는 이 프로젝트에 해당하지 않는다. 핵심 아키텍처 결정은 "화면 1개=
> 네임스페이스 1개"라는 기존 관례를 어떻게 벗어날지이며, 이는 Design 단계의 3가지 옵션
> 비교로 넘긴다.

### 7.1 검토할 주요 결정 (Design 단계에서 확정)

| Decision | Options | Rationale 방향 |
|----------|---------|-----------------|
| 데이터-화면 연결 방식 | (a) 5개 화면이 JSON을 직접 fetch해서 자기 단계만 읽음 / (b) SUBSEQ_NS를 최소 확장해 "표시 전용" 모드 추가 / (c) Operation.js가 중앙에서 현재 단계를 계산해 각 화면에 주입 | 기존 엔진 무변경(a, c)이 회귀 위험 가장 낮음 |
| 밸브 상태 UI 요소 | 기존 `.valve-turn-icon` 재사용 / 신규 텍스트 배지 | 기존 CSS 자산 재사용이 일관성 높음 |

### 7.2 프로젝트 구조

```
data/gmsSubSequences/CylReplace_v1.json   6단계 전체 순서+밸브 데이터(진입화면 귀속)
public/OPERATION HTML/용기교체CC_*.html   6개 화면(기존 파일, 내용만 보강)
public/Operation.js                       화면 전환(기존 유지) + 데이터 조회 로직(신규, 최소)
```

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [x] `docs/GMS_AUTO_SEQUENCE_HANDOFF.md`가 GMS 관련 단일 참고 문서
- [x] Step 데이터 필드 스키마(11.2절) 존재 — 이번 데이터도 최대한 이 스키마를 따름
- [ ] "화면 1개=네임스페이스 1개" 관례의 예외 사례 — 이번이 최초, 확정되면 핸드오프 문서에 새 패턴으로 추가 필요

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| 다중 화면-단일 데이터 연결 패턴 | 없음(선례 없음) | Design 단계에서 확정 후 핸드오프 문서 갱신 | High |
| 밸브 상태 표시 UI | 없음(6화면 전부 안내문+버튼뿐) | 최소 UI 요소 정의 | Medium |

### 8.3~8.4

해당 없음(환경변수/Pipeline 미사용, 이전 계획 문서와 동일).

---

## 9. Next Steps

1. [ ] Design 문서 작성(`gms-cc-replace-subseq.design.md`) — 데이터-화면 연결 방식 3가지 옵션 비교, Step 데이터 구체 스키마/파일명 확정
2. [ ] 사용자 검토(연결 방식 선택, 밸브 태그 이름 관례)
3. [ ] 구현 시작(`/pdca do gms-cc-replace-subseq`)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-09 | 최초 작성 — 사용자 확인: 진입화면 1개에만 Step 데이터, 화면 전환은 버튼 클릭 방식 유지 | Claude |
