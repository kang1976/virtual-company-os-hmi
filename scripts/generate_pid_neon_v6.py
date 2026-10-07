"""
P&ID 배관도 v6 - 최종 수정
- 실린더↔상단배관 연결 수직파이프 확실히 표시
- 캔버스 전체 활용 (BEND_X = W - 80)
- 파트 간격 균등 배분
- 글로우 강화
"""

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math

W, H = 2400, 1050
bg_color = (10, 20, 38)

img = Image.new("RGB", (W, H), bg_color)
draw = ImageDraw.Draw(img)
glow_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
glow_draw  = ImageDraw.Draw(glow_layer)

try:
    fnt_tag   = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 26)
    fnt_label = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 22)
    fnt_small = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 18)
    fnt_xs    = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 15)
    fnt_title = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 30)
    fnt_bold  = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 24)
except:
    fnt_tag   = ImageFont.load_default()
    fnt_label = fnt_tag; fnt_small = fnt_tag
    fnt_xs    = fnt_tag; fnt_title = fnt_tag; fnt_bold = fnt_tag

# 색상
P_DARK  = (28, 40, 58)
P_MID   = (52, 70, 95)
P_LIGHT = (85, 110, 142)
P_HIGH  = (130, 160, 200)
G_GLOW  = (170, 8,   8)
G_MID   = (225, 35,  35)
G_CORE  = (255, 110, 110)
G_WHITE = (255, 200, 200)
V_DARK  = (40,  54,  72)
V_MID   = (72,  92,  118)
V_LIGHT = (122, 150, 185)
CYAN    = (0,   240, 220)
GREEN   = (0,   230, 90)
RED_LED = (255, 40,  40)
ORANGE  = (255, 140, 0)
WHITE   = (255, 255, 255)
PANEL   = (14,  24,  48)
LABEL_C = (185, 210, 255)
AMBER   = (255, 160, 0)

PIPE_R  = 30   # 파이프 반지름 (굵게)


# ─── 파이프 드로잉 함수 ──────────────────────────────────────────────────────

def draw_pipe_h(x1, y, x2, r=PIPE_R):
    if x1 >= x2: return
    bw = r * 2
    # 외부 쉘 (다크)
    draw.rectangle([x1, y-r, x2, y+r], fill=P_DARK)
    # 하이라이트 그라데이션 (위 밝음)
    segments = [
        (0,           int(bw*0.10), P_HIGH),
        (int(bw*0.10), int(bw*0.28), P_LIGHT),
        (int(bw*0.28), int(bw*0.55), P_MID),
        (int(bw*0.55), int(bw*0.80), P_DARK),
        (int(bw*0.80), bw,           (18, 28, 42)),
    ]
    for bs, be, col in segments:
        draw.rectangle([x1, y-r+bs, x2, y-r+be], fill=col)
    # 내부 적색 가스
    gr = int(r*0.68); draw.rectangle([x1, y-gr, x2, y+gr], fill=G_GLOW)
    mr = int(r*0.44); draw.rectangle([x1, y-mr, x2, y+mr], fill=G_MID)
    cr = int(r*0.22); draw.rectangle([x1, y-cr, x2, y+cr], fill=G_CORE)
    hr = max(2, int(r*0.10)); draw.rectangle([x1, y-hr, x2, y+hr], fill=G_WHITE)
    # 글로우
    glow_draw.rectangle([x1-4, y-r-24, x2+4, y+r+24], fill=(210, 0, 0, 52))


def draw_pipe_v(x, y1, y2, r=PIPE_R):
    if y1 >= y2: return
    bw = r * 2
    draw.rectangle([x-r, y1, x+r, y2], fill=P_DARK)
    segments = [
        (0,           int(bw*0.10), P_HIGH),
        (int(bw*0.10), int(bw*0.28), P_LIGHT),
        (int(bw*0.28), int(bw*0.55), P_MID),
        (int(bw*0.55), int(bw*0.80), P_DARK),
        (int(bw*0.80), bw,           (18, 28, 42)),
    ]
    for bs, be, col in segments:
        draw.rectangle([x-r+bs, y1, x-r+be, y2], fill=col)
    gr = int(r*0.68); draw.rectangle([x-gr, y1, x+gr, y2], fill=G_GLOW)
    mr = int(r*0.44); draw.rectangle([x-mr, y1, x+mr, y2], fill=G_MID)
    cr = int(r*0.22); draw.rectangle([x-cr, y1, x+cr, y2], fill=G_CORE)
    hr = max(2, int(r*0.10)); draw.rectangle([x-hr, y1, x+hr, y2], fill=G_WHITE)
    glow_draw.rectangle([x-r-24, y1-4, x+r+24, y2+4], fill=(210, 0, 0, 52))


