---
name: bkit-project-creation
description: |
  bkit 3-in-1 프로젝트 생성 및 PDCA 라이프사이클 가이드 — 새 프로젝트 또는 신규 기능 개발 시
  어떤 아키텍처와 규칙, PDCA 단계(Plan/Design/Do/Check/Act)를 적용해야 하는지 안내하는 스킬.
  Triggers: bkit 프로젝트 생성, 새 프로젝트 시작, 스킬 트리, 스킬 선택, 개발 단계, PDCA 스킬, 파이프라인 스킬,
  new project, skill tree, which skill, project pipeline.
---

# BKIT 3-in-1 프로젝트 생성 및 PDCA 스킬

## 1. 개요 및 헌장
본 스킬은 20년 경력 시니어 개발자 멘토링 톤앤매너에 기반하여, 산업용 PLC 제어·모니터링 시스템의 3-in-1 아키텍처와 bkit PDCA 방법론을 적용하도록 안내합니다.

## 2. 3-in-1 아키텍처
1. **pc-app**: Node.js/Express, Univer 그리드 레시피, P&ID 배관도 및 GSP 7단계 시퀀스 관제.
2. **mobile-app**: Flutter/Dart FINS UDP 스마트폰 직결 P2P 네이티브 앱 (갤럭시 Z 폴드5 최적화).
3. **pwa-bridge**: PC 중계 HTTPS 브릿지 서버 + 모바일 브라우저 PWA 웹앱 (3단계 RBAC, 감사로그).

## 3. 문서화 및 QNA 규칙
- 모든 질의응답은 `docs/QNA.md`에 단일 마스터로 기록합니다.
- **QNA 풀버전(Full-Text) 영구 보존 원칙**: 단순 요약이 아닌, 채팅창에서 안내한 상세 설명, Mermaid 아키텍처 다이어그램, 세부 조작 가이드 전체를 100% 온전한 풀텍스트로 누락 없이 기록합니다.
- 기술 문서는 `docs/pc/`, `docs/mobile/`, `docs/pwa-bridge/`로 독립 분리 관리합니다.

