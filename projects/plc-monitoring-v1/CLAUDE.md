# PLC 모니터링 & 제어 시스템 (3-in-1 Total Suite)

Node.js 기반 **PC 웹 & GMS 시스템**, Flutter 기반 **스마트폰 직결 네이티브 앱**, 그리고 **모바일 브라우저 PWA 브릿지**로 구성된 통합 PLC 제어·관제 플랫폼입니다.

---

## 📁 3-in-1 프로젝트 구조

```text
02. plc-monitoring ver1.0 - google/
├─ CLAUDE.md                   프로젝트 환경 및 통합 개발 가이드
├─ README.md                   통합 프로젝트 개요 및 빠른 시작 가이드
├─ Omron_CJ2H_Direct_Monitor.apk 모바일 직결 최신 배포용 APK (Release 47.7MB)
├─ IC_M16_GC(통합)_Omron_20240208.xlsx  PLC 래더 메모리 할당표 원본
├─ pc-app/                     🖥️ [옵션 1] PC 웹 모니터링 & GMS 시스템
│  ├─ src/                     Express + WebSocket 서버 (3000)
│  ├─ public/                  GMS 배관도, Operation.js, Univer 그리드
│  └─ package.json             PC 앱 패키지 정의
├─ mobile-app/                 📱 [옵션 2] 스마트폰 직결 네이티브 앱 (P2P)
│  ├─ lib/                     Dart 소스 (main.dart, fins_service.dart)
│  └─ pubspec.yaml             Flutter 의존성 정의
├─ pwa-bridge/                 🌐 [옵션 3] PC 중계 서버 + 모바일 브라우저 PWA
│  ├─ src/                     HTTPS 서버 (3001), 3단계 RBAC, 감사로그
│  ├─ public/                  PWA 프론트엔드 (다크 테마, 태그/트렌드/GMS)
│  └─ certs/                   SSL 자체 서명 인증서 (mkcert)
├─ docs/                       📚 공통 엔지니어링 문서 및 PDCA
│  ├─ QNA.md                   **전체 통합 마스터 질의응답 (Part 1/2/3 일원화)**
│  ├─ PROJECT_MASTER_PDCA.md   통합 아키텍처 및 진척 매트릭스
│  ├─ 00-start/                SKILL_TREE.md (개발 헌장 및 20년 멘토링 규칙)
│  ├─ pc/                      PC 웹 & GMS 시퀀스 전용 엔지니어링 문서
│  ├─ mobile/                  스마트폰 직결 Flutter 앱 전용 PDCA 문서
│  └─ pwa-bridge/              모바일 PWA 브릿지 전용 엔지니어링 문서
├─ data/                       공통 변수 및 런타임 데이터
├─ GMS관련 사진/                공통 현장 사진 및 도면 자산
└─ logs/                       세션별 통신 및 동작 로그
```

---

## 🌐 3대 통신 아키텍처 및 접속 정보

| 구분 | 통신 경로 | 접속 주소 / 방법 | 주요 특징 |
|:---|:---|:---|:---|
| **[옵션 1] PC 관제 시스템** | PC ↔ Node.js ↔ PLC | `http://localhost:3000/gms.html` | P&ID 대화면 배관도, 7단계 자동 시퀀스, Univer 그리드 레시피 |
| **[옵션 2] 모바일 직결 앱** | 스마트폰 ↔ PLC (P2P) | `Omron_CJ2H_Direct_Monitor.apk` 설치 | PC 없이 폰-PLC 직접 FINS 통신, 초저지연(0.01초), Z폴드5 최적화 |
| **[옵션 3] 모바일 PWA 브릿지** | 폰 ↔ HTTPS ↔ PC ↔ PLC | `https://10.219.30.135:3001` (핫스팟) | 무설치 모바일 브라우저 실행, 3단계 계정 권한, 위변조 방지 감사로그 |

* **PLC 접속 대상**: `192.168.0.80:9600` (Node 80, CJ2H-EIP)
* **모바일 접속 기본 계정**: `admin` / `admin` (또는 `test1234` / `test1234`)

---

## 🛠️ 작업 규칙 및 멘토링 헌장

1. **최우선 마스터 문서**:
   - 통합 아키텍처: [`docs/PROJECT_MASTER_PDCA.md`](docs/PROJECT_MASTER_PDCA.md)
   - 질의응답 및 작업 이력: [`docs/QNA.md`](docs/QNA.md) (**Part 1/2/3 단일 취합 마스터**)
   - 개발 헌장: [`docs/00-start/SKILL_TREE.md`](docs/00-start/SKILL_TREE.md)
2. **한국어 원칙**: 모든 대화, 커밋 메시지, 주석, 문서화 및 AI 사고 과정(thinking)은 한국어로 작성합니다.
3. **20년 시니어 개발자 멘토링 톤앤매너**: 입문자/신입사원 관점에서 용어 설명, 아키텍처 원리, 설치 단계까지 친절하고 깊이 있게 설명합니다.
4. **다이어그램 검증**: 모든 플로우차트는 Mermaid 문법으로 사전 검증 후 문서화합니다.
