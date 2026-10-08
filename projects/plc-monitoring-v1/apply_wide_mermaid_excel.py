import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import openpyxl

target_file = 'GMS_자동진행_시퀀스_표준템플릿_v4.xlsx'
wb = openpyxl.load_workbook(target_file)

# Perfectly wide-formatted Mermaid codes for all 7 sheets
# Using non-breaking spaces (&nbsp;) so text never wraps and boxes expand wide!

codes = {
    ('예제1_단순개폐', 12, 13): """flowchart TD
    classDef startNode fill:#1e40af,stroke:#1e3a8a,color:#fff,font-weight:bold
    classDef procNode fill:#eff6ff,stroke:#3b82f6,color:#1e3a8a,font-weight:bold
    classDef passNode fill:#d1fae5,stroke:#10b981,color:#047857,font-weight:bold

    Start(["[공정&nbsp;시작]&nbsp;예제1_단순개폐"]):::startNode
    S1["[Step&nbsp;1]&nbsp;전&nbsp;밸브&nbsp;안전&nbsp;Close&nbsp;(5초)<br/>•&nbsp;VN1=C,&nbsp;VN2=C,&nbsp;PNV=C,&nbsp;HPV=C"]:::procNode
    S2["[Step&nbsp;2]&nbsp;질소&nbsp;가스&nbsp;공급&nbsp;개방&nbsp;(30초)<br/>•&nbsp;VN1=O,&nbsp;PNV=O&nbsp;(나머지&nbsp;밸브&nbsp;상태유지)"]:::procNode
    S3["[Step&nbsp;3]&nbsp;질소&nbsp;차단&nbsp;및&nbsp;대기&nbsp;(10초)<br/>•&nbsp;VN1=C,&nbsp;PNV=C&nbsp;닫고&nbsp;안정화&nbsp;대기"]:::procNode
    EndNode(["[공정&nbsp;완료]&nbsp;정상&nbsp;종료"]):::passNode

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

    Start(["[공정&nbsp;시작]&nbsp;예제2_조기통과"]):::startNode
    S1["[Step&nbsp;1]&nbsp;진공&nbsp;배기&nbsp;준비&nbsp;(10초)<br/>•&nbsp;전&nbsp;밸브&nbsp;Close"]:::procNode
    S2{"[Step&nbsp;2]&nbsp;진공&nbsp;배기&nbsp;및&nbsp;압력&nbsp;감시&nbsp;(120초)<br/>•&nbsp;조건:&nbsp;VPT&nbsp;<=&nbsp;0.5&nbsp;Torr&nbsp;도달&nbsp;시&nbsp;조기통과"}:::condNode
    S3["[Step&nbsp;3]&nbsp;목표&nbsp;도달&nbsp;확인&nbsp;및&nbsp;완료&nbsp;(5초)"]:::procNode
    S99["[Step&nbsp;99]&nbsp;120초&nbsp;시간초과&nbsp;알람&nbsp;발생&nbsp;(Alarm&nbsp;Seq&nbsp;1)"]:::alarmNode
    EndNode(["[공정&nbsp;완료]&nbsp;정상&nbsp;종료"]):::passNode

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

    Start(["[공정&nbsp;시작]&nbsp;예제3_수동확인"]):::startNode
    S1["[Step&nbsp;1]&nbsp;시험&nbsp;압력&nbsp;가압&nbsp;진행&nbsp;(20초)<br/>•&nbsp;VN1=O,&nbsp;PNV=O&nbsp;(가스&nbsp;주입)"]:::procNode
    S2{"[Step&nbsp;2]&nbsp;작업자&nbsp;육안&nbsp;확인&nbsp;대기<br/>•&nbsp;진행방식&nbsp;=&nbsp;확인&nbsp;(ACK)<br/>•&nbsp;화면&nbsp;[확인]&nbsp;클릭&nbsp;시까지&nbsp;무한&nbsp;대기"}:::ackNode
    S3["[Step&nbsp;3]&nbsp;가압&nbsp;해제&nbsp;및&nbsp;배기&nbsp;(10초)<br/>•&nbsp;HPV=O&nbsp;(배기&nbsp;밸브&nbsp;Open)"]:::procNode
    EndNode(["[공정&nbsp;완료]&nbsp;정상&nbsp;종료"]):::passNode

    Start --> S1
    S1 -->|20초 가압 완료| S2
    S2 -- "작업자가 HMI 화면의<br/>[확인(ACK)] 버튼 클릭" --> S3
    S3 -->|10초 배기 완료| EndNode""",

    ('예제4_지연개폐', 11, 13): """flowchart TD
    classDef startNode fill:#1e40af,stroke:#1e3a8a,color:#fff,font-weight:bold
    classDef procNode fill:#eff6ff,stroke:#3b82f6,color:#1e3a8a,font-weight:bold
    classDef passNode fill:#d1fae5,stroke:#10b981,color:#047857,font-weight:bold

    Start(["[공정&nbsp;시작]&nbsp;예제4_지연개폐"]):::startNode
    subgraph Step1 ["Step&nbsp;1:&nbsp;충격&nbsp;방지&nbsp;순차&nbsp;지연&nbsp;개방&nbsp;(총&nbsp;15초)"]
        T0["T+0초:&nbsp;VN2&nbsp;즉시&nbsp;Open"] --> T2["T+2초:&nbsp;LPV&nbsp;지연&nbsp;Open"]
        T2 --> T4["T+4초:&nbsp;HPIV&nbsp;지연&nbsp;Open"]
    end
    subgraph Step2 ["Step&nbsp;2:&nbsp;순차&nbsp;지연&nbsp;닫힘&nbsp;제어&nbsp;(총&nbsp;10초)"]
        C0["T+0초:&nbsp;VN2&nbsp;즉시&nbsp;Close"] --> C2["T+2초:&nbsp;LPV&nbsp;지연&nbsp;Close"]
        C2 --> C3["T+3초:&nbsp;HPIV&nbsp;지연&nbsp;Close"]
    end
    EndNode(["[공정&nbsp;완료]&nbsp;정상&nbsp;종료"]):::passNode

    Start --> Step1
    Step1 -->|15초 완료| Step2
    Step2 -->|10초 완료| EndNode""",

    ('예제5_반복루프', 13, 13): """flowchart TD
    classDef startNode fill:#1e40af,stroke:#1e3a8a,color:#fff,font-weight:bold
    classDef procNode fill:#eff6ff,stroke:#3b82f6,color:#1e3a8a,font-weight:bold
    classDef condNode fill:#fef3c7,stroke:#f59e0b,color:#b45309,font-weight:bold
    classDef passNode fill:#d1fae5,stroke:#10b981,color:#047857,font-weight:bold

    Start(["[공정&nbsp;시작]&nbsp;예제5_반복루프"]):::startNode
    S1["[Step&nbsp;1]&nbsp;루프&nbsp;준비&nbsp;-&nbsp;전&nbsp;밸브&nbsp;Close&nbsp;(5초)"]:::procNode
    S2["[Step&nbsp;2]&nbsp;퍼지&nbsp;가스&nbsp;가압&nbsp;(10초)<br/>•&nbsp;VN1=O,&nbsp;PNV=O&nbsp;(루프&nbsp;시작점)"]:::procNode
    S3{"[Step&nbsp;3]&nbsp;배기&nbsp;진행&nbsp;(15초)<br/>•&nbsp;판정:&nbsp;진행횟수&nbsp;>=&nbsp;3회?"}:::condNode
    S4["[Step&nbsp;4]&nbsp;3회&nbsp;반복&nbsp;완료&nbsp;및&nbsp;정상&nbsp;종료&nbsp;(5초)<br/>•&nbsp;전&nbsp;밸브&nbsp;Close"]:::procNode
    EndNode(["[공정&nbsp;완료]&nbsp;정상&nbsp;종료"]):::passNode

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

    Start(["[공정&nbsp;시작]&nbsp;예제6_누출시험"]):::startNode
    S1["[Step&nbsp;1]&nbsp;배관&nbsp;시험&nbsp;진공&nbsp;배기&nbsp;(30초)<br/>•&nbsp;HPV=O,&nbsp;PNV=O"]:::procNode
    S2["[Step&nbsp;2]&nbsp;배관&nbsp;밀폐&nbsp;및&nbsp;압력&nbsp;캡처&nbsp;(5초)<br/>•&nbsp;전&nbsp;밸브&nbsp;Close,&nbsp;초기압력&nbsp;저장"]:::procNode
    S3{"[Step&nbsp;3]&nbsp;정밀&nbsp;누출&nbsp;감시&nbsp;(60초)<br/>•&nbsp;감시:&nbsp;VPT&nbsp;변동량&nbsp;<=&nbsp;0.05&nbsp;Torr"}:::condNode
    S4["[Step&nbsp;4]&nbsp;누출&nbsp;시험&nbsp;합격&nbsp;완료&nbsp;(5초)"]:::procNode
    S99["[Step&nbsp;99]&nbsp;비상&nbsp;경보&nbsp;및&nbsp;정지&nbsp;(Alarm&nbsp;Seq&nbsp;1)<br/>•&nbsp;허용치&nbsp;초과&nbsp;누출&nbsp;발생!"]:::alarmNode
    EndNode(["[공정&nbsp;완료]&nbsp;정상&nbsp;종료"]):::passNode

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

    Start(["[공정&nbsp;시작]&nbsp;Bypass_v1&nbsp;종합&nbsp;실전"]):::startNode
    S1["[Step&nbsp;1]&nbsp;전&nbsp;밸브&nbsp;안전&nbsp;초기화&nbsp;(5초)"]:::procNode
    S2["[Step&nbsp;2]&nbsp;1차&nbsp;질소&nbsp;공급&nbsp;및&nbsp;퍼지&nbsp;(20초)<br/>•&nbsp;VN1=O,&nbsp;PNV=O"]:::procNode
    S3{"[Step&nbsp;3]&nbsp;2차&nbsp;진공&nbsp;배기&nbsp;(120초)<br/>•&nbsp;VPT&nbsp;<=&nbsp;0.5&nbsp;Torr&nbsp;시&nbsp;조기통과"}:::condNode
    S4{"[Step&nbsp;4]&nbsp;작업자&nbsp;육안&nbsp;확인<br/>•&nbsp;진행방식&nbsp;=&nbsp;확인&nbsp;(ACK)"}:::condNode
    S5["[Step&nbsp;5]&nbsp;순차&nbsp;지연&nbsp;개방&nbsp;(15초)<br/>•&nbsp;VN2(0s)&nbsp;➔&nbsp;LPV(2s)&nbsp;➔&nbsp;HPIV(4s)"]:::procNode
    S6["[Step&nbsp;6]&nbsp;3회&nbsp;반복&nbsp;퍼지&nbsp;가압&nbsp;(10초)<br/>•&nbsp;VN1=O,&nbsp;PNV=O&nbsp;(루프&nbsp;시작점)"]:::procNode
    S7{"[Step&nbsp;7]&nbsp;배기&nbsp;및&nbsp;3회&nbsp;반복&nbsp;판정&nbsp;(15초)<br/>•&nbsp;판정:&nbsp;진행횟수&nbsp;>=&nbsp;3회?"}:::condNode
    S8["[Step&nbsp;8]&nbsp;전&nbsp;밸브&nbsp;Close&nbsp;및&nbsp;완료&nbsp;(5초)"]:::procNode
    S99["[Step&nbsp;99]&nbsp;비상&nbsp;알람&nbsp;조치&nbsp;(Alarm&nbsp;Seq&nbsp;1)"]:::alarmNode
    EndNode(["[Bypass&nbsp;전&nbsp;공정&nbsp;정상&nbsp;완료]"]):::passNode

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

# Update all sheets with wide format
for (sheet_name, r, c), mermaid_text in codes.items():
    ws = wb[sheet_name]
    ws.cell(row=r, column=c).value = mermaid_text
    print(f'Successfully updated [{sheet_name}] with Wide non-breaking format at R{r}C{c}')

wb.save(target_file)
print(f'Done! Successfully updated all 7 sheets in {target_file}!')
