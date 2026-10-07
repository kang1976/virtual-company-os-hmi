"""
P&ID 배관도 생성기 - 네온 적색 가스 글로우 파이프 스타일
참조: media_1790088218833.jpg (사용자 업로드 기준 이미지)

공정 순서:
실린더 Ass'y → HPT → LF → HPI → Reg1 → MPT → Reg2 → LPT → LPI → FPV → LF → FPT → PROCESS
"""

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math
import os

# ─── 캔버스 설정 ───────────────────────────────────────────────────────────────
W, H = 2400, 1200
bg_color = (13, 27, 42)          # 다크 네이비 슬레이트

img = Image.new("RGB", (W, H), bg_color)
draw = ImageDraw.Draw(img)

# ─── 글로우 레이어 (별도로 그려서 블러 합성) ──────────────────────────────────
glow_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
glow_draw = ImageDraw.Draw(glow_layer)

# ─── 폰트 ─────────────────────────────────────────────────────────────────────
try:
    font_tag   = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 22)
    font_label = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 18)
    font_small = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 14)
    font_title = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 28)
    font_bold  = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 22)
except:
    font_tag   = ImageFont.load_default()
    font_label = ImageFont.load_default()
    font_small = ImageFont.load_default()
    font_title = ImageFont.load_default()
    font_bold  = ImageFont.load_default()

# ─── 색상 팔레트 ───────────────────────────────────────────────────────────────
RED_CORE      = (255, 80,  80)    # 적색 가스 코어
RED_GLOW      = (200, 20,  20)    # 적색 외부 글로우
RED_HOT       = (255, 180, 180)   # 하이라이트 센터
PIPE_OUTER    = (70,  85,  100)   # 파이프 외부 (다크 스틸)
PIPE_MID      = (100, 120, 140)   # 파이프 중간
PIPE_HIGH     = (160, 185, 210)   # 파이프 하이라이트
VCR_DARK      = (50,  60,  75)    # VCR 피팅 어두운 부분
VCR_MID       = (90,  105, 125)   # VCR 피팅 중간
VCR_LIGHT     = (150, 170, 195)   # VCR 피팅 밝은 부분
CYAN_LED      = (0,   255, 220)   # 사이언 LED
GREEN_LED     = (0,   255, 100)   # 그린 LED
ORANGE_WARN   = (255, 140, 0)     # 오렌지 경고
WHITE         = (255, 255, 255)
DARK_PANEL    = (20,  35,  55)    # 패널 배경
LABEL_COL     = (200, 220, 255)   # 라벨 색

# ─── 유틸 함수 ─────────────────────────────────────────────────────────────────

def pipe_h(draw, glow_draw, x1, y, x2, pipe_r=18):
    """수평 적색 글로우 파이프 그리기"""
    # 외부 메탈 파이프
    draw.rectangle([x1, y - pipe_r, x2, y + pipe_r], fill=PIPE_OUTER)
    # 중간 그라데이션 효과 (수동 레이어)
    for i, col in enumerate([PIPE_MID, PIPE_HIGH, PIPE_MID, PIPE_OUTER]):
        band = pipe_r // 4
        yy = y - pipe_r + i * band * 2
        draw.rectangle([x1, yy, x2, yy + band * 2 - 1], fill=col)
    # 내부 적색 글로우 영역
    inner_r = int(pipe_r * 0.62)
    draw.rectangle([x1, y - inner_r, x2, y + inner_r], fill=RED_GLOW)
    # 내부 핫 코어
    core_r = max(2, int(pipe_r * 0.3))
    draw.rectangle([x1, y - core_r, x2, y + core_r], fill=RED_HOT)
    # 글로우 레이어 (블러용)
    glow_r = pipe_r + 12
    glow_draw.rectangle([x1 - 4, y - glow_r, x2 + 4, y + glow_r],
                        fill=(255, 0, 0, 60))

