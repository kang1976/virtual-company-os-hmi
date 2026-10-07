# ==============================================================================
# AI VIRTUAL COMPANY OS & P&ID GMS MONITORING SYSTEM
# ==============================================================================

## 📌 프로젝트 소개 (Overview)
본 저장소는 **AI 가상회사 운영체제 (AI Virtual Company OS)** 와 반도체 가스 공급 설비 **P&ID HMI 실시간 관제 시스템** 및 **Omron PLC 모니터링 시스템(PC / Mobile / PWA)**을 통합한 풀스택 모니터링 및 자율 의사결정 플랫폼입니다.

---

## 🏗️ 시스템 아키텍처 및 폴더 구성

```
06.CEO/
├── backend/                  # FastAPI 기반 가상회사 AI 백엔드 & 오케스트레이터
│   ├── app/
│   │   ├── agents/           # 자율 전문 에이전트 (COO, 특허/IP, 백엔드 개발, QA 등)
│   │   ├── api/              # REST API & 실시간 WebSocket 통신 라우터
│   │   ├── core/             # LLM 클라이언트 래퍼 (Gemini/OpenAI) 및 시스템 설정
│   │   ├── models/           # SQLite DB 모델 및 Pydantic 스키마
│   │   └── services/         # 4대 장부(Dual-Storage) 동기화 & 파이프라인 엔진
│   └── tests/                # 단위 및 E2E 시나리오 테스트
│
├── frontend/                 # React 18 + Vite + TailwindCSS 관제실 대시보드
│   └── src/
│       ├── components/       # 관제 대시보드 UI (칸반 보드, 조직도, 4대 장부 뷰어 등)
│       └── hooks/            # 실시간 WebSocket 통신 훅
│
├── pid-hmi/                  # 반도체 가스 공급 시스템 P&ID HMI 인터랙티브 관제 모듈
│   ├── index.html            # P&ID 그래픽 뷰어 (1128x1264px 네온 플라즈마 레이어)
│   ├── app.js                # SVG 가스 유동 & VENT 화이트 플라즈마 애니메이션
│   ├── tags.js               # 압력, 온도, 실린더 레벨, 밸브 태그 좌표 매핑
│   ├── style.css             # 하이 콘트라스트 다크 테마 & 발광 UI 스타일
│   ├── server.js             # Node.js HTTP & 실시간 WebSocket 브로드캐스터 (:3005)
│   └── pid_background.jpg    # 3D 실린더 및 메탈릭 배관도 마스터 이미지
│
├── projects/plc-monitoring-v1/ # Omron PLC (CJ2H / NX / NJ) 종합 모니터링 스위트
│   ├── pc-app/               # Express + Univer 그리드 + FINS USB/TCP/UDP 데스크톱 앱
│   ├── mobile-app/           # Flutter 크로스플랫폼 모바일 앱
│   ├── pwa-bridge/           # 모바일 브리지 & PWA 웹 서버
│   └── docs/                 # 통신 프로토콜 규격 및 셋업 가이드
│
├── COMPANY_LEDGERS/          # 4대 장부 (프로젝트, 명령 로그, 작업 장부, 회의록, 특허)
├── docs/                     # 시스템 사양서 및 설계 보고서
├── run.py                    # AI Virtual Company 통합 원클릭 실행 스크립트
├── start_all.bat             # 전체 서비스 통합 구동 배치 스크립트
└── README.md
```

---

## 🚀 빠른 시작 (Quick Start)

### 1. 가상회사 OS 실행 (Backend + Frontend)
```bash
# Python & Node.js 의존성 설치 후
python run.py
```
- 백엔드 REST/WebSocket: `http://localhost:8000`
- 프론트엔드 관제 대시보드: `http://localhost:5173`

### 2. P&ID HMI 인터랙티브 관제 모듈 실행
```bash
cd pid-hmi
node server.js
```
- 브라우저 접속: `http://localhost:3005`

### 3. PLC 데스크톱 모니터링 시스템 실행
```bash
cd projects/plc-monitoring-v1/pc-app
run_server.bat
```
- 브라우저 접속: `http://localhost:3000`

---

## 🛡️ 핵심 기능 및 특징

1. **AI Virtual Company OS**:
   - 인간 CEO의 자연어 명령 접수 및 COO 에이전트의 실시간 업무 분해
   - 특허 FTO 선행조사 → 개발 → 독립 QA 검증의 7단계 자율 파이프라인
   - SQLite DB와 물리 마크다운 파일(COMPANY_LEDGERS) 동시 기록(Dual-Storage)

2. **P&ID HMI 실시간 관제**:
   - A/B Dual Side 가스 공급 라인 및 독립 VENT 배관도 지원
   - 밸브 개폐에 연동되는 3계층 네온 플라즈마 가스 충진 애니메이션
   - 실린더 실시간 무게, 온도, 레벨 게이지 동기화

3. **PLC 멀티 프로토콜 인터페이스**:
   - Omron FINS-over-USB, FINS/UDP, FINS/TCP 및 CIP(EtherNet/IP) 지원
   - Univer 기반 대용량 메모리 영역 실시간 스프레드시트 브라우징 및 트렌드 로깅
