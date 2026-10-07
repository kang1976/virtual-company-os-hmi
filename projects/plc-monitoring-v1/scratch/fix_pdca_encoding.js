const fs = require('fs');
const path = require('path');

const pdcaContent = `# [PROJECT MASTER] PLC 모니터링 & GMS 시스템 통합 관리 문서 (bkit PDCA)

> **문서 메타데이터**
> - **문서 ID**: \`DOC-PLC-GMS-001\`
> - **문서 버전**: \`v1.0.1\`
> - **최종 갱신일**: 2026-08-22
> - **관리 방법론**: bkit PDCA (Plan - Design - Do - Check - Act)
> - **작업 관리 체계**: \`[Q-001]\`, \`[Q-002]\`... 일련번호 기반 버전 및 변경 관리

---

## 1. [PLAN] 프로젝트 목적 및 전체 개요

### 1.1 프로젝트 배경 및 목적
본 프로젝트는 **Omron PLC(CJ2H-EIP / NX·NJ 시리즈)**와 실시간 통신하여 생산 공정의 상태를 모니터링/기록/제어하고, 그 기반 위에서 반도체/산업용 **GMS(Gas Monitoring System, 가스 캐비닛 제어 시스템)**의 P&ID 배관도 및 실린더 교환 자동 시퀀스를 완벽하게 관제·운영하기 위해 개발된 Node.js 기반 풀스택 관제 플랫폼입니다.

### 1.2 시스템 구성 및 2대 핵심 축

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PLC Monitoring & GMS Platform                         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌───────────────────────────────┐             ┌───────────────────────────────┐
│     [1] 기반 모니터링 앱         │             │    [2] GMS 가스 제어 시스템    │
│  (Base Monitoring Platform)   │             │   (Gas Monitoring System)     │
├───────────────────────────────┤             ├───────────────────────────────┤
│ • 메인 대시보드 (메모리 뷰어)     │             │ • P&ID 실시간 배관도 및 센서   │
│ • Univer 그리드 (레시피/스냅샷) │             │ • 실린더 교환 자동 시퀀스 엔진  │
│ • 트렌드 모니터링 (시계열 차트) │             │ • 16개 서브시퀀스 엑셀 인프라  │
│ • 전역 환경설정 및 CPU 정보     │             │ • SQLite 작업이력 / 에러로그   │
└───────────────┬───────────────┘             └───────────────┬───────────────┘
                │                                             │
                └──────────────────────┬──────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PLC 통신 드라이버 계층                             │
├──────────────────────────────────────┬──────────────────────────────────────┤
│  Omron CJ2H (FINS Protocol)          │  Omron NX/NJ (CIP Protocol)          │
│  - USB (FINS-over-USB 래핑)           │  - EtherNet/IP (CIP 포트 44818)      │
│  - UDP (FINS/UDP 포트 9600)          │  - 태그 이름(Tag Name) 기반 주소 체계 │
│  - TCP (FINS/TCP 포트 9600)          │                                      │
└──────────────────────────────────────┴──────────────────────────────────────┘
\`\`\`

---

## 2. [DESIGN] 시스템 아키텍처 및 설계 사유 (Rationale)

### 2.1 통신 및 세션 아키텍처 (Session Architecture)
* **독립 세션 팩토리 (\`src/plcSession.js\`)**:
  * 메인 대시보드(\`mainSession\`), 그리드(\`gridSession\`), 트렌드(\`trendSession\`)가 각자 독립된 세션 인스턴스를 유지합니다.
  * **설계 사유**: 한 화면에서 폴링을 일시 정지하거나 에러가 발생하더라도 다른 화면의 모니터링 및 로깅에 영향을 주지 않도록 세션과 폴링 상태(\`stopped\`/\`running\`/\`paused\`)를 완전히 격리하였습니다.
* **USB 단독 점유 제어 (\`disconnectOtherSessions\`)**:
  * **설계 사유**: USB 통신은 OS 레벨에서 단일 프로세스/핸들만 장치를 열 수 있는 물리적 제약이 있습니다. 따라서 어느 페이지가 USB로 새로 연결을 시도하면 기존에 USB를 점유하던 세션만 안전하게 자동 해제하고 새 연결을 수립합니다. (UDP/TCP는 상호 간섭 없이 완전 동시 다중 연결 지원)
* **통신 재진입 방지 및 타임아웃 가드**:
  * \`state.connecting\` 플래그 및 8초 \`withTimeout()\`을 적용하여 통신 응답 지연 시 UI 버튼이 멈추는 프리징 현상을 원천 방지하였습니다.

### 2.2 GMS 실린더 교환 자동 진행 상태 머신 (Status Flow)
실린더 교환 및 가스 공급 시퀀스는 안전을 최우선으로 하여 다음 12단계 상태 머신으로 설계되었습니다:

$$\\text{IDLE} \\xrightarrow{} \\text{Puls} \\xrightarrow{} \\text{1P} \\xrightarrow{} \\text{-L} \\xrightarrow{} \\text{[-VT]} \\xrightarrow{} \\text{2P} \\xrightarrow{} \\text{CC(용기교체)} \\xrightarrow{} \\text{[Bypass]} \\xrightarrow{} \\text{3P} \\xrightarrow{} \\text{+L} \\xrightarrow{} \\text{[-VT]} \\xrightarrow{} \\text{4P} \\xrightarrow{} \\text{PC} \\xrightarrow{} \\text{Service}$$

* **설계 사유**:
  * **PASSWORD 게이트 (4321)**: 위험 구간(용기 분리, 고압 가압 등) 진입 전 작업자 인증을 강제하여 휴먼 에러를 방지합니다.
  * **OPTION 탭 연동**: \`1P\` 구간의 4개 세부 공정(\`1P_자동진행\`, \`1P_2차측Purge\`, \`1P_Pumping\`, \`1P_1차측Purge\`), Bypass 여부, 고압 He Leak Check 라인 유무 등을 체크박스로 선택/스킵할 수 있도록 유연하게 설계하였습니다.

### 2.3 서브시퀀스 런타임 엔진 (\`SUBSEQ_NS\`) 및 엑셀 인프라
* **JSON/Excel 기반 Step 정의**:
  * 각 시퀀스는 고정 컬럼(Step, 명칭, 밸브 출력, 센서 조건, 타이머, 알람, 점프 등) 구조로 정의됩니다.
  * **설계 사유**: 래더 프로그램 수정 없이도 공정 엔지니어가 엑셀(\`GMS_Cylinder_Exchange_Master_Total.xlsx\`)에서 직접 시퀀스 조건을 수정하고 즉시 웹에 Import하여 검증할 수 있도록 데이터 주도형(Data-Driven) 엔진을 구축하였습니다.
* **PC 시뮬레이션 버퍼 (\`gmsState.valveBuffer\`)**:
  * **설계 사유**: 실제 PLC 래더가 완성되기 전에도 전 공정 시뮬레이션, 타이머 검증, UI 애니메이션 및 에러 알람 테스트를 100% 완수할 수 있도록 백엔드에 가상 밸브 버퍼를 구축하였습니다.

### 2.4 백엔드 모듈 정적 의존성 분석 (Dependency Architecture)
* **도구 도입**: \`dependency-cruiser\` 라이브러리를 통해 정적 모듈 의존성을 체계적으로 관리합니다 (\`npm run analyze:mermaid\`).
* **모듈 레이어 구조**:
  - **진입점 및 라우터**: \`server.js\` (Express/WebSocket)
  - **도메인 비즈니스 매니저**: \`gmsManager.js\`, \`gridManager.js\`, \`trendManager.js\`, \`plcSession.js\`
  - **데이터베이스 및 저장소**: \`gmsHistory.js\` (SQLite), \`settingsManager.js\`, \`nxTags.js\`
  - **PLC 통신 프로토콜 계층**: \`usbFinsClient.js\`, \`udpFinsClient.js\`, \`tcpFinsClient.js\`, \`nxCipClient.js\`, \`finsCommands.js\`
  - **유틸리티 및 데이터 타입 정의**: \`dataTypes.js\`, \`memoryAreas.js\`, \`timeUtils.js\`, \`excelImport.js\`

---

## 3. [DO / PROGRESS] Step별 완료도 및 상태 매트릭스 (Completion Status)

### 3.1 전체 기능별 진척도 요약

| 영역 / 모듈 | 세부 기능 | 진척도 | 상태 | 비고 |
|:---|:---|:---:|:---:|:---|
| **기반 통신 계층** | CJ2H USB (FINS-over-USB) | 100% | ✅ 검증완료 | 실기 PLC 테스트 완료 |
| | CJ2H UDP / TCP (FINS) | 100% | ✅ 검증완료 | 실기 PLC 테스트 완료 |
| | NX/NJ CIP (EtherNet/IP) | 90% | 🟡 코드완료 | 실기 하드웨어 테스트 대기 |
| **기반 모니터링 UI** | 메인 대시보드 (메모리 뷰어) | 100% | ✅ 검증완료 | 영역별 독립 뷰어 적용 완료 |
| | Univer 그리드 (레시피/스냅샷) | 100% | ✅ 검증완료 | Vite 빌드 및 스냅샷 판정 완료 |
| | 트렌드 모니터링 (시계열 차트) | 100% | ✅ 검증완료 | 링 버퍼 및 CSV 자동 저장 완료 |
| | 전역 설정 / PLC 정보 팝업 | 100% | ✅ 검증완료 | \`settings.json\` 연동 완료 |
| **GMS 자동 시퀀스** | P&ID 인터랙티브 배관도 | 100% | ✅ 구현완료 | 밸브 개폐/압력 실시간 연동 |
| | 실린더 교환 전 구간 (\`IDLE\`~\`PC\`) | 100% | ✅ 구현완료 | 가상 버퍼 상에서 완주 검증 |
| | 16개 서브시퀀스 엑셀 인프라 | 100% | ✅ 구현완료 | Import/Export 및 자동 백업 완비 |
| | 작업이력 / 에러로그 / 사용자 | 100% | ✅ 구현완료 | SQLite DB 및 Univer 그리드 연동 |
| **유지보수 모드** | 수동 밸브 조작 / PM·Setup 모드 | 100% | ✅ 구현완료 | 정상 동작 |
| | 바코드 체크 / Maintenance Purge | 40% | 🟡 뼈대구현 | 세부 검증/시퀀스 로직 추가 필요 |
| **하드웨어 연동** | GMS 밸브 실제 PLC 래더 연동 | 0% | ⏳ 대기 | PLC 래더 프로그램 완성 후 연동 |
| | \`VT_{side}\` (고진공 게이지) 주소 매핑 | 0% | ⏳ 대기 | \`memoryAreas.js\`에 주소 할당 대기 |

---

## 4. [CHECK] 수정 이력 및 원인/사유 분석 (Revision & Issue Log)

### 4.1 데이터 타입 인코딩 버그 수정 (\`src/dataTypes.js\`)
* **ULBCD 워드 역전 현상**:
  * **원인**: \`encodeValue('ULBCD')\`에서 \`unshift\` 후 불필요한 \`.reverse()\`가 호출되어 최상위 자릿수가 최하위 워드로 뒤집혀 저장됨.
  * **수정 및 사유**: \`.reverse()\` 제거. PLC 메모리 구조(빅엔디안 워드 배열)와 일치시킴.
* **LINT/ULINT 큰 정수 정밀도 손실**:
  * **원인**: $2^{53}$을 초과하는 64비트 정수를 \`Number()\`로 캐스팅하여 정밀도 손실 발생.
  * **수정 및 사유**: \`BigInt(rawValue)\`를 직접 파싱하도록 수정하여 64비트 정밀도를 100% 보존.

### 4.2 메모리 영역 탭 설정 전역 오염 방지 (\`src/server.js\`)
* **원인**: 전역 \`activeView\` 단일 객체를 모든 영역(D, CIO, W, H, EM)이 공유하여, D영역에서 설정한 시작 주소/페이지 크기가 W영역으로 이동 시 그대로 전파되는 버그.
* **수정 및 사유**: \`areaViews\` Map을 도입하여 각 메모리 영역별로 독립된 뷰 상태를 유지하도록 구조 개선.

### 4.3 다중 세션 대비 상태 캡슐화 (\`src/gridManager.js\`, \`src/trendManager.js\`)
* **원인**: 매니저 생성 함수가 팩토리 형태임에도 불구하고 내부 상태(\`gridState\`, \`trendState\`, \`valueHistory\`)가 모듈 레벨 싱글턴으로 존재.
* **수정 및 사유**: 모든 상태를 팩토리 클로저 내부로 이동시켜, 브라우저 탭별 다중 PLC 세션 확장 시 상태 충돌이 발생하지 않도록 리팩터링 완료.

---

## 5. [ACT / ROLLBACK] Step 원복 및 상태 복구 구조 (State Restoration Guide)

### 5.1 서브시퀀스 Step 데이터 원복 (SubSequence Rollback)
* **자동 백업 위치**: \`data/gmsSubSequenceBackups/<SequenceName>_v1/<SequenceName>_v1_<Timestamp>.xlsx\`
* **원복 절차**:
  1. 웹 UI (GMS 화면) -> 서브시퀀스 편집기 접속.
  2. "불러오기(Import)" 클릭 후 \`data/gmsSubSequenceBackups/\` 폴더에서 복원하고자 하는 시점의 \`.xlsx\` 파일 선택.
  3. 시퀀스 즉시 반영 및 런타임 JSON(\`data/gmsSubSequences/<SequenceName>_v1.json\`) 자동 갱신.

### 5.2 런타임 설정 및 DB 복구 (Data Rollback)
* **주요 데이터 파일**:
  * \`data/settings.json\` : 전역 앱 설정 (백업본을 통해 기본값 즉시 복원 가능)
  * \`data/variables.json\` / \`trendVariables.json\` : 메인 및 트렌드 변수 목록
  * \`data/gms-history.db\` : SQLite 작업 이력 및 에러 로그
* **복구 절차**: 필요 시 Git 체크포인트에서 해당 JSON 파일을 체크아웃하여 즉시 이전 상태로 복구:
  \`\`\`powershell
  git checkout HEAD -- data/settings.json data/variables.json
  \`\`\`

### 5.3 Git 커밋 기반 전체 Step 롤백
* 각 주요 Step 또는 기능 구현 완료 시 커밋을 생성하며, 언제든지 특정 작업 단위(\`Q-xxx\`) 이전으로 원복 가능:
  \`\`\`powershell
  git log --oneline -n 10
  git checkout <Commit-Hash> -- <복원할_경로>
  \`\`\`
`;

const pdcaPath = path.join(__dirname, '../docs/PROJECT_MASTER_PDCA.md');
fs.writeFileSync(pdcaPath, pdcaContent, { encoding: 'utf8' });
console.log('PROJECT_MASTER_PDCA.md rewritten successfully with UTF-8 encoding (size: ' + Buffer.byteLength(pdcaContent, 'utf8') + ' bytes)');