def pipe_v(draw, glow_draw, x, y1, y2, pipe_r=18):
    """수직 적색 글로우 파이프 그리기"""
    draw.rectangle([x - pipe_r, y1, x + pipe_r, y2], fill=PIPE_OUTER)
    for i, col in enumerate([PIPE_MID, PIPE_HIGH, PIPE_MID, PIPE_OUTER]):
        band = pipe_r // 4
        xx = x - pipe_r + i * band * 2
        draw.rectangle([xx, y1, xx + band * 2 - 1, y2], fill=col)
    inner_r = int(pipe_r * 0.62)
    draw.rectangle([x - inner_r, y1, x + inner_r, y2], fill=RED_GLOW)
    core_r = max(2, int(pipe_r * 0.3))
    draw.rectangle([x - core_r, y1, x + core_r, y2], fill=RED_HOT)
    glow_r = pipe_r + 12
    glow_draw.rectangle([x - glow_r, y1 - 4, x + glow_r, y2 + 4],
                        fill=(255, 0, 0, 60))

def elbow(draw, cx, cy, pipe_r=18):
    """90도 엘보 (원형 코너)"""
    r2 = pipe_r * 2
    draw.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], fill=PIPE_OUTER)
    draw.ellipse([cx - pipe_r, cy - pipe_r,
                  cx + pipe_r, cy + pipe_r], fill=RED_GLOW)
    core_r = max(2, int(pipe_r * 0.3))
    draw.ellipse([cx - core_r, cy - core_r,
                  cx + core_r, cy + core_r], fill=RED_HOT)

def vcr_fitting(draw, x, y, pipe_r=18):
    """VCR 메탈 칼라 피팅"""
    fw = int(pipe_r * 0.8)
    fh = pipe_r + 4
    # 피팅 몸체
    draw.rectangle([x - fw, y - fh, x + fw, y + fh], fill=VCR_MID)
    # 하이라이트
    draw.rectangle([x - fw, y - fh, x + fw, y - fh + 3], fill=VCR_LIGHT)
    draw.rectangle([x - fw, y + fh - 3, x + fw, y + fh], fill=VCR_DARK)
    # 중앙 가스 구멍
    inner_r = int(pipe_r * 0.55)
    draw.rectangle([x - inner_r, y - inner_r, x + inner_r, y + inner_r],
                   fill=RED_GLOW)

def draw_label_box(draw, x, y, tag, value="", unit="", w=130, h=60):
    """HUD 스타일 센서 라벨 박스"""
    # 배경
    draw.rectangle([x, y, x + w, y + h], fill=(15, 25, 50, 200))
    draw.rectangle([x, y, x + w, y + 2], fill=CYAN_LED)
    draw.rectangle([x, y, x + 2, y + h], fill=CYAN_LED)
    # 태그
    draw.text((x + 6, y + 6), tag, fill=CYAN_LED, font=font_label)
    if value:
        draw.text((x + 6, y + 28), value, fill=WHITE, font=font_tag)
    if unit:
        draw.text((x + 6, y + h - 18), unit, fill=(150, 170, 200), font=font_small)

def draw_pt_sensor(draw, cx, cy, tag, val="0.0 MPa", pipe_r=18):
    """압력 센서 (파이프 상단에 수직으로 마운트)"""
    sw, sh = 110, 55
    # 연결 스텁 (파이프에서 위로)
    draw.rectangle([cx - 5, cy - pipe_r - 25, cx + 5, cy - pipe_r],
                   fill=VCR_MID)
    # 센서 몸체
    sx = cx - sw // 2
    sy = cy - pipe_r - 25 - sh
    draw.rectangle([sx, sy, sx + sw, sy + sh], fill=DARK_PANEL)
    draw.rectangle([sx, sy, sx + sw, sy + 2], fill=CYAN_LED)
    draw.rectangle([sx + 1, sy, sx + 3, sy + sh], fill=CYAN_LED)
    draw.text((sx + 6, sy + 5),  tag,       fill=CYAN_LED,            font=font_label)
    draw.text((sx + 6, sy + 24), val,       fill=WHITE,               font=font_tag)
    draw.text((sx + 6, sy + 42), "Pressure", fill=(120, 150, 190),    font=font_small)

