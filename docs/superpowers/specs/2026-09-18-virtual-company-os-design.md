# AI 가상회사 운영 시스템 (Virtual Company OS) V4.0 설계서

- **작성일**: 2026-09-18
- **상태**: 승인 대기 (Spec Review Gate)
- **작성 대상**: `d:\AI_Work\Antigravity\06.CEO`

---

## 1. 개요 및 배경 (Executive Summary & Background)

### 1.1 목적
본 시스템은 인간 **CEO(사용자)**가 자연어로 고수준의 사업/기술 목표를 지시하면, **AI 임원진(COO, CTO 등)**과 **전문 에이전트(특허, 개발, 품질 등)**가 조직적으로 업무를 분해, 선행조사, 개발, 품질 검증하여 최종 완료하고 실시간으로 보고하는 **실행형 AI 가상회사 운영 시스템(Virtual Company OS)**을 구축하는 것을 목적으로 한다.

### 1.2 핵심 철학 및 운영 원칙
1. **CEO는 명령만 내린다**: CEO가 개별 에이전트와 일일이 대화하지 않으며, COO(최고운영책임자)가 지휘 통제탑이 되어 회사를 자율 운영한다.
2. **개발 전 특허 선행조사 (Gatekeeper)**: 기술 전문 회사 특성을 반영하여, R&D/개발 착수 전 특허 조사 3대 에이전트(Patent Search, Prior Art, FTO Analysis)가 선행 기술 및 침해 위험을 사전 스크리닝한다.
3. **엄격한 다단계 완료 검증**: 에이전트가 "완료했다"고 주장해도 즉시 완료 처리되지 않으며, `진행` $\rightarrow$ `제출` $\rightarrow$ `QA 검증` $\rightarrow$ `COO 승인`의 5단계 파이프라인을 거쳐야 종결된다.
4. **4대 영구 장부 (Ledger System)**: 모든 지시(`COMMAND_LOG`), 업무(`TASK_LEDGER`), 회의(`MEETING_LOG`), 기술/특허(`KNOWLEDGE_PATENT`)는 파일 시스템에 가독성 높은 문서로 보존된다.

---

## 2. 전체 시스템 아키텍처 (System Architecture)

시스템은 **FastAPI 백엔드**, **React/Vite 프론트엔드**, 그리고 영구 파일 원장인 **`COMPANY_LEDGERS/`**의 3계층 구조로 동작한다.

