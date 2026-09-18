---
name: bkit-project-creation
description: |
  bkit 프로젝트 생성 — 새 프로젝트를 시작할 때 어떤 bkit Skill을 어느 개발 단계(Plan/Design/Do/Check/Act)에서
  써야 하는지 정리한 기준 트리 문서. "뭐부터 해야 하지", "어떤 스킬 써야 하나", "새 프로젝트 시작" 같은
  질문이 나오면 이 문서를 먼저 참고한다.
  Triggers: bkit 프로젝트 생성, 새 프로젝트 시작, 스킬 트리, 스킬 선택, 개발 단계, PDCA 스킬, 파이프라인 스킬,
  new project, skill tree, which skill, project pipeline.
---

# SKILL_TREE — BKIT 프로젝트 생성

> 한글로 반드시 질의 응답및 생각하기 번역해서 보여 줄것
> 당신은 20년이상된 시니어 개발자이고 난 처음 입사한 초보 프로그램 입문자 입니다. 하나씩 프로그램 설치부터 용어 설명까지 신입사원 교육 하는것 처럼 알려 주시기 바랍니다.
> 플로우챠트는 반드시 mermaid ai로 기법으로 소스로 먼저 테스트 해보고 결과물을 문서에 작성해줄것

> **목적**: 앞으로 새 프로젝트를 시작할 때 매번 어떤 Skill을 어느 단계에서 쓸지 헤매지 않도록,
> **실제로 등록/설치되어 있는 Skill만** 골라 개발 단계(Pipeline/PDCA)별로 정리한 기준 문서.
> 이름만 그럴듯한 스킬을 나열하지 않고, 이 환경에 실제로 잡히는 것만 담았다.
>
> **작성일**: 2026-08-26
> **적용 범위**: 이 프로젝트뿐 아니라 **앞으로 새로 시작하는 모든 프로젝트**에 재사용할 템플릿.
>   새 프로젝트에서는 이 문서를 그대로 복사해 시작하면 된다.

---

## 0단계 — 프로젝트 레벨 선택 (맨 처음 1회)

| Skill | 언제 쓰나 |
|---|---|
| `bkit:development-pipeline` | "뭐부터 해야 하지?" — 9단계 파이프라인 전체 가이드부터 본다 |
| `bkit:starter` | 정적 웹/포트폴리오/랜딩페이지 등 백엔드 없는 소규모 프로젝트 |
| `bkit:dynamic` | 로그인/DB 등 백엔드(BaaS) 필요한 풀스택 웹앱 |
| `bkit:enterprise` | 마이크로서비스/K8s/Terraform이 필요한 대규모 시스템 |

---

## 1단계 — 기획 (Plan)

| Skill | 언제 쓰나 |
|---|---|
| `bkit:pdca` (plan) | 기능 단위 계획 문서(`plan.md`) 생성/조회 |
| `bkit:plan-plus` | 요구사항이 막연할 때 브레인스토밍 + YAGNI 검토부터 |
| `bkit:pm-discovery` | 신규 기능의 시장/유저 관점 근거가 필요할 때 (PM 에이전트 팀) |
| `bkit:phase-1-schema` | 용어/데이터 구조/엔티티 관계부터 정의해야 할 때 |
| `bkit:phase-2-convention` | 코딩 규칙/컨벤션을 문서화해야 할 때 |

---

## 2단계 — 설계 (Design)

| Skill | 언제 쓰나 |
|---|---|
| `bkit:pdca` (design) | 기능 단위 설계 문서(`design.md}`) |
| `bkit:phase-3-mockup` | UI/UX 목업, 디자이너 없이 프로토타입 |
| `bkit:phase-5-design-system` | 컴포넌트 라이브러리/디자인 토큰 |
| `design` (Claude Design) | 실제 화면 목업을 시각적으로 그려야 할 때 |

---

## 3단계 — 구현 (Do)

| Skill | 언제 쓰나 |
|---|---|
| `bkit:phase-4-api` | 백엔드 API 설계+구현, Zero Script QA 연동 |
| `bkit:phase-6-ui-integration` | 프론트-백엔드 연결, 상태관리/API 클라이언트 |
| `bkit:bkend-*` (quickstart/data/auth/storage) | bkend.ai BaaS를 실제 쓰는 프로젝트일 때만 |

이 프로젝트는 별도 Do 문서 없이 코드/커밋이 산출물 — `00-start/PROJECT_START.md` 3절 참고.

---

## 4단계 — 검증 (Check / QA)

| Skill | 언제 쓰나 |
|---|---|
| `bkit:qa-phase` | L1~L5 테스트 계획/생성/실행/리포트 |
| `bkit:zero-script-qa` | 스크립트 없이 구조화 로그+Docker 로그로 검증 |
| `code-review` | 현재 diff/PR의 정확성 버그·중복·효율 리뷰 |
| `security-review` | 보안 취약점 점검 |
| `run` | 실제 앱을 띄워서 브라우저로 동작 확인 |

---

## 5단계 — 완료/배포 (Act)

