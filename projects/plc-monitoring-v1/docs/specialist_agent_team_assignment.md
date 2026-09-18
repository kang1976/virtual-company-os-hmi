# PLC 3-in-1 모니터링 시스템 전담 개발팀 구성 및 전문인원 배정 명세서
**Specialist Agent Team Structure & Task Allocation Matrix**

> **문서 번호**: DOC-PLC-ORG-001  
> **프로젝트 코드**: `PRJ-PLC-001`  
> **대상 브랜치**: `feature/plc-monitoring-v1`  
> **총괄 책임자**: COO (`Virtual COO Agent`)  
> **최종 승인자**: CEO  
> **일자**: 2026-09-18  

---

## 1. 조직 구성 개요

본 프로젝트(`feature/plc-monitoring-v1`)는 공장 자동화 현장의 핵심 장비인 Omron PLC와 실시간 연동되어 밸브, 센서, 가스 압력 및 시퀀스를 제어하는 미션 크리티컬 시스템입니다.  
이에 따라 시스템의 안정성, 보안성, 배포 용이성 및 사용자 경험을 극대화하기 위해 **5개 전문 기능별 전담 AI 에이전트와 총괄 COO**로 구성된 전담 개발본부를 편성하고 역할을 확정 배정합니다.

```
                  ┌──────────────────────┐
                  │    CEO (최고경영자)    │
                  └──────────┬───────────┘
                             │ 지시 / 보고
                  ┌──────────▼───────────┐
                  │   Virtual COO Agent  │
                  │   (총괄 오케스트레이션)   │
                  └──────────┬───────────┘
         ┌──────────────┬────┴─────────┬──────────────┐
         ▼              ▼              ▼              ▼
┌────────────────┐┌───────────┐┌─────────────┐┌──────────────┐
│ OTSecurity     ││ PLCComms   ││ IndustrialUI││ Packaging    │
│ Agent          ││ Agent      ││ Agent       ││ DevOpsAgent  │
│ (보안/인터록)    ││ (통신엔진)  ││ (HMI/PWA/앱)││ (인스톨러/배포) │
└────────────────┘└───────────┘└─────────────┘└──────────────┘
         │              │              │              │
         └──────────────┴──────┬───────┴──────────────┘
                               ▼
                    ┌─────────────────────┐
                    │  IndustrialQA Agent │
                    │ (품질 검수/FAT·SAT)  │
                    └─────────────────────┘
```

---

## 2. 전문 에이전트 상세 배정 및 R&R (역할과 책임)

### 1) `OTSecurityAgent` (산업제어망 보안 수석 에이전트)
* **담당 분야**: 제어망 보안, 인터록(Safety Interlock), 감사 로깅, 인가 체계
* **핵심 책임**:
  1. IEC 62443 및 OWASP Top 10 기준에 따른 코드 레벨 보안 감사
  2. 치명적 제어 명령(CPU 정지, 밸브 강제 작동) 2단계 안전 인터록 및 승인 가드 운영
  3. FINS 패킷 DoS 공격 방지를 위한 요청 속도 제한(Rate Limiting) 관리
  4. 침해 사고 추적을 위한 `security_audit.log` 무결성 보장

### 2) `PLCCommsAgent` (산업용 통신 수석 엔지니어)
* **담당 분야**: Omron FINS UDP/TCP/USB 통신 엔진 및 CIP 프로토콜 최적화
* **핵심 책임**:
  1. CJ/CS/NX PLC 메모리 영역(D, H, W, CIO, E0~E3) 배치 읽기/쓰기 신뢰성 제어
  2. 0104 Multiple Read 32단위 청킹 및 FTO(Fine Time Optimization) 통신 지연 방지
  3. USB WinUSB 가상 통신 드라이버 및 네트워크 단절 시 자동 재연결 복구 엔진 유지
  4. 밀리초 단위 고속 폴링 시 PLC 통신 버퍼 락업 방지

### 3) `IndustrialUIAgent` (HMI & PWA 프론트엔드 수석 아키텍트)
* **담당 분야**: PC 관제실 HMI 화면, SVG 동적 배관도(P&ID), PWA 모바일 반응형 UI
* **핵심 책임**:
  1. Boxy SVG 기반 P&ID 배관도와 실시간 태그 바인딩 및 애니메이션 렌더링
  2. 모바일 PWA 3종 테마(OLED 블랙, 사이버 다크, 프로 라이트) UI 반응형 디자인
  3. 대용량 실시간 그리드(`canvas-datagrid`) 및 고속 트렌드 차트 프레임 드롭 방지
  4. 현장 작업자 터치 조작성 및 원터치 전체화면/단축키 최적화

