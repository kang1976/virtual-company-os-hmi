# Design — 통신 아키텍처 + 인증/보안 설계

> **작성일**: 2026-08-26
> **참고 문서**: [PROJECT_START.md](../00-start/PROJECT_START.md), [schema.md](../01-plan/schema.md), [plan.md](../01-plan/plan.md)
> **아키텍처 방향**: 기존 GMS 프로젝트(`plc-monitoring ver1.0 - google`)와 **완전 독립**된 신규 프로젝트 (QA_LOG Q-018)

---

## Context Anchor

| 항목 | 내용 |
|---|---|
| WHY | 핸드폰/태블릿으로 공장 내부에서 PLC를 모니터링·전면제어하기 위해 |
| WHO | 공장 내부 와이파이에 접속 가능한 관리자/운영자/조회자 3단계 사용자 |
| RISK | FINS 프로토콜에 인증이 없음 + 전면 제어 → 오조작/무단조작 시 실제 설비 사고로 이어질 수 있음 |
| SUCCESS | plan.md §6 DoD 7개 항목 충족 + security-review 통과 |
| SCOPE | PLC 1대(Omron CJ2H-CPU65-EIP), 로컬 와이파이 전용, PWA 클라이언트, 기존 GMS 앱 무수정 |

---

## 1. 전체 아키텍처

```
[핸드폰/태블릿 브라우저 (PWA)]
        │  HTTPS 또는 HTTP + 세션 쿠키
        │  WebSocket (인증된 세션만)
        ▼
[신규 브릿지 서버 — Node.js/Express, 이 프로젝트 전용, GMS 서버와 별개 프로세스]
        │  ├─ auth.js         로그인/세션/3단계 Role
        │  ├─ commandGuard.js 위험 Command 2단계 확인
        │  ├─ auditLog.js     모든 로그인/Command 이력 기록 (node:sqlite)
        │  └─ plcClient/      FINS 통신 (기존 GMS 프로젝트에서 복사)
        │        TCP/UDP FINS (포트 9600)
        ▼
[Omron CJ2H-CPU65-EIP PLC — 192.168.0.80]
```

기존 GMS 앱(`plc-monitoring ver1.0 - google`)은 **같은 PC에서 별도 포트로 계속 실행되며, 이 프로젝트와 서로 관여하지 않는다.** PLC의 UDP/TCP FINS는 여러 세션을 동시에 허용하므로(§ "세션·연결 아키텍처" 참고), 두 프로세스가 동시에 같은 PLC에 접속해도 기술적으로 문제 없음 — 단, PLC 부하/응답 지연 영향은 운영 중 모니터링 필요(§7 리스크).

### 1-1. 왜 브릿지 서버가 필수인가 — 폰↔PLC 직접 통신 불가 (QA_LOG Q-030)

휴대폰(웹 화면)이 PLC에 **직접** 접속하는 구조는 불가능하다. 서버(PC 등 상시 기기)를 반드시 거쳐야 한다.

1. **물리적 제약**: 폰 앱은 브라우저 안에서 돈다. 브라우저는 보안상 HTTP/HTTPS/WebSocket만 가능하고, **raw TCP/UDP 소켓을 열 수 없다.** PLC가 쓰는 FINS(포트 9600, raw 소켓)로는 브라우저가 아예 패킷을 보낼 수 없다. 같은 와이파이여도 마찬가지. 서버가 HTTP ↔ FINS 통역을 담당한다.
2. **안전 게이트**: 가스캐비닛 안전 시스템이므로 임의 단말의 직접 명령을 막아야 한다. 로그인·RBAC·위험명령 2단계 확인·비밀번호 재입력·모든 시도 감사 로그를 서버가 강제한다(§3, §4, §5). PLC 자체는 받은 명령을 그대로 수행한다.
3. **PLC 연결 수 제한**: CJ2H는 동시 FINS/TCP 연결 수가 적고 좀비 연결이 쌓이기 쉽다(mobile-screen-plan 0.7.1). 서버 1대가 관리된 연결 1개를 열어 다수 클라이언트가 공유한다.
4. **상시 동작이 필요한 일**: 트렌드 1초 기록(§9)은 앱을 안 켜도 계속 돌아야 한다 — 상시 서버만 가능.
5. **데이터 보관**: 계정·태그·72시간 트렌드·감사 로그는 한 곳(서버 DB)에 영속 저장되어야 한다.
6. **망 분리**: PLC는 격리된 유선망(192.168.0.x), 클라이언트는 와이파이. 서버가 그 사이의 유일한 통제된 다리다.

→ 따라서 **PC(또는 라즈베리파이 등 소형 상시 기기)에서 서버가 24시간 떠 있어야** 폰이 접속할 대상이 존재한다. 폰 자체는 서버가 될 수 없다. 현재 개발 중에는 개발 PC가 그 역할을 하고 있음(운영 시 전용 상시 기기 권장).

