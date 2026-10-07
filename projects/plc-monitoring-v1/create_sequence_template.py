import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# 워크북 생성
wb = openpyxl.Workbook()

# 스타일 공통 정의
font_title = Font(name="맑은 고딕", size=15, bold=True, color="FFFFFF")
font_section = Font(name="맑은 고딕", size=12, bold=True, color="1E3A8A")
font_header = Font(name="맑은 고딕", size=10, bold=True, color="FFFFFF")
font_bold = Font(name="맑은 고딕", size=10, bold=True)
font_normal = Font(name="맑은 고딕", size=10)

fill_title = PatternFill(start_color="1E40AF", end_color="1E40AF", fill_type="solid")
fill_section = PatternFill(start_color="DBEAFE", end_color="DBEAFE", fill_type="solid")
fill_hdr_blue = PatternFill(start_color="1D4ED8", end_color="1D4ED8", fill_type="solid")
fill_hdr_amber = PatternFill(start_color="B45309", end_color="B45309", fill_type="solid")
fill_hdr_green = PatternFill(start_color="047857", end_color="047857", fill_type="solid")
fill_zebra = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
fill_highlight = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
fill_green_tag = PatternFill(start_color="D1FAE5", end_color="D1FAE5", fill_type="solid")

thin_border = Border(
    left=Side(style='thin', color='CBD5E1'),
    right=Side(style='thin', color='CBD5E1'),
    top=Side(style='thin', color='CBD5E1'),
    bottom=Side(style='thin', color='CBD5E1')
)

align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
align_left = Alignment(horizontal="left", vertical="center", wrap_text=True)
align_right = Alignment(horizontal="right", vertical="center")

# 공통 컬럼 정의
fixed_cols = [
    "S/No.", "Main Step", "Sub Step", "Next Step", "Operations", "Cycle",
    "진행방식", "Ack Goto", "Alarm Goto", "Message at Controller", "Time (Sec)", "Acc,Time (Sec)"
]
valve_cols = [
    "VN1", "VN2", "V/S_{side}", "AG_{side}", "PNV", "GNV", "HPIV",
    "FPV_{side}", "LPI_{side}", "HPV_{side}", "HPI_{side}", "LPV_{side}", "PGII_{side}"
]
trailing_cols = [
    "Alarm Monitoring", "비교연산자", "설정명(비교대상ID)", "조기통과", "Alarm Seq.", "Alarm Message", "Remarks"
]
all_headers = fixed_cols + valve_cols + trailing_cols
total_cols = len(all_headers)
valve_start = 13
valve_end = 12 + len(valve_cols)
trail_start = valve_end + 1
trail_end = total_cols


# ========================================================
# 1. 첫 번째 시트: "사용 방법" (상세 매뉴얼 & 상황별 가이드)
# ========================================================
ws_guide = wb.active
ws_guide.title = "사용 방법"
ws_guide.views.sheetView[0].showGridLines = True

# 타이틀 배너
ws_guide.merge_cells("A1:G1")
ws_guide["A1"] = "📘 GMS 자동진행 시퀀스 엑셀 마스터 매뉴얼 & 상황별 규칙 총정리"
ws_guide["A1"].font = font_title
ws_guide["A1"].fill = fill_title
ws_guide["A1"].alignment = align_center
ws_guide.row_dimensions[1].height = 42

ws_guide.merge_cells("A2:G2")
ws_guide["A2"] = "본 시트는 GMS(Gas Management System) 자동 시퀀스를 엑셀로 작성하고 수정할 때 준수해야 하는 모든 셀 규칙과 5가지 실전 상황별 예제를 담고 있습니다."
ws_guide["A2"].font = font_bold
ws_guide["A2"].alignment = align_left
ws_guide.row_dimensions[2].height = 24

# 섹션 1: 엑셀 작성 3대 절대 원칙
ws_guide.merge_cells("A4:G4")
ws_guide["A4"] = "1. 엑셀 시트 작성 3대 절대 원칙 (주의사항)"
ws_guide["A4"].font = font_section
ws_guide["A4"].fill = fill_section
ws_guide.row_dimensions[4].height = 28