### 4) `PackagingDevOpsAgent` (패키징 & 배포 데브옵스 엔지니어)
* **담당 분야**: 윈도우 인스톨러(.exe) 제작, 포터블 번들링, 타 PC 배포 자동화
* **핵심 책임**:
  1. Inno Setup 6 기반의 무설치 독립 실행형 `PLC-Monitoring-Setup.exe` 컴파일
  2. 포터블 Node.js 런타임 및 네이티브 바이너리(`better-sqlite3`, `usb`) 무결성 패키징
  3. Zadig USB 드라이버 자동 등록 및 윈도우 무소음 백그라운드(`run.vbs`) 서비스 구성
  4. 타 PC 설치 가이드(`INSTALLATION_GUIDE.md`) 최신화 및 배포 검증

### 5) `IndustrialQAAgent` (산업 품질검수 수석 에이전트)
* **담당 분야**: 모의 시뮬레이션 검증, 공장인수시험(FAT), 현장인수시험(SAT)
* **핵심 책임**:
  1. 모의 PLC 패킷 주입을 통한 통신 부하 및 예외 상황 스트레스 테스트
  2. 기능별 단위/통합 품질 검수 체크시트 발행 및 합격 판정
  3. 릴리스 전 회귀 버그(Regression) 전수 차단
  4. 4대 장부(TASK_LEDGER, COMMAND_LOG) 기록 검증 및 실적 동기화

### 6) `COOAgent` (총괄 운영 및 오케스트레이터)
* **담당 분야**: CEO 지시사항 수신, 작업 티켓 발행, 전문 에이전트 조율, 최종 게이트 승인
* **핵심 책임**:
  1. CEO의 전략적 지시사항을 세부 태스크로 분해하여 각 전문 에이전트에 하달
  2. 에이전트 간 의존성 조율 및 충돌 방지
  3. 최종 품질 게이트(Quality Gate) 감사 및 CEO 직속 결과 보고

---

## 3. 업무 분배 매트릭스 (Task Allocation Matrix)

| 업무 영역 | 주 담당 에이전트 | 부 담당 에이전트 | 주요 산출물 |
| :--- | :--- | :--- | :--- |
| **PC 인스톨러 빌드 & 배포** | `PackagingDevOpsAgent` | `IndustrialQAAgent` | `PLC-Monitoring-Setup.exe`, `INSTALLATION_GUIDE.md` |
| **보안 가드 & 감사 체계** | `OTSecurityAgent` | `COOAgent` | `securityGuard.js`, `plc_security_audit_report.md` |
| **FINS 통신 안정성 고도화** | `PLCCommsAgent` | `OTSecurityAgent` | `plcSession.js`, `udpFinsClient.js`, `tcpFinsClient.js` |
| **HMI/PWA 모바일 UI 고도화**| `IndustrialUIAgent` | `PackagingDevOpsAgent`| `gms.html`, `pwa-bridge/public`, `mobile-app` |
| **공장 현장 품질 검수** | `IndustrialQAAgent` | `COOAgent` | FAT/SAT 체크시트, 테스트 성적서 |
| **전체 공정 지휘 및 보고** | `COOAgent` | 전 에이전트 | 4대 장부, CEO 종합 보고서 |

---

## 4. 운영 프로세스 및 4대 장부 연동 규칙

1. **지시 하달**: CEO의 명령은 COO가 접수 후 4대 장부 `COMMAND_LOG`에 기록하고, 해당 전문 에이전트의 워크스페이스에 즉시 배분합니다.
2. **개발 및 TDD**: 전문 에이전트는 독립 브랜치/모듈 단위로 코딩을 진행하며 단위 테스트를 반드시 수반합니다.
3. **품질 및 보안 게이트**:
   * 보안 관련 수정 시 `OTSecurityAgent`의 검수 서명 필수
   * 기능 릴리스 시 `IndustrialQAAgent`의 체크시트 검수 완료 필수
4. **COO 승인 및 보고**: 모든 검수가 통과된 후 COO가 최종 승인하여 `TASK_LEDGER`를 `VERIFIED` 종결 처리하고 CEO에게 보고합니다.
