# 스키마 정의 (Schema) — 모바일/태블릿 PLC 원격 제어

> **작성일**: 2026-08-26
> **범위**: 1차 — Omron CJ 시리즈 PLC 1대, 로컬 와이파이, 전면 제어
> 용어 정의는 [glossary.md](glossary.md) 참고

---

## 1. Device (PLC)

1차 범위는 PLC 1대이므로 단수로 설계하되, 향후 확장을 고려해 테이블 구조는 유지.

| 필드 | 타입 | 설명 |
|---|---|---|
| `device_id` | string | 내부 식별자 (1차: 고정값 1개) |
| `name` | string | 표시 이름 (예: "1호기 PLC") |
| `model` | string | `CJ2H-CPU65-EIP` (실기 응답값 직접 확인, 펌웨어 01.9001.A6 — 기존 `CLAUDE.md`의 "CPU68EIP" 표기는 오기였음) |
| `ip_address` | string | 예: `192.168.0.80` (PLC), 브릿지 서버는 `192.168.0.211` — **2026-08-26 FINS/TCP 실기 연결 테스트 직접 성공** (핸드셰이크+CPU정보 읽기+W0 읽기, 쓰기 없음) |
| `fins_node` | int | PLC 노드 0x50(80), PC 노드 0x01(1) |
| `port` | int | FINS 포트 9600 |
| `protocol` | string | `FINS/TCP` \| `FINS/UDP` — 기존 `tcpFinsClient.js`/`udpFinsClient.js` 재사용 |
| `status` | string | `online` \| `offline` \| `error` |

---

## 2. Tag (Memory Point)

**규모(2026-08-26 확정, QA_LOG Q-020)**: 읽기(모니터링) 약 **2,000개**, 쓰기 약 **2,000개**. 이 규모에서는 태그를 수작업 표로 정의할 수 없으므로 **대량 가져오기(Import)** 전제로 설계한다.

**실제 심볼↔주소 매핑은 아직 없음** — 추후 사용자가 매핑표를 공유할 예정(QA_LOG Q-021). 그 전까지는 스키마와 Import 파이프라인만 준비하고, 아래는 구조 설명을 위한 예시 값이다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `tag_id` | string | 내부 식별자 |
| `device_id` | string | 소속 Device |
| `symbol` | string | PLC 프로그램상의 심볼명(예: `GMS_SEND.Program_Ver[0]`) — 원본 Excel(`관리 일괄` 시트)에 있는 이름, 사람이 알아보는 용도 |
| `name` | string | 화면 표시용 논리 이름 (예: `PUMP1_RUN_STATUS`) — 매핑표 도착 후 정리 |
| `address` | string | 실제 PLC 메모리 주소 (예: `CIO0000.00`, `D0100`) — **TBD, 매핑표 도착 후 채움** |
| `area_type` | string | `CIO` \| `D` \| `W` \| `H` 등 |
| `data_type` | string | `BOOL` \| `INT` \| `WORD` \| `DWORD` |
| `access` | string | `read` \| `write` \| `read_write` |
| `description` | string | 사람이 읽을 설명 |
| `risk_level` | string | `safe` \| `caution` \| `danger` — 아래 §2-1 참고 |
| `source` | string | `import` \| `manual` — Excel/매핑표에서 대량 가져온 것인지 수동 등록인지 구분 |

### 2-1. risk_level 기본 정책 (2026-08-26 확정, QA_LOG Q-020)

| 등급 | 기본/수동 | 동작 |
|---|---|---|
| `caution` | **모든 쓰기 태그의 기본값** (Import 시 자동 지정) | 2단계 확인 필수 |
| `safe` | ADMIN이 태그 하나씩 수동으로 낮춤 | 확인 없이 즉시 실행 |
| `danger` | ADMIN/안전담당자가 특히 위험한 항목(예: 긴급차단 관련)만 수동으로 올림 | 2단계 확인 + 추가 제약(예: ADMIN 전용) — 세부 규칙은 Do 단계에서 안전담당자와 확정 |

→ 즉 **아무것도 안 건드리면 전부 안전한 쪽(2단계 확인)**으로 시작하고, 안전이 검증된 태그만 사람이 명시적으로 `safe`로 내린다. 2,000개를 전부 사전 분류할 필요 없이 이 기본값만으로 1차 운영이 가능하다.

### 2-2. Import 파이프라인 (설계만, 매핑표 도착 후 구현)

기존 GMS 프로젝트의 `excelImport.js`(Excel→변수 목록 파싱, 이미 검증된 로직)를 **참고**해 이 프로젝트 전용으로 새로 작성:

```
매핑표(Excel/CSV, 심볼↔주소) → Import 스크립트 → Tag 테이블 upsert
  - 신규 태그: risk_level='caution'(쓰기 가능한 경우), source='import'
  - 기존 태그 재import: risk_level 등 사람이 수동 조정한 값은 덮어쓰지 않음(soft-merge)
```

### 예시 태그 (최소 세트, 실제 주소는 TBD)

| name | area_type | data_type | access | risk_level |
|---|---|---|---|---|
| `PLC_RUN_STATUS` | CIO | BOOL | read | safe |
| `PLC_ALARM` | CIO | BOOL | read | safe |
| `START_COMMAND` | CIO | BOOL | write | danger |
| `STOP_COMMAND` | CIO | BOOL | write | danger |
| `SETPOINT_VALUE` | D | INT | read_write | caution |

---

## 3. User / Role

| 필드 | 타입 | 설명 |
|---|---|---|
| `user_id` | string | 내부 식별자 |
| `login_id` | string | 로그인 계정 |
| `name` | string | 사용자 이름 |
| `role` | string | `ADMIN` \| `OPERATOR` \| `VIEWER` (3단계, glossary.md 참고) |
| `status` | string | `active` \| `disabled` |