---

## 2. 프로젝트 폴더 구조 (신규)

```
Claude/                        ← 이 프로젝트 루트
├── docs/                      (기존 — 00-start, 01-plan, 02-design)
├── src/
│   ├── server.js              Express + WebSocket 서버 (신규 작성)
│   ├── auth.js                로그인/세션/RBAC 미들웨어 (신규)
│   ├── commandGuard.js        위험 Command 2단계 확인 (신규)
│   ├── auditLog.js            node:sqlite 이력 기록 (신규)
│   ├── tagImport.js           심볼 우선 대량 가져오기(schema.md §2-2)
│   └── plcClient/             ← 기존 GMS 프로젝트에서 복사 (원본 무수정)
│       ├── tcpFinsClient.js
│       ├── udpFinsClient.js
│       ├── finsShared.js      (AREA_CODES 등 공용 상수만 분리 — 원본 usbFinsClient.js는 'usb' 네이티브 패키지가
│       │                       필요해 이 프로젝트엔 불필요, 상수만 뽑아 새로 만듦)
│       ├── finsCommands.js
│       ├── memoryAreas.js
│       └── dataTypes.js
├── public/                    모바일 PWA (구현 완료)
│   ├── index.html / app.js / style.css   로그인 + 대시보드(태그 검색/페이지네이션/명령 확인 모달)
│   ├── manifest.json          PWA 매니페스트
│   ├── service-worker.js      오프라인 캐시(정적 자원만, PLC 데이터는 캐시 안 함)
│   └── icons/                 홈 화면 아이콘
├── scripts/
│   ├── createUser.js          관리자/사용자 계정 생성 CLI (회원가입 API 없음)
│   └── importTags.js          태그 심볼 일괄 등록 CLI
├── data/
│   └── app.db                 node:sqlite — User/Tag/Command/AuditLog 테이블 (gitignore 대상)
└── package.json
```

> 2026-08-26 Do 단계에서 위 골격을 실제로 구현하고 로그인→태그검색→Import→2단계확인 Command→AuditLog→실제 PLC 연결까지 end-to-end 검증 완료(QA_LOG Q-023). `tagMap.js`는 별도 파일로 만들지 않고 `tagImport.js` + `tags` 테이블로 통합됨.

---

## 3. 인증/인가 설계

### 3-1. 인증 방식 — 세션 기반 (JWT 아님)

| 비교 | 세션 기반(채택) | JWT 토큰 |
|---|---|---|
| 로그아웃/강제 종료 | 서버에서 즉시 무효화 가능 | 만료 전까지 유효(블랙리스트 관리 필요) |
| 구현 복잡도 | 낮음 (`express-session`, 무료) | 중간 |
| 로컬 단일서버 환경 적합성 | 좋음 (분산 서버 아님) | 과설계 |

→ 로컬 와이파이 + 단일 서버 환경이라 **세션 기반**이 더 단순하고 안전(강제 로그아웃이 쉬움 = 오조작 발생 시 즉시 접근 차단 가능).

### 3-2. 비밀번호 저장

`bcrypt`(무료 오픈소스)로 해시 저장. 평문 저장 금지.

### 3-3. RBAC 미들웨어

```js
requireRole(['ADMIN'])           // 관리자 전용 라우트
requireRole(['ADMIN','OPERATOR']) // 운영자 이상
// 기본: 로그인만 하면 VIEWER 권한(읽기)은 전부 허용
```

각 API 라우트에 위 미들웨어를 적용. 프론트엔드 UI 숨김은 보조 수단일 뿐, **서버 측 권한 검사가 최종 방어선**.

### 3-4. WebSocket 인증

WebSocket 업그레이드 요청 시 세션 쿠키를 검증(`express-session`과 스토어 공유). 인증 실패 시 연결 거부. 인증된 커넥션만 PLC 상태 브로드캐스트 수신.

---

## 4. 위험 Command 2단계 확인 흐름

```
클라이언트                     서버(commandGuard.js)
   │  POST /api/command            │
   │  {tagId, value}                │
   ├───────────────────────────────►│
   │                                │ tagMap에서 risk_level 조회
   │                                │
   │  risk_level = danger 인 경우:   │
   │◄─── 409 {confirmToken} ────────┤ (아직 실행 안 함, AuditLog에 "요청" 기록)
   │                                │
   │  (화면에 "정말 실행?" 확인)      │
   │                                │
   │  POST /api/command/confirm     │
   │  {confirmToken}                │
   ├───────────────────────────────►│
   │                                │ role 재검사 → PLC에 실제 쓰기 실행
   │◄─── 200 {result} ──────────────┤ AuditLog에 "실행" 기록(성공/실패)
```