def draw_line_filter(draw, cx, cy, tag, pipe_r=18):
    """라인 필터 (인라인 원통형 필터)"""
    fw, fh = 60, pipe_r * 3
    # 필터 몸체 원통
    draw.rectangle([cx - fw, cy - fh, cx + fw, cy + fh], fill=(40, 55, 75))
    draw.rectangle([cx - fw, cy - fh, cx + fw, cy - fh + 4], fill=VCR_LIGHT)
    draw.rectangle([cx - fw, cy + fh - 4, cx + fw, cy + fh], fill=VCR_DARK)
    # 메쉬 패턴 (수직 그릴 라인)
    for i in range(-3, 4):
        x = cx + i * 16
        draw.rectangle([x - 2, cy - fh + 6, x + 2, cy + fh - 6],
                       fill=(60, 80, 105))
    # 내부 가스 통로 표시
    draw.rectangle([cx - pipe_r + 4, cy - pipe_r + 2,
                    cx + pipe_r - 4, cy + pipe_r - 2], fill=RED_GLOW)
    # 상단 dP 게이지
    gx, gy = cx, cy - fh - 20
    draw.ellipse([gx - 15, gy - 15, gx + 15, gy + 15], fill=(30, 45, 65))
    draw.ellipse([gx - 13, gy - 13, gx + 13, gy + 13], fill=(20, 35, 55))
    draw.line([gx, gy, gx + 8, gy - 6], fill=ORANGE_WARN, width=2)
    draw.rectangle([cx - 4, cy - fh - 5, cx + 4, cy - fh], fill=VCR_MID)
    # 라벨
    draw.text((cx - 20, cy + fh + 6), tag, fill=LABEL_COL, font=font_small)

def draw_air_valve(draw, cx, cy, tag, is_open=True, pipe_r=18):
    """공압 에어 밸브 (원통형 액추에이터 + 돔 LED)"""
    bw, bh = 42, 36  # 밸브 몸체
    ah = 50           # 액추에이터 높이
    aw = 28           # 액추에이터 폭
    led_col = GREEN_LED if is_open else (220, 0, 0)

    # 밸브 몸체 (인라인, 배관 위에)
    draw.rectangle([cx - bw, cy - bh, cx + bw, cy + bh], fill=(50, 70, 95))
    draw.rectangle([cx - bw, cy - bh, cx + bw, cy - bh + 3], fill=VCR_LIGHT)
    draw.rectangle([cx - bw, cy + bh - 3, cx + bw, cy + bh], fill=VCR_DARK)
    # 내부 통로
    draw.rectangle([cx - pipe_r + 2, cy - pipe_r + 3,
                    cx + pipe_r - 2, cy + pipe_r - 3], fill=RED_GLOW)
    # 액추에이터 실린더 (상단)
    draw.rectangle([cx - aw, cy - bh - ah, cx + aw, cy - bh], fill=(45, 65, 90))
    draw.rectangle([cx - aw, cy - bh - ah, cx + aw, cy - bh - ah + 3],
                   fill=(80, 110, 145))
    # 돔 LED
    dome_y = cy - bh - ah - 20
    draw.ellipse([cx - 16, dome_y - 16, cx + 16, dome_y + 16],
                 fill=(25, 40, 60))
    draw.ellipse([cx - 13, dome_y - 13, cx + 13, dome_y + 13],
                 fill=led_col)
    draw.ellipse([cx - 6, dome_y - 8, cx + 6, dome_y - 2],
                 fill=(255, 255, 255))
    # 태그 라벨
    draw.text((cx - 20, cy + bh + 6), tag, fill=LABEL_COL, font=font_small)