```text
┌───────────────────────────────────────────────────────────┐
│              React 18 + Vite 웹 대시보드                  │
│   [CEO 관제실]  [5단계 칸반]  [4대 장부 탐색기]  [조직도] │
└─────────────────────────▲─────────────────────────────────┘
                          │ REST API & WebSocket (/ws)
┌─────────────────────────▼─────────────────────────────────┐
│               Python FastAPI 백엔드 런타임                │
│                                                           │
│  ┌────────────────┐ ┌─────────────────┐ ┌──────────────┐  │
│  │ COO Orchestrator│ │Specialist Agents│ │ Dual Storage │  │
│  │ (업무 분해/지시)│ │(특허/개발/QA 등)│ │ (Sync Service│  │
│  └───────┬────────┘ └────────┬────────┘ └──────┬───────┘  │
└──────────┼───────────────────┼─────────────────┼──────────┘
           │                   │                 │
           ▼                   ▼                 ▼
  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
  │   LLM Client    │ │   SQLite DB     │ │ COMPANY_LEDGERS │
  │ (Gemini/OpenAI) │ │ (초고속 조회용) │ │ (영구 파일 원장)│
  └─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 2.1 디렉터리 구성

```text
d:\AI_Work\Antigravity\06.CEO/
├── backend/
│   ├── app/
│   │   ├── api/                    # REST 엔드포인트 및 WebSocket
│   │   │   ├── commands.py         # CEO 지시 등록 및 단건/목록 조회
│   │   │   ├── tasks.py            # 태스크 상태 변경 및 필터링
│   │   │   ├── ledgers.py          # 4대 장부(지시, 업무, 회의, 특허) 조회
│   │   │   ├── agents.py           # 조직도 및 에이전트 상태 조회
│   │   │   └── ws.py               # 실시간 브로드캐스트 WebSocket 라우터
│   │   ├── core/
│   │   │   ├── config.py           # 환경설정 (.env, API Key, Model 설정)
│   │   │   └── llm.py              # Gemini (google-genai) 및 OpenAI 래퍼
│   │   ├── agents/
│   │   │   ├── base.py             # BaseAgent (프롬프트, 구조화 출력 파싱)
│   │   │   ├── coo.py              # COO Agent (업무 분해 및 태스크 지시)
│   │   │   ├── patent/
│   │   │   │   ├── search.py       # Patent Search Agent (특허 검색)
│   │   │   │   ├── prior_art.py    # Prior Art Agent (선행기술 비교)
│   │   │   │   └── fto.py          # FTO Agent (침해 가능성 위험 분석)
│   │   │   ├── dev/
│   │   │   │   ├── backend.py      # Backend Developer Agent
│   │   │   │   └── frontend.py     # Frontend Developer Agent
│   │   │   └── qa.py               # QA Agent (결과물 검증 및 피드백)
│   │   ├── models/
│   │   │   ├── schemas.py          # Pydantic 요청/응답 스키마
│   │   │   └── db.py               # SQLAlchemy SQLite 테이블 정의
│   │   ├── services/
│   │   │   ├── orchestrator.py     # 에이전트 실행 및 워크플로우 제어
│   │   │   └── ledger_sync.py      # DB 변경 시 파일 원장 동기화 서비스
│   │   └── main.py                 # FastAPI 애플리케이션 진입점
│   ├── tests/
│   │   ├── test_models.py
│   │   ├── test_ledger_sync.py
│   │   └── test_orchestrator.py
│   ├── data/                       # SQLite DB 파일 보관
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── api/                    # Axios / Fetch 클라이언트
│   │   ├── components/
│   │   │   ├── layout/             # Header, Navigation, Status Bar
│   │   │   ├── ceo/                # CEO 지시 입력, 브리핑 카드, 긴급 승인 모달
│   │   │   ├── kanban/             # 5단계 검증 칸반 보드 및 태스크 카드
│   │   │   ├── ledgers/            # 4대 장부 마크다운/JSON 뷰어
│   │   │   └── org/                # 조직도 트리 및 에이전트 상태 모니터
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts     # 실시간 이벤트 수신 훅
│   │   ├── types/                  # TypeScript 인터페이스 정의
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
│
└── COMPANY_LEDGERS/                # 영구 보존용 파일 원장
    ├── PROJECTS/                   # 프로젝트별 폴더 (PRJ-001/overview.md 등)
    ├── COMMAND_LOG/                # 지시 원장 (CMD-YYYYMMDD-xxx.md, .json)
    ├── TASK_LEDGER/                # 태스크 원장 (PRJ-001-tasks.json)
    ├── MEETING_LOG/                # 회의록 (MTG-YYYYMMDD-xxx.md)
    └── KNOWLEDGE_PATENT/           # 특허 분석 보고서 및 기술 지식 문서
```

---

## 3. 데이터 모델 및 엔티티 규격 (Data Models & Identification)

### 3.1 고유 식별자 규격
* **Project**: `PRJ-YYYYMMDD-xxx` (예: `PRJ-20260918-001`)
* **Command**: `CMD-YYYYMMDD-xxx` (예: `CMD-20260918-001`)
* **Task**: `PRJ-xxx-T001` (예: `PRJ-001-T001`)
* **Meeting**: `MTG-YYYYMMDD-xxx` (예: `MTG-20260918-001`)
* **Decision**: `DEC-YYYYMMDD-xxx` (예: `DEC-20260918-001`)
* **Patent Record**: `PAT-YYYYMMDD-xxx` (예: `PAT-20260918-001`)
* **Knowledge Record**: `KB-YYYYMMDD-xxx` (예: `KB-20260918-001`)

### 3.2 태스크 5단계 상태 머신 (Task State Machine)
모든 업무는 다음의 유한 상태 기계(FSM)를 따라 전이된다:

```text
  [IDLE] (배정 및 대기)
     │
     ▼
 [WORKING] (에이전트 작업 중)
     │
     ▼
