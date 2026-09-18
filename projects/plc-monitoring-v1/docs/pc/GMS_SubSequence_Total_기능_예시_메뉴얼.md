# GMS 서브시퀀스 엑셀 — 전체 기능 예시 메뉴얼

> 대상 파일: [`GMS_SubSequence_Total.xlsx`](GMS_SubSequence_Total.xlsx) — 지금까지 만들어진
> 서브시퀀스 16개를 실제 진행 순서대로 시트 16개에 통합한 파일입니다.
>
> 문법을 하나하나 처음부터 설명하는 문서는 [`GMS_SUBSEQUENCE_EXCEL_GUIDE.md`](GMS_SUBSEQUENCE_EXCEL_GUIDE.md)입니다.
> 이 문서는 그 문법이 **실제로 어느 시트, 어느 Step에서 어떻게 쓰였는지 실제 값 그대로** 보여주는
> 예시 중심 문서입니다 - Total 파일을 옆에 열어두고 같이 보면 됩니다.

---

## 1. Total 파일 구성 (시트 16개, 실제 진행 순서)

| # | 시트 이름 | 화면 | Status | 비고 |
|---|---|---|---|---|
| 1 | `AdjustMode_v1` | 압력조정모드(조정모드 A/B) | - | 기준 서식 - 이 문서 예시의 절반 이상이 여기서 나옵니다 |
| 2 | `IdleCheck_v1` | 교환전1P_실린더 잠금 check | IDLE | Status가 아직 안 바뀐 7단계 |
| 3 | `Puls_v1` | Puls_자동진행 | Puls | 잔류가스Check + Pulse Vent |
| 4 | `OneP_v1` | 1P_자동진행 | 1P (1/4) | 1·2차측 Vent Mode |
| 5 | `OneP2_v1` | 1P_2차측Purge_자동진행 | 1P (2/4) | 2차측 Purge |
| 6 | `OneP3_v1` | 1P_Pumping_자동진행 | 1P (3/4) | Pumping - `CAPTURE` 최초 사용처 |
| 7 | `OneP4_v1` | 1P_1차측Purge_자동진행 | 1P (4/4) | 1차측 Purge - 반복문 기준 시트 |
| 8 | `ExchL_v1` | 교환전-L_감압시험 | -L | `CAPTURE` + 분단위 반복 2단계 |
| 9 | `TwoP_v1` | 교환전2P_2차 배관청소 | 2P | OneP4 구조 복제 |
| 10 | `VtTest_v1` | 교환전-VT_VT 감압시험 | -VT | `CAPOFFSET` 누출시험 |
| 11 | `CylReplace_v1` | 용기교체CC(6화면) | CC | **예외 구조** - 밸브 순차 개폐(`O+n`/`C+n`) |
| 12 | `AfterThreeP_v1` | 교환후3P_배관청소 | 3P | TwoP 구조 복제 |
| 13 | `AfterPlusL_v1` | 교환후+L_가압시험 | +L | OPTION 분기 예시 다수 |
| 14 | `AfterVtTest_v1` | 교환후-VT_VT감압시험 | -VT | VtTest와 동일 로직 |
| 15 | `AfterFourP_v1` | 교환후4P_배관청소 | 4P | TwoP 구조 복제 |
| 16 | `Bypass_v1` | 시퀀스_Bypass | Bypass | OPTION 분기 예시 |

(미연결 파일 `Puls_Mode_v1`은 어느 화면도 참조하지 않아 Total 파일에는 포함하지 않았습니다.)

---

## 2. 화면 전환 열 — 예시

### 2-1. `S/No.`가 문자열인 경우 (중간에 끼워넣기)

`ExchL_v1`의 `6A`, `7A`처럼 숫자가 아닌 번호를 쓰면 기존 Step 사이에 새 Step을 끼워 넣을 수
있습니다(뒤 번호를 전부 밀어 올리지 않아도 됨).

### 2-2. `진행방식`(확인 vs 자동)