def draw_regulator(draw, cx, cy, tag, pipe_r=18):
    """레귤레이터 (3D 스테인리스 + 듀얼 게이지)"""
    bw, bh = 52, 44
    # 몸체
    draw.rectangle([cx - bw, cy - bh, cx + bw, cy + bh], fill=(50, 68, 90))
    draw.rectangle([cx - bw, cy - bh, cx + bw, cy - bh + 4], fill=VCR_LIGHT)
    draw.rectangle([cx - bw, cy + bh - 4, cx + bw, cy + bh], fill=VCR_DARK)
    # 몸체 측면 하이라이트
    draw.rectangle([cx - bw, cy - bh, cx - bw + 4, cy + bh], fill=(80, 105, 135))
    # 내부 통로
    draw.rectangle([cx - pipe_r + 2, cy - pipe_r + 3,
                    cx + pipe_r - 2, cy + pipe_r - 3], fill=RED_GLOW)
    # 상단 조절 노브
    draw.ellipse([cx - 10, cy - bh - 18, cx + 10, cy - bh],
                 fill=(60, 80, 105))
    draw.ellipse([cx - 7, cy - bh - 15, cx + 7, cy - bh - 2],
                 fill=(90, 115, 145))

    # 왼쪽 게이지 (입구 압력)
    for gx_off, gy_off in [(-28, -bh - 38), (28, -bh - 38)]:
        gx = cx + gx_off
        gy = cy + gy_off
        # 게이지 스템
        draw.rectangle([gx - 3, gy + 18, gx + 3, gy + 22], fill=VCR_MID)
        # 게이지 페이스
        draw.ellipse([gx - 18, gy - 18, gx + 18, gy + 18], fill=(20, 30, 48))
        draw.ellipse([gx - 17, gy - 17, gx + 17, gy + 17], fill=(30, 45, 68))
        # 눈금 (12개)
        for angle in range(0, 360, 30):
            rad = math.radians(angle)
            x1 = gx + int(12 * math.cos(rad))
            y1 = gy + int(12 * math.sin(rad))
            x2 = gx + int(15 * math.cos(rad))
            y2 = gy + int(15 * math.sin(rad))
            draw.line([x1, y1, x2, y2], fill=(80, 110, 150), width=1)
        # 바늘
        needle_ang = -30
        nx = gx + int(10 * math.cos(math.radians(needle_ang)))
        ny = gy + int(10 * math.sin(math.radians(needle_ang)))
        draw.line([gx, gy, nx, ny], fill=ORANGE_WARN, width=2)

    # 태그
    draw.text((cx - 20, cy + bh + 6), tag, fill=LABEL_COL, font=font_small)

def draw_cylinder_assy(draw, glow_draw, cx, cy):
    """실린더 어셈블리 (좌측 시작점)"""
    cw, ch = 70, 200

    # ─ 저울 베이스 ──
    sw = cw + 30
    draw.rectangle([cx - sw, cy + ch, cx + sw, cy + ch + 20],
                   fill=(40, 55, 75))
    draw.rectangle([cx - sw, cy + ch, cx + sw, cy + ch + 4],
                   fill=VCR_LIGHT)
    draw.text((cx - 30, cy + ch + 6), "45.2 kg", fill=CYAN_LED, font=font_small)

    # ─ 실린더 몸체 ──
    draw.rectangle([cx - cw, cy - ch, cx + cw, cy + ch], fill=(65, 80, 100))
    # 하이라이트
    draw.rectangle([cx - cw, cy - ch, cx - cw + 8, cy + ch],
                   fill=PIPE_HIGH)
    draw.rectangle([cx + cw - 8, cy - ch, cx + cw, cy + ch],
                   fill=PIPE_OUTER)
    # 자켓 히터 (중간 블랙-오렌지)
    jy1, jy2 = cy - 60, cy + 60
    draw.rectangle([cx - cw + 2, jy1, cx + cw - 2, jy2],
                   fill=(25, 25, 25))
    # 히터 줄 패턴
    for i in range(6):
        yy = jy1 + 10 + i * 17
        draw.rectangle([cx - cw + 4, yy, cx + cw - 4, yy + 8],
                       fill=(180, 70, 0))

    # 온도 HUD
    draw.rectangle([cx - 45, jy1 - 30, cx + 45, jy1 - 5],
                   fill=DARK_PANEL)
    draw.rectangle([cx - 45, jy1 - 30, cx + 45, jy1 - 28], fill=ORANGE_WARN)
    draw.text((cx - 38, jy1 - 26), "65.0°C", fill=WHITE, font=font_label)

    # LED 잔량 바
    bar_x = cx + cw + 5
    draw.rectangle([bar_x, cy - 80, bar_x + 12, cy + 80], fill=(20, 30, 45))
    for i in range(7):  # 85% ≈ 7/8
        seg_y = cy + 70 - i * 20
        col = (0, 200, 50) if i < 5 else (0, 255, 80)
        if i >= 7:
            col = (200, 200, 0)
        draw.rectangle([bar_x + 1, seg_y - 15, bar_x + 11, seg_y],
                       fill=col)

    # LEVEL 표시
    draw.text((cx - 35, cy - ch - 25), "LEVEL 85%",
              fill=(0, 255, 150), font=font_small)

    # ─ 넥 가드 (상단) ──
    nw = int(cw * 0.5)
    draw.rectangle([cx - nw, cy - ch - 40, cx + nw, cy - ch],
                   fill=(55, 70, 90))
    draw.rectangle([cx - nw, cy - ch - 40, cx + nw, cy - ch - 36],
                   fill=VCR_LIGHT)

    # ─ V/S 캡 ──
    vs_w = int(nw * 0.7)
    draw.rectangle([cx - vs_w, cy - ch - 60, cx + vs_w, cy - ch - 40],
                   fill=(40, 55, 75))
    draw.ellipse([cx - vs_w, cy - ch - 75, cx + vs_w, cy - ch - 50],
                 fill=(45, 60, 80))
    # V/S LED (적색 비상 잠금)
    draw.ellipse([cx - 6, cy - ch - 68, cx + 6, cy - ch - 56],
                 fill=(200, 0, 0))

    # ─ AG (토출구 오른쪽, 네온 링) ──
    ag_x = cx + nw
    ag_y = cy - ch - 20
    draw.rectangle([ag_x, ag_y - 8, ag_x + 30, ag_y + 8], fill=(40, 55, 75))
    draw.ellipse([ag_x + 20, ag_y - 10, ag_x + 40, ag_y + 10],
                 fill=(25, 40, 60))
    draw.ellipse([ag_x + 22, ag_y - 8, ag_x + 38, ag_y + 8],
                 fill=(0, 200, 255))
    draw.ellipse([ag_x + 27, ag_y - 3, ag_x + 33, ag_y + 3],
                 fill=(0, 100, 255))

    # 실린더 라벨
    draw.text((cx - 45, cy + ch + 26), "Cylinder Ass'y",
              fill=WHITE, font=font_label)

    # ─ 토출 파이프 연결구 (오른쪽 측면에서 배관으로) ──
    # 가스 출구 (실린더 우측 상단에서 수평으로 연장)
    out_y = cy - ch - 20
    draw.rectangle([cx + cw, out_y - 18, cx + cw + 20, out_y + 18],
                   fill=PIPE_OUTER)
    draw.rectangle([cx + cw, out_y - 10, cx + cw + 20, out_y + 10],
                   fill=RED_GLOW)

    return cx + cw + 20, out_y  # 파이프 시작 X, Y

