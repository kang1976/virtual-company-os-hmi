# 시스템 및 화면 설계서 (DESIGN.md) — Omron CJ2H 모바일 통신 어플

> **작성일시**: 2026-08-30 21:59  
> **프로젝트명**: `omron_fins_app`  
> **설계 기준 기기**: 삼성 갤럭시 Z 폴드5 (`SM-F946N`)

---

## 1. 아키텍처 구조도 (3-Tier Layered Architecture)

```
[ UI Layer (Presentation) ]
  ├── ConnectionSettingsCard (IP / Port / Node / 연결상태)
  ├── ResponsiveLayout (폴드5 듀얼 화면 분기: <600dp 커버모드 / >=600dp 메인모드)
  ├── MemoryMonitorPanel (DM 영역 워드 테이블 & 실시간 갱신)
  └── BitControlPanel (W/CIO 비트 스위치 토글)
           │
           ▼
[ Service & State Layer (Business Logic) ]
  └── FinsService (Provider / ValueNotifier 상태 관리, 주기적 폴링 타이머)
           │
           ▼
[ Protocol & Network Layer (Data/Driver) ]
  ├── FinsPacketBuilder (FINS 0101 읽기 / 0102 쓰기 프레임 바이너리 생성)
  ├── FinsPacketParser (수신된 바이트 스트림 파싱 및 오류 코드 확인)
  └── RawDatagramSocket / Socket (`dart:io` 기반 로컬 소켓 통신)
```

---

## 2. FINS 패킷 프로토콜 명세 (Packet Specification)

### 2.1 헤더 구조 (10 Bytes)
1. `ICF (0x80)`: 커맨드 전송 및 응답 요구
2. `RSV (0x00)`: 예약 바이트
3. `GCT (0x02)`: 게이트웨이 카운트
4. `DNA (0x00)`: 대상 네트워크 번호 (로컬=0)
5. `DA1 (PLC Node)`: 대상 노드 번호 (예: 80)
6. `DA2 (0x00)`: 대상 유닛 번호 (CPU=0)
7. `SNA (0x00)`: 출발 네트워크 번호 (로컬=0)
8. `SA1 (Phone Node)`: 출발 노드 번호 (예: 15)
9. `SA2 (0x00)`: 출발 유닛 번호
10. `SID (0x01)`: 세션 ID

### 2.2 커맨드 코드
* **메모리 읽기 (`01 01`)**: `[MRC=0x01, SRC=0x01, AreaCode, StartAddr(2B), BitAddr(1B), WordCount(2B)]`
* **메모리 쓰기 (`01 02`)**: `[MRC=0x01, SRC=0x02, AreaCode, StartAddr(2B), BitAddr(1B), WordCount(2B), Data(2B*N)]`

---

## 3. 갤럭시 Z 폴드5 반응형 화면 레이아웃 설계

```
[ 커버 화면 (< 600dp) ]                [ 메인 화면 (>= 600dp 펼침) ]
┌─────────────────────────┐          ┌──────────────────┬──────────────────┐
│  [PLC 연결 설정 바]      │          │ [PLC 연결 설정]  │ [DM 데이터 뷰어]  │
│  IP: 192.168.0.80:9600  │          │  - 접속 IP/노드   │  D0000: 1234     │
├─────────────────────────┤          ├──────────────────┤  D0001: 5678     │
│  [DM 모니터링 카드]     │          │ [비트 제어 패널] │  D0002: 0000     │
│  D0: 1234, D1: 5678 ... │          │  W0.00 [ON/OFF]  │  ...             │
├─────────────────────────┤          │  W0.01 [ON/OFF]  ├──────────────────┤
│  [비트 제어 버튼 그룹]  │          │  CIO 100.00      │ [값 강제 쓰기]   │
│  W0.00 [ON] [OFF]       │          │                  │  Addr: [ ] Val:[ ]│
└─────────────────────────┘          └──────────────────┴──────────────────┘
```