- `risk_level = safe` + 권한 있음 → 확인 절차 없이 즉시 실행 (단, AuditLog는 항상 기록)
- `risk_level = caution`(2,000개 쓰기 태그의 기본값, schema.md §2-1) → 위 2단계 확인 흐름을 항상 거침 — 즉 별도 분류 작업 없이도 전체 태그가 안전하게 시작됨
- `confirmToken`은 1회용, 짧은 유효시간(예: 30초) — 방치된 확인창으로 뒤늦게 실행되는 것 방지
- OPERATOR가 화이트리스트 밖 Tag를 시도하면 1단계에서 403으로 즉시 거부(확인 절차 자체를 안 감)

---

## 5. AuditLog 설계

`schema.md`의 AuditLog 테이블을 `node:sqlite`로 구현. 기록 시점:

| 이벤트 | 기록 내용 |
|---|---|
| 로그인/로그아웃 | user_id, 시각, 결과 |
| Command 요청(1단계) | user_id, tag_id, 요청값, risk_level |
| Command 확인/실행(2단계) | confirmToken 매칭 결과, PLC 응답(endCode), 최종 성공/실패 |
| 권한 거부 | user_id, 시도한 tag_id, 사유 |

AuditLog는 **삭제 API를 만들지 않음** — 조회만 가능(위변조/삭제 방지, 최소한의 무결성 보장).

---

## 6. PWA 설계

- `manifest.json`: 앱 이름, 아이콘, `display: standalone`(주소창 없이 앱처럼 보임), `start_url`
- `service-worker.js`: 정적 자원(HTML/CSS/JS/아이콘)만 캐시. **PLC 실시간 데이터는 캐시하지 않음**(오래된 상태값을 보여주는 것 자체가 오조작 위험) — 항상 서버에서 최신 값만 표시
- **HTTPS는 선택이 아니라 필수임을 실제 검증으로 확인함(2026-08-27, QA_LOG Q-025/Q-026)**: 평문 HTTP에서는 서비스워커 등록 자체가 실패해 "홈 화면에 추가"를 눌러도 아무것도 생성되지 않았음. `certs/`(mkcert로 발급, `.gitignore` 대상)로 HTTPS 전환 후에야 정상 동작.
  - 인증서가 **신뢰되지 않은 상태**(경고를 수동으로 넘긴 상태)에서는 "Create shortcut"(주소창 있는 즐겨찾기)만 생성됨
  - **CA 인증서를 신뢰 저장소에 설치한 뒤**에는 Chrome이 "Install app"을 제안하고, 주소창 없는 진짜 standalone 앱 창으로 실행됨 — Android 에뮬레이터로 실제 확인 완료
  - 실사용(공장 배포) 단계에서는 사설 CA 대신 정식 인증서(방법은 Do 단계에서 재검토) 또는 각 핸드폰에 회사 CA를 배포하는 절차가 필요

### 6-1. 로컬 개발 HTTPS 설정 (mkcert)

```bash
winget install --id=FiloSottile.mkcert -e
mkcert -install                      # PC를 이 인증서의 발급기관으로 신뢰 (보안 저장소 변경 — 사용자 본인이 실행)
cd certs
mkcert -cert-file server.pem -key-file server-key.pem localhost 127.0.0.1 10.0.2.2 <PC의 LAN IP들>
```

`server.js`는 `certs/server.pem`, `certs/server-key.pem`이 있으면 자동으로 HTTPS로, 없으면 HTTP로 기동한다(§2 폴더 구조 참고).

---

## 7. 리스크 및 대응

| 리스크 | 대응 |
|---|---|
| GMS 앱과 신규 서버가 PLC에 동시 접속 시 부하/응답지연 | Do 단계에서 두 프로세스 동시 폴링 시 응답시간 측정, 필요시 폴링 주기 조정 |
| 위험 Command 목록/화이트리스트 미확정 | Do 착수 전 현장 안전 담당자 확인 필수 (plan.md §5 항목 2, 4) |
| 태그명↔실제주소 매핑 미확정(약 2,000+2,000개 규모) | 매핑표는 추후 공유 예정(QA_LOG Q-021) — 도착 전까지 schema.md §2-2 Import 파이프라인 골격만 준비 |
| 2,000개 태그를 FINS 한 번의 요청으로 못 읽음(프로토콜상 항목 수 제한) | Do 단계에서 배치(batch) 읽기로 나눠서 폴링 — 배치 크기/주기는 실측 후 결정 |
| 이 시스템이 실제로는 반도체 팹 위험가스 안전 시스템(SK Hynix M16 GC)임(QA_LOG Q-019) | 당초 가정보다 안전 설계 기준을 더 보수적으로 유지 — risk_level 기본값을 `caution`(2단계 확인)으로 둔 것(schema.md §2-1)도 이 때문 |
| PWA 설치가 일부 구형 브라우저에서 안 될 수 있음 | Do 단계에서 실제 사용할 기기 기종으로 조기 검증 |