def draw_elbow(cx, cy, r=PIPE_R):
    er = r + 14
    draw.ellipse([cx-er, cy-er, cx+er, cy+er], fill=P_MID)
    draw.ellipse([cx-r,  cy-r,  cx+r,  cy+r],  fill=P_HIGH)
    gr = int(r*0.68); draw.ellipse([cx-gr, cy-gr, cx+gr, cy+gr], fill=G_GLOW)
    mr = int(r*0.44); draw.ellipse([cx-mr, cy-mr, cx+mr, cy+mr], fill=G_MID)
    cr = int(r*0.22); draw.ellipse([cx-cr, cy-cr, cx+cr, cy+cr], fill=G_CORE)
    glow_draw.ellipse([cx-r-26, cy-r-26, cx+r+26, cy+r+26], fill=(210, 0, 0, 70))


def draw_vcr(cx, cy, r=PIPE_R):
    fw = int(r*0.90); fh = r + 10
    draw.rectangle([cx-fw, cy-fh, cx+fw, cy+fh], fill=V_MID)
    draw.rectangle([cx-fw, cy-fh,    cx+fw, cy-fh+5],  fill=V_LIGHT)
    draw.rectangle([cx-fw, cy+fh-5,  cx+fw, cy+fh],    fill=V_DARK)
    draw.rectangle([cx-fw, cy-fh,    cx-fw+4, cy+fh],  fill=V_LIGHT)
    draw.rectangle([cx+fw-4, cy-fh,  cx+fw, cy+fh],    fill=V_DARK)
    gr = int(r*0.62); draw.rectangle([cx-gr, cy-gr, cx+gr, cy+gr], fill=G_MID)


# ─── 파트 드로잉 함수 ──────────────────────────────────────────────────────

def draw_pt(cx, cy, tag, val, r=PIPE_R):
    """압력 센서"""
    stub = 38
    draw.rectangle([cx-7, cy-r-stub, cx+7, cy-r], fill=V_MID)
    sw, sh = 148, 76
    sx, sy = cx-sw//2, cy-r-stub-sh
    draw.rectangle([sx, sy, sx+sw, sy+sh], fill=PANEL)
    draw.rectangle([sx, sy,    sx+sw, sy+3],  fill=CYAN)
    draw.rectangle([sx, sy,    sx+3,  sy+sh], fill=CYAN)
    draw.text((sx+8, sy+8),  tag,       fill=CYAN,   font=fnt_label)
    draw.text((sx+8, sy+32), val,       fill=WHITE,  font=fnt_tag)
    draw.text((sx+8, sy+58), "MPa",     fill=(100,140,190), font=fnt_xs)