| 예시 | Step | 진행방식 | 의미 |
|---|---|---|---|
| `CylReplace_v1` | 1 | `확인` | 사람이 "확인" 버튼을 눌러야 다음으로 |
| `ExchL_v1` | 2 | `자동` | `Time (Sec)`만큼 대기 후 자동으로 다음으로 |

### 2-3. `Next Step` / `Ack Goto` / `Alarm Goto` 조합

`AdjustMode_v1` Step **"7A"** (Option 켜짐/꺼짐에 따라 다른 곳으로):

| S/No. | Next Step | Alarm Goto | Alarm Monitoring | 비교연산자 | 설정명(비교대상ID) |
|---|---|---|---|---|---|
| 7A | 14 | 8 | 조정모드시퀀스1 | ON | - |

→ "조정모드 시퀀스 1"이 **적용(ON, 참)**이면 Step 14로, **미적용(OFF, 거짓)**이면 Step 8로
(밸브·상태 유지한 채 가볍게 이동, 알람 아님).

`AdjustMode_v1` Step **"23"** (N회 반복 - Step 2로 되돌아가는 루프):

| S/No. | Next Step | Alarm Goto | Alarm Monitoring | 비교연산자 | 설정명(비교대상ID) |
|---|---|---|---|---|---|
| 23 | 24 | 2 | 진행횟수 | >= | 설정횟수 |

→ 반복 완료(진행횟수 >= CONFIG "설정횟수")면 Step 24로, 아직 부족하면 Step 2로 되돌아가며
진행횟수가 1 증가(`OneP4_v1` Step 2가 이 반복문의 진입점 - Step 2 Remarks 참고).

---

## 3. 밸브 열 — 예시

### 3-1. 기본 `O`/`C`

`OneP4_v1` Step 2: `PNV: O` (Open) → 이후 반복문이 끝나면 다른 Step에서 `PNV: C`로 닫습니다.

### 3-2. `{side}` 템플릿

`ExchL_v1` Step 3: `HPV_{side}: O` → A측 실행이면 `HPV_A`, B측이면 `HPV_B`가 자동으로 열립니다.
같은 한 줄로 양쪽 측에 그대로 씁니다.

### 3-3. 용기교체(CC) 전용 — 순차 개폐 `O+n`/`C+n`

`CylReplace_v1` Step 2("Valve Open 확인"):

| PIV | PGI_{side} | PGII_{side} | HPIV |
|---|---|---|---|
| `O` | `O+4` | `O+2` | `C` |

→ 화면 진입 즉시 PIV Open, 2초 뒤 PGII Open, 4초 뒤 PGI Open(HPIV는 즉시 Close 유지) - SVG
배관도 밸브 아이콘이 실시간으로 순서대로 바뀝니다. Step 6("Auto Guard Close 확인")도 같은
문법으로 역순(Close) 처리됩니다. 이 문법은 `CylReplace_v1`에서만 쓰입니다(10장 참고).

---

## 4. 조건식(Alarm Monitoring / 비교연산자 / 설정명) — 기능별 실제 예시

### 4-1. 기본형 (단일 조건)

`ExchL_v1` Step 3: `HPT_{side} <= 진공하한치_{side}` (알람: "배관 라인 불량")

### 4-2. 다중 조건 AND (`&`로 구분, 5중 조건)

`AdjustMode_v1` Step 7:

```
Alarm Monitoring: VPT & LPT_{side} & HPT_{side} & NPT_{side} & MPT_{side}
비교연산자:        <= & <= & <= & <= & <=
설정명(비교대상ID): 진공하한치_{side} & 진공하한치_{side} & 진공하한치_{side} & 진공하한치_{side} & 진공하한치_{side}
```
→ 5개 PT 전부 진공하한치 이하여야 정상. 하나라도 벗어나면 그 즉시 거짓(Alarm Seq. 1 발동).

### 4-3. 옵션 마커 `?` (일부 항목만 선택적으로 건너뛰기)

`AdjustMode_v1` Step 37:

```
Alarm Monitoring: NPT_{side}:OFFSET & HPT_{side}:OFFSET & MPT_{side}:OFFSET & LPT_{side}:OFFSET & VPT:OFFSET
비교연산자:        <= & <= & <=? & <= & <=
설정명(비교대상ID): NPT_{side}:MAX3% & HPT_{side}:MAX3% & MPT_{side}:MAX3% & LPT_{side}:MAX3% & VPT:MAX3%
```
→ `MPT_{side}` 항목만 `<=?`(옵션)이라, 이 센서 값이 아직 안 들어와도 나머지 4개만으로 판정을
계속합니다.

### 4-4. BIT ON/OFF (OPTION 스위치 분기)

`Bypass_v1` Step 25:

| Alarm Monitoring | 비교연산자 | 설정명(비교대상ID) | Next Step | Alarm Goto |
|---|---|---|---|---|
| `고압HELeakCheck` | `OFF` | `-` | 26 | 28 |

→ OPTION 탭 "고압 HE Leak check 라인 유무"가 **미적용(OFF, 조건 참)**이면 Step 26(PNBV→PIV
순서 그대로)으로, **적용(ON, 조건 거짓)**이면 Step 28(HPIV부터, 이미 확인된 구간 건너뜀)로 -
`Alarm Goto`가 채워져 있어 알람이 아니라 단순 분기입니다. 대상 칸(`설정명`)은 값을 안 쓰지만
`&` 개수를 맞추려고 `-`를 채워둔 관례입니다.

같은 패턴이 `AfterPlusL_v1`에도 두 번 나옵니다:

| 파일 | Step | Alarm Monitoring | Next Step(미적용 시) | Alarm Goto(적용 시) |
|---|---|---|---|---|
| `AfterPlusL_v1` | 2 | `Bypass사용` | 3 | 6B |
| `AfterPlusL_v1` | 15 | `가압시험후PulsVent` | 30(완료) | 17(Puls Vent 미니시퀀스) |

### 4-5. 예약 태그 `진행횟수` (반복문 종료 판정)

2-3절의 Step 23 예시 참고.

### 4-6. 예약 태그 `ZERO` (압력조정 표 자동 0점 조정)

`AdjustMode_v1` Step 36:

```
Alarm Monitoring: NPT_{side} & HPT_{side} & MPT_{side} & LPT_{side} & VPT
비교연산자:        ZERO & ZERO & ZERO & ZERO & ZERO
Message: PT 값을 대기압에 맞춰 Offset을 자동으로 반영하고 있습니다.
```
→ 조건 판정이 아니라 **그 순간 실행되는 액션**입니다 - 각 태그의 압력조정 표 현재값이 정확히
0이 되도록 offset을 즉시 재계산합니다. 바로 다음 Step 37(4-3절 예시)이 `:OFFSET` 조건으로
같은 태그들을 확인하는데, 이때 방금 반영된 새 offset이 곧바로 적용됩니다 - 두 Step이 한 쌍으로
"0점 조정 → 확인" 흐름을 이룹니다.

### 4-7. `CAPTURE:<태그>` (Cycle 열) — 초기값 캡처 + 실시간 안전감시

`ExchL_v1` Step 6:

```
Cycle: CAPTURE:HPT_{side} (또는 Bypass_v1 Step 19: CAPTURE:NPT_{side})
Time (Sec): 60
Alarm Monitoring: HPT_{side} (또는 NPT_{side})   비교연산자: <=   설정명(비교대상ID): 진공하한치_{side}
Message: PT 안정화 시간중 (또는 NPT 진공유지 확인중)
```
→ 이 Step에 처음 도달한 순간 `NPT_{side}` (또는 `HPT_{side}`) 값을 화면 "초기값"란에 한 번 저장하고, "현재값"란은
계속 실시간 갱신되어 압력 변화량을 확인할 수 있습니다. 안전조건은 60초 타이머를 기다리지 않고 PT 값이 들어올 때마다(약 1초
주기) 바로 검사합니다. 바로 다음 Step **19A**가 `진행횟수 >= Bypass 진공유지 확인시간[분]`을 판정해서,
아직 부족하면 `Alarm Goto: 19`로 Step 19에 되돌아가 60초씩 반복합니다.