[SUBMITTED] (1차 산출물 제출 완료)
     │
     ▼
  [REVIEW] (QA 에이전트 품질 검수 진행 중)
     │
     ├─► [반려 / 수정 필요] ──► [WORKING] (수정 지시 첨부)
     │
     ▼ [검수 합격]
[VERIFIED] (품질 검증 합격)
     │
     ▼
 [CLOSED] (COO 최종 승인 및 원장 마감)

※ 예외 분기: [BLOCKED] (특허 리스크 발견 또는 CEO 결정 요구 시 중단)
```

### 3.3 우선순위 (Priority)
* `P0`: CEO 긴급 특명 (모든 작업에 우선)
* `P1`: 핵심 공정 (후속 태스크 의존성이 높은 작업)
* `P2`: 일반 개발 및 조사 작업
* `P3`: 부가 문서화 및 리팩토링
* `P4`: 보류

---

## 4. 멀티 에이전트 런타임 및 실행 워크플로우

### 4.1 에이전트 구성
1. **COO Agent (Chief Operating Officer)**
   * 자연어 의도 파악 $\rightarrow$ 프로젝트 생성 $\rightarrow$ 태스크 분해 $\rightarrow$ `CMD-ID` 발급 $\rightarrow$ 부서 배정 $\rightarrow$ 종합 요약 보고.
2. **IP / 특허팀 (Gatekeeper)**
   * `PatentSearchAgent`: 기술 키워드 및 IPC 분류 기반 특허 검색.
   * `PriorArtAgent`: 선행 기술과의 유사도 및 기술적 차별점 분석.
   * `FTOAgent`: 타사 특허 청구항 침해 가능성 스크리닝 (`HIGH`, `MEDIUM`, `LOW`).
3. **개발/기술팀 (Development Team)**
   * `BackendAgent`: 서버 아키텍처, PLC 통신 프로토콜, API 사양서 및 코드 생성.
   * `FrontendAgent`: 사용자 UI 구조, 컴포넌트 설계 및 대시보드 화면 명세 작성.
4. **품질팀 (QA Agent)**
   * 산출물이 CEO의 지시 조건과 기술 기준을 만족하는지 검사. 불합격 사유를 구조화하여 반려하거나 합격 처리.

### 4.2 실행 시퀀스
1. **명령 접수**: CEO가 프롬프트 입력창에 지시 입력 (`POST /api/commands/execute`).
2. **비동기 큐 등록**: 백엔드는 응답을 지연시키지 않고 200 OK를 즉시 반환하며, 백그라운드 태스크(`asyncio.create_task`)로 오케스트레이터 구동.
3. **선행 특허 조사**: 기술 개발 과제일 경우, `IP팀`이 먼저 호출되어 `COMPANY_LEDGERS/KNOWLEDGE_PATENT/`에 보고서를 저장.
   * FTO 위험도가 `HIGH`로 판정되면 태스크를 `BLOCKED`로 두고 `CEO_DECISION_REQUIRED` 이벤트를 발생시킴.
4. **개발 수행**: 특허 조사가 완료되거나 안전 판정이 나면 개발 에이전트가 산출물 생성(`SUBMITTED`).
5. **품질 검증**: QA 에이전트가 검수하여 합격 시 `VERIFIED`로 변경.
6. **최종 마감 및 브리핑**: COO가 `CLOSED`로 변경하고, `MEETING_LOG`와 요약 브리핑을 갱신한 후 WebSocket으로 대시보드에 알림.

---

## 5. 프론트엔드 대시보드 사양 (Dashboard Specification)

### 5.1 핵심 화면 4종
1. **CEO 관제실 (Command Center)**
   * 상단 고정 CEO 지시 바 (자연어 입력).
   * 실시간 KPI 카드: 진행 프로젝트, 활성 태스크 수, 완료율, 주의 요망 항목.
   * COO 실시간 브리핑 피드 (시간순 최신 3건의 Executive Summary).
   * `CEO DECISION REQUIRED` 모달: 침해 우려 특허 또는 주요 의사결정 요청 시 원클릭 승인/반려 기능.
2. **5단계 업무 칸반 보드 (Kanban Board)**
   * 컬럼: `대기`, `진행 중`, `제출됨`, `검증 중`, `완료됨`.
   * 카드 정보: 태스크 ID, 업무명, 담당 에이전트, 우선순위 배지, 산출물 보기 버튼.
3. **4대 장부 탐색기 (Ledger Explorer)**
   * 탭: 지시 원장 (`COMMAND`), 업무 원장 (`TASK`), 회의록 (`MEETING`), 특허/지식 (`PATENT/KB`).
   * 좌측 문서 목록 + 우측 마크다운 렌더링 뷰어.
4. **조직도 & 에이전트 상태 모니터 (Org Chart & Agent Monitor)**
   * 계층 트리 시각화 (CEO $\rightarrow$ COO $\rightarrow$ C-Level $\rightarrow$ 전문 에이전트).
   * 에이전트별 실시간 상태 펄스 (`IDLE`, `WORKING`, `REVIEW`, `BLOCKED`).

### 5.2 실시간 WebSocket 이벤트
* `COMMAND_CREATED`: 새로운 지시 접수 알림.
* `TASK_UPDATED`: 태스크 상태 변경에 따른 칸반 카드 실시간 이동.
* `AGENT_LOG`: 에이전트의 실시간 실행 로그 스트리밍.
* `LEDGER_SYNCED`: 4대 장부 파일 갱신 알림.
* `ALERT_TRIGGERED`: CEO 의사결정 모달 팝업 알림.

---

## 6. 에러 핸들링 및 복구성 (Resilience & Error Handling)

1. **LLM API 실패 대응**:
   * Rate Limit 및 일시적 연결 실패 시 지수 백오프(Exponential Backoff) 기반 최대 3회 재시도.
   * API Key 미설정 시 mock 모드로 안전하게 전환되며 UI에 설정 안내 배너 표시.
2. **구조화된 출력 검증 실패 대응**:
   * Pydantic 스키마 파싱 에러 발생 시 LLM에게 검증 에러 내용을 첨부하여 1회 자동 재시도(Self-Correction).
3. **파일 쓰기 동시성 보장**:
   * `asyncio.Lock`을 통해 동일 프로젝트/원장 파일에 동시 쓰기가 발생하지 않도록 원자적(Atomic) 쓰기 수행.

---

## 7. 검증 및 테스트 계획 (Verification Plan)

### 7.1 자동화 단위/통합 테스트 (`pytest`)
* `test_models.py`: 고유 ID 생성, 데이터 모델 유효성 검사.
* `test_ledger_sync.py`: DB 생성/수정 시 `COMPANY_LEDGERS/` 폴더 내 JSON 및 Markdown 파일 동기화 일치 여부 검증.
* `test_orchestrator.py`: CEO 지시 전달 시 태스크 분해 및 상태 전이 로직 검증.

### 7.2 프론트엔드 빌드 및 린트 검증
* `npm run build`: TypeScript 타입 에러 및 컴파일 성공 여부 검증.

### 7.3 End-to-End 전체 시나리오 검증
* "PLC 모니터링 시스템 구축" 프롬프트 입력:
  1. `PRJ-001` 및 `CMD-001` 생성 확인
  2. `PATENT_LOG` 내 선행 특허 및 FTO 보고서 파일 생성 확인
  3. 개발 에이전트 산출물 생성 및 QA 에이전트 `VERIFIED` 판정 확인
  4. 태스크 칸반 카드가 최종 `CLOSED` 컬럼에 도달하는지 확인
  5. WebSocket 이벤트 정상 전달 확인
