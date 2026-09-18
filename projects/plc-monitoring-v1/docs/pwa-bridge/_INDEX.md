# 문서 지도 — PLC monitoring_01

> **프로젝트 폴더**: `D:\02. AI 작업\PLC monitoring_01\Claude` (2026-08-27 C드라이브에서 이전)

| 문서 | 설명 |
|---|---|
| [00-start/PROJECT_START.md](00-start/PROJECT_START.md) | 프로젝트 목적, 핵심 결정사항(PLC 모델/통신/접근범위/제어범위), 레벨 선택 근거 |
| [00-start/SKILL_TREE.md](00-start/SKILL_TREE.md) | 이 프로젝트 전용 bkit 스킬 매핑 (Plan→Design→Do→Check→Act) |
| [00-start/QA_LOG.md](00-start/QA_LOG.md) | **전체 질의응답 원장** — 양방향(제 질문 + 사용자 질문) 시간순 기록 |
| [01-plan/glossary.md](01-plan/glossary.md) | 용어집 — 도메인 용어, 3단계 권한 정의 |
| [01-plan/schema.md](01-plan/schema.md) | 스키마 — Device/Tag/User/Role/Command/Session/AuditLog/Alarm |
| [01-plan/plan.md](01-plan/plan.md) | 1차 기능 범위(F1~F7), 범위 제외, 완료 기준, §3-2 PC 화면 모바일 포팅 |
| [01-plan/mobile-screen-plan.md](01-plan/mobile-screen-plan.md) | **기존 PC(GMS) 화면 5종을 하나씩 휴대폰/PDA 반응형으로 포팅** — 인벤토리·순서·진행 상태 |
| [02-design/design.md](02-design/design.md) | 통신 아키텍처, 인증/RBAC, 위험명령 2단계 확인, AuditLog, PWA 설계 |
| [README.md](../README.md) | 실행 방법 (npm install, 계정 생성, 태그 가져오기, 서버 시작) |

## 현재 상태

- 프로젝트 레벨: **bkit:dynamic**
- 1차 대상: Omron CJ2H-CPU65-EIP PLC 1대(192.168.0.80), 공장 내부 와이파이 전용, 전면 제어, **PWA**(설치형 웹앱)
- **배경**: SK Hynix M16 GC(가스캐비닛) 안전시스템의 일부 — Siemens/LS Electric PLC는 이 Excel 문서에 함께 있으나 **향후 별도 프로젝트**, 이번 범위는 Omron 단일 — [PROJECT_START.md §1-1](00-start/PROJECT_START.md)
- **태그 규모**: 모니터링/쓰기 각 약 2,000개, 심볼 기준으로 시스템 구현 완료, 심볼↔주소 매핑표는 추후 공유 예정 — [schema.md §2](01-plan/schema.md)
- **아키텍처**: 기존 GMS 프로젝트(`plc-monitoring ver1.0 - google`)와 **완전 독립** — FINS 통신 파일만 복사, 원본은 백업 후 무수정 — [PROJECT_START.md §2-1](00-start/PROJECT_START.md), [design.md](02-design/design.md) 참고
- **개발 원칙**: 무료(오픈소스) 도구 우선 — [PROJECT_START.md §2-2](00-start/PROJECT_START.md) 참고
- **접속 검증 완료**: FINS/TCP 읽기 테스트 성공(2026-08-26) — [QA_LOG Q-017](00-start/QA_LOG.md)
- **Do 단계 1차 구현 완료 및 실동작 검증**(2026-08-26): 로그인/세션/RBAC, 태그 검색·Import, 위험명령 2단계 확인, AuditLog, 실제 PLC(192.168.0.80) 연결까지 전부 실제 HTTP 요청으로 확인 — [QA_LOG Q-023](00-start/QA_LOG.md)
- **모바일 PWA 실기 검증 완료**(2026-08-27): Android 에뮬레이터로 로그인/대시보드 확인, HTTPS(mkcert) 전환 후 홈화면 설치 및 완전한 "Install app"(주소창 없는 앱) 실행까지 확인 — [QA_LOG Q-025/Q-026](00-start/QA_LOG.md)
- 완료: Phase 0(레벨 선택), Phase 1(스키마/용어), Plan, Design, Do 1차(서버 골격 + 핵심 흐름)
- **현재 최우선 목표(2026-08-28, QA_LOG Q-027)**: 기존 PC(GMS) 화면 5종(S1~S5)을 **하나씩** 휴대폰/PDA 반응형으로 포팅 — [mobile-screen-plan.md](01-plan/mobile-screen-plan.md)
- **화면 포팅 진행(2026-08-28 기준)**:
  - **S1 홈** ✅ (하단 탭바 + 연결상태 카드 + **CPU·펌웨어 상세**(모델/버전/운전상태/시계/메모리) + **연결 설정**(PLC IP/포트/폴링주기) + **PLC 연결/해제** + **운전모드 변경·시계 설정**(ADMIN, 사유+비밀번호))
  - **S2 모니터링** ✅ (카드형 목록 + 값쓰기 2단계 확인 + 실시간 값 폴링 + **태그 편집**(이름/설명/주소, CX-Programmer 데이터타입 21종))
  - **S3 트렌드** 🟡 실기 검증 진행 중(2026-08-29, 브라우저 탭) — 그래프·팬(PAN_GAIN 2)·축설정은 합성 데모로 확인 중, 실값·서버기록은 PLC 유선 연결 복구 후, CSV/PNG·설치형 미확인 (변수=주소 직접입력, **서버 1초 DB 기록·72시간 보관**, CSV 내보내기/가져오기, 터치 줌/팬·축설정·PNG) — [design.md §9](02-design/design.md), [QA_LOG Q-029](00-start/QA_LOG.md)
  - **S5 설정** ✅ (테마·글자크기·화면 항상 켜기)
  - **S4 GMS(P&ID)** ⬜ 시작 전 — 최난이도, 마지막
- 다음 단계: S3 실기 검증 → **S4 GMS 배관도** → 태그 심볼↔주소 매핑표 도착 후 대량 Import
- 미확정(현장 확인 필요): 태그명↔실제주소 매핑, 위험 Command 목록, 동시접속 정책, OPERATOR 화이트리스트 — [plan.md §5](01-plan/plan.md) 참고
- 코드는 `feature/mobile-screen-porting` 브랜치에 커밋 중 (master 미병합)