---

## 8. 질의 응답 관련

| 질문 내용 | 날짜 | 답변내용 | 관련 항목 |
|---|---|---|---|
| 아키텍처 3안(A/B/C) 중 선택 | 2026-08-26 | 기존 GMS와 완전 별도 프로젝트로 진행, 기존 것은 백업 | QA_LOG Q-018 |
| PWA 설치가 HTTP에서도 되는지 | 2026-08-27 | 실제로는 안 됨(서비스워커 등록 실패), HTTPS 필수로 정정 | QA_LOG Q-025/Q-026 |

전체 근거와 시간순 기록은 [QA_LOG.md](../00-start/QA_LOG.md) 참고.

---

## 9. 트렌드 로깅 (2026-08-28 확정 규칙, QA_LOG Q-028)

반복 재설계를 막기 위해 트렌드 관련 규칙을 아래로 고정한다.

### 9-1. 변수(시리즈) 정의 — tags 테이블과 독립

트렌드 변수는 **메모리 주소를 직접 지정**한다 (모니터링의 "PLC 주소 배정"과 동일한 입력):
`표시 이름` + `메모리 영역` + `워드 주소` + `데이터 타입` + `비트(선택)`.
등록된 태그를 고를 필요가 없다 — 주소만 있으면 트렌드에 추가 가능. (`trend_series` 테이블)

### 9-2. 샘플링 — 서버가 1초 고정, 72시간 보관

- 서버가 **1초 주기**로 `enabled` 시리즈를 모두 읽어 `trend_sample`에 적재 (`server.js` setInterval).
- 앱이 열려 있지 않아도 서버가 계속 기록한다.
- **72시간(RETENTION)** 초과 샘플은 10분마다 삭제 (rolling window).
- 최대 시리즈 수 16개 (라이브 안전 PLC 부하 고려).
- "기록 중 / 기록 정지" 토글로 전체 중단 가능 (ADMIN).
- 앱 화면의 그래프 갱신 주기(표시용)는 별개로 2초 고정. 연결 설정의 폴링 주기와 무관.

### 9-3. 조회 — 다운샘플

`GET /api/trend/samples?window=<sec>&max=<n>` — 지정 창을 `max`(기본 700) 이하로 **버킷 평균** 다운샘플해서 반환. 창은 1분~72시간.

### 9-4. 내보내기 / 가져오기 — CSV(엑셀 호환)

- **내보내기** `GET /api/trend/export.csv` — UTF-8 BOM + `# series:` 메타줄(주소 스펙) + `timestamp,<이름>,...` 와이드 포맷. Excel에서 바로 열림, 대용량(수십만 행) 처리 가능. 진짜 `.xlsx`는 라이브러리(exceljs)가 필요해 채택 안 함.
- **가져오기** `POST /api/trend/import` (text/csv 본문, ADMIN) — 내보낸 CSV를 되읽어 `trend_sample`에 적재. `# series:` 메타로 주소 스펙 복원, 없으면 `(가져옴)` 스펙. 가져온 시리즈는 `enabled=0`(라이브 폴링 안 함, 과거 데이터 표시 전용). 같은 이름 시리즈가 있으면 병합.

### 9-5. 태그 이름 편집

`PATCH /api/tags/:id` (ADMIN) — 심볼·설명 수정. 심볼 유니크 검사. "태그 편집" 모달(구 "주소 배정")에서 이름·설명·주소를 함께 수정.

### 9-6. 저장 용량 참고

16시리즈 × 1초 × 72시간 ≈ 414만 행. 행당 약 40~60바이트 + 인덱스 → 수백 MB. `data/app.db`가 커지므로 백업/디스크 여유 주의.


---

## 버전 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| 0.1 | 2026-08-26 | 최초 작성 — 독립 프로젝트 아키텍처, 인증/RBAC, 위험명령 2단계 확인, AuditLog, PWA 설계 |
| 0.2 | 2026-08-26 | 태그 규모(2,000+2,000) 반영, risk_level 기본값 정책(caution 우선) 반영, 배치 폴링 필요성 명시 |
| 0.3 | 2026-08-26 | Do 단계 구현 완료 반영 — DB를 node:sqlite로 교체(QA_LOG Q-023), 실제 폴더 구조/파일명 정정(finsShared.js), end-to-end 검증 결과 기록 |
| 0.4 | 2026-08-27 | 프로젝트 D드라이브 이전 반영, Android 에뮬레이터 실기 검증 완료(로그인/대시보드/PLC연결/PWA설치), HTTPS(mkcert)가 PWA 설치에 필수임을 확인해 §6 정정 및 §6-1 추가 |
