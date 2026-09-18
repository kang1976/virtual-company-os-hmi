# 프로젝트 계획서 (PLAN.md) — Omron CJ2H 모바일 직접 통신 어플

> **작성일**: 2026-08-30  
> **프로젝트 책임자/멘토**: 20년차 시니어 개발자  
> **담당자/교육 대상**: 신입 개발자  
> **목적**: 중간 PC 서버 없이 스마트폰과 Omron CJ2H PLC 간의 1:1 FINS 소켓 통신 모바일 어플리케이션 구축 및 배포

---

## 1. 프로젝트 개요 및 배경

### 1.1 배경 및 문제 정의
* 기존 공장 자동화 환경에서는 스마트폰으로 PLC 데이터를 보려면 별도의 PC 서버(OPC Server, Node-RED, 웹서버 등)를 중계기로 두어야 하는 비용과 관리 부담이 존재함.
* 본 프로젝트는 **중간 서버를 완전히 배제**하고, 동일 로컬 Wi-Fi 망 내에서 스마트폰이 오므론 표준 프로토콜(FINS)을 사용하여 CJ2H PLC와 직접 P2P 통신하도록 구성함.

### 1.2 목표 (Key Goals)
1. **서버리스 직접 통신**: 모바일 앱 ↔ Omron CJ2H PLC 간 FINS/UDP(또는 TCP) 직접 송수신.
2. **실시간 모니터링 및 제어**:
   * D 영역(DM Area) 워드 읽기/쓰기.
   * E0,E1,E2,E3 영역(EM Area) 워드 읽기/쓰기.
   * E0,E1,E2,E3 영역(EM Area) 워드 읽기/쓰기.
   * W 영역(W Area) 워드 읽기/쓰기.
   * CIO 영역(CIO Area) 워드 읽기/쓰기.
   * W / CIO / E 영역 비트 On/Off 제어 및 상태 모니터링.
3. **직관적인 모바일 UI**: PLC 접속 설정(IP, 포트, 노드), 실시간 데이터 뷰어, 수동 제어 패널 제공.
4. **유지보수 및 학습 용이성**: 신입사원도 쉽게 이해할 수 있는 계층형 아키텍처(UI - Service - Protocol) 및 문서화.

---

## 2. 시스템 아키텍처 및 통신 사양

### 2.1 네트워크 토폴로지
```
+--------------------------+          Wi-Fi (iptime)          +--------------------------+
|      Smart Phone         | <==============================> |       Omron CJ2H         |
|  (Flutter Client App)    |                                  |   (Built-in Ethernet)    |
|   IP: 192.168.0.15       |       FINS/UDP (Port 9600)       |    IP: 192.168.0.80      |
|    FINS Node: 15         |                                  |     FINS Node: 80        |
+--------------------------+                                  +--------------------------+
```

### 2.2 기술 스택 (Tech Stack)
* **프레임워크**: Google Flutter (Dart)
* **통신 계층**: `dart:io` RawDatagramSocket / Socket (순수 FINS 바이너리 패킷 파서 직접 구현)
* **상태 관리**: Provider 또는 ValueNotifier 기반 가벼운 반응형 구조
* **지원 플랫폼**: Android (우선 타겟: APK 설치) 및 iOS 확장 가능

---

## 3. 전체 프로젝트 진행 단계 (Roadmap & WBS)

| 단계 | 주요 작업 내용 | 산출물 | 상태 |
| :--- | :--- | :--- | :---: |
| **Phase 0. 사전 준비 및 규칙** | - 규칙 문서(`Skill.md`) 검토 및 문서 체계 구성<br>- 네트워크 도달성(Ping) 검증 | `docs/00-start/SKILL_TREE.md`<br>`docs/00-start/QA_LOG.md` | ✅ 완료 |
| **Phase 1. 기획 및 요구정의 (Plan)** | - 프로젝트 계획서 작성<br>- 메모리 맵 및 기능 요구사항 정의 | `docs/01-plan/PLAN.md`<br>`docs/01-plan/SCHEMA.md` | 🔄 진행중 |
| **Phase 2. 환경 구축 및 신입 교육** | - Flutter SDK 및 Android 빌드 도구 설치 안내<br>- 개발 환경 헬스체크 (`flutter doctor`) | 환경 설정 가이드 문서 | ⏳ 대기 |
| **Phase 3. 프로토콜 및 UI 설계 (Design)** | - FINS 패킷 생성/해석 엔진 구조 설계<br>- 화면 와이어프레임 및 제어 UI 레이아웃 설계 | `docs/02-design/DESIGN.md` | ⏳ 대기 |
| **Phase 4. 코딩 및 구현 (Do)** | - FINS 통신 핵심 라이브러리 개발<br>- 화면 UI 및 상태 바인딩<br>- 에러 처리 및 재접속 로직 구현 | Flutter 프로젝트 소스코드 | ⏳ 대기 |
| **Phase 5. 연동 테스트 및 검증 (Check)** | - PC/스마트폰에서 실제 CJ2H 메모리 읽기/쓰기 테스트<br>- 통신 지연시간 및 패킷 손실률 점검 | `docs/04-check/TEST_REPORT.md` | ⏳ 대기 |
| **Phase 6. 배포 및 완료 (Act)** | - Android Release APK 빌드 및 폰 설치<br>- 최종 운영 보고서 및 사용자 매뉴얼 작성 | `docs/05-act/REPORT.md`<br>`app-release.apk` | ⏳ 대기 |

---

## 4. 실시간 진행 상황 트래커 (Progress Tracker)

* **현재 위치**: **Phase 1 (기획)** $\rightarrow$ **Phase 2 (환경 구축)** 진입 단계
* **다음 예정 작업**:
  1. 신입사원 맞춤형 **Flutter 및 개발 환경 설치 가이드** 제공
  2. Flutter 설치 확인 및 프로젝트 뼈대 생성