def draw_lf(cx, cy, tag, r=PIPE_R):
    """라인 필터"""
    fw = 76; fh = r + 34
    draw.rectangle([cx-fw, cy-fh, cx+fw, cy+fh], fill=(28, 40, 60))
    # 외부 엔드 캡
    for side, col in [(-fw, V_LIGHT), (fw-5, V_DARK)]:
        draw.rectangle([cx+side, cy-fh, cx+side+5, cy+fh], fill=col)
    draw.rectangle([cx-fw, cy-fh, cx+fw, cy-fh+5], fill=V_LIGHT)
    draw.rectangle([cx-fw, cy+fh-5, cx+fw, cy+fh], fill=V_DARK)
    # 메쉬 그릴
    for i in range(-5, 6):
        lx = cx + i * 13
        col = (44, 62, 84) if abs(i) % 2 == 0 else (36, 52, 72)
        draw.rectangle([lx-4, cy-fh+7, lx+4, cy+fh-7], fill=col)
    # 내부 가스 통로 (오버레이)
    gr = int(r*0.68); draw.rectangle([cx-fw, cy-gr, cx+fw, cy+gr], fill=G_GLOW)
    mr = int(r*0.44); draw.rectangle([cx-fw, cy-mr, cx+fw, cy+mr], fill=G_MID)
    cr = int(r*0.22); draw.rectangle([cx-fw, cy-cr, cx+fw, cy+cr], fill=G_CORE)
    # dP 게이지
    gx, gy = cx, cy - fh - 34
    draw.rectangle([cx-5, cy-fh-5, cx+5, cy-fh], fill=V_MID)
    draw.ellipse([gx-24, gy-24, gx+24, gy+24], fill=(22, 34, 54))
    draw.ellipse([gx-22, gy-22, gx+22, gy+22], fill=(16, 26, 44))
    for ang in range(0, 360, 30):
        rad = math.radians(ang)
        x1=gx+int(15*math.cos(rad)); y1=gy+int(15*math.sin(rad))
        x2=gx+int(21*math.cos(rad)); y2=gy+int(21*math.sin(rad))
        draw.line([x1,y1,x2,y2], fill=(58,82,115), width=1)
    ang = math.radians(-45)
    draw.line([gx,gy, gx+int(14*math.cos(ang)),gy+int(14*math.sin(ang))],
              fill=ORANGE, width=2)
    draw.text((cx-22, cy+fh+8), tag, fill=LABEL_C, font=fnt_small)


def draw_av(cx, cy, tag, is_open=True, r=PIPE_R):
    """에어 밸브"""
    bw=56; bh=46; aw=38; ah=70
    led_col = GREEN if is_open else RED_LED
    # 밸브 몸체
    draw.rectangle([cx-bw, cy-bh, cx+bw, cy+bh], fill=(35, 50, 72))
    draw.rectangle([cx-bw, cy-bh,   cx+bw, cy-bh+5], fill=V_LIGHT)
    draw.rectangle([cx-bw, cy+bh-5, cx+bw, cy+bh],   fill=V_DARK)
    draw.rectangle([cx-bw, cy-bh,   cx-bw+5, cy+bh], fill=V_LIGHT)
    # 내부 가스
    gr=int(r*0.68); draw.rectangle([cx-bw, cy-gr, cx+bw, cy+gr], fill=G_GLOW)
    mr=int(r*0.44); draw.rectangle([cx-bw, cy-mr, cx+bw, cy+mr], fill=G_MID)
    cr=int(r*0.22); draw.rectangle([cx-bw, cy-cr, cx+bw, cy+cr], fill=G_CORE)
    # 액추에이터
    draw.rectangle([cx-aw, cy-bh-ah, cx+aw, cy-bh], fill=(35, 50, 74))
    draw.rectangle([cx-aw, cy-bh-ah,   cx+aw, cy-bh-ah+5], fill=(68, 92, 128))
    draw.rectangle([cx-aw, cy-bh-ah,   cx-aw+4, cy-bh], fill=(68, 92, 128))
    # 리브
    for ly in range(cy-bh-ah+14, cy-bh, 22):
        draw.rectangle([cx-aw+4, ly, cx+aw-4, ly+5], fill=(22, 34, 52))
    # 돔 LED
    dy = cy-bh-ah-26
    draw.ellipse([cx-22, dy-22, cx+22, dy+22], fill=(18, 30, 50))
    draw.ellipse([cx-19, dy-19, cx+19, dy+19], fill=led_col)
    draw.ellipse([cx-9,  dy-16, cx+9,  dy-4],  fill=(255,255,255))
    glow_draw.ellipse([cx-26, dy-26, cx+26, dy+26], fill=(*led_col, 80))
    draw.text((cx-25, cy+bh+8), tag, fill=LABEL_C, font=fnt_small)