for col_idx, h in enumerate(["항목", "규칙명", "핵심 규칙 및 시스템 동작 원리"], 1):
    cell = ws_guide.cell(row=5, column=col_idx, value=h)
    cell.font = font_header
    cell.fill = fill_hdr_blue
    cell.alignment = align_center
ws_guide.merge_cells("C5:E5")
ws_guide.merge_cells("F5:G5")
ws_guide.cell(row=5, column=6, value="주의사항 (절대 금지)").font = font_header
ws_guide.cell(row=5, column=6).fill = fill_hdr_blue
ws_guide.cell(row=5, column=6).alignment = align_center

rules = [
    ("원칙 1", "시트 이름 규칙", "엑셀의 워크시트 이름이 시스템의 서브시퀀스 ID가 됩니다 (예: Bypass_v1, OneP_v1).", "시트명을 임의로 바꾸면 시스템이 다른 시퀀스로 인식하거나 누락됩니다."),
    ("원칙 2", "행(Row) 위치 고정", "Row 1~3은 타이틀/안내 영역, ★Row 4가 프로그램 기준 헤더 행, Row 5부터 실제 스텝 데이터입니다.", "Row 4의 열 이름을 변경하거나 헤더 위치를 위/아래로 옮기면 프로그램이 읽지 못합니다."),
    ("원칙 3", "상태 유지(빈칸) 원칙", "밸브 셀에 아무것도 적지 않은 공백(빈칸)은 '이전 스텝의 개폐 상태를 그대로 유지'함을 의미합니다.", "매 스텝마다 모든 밸브를 O/C로 채울 필요가 없으며, 빈칸이 통신 부하와 장비 쇼크를 막습니다.")
]

for r_idx, r in enumerate(rules, 6):
    ws_guide.cell(row=r_idx, column=1, value=r[0]).alignment = align_center
    ws_guide.cell(row=r_idx, column=2, value=r[1]).alignment = align_center
    ws_guide.merge_cells(f"C{r_idx}:E{r_idx}")
    ws_guide.merge_cells(f"F{r_idx}:G{r_idx}")
    ws_guide.cell(row=r_idx, column=3, value=r[2]).alignment = align_left
    ws_guide.cell(row=r_idx, column=6, value=r[3]).alignment = align_left
    ws_guide.row_dimensions[r_idx].height = 24
    for c in range(1, 8):
        ws_guide.cell(row=r_idx, column=c).border = thin_border
        ws_guide.cell(row=r_idx, column=c).font = font_normal

# 섹션 2: 5가지 상황별 실전 작성 가이드
ws_guide.merge_cells("A10:G10")
ws_guide["A10"] = "2. 실무에서 가장 많이 쓰는 5가지 상황별 엑셀 작성 예제 가이드"
ws_guide["A10"].font = font_section
ws_guide["A10"].fill = fill_section
ws_guide.row_dimensions[10].height = 28

scenarios = [
    ("상황 1", "단순 밸브 개폐 및 안정화 대기", "진행방식: 자동 / Time: 30초 / VN1: O, PNV: C, 나머지 빈칸", "공백(빈칸)은 이전 밸브 상태를 그대로 유지하므로 필요한 밸브만 O/C 입력"),
    ("상황 2", "진공 배기 조기통과 (Early Pass)", "Time: 120초 / Alarm Mon: VPT_{side} / 연산자: <= / 설정: 0.5 / 조기통과: Y", "120초가 다 지나지 않아도 0.5 Torr 도달 즉시 다음 스텝 진행 (시간 대폭 단축)"),
    ("상황 3", "작업자 육안 확인 대기 (수동 ACK)", "진행방식: 확인 / Time: 0초 / Message: '압력 확인 후 [확인] 버튼 클릭'", "작업자가 HMI 화면의 확인 버튼을 누를 때까지 정지 대기 (안전 확인용)"),
    ("상황 4", "밸브 순차 지연 개폐 (시차 제어)", "Time: 10초 / VN1: O (즉시 열림) / LPV_{side}: O+2 (2초 뒤 열림)", "O+n 또는 C+n 문법 사용 (용기교체 등 배관 충격 방지 순차 제어에 필수)"),
    ("상황 5", "다회 반복 퍼지 루프 (Cycle)", "Step 5에 Next Step: 4 / Alarm Mon: 진행횟수 / 연산자: < / 설정: 3", "진행횟수가 3회 미만이면 4번 스텝으로 루프, 3회 만족 시 6번 스텝으로 통과")
]