권한별 Tag 접근 규칙 (risk_level 정책은 §2-1 참고):

| Role | `safe` 태그 | `caution` 태그(기본값) | `danger` 태그 |
|---|---|---|---|
| ADMIN | 읽기/쓰기(확인 없음) | 읽기/쓰기(2단계 확인) | 읽기/쓰기(2단계 확인 + 추가 제약) |
| OPERATOR | 화이트리스트 내 태그만 쓰기(확인 없음), 나머지 읽기 | 화이트리스트 내 태그만 쓰기(2단계 확인), 나머지 읽기 | 접근 불가 |
| VIEWER | 읽기만 | 읽기만 | 읽기만 |

---

## 4. Command

사용자가 Tag에 값을 쓰는 모든 요청을 기록.

| 필드 | 타입 | 설명 |
|---|---|---|
| `command_id` | string | 내부 식별자 |
| `tag_id` | string | 대상 Tag |
| `user_id` | string | 요청자 |
| `value` | any | 쓰려는 값 |
| `requires_confirmation` | bool | `risk_level=danger`이면 true |
| `confirmed_at` | datetime\|null | 2단계 확인 시각 |
| `requested_at` | datetime | 요청 시각 |
| `result` | string | `success` \| `failed` \| `rejected` |

---

## 5. Session

| 필드 | 타입 | 설명 |
|---|---|---|
| `session_id` | string | 내부 식별자 |
| `user_id` | string | 사용자 |
| `client_ip` | string | 접속 클라이언트(모바일/태블릿) IP |
| `login_at` | datetime | 로그인 시각 |
| `logout_at` | datetime\|null | 로그아웃 시각 |

> 동시 접속 제어 정책(예: 동일 계정 중복 로그인 허용 여부)은 설계 단계에서 확정.

---

## 6. AuditLog

모든 로그인/로그아웃/Command 이벤트 기록. 오조작 방지 요구사항의 핵심.

| 필드 | 타입 | 설명 |
|---|---|---|
| `log_id` | string | 내부 식별자 |
| `user_id` | string | 행위자 |
| `action_type` | string | `login` \| `logout` \| `command` |
| `target` | string | 대상 (tag_id 등) |
| `before_value` | any\|null | 변경 전 값 (command인 경우) |
| `after_value` | any\|null | 변경 후 값 |
| `result` | string | `success` \| `failed` \| `rejected` |
| `timestamp` | datetime | 발생 시각 |

---

## 7. Alarm / Status

| 필드 | 타입 | 설명 |
|---|---|---|
| `alarm_id` | string | 내부 식별자 |
| `device_id` | string | 대상 Device |
| `tag_id` | string | 관련 Tag |
| `severity` | string | `info` \| `warning` \| `critical` |
| `triggered_at` | datetime | 발생 시각 |
| `cleared_at` | datetime\|null | 해제 시각 |

---

## 미확정 항목 (다음 단계에서 반드시 확인)

1. **실제 메모리맵** — 영역 코드는 확인됨(D=0x82, CIO=0xB0, W=0xB1, H=0xB2, 비트=워드코드-0x80, `plc-monitoring ver1.0 - google/CLAUDE.md`), 단 "어떤 논리 이름(예: PUMP1_RUN)이 어떤 실제 주소인지"의 구체적 매핑은 아직 미확인 — 기존 `data/variables.json`(있다면) 또는 GMS 관련 문서 확인 필요
2. **위험 Command 목록**: `risk_level=danger`로 분류할 구체적 Tag/Command (현장 안전 담당자 확인 필요)
3. **동시 접속 정책**: 동일 계정/기기 중복 로그인 허용 여부 — 참고: 기존 서버는 UDP/TCP 세션을 여러 개 동시 허용하는 구조(`plcSession.js`)이므로 기술적 제약은 없음, 정책(허용할지 말지)만 결정하면 됨
4. **화이트리스트**: OPERATOR가 쓰기 가능한 caution 태그의 구체 목록
5. ~~TCP/UDP 실기 검증 상태 반영~~ — **해결됨**: 2026-08-26 `tcpFinsClient.js`로 실제 PLC(192.168.0.80) 읽기 전용 연결 테스트 직접 성공(핸드셰이크·CPU정보·W0 읽기). 코드 주석("검증 전") 갱신은 Do 단계에서 처리(QA_LOG Q-017)

---

## 질의 응답 관련

| 질문 내용 | 날짜 | 답변내용 | 왜 그렇게 생각했는지 |
|---|---|---|---|
| 1차 접속 대상 PLC는 몇 대인가? | 2026-08-26 | 1대만 | Device를 단수로 설계, 향후 확장 여지는 테이블 구조로 남겨둠 |
| CJ 시리즈 메모리맵(CIO/D/W 태그 목록)이 문서로 있는가? | 2026-08-26 | 없음 — 최소 태그부터 정의 | 실제 주소 확정 전이므로 예시 태그 세트만 우선 정의, `address` 필드는 TBD로 표시 |
| 사용자 권한을 등급으로 나눌지? | 2026-08-26 | 3단계: 관리자/운영자/조회자 (권장안 채택) | "전면 제어"가 모든 사용자에게 동일 적용되면 오조작 위험이 커서 등급 분리가 안전상 필요 |

---

## 버전 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| 0.1 | 2026-08-26 | 최초 작성 — Device/Tag/User/Role/Command/Session/AuditLog/Alarm 스키마 정의 |
| 0.2 | 2026-08-26 | Tag 규모(2,000+2,000) 및 Import 파이프라인 반영, risk_level 기본값 정책(caution 기본) 확정 |