def draw_reg(cx, cy, tag, r=PIPE_R):
    """레귤레이터"""
    bw=68; bh=56
    draw.rectangle([cx-bw, cy-bh, cx+bw, cy+bh], fill=(35, 50, 72))
    draw.rectangle([cx-bw, cy-bh,   cx+bw, cy-bh+5], fill=V_LIGHT)
    draw.rectangle([cx-bw, cy+bh-5, cx+bw, cy+bh],   fill=V_DARK)
    draw.rectangle([cx-bw, cy-bh,   cx-bw+6, cy+bh], fill=P_HIGH)
    draw.rectangle([cx+bw-6, cy-bh, cx+bw, cy+bh],   fill=P_DARK)
    # 내부 가스
    gr=int(r*0.68); draw.rectangle([cx-bw, cy-gr, cx+bw, cy+gr], fill=G_GLOW)
    mr=int(r*0.44); draw.rectangle([cx-bw, cy-mr, cx+bw, cy+mr], fill=G_MID)
    cr=int(r*0.22); draw.rectangle([cx-bw, cy-cr, cx+bw, cy+cr], fill=G_CORE)
    # 노브
    draw.ellipse([cx-13, cy-bh-24, cx+13, cy-bh],   fill=(48, 66, 92))
    draw.ellipse([cx-10, cy-bh-21, cx+10, cy-bh-2], fill=(72, 96, 132))
    # 듀얼 게이지
    for gx_off in [-36, 36]:
        gx = cx + gx_off
        gy = cy - bh - 58
        draw.rectangle([gx-5, gy+22, gx+5, gy+28], fill=V_MID)
        draw.ellipse([gx-24, gy-24, gx+24, gy+24], fill=(18, 28, 46))
        draw.ellipse([gx-22, gy-22, gx+22, gy+22], fill=(26, 40, 62))
        for ang in range(0, 360, 30):
            rad=math.radians(ang)
            x1=gx+int(15*math.cos(rad)); y1=gy+int(15*math.sin(rad))
            x2=gx+int(20*math.cos(rad)); y2=gy+int(20*math.sin(rad))
            draw.line([x1,y1,x2,y2], fill=(55,82,118), width=1)
        # 바늘 방향 다르게
        nang = math.radians(-55 if gx_off < 0 else -30)
        draw.line([gx,gy, gx+int(14*math.cos(nang)),gy+int(14*math.sin(nang))],
                  fill=ORANGE, width=2)
        draw.ellipse([gx-3,gy-3,gx+3,gy+3], fill=ORANGE)
    draw.text((cx-25, cy+bh+8), tag, fill=LABEL_C, font=fnt_small)