for col_idx, h in enumerate(["상황 구분", "상황 명칭", "엑셀 셀 입력 규칙 (핵심)", "동작 결과 및 엔지니어링 팁"], 1):
    cell = ws_guide.cell(row=11, column=col_idx, value=h)
    cell.font = font_header
    cell.fill = fill_hdr_amber
    cell.alignment = align_center
ws_guide.merge_cells("C11:E11")
ws_guide.merge_cells("F11:G11")
ws_guide.row_dimensions[11].height = 26

for r_idx, sc in enumerate(scenarios, 12):
    ws_guide.cell(row=r_idx, column=1, value=sc[0]).alignment = align_center
    ws_guide.cell(row=r_idx, column=2, value=sc[1]).alignment = align_left
    ws_guide.merge_cells(f"C{r_idx}:E{r_idx}")
    ws_guide.merge_cells(f"F{r_idx}:G{r_idx}")
    ws_guide.cell(row=r_idx, column=3, value=sc[2]).alignment = align_left
    ws_guide.cell(row=r_idx, column=6, value=sc[3]).alignment = align_left
    ws_guide.row_dimensions[r_idx].height = 24
    for c in range(1, 8):
        ws_guide.cell(row=r_idx, column=c).border = thin_border
        ws_guide.cell(row=r_idx, column=c).font = font_normal

# 섹션 3: 엑셀 열(Column) 상세 규칙표
ws_guide.merge_cells("A18:G18")
ws_guide["A18"] = "3. 전체 엑셀 컬럼(열)별 정밀 규칙 및 사용 방법"
ws_guide["A18"].font = font_section
ws_guide["A18"].fill = fill_section
ws_guide.row_dimensions[18].height = 28

col_headers = ["구역", "열 헤더명", "필수여부", "입력 가능 값 / 문법", "상세 설명 및 동작 방식", "실전 입력 예시", "비고"]
for col_idx, h in enumerate(col_headers, 1):
    cell = ws_guide.cell(row=19, column=col_idx, value=h)
    cell.font = font_header
    cell.fill = fill_hdr_blue
    cell.alignment = align_center
ws_guide.row_dimensions[19].height = 26

