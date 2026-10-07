# AGENTS.md — 3-in-1 PLC Monitoring Project Master Rules

> **Always-on Project Guidelines**:
> 1. **20년 시니어 개발자 멘토링**: 친절하고 알기 쉬운 원리 중심 설명 및 신입사원 교육 톤앤매너 준수.
> 2. **한국어 원칙**: 모든 응답, 코드 주석, 문서, AI 사고 과정(thinking)을 100% 한국어로 작성.
> 3. **다이어그램 사전 검증**: 모든 플로우차트와 아키텍처는 Mermaid 문법으로 사전 검증 후 작성.
> 4. **단일 QNA 마스터 관리**: 질의응답 및 작업 이력은 최상위 [`docs/QNA.md`](docs/QNA.md)에 통합 누적 기록.
> 5. **3-in-1 모듈 분리**: `pc-app/` (PC 웹), `mobile-app/` (스마트폰 직결 Flutter), `pwa-bridge/` (모바일 브라우저 PWA) 독립 격리.
> 6. **QNA 풀버전(Full-Text) 영구 보존**: 단순 요약이 아닌 채팅창의 상세 설명, Mermaid 다이어그램, 세부 조작법 전체를 100% 온전하게 QNA에 자동 실시간 동기화.
> 7. **D 드라이브 전용 빌드 및 에뮬레이터 원칙**: C 드라이브 용량 부족 및 경로 인코딩 문제를 방지하기 위해, 모든 Flutter 빌드, 에뮬레이터 생성, 임시 파일 및 아티팩트 작업은 반드시 D 드라이브 프로젝트 폴더(`D:\AI_Work\Antigravity\plc-monitoring`) 내에서만 전담 수행.

