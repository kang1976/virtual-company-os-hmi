import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import openpyxl

target_file = 'GMS_자동진행_시퀀스_표준템플릿_v4.xlsx'
wb = openpyxl.load_workbook(target_file)

# Perfectly tuned clean Mermaid code for all 7 sheets
# 1. Starts directly with flowchart TD (no ```, no %%{init: ...})
# 2. Text formatted with clean 1~2 lines and <br/> to prevent word splitting
# 3. Arrow transitions with crisp, beautiful syntax

codes = {
    ('예제1_단순개폐', 12, 13): """flowchart TD
    classDef startNode fill:#1e40af,stroke:#1e3a8a,color:#fff,font-weight:bold
    classDef procNode fill:#eff6ff,stroke:#3b82f6,color:#1e3a8a,font-weight:bold
    classDef passNode fill:#d1fae5,stroke:#10b981,color:#047857,font-weight:bold

    Start(["[공정 시작] 예제1_단순개폐"]):::startNode
    S1["[Step 1] 전 밸브 안전 Close (5초)<br/>• VN1=C, VN2=C, PNV=C, HPV=C"]:::procNode
    S2["[Step 2] 질소 가스 공급 개방 (30초)<br/>• VN1=O, PNV=O (상태유지)"]:::procNode
    S3["[Step 3] 질소 차단 및 대기 (10초)<br/>• VN1=C, PNV=C 안정화 대기"]:::procNode
    EndNode(["[공정 완료] 정상 종료"]):::passNode

    Start --> S1
    S1 -->|5초 카운트다운 완료| S2
    S2 -->|30초 카운트다운 완료| S3
    S3 -->|10초 카운트다운 완료| EndNode""",

    ('예제2_조기통과', 12, 13): """flowchart TD
    classDef startNode fill:#1e40af,stroke:#1e3a8a,color:#fff,font-weight:bold
    classDef procNode fill:#eff6ff,stroke:#3b82f6,color:#1e3a8a,font-weight:bold
    classDef condNode fill:#fef3c7,stroke:#f59e0b,color:#b45309,font-weight:bold
    classDef passNode fill:#d1fae5,stroke:#10b981,color:#047857,font-weight:bold
    classDef alarmNode fill:#fee2e2,stroke:#ef4444,color:#b91c1c,font-weight:bold

    Start(["[공정 시작] 예제2_조기통과"]):::startNode
    S1["[Step 1] 진공 배기 준비 (10초)<br/>• 전 밸브 Close"]:::procNode
    S2{"[Step 2] 진공 배기 및 압력 감시 (120초)<br/>• 조건: VPT <= 0.5 Torr 도달 시 조기통과"}:::condNode
    S3["[Step 3] 목표 도달 확인 및 완료 (5초)"]:::procNode
    S99["[Step 99] 120초 시간초과 알람 발생 (Alarm Seq 1)"]:::alarmNode
    EndNode(["[공정 완료] 정상 종료"]):::passNode

    Start --> S1
    S1 --> S2
    S2 -- "VPT <= 0.5 Torr 도달<br/>(조기 통과)" --> S3
    S2 -- "120초 시간초과 미도달<br/>(알람 이동)" --> S99
    S3 --> EndNode""",

    ('예제3_수동확인', 12, 13): """flowchart TD
    classDef startNode fill:#1e40af,stroke:#1e3a8a,color:#fff,font-weight:bold
    classDef procNode fill:#eff6ff,stroke:#3b82f6,color:#1e3a8a,font-weight:bold
    classDef ackNode fill:#fef3c7,stroke:#f59e0b,color:#b45309,font-weight:bold
    classDef passNode fill:#d1fae5,stroke:#10b981,color:#047857,font-weight:bold

    Start(["[공정 시작] 예제3_수동확인"]):::startNode
    S1["[Step 1] 시험 압력 가압 진행 (20초)<br/>• VN1=O, PNV=O (가스 주입)"]:::procNode
    S2{"[Step 2] 작업자 육안 확인 대기<br/>• 진행방식 = 확인 (ACK)<br/>• 화면 [확인] 클릭 시까지 무한 대기"}:::ackNode
    S3["[Step 3] 가압 해제 및 배기 (10초)<br/>• HPV=O (배기 밸브 Open)"]:::procNode
    EndNode(["[공정 완료] 정상 종료"]):::passNode

    Start --> S1
    S1 -->|20초 가압 완료| S2
    S2 -- "작업자가 HMI 화면의<br/>[확인(ACK)] 버튼 클릭" --> S3
    S3 -->|10초 배기 완료| EndNode""",

    ('예제4_지연개폐', 11, 13): """flowchart TD
    classDef startNode fill:#1e40af,stroke:#1e3a8a,color:#fff,font-weight:bold
    classDef procNode fill:#eff6ff,stroke:#3b82f6,color:#1e3a8a,font-weight:bold
    classDef passNode fill:#d1fae5,stroke:#10b981,color:#047857,font-weight:bold

    Start(["[공정 시작] 예제4_지연개폐"]):::startNode
    subgraph Step1 ["Step 1: 충격 방지 순차 지연 개방 (15초)"]
        T0["T+0초: VN2 즉시 Open"] --> T2["T+2초: LPV 지연 Open"]
        T2 --> T4["T+4초: HPIV 지연 Open"]
    end
    subgraph Step2 ["Step 2: 순차 지연 닫힘 제어 (10초)"]
        C0["T+0초: VN2 즉시 Close"] --> C2["T+2초: LPV 지연 Close"]
        C2 --> C3["T+3초: HPIV 지연 Close"]
    end
    EndNode(["[공정 완료] 정상 종료"]):::passNode

    Start --> Step1
    Step1 -->|15초 완료| Step2
    Step2 -->|10초 완료| EndNode""",

    ('예제5_반복루프', 13, 13): """flowchart TD
    classDef startNode fill:#1e40af,stroke:#1e3a8a,color:#fff,font-weight:bold
    classDef procNode fill:#eff6ff,stroke:#3b82f6,color:#1e3a8a,font-weight:bold
    classDef condNode fill:#fef3c7,stroke:#f59e0b,color:#b45309,font-weight:bold
    classDef passNode fill:#d1fae5,stroke:#10b981,color:#047857,font-weight:bold

    Start(["[공정 시작] 예제5_반복루프"]):::startNode
    S1["[Step 1] 루프 준비 - 전 밸브 Close (5초)"]:::procNode
    S2["[Step 2] 퍼지 가스 가압 (10초)<br/>• VN1=O, PNV=O (루프 시작점)"]:::procNode
    S3{"[Step 3] 배기 진행 (15초)<br/>• 판정: 진행횟수 >= 3회?"}:::condNode
    S4["[Step 4] 3회 반복 완료 및 정상 종료 (5초)<br/>• 전 밸브 Close"]:::procNode
    EndNode(["[공정 완료] 정상 종료"]):::passNode

    Start --> S1
    S1 --> S2
    S2 --> S3
    S3 -- "아직 1~2회차<br/>[Step 2 로 루프백]" --> S2
    S3 -- "목표 3회 완료<br/>[Step 4 로 탈출]" --> S4
    S4 --> EndNode""",

    ('예제6_누출시험', 14, 13): """flowchart TD
    classDef startNode fill:#1e40af,stroke:#1e3a8a,color:#fff,font-weight:bold
    classDef procNode fill:#eff6ff,stroke:#3b82f6,color:#1e3a8a,font-weight:bold
    classDef condNode fill:#fef3c7,stroke:#f59e0b,color:#b45309,font-weight:bold
    classDef passNode fill:#d1fae5,stroke:#10b981,color:#047857,font-weight:bold
    classDef alarmNode fill:#fee2e2,stroke:#ef4444,color:#b91c1c,font-weight:bold

    Start(["[공정 시작] 예제6_누출시험"]):::startNode
    S1["[Step 1] 배관 시험 진공 배기 (30초)<br/>• HPV=O, PNV=O"]:::procNode
    S2["[Step 2] 배관 밀폐 및 압력 캡처 (5초)<br/>• 전 밸브 Close, 초기압력 저장"]:::procNode
    S3{"[Step 3] 정밀 누출 감시 (60초)<br/>• 감시: VPT 변동량 <= 0.05 Torr"}:::condNode
    S4["[Step 4] 누출 시험 합격 완료 (5초)"]:::procNode
    S99["[Step 99] 비상 경보 및 정지 (Alarm Seq 1)<br/>• 허용치 초과 누출 발생!"]:::alarmNode
    EndNode(["[공정 완료] 정상 종료"]):::passNode

    Start --> S1
    S1 --> S2
    S2 --> S3
    S3 -- "압력변동 <= 0.05 Torr<br/>(누출 없음 / 합격)" --> S4
    S3 -- "압력변동 > 0.05 Torr<br/>(누출 발생 / 알람)" --> S99
    S4 --> EndNode""",

    ('Bypass_v1', 18, 13): """flowchart TD
    classDef startNode fill:#1e40af,stroke:#1e3a8a,color:#fff,font-weight:bold
    classDef procNode fill:#eff6ff,stroke:#3b82f6,color:#1e3a8a,font-weight:bold
    classDef condNode fill:#fef3c7,stroke:#f59e0b,color:#b45309,font-weight:bold
    classDef passNode fill:#d1fae5,stroke:#10b981,color:#047857,font-weight:bold
    classDef alarmNode fill:#fee2e2,stroke:#ef4444,color:#b91c1c,font-weight:bold

    Start(["[공정 시작] Bypass_v1 종합 실전"]):::startNode
    S1["[Step 1] 전 밸브 안전 초기화 (5초)"]:::procNode
    S2["[Step 2] 1차 질소 공급 및 퍼지 (20초)<br/>• VN1=O, PNV=O"]:::procNode
    S3{"[Step 3] 2차 진공 배기 (120초)<br/>• VPT <= 0.5 Torr 시 조기통과"}:::condNode
    S4{"[Step 4] 작업자 육안 확인<br/>• 진행방식 = 확인 (ACK)"}:::condNode
    S5["[Step 5] 순차 지연 개방 (15초)<br/>• VN2(0s) ➔ LPV(2s) ➔ HPIV(4s)"]:::procNode
    S6["[Step 6] 3회 반복 퍼지 가압 (10초)<br/>• VN1=O, PNV=O (루프 시작점)"]:::procNode
    S7{"[Step 7] 배기 및 3회 반복 판정 (15초)<br/>• 판정: 진행횟수 >= 3회?"}:::condNode
    S8["[Step 8] 전 밸브 Close 및 완료 (5초)"]:::procNode
    S99["[Step 99] 비상 알람 조치 (Alarm Seq 1)"]:::alarmNode
    EndNode(["[Bypass 전 공정 정상 완료]"]):::passNode

    Start --> S1
    S1 --> S2
    S2 --> S3
    S3 -- "0.5 Torr 도달<br/>(조기 통과)" --> S4
    S3 -- "120초 미도달<br/>(알람 이동)" --> S99
    S4 -- "작업자 [확인] 클릭" --> S5
    S5 --> S6
    S6 --> S7
    S7 -- "1~2회차<br/>[Step 6 루프백]" --> S6
    S7 -- "3회 완료<br/>[Step 8 탈출]" --> S8
    S8 --> EndNode"""
}

# Update all sheets
for (sheet_name, r, c), mermaid_text in codes.items():
    ws = wb[sheet_name]
    ws.cell(row=r, column=c).value = mermaid_text
    print(f'Successfully updated [{sheet_name}] at R{r}C{c}')

wb.save(target_file)
print(f'ALL 7 SHEETS PERFECTLY SAVED TO {target_file}!')