col_details = [
    ("고정 제어", "S/No.", "필수", "1, 2, 3...", "스텝 고유 순번입니다. 비어있는 행은 실행 시 자동으로 무시됩니다.", "1", "스텝 식별자"),
    ("고정 제어", "Main Step", "선택", "정수 (11, 20 등)", "상위 대공정 번호입니다. 화면 상단 표시용입니다.", "11", "대공정"),
    ("고정 제어", "Sub Step", "선택", "정수 (1, 2, 3 등)", "세부 보조 스텝 번호입니다.", "1", "보조 번호"),
    ("고정 제어", "Next Step", "선택", "스텝 번호 또는 공백", "비워두면 다음 행으로 진행하며, 숫자를 넣으면 해당 스텝으로 무조건 점프합니다.", "5 (또는 빈칸)", "분기 제어"),
    ("고정 제어", "Operations", "권장", "문자열", "해당 스텝의 공정 명칭입니다. 화면 상단에 표시됩니다.", "[ Bypass 2차 Purge ]", "화면 표시"),
    ("고정 제어", "Cycle", "선택", "숫자 또는 CAPTURE:<태그>", "반복 루프 표시 또는 최초 진입 시 기준 압력 캡처(P0) 지시어입니다.", "CAPTURE:HPT_{side}", "초기값 박제"),
    ("고정 제어", "진행방식", "필수", "자동 / 확인 (ACK)", "자동: 시간 경과 후 자동 진행 / 확인: 작업자가 [확인] 버튼을 누를 때까지 대기.", "자동", "진행 제어"),
    ("고정 제어", "Ack Goto", "선택", "스텝 번호 또는 공백", "진행방식이 '확인'일 때 작업자가 버튼을 클릭하면 이동할 스텝 번호입니다.", "4", "확인 후 이동"),
    ("고정 제어", "Alarm Goto", "선택", "스텝 번호 또는 공백", "이상 감지 또는 알람 발생 시 비상 조치를 위해 점프할 스텝 번호입니다.", "99", "알람 분기"),
    ("고정 제어", "Message at Controller", "선택", "문자열", "화면 중앙 모니터 안내창에 작업자에게 띄울 안내 팝업 메시지입니다.", "작업자 밸브 확인 요망", "작업자 안내"),
    ("고정 제어", "Time (Sec)", "필수", "초 단위 숫자", "해당 스텝의 목표 유지 시간입니다. 이 시간 동안 밸브 상태를 유지합니다.", "30", "시간 카운트"),
    ("고정 제어", "Acc,Time (Sec)", "선택", "수식 또는 숫자", "누적 시간입니다. 보통 =SUM($K$5:K5) 수식을 넣으며 시스템이 자동 계산합니다.", "=SUM($K$5:K5)", "누적 표시"),
    ("밸브 태그", "밸브 태그열 (VN1 등)", "가변", "O, C, O+n, C+n, 공백", "O: 열림, C: 닫힘, 공백: 이전 상태 유지, O+2: 2초 뒤 지연 열림.", "O (또는 O+2)", "PLC FINS"),
    ("감시 판정", "Alarm Monitoring", "선택", "센서태그 / 진행횟수", "감시할 센서명(VPT_{side}, VT) 또는 반복 횟수(진행횟수). &로 다중 감시 가능.", "VPT_{side}", "센서 감시"),
    ("감시 판정", "비교연산자", "선택", "<, <=, >, >=, ==, ON, OFF", "센서 현재값과 설정값을 비교할 연산자입니다. ZERO는 자동 0점 보정.", "<=", "조건 판정"),
    ("감시 판정", "설정명(비교대상ID)", "선택", "CONFIG ID 또는 숫자", "CONFIG 설정 변수명 또는 고정 수치(0.5, 3 등)를 입력합니다.", "VAC_LIMIT 또는 0.5", "기준값"),
    ("감시 판정", "조기통과", "선택", "Y, O, 1 또는 공백", "★핵심: 시간이 다 지나지 않아도 조건 만족 시 즉시 다음 스텝으로 패스!", "Y", "시간 단축"),
    ("감시 판정", "Alarm Seq.", "선택", "1, 2, 3", "1: 즉시 비상정지(전 밸브 Close), 2: 일시정지 후 대기, 3: 경고 배너 유지.", "1", "알람 동작"),
    ("감시 판정", "Alarm Message", "선택", "문자열", "알람 발생 시 화면에 빨간색 배너로 띄울 경고 문구입니다.", "진공 도달 시간 초과", "경고 배너"),
    ("감시 판정", "Remarks", "선택", "문자열", "엔지니어 작업 메모입니다. 공정 이력 로그에 함께 기록됩니다.", "1차 배관 진공 배기", "엔지니어 메모")
]

for r_idx, col_info in enumerate(col_details, 20):
    area_cell = ws_guide.cell(row=r_idx, column=1, value=col_info[0])
    area_cell.alignment = align_center
    if col_info[0] == "고정 제어":
        area_cell.fill = fill_zebra
    elif col_info[0] == "밸브 태그":
        area_cell.fill = fill_highlight
    else:
        area_cell.fill = PatternFill(start_color="ECFDF5", end_color="ECFDF5", fill_type="solid")

    ws_guide.cell(row=r_idx, column=2, value=col_info[1]).alignment = align_left
    ws_guide.cell(row=r_idx, column=3, value=col_info[2]).alignment = align_center
    ws_guide.cell(row=r_idx, column=4, value=col_info[3]).alignment = align_left
    ws_guide.cell(row=r_idx, column=5, value=col_info[4]).alignment = align_left
    ws_guide.cell(row=r_idx, column=6, value=col_info[5]).alignment = align_center
    ws_guide.cell(row=r_idx, column=7, value=col_info[6]).alignment = align_center
    ws_guide.row_dimensions[r_idx].height = 24
    for c in range(1, 8):
        ws_guide.cell(row=r_idx, column=c).border = thin_border
        ws_guide.cell(row=r_idx, column=c).font = font_normal

