# 교환전 -L (감압시험) — ExchL_v1 플로우차트

`data/gmsSubSequences/ExchL_v1.json` 기준, 실제 Step/조건/알람 그대로 반영.
VS Code 등 Mermaid를 지원하는 마크다운 미리보기에서 도표로 렌더링된다.

```mermaid
flowchart TD
    S1["Step1<br/>감압시험 Mode 시작<br/><i>교환전 감압 시험을 시작합니다</i>"]
    S2["Step2<br/>PNV Open<br/><i>Pump 배관 진공 Check</i>"]
    S2A{"VPT ≤ 진공하한치_side ?"}
    S2F(["🛑 Alarm Seq.1<br/>진공 불량(VPT)"])
    S3["Step3<br/>HPV_side Open"]
    S3A{"HPT_side ≤ 진공하한치_side ?"}
    S3F(["🛑 Alarm Seq.1<br/>배관 라인 불량"])
    S4["Step4<br/>HPV_side Close"]
    S5["Step5<br/>PNV Close"]
    S6["Step6<br/>CAPTURE:HPT_side<br/>60초 대기(PT 안정화 시간중)"]
    S6RT{"실시간 감시<br/>HPT_side ≤ 진공하한치_side ?"}
    S6F(["🛑 Alarm Seq.1<br/>감압 시험 fail"])
    S6A{"진행횟수 ≥<br/>감압 안정화 시간[분] ?"}
    S7["Step7<br/>CAPTURE:HPT_side<br/>60초 대기(감압 시험중)"]
    S7RT{"실시간 감시<br/>HPT_side ≤ 진공하한치_side ?"}
    S7F(["🛑 Alarm Seq.1<br/>감압 시험 fail"])
    S7A{"진행횟수 ≥<br/>감압 시간[분] ?"}
    S8(["Step8 완료<br/>감압시험 Sequence Complete"])

    S1 --> S2 --> S2A
    S2A -- 정상 --> S3
    S2A -- 이상 --> S2F
    S3 --> S3A
    S3A -- 정상 --> S4
    S3A -- 이상 --> S3F
    S4 --> S5 --> S6
    S6 -.매초 실시간.-> S6RT
    S6RT -- 이상 --> S6F
    S6 --> S6A
    S6A -- No(부족) --> S6
    S6A -- Yes --> S7
    S7 -.매초 실시간.-> S7RT
    S7RT -- 이상 --> S7F
    S7 --> S7A
    S7A -- No(부족) --> S7
    S7A -- Yes --> S8

    classDef alarmNode fill:#f8d7da,stroke:#c0392b,color:#7b241c;
    class S2F,S3F,S6F,S7F alarmNode;
    classDef decisionNode fill:#eaf2f8,stroke:#2874a6;
    class S2A,S3A,S6RT,S6A,S7RT,S7A decisionNode;
```

## 구간 요약

| 구간 | Step | 내용 |
|---|---|---|
| 진공 확인 | 1~2 | PNV Open, Pump 배관 진공(VPT) 확인 |
| 배관 라인 확인 | 3~5 | HPV_side Open→Close, PNV Close |
| 감압 안정화 | 6~6A | 60초씩 반복 + 실시간 안전감시, "감압 안정화 시간[분]"(CONFIG) 채울 때까지 |
| 감압 시험 | 7~7A | 60초씩 반복 + 실시간 안전감시, "감압 시간[분]"(CONFIG) 채울 때까지 |
| 완료 | 8 | 감압시험 Sequence Complete |

같은 60초 대기+실시간 감시+분단위 판정 패턴이 Pumping(OneP3)과 동일하게 재사용되고 있고,
6/6A와 7/7A 두 구간 모두 각자 독립적으로 "진행횟수"를 0부터 다시 센다(엔진이 Step 번호가
바뀔 때 자동 리셋 - `gms-sub-sequence-runner.js`의 `cycleCheckStepIndex` 처리).
