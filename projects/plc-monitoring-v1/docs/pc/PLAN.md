# PLAN.md — 프로젝트 현황 & 로드맵

> 오래간만에 재개할 때 가장 먼저 볼 문서. "지금 뭐가 됐고 뭐가 안 됐는지"만 담는다 - 세부
> 문법/아키텍처는 각 문서(맨 아래 "참고 문서")로 넘긴다. 세션 시작 시 순서: 이 문서 →
> `docs/TASK.md`(오늘 할 일이 적혀 있으면) → 작업 종류에 맞는 참고 문서.

**마지막 갱신**: 2026-08-11

---

## 1. 프로젝트가 뭔가

Omron CJ2H-EIP(FINS, USB/UDP/TCP) + NX/NJ 시리즈(EtherNet/IP-CIP) PLC를 웹으로 모니터링/기록
/쓰기하는 Node.js 앱. 두 축으로 나뉜다.

- **기반 앱**: 메인 대시보드/그리드(Recipes)/트렌드 모니터링/설정 4페이지. PLC 통신·메모리
  탐색·변수 기록의 범용 기반.
- **GMS(Gas Monitoring System)**: 기반 앱 위에 얹힌 가스 캐비닛 배관도+조작화면. 실린더
  교환(자동진행), 조정모드, 압력조정, 작업이력/에러로그, 서브시퀀스 엑셀 편집 시스템 등.
  현재 작업의 대부분이 여기 있다.

⚠️ **가장 중요한 전제**: GMS 밸브 상태는 전부 **PC측 시뮬레이션 버퍼**(`gmsState.valveBuffer`,
`src/gmsManager.js`)로 동작한다 - 실제 PLC에 아직 래더 프로그램이 없어서다. 아래 "완료"는
전부 "화면/로직/엑셀 편집 인프라가 완성됐다"는 뜻이지, "실제 하드웨어로 검증됐다"는 뜻이
아니다. 실기 연동은 별도 단계로 남아 있다.

---

## 2. 현재 상태 요약

### 완료된 것

1. **기반 앱** — USB/UDP/TCP FINS(CJ 시리즈) + EtherNet/IP-CIP(NX/NJ, 실기 미검증) 통신,
   4페이지, Windows 설치 프로그램까지.
2. **GMS 실린더 교환 자동진행** — Status IDLE→Puls→1P(4단계)→-L→[-VT]→2P→CC(용기교체)→
   [Bypass]→3P→+L→[-VT]→4P→PC 전 구간이 서브시퀀스 엔진(또는 CC 전용 경량 구조) 화면으로
   전환 완료. PASSWORD 게이트, OPTION 탭 스위치, 작업이력/에러로그 기록까지 연동.
3. **서브시퀀스 엑셀 편집 인프라** — 서브시퀀스 16개 전부 엑셀 내보내기/불러오기 가능,
   자동 백업, 통합본(`GMS_SubSequence_Total.xlsx`)과 기능별 예시 메뉴얼까지 정비.
4. **문서 정비** — `CLAUDE.md` 프로젝트 루트 이동(자동 로드 버그 수정), GMS 관련 단일
   참고문서(`GMS_AUTO_SEQUENCE_HANDOFF.md`)로 통합, `docs/archive/`로 낡은 문서 격리,
   planner/implementer 에이전트가 문서를 참조하도록 정리.

### 세 구간(그룹)별 현황

사용자가 자주 언급하는 세 영역의 현재 상태(참고: "교환전1차"·"통신연결"은 문자 그대로의
메뉴 그룹명은 아니고, 코드베이스에서 실제로 대응하는 기능을 아래처럼 확인했다 - 다르게
이해하고 계셨다면 알려주시면 바로 정정하겠습니다).

| 구간 | 실제 대응 기능 | 상태 |
|---|---|---|
| **교환전1차** | 실린더 교환의 "1P"(1차측) 구간 - `1P_자동진행`/`1P_2차측Purge_자동진행`/`1P_Pumping_자동진행`/`1P_1차측Purge_자동진행` 4화면 | ✅ 로직/화면/엑셀 편집 전부 완료. 4개 각각 OPTION 탭에서 개별 on/off 가능 |
| **유지보수** | 메인메뉴 → "유지 보수" → 수동밸브 조작 / 바코드 체크 / Maintenance Purge (+ 별개로 보조메뉴의 "유지보수모드"=PM/Setup Mode) | 🟡 **부분 완료** - 수동밸브 조작·PM/Setup Mode는 실동작. **바코드 체크·Maintenance Purge는 뼈대**(확인 버튼이 토스트만 띄움, 실제 검증/시퀀스 로직 없음) |
| **통신연결** | PLC 연결(USB/UDP/TCP FINS, NX CIP) 및 연결 툴바 - 기반 앱 전체의 핵심 기능 | ✅ CJ 시리즈는 실기 검증 완료(3가지 방식). NX/NJ CIP는 코드는 있으나 **실기 미검증** |