ws_guide.column_dimensions['A'].width = 14
ws_guide.column_dimensions['B'].width = 24
ws_guide.column_dimensions['C'].width = 12
ws_guide.column_dimensions['D'].width = 28
ws_guide.column_dimensions['E'].width = 46
ws_guide.column_dimensions['F'].width = 24
ws_guide.column_dimensions['G'].width = 16


# ========================================================
# 2. 두 번째 시트: "Bypass_v1" (5개 실전 상황별 종합 예제 시트)
# ========================================================
ws_demo = wb.create_sheet(title="Bypass_v1")
ws_demo.views.sheetView[0].showGridLines = True

# Row 1: 타이틀 배너
ws_demo.merge_cells(start_row=1, start_column=1, end_row=1, end_column=total_cols)
ws_demo.cell(row=1, column=1, value="Bypass_v1 (Bypass) - 5대 실전 상황별 시퀀스 종합 예제 템플릿").font = font_title
ws_demo.cell(row=1, column=1).fill = fill_title
ws_demo.cell(row=1, column=1).alignment = align_center
ws_demo.row_dimensions[1].height = 36

# Row 2~3: 카테고리 그룹 배너
ws_demo.merge_cells(start_row=2, start_column=1, end_row=3, end_column=12)
ws_demo.cell(row=2, column=1, value="[ 공정 제어 및 타이머 설정 구간 ]").font = font_header
ws_demo.cell(row=2, column=1).fill = fill_hdr_blue
ws_demo.cell(row=2, column=1).alignment = align_center

ws_demo.merge_cells(start_row=2, start_column=valve_start, end_row=3, end_column=valve_end)
ws_demo.cell(row=2, column=valve_start, value="[ 밸브 개폐 제어 구간 (O:열림 / C:닫힘 / 빈칸:유지) ]").font = font_header
ws_demo.cell(row=2, column=valve_start).fill = fill_hdr_amber
ws_demo.cell(row=2, column=valve_start).alignment = align_center

ws_demo.merge_cells(start_row=2, start_column=trail_start, end_row=3, end_column=trail_end)
ws_demo.cell(row=2, column=trail_start, value="[ 센서 감시 / 조기통과 / 알람 판정 구간 ]").font = font_header
ws_demo.cell(row=2, column=trail_start).fill = fill_hdr_green
ws_demo.cell(row=2, column=trail_start).alignment = align_center

ws_demo.row_dimensions[2].height = 18
ws_demo.row_dimensions[3].height = 18

# Row 4: 실제 프로그램 기준 헤더 행
ws_demo.row_dimensions[4].height = 28
for c_idx, h_text in enumerate(all_headers, 1):
    c = ws_demo.cell(row=4, column=c_idx, value=h_text)
    c.font = font_header
    c.alignment = align_center
    c.border = thin_border
    if c_idx <= 12:
        c.fill = PatternFill(start_color="1D4ED8", end_color="1D4ED8", fill_type="solid")
    elif c_idx <= valve_end:
        c.fill = PatternFill(start_color="B45309", end_color="B45309", fill_type="solid")
    else:
        c.fill = PatternFill(start_color="047857", end_color="047857", fill_type="solid")

