import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import openpyxl

target_file = 'GMS_자동진행_시퀀스_표준템플릿_v4.xlsx'
wb = openpyxl.load_workbook(target_file)

# Perfectly wide-formatted Mermaid codes for all 7 sheets
# Using <span style='white-space:nowrap'> so text NEVER wraps or breaks words, and boxes expand wide!

codes = {
    ('예제1_단순개폐', 12, 13): """flowchart TD
    classDef startNode fill:#1e40af,stroke:#1e3a8a,color:#fff,font-weight:bold
    classDef procNode fill:#eff6ff,stroke:#3b82f6,color:#1e3a8a,font-weight:bold
    classDef passNode fill:#d1fae5,stroke:#10b981,color:#047857,font-weight:bold

    Start(["<span style='white-space:nowrap'>[공정 시작] 예제1_단순개폐</span>"]):::startNode
    S1["<span style='white-space:nowrap'>[Step 1] 전 밸브 안전 Close (5초)</span><br/><span style='white-space:nowrap'>• VN1=C, VN2=C, PNV=C, HPV=C</span>"]:::procNode
    S2["<span style='white-space:nowrap'>[Step 2] 질소 가스 공급 개방 (30초)</span><br/><span style='white-space:nowrap'>• VN1=O, PNV=O (나머지 밸브 상태유지)</span>"]:::procNode
    S3["<span style='white-space:nowrap'>[Step 3] 질소 차단 및 대기 (10초)</span><br/><span style='white-space:nowrap'>• VN1=C, PNV=C 닫고 안정화 대기</span>"]:::procNode
    EndNode(["<span style='white-space:nowrap'>[공정 완료] 정상 종료</span>"]):::passNode

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

    Start(["<span style='white-space:nowrap'>[공정 시작] 예제2_조기통과</span>"]):::startNode
    S1["<span style='white-space:nowrap'>[Step 1] 진공 배기 준비 (10초)</span><br/><span style='white-space:nowrap'>• 전 밸브 Close</span>"]:::procNode
    S2{"<span style='white-space:nowrap'>[Step 2] 진공 배기 및 압력 감시 (120초)</span><br/><span style='white-space:nowrap'>• 조건: VPT <= 0.5 Torr 도달 시 조기통과</span>"}:::condNode
    S3["<span style='white-space:nowrap'>[Step 3] 목표 도달 확인 및 완료 (5초)</span>"]:::procNode
    S99["<span style='white-space:nowrap'>[Step 99] 120초 시간초과 알람 발생 (Alarm Seq 1)</span>"]:::alarmNode
    EndNode(["<span style='white-space:nowrap'>[공정 완료] 정상 종료</span>"]):::passNode

    Start --> S1
    S1 --> S2
    S2 -- "<span style='white-space:nowrap'>VPT <= 0.5 Torr 도달</span><br/><span style='white-space:nowrap'>(조기 통과)</span>" --> S3
    S2 -- "<span style='white-space:nowrap'>120초 시간초과 미도달</span><br/><span style='white-space:nowrap'>(알람 이동)</span>" --> S99
    S3 --> EndNode""",

    ('예제3_수동확인', 12, 13): """flowchart TD
    classDef startNode fill:#1e40af,stroke:#1e3a8a,color:#fff,font-weight:bold
    classDef procNode fill:#eff6ff,stroke:#3b82f6,color:#1e3a8a,font-weight:bold
    classDef ackNode fill:#fef3c7,stroke:#f59e0b,color:#b45309,font-weight:bold
    classDef passNode fill:#d1fae5,stroke:#10b981,color:#047857,font-weight:bold

    Start(["<span style='white-space:nowrap'>[공정 시작] 예제3_수동확인</span>"]):::startNode
    S1["<span style='white-space:nowrap'>[Step 1] 시험 압력 가압 진행 (20초)</span><br/><span style='white-space:nowrap'>• VN1=O, PNV=O (가스 주입)</span>"]:::procNode
    S2{"<span style='white-space:nowrap'>[Step 2] 작업자 육안 확인 대기</span><br/><span style='white-space:nowrap'>• 진행방식 = 확인 (ACK)</span><br/><span style='white-space:nowrap'>• 화면 [확인] 클릭 시까지 무한 대기</span>"}:::ackNode
    S3["<span style='white-space:nowrap'>[Step 3] 가압 해제 및 배기 (10초)</span><br/><span style='white-space:nowrap'>• HPV=O (배기 밸브 Open)</span>"]:::procNode
    EndNode(["<span style='white-space:nowrap'>[공정 완료] 정상 종료</span>"]):::passNode

    Start --> S1
    S1 -->|20초 가압 완료| S2
    S2 -- "<span style='white-space:nowrap'>작업자가 HMI 화면의</span><br/><span style='white-space:nowrap'>[확인(ACK)] 버튼 클릭</span>" --> S3
    S3 -->|10초 배기 완료| EndNode""",

    ('예제4_지연개폐', 11, 13): """flowchart TD
    classDef startNode fill:#1e40af,stroke:#1e3a8a,color:#fff,font-weight:bold
    classDef procNode fill:#eff6ff,stroke:#3b82f6,color:#1e3a8a,font-weight:bold
    classDef passNode fill:#d1fae5,stroke:#10b981,color:#047857,font-weight:bold

    Start(["<span style='white-space:nowrap'>[공정 시작] 예제4_지연개폐</span>"]):::startNode
    subgraph Step1 ["<span style='white-space:nowrap'>Step 1: 충격 방지 순차 지연 개방 (총 15초)</span>"]
        T0["<span style='white-space:nowrap'>T+0초: VN2 즉시 Open</span>"] --> T2["<span style='white-space:nowrap'>T+2초: LPV 지연 Open</span>"]
        T2 --> T4["<span style='white-space:nowrap'>T+4초: HPIV 지연 Open</span>"]
    end
    subgraph Step2 ["<span style='white-space:nowrap'>Step 2: 순차 지연 닫힘 제어 (총 10초)</span>"]
        C0["<span style='white-space:nowrap'>T+0초: VN2 즉시 Close</span>"] --> C2["<span style='white-space:nowrap'>T+2초: LPV 지연 Close</span>"]
        C2 --> C3["<span style='white-space:nowrap'>T+3초: HPIV 지연 Close</span>"]
    end
    EndNode(["<span style='white-space:nowrap'>[공정 완료] 정상 종료</span>"]):::passNode

    Start --> Step1
    Step1 -->|15초 완료| Step2
    Step2 -->|10초 완료| EndNode""",

    ('예제5_반복루프', 13, 13): """flowchart TD
    classDef startNode fill:#1e40af,stroke:#1e3a8a,color:#fff,font-weight:bold
    classDef procNode fill:#eff6ff,stroke:#3b82f6,color:#1e3a8a,font-weight:bold
    classDef condNode fill:#fef3c7,stroke:#f59e0b,color:#b45309,font-weight:bold
    classDef passNode fill:#d1fae5,stroke:#10b981,color:#047857,font-weight:bold

    Start(["<span style='white-space:nowrap'>[공정 시작] 예제5_반복루프</span>"]):::startNode
    S1["<span style='white-space:nowrap'>[Step 1] 루프 준비 - 전 밸브 Close (5초)</span>"]:::procNode
    S2["<span style='white-space:nowrap'>[Step 2] 퍼지 가스 가압 (10초)</span><br/><span style='white-space:nowrap'>• VN1=O, PNV=O (루프 시작점)</span>"]:::procNode
    S3{"<span style='white-space:nowrap'>[Step 3] 배기 진행 (15초)</span><br/><span style='white-space:nowrap'>• 판정: 진행횟수 >= 3회?</span>"}:::condNode
    S4["<span style='white-space:nowrap'>[Step 4] 3회 반복 완료 및 정상 종료 (5초)</span><br/><span style='white-space:nowrap'>• 전 밸브 Close</span>"]:::procNode
    EndNode(["<span style='white-space:nowrap'>[공정 완료] 정상 종료</span>"]):::passNode

    Start --> S1
    S1 --> S2
    S2 --> S3
    S3 -- "<span style='white-space:nowrap'>아직 1~2회차</span><br/><span style='white-space:nowrap'>[Step 2 로 루프백]</span>" --> S2
    S3 -- "<span style='white-space:nowrap'>목표 3회 완료</span><br/><span style='white-space:nowrap'>[Step 4 로 탈출]</span>" --> S4
    S4 --> EndNode""",

    ('예제6_누출시험', 14, 13): """flowchart TD
    classDef startNode fill:#1e40af,stroke:#1e3a8a,color:#fff,font-weight:bold
    classDef procNode fill:#eff6ff,stroke:#3b82f6,color:#1e3a8a,font-weight:bold
    classDef condNode fill:#fef3c7,stroke:#f59e0b,color:#b45309,font-weight:bold
    classDef passNode fill:#d1fae5,stroke:#10b981,color:#047857,font-weight:bold
    classDef alarmNode fill:#fee2e2,stroke:#ef4444,color:#b91c1c,font-weight:bold

    Start(["<span style='white-space:nowrap'>[공정 시작] 예제6_누출시험</span>"]):::startNode
    S1["<span style='white-space:nowrap'>[Step 1] 배관 시험 진공 배기 (30초)</span><br/><span style='white-space:nowrap'>• HPV=O, PNV=O</span>"]:::procNode
    S2["<span style='white-space:nowrap'>[Step 2] 배관 밀폐 및 압력 캡처 (5초)</span><br/><span style='white-space:nowrap'>• 전 밸브 Close, 초기압력 저장</span>"]:::procNode
    S3{"<span style='white-space:nowrap'>[Step 3] 정밀 누출 감시 (60초)</span><br/><span style='white-space:nowrap'>• 감시: VPT 변동량 <= 0.05 Torr</span>"}:::condNode
    S4["<span style='white-space:nowrap'>[Step 4] 누출 시험 합격 완료 (5초)</span>"]:::procNode
    S99["<span style='white-space:nowrap'>[Step 99] 비상 경보 및 정지 (Alarm Seq 1)</span><br/><span style='white-space:nowrap'>• 허용치 초과 누출 발생!</span>"]:::alarmNode
    EndNode(["<span style='white-space:nowrap'>[공정 완료] 정상 종료</span>"]):::passNode

    Start --> S1
    S1 --> S2
    S2 --> S3
    S3 -- "<span style='white-space:nowrap'>압력변동 <= 0.05 Torr</span><br/><span style='white-space:nowrap'>(누출 없음 / 합격)</span>" --> S4
    S3 -- "<span style='white-space:nowrap'>압력변동 > 0.05 Torr</span><br/><span style='white-space:nowrap'>(누출 발생 / 알람)</span>" --> S99
    S4 --> EndNode""",

    ('Bypass_v1', 18, 13): """flowchart TD
    classDef startNode fill:#1e40af,stroke:#1e3a8a,color:#fff,font-weight:bold
    classDef procNode fill:#eff6ff,stroke:#3b82f6,color:#1e3a8a,font-weight:bold
    classDef condNode fill:#fef3c7,stroke:#f59e0b,color:#b45309,font-weight:bold
    classDef passNode fill:#d1fae5,stroke:#10b981,color:#047857,font-weight:bold
    classDef alarmNode fill:#fee2e2,stroke:#ef4444,color:#b91c1c,font-weight:bold

    Start(["<span style='white-space:nowrap'>[공정 시작] Bypass_v1 종합 실전</span>"]):::startNode
    S1["<span style='white-space:nowrap'>[Step 1] 전 밸브 안전 초기화 (5초)</span>"]:::procNode
    S2["<span style='white-space:nowrap'>[Step 2] 1차 질소 공급 및 퍼지 (20초)</span><br/><span style='white-space:nowrap'>• VN1=O, PNV=O</span>"]:::procNode
    S3{"<span style='white-space:nowrap'>[Step 3] 2차 진공 배기 (120초)</span><br/><span style='white-space:nowrap'>• VPT <= 0.5 Torr 시 조기통과</span>"}:::condNode
    S4{"<span style='white-space:nowrap'>[Step 4] 작업자 육안 확인</span><br/><span style='white-space:nowrap'>• 진행방식 = 확인 (ACK)</span>"}:::condNode
    S5["<span style='white-space:nowrap'>[Step 5] 순차 지연 개방 (15초)</span><br/><span style='white-space:nowrap'>• VN2(0s) ➔ LPV(2s) ➔ HPIV(4s)</span>"]:::procNode
    S6["<span style='white-space:nowrap'>[Step 6] 3회 반복 퍼지 가압 (10초)</span><br/><span style='white-space:nowrap'>• VN1=O, PNV=O (루프 시작점)</span>"]:::procNode
    S7{"<span style='white-space:nowrap'>[Step 7] 배기 및 3회 반복 판정 (15초)</span><br/><span style='white-space:nowrap'>• 판정: 진행횟수 >= 3회?</span>"}:::condNode
    S8["<span style='white-space:nowrap'>[Step 8] 전 밸브 Close 및 완료 (5초)</span>"]:::procNode
    S99["<span style='white-space:nowrap'>[Step 99] 비상 알람 조치 (Alarm Seq 1)</span>"]:::alarmNode
    EndNode(["<span style='white-space:nowrap'>[Bypass 전 공정 정상 완료]</span>"]):::passNode

    Start --> S1
    S1 --> S2
    S2 --> S3
    S3 -- "<span style='white-space:nowrap'>0.5 Torr 도달</span><br/><span style='white-space:nowrap'>(조기 통과)</span>" --> S4
    S3 -- "<span style='white-space:nowrap'>120초 미도달</span><br/><span style='white-space:nowrap'>(알람 이동)</span>" --> S99
    S4 -- "<span style='white-space:nowrap'>작업자 [확인] 클릭</span>" --> S5
    S5 --> S6
    S6 --> S7
    S7 -- "<span style='white-space:nowrap'>1~2회차</span><br/><span style='white-space:nowrap'>[Step 6 루프백]</span>" --> S6
    S7 -- "<span style='white-space:nowrap'>3회 완료</span><br/><span style='white-space:nowrap'>[Step 8 탈출]</span>" --> S8
    S8 --> EndNode"""
}

# Update all sheets with nowrap format
for (sheet_name, r, c), mermaid_text in codes.items():
    ws = wb[sheet_name]
    ws.cell(row=r, column=c).value = mermaid_text
    print(f'Successfully updated [{sheet_name}] with nowrap format at R{r}C{c}')

wb.save(target_file)
print(f'Done! Successfully updated all 7 sheets in {target_file}!')