---

## 3. 남은 일 (우선순위 순)

- [ ] **VT_{side}(VT 감압시험 고진공 게이지) 실제 PLC 주소 매핑** — `memoryAreas.js`에
      아직 없음. 값이 없으면 관련 조건을 조용히 건너뜀(오작동 아님, 사용자가 "나중에 한
      번에 매핑 예정"이라 확인함).
- [ ] **유지보수 메뉴: 바코드 체크 / Maintenance Purge 실제 로직** — 지금은 뼈대.
- [ ] **+L(가압시험)/Bypass 실기 완주 검증** — 로직/참조 무결성은 스크립트로 검증했지만,
      Chrome 백그라운드 탭 타이머 스로틀링 때문에 NPT/HPT 5분 유지확인·압력안정화/시험
      구간을 실시간으로 끝까지 돌려본 적은 없음. "고압 HE Leak check 라인 유무" ON 분기,
      "가압시험 완료후 Puls Vent" ON 분기, FAIL 알람 실제 유발도 미검증.
- [ ] **가스공급(Service) 이후 단계 설계** — 현재 화면 전환/Status 시뮬레이션만 있고,
      유량 모니터링/실제 밸브 명령 등 다음 단계는 설계 자체가 안 돼 있음.
- [ ] **용기교체 CC: "바코드 수동입력"/"바코드 확인"/"Lot No. Skip"** — 아직 미구현.
- [ ] **PASSWORD 고정값(4321) → 실제 값 교체** — 지금은 개발용 고정값.
- [ ] **NX/NJ EtherNet/IP-CIP 실기 검증** — ODVA 공개 규격 기반 구현, 실제 하드웨어로 아직
      확인 못 함.
- [ ] **GMS 전체 밸브 상태 → 실제 PLC 연동** — 위 "가장 중요한 전제" 참고. 래더 프로그램이
      생기면 `gmsState.valveBuffer`를 실제 읽기/쓰기로 교체하는 큰 작업이 남아 있음.

---

## 4. 재개 절차 (세션 시작 시)

1. 이 문서(`PLAN.md`)로 전체 그림 확인.
2. `docs/TASK.md` 확인 - "(아직 지시 없음)"이 아니면 그게 이번 세션 지시.
3. GMS 관련 작업이면 `docs/GMS_AUTO_SEQUENCE_HANDOFF.md`를 먼저 읽는다(Status/PASSWORD
   체계, SUBSEQ_NS 엔진 패턴의 단일 참고 문서).
4. 서브시퀀스 엑셀(Step 데이터) 관련 작업이면 `docs/GMS_SUBSEQUENCE_EXCEL_GUIDE.md` +
   `docs/GMS_SubSequence_Total_기능_예시_메뉴얼.md`를 먼저 읽는다.
5. 작업이 끝나면 이 문서의 "2. 현재 상태 요약"/"3. 남은 일"과 `TASK.md`의 "처리 상태"를
   갱신한다.

---

## 5. 참고 문서

| 문서 | 용도 |
|---|---|
| `CLAUDE.md`(루트) | 프로젝트 구조/프로토콜/작업 규칙 - 대화 시작 시 자동 로드 |
| `docs/TASK.md` | "오늘 할 일" - 사용자가 편집해서 지시 |
| `docs/GMS_AUTO_SEQUENCE_HANDOFF.md` | GMS Status/PASSWORD/SUBSEQ_NS 엔진 단일 참고 문서 |
| `docs/GMS_SUBSEQUENCE_EXCEL_GUIDE.md` | 서브시퀀스 엑셀 문법 상세(열별 설명) |
| `docs/GMS_SubSequence_Total_기능_예시_메뉴얼.md` | 위 문법을 실제 값으로 보여주는 예시 모음 |
| `docs/GMS_SubSequence_Total.xlsx` | 서브시퀀스 16개 통합 엑셀 |
| `docs/ISSUE_LOG_AND_DESIGN_STANDARDS.md` | 기반 앱(PLC 모니터링) 변경이력/버그/UI 표준 |
| `docs/01-plan/features/*.plan.md`, `docs/02-design/features/*.design.md` | 기능별 계획/설계 문서(CC, 교환후+Bypass) |
| `docs/archive/` | 낡거나 대체된 과거 문서(참고용 보관) |