| Skill | 언제 쓰나 |
|---|---|
| `bkit:pdca` (report) | 완료 보고서(`report.md`) |
| `bkit:phase-7-seo-security` | 배포 전 SEO/보안 점검 |
| `bkit:phase-9-deployment` | CI/CD, 배포 전략 |
| `bkit:deploy` | 실제 배포 실행 |
| `simplify` | 품질 정리(중복 제거·단순화) — 버그 사냥 아님 |

---

## 문서/운영 보조 (전 단계 공통)

| Skill | 언제 쓰나 |
|---|---|
| `bkit:bkit-templates` | Plan/Design/Analysis/Report 문서 템플릿 원본 |
| `bkit:control` | 자동화 신뢰도(L0-L4) 조정 |
| `bkit:audit` | 의사결정/작업 이력 감사 로그 조회 |
| `bkit:rollback` | 체크포인트 생성/복원 |
| `bkit:sprint` | 여러 기능을 한 스코프/예산으로 묶어 진행할 때만 |
| `update-config` | Claude Code 설정(hooks/permissions) 변경 |
| `fewer-permission-prompts` | 반복되는 권한 프롬프트 줄이기 |

---

## 새 프로젝트 시작 시 체크리스트

1. `bkit:development-pipeline`으로 전체 그림 확인 → 레벨(Starter/Dynamic/Enterprise) 선택
2. 이 문서(`SKILL_TREE.md`)를 새 프로젝트 `docs/00-start/`로 복사
3. "이 프로젝트 전용" 표를 새 프로젝트에 맞게 비우고 다시 채움
4. 1~5단계 표는 그대로 두되, 실제 안 쓸 스킬은 취소선으로 표시(삭제하지 않음 — 나중에 필요할 수 있음)
5. `docs/00-start/QA_LOG.md` 생성 — 아래 "질의응답 로그 체계" 그대로 복사해서 시작 (Q-001부터)
6. `docs/_INDEX.md`(또는 그에 준하는 문서 지도)에 `SKILL_TREE.md`, `QA_LOG.md` 링크 추가

---

## 질의응답 로그 체계 (QA_LOG) — 모든 프로젝트 공통 필수

> 매 프로젝트마다 `docs/00-start/QA_LOG.md`를 만들고 이 구조를 그대로 사용한다.
> **핵심 원칙**: AI가 여쭤보는 질문뿐 아니라 **사용자가 채팅에 직접 타이핑해서 묻거나 지시하는 내용도 빠짐없이** 같은 로그에 시간순으로 남긴다. 한쪽만 기록되면 안 됨 — 양방향 기록이 핵심.

### 문서 상단 — 인덱스 표 (필수)

로그가 길어져도 스캔 가능하도록 항상 최상단에 둔다.

| ID | 날짜 | 구분 | 요약 | 관련 문서 |
|---|---|---|---|---|
| Q-001 | | | | |

**구분 범례**: 지시(작업 지시) / 결정 확인(AI가 여쭤 확정한 사항) / 정정(AI의 오류를 바로잡음) / 절차 질문(진행 방식에 대한 질문)

### 개별 항목 형식 (Q-XXX마다 반복)

```
## Q-XXX

- **날짜**: YYYY-MM-DD
- **질문자**: 사용자 | 저 (AskUserQuestion, N문항)
- **질문 내용**: (실제 질문/지시 원문 또는 요지)
- **답변**: (답변 또는 결정 내용)
- **왜 그렇게 생각했는지**: (근거 — 없으면 생략 가능하나 결정/정정 항목은 필수)
- **조치**: (문서 반영, 코드 변경 등 실제로 한 일)
```

### 운영 규칙

1. AI가 AskUserQuestion으로 여쭙는 것과, 사용자가 채팅에 직접 타이핑해서 묻거나 지시하는 것 **모두** Q-XXX로 추가
2. 각 항목은 **질문 내용 / 답변(또는 조치) / 왜 그렇게 생각했는지(근거)**를 반드시 포함 — 근거 없는 결정은 나중에 재현이 안 됨
3. 새 항목 추가 시 상단 **인덱스 표에도 한 줄 반드시 추가**
4. 프로젝트 레벨/스코프/스키마에 영향을 주는 결정은 이 로그와 더불어 해당 단계 문서(`schema.md`, `design.md` 등)의 "질의 응답 관련" 표에도 요약 반영 — 단, 전체 근거와 시간순 흐름의 기준은 항상 `QA_LOG.md`
5. 단순 정보 확인성 질문(예: "이게 뭐예요?")은 생략 가능 — **결정, 정정, 방향 전환, 절차 관련** 질문 위주로 기록

---

## 버전 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| 0.1 | 2026-08-26 | 최초 작성 — 실제 등록된 Skill만으로 PDCA 단계별 트리 구성 |
| 0.2 | 2026-08-26 | QA_LOG 체계 정식 도입 — 양방향(AI 질문 + 사용자 질문) 기록, 인덱스 표, 구분 태그, 개별 항목 형식 표준화. PLC monitoring_01 프로젝트에서 실사용 검증 후 반영 |

이상입니다.
