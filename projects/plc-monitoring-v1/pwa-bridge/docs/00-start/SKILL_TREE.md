# SKILL TREE — 03. mobile-pwa-bridge

## Context Anchor
- **프로젝트명**: 03. mobile-pwa-bridge (Omron CJ2H PC 중계 서버 & 모바일 PWA 제어 시스템)
- **대상 기기**: Omron CJ2H-CPU65-EIP (192.168.0.80:9600)
- **통신 아키텍처**: [스마트폰/태블릿 브라우저 (PWA)] ↔ HTTPS/WSS ↔ [Node.js 브릿지 서버 (PC)] ↔ FINS/TCP·UDP ↔ [PLC]
- **주요 특징**: 앱 설치 불필요(PWA 홈화면 추가), 3단계 Role 기반 권한 관리(ADMIN, OPERATOR, VIEWER), 위험 명령 2단계 확인, `node:sqlite` 감사 로그(AuditLog) 영속화

---

## PDCA 워크플로우

- [x] **Phase 0 (Start)**: 규칙 확인, 프로젝트 독립 복사 및 SKILL_TREE.md / QA_LOG.md 생성
- [x] **Phase 1 (Plan)**: PWA 브릿지 서버 실행 환경(Node.js v24.19, mkcert HTTPS 인증서, 포트 3001) 점검 및 PLAN 작성
- [x] **Phase 2 (Design)**: RBAC 인증 체계, FINS 중계 라우팅, AuditLog SQLite 스키마 명세 확인
- [x] **Phase 3 (Do)**: npm 의존성 설치, 관리자 계정(`admin` / `admin1234`) 생성, HTTPS 서버 기동 및 PLC FINS 자동 연결 성공
- [x] **Phase 4 (Check)**: PC 로컬 및 모바일 PWA 환경에서 API 및 로그인 100% 정상 작동 검증
- [ ] **Phase 5 (Act)**: 최종 테스트 보고서 작성 및 메인 프로젝트(`02. plc-monitoring ver1.0 - google`)와의 3-in-1 통합
