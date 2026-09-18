# 프로젝트 마스터 계획서 (PLAN) — 03. mobile-pwa-bridge

## 1. 프로젝트 개요
- **목적**: PC에 Node.js 브릿지 서버를 실행하고, 스마트폰/태블릿에서는 별도 앱 설치 없이 브라우저(PWA)를 통해 안전하게 PLC(Omron CJ2H)를 모니터링 및 제어하는 시스템 검증.
- **핵심 기술**: Node.js v24 (내장 `node:sqlite`), Express, WebSocket, FINS/TCP·UDP 중계, PWA (Service Worker + Manifest), Role-based Access Control (ADMIN/OPERATOR/VIEWER), 감사 로그 (AuditLog).

---

## 2. 작업 단계 (WBS)

```mermaid
graph TD
    A[Phase 0: 프로젝트 격리 및 환경 준비] --> B[Phase 1: Node.js 및 의존성 설치]
    B --> C[Phase 2: 관리자 계정 생성 및 HTTPS/HTTP 서버 기동]
    C --> D[Phase 3: FINS PLC 중계 통신 및 모바일 웹 PWA 접속 검증]
    D --> E[Phase 4: 보안 감사로그 및 권한 제어 테스트]
    E --> F[Phase 5: 최종 검증 보고서 작성 및 메인 프로젝트 3-in-1 통합]
```

---

## 3. 네트워크 및 포트 할당
- **PLC**: `192.168.0.80:9600` (Omron CJ2H FINS)
- **PC 브릿지 서버**: `192.168.0.211:3001` (HTTP/HTTPS)
- **모바일 접속 주소**: `http://192.168.0.211:3001` (또는 `https://192.168.0.211:3001`)