# Row 5부터 5개 상황별 실전 스텝 데이터
demo_steps = [
    {
        "no": 1, "mainStep": 11, "subStep": 1, "nextStep": "", "op": "[ 준비 - 전 밸브 초기화 ]", "cycle": "",
        "adv": "자동", "ackGoto": "", "alarmGoto": "", "msg": "Bypass 공정 시작 - 전 밸브 안전 초기화", "time": 5,
        "valves": {"VN1": "C", "VN2": "C", "PNV": "C", "GNV": "C", "HPV_{side}": "C", "LPV_{side}": "C", "HPIV": "C"},
        "mon": "", "opCond": "", "valCond": "", "early": "", "alarmSeq": "", "alarmMsg": "",
        "rem": "★상황 1: 전 밸브 안전 Close 후 5초 대기"
    },
    {
        "no": 2, "mainStep": 11, "subStep": 2, "nextStep": "", "op": "[ 1차 질소 공급 및 퍼지 ]", "cycle": "",
        "adv": "자동", "ackGoto": "", "alarmGoto": "", "msg": "질소 공급 밸브 개방 (안정화 대기)", "time": 20,
        "valves": {"VN1": "O", "PNV": "O"},
        "mon": "", "opCond": "", "valCond": "", "early": "", "alarmSeq": "", "alarmMsg": "",
        "rem": "★상황 1: VN1, PNV만 열고 나머지 밸브는 빈칸으로 상태 유지"
    },
    {
        "no": 3, "mainStep": 11, "subStep": 3, "nextStep": "", "op": "[ 2차 진공 배기 (조기통과) ]", "cycle": "",
        "adv": "자동", "ackGoto": "", "alarmGoto": 99, "msg": "배관 진공 배기 진행 중", "time": 120,
        "valves": {"VN1": "C", "PNV": "C", "HPV_{side}": "O"},
        "mon": "VPT_{side}", "opCond": "<=", "valCond": "0.5", "early": "Y", "alarmSeq": 1, "alarmMsg": "120초 내 진공 미도달 (누설 의심)",
        "rem": "★상황 2: 120초 전이라도 0.5 Torr 도달 시 즉시 패스!"
    },
    {
        "no": 4, "mainStep": 11, "subStep": 4, "nextStep": "", "op": "[ 작업자 육안 확인 (ACK 대기) ]", "cycle": "",
        "adv": "확인", "ackGoto": "", "alarmGoto": "", "msg": "게이지 누설 확인 후 화면의 [확인] 버튼을 누르세요", "time": 0,
        "valves": {},
        "mon": "", "opCond": "", "valCond": "", "early": "", "alarmSeq": "", "alarmMsg": "",
        "rem": "★상황 3: 작업자가 버튼 누를 때까지 무한 대기"
    },
    {
        "no": 5, "mainStep": 11, "subStep": 5, "nextStep": "", "op": "[ 밸브 순차 지연 개폐 제어 ]", "cycle": "",
        "adv": "자동", "ackGoto": "", "alarmGoto": "", "msg": "충격 방지 밸브 순차 개방 중", "time": 15,
        "valves": {"VN2": "O", "LPV_{side}": "O+2", "HPIV": "O+4"},
        "mon": "", "opCond": "", "valCond": "", "early": "", "alarmSeq": "", "alarmMsg": "",
        "rem": "★상황 4: VN2 즉시 열림, LPV 2초 뒤, HPIV 4초 뒤 순차 열림"
    },
    {
        "no": 6, "mainStep": 11, "subStep": 6, "nextStep": "", "op": "[ 3회 반복 퍼지 루프 - 가스 주입 ]", "cycle": "",
        "adv": "자동", "ackGoto": "", "alarmGoto": "", "msg": "퍼지 가스 가압 진행", "time": 10,
        "valves": {"VN1": "O", "PNV": "O", "HPV_{side}": "C"},
        "mon": "", "opCond": "", "valCond": "", "early": "", "alarmSeq": "", "alarmMsg": "",
        "rem": "★상황 5: 3회 반복 사이클 시작 (가압)"
    },
    {
        "no": 7, "mainStep": 11, "subStep": 7, "nextStep": 6, "op": "[ 3회 반복 퍼지 루프 - 배기 및 판정 ]", "cycle": "",
        "adv": "자동", "ackGoto": "", "alarmGoto": "", "msg": "배기 진행 및 반복 횟수 판정", "time": 15,
        "valves": {"VN1": "C", "PNV": "C", "HPV_{side}": "O"},
        "mon": "진행횟수", "opCond": "<", "valCond": "3", "early": "", "alarmSeq": "", "alarmMsg": "",
        "rem": "★상황 5: 3회 미만이면 Next Step 6으로 점프, 3회 만족 시 8번 진행"
    },
    {
        "no": 8, "mainStep": 11, "subStep": 8, "nextStep": "", "op": "[ 공정 완료 및 전 밸브 안전 Close ]", "cycle": "",
        "adv": "자동", "ackGoto": "", "alarmGoto": "", "msg": "Bypass 전 공정 정상 완료되었습니다", "time": 5,
        "valves": {"VN1": "C", "VN2": "C", "PNV": "C", "HPV_{side}": "C", "LPV_{side}": "C", "HPIV": "C"},
        "mon": "", "opCond": "", "valCond": "", "early": "", "alarmSeq": "", "alarmMsg": "",
        "rem": "전 공정 완료 후 안전 닫힘"
    },
    {
        "no": 99, "mainStep": 99, "subStep": 99, "nextStep": "", "op": "[ 비상 알람 조치 스텝 ]", "cycle": "",
        "adv": "확인", "ackGoto": "", "alarmGoto": "", "msg": "이상 발생으로 비상 정지되었습니다. 설비를 점검하세요.", "time": 0,
        "valves": {"VN1": "C", "VN2": "C", "PNV": "C", "GNV": "C", "HPV_{side}": "C", "LPV_{side}": "C"},
        "mon": "", "opCond": "", "valCond": "", "early": "", "alarmSeq": 1, "alarmMsg": "비상 알람 발생 (안전 Close 완료)",
        "rem": "Step 3에서 알람 시 점프하는 비상 대응 스텝"
    }
]