def draw_cylinder(cx_cyl, cy_cyl):
    """실린더 어셈블리"""
    cw=90; ch=200
    cy_top = cy_cyl - ch
    cy_bot = cy_cyl + ch

    # 저울
    sw = cw + 38
    draw.rectangle([cx_cyl-sw, cy_bot, cx_cyl+sw, cy_bot+26], fill=(35, 50, 72))
    draw.rectangle([cx_cyl-sw, cy_bot, cx_cyl+sw, cy_bot+5], fill=V_LIGHT)
    draw.rectangle([cx_cyl-sw-3, cy_bot, cx_cyl-sw, cy_bot+26], fill=V_LIGHT)
    draw.text((cx_cyl-42, cy_bot+7), "45.2 kg", fill=CYAN, font=fnt_label)

    # 실린더 몸체
    draw.rectangle([cx_cyl-cw, cy_top, cx_cyl+cw, cy_bot], fill=(58, 74, 96))
    draw.rectangle([cx_cyl-cw, cy_top, cx_cyl-cw+12, cy_bot], fill=P_HIGH)
    draw.rectangle([cx_cyl+cw-12, cy_top, cx_cyl+cw, cy_bot], fill=P_DARK)

    # 자켓 히터
    jy1, jy2 = cy_cyl - 90, cy_cyl + 90
    draw.rectangle([cx_cyl-cw+2, jy1, cx_cyl+cw-2, jy2], fill=(18, 18, 18))
    for i in range(8):
        yy = jy1 + 8 + i*21
        draw.rectangle([cx_cyl-cw+4, yy, cx_cyl+cw-4, yy+12], fill=(150, 55, 0))
        draw.rectangle([cx_cyl-cw+4, yy, cx_cyl+cw-4, yy+3],  fill=(210, 90, 0))

    # 온도 HUD
    draw.rectangle([cx_cyl-58, jy1-44, cx_cyl+58, jy1-8], fill=PANEL)
    draw.rectangle([cx_cyl-58, jy1-44, cx_cyl+58, jy1-41], fill=ORANGE)
    draw.text((cx_cyl-50, jy1-40), "65.0°C", fill=WHITE, font=fnt_label)

    # LED 잔량바
    bx = cx_cyl + cw + 10
    bh2 = 160
    draw.rectangle([bx, cy_cyl-bh2//2, bx+16, cy_cyl+bh2//2], fill=(12, 20, 34))
    segs = 9
    seg_h = bh2 // segs
    for i in range(segs):
        col = (0, 200, 65) if i < 6 else (220, 200, 0) if i < 8 else (30, 44, 62)
        yy = cy_cyl + bh2//2 - (i+1)*seg_h
        draw.rectangle([bx+1, yy+2, bx+15, yy+seg_h-2], fill=col)
    draw.text((bx-22, cy_cyl-bh2//2-22), "LEVEL 85%",
              fill=(0, 210, 100), font=fnt_xs)

    # 실린더 어깨 돔
    draw.ellipse([cx_cyl-cw, cy_top-35, cx_cyl+cw, cy_top+35],
                 fill=(62, 78, 100))
    draw.ellipse([cx_cyl-cw, cy_top-35, cx_cyl-cw+12, cy_top+10], fill=P_HIGH)

    # 넥 가드
    nw = int(cw * 0.58)
    draw.rectangle([cx_cyl-nw, cy_top-35-48, cx_cyl+nw, cy_top-35],
                   fill=(46, 62, 84))
    draw.rectangle([cx_cyl-nw, cy_top-35-48, cx_cyl+nw, cy_top-35-43],
                   fill=V_LIGHT)

    # V/S 캡
    vs_w = int(nw * 0.78)
    vs_y = cy_top - 35 - 48
    draw.rectangle([cx_cyl-vs_w, vs_y-32, cx_cyl+vs_w, vs_y], fill=(32, 46, 66))
    draw.ellipse([cx_cyl-vs_w+4, vs_y-48, cx_cyl+vs_w-4, vs_y-8],
                 fill=(36, 52, 74))
    draw.ellipse([cx_cyl-vs_w+10, vs_y-44, cx_cyl+vs_w-10, vs_y-14],
                 fill=(24, 36, 56))
    # V/S 적색 LED
    draw.ellipse([cx_cyl-10, vs_y-42, cx_cyl+10, vs_y-24], fill=(200, 0, 0))
    draw.ellipse([cx_cyl-5,  vs_y-40, cx_cyl+5,  vs_y-30], fill=(255, 80, 80))

    # AG (토출구 우측, 네온 링)
    ag_x = cx_cyl + nw
    ag_y = cy_top - 35 - 24
    # 연결 포트관
    draw.rectangle([ag_x, ag_y-12, ag_x+38, ag_y+12], fill=(36, 52, 74))
    # 네온 링 몸체
    draw.ellipse([ag_x+30, ag_y-18, ag_x+66, ag_y+18], fill=(18, 30, 50))
    draw.ellipse([ag_x+32, ag_y-16, ag_x+64, ag_y+16], fill=(0, 160, 230))
    draw.ellipse([ag_x+41, ag_y-7,  ag_x+55, ag_y+7],  fill=(0, 80, 200))
    glow_draw.ellipse([ag_x+28, ag_y-20, ag_x+68, ag_y+20],
                     fill=(0, 180, 255, 80))
    # AG 출구 파이프 소켓
    out_x = ag_x + 66
    out_y = ag_y
    draw.rectangle([out_x, out_y-PIPE_R, out_x+20, out_y+PIPE_R], fill=P_MID)
    draw.rectangle([out_x, out_y-int(PIPE_R*0.44), out_x+20, out_y+int(PIPE_R*0.44)],
                   fill=G_MID)

    # 라벨
    draw.text((cx_cyl-66, cy_bot+32), "Cylinder Ass'y", fill=WHITE, font=fnt_label)

    # 반환: AG 출구 (파이프 연결 시작) X, Y
    return out_x + 20, out_y


def draw_process(x, cy):
    pw, ph = 120, 64
    draw.rectangle([x, cy-ph//2, x+pw, cy+ph//2], fill=PANEL)
    draw.rectangle([x, cy-ph//2, x+4,  cy+ph//2], fill=ORANGE)
    draw.rectangle([x, cy-ph//2, x+pw, cy-ph//2+4], fill=ORANGE)
    draw.text((x+10, cy-24), "PROCESS", fill=WHITE,   font=fnt_bold)
    draw.text((x+18, cy+4),  "OUTLET",  fill=LABEL_C, font=fnt_small)


# ═══════════════════════════════════════════════════════════════════════════════
#  좌표 계획
# ═══════════════════════════════════════════════════════════════════════════════

Y_TOP  = 320    # 상단 배관 중심 Y
Y_BOT  = 740    # 하단 배관 중심 Y

# 실린더는 두 배관 중간 높이에 맞춤
CYL_CX = 155
CYL_CY = (Y_TOP + Y_BOT) // 2   # 530

# 파이프 X 시작 (실린더 오른쪽)
# AG 출구 X = CYL_CX + nw + 66 + 20 = CYL_CX + 52 + 66 + 20 = CYL_CX + 138
PIPE_X_START = CYL_CX + 90 + 53 + 66 + 20 + 5  # ≈ CYL_CX + 234

# 상단/하단 배관의 끝 X (캔버스 우측)
BEND_X = W - 70

# 상단 컴포넌트 6개 → 균등 분포
TOP_X_START = PIPE_X_START + 20
TOP_X_END   = BEND_X - 30
TOP_RANGE   = TOP_X_END - TOP_X_START
# 구간: [pipe_start, HPT, gap, LF1, gap, HPI, gap, REG1, gap, MPT, pipe_end]
# 5 구간 균등 → step = TOP_RANGE / 5

# 컴포넌트별 필요 반폭 (좌우 절반 폭)
HPT_W  = 15    # PT 센서 (파이프에 T자)
LF1_W  = 76    # 라인필터
HPI_W  = 56    # 에어밸브
REG1_W = 68    # 레귤레이터
MPT_W  = 15    # PT 센서

# 5개 컴포넌트를 TOP_X_START ~ TOP_X_END 내 배치
# 먼저 총 부품 폭 합산
comp_widths_top = [HPT_W, LF1_W, HPI_W, REG1_W, MPT_W]
total_comp_w_top = sum(w * 2 for w in comp_widths_top)
spaces_top = 6  # 양끝 + 컴포넌트 사이
space_top  = (TOP_RANGE - total_comp_w_top) // spaces_top

cx_run = TOP_X_START + space_top
HPT_X  = cx_run + HPT_W;  cx_run = HPT_X  + HPT_W  + space_top
LF1_X  = cx_run + LF1_W;  cx_run = LF1_X  + LF1_W  + space_top
HPI_X  = cx_run + HPI_W;  cx_run = HPI_X  + HPI_W  + space_top
REG1_X = cx_run + REG1_W; cx_run = REG1_X + REG1_W + space_top
MPT_X  = cx_run + MPT_W

# 하단 컴포넌트 (우→좌): REG2, LPT, LPI, FPV, LF2, FPT, PROCESS
REG2_W = 68; LPT_W = 15; LPI_W = 56; FPV_W = 56; LF2_W = 76; FPT_W = 15
PROC_W = 120

comp_widths_bot = [REG2_W, LPT_W, LPI_W, FPV_W, LF2_W, FPT_W]
total_comp_w_bot = sum(w * 2 for w in comp_widths_bot) + PROC_W
BOT_X_START = PIPE_X_START
BOT_X_END   = BEND_X
BOT_RANGE   = BOT_X_END - BOT_X_START
spaces_bot  = 8
space_bot   = (BOT_RANGE - total_comp_w_bot) // spaces_bot

# PROCESS 맨 왼쪽, REG2 맨 오른쪽
PROC_X = BOT_X_START + space_bot
cx_run = PROC_X + PROC_W + space_bot
FPT_X  = cx_run + FPT_W;  cx_run = FPT_X  + FPT_W  + space_bot
LF2_X  = cx_run + LF2_W;  cx_run = LF2_X  + LF2_W  + space_bot
FPV_X  = cx_run + FPV_W;  cx_run = FPV_X  + FPV_W  + space_bot
LPI_X  = cx_run + LPI_W;  cx_run = LPI_X  + LPI_W  + space_bot
LPT_X  = cx_run + LPT_W;  cx_run = LPT_X  + LPT_W  + space_bot
REG2_X = cx_run + REG2_W

# ═══════════════════════════════════════════════════════════════════════════════
#  드로잉 순서
# ═══════════════════════════════════════════════════════════════════════════════

# 격자 배경
for gx in range(0, W, 80):
    draw.line([gx, 65, gx, H-48], fill=(14, 24, 40), width=1)
for gy in range(65, H-48, 80):
    draw.line([0, gy, W, gy], fill=(14, 24, 40), width=1)

# ─── 실린더 ───
ag_out_x, ag_out_y = draw_cylinder(CYL_CX, CYL_CY)

# AG 출구 → 수직으로 Y_TOP 까지
VERT_X = ag_out_x + PIPE_R - 5   # 수직 파이프 X 중심
draw_pipe_v(VERT_X, ag_out_y, Y_TOP, PIPE_R)

# ─── 상단 배관 ───
P_TOP_START = VERT_X + PIPE_R

draw_pipe_h(P_TOP_START, Y_TOP, HPT_X - HPT_W, PIPE_R)
draw_vcr(HPT_X - HPT_W, Y_TOP, PIPE_R)
draw_pipe_h(HPT_X + HPT_W, Y_TOP, LF1_X - LF1_W, PIPE_R)
draw_vcr(LF1_X - LF1_W, Y_TOP, PIPE_R)
draw_pipe_h(LF1_X + LF1_W, Y_TOP, HPI_X - HPI_W, PIPE_R)
draw_vcr(HPI_X - HPI_W, Y_TOP, PIPE_R)
draw_pipe_h(HPI_X + HPI_W, Y_TOP, REG1_X - REG1_W, PIPE_R)
draw_vcr(REG1_X - REG1_W, Y_TOP, PIPE_R)
draw_pipe_h(REG1_X + REG1_W, Y_TOP, MPT_X - MPT_W, PIPE_R)
draw_vcr(MPT_X - MPT_W, Y_TOP, PIPE_R)
draw_pipe_h(MPT_X + MPT_W, Y_TOP, BEND_X, PIPE_R)

# ─── 수직 엘보 (우측) ───
draw_elbow(BEND_X, Y_TOP, PIPE_R)
draw_pipe_v(BEND_X, Y_TOP + PIPE_R, Y_BOT - PIPE_R, PIPE_R)
draw_elbow(BEND_X, Y_BOT, PIPE_R)

# ─── 하단 배관 (우→좌) ───
draw_pipe_h(REG2_X + REG2_W, Y_BOT, BEND_X, PIPE_R)
draw_vcr(REG2_X + REG2_W, Y_BOT, PIPE_R)
draw_pipe_h(LPT_X + LPT_W, Y_BOT, REG2_X - REG2_W, PIPE_R)
draw_vcr(REG2_X - REG2_W, Y_BOT, PIPE_R)
draw_vcr(LPT_X + LPT_W, Y_BOT, PIPE_R)
draw_pipe_h(LPI_X + LPI_W, Y_BOT, LPT_X - LPT_W, PIPE_R)
draw_vcr(LPT_X - LPT_W, Y_BOT, PIPE_R)
draw_vcr(LPI_X + LPI_W, Y_BOT, PIPE_R)
draw_pipe_h(FPV_X + FPV_W, Y_BOT, LPI_X - LPI_W, PIPE_R)
draw_vcr(LPI_X - LPI_W, Y_BOT, PIPE_R)
draw_vcr(FPV_X + FPV_W, Y_BOT, PIPE_R)
draw_pipe_h(LF2_X + LF2_W, Y_BOT, FPV_X - FPV_W, PIPE_R)
draw_vcr(FPV_X - FPV_W, Y_BOT, PIPE_R)
draw_vcr(LF2_X + LF2_W, Y_BOT, PIPE_R)
draw_pipe_h(FPT_X + FPT_W, Y_BOT, LF2_X - LF2_W, PIPE_R)
draw_vcr(LF2_X - LF2_W, Y_BOT, PIPE_R)
draw_vcr(FPT_X + FPT_W, Y_BOT, PIPE_R)
draw_pipe_h(PROC_X + PROC_W, Y_BOT, FPT_X - FPT_W, PIPE_R)
draw_vcr(FPT_X - FPT_W, Y_BOT, PIPE_R)

# ─── 컴포넌트 오버레이 ───
draw_pt(HPT_X,  Y_TOP, "HPT",  "12.500", PIPE_R)
draw_lf(LF1_X,  Y_TOP, "LF-1", PIPE_R)
draw_av(HPI_X,  Y_TOP, "HPI",  is_open=True,  r=PIPE_R)
draw_reg(REG1_X, Y_TOP, "Reg-1", PIPE_R)
draw_pt(MPT_X,  Y_TOP, "MPT",  "0.800",  PIPE_R)

draw_reg(REG2_X, Y_BOT, "Reg-2", PIPE_R)
draw_pt(LPT_X,  Y_BOT, "LPT",  "0.300",  PIPE_R)
draw_av(LPI_X,  Y_BOT, "LPI",  is_open=True,  r=PIPE_R)
draw_av(FPV_X,  Y_BOT, "FPV",  is_open=False, r=PIPE_R)
draw_lf(LF2_X,  Y_BOT, "LF-2", PIPE_R)
draw_pt(FPT_X,  Y_BOT, "FPT",  "0.250",  PIPE_R)
draw_process(PROC_X, Y_BOT)

# ─── 글로우 합성 ───
glow_blurred = glow_layer.filter(ImageFilter.GaussianBlur(radius=26))
img_rgba = img.convert("RGBA")
img_rgba = Image.alpha_composite(img_rgba, glow_blurred)
img = img_rgba.convert("RGB")
draw = ImageDraw.Draw(img)

# ─── 타이틀 바 ───
draw.rectangle([0, 0, W, 62], fill=(5, 12, 26))
draw.rectangle([0, 60, W, 64], fill=CYAN)
draw.text((28, 14), "GAS CABINET  P&ID  —  RED GAS PROCESS LINE",
          fill=WHITE, font=fnt_title)
draw.text((W-400, 18), "REV.06  |  MONITORING PC", fill=LABEL_C, font=fnt_label)

# 흐름 방향 화살표 (상단, 우향)
for ax in [TOP_X_START + 60, LF1_X - 130, HPI_X - 130, MPT_X - 130]:
    pts = [(ax, Y_TOP-42), (ax+24, Y_TOP-26), (ax, Y_TOP-10)]
    draw.polygon(pts, fill=(255, 50, 50))

# 흐름 방향 화살표 (하단, 좌향)
for ax in [LPI_X + 130, FPV_X + 130, LF2_X + 130, FPT_X + 120]:
    pts = [(ax, Y_BOT-42), (ax-24, Y_BOT-26), (ax, Y_BOT-10)]
    draw.polygon(pts, fill=(255, 50, 50))

# ─── 하단 정보 바 ───
draw.rectangle([0, H-48, W, H], fill=(5, 12, 26))
draw.rectangle([0, H-50, W, H-48], fill=CYAN)
seq = ("PROCESS FLOW:  Cylinder Ass'y → HPT → LF → HPI → Reg-1 → MPT  |  "
       "→  Reg-2 → LPT → LPI → FPV → LF → FPT → PROCESS")
draw.text((22, H-38), seq, fill=LABEL_C, font=fnt_xs)

# ─── 저장 ───
out_path = (r"C:\Users\rokaf\.gemini\antigravity\brain"
            r"\9bf099c1-610b-408f-b5e2-f7535255d281"
            r"\pid_neon_redgas_v6.png")
img.save(out_path, "PNG")
print(f"[OK] 저장 완료: {out_path}  ({W}x{H})")