def draw_process_outlet(draw, cx, cy, pipe_r=18):
    """PROCESS 출구 단말"""
    pw, ph = 90, 50
    draw.rectangle([cx, cy - ph // 2, cx + pw, cy + ph // 2],
                   fill=(20, 35, 60))
    draw.rectangle([cx, cy - ph // 2, cx + 3, cy + ph // 2], fill=ORANGE_WARN)
    draw.rectangle([cx, cy - ph // 2, cx + pw, cy - ph // 2 + 3],
                   fill=ORANGE_WARN)
    draw.text((cx + 8, cy - 12), "PROCESS", fill=WHITE, font=font_label)
    draw.text((cx + 8, cy + 6),  "OUTLET",  fill=(150, 180, 220), font=font_small)


# ═══════════════════════════════════════════════════════════════════════════════
#  메인 레이아웃
# ═══════════════════════════════════════════════════════════════════════════════

# 파이프 메인 Y 좌표 (상단 행, 하단 행)
Y_TOP = 400      # 상단 배관 중심선
Y_BOT = 750      # 하단 배관 중심선
PIPE_R = 18

# ─── 좌표 계획 ───────────────────────────────────────────────────────────────
# 상단 행: 실린더 → HPT → LF1 → HPI → Reg1 → MPT → (엘보 우측)
# 하단 행: (엘보 좌측) Reg2 → LPT → LPI → FPV → LF2 → FPT → PROCESS

CYL_CX = 170   # 실린더 중심 X

# 상단 행 컴포넌트 X 위치
HPT_X   = 340
LF1_X   = 500
HPI_X   = 680
REG1_X  = 880
MPT_X   = 1060
BEND_X  = 1220   # 우측 엘보

# 하단 행 컴포넌트 X 위치 (오른쪽→왼쪽으로 흐름, 그림상 왼쪽부터 배치)
REG2_X  = 1060
LPT_X   = 880
LPI_X   = 700
FPV_X   = 520
LF2_X   = 340
FPT_X   = 170
PROC_X  = 30   # PROCESS는 맨 왼쪽

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: 실린더 어셈블리 그리기
# ─────────────────────────────────────────────────────────────────────────────
pipe_start_x, pipe_start_y = draw_cylinder_assy(draw, glow_draw, CYL_CX, Y_TOP)

# 실린더에서 상단 메인 배관까지 수직 연결
pipe_v(draw, glow_draw, CYL_CX + 70 + 10, pipe_start_y, Y_TOP, PIPE_R)

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: 상단 메인 배관 그리기 (실린더 우측 → BEND_X)
# ─────────────────────────────────────────────────────────────────────────────
PIPE_START_X = CYL_CX + 70 + 10   # 실린더 오른쪽 끝

# 실린더 출구에서 HPT까지
pipe_h(draw, glow_draw, PIPE_START_X, Y_TOP, HPT_X - 20, PIPE_R)
vcr_fitting(draw, HPT_X - 20, Y_TOP, PIPE_R)

# HPT ~ LF1
pipe_h(draw, glow_draw, HPT_X + 20, Y_TOP, LF1_X - 60, PIPE_R)
vcr_fitting(draw, LF1_X - 60, Y_TOP, PIPE_R)

# LF1 ~ HPI
pipe_h(draw, glow_draw, LF1_X + 60, Y_TOP, HPI_X - 42, PIPE_R)
vcr_fitting(draw, HPI_X - 42, Y_TOP, PIPE_R)

# HPI ~ REG1
pipe_h(draw, glow_draw, HPI_X + 42, Y_TOP, REG1_X - 52, PIPE_R)
vcr_fitting(draw, REG1_X - 52, Y_TOP, PIPE_R)

# REG1 ~ MPT
pipe_h(draw, glow_draw, REG1_X + 52, Y_TOP, MPT_X - 20, PIPE_R)
vcr_fitting(draw, MPT_X - 20, Y_TOP, PIPE_R)

# MPT ~ BEND_X
pipe_h(draw, glow_draw, MPT_X + 20, Y_TOP, BEND_X, PIPE_R)

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: 수직 연결 (우측 엘보 BEND_X)
# ─────────────────────────────────────────────────────────────────────────────
elbow(draw, BEND_X, Y_TOP, PIPE_R)
pipe_v(draw, glow_draw, BEND_X, Y_TOP + PIPE_R, Y_BOT - PIPE_R, PIPE_R)
elbow(draw, BEND_X, Y_BOT, PIPE_R)

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: 하단 메인 배관 그리기 (BEND_X → PROCESS)
# ─────────────────────────────────────────────────────────────────────────────

# BEND_X ~ REG2
pipe_h(draw, glow_draw, REG2_X + 52, Y_BOT, BEND_X, PIPE_R)
vcr_fitting(draw, REG2_X + 52, Y_BOT, PIPE_R)

# REG2 ~ LPT
pipe_h(draw, glow_draw, LPT_X + 20, Y_BOT, REG2_X - 52, PIPE_R)
vcr_fitting(draw, REG2_X - 52, Y_BOT, PIPE_R)
vcr_fitting(draw, LPT_X + 20, Y_BOT, PIPE_R)

# LPT ~ LPI
pipe_h(draw, glow_draw, LPI_X + 42, Y_BOT, LPT_X - 20, PIPE_R)
vcr_fitting(draw, LPT_X - 20, Y_BOT, PIPE_R)
vcr_fitting(draw, LPI_X + 42, Y_BOT, PIPE_R)

# LPI ~ FPV
pipe_h(draw, glow_draw, FPV_X + 42, Y_BOT, LPI_X - 42, PIPE_R)
vcr_fitting(draw, LPI_X - 42, Y_BOT, PIPE_R)
vcr_fitting(draw, FPV_X + 42, Y_BOT, PIPE_R)

# FPV ~ LF2
pipe_h(draw, glow_draw, LF2_X + 60, Y_BOT, FPV_X - 42, PIPE_R)
vcr_fitting(draw, FPV_X - 42, Y_BOT, PIPE_R)
vcr_fitting(draw, LF2_X + 60, Y_BOT, PIPE_R)

# LF2 ~ FPT
pipe_h(draw, glow_draw, FPT_X + 20, Y_BOT, LF2_X - 60, PIPE_R)
vcr_fitting(draw, LF2_X - 60, Y_BOT, PIPE_R)
vcr_fitting(draw, FPT_X + 20, Y_BOT, PIPE_R)

# FPT ~ PROCESS
pipe_h(draw, glow_draw, PROC_X + 90, Y_BOT, FPT_X - 20, PIPE_R)
vcr_fitting(draw, FPT_X - 20, Y_BOT, PIPE_R)

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5: 컴포넌트 그리기 (파이프 위에 오버레이)
# ─────────────────────────────────────────────────────────────────────────────

# 상단 행 컴포넌트
draw_pt_sensor(draw, HPT_X, Y_TOP, "HPT", "12.5 MPa", PIPE_R)
draw_line_filter(draw, LF1_X, Y_TOP, "LF-1", PIPE_R)
draw_air_valve(draw, HPI_X, Y_TOP, "HPI", is_open=True, pipe_r=PIPE_R)
draw_regulator(draw, REG1_X, Y_TOP, "Reg-1", PIPE_R)
draw_pt_sensor(draw, MPT_X, Y_TOP, "MPT", "0.80 MPa", PIPE_R)

# 하단 행 컴포넌트
draw_regulator(draw, REG2_X, Y_BOT, "Reg-2", PIPE_R)
draw_pt_sensor(draw, LPT_X, Y_BOT, "LPT", "0.30 MPa", PIPE_R)
draw_air_valve(draw, LPI_X, Y_BOT, "LPI", is_open=True, pipe_r=PIPE_R)
draw_air_valve(draw, FPV_X, Y_BOT, "FPV", is_open=False, pipe_r=PIPE_R)
draw_line_filter(draw, LF2_X, Y_BOT, "LF-2", PIPE_R)
draw_pt_sensor(draw, FPT_X, Y_BOT, "FPT", "0.25 MPa", PIPE_R)

# PROCESS 출구
draw_process_outlet(draw, PROC_X, Y_BOT, PIPE_R)

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6: 글로우 레이어 블러 합성
# ─────────────────────────────────────────────────────────────────────────────
glow_blurred = glow_layer.filter(ImageFilter.GaussianBlur(radius=18))
img_rgba = img.convert("RGBA")
img_rgba = Image.alpha_composite(img_rgba, glow_blurred)
img = img_rgba.convert("RGB")
draw = ImageDraw.Draw(img)

# ─────────────────────────────────────────────────────────────────────────────
# STEP 7: 타이틀 / 배경 장식
# ─────────────────────────────────────────────────────────────────────────────
# 상단 타이틀 바
draw.rectangle([0, 0, W, 55], fill=(8, 18, 35))
draw.rectangle([0, 53, W, 57], fill=CYAN_LED)
draw.text((30, 14), "GAS CABINET P&ID  —  RED GAS PROCESS LINE", 
          fill=WHITE, font=font_bold)
draw.text((W - 350, 14), "REV.04  |  MONITORING", 
          fill=(150, 180, 220), font=font_label)

# 흐름 방향 화살표 (상단 행 오른쪽)
for x in [600, 780]:
    pts = [(x, Y_TOP - 32), (x + 20, Y_TOP - 20), (x, Y_TOP - 8)]
    draw.polygon(pts, fill=(255, 60, 60))

# 흐름 방향 화살표 (하단 행 왼쪽)
for x in [800, 600, 420]:
    pts = [(x, Y_BOT - 32), (x - 20, Y_BOT - 20), (x, Y_BOT - 8)]
    draw.polygon(pts, fill=(255, 60, 60))

# 공정 순서 텍스트 (하단)
seq_text = ("PROCESS SEQUENCE:  Cylinder Ass'y → HPT → LF → HPI → Reg-1 → "
            "MPT → Reg-2 → LPT → LPI → FPV → LF → FPT → PROCESS")
draw.text((30, H - 40), seq_text, fill=(100, 140, 180), font=font_small)

# 격자 배경 (미묘한 그리드)
for gx in range(0, W, 60):
    draw.line([gx, 60, gx, H - 50], fill=(20, 32, 48), width=1)
for gy in range(60, H - 50, 60):
    draw.line([0, gy, W, gy], fill=(20, 32, 48), width=1)

# ─────────────────────────────────────────────────────────────────────────────
# STEP 8: 저장
# ─────────────────────────────────────────────────────────────────────────────
out_path = (r"C:\Users\rokaf\.gemini\antigravity\brain"
            r"\9bf099c1-610b-408f-b5e2-f7535255d281"
            r"\pid_neon_redgas_v4.png")
img.save(out_path, "PNG", optimize=False)
print(f"[OK] 저장 완료: {out_path}")
print(f"     이미지 크기: {W} x {H}")
