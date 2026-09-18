# 모바일 UI 개선, 테마/전체화면 기능 및 보안 전문 에이전트(SecurityAgent) 추가 구현 계획서

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 모바일 기기에서의 최적화된 사용성 확보, 전체화면 및 테마(다크/라이트/OLED) 전환 기능 제공, 기술회사 거버넌스 강화를 위한 보안 전문 심사관(SecurityAgent) 추가 및 전 공정 연계.

**Architecture:** 
1. 백엔드: SecurityAgent(OWASP/CVE/암호화/접근통제 검수)를 신설하고, CompanyOrchestrator를 특허(FTO) -> 회피개발 -> 보안심사 -> 품질QA 4단계 자율 에이전트 파이프라인으로 확장.
2. 프론트엔드: useTheme 훅을 통한 테마 시스템(사이버 다크, OLED 블랙, 모던 라이트) 및 document.requestFullscreen 기반 전체화면 토글 추가. 모바일 뷰포트(375px~414px) 터치 인터랙션, 반응형 네비게이션, 칸반 스와이프 개선.

**Tech Stack:** Python 3.14, FastAPI, Pydantic v2, pytest, React 18, Vite, TypeScript, TailwindCSS, Lucide-React.

---

## Global Constraints
- 모든 코드 주석, 사용자 인터페이스 라벨, 보고서는 **100% 한국어**로 작성.
- Windows PowerShell 환경 및 Python 3.14, Node.js v24 호환성 유지.
- 기존 단위/통합/E2E 테스트 회귀 방지 (25개 기존 테스트 + 신규 테스트 100% 통과).
- Vite TypeScript strict 타입 컴파일 및 프로덕션 빌드 0 errors 유지.

---

### 태스크 1: 보안 전문 에이전트(SecurityAgent) 구현 및 단위 테스트

**대상 파일:**
- 생성: ackend/app/agents/security.py
- 수정: ackend/app/agents/__init__.py
- 생성/수정: ackend/tests/test_specialist_agents.py

**인터페이스:**
- 산출물:
  - SecurityOutputSchema: passed (bool), security_score (int, 0~100), ulnerabilities (List[str]), cve_risk (str), 
ecommendations (str)
  - SecurityAgent(BaseAgent): udit(deliverable: str, tech_stack: str = 'FastAPI/React') -> Dict[str, Any]

- [ ] **1단계: SecurityAgent 단위 및 스키마 실패 테스트 작성**
- [ ] **2단계: pytest 실행하여 실패 확인 (RED)**
- [ ] **3단계: backend/app/agents/security.py 및 backend/app/core/llm.py Mock 보강**
- [ ] **4단계: 테스트 재실행하여 통과 확인 (GREEN)**
- [ ] **5단계: 커밋**

---

### 태스크 2: 오케스트레이터 파이프라인에 보안 심사 단계 연계

**대상 파일:**
- 수정: ackend/app/services/orchestrator.py
- 수정: ackend/tests/test_orchestrator.py
- 수정: ackend/tests/test_e2e_scenario.py

**인터페이스:**
- CompanyOrchestrator.dispatch_ceo_command() 내에 4개 전문 태스크 생성:
  - T001: 선행기술 및 특허 침해 조사 (PatentSearchAgent)
  - T002: 특허 회피설계 아키텍처 개발 (BackendDevAgent)
  - T003: 취약점 및 시스템 보안 심사 (SecurityAgent)
  - T004: 품질 및 신뢰성 검증 (QAAgent)

- [ ] **1단계: 4단계 에이전트 파이프라인 통합 실패 테스트 작성**
- [ ] **2단계: pytest 실행하여 실패 확인 (RED)**
- [ ] **3단계: backend/app/services/orchestrator.py에 SecurityAgent 연계 구현**
- [ ] **4단계: 전체 백엔드 테스트 실행하여 100% 통과 확인 (GREEN)**
- [ ] **5단계: 커밋**

---

### 태스크 3: 테마 시스템(useTheme) 및 전체화면(Fullscreen) 기능 구현

**대상 파일:**
- 생성: rontend/src/hooks/useTheme.ts
- 수정: rontend/src/components/layout/Navbar.tsx
- 수정: rontend/src/App.tsx
- 수정: rontend/src/index.css

**인터페이스:**
- ThemeMode: 'cyber-dark' | 'oled-black' | 'modern-light'
- useTheme(): { theme, setTheme, toggleTheme, isFullscreen, toggleFullscreen }
- Navbar.tsx에 전체화면 토글 버튼(Maximize/Minimize) 및 테마 선택 드롭다운/토글 버튼 배치

- [ ] **1단계: useTheme 훅 구현 및 테마 스타일 클래스 구성**
- [ ] **2단계: Navbar.tsx에 전체화면 버튼 및 테마 스위처 추가**
- [ ] **3단계: App.tsx에 테마 루트 래퍼 적용**
- [ ] **4단계: npm --prefix frontend run build 빌드 검증**
- [ ] **5단계: 커밋**

---

### 태스크 4: 모바일 화면 UI/UX 전면 개선 및 컴포넌트 반응형 최적화

**대상 파일:**
- 수정: rontend/src/components/layout/Navbar.tsx
- 수정: rontend/src/components/ceo/CommandBar.tsx
- 수정: rontend/src/components/kanban/KanbanBoard.tsx
- 수정: rontend/src/components/ledgers/LedgerViewer.tsx
- 수정: rontend/src/components/org/OrgChart.tsx
- 수정: rontend/src/App.tsx

**개선 사항:**
1. **모바일 헤더/네비게이션**: 375px 소형 스마트폰 화면에서 탭 메뉴 스크롤 최적화 및 상단 여백 정리
2. **CEO 지시바 (CommandBar.tsx)**: 모바일 소프트 키보드 활성화 시 레이아웃 깨짐 방지, 터치 친화적 퀵 버튼(44px 이상 터치 타깃), 5단계 파이프라인(분해 -> 특허 -> 개발 -> 보안 -> QA) 반응형 스테퍼
3. **칸반 보드 (KanbanBoard.tsx)**: 가로 스와이프 터치 스크롤 바운스 방지, 모바일 단일 열/탭 토글 옵션 지원
4. **4대 장부 탐색기 (LedgerViewer.tsx)**: 모바일에서 [목록 보기] <-> [문서 본문] 간 전환을 위한 모바일 뒤로가기 탭 구조 적용
5. **가상 조직도 (OrgChart.tsx)**: 보안팀(SecurityAgent) 신설 카드 반영 및 모바일 수직 계층형 반응형 카드 레이아웃

- [ ] **1단계: 각 컴포넌트 모바일 반응형 클래스 및 터치 UX 적용**
- [ ] **2단계: 보안팀 에이전트 프론트엔드 연동 (OrgChart, CommandBar, KanbanBoard)**
- [ ] **3단계: 프로덕션 빌드 무결성 검증 (npm --prefix frontend run build)**
- [ ] **4단계: E2E 통합 테스트 검증 (python -m pytest backend/tests/ -v)**
- [ ] **5단계: 커밋**