for row_offset, step in enumerate(demo_steps, 5):
    ws_demo.row_dimensions[row_offset].height = 24
    row_data = [
        step["no"], step["mainStep"], step["subStep"], step["nextStep"],
        step["op"], step["cycle"], step["adv"], step["ackGoto"],
        step["alarmGoto"], step["msg"], step["time"], f"=SUM($K$5:K{row_offset})"
    ]
    # 밸브 값 매핑
    for v_tag in valve_cols:
        row_data.append(step["valves"].get(v_tag, ""))
    # 트레일링 값 매핑
    row_data.extend([
        step["mon"], step["opCond"], step["valCond"], step["early"],
        step["alarmSeq"], step["alarmMsg"], step["rem"]
    ])

    for c_idx, val in enumerate(row_data, 1):
        cell = ws_demo.cell(row=row_offset, column=c_idx, value=val)
        cell.font = font_normal
        cell.border = thin_border
        
        # 정렬 설정
        if c_idx in [1, 2, 3, 4, 6, 7, 8, 9]:
            cell.alignment = align_center
        elif c_idx in [5, 10]:
            cell.alignment = align_left
        elif c_idx in [11, 12]:
            cell.alignment = align_right
        elif c_idx <= valve_end:
            cell.alignment = align_center
            if val in ["O", "C"] or str(val).startswith("O+") or str(val).startswith("C+"):
                cell.font = Font(name="맑은 고딕", size=10, bold=True, color="1E3A8A")
                cell.fill = fill_highlight
        else:
            if c_idx == trail_start + 3: # 조기통과
                cell.alignment = align_center
                if val == "Y":
                    cell.font = Font(name="맑은 고딕", size=10, bold=True, color="047857")
                    cell.fill = fill_green_tag
            else:
                cell.alignment = align_left

# 열 너비 자동 조정
for col in ws_demo.columns:
    col_letter = get_column_letter(col[0].column)
    max_len = max(len(str(cell.value or '')) for cell in col)
    ws_demo.column_dimensions[col_letter].width = max(max_len + 4, 12)

ws_demo.column_dimensions['E'].width = 30 # Operations
ws_demo.column_dimensions['J'].width = 36 # Message
ws_demo.column_dimensions['L'].width = 16 # Acc,Time
ws_demo.column_dimensions[get_column_letter(total_cols)].width = 42 # Remarks

# 저장
output_path = r"d:\AI_Work\Antigravity\06.CEO\projects\plc-monitoring-v1\GMS_자동진행_시퀀스_템플릿.xlsx"
wb.save(output_path)
print("성공적으로 저장 완료:", output_path)