### 4-8. `<태그>:OFFSET` — 압력조정 표 현재값 기준 비교

4-3절 Step 37 예시가 그대로 이 문법입니다. `NPT_{side}:MAX3%`처럼 비교대상에 `:MAX<n>%`를 쓰면
그 태그의 압력조정 표 Max값 × n%를 목표값으로 씁니다.

### 4-9. `<태그>:CAPOFFSET` — 이번 실행에서 캡처한 초기값 기준 비교

`VtTest_v1`의 3단계(VT 점검·누출시험), Step 21 → 22 → 23:

| Step | Cycle | Time(Sec) | Alarm Monitoring | 비교연산자 | 설정명(비교대상ID) |
|---|---|---|---|---|---|
| 21 | `CAPTURE:VT_{side}` | 2 | - | - | - |
| 22 | - | 60(반복) | `진행횟수` | `>=` | `VT 점검 시간_{side}` |
| 23 | - | 2 | `VT_{side}:CAPOFFSET` | `<` | `VT 누출 압력 변동 기준_{side}` |

→ Step 21에서 `VT_{side}` 초기값을 캡처 → Step 22에서 "VT 점검 시간"만큼 시간이 찰 때까지
반복 대기(4-5절과 같은 진행횟수 패턴) → Step 23에서 **"초기값 + CONFIG 값"을 목표로 지금 값과
비교**(`<`면 정상=누출 없음). `:OFFSET`(압력조정 표 기준)의 자매 문법이지만, 여기선 "이번
실행에서 방금 캡처한 값"이 기준이라는 점이 다릅니다. `설정명(비교대상ID)` 앞에 `-`를 붙이면
반대 방향(초기값 − CONFIG 값)도 만들 수 있습니다(가압시험 FAIL 판정용).

---

## 5. Alarm Seq. / Remarks — 예시

| 값 | 의미 | 예시 |
|---|---|---|
| `1` | 초기화(밸브 전체 CLOSE 후 처음부터) | `ExchL_v1` Step 6, 7 (감압 시험 fail) |
| (비어있음, `Alarm Goto`만 있음) | 알람 아님, 가벼운 이동 | `Bypass_v1` Step 25 (4-4절) |

`Remarks` 열은 이 문서의 모든 예시 Step에서 실제로 "이 조건식이 뭘 하는지"를 설명하는 용도로
쓰이고 있습니다 - 복잡한 조건식을 쓸 때는 항상 Remarks에 근거를 남기는 걸 권장합니다(위 예시들
전부 그렇게 돼 있습니다).

---

## 6. 예외: 용기교체(CC, `CylReplace_v1`) — 다른 시트와 구조가 다름

이 시트만 화면 6개(실린더 확인 ~ Auto Guard Close 확인) 전체가 진입화면 하나에 있는 이
데이터로 규정됩니다(다른 시트는 화면 1개 = 시트 1개). 타이머로 자동 진행하지 않고 "확인" 버튼
클릭으로 화면이 넘어가므로 `Time (Sec)`/`Next Step`/`Alarm Goto`는 채워져 있어도 실제로 안
쓰입니다 - 대신 밸브 열의 `O+n`/`C+n`(3-3절)이 화면 진입 후 n초 뒤 순차 개폐를 담당합니다.
자세한 구조는 `docs/GMS_AUTO_SEQUENCE_HANDOFF.md` 11.6절을 참고하세요.

---

## 7. 참고 문서

- 문법 세부 규칙 전부: [`GMS_SUBSEQUENCE_EXCEL_GUIDE.md`](GMS_SUBSEQUENCE_EXCEL_GUIDE.md)
- 화면·엔진 아키텍처: [`GMS_AUTO_SEQUENCE_HANDOFF.md`](GMS_AUTO_SEQUENCE_HANDOFF.md)
- 자동 백업 폴더(`data/gmsSubSequenceBackups/`) 동작 방식: `GMS_SUBSEQUENCE_EXCEL_GUIDE.md` 11장
