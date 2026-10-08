import sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from PIL import Image, ImageDraw, ImageFont
import openpyxl
from openpyxl.drawing.image import Image as OpenpyxlImage
from openpyxl.styles import Font, PatternFill, Alignment

os.makedirs('flowchart_images_hd', exist_ok=True)
target_file = 'GMS_자동진행_시퀀스_표준템플릿_v4.xlsx'

# Try to find Korean font
font_candidates = [
    "C:/Windows/Fonts/malgun.ttf",
    "C:/Windows/Fonts/malgunbd.ttf",
    "C:/Windows/Fonts/gulim.ttc",
    "C:/Windows/Fonts/batang.ttc"
]
font_path = "C:/Windows/Fonts/malgun.ttf"
for f in font_candidates:
    if os.path.exists(f):
        font_path = f
        break

print('Using font:', font_path)

def create_flowchart_image(title, steps, out_path, is_wide=True):
    # Palette
    BG_COLOR = "#F8FAFC"
    BORDER_COLOR = "#CBD5E1"
    START_BG = "#1E40AF"
    START_TEXT = "#FFFFFF"
    STEP_BG = "#EFF6FF"
    STEP_BORDER = "#3B82F6"
    STEP_TEXT = "#1E3A8A"
    COND_BG = "#FEF3C7"
    COND_BORDER = "#F59E0B"
    COND_TEXT = "#B45309"
    ALARM_BG = "#FEE2E2"
    ALARM_BORDER = "#EF4444"
    ALARM_TEXT = "#B91C1C"
    PASS_BG = "#D1FAE5"
    PASS_BORDER = "#10B981"
    PASS_TEXT = "#047857"
    ARROW_COLOR = "#64748B"
    LABEL_BG = "#F1F5F9"

    BOX_W = 620
    BOX_H = 75
    SPACING = 45
    MARGIN_X = 50
    MARGIN_Y = 40
    
    total_h = MARGIN_Y * 2 + len(steps) * BOX_H + (len(steps) - 1) * SPACING
    img_w = BOX_W + MARGIN_X * 2
    
    img = Image.new("RGBA", (img_w, total_h), BG_COLOR)
    draw = ImageDraw.Draw(img)
    
    title_font = ImageFont.truetype(font_path, 15)
    body_font = ImageFont.truetype(font_path, 12)
    small_font = ImageFont.truetype(font_path, 11)
    
    y = MARGIN_Y
    for i, step in enumerate(steps):
        s_type = step.get('type', 'step')
        s_title = step.get('title', '')
        s_sub = step.get('sub', '')
        s_transition = step.get('transition', '')
        
        # Determine colors
        if s_type == 'start':
            bg, border, text_c = START_BG, START_BG, START_TEXT
            radius = 35
        elif s_type == 'end':
            bg, border, text_c = PASS_BG, PASS_BORDER, PASS_TEXT
            radius = 35
        elif s_type == 'cond':
            bg, border, text_c = COND_BG, COND_BORDER, COND_TEXT
            radius = 10
        elif s_type == 'alarm':
            bg, border, text_c = ALARM_BG, ALARM_BORDER, ALARM_TEXT
            radius = 10
        else:
            bg, border, text_c = STEP_BG, STEP_BORDER, STEP_TEXT
            radius = 10
        
        # Draw Box
        x0, y0 = MARGIN_X, y
        x1, y1 = MARGIN_X + BOX_W, y + BOX_H
        draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=bg, outline=border, width=2)
        
        # Draw Text centered
        if s_sub:
            draw.text((img_w // 2, y0 + 22), s_title, font=title_font, fill=text_c, anchor="mm")
            draw.text((img_w // 2, y0 + 50), s_sub, font=body_font, fill=text_c, anchor="mm")
        else:
            draw.text((img_w // 2, y0 + BOX_H // 2), s_title, font=title_font, fill=text_c, anchor="mm")
            
        # Draw Arrow to next
        if i < len(steps) - 1:
            arrow_y0 = y1
            arrow_y1 = y1 + SPACING
            arrow_x = img_w // 2
            draw.line([(arrow_x, arrow_y0), (arrow_x, arrow_y1)], fill=ARROW_COLOR, width=2)
            # Arrow head
            draw.polygon([(arrow_x, arrow_y1), (arrow_x - 5, arrow_y1 - 8), (arrow_x + 5, arrow_y1 - 8)], fill=ARROW_COLOR)
            
            # Transition label
            if s_transition:
                t_w = len(s_transition) * 9 + 20
                lx0, ly0 = arrow_x - t_w // 2, arrow_y0 + 12
                lx1, ly1 = arrow_x + t_w // 2, arrow_y0 + 32
                draw.rounded_rectangle([lx0, ly0, lx1, ly1], radius=4, fill=LABEL_BG, outline="#CBD5E1", width=1)
                draw.text((arrow_x, arrow_y0 + 22), s_transition, font=small_font, fill="#475569", anchor="mm")
        
        y += BOX_H + SPACING

    img.save(out_path, "PNG")
    print(f"Generated HD Flowchart: {out_path} ({img_w}x{total_h})")

# Define full data for all 7 sheets
diagrams = [
    ('예제1_단순개폐', 24, [
        {'type': 'start', 'title': '[공정 시작] 예제1_단순개폐', 'transition': ''},
        {'type': 'step', 'title': '[Step 1] 전 밸브 안전 Close (5초)', 'sub': '• VN1=C, VN2=C, PNV=C, HPV=C', 'transition': '5초 카운트다운 완료'},
        {'type': 'step', 'title': '[Step 2] 질소 가스 공급 개방 (30초)', 'sub': '• VN1=O, PNV=O (나머지 밸브 상태유지)', 'transition': '30초 카운트다운 완료'},
        {'type': 'step', 'title': '[Step 3] 질소 차단 및 대기 (10초)', 'sub': '• VN1=C, PNV=C 닫고 안정화 대기', 'transition': '10초 카운트다운 완료'},
        {'type': 'end', 'title': '[공정 완료] 정상 종료', 'transition': ''}
    ]),
    ('예제2_조기통과', 24, [
        {'type': 'start', 'title': '[공정 시작] 예제2_조기통과', 'transition': ''},
        {'type': 'step', 'title': '[Step 1] 진공 배기 준비 (10초)', 'sub': '• 전 밸브 Close 안전 초기화', 'transition': '10초 경과 후 자동진행'},
        {'type': 'cond', 'title': '[Step 2] 진공 배기 및 압력 감시 (최대 120초)', 'sub': '• 감시 조건: VPT <= 0.5 Torr 도달 시 조기 통과', 'transition': 'VPT <= 0.5 Torr 도달 (조기통과!)'},
        {'type': 'step', 'title': '[Step 3] 목표 도달 확인 및 완료 (5초)', 'sub': '• 배기 건전성 확인 완료', 'transition': '5초 경과 완료'},
        {'type': 'end', 'title': '[공정 완료] 정상 종료', 'transition': ''}
    ]),
    ('예제3_수동확인', 24, [
        {'type': 'start', 'title': '[공정 시작] 예제3_수동확인', 'transition': ''},
        {'type': 'step', 'title': '[Step 1] 시험 압력 가압 진행 (20초)', 'sub': '• VN1=O, PNV=O (가스 주입)', 'transition': '20초 가압 완료'},
        {'type': 'cond', 'title': '[Step 2] 작업자 육안 확인 대기 (ACK)', 'sub': '• 현장 게이지 확인 후 HMI 화면의 [확인] 버튼 클릭 시까지 무한 대기', 'transition': '작업자 [확인] 클릭'},
        {'type': 'step', 'title': '[Step 3] 가압 해제 및 배기 (10초)', 'sub': '• HPV=O (배기 밸브 Open)', 'transition': '10초 배기 완료'},
        {'type': 'end', 'title': '[공정 완료] 정상 종료', 'transition': ''}
    ]),
    ('예제4_지연개폐', 20, [
        {'type': 'start', 'title': '[공정 시작] 예제4_지연개폐', 'transition': ''},
        {'type': 'step', 'title': '[Step 1] 충격 방지 순차 지연 개방 (총 15초)', 'sub': '• T+0s: VN2 Open ➔ T+2s: LPV Open ➔ T+4s: HPIV Open', 'transition': '15초 순차 개방 완료'},
        {'type': 'step', 'title': '[Step 2] 순차 지연 닫힘 제어 (총 10초)', 'sub': '• T+0s: VN2 Close ➔ T+2s: LPV Close ➔ T+3s: HPIV Close', 'transition': '10초 순차 닫힘 완료'},
        {'type': 'end', 'title': '[공정 완료] 정상 종료', 'transition': ''}
    ]),
    ('예제5_반복루프', 28, [
        {'type': 'start', 'title': '[공정 시작] 예제5_반복루프', 'transition': ''},
        {'type': 'step', 'title': '[Step 1] 루프 준비 - 전 밸브 Close (5초)', 'sub': '• 안전 초기화 완료', 'transition': '5초 경과'},
        {'type': 'step', 'title': '[Step 2] 퍼지 가스 가압 (10초) ★ 루프 시작점', 'sub': '• VN1=O, PNV=O (반복 목적지)', 'transition': '10초 가압 완료'},
        {'type': 'cond', 'title': '[Step 3] 배기 진행 및 3회 반복 판정 (15초)', 'sub': '• 조건: 진행 횟수 >= 3회 ? (미달 시 Step 2 루프백)', 'transition': '3회 반복 완료 [Step 4 탈출]'},
        {'type': 'step', 'title': '[Step 4] 3회 반복 완료 및 정상 종료 (5초)', 'sub': '• 전 밸브 Close 안정화', 'transition': '5초 완료'},
        {'type': 'end', 'title': '[공정 완료] 정상 종료', 'transition': ''}
    ]),
    ('예제6_누출시험', 29, [
        {'type': 'start', 'title': '[공정 시작] 예제6_누출시험', 'transition': ''},
        {'type': 'step', 'title': '[Step 1] 배관 시험 진공 배기 (30초)', 'sub': '• HPV=O, PNV=O (진공 형성)', 'transition': '30초 배기 완료'},
        {'type': 'step', 'title': '[Step 2] 배관 밀폐 및 초기 압력 캡처 (5초)', 'sub': '• 전 밸브 Close, P0 압력 메모리 저장', 'transition': '5초 캡처 완료'},
        {'type': 'cond', 'title': '[Step 3] 정밀 누출 감시 (60초)', 'sub': '• 감시: VPT 변동량 <= 0.05 Torr (초과 시 Step 99 비상 알람)', 'transition': '압력변동 <= 0.05 Torr (누출 없음 합격)'},
        {'type': 'step', 'title': '[Step 4] 누출 시험 합격 및 완료 (5초)', 'sub': '• 배관 건전성 검증 완료', 'transition': '5초 완료'},
        {'type': 'end', 'title': '[공정 완료] 정상 종료', 'transition': ''}
    ]),
    ('Bypass_v1', 45, [
        {'type': 'start', 'title': '[공정 시작] Bypass_v1 종합 실전', 'transition': ''},
        {'type': 'step', 'title': '[Step 1] 전 밸브 안전 초기화 (5초)', 'sub': '• 전 밸브 Close', 'transition': '초기화 완료'},
        {'type': 'step', 'title': '[Step 2] 1차 질소 공급 및 퍼지 (20초)', 'sub': '• VN1=O, PNV=O', 'transition': '20초 퍼지 완료'},
        {'type': 'cond', 'title': '[Step 3] 2차 진공 배기 120초 (조기통과 Y)', 'sub': '• VPT <= 0.5 Torr 도달 시 즉시 통과', 'transition': '0.5 Torr 도달 (조기통과)'},
        {'type': 'cond', 'title': '[Step 4] 작업자 육안 확인 대기 (ACK)', 'sub': '• 현장 점검 후 화면 [확인] 클릭 시까지 대기', 'transition': '작업자 [확인] 클릭'},
        {'type': 'step', 'title': '[Step 5] 순차 지연 개방 제어 (15초)', 'sub': '• VN2(0s) ➔ LPV(2s) ➔ HPIV(4s)', 'transition': '순차 개방 완료'},
        {'type': 'step', 'title': '[Step 6~7] 3회 반복 퍼지 & 배기 판정', 'sub': '• 가압(10s) ➔ 배기(15s) 3회 반복 사이클', 'transition': '3회 반복 완료'},
        {'type': 'step', 'title': '[Step 8] 전 밸브 Close 및 완료 (5초)', 'sub': '• Bypass 공정 안전 종료', 'transition': '5초 완료'},
        {'type': 'end', 'title': '[공정 완료] Bypass 전 공정 정상 완료', 'transition': ''}
    ])
]

# Generate all images
for idx, (s_name, _, s_steps) in enumerate(diagrams, 1):
    out_file = f'flowchart_images_hd/flowchart_{idx}.png'
    create_flowchart_image(s_name, s_steps, out_file)

# Embed into Excel
wb = openpyxl.load_workbook(target_file)
header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
header_font = Font(name="맑은 고딕", size=12, bold=True, color="FFFFFF")

for idx, (sheet_name, insert_r, _) in enumerate(diagrams, 1):
    ws = wb[sheet_name]
    img_path = f'flowchart_images_hd/flowchart_{idx}.png'
    
    # Title banner
    banner_cell = ws.cell(row=insert_r, column=1, value=f"🖼️ [공정 플로우차트 와이드(Wide) 고화질 다이어그램 - {sheet_name}]")
    ws.merge_cells(start_row=insert_r, start_column=1, end_row=insert_r, end_column=12)
    banner_cell.fill = header_fill
    banner_cell.font = header_font
    banner_cell.alignment = Alignment(horizontal="center", vertical="center")
    
    # Add Image
    img = OpenpyxlImage(img_path)
    target_cell = f"B{insert_r + 2}"
    ws.add_image(img, target_cell)
    print(f"Embedded into [{sheet_name}] at {target_cell}")

wb.save(target_file)
print(f"\nALL 7 HD WIDE FLOWCHARTS PERFECTLY SAVED TO {target_file}!")
