"""
P&ID 배관도 v5 - 완전 재설계
- 파이프 굵기 대폭 증가 (글로우 효과 강화)
- 파트 크기 대폭 증가
- 전체 캔버스 활용 (좌우 상하 여백 최소화)
- 하단 행 우측 여백 없애기 (BEND_X를 캔버스 끝으로)
"""

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math

# ─── 캔버스 설정 ────────────────────────────────────────────────────────────
W, H = 2400, 1000
bg_color = (10, 20, 38)

img = Image.new("RGB", (W, H), bg_color)
draw = ImageDraw.Draw(img)

glow_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
glow_draw  = ImageDraw.Draw(glow_layer)

# ─── 폰트 ─────────────────────────────────────────────────────────────────
try:
    fnt_tag   = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 26)
    fnt_label = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 22)
    fnt_small = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 18)
    fnt_xs    = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 15)
    fnt_title = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 30)
    fnt_bold  = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 24)
except:
    fnt_tag   = ImageFont.load_default()
    fnt_label = fnt_tag
    fnt_small = fnt_tag
    fnt_xs    = fnt_tag
    fnt_title = fnt_tag
    fnt_bold  = fnt_tag

# ─── 색상 ────────────────────────────────────────────────────────────────────
# 파이프 메탈 (3D 원통 효과)
P_DARK  = (35,  48,  65)
P_MID   = (58,  78,  100)
P_LIGHT = (95,  120, 150)
P_HIGH  = (145, 175, 210)
# 적색 가스 내부
G_GLOW  = (180, 10,  10)    # 외부 글로우
G_MID   = (230, 40,  40)    # 중간
G_CORE  = (255, 120, 120)   # 핫 코어
G_WHITE = (255, 210, 210)   # 최고 하이라이트
# VCR 피팅
V_DARK  = (45,  58,  75)
V_MID   = (78,  98,  122)
V_LIGHT = (130, 158, 190)
# UI
CYAN    = (0,   240, 220)
GREEN   = (0,   230, 90)
RED_LED = (255, 40,  40)
ORANGE  = (255, 140, 0)
WHITE   = (255, 255, 255)
PANEL   = (15,  26,  50)
LABEL_C = (190, 215, 255)


# ═══════════════════════════════════════════════════════════════════════════════
#  유틸 함수
# ═══════════════════════════════════════════════════════════════════════════════

def pipe_h(x1, y, x2, r=28):
    """수평 3D 글로우 파이프"""
    # 외부 메탈 쉘 (다크)
    draw.rectangle([x1, y-r, x2, y+r], fill=P_DARK)
    # 파이프 3D 하이라이트 (위 → 아래: 밝→어둠→더어둠)
    bw = r * 2
    bands = [
        (0,         int(bw*0.12), P_HIGH),
        (int(bw*0.12), int(bw*0.32), P_LIGHT),
        (int(bw*0.32), int(bw*0.58), P_MID),
        (int(bw*0.58), int(bw*0.80), P_DARK),
        (int(bw*0.80), bw,          (22, 32, 46)),
    ]
    for b_start, b_end, col in bands:
        draw.rectangle([x1, y-r+b_start, x2, y-r+b_end], fill=col)

    # 내부 적색 가스 (글로우 코어)
    gr = int(r * 0.65)
    draw.rectangle([x1, y-gr, x2, y+gr], fill=G_GLOW)
    mr = int(r * 0.42)
    draw.rectangle([x1, y-mr, x2, y+mr], fill=G_MID)
    cr = int(r * 0.22)
    draw.rectangle([x1, y-cr, x2, y+cr], fill=G_CORE)
    hr = max(2, int(r * 0.10))
    draw.rectangle([x1, y-hr, x2, y+hr], fill=G_WHITE)

    # 글로우 레이어
    glow_draw.rectangle([x1-6, y-r-20, x2+6, y+r+20], fill=(220, 0, 0, 55))


def pipe_v(x, y1, y2, r=28):
    """수직 3D 글로우 파이프"""
    draw.rectangle([x-r, y1, x+r, y2], fill=P_DARK)
    bw = r * 2
    bands = [
        (0,         int(bw*0.12), P_HIGH),
        (int(bw*0.12), int(bw*0.32), P_LIGHT),
        (int(bw*0.32), int(bw*0.58), P_MID),
        (int(bw*0.58), int(bw*0.80), P_DARK),
        (int(bw*0.80), bw,          (22, 32, 46)),
    ]
    for b_start, b_end, col in bands:
        draw.rectangle([x-r+b_start, y1, x-r+b_end, y2], fill=col)
    gr = int(r * 0.65)
    draw.rectangle([x-gr, y1, x+gr, y2], fill=G_GLOW)
    mr = int(r * 0.42)
    draw.rectangle([x-mr, y1, x+mr, y2], fill=G_MID)
    cr = int(r * 0.22)
    draw.rectangle([x-cr, y1, x+cr, y2], fill=G_CORE)
    hr = max(2, int(r * 0.10))
    draw.rectangle([x-hr, y1, x+hr, y2], fill=G_WHITE)
    glow_draw.rectangle([x-r-20, y1-6, x+r+20, y2+6], fill=(220, 0, 0, 55))


def elbow90(cx, cy, r=28):
    """90도 엘보 조인트"""
    er = r + 10
    draw.ellipse([cx-er, cy-er, cx+er, cy+er], fill=P_MID)
    draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=P_HIGH)
    gr = int(r * 0.65)
    draw.ellipse([cx-gr, cy-gr, cx+gr, cy+gr], fill=G_GLOW)
    mr = int(r * 0.42)
    draw.ellipse([cx-mr, cy-mr, cx+mr, cy+mr], fill=G_MID)
    cr = int(r * 0.22)
    draw.ellipse([cx-cr, cy-cr, cx+cr, cy+cr], fill=G_CORE)
    glow_draw.ellipse([cx-r-22, cy-r-22, cx+r+22, cy+r+22], fill=(220, 0, 0, 70))


def vcr(cx, cy, r=28):
    """VCR 피팅 칼라"""
    fw = int(r * 0.85)
    fh = r + 8
    draw.rectangle([cx-fw, cy-fh, cx+fw, cy+fh], fill=V_MID)
    # 3D 하이라이트
    draw.rectangle([cx-fw, cy-fh,       cx+fw, cy-fh+4],   fill=V_LIGHT)
    draw.rectangle([cx-fw, cy+fh-4,     cx+fw, cy+fh],     fill=V_DARK)
    draw.rectangle([cx-fw, cy-fh,       cx-fw+3, cy+fh],   fill=V_LIGHT)
    # 내부 가스
    gr = int(r * 0.60)
    draw.rectangle([cx-gr, cy-gr, cx+gr, cy+gr], fill=G_MID)


def pt_sensor(cx, cy, tag, val, r=28):
    """압력 센서 HUD (파이프 위)"""
    stub_h = 35
    # 스텁
    draw.rectangle([cx-6, cy-r-stub_h, cx+6, cy-r], fill=V_MID)

    sw, sh = 140, 70
    sx, sy = cx - sw//2, cy - r - stub_h - sh
    # 배경
    draw.rectangle([sx, sy, sx+sw, sy+sh], fill=PANEL)
    # 테두리 (사이언)
    draw.rectangle([sx,   sy,   sx+sw, sy+3],  fill=CYAN)
    draw.rectangle([sx,   sy,   sx+3,  sy+sh], fill=CYAN)
    draw.rectangle([sx+sw-3, sy, sx+sw, sy+sh], fill=(0, 80, 75))
    # 텍스트
    draw.text((sx+8, sy+6),  tag, fill=CYAN,    font=fnt_label)
    draw.text((sx+8, sy+30), val, fill=WHITE,   font=fnt_tag)
    draw.text((sx+8, sy+54), "MPa",fill=(100,140,190), font=fnt_xs)


def line_filter(cx, cy, tag, r=28):
    """라인 필터 인라인 원통"""
    fw, fh = 70, r + 30
    # 필터 외부 원통
    draw.rectangle([cx-fw, cy-fh, cx+fw, cy+fh], fill=(30, 44, 62))
    draw.rectangle([cx-fw, cy-fh,       cx+fw, cy-fh+5],  fill=V_LIGHT)
    draw.rectangle([cx-fw, cy+fh-5,     cx+fw, cy+fh],    fill=V_DARK)
    draw.rectangle([cx-fw, cy-fh,       cx-fw+4, cy+fh],  fill=V_LIGHT)
    draw.rectangle([cx+fw-4, cy-fh,     cx+fw, cy+fh],    fill=V_DARK)

    # 메쉬 그릴 패턴
    for i in range(-4, 5):
        lx = cx + i * 14
        col = (50, 68, 90) if i % 2 == 0 else (40, 56, 76)
        draw.rectangle([lx-3, cy-fh+7, lx+3, cy+fh-7], fill=col)

    # 내부 가스 통로
    gr = int(r * 0.65)
    draw.rectangle([cx-fw, cy-gr, cx+fw, cy+gr], fill=G_GLOW)
    mr = int(r * 0.38)
    draw.rectangle([cx-fw, cy-mr, cx+fw, cy+mr], fill=G_MID)
    cr = int(r * 0.18)
    draw.rectangle([cx-fw, cy-cr, cx+fw, cy+cr], fill=G_CORE)

    # 상단 dP 게이지
    gx, gy = cx, cy - fh - 30
    draw.rectangle([cx-4, cy-fh-5, cx+4, cy-fh], fill=V_MID)
    draw.ellipse([gx-22, gy-22, gx+22, gy+22], fill=(25, 38, 56))
    draw.ellipse([gx-20, gy-20, gx+20, gy+20], fill=(18, 28, 44))
    for ang in range(0, 360, 30):
        rad = math.radians(ang)
        x1 = gx + int(15*math.cos(rad)); y1 = gy + int(15*math.sin(rad))
        x2 = gx + int(19*math.cos(rad)); y2 = gy + int(19*math.sin(rad))
        draw.line([x1,y1,x2,y2], fill=(70,95,125), width=1)
    # 바늘
    ang = math.radians(-40)
    draw.line([gx, gy, gx+int(13*math.cos(ang)), gy+int(13*math.sin(ang))],
              fill=ORANGE, width=2)
    # 라벨
    draw.text((cx-18, cy+fh+6), tag, fill=LABEL_C, font=fnt_small)


def air_valve(cx, cy, tag, is_open=True, r=28):
    """공압 에어 밸브 (몸체 + 액추에이터 + 돔 LED)"""
    bw, bh = 50, 42
    aw, ah = 34, 65
    led_col = GREEN if is_open else RED_LED

    # 밸브 몸체
    draw.rectangle([cx-bw, cy-bh, cx+bw, cy+bh], fill=(38, 55, 78))
    draw.rectangle([cx-bw, cy-bh,   cx+bw, cy-bh+5], fill=V_LIGHT)
    draw.rectangle([cx-bw, cy+bh-5, cx+bw, cy+bh],   fill=V_DARK)
    draw.rectangle([cx-bw, cy-bh,   cx-bw+4, cy+bh], fill=V_LIGHT)

    # 내부 가스 통로
    gr = int(r * 0.65)
    draw.rectangle([cx-bw, cy-gr, cx+bw, cy+gr], fill=G_GLOW)
    mr = int(r * 0.38)
    draw.rectangle([cx-bw, cy-mr, cx+bw, cy+mr], fill=G_MID)
    cr = int(r * 0.18)
    draw.rectangle([cx-bw, cy-cr, cx+bw, cy+cr], fill=G_CORE)

    # 액추에이터 (상단 원통)
    draw.rectangle([cx-aw, cy-bh-ah, cx+aw, cy-bh], fill=(38, 54, 76))
    draw.rectangle([cx-aw, cy-bh-ah,   cx+aw, cy-bh-ah+4], fill=(75, 100, 132))
    draw.rectangle([cx-aw, cy-bh-ah,   cx-aw+4, cy-bh],    fill=(75, 100, 132))
    # 액추에이터 리브
    for ly in range(cy-bh-ah+12, cy-bh, 18):
        draw.rectangle([cx-aw+2, ly, cx+aw-2, ly+4], fill=(28, 42, 62))

    # 돔 LED
    dy = cy - bh - ah - 24
    draw.ellipse([cx-20, dy-20, cx+20, dy+20], fill=(20, 32, 52))
    draw.ellipse([cx-17, dy-17, cx+17, dy+17], fill=led_col)
    # LED 반사
    draw.ellipse([cx-8,  dy-14, cx+8,  dy-4],  fill=(255,255,255))

    # 태그 라벨
    draw.text((cx-22, cy+bh+8), tag, fill=LABEL_C, font=fnt_small)


def regulator(cx, cy, tag, r=28):
    """레귤레이터 3D 스테인리스 + 듀얼 게이지"""
    bw, bh = 62, 52

    # 본체
    draw.rectangle([cx-bw, cy-bh, cx+bw, cy+bh], fill=(38, 54, 76))
    draw.rectangle([cx-bw, cy-bh,   cx+bw, cy-bh+5], fill=V_LIGHT)
    draw.rectangle([cx-bw, cy+bh-5, cx+bw, cy+bh],   fill=V_DARK)
    draw.rectangle([cx-bw, cy-bh,   cx-bw+5, cy+bh], fill=P_HIGH)
    draw.rectangle([cx+bw-5, cy-bh, cx+bw, cy+bh],   fill=P_DARK)

    # 내부 가스 통로
    gr = int(r * 0.65)
    draw.rectangle([cx-bw, cy-gr, cx+bw, cy+gr], fill=G_GLOW)
    mr = int(r * 0.38)
    draw.rectangle([cx-bw, cy-mr, cx+bw, cy+mr], fill=G_MID)
    cr = int(r * 0.18)
    draw.rectangle([cx-bw, cy-cr, cx+bw, cy+cr], fill=G_CORE)

    # 조절 노브 (상단 중앙)
    draw.ellipse([cx-12, cy-bh-22, cx+12, cy-bh],   fill=(50, 68, 94))
    draw.ellipse([cx-9,  cy-bh-20, cx+9,  cy-bh-2], fill=(75, 98, 132))

    # 듀얼 게이지 (상단 좌우)
    for gx_off in [-32, 32]:
        gx = cx + gx_off
        gy = cy - bh - 52
        # 스템
        draw.rectangle([gx-4, gy+20, gx+4, gy+26], fill=V_MID)
        # 게이지 페이스
        draw.ellipse([gx-22, gy-22, gx+22, gy+22], fill=(20, 30, 48))
        draw.ellipse([gx-20, gy-20, gx+20, gy+20], fill=(28, 42, 65))
        # 눈금
        for ang in range(0, 360, 30):
            rad = math.radians(ang)
            x1 = gx + int(14*math.cos(rad)); y1 = gy + int(14*math.sin(rad))
            x2 = gx + int(18*math.cos(rad)); y2 = gy + int(18*math.sin(rad))
            draw.line([x1,y1,x2,y2], fill=(60,88,122), width=1)
        # 바늘
        ang = math.radians(-50 + gx_off)  # 좌우 약간 다른 값
        draw.line([gx, gy, gx+int(12*math.cos(ang)), gy+int(12*math.sin(ang))],
                  fill=ORANGE, width=2)
        draw.ellipse([gx-3, gy-3, gx+3, gy+3], fill=ORANGE)

    # 태그
    draw.text((cx-22, cy+bh+8), tag, fill=LABEL_C, font=fnt_small)


def cylinder_assy(cx, cy_center):
    """실린더 어셈블리 전체"""
    cw, ch_half = 80, 190

    cy_top = cy_center - ch_half
    cy_bot = cy_center + ch_half

    # ─── 저울 베이스 ───
    sw = cw + 35
    sh = 22
    draw.rectangle([cx-sw, cy_bot, cx+sw, cy_bot+sh], fill=(38, 54, 76))
    draw.rectangle([cx-sw, cy_bot,    cx+sw, cy_bot+4], fill=V_LIGHT)
    draw.rectangle([cx-sw, cy_bot+sh-4, cx+sw, cy_bot+sh], fill=V_DARK)
    draw.text((cx-40, cy_bot+5), "45.2 kg", fill=CYAN, font=fnt_label)

    # ─── 실린더 몸체 ───
    draw.rectangle([cx-cw, cy_top, cx+cw, cy_bot], fill=(60, 76, 98))
    # 좌측 하이라이트
    draw.rectangle([cx-cw,    cy_top, cx-cw+10, cy_bot], fill=P_HIGH)
    # 우측 그림자
    draw.rectangle([cx+cw-10, cy_top, cx+cw,    cy_bot], fill=P_DARK)

    # ─── 자켓 히터 (중간 60%) ───
    jy1, jy2 = cy_center - 80, cy_center + 80
    draw.rectangle([cx-cw+2, jy1, cx+cw-2, jy2], fill=(20, 20, 20))
    # 히터 줄 (오렌지)
    for i in range(7):
        yy = jy1 + 8 + i * 20
        draw.rectangle([cx-cw+4, yy, cx+cw-4, yy+10], fill=(160, 60, 0))
        draw.rectangle([cx-cw+4, yy,           cx+cw-4, yy+3],  fill=(220, 100, 0))

    # 온도 HUD
    draw.rectangle([cx-55, jy1-38, cx+55, jy1-8], fill=PANEL)
    draw.rectangle([cx-55, jy1-38, cx+55, jy1-35], fill=ORANGE)
    draw.text((cx-45, jy1-34), "65.0°C", fill=WHITE, font=fnt_label)

    # ─── LED 잔량바 (오른쪽) ───
    bar_x = cx + cw + 8
    bh = 140
    draw.rectangle([bar_x, cy_center-bh//2, bar_x+14, cy_center+bh//2],
                   fill=(15, 24, 38))
    segs = 8
    seg_h = bh // segs
    for i in range(segs):
        if i < 7:  # 85% ≈ 7/8
            col = (0, 200, 60) if i < 5 else (220, 220, 0)
        else:
            col = (30, 44, 62)
        yy = cy_center + bh//2 - (i+1)*seg_h
        draw.rectangle([bar_x+1, yy+1, bar_x+13, yy+seg_h-2], fill=col)

    # LEVEL 표시
    draw.text((bar_x-30, cy_center-bh//2-22), "LEVEL 85%",
              fill=(0, 220, 110), font=fnt_xs)

    # ─── 실린더 어깨 (상단 돔) ───
    draw.ellipse([cx-cw, cy_top-30, cx+cw, cy_top+30], fill=(65, 82, 104))
    draw.ellipse([cx-cw, cy_top-30, cx-cw+10, cy_top+10], fill=P_HIGH)

    # ─── 넥 가드 ───
    nw = int(cw * 0.55)
    nh = 44
    draw.rectangle([cx-nw, cy_top-30-nh, cx+nw, cy_top-30], fill=(50, 66, 88))
    draw.rectangle([cx-nw, cy_top-30-nh, cx+nw, cy_top-30-nh+5], fill=V_LIGHT)

    # ─── V/S 캡 (넥 위) ───
    vs_w = int(nw * 0.75)
    vs_y = cy_top - 30 - nh
    draw.rectangle([cx-vs_w, vs_y-28, cx+vs_w, vs_y], fill=(35, 50, 70))
    draw.ellipse([cx-vs_w+2, vs_y-42, cx+vs_w-2, vs_y-8],
                 fill=(40, 56, 78))
    draw.ellipse([cx-vs_w+6, vs_y-40, cx+vs_w-6, vs_y-12],
                 fill=(28, 40, 60))
    # V/S 비상 LED (적색)
    draw.ellipse([cx-9, vs_y-36, cx+9, vs_y-20], fill=(200, 0, 0))
    draw.ellipse([cx-4, vs_y-34, cx+4, vs_y-26], fill=(255, 80, 80))

    # ─── AG (토출구 우측 직결, 네온 링) ───
    ag_x = cx + nw
    ag_y = cy_top - 30 - nh // 2
    # 연결관
    draw.rectangle([ag_x, ag_y-10, ag_x+35, ag_y+10], fill=(40, 56, 76))
    # AG 네온 링 몸체
    draw.ellipse([ag_x+28, ag_y-16, ag_x+60, ag_y+16], fill=(22, 34, 54))
    draw.ellipse([ag_x+30, ag_y-14, ag_x+58, ag_y+14], fill=(0, 180, 240))
    draw.ellipse([ag_x+37, ag_y-7,  ag_x+51, ag_y+7],  fill=(0, 90, 200))

    # 토출 포트 → 가스 파이프로 이어지는 연결구
    out_x = ag_x + 60
    out_y = ag_y
    draw.rectangle([out_x, out_y-14, out_x+20, out_y+14], fill=P_MID)
    draw.rectangle([out_x, out_y-8,  out_x+20, out_y+8],  fill=G_MID)

    # 라벨
    draw.text((cx-60, cy_bot+sh+8), "Cylinder Ass'y", fill=WHITE, font=fnt_label)

    return out_x + 20, out_y   # 파이프 시작점


def process_outlet(x, cy, r=28):
    """PROCESS 출구 터미널"""
    pw, ph = 110, 60
    draw.rectangle([x, cy-ph//2, x+pw, cy+ph//2], fill=PANEL)
    draw.rectangle([x, cy-ph//2, x+3,  cy+ph//2], fill=ORANGE)
    draw.rectangle([x, cy-ph//2, x+pw, cy-ph//2+3], fill=ORANGE)
    draw.text((x+8,  cy-22), "PROCESS", fill=WHITE,  font=fnt_bold)
    draw.text((x+18, cy+4),  "OUTLET",  fill=LABEL_C, font=fnt_small)


# ═══════════════════════════════════════════════════════════════════════════════
#  레이아웃 좌표 계획
# ═══════════════════════════════════════════════════════════════════════════════

PIPE_R  = 28

# 메인 배관 Y 중심선
Y_TOP = 330    # 상단 배관
Y_BOT = 720    # 하단 배관

# 실린더 X 위치
CYL_CX = 150
CYL_CY = (Y_TOP + Y_BOT) // 2   # 실린더는 두 배관 사이 중간

# 파이프 시작 X (실린더 오른쪽)
PIPE_X0 = CYL_CX + 80 + 60 + 20   # cw=80, AG extension=60, conn=20

# 상단 행 컴포넌트 X (파이프 시작 ~ 오른쪽 엘보)
HPT_X  = PIPE_X0 + 100
LF1_X  = HPT_X  + 210
HPI_X  = LF1_X  + 210
REG1_X = HPI_X  + 230
MPT_X  = REG1_X + 210
BEND_X = MPT_X  + 180   # 우측 엘보 (거의 캔버스 끝)

# 하단 행 컴포넌트 X (우측 → 좌측)
REG2_X = BEND_X - 90
LPT_X  = REG2_X - 210
LPI_X  = LPT_X  - 200
FPV_X  = LPI_X  - 200
LF2_X  = FPV_X  - 210
FPT_X  = LF2_X  - 200
PROC_X = FPT_X  - 180   # PROCESS 출구

# ═══════════════════════════════════════════════════════════════════════════════
#  격자 배경
# ═══════════════════════════════════════════════════════════════════════════════
for gx in range(0, W, 80):
    draw.line([gx, 65, gx, H-45], fill=(16, 26, 44), width=1)
for gy in range(65, H-45, 80):
    draw.line([0, gy, W, gy], fill=(16, 26, 44), width=1)

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 1: 실린더 어셈블리
# ═══════════════════════════════════════════════════════════════════════════════
pipe_s_x, pipe_s_y = cylinder_assy(CYL_CX, CYL_CY)

# 실린더 AG 출구 → 상단 배관 연결 (수직 파이프)
# AG 출구 Y = CYL_CY - 190 - 30 - 44//2 = CYL_CY - 242
ag_out_y = CYL_CY - 190 - 30 - 22  # 대략적인 AG 출구 Y
pipe_s_x_actual = CYL_CX + 80 + 35 + 60 + 20  # 실제 AG 오른쪽 끝

# 상단 배관과 실린더 연결 수직관
pipe_v(pipe_s_x_actual - 20, ag_out_y, Y_TOP, PIPE_R)

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 2: 상단 배관 (좌→우)
# ═══════════════════════════════════════════════════════════════════════════════
X_START_TOP = pipe_s_x_actual   # 실린더 연결 수직관 X

pipe_h(X_START_TOP, Y_TOP, HPT_X - 15, PIPE_R)
vcr(HPT_X - 15, Y_TOP, PIPE_R)
pipe_h(HPT_X + 15, Y_TOP, LF1_X - 70, PIPE_R)
vcr(LF1_X - 70, Y_TOP, PIPE_R)
pipe_h(LF1_X + 70, Y_TOP, HPI_X - 50, PIPE_R)
vcr(HPI_X - 50, Y_TOP, PIPE_R)
pipe_h(HPI_X + 50, Y_TOP, REG1_X - 62, PIPE_R)
vcr(REG1_X - 62, Y_TOP, PIPE_R)
pipe_h(REG1_X + 62, Y_TOP, MPT_X - 15, PIPE_R)
vcr(MPT_X - 15, Y_TOP, PIPE_R)
pipe_h(MPT_X + 15, Y_TOP, BEND_X, PIPE_R)

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 3: 수직 연결 엘보 (우측)
# ═══════════════════════════════════════════════════════════════════════════════
elbow90(BEND_X, Y_TOP, PIPE_R)
pipe_v(BEND_X, Y_TOP + PIPE_R, Y_BOT - PIPE_R, PIPE_R)
elbow90(BEND_X, Y_BOT, PIPE_R)

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 4: 하단 배관 (우→좌)
# ═══════════════════════════════════════════════════════════════════════════════
pipe_h(REG2_X + 62, Y_BOT, BEND_X, PIPE_R)
vcr(REG2_X + 62, Y_BOT, PIPE_R)
pipe_h(LPT_X + 15, Y_BOT, REG2_X - 62, PIPE_R)
vcr(REG2_X - 62, Y_BOT, PIPE_R)
vcr(LPT_X + 15, Y_BOT, PIPE_R)
pipe_h(LPI_X + 50, Y_BOT, LPT_X - 15, PIPE_R)
vcr(LPT_X - 15, Y_BOT, PIPE_R)
vcr(LPI_X + 50, Y_BOT, PIPE_R)
pipe_h(FPV_X + 50, Y_BOT, LPI_X - 50, PIPE_R)
vcr(LPI_X - 50, Y_BOT, PIPE_R)
vcr(FPV_X + 50, Y_BOT, PIPE_R)
pipe_h(LF2_X + 70, Y_BOT, FPV_X - 50, PIPE_R)
vcr(FPV_X - 50, Y_BOT, PIPE_R)
vcr(LF2_X + 70, Y_BOT, PIPE_R)
pipe_h(FPT_X + 15, Y_BOT, LF2_X - 70, PIPE_R)
vcr(LF2_X - 70, Y_BOT, PIPE_R)
vcr(FPT_X + 15, Y_BOT, PIPE_R)
pipe_h(PROC_X + 110, Y_BOT, FPT_X - 15, PIPE_R)
vcr(FPT_X - 15, Y_BOT, PIPE_R)

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 5: 컴포넌트 (파이프 위에 오버레이)
# ═══════════════════════════════════════════════════════════════════════════════

# --- 상단 ---
pt_sensor(HPT_X,  Y_TOP, "HPT",   "12.50", PIPE_R)
line_filter(LF1_X,  Y_TOP, "LF-1",  PIPE_R)
air_valve(HPI_X,  Y_TOP, "HPI",   is_open=True,  r=PIPE_R)
regulator(REG1_X, Y_TOP, "Reg-1", PIPE_R)
pt_sensor(MPT_X,  Y_TOP, "MPT",   "0.800", PIPE_R)

# --- 하단 ---
regulator(REG2_X, Y_BOT, "Reg-2", PIPE_R)
pt_sensor(LPT_X,  Y_BOT, "LPT",   "0.300", PIPE_R)
air_valve(LPI_X,  Y_BOT, "LPI",   is_open=True,  r=PIPE_R)
air_valve(FPV_X,  Y_BOT, "FPV",   is_open=False, r=PIPE_R)
line_filter(LF2_X,  Y_BOT, "LF-2",  PIPE_R)
pt_sensor(FPT_X,  Y_BOT, "FPT",   "0.250", PIPE_R)

# PROCESS 출구
process_outlet(PROC_X, Y_BOT, PIPE_R)

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 6: 글로우 레이어 합성
# ═══════════════════════════════════════════════════════════════════════════════
glow_blurred = glow_layer.filter(ImageFilter.GaussianBlur(radius=22))
img_rgba = img.convert("RGBA")
img_rgba = Image.alpha_composite(img_rgba, glow_blurred)
img = img_rgba.convert("RGB")
draw = ImageDraw.Draw(img)

# ═══════════════════════════════════════════════════════════════════════════════
#  STEP 7: UI 오버레이 (타이틀, 순서 텍스트)
# ═══════════════════════════════════════════════════════════════════════════════
# 타이틀 바
draw.rectangle([0, 0, W, 60], fill=(6, 14, 28))
draw.rectangle([0, 58, W, 62], fill=CYAN)
draw.text((28, 14), "GAS CABINET P&ID  —  RED GAS PROCESS LINE",
          fill=WHITE, font=fnt_title)
draw.text((W-370, 18), "REV.05  |  MONITORING PC", fill=LABEL_C, font=fnt_label)

# 흐름 방향 화살표 (상단, 우향)
for ax in [LF1_X - 105, HPI_X - 105, MPT_X - 105]:
    pts = [(ax, Y_TOP-38), (ax+22, Y_TOP-24), (ax, Y_TOP-10)]
    draw.polygon(pts, fill=(255, 60, 60))

# 흐름 방향 화살표 (하단, 좌향)
for ax in [LPI_X + 105, FPV_X + 105, LF2_X + 105]:
    pts = [(ax, Y_BOT-38), (ax-22, Y_BOT-24), (ax, Y_BOT-10)]
    draw.polygon(pts, fill=(255, 60, 60))

# 공정 순서 라벨 (하단 바)
draw.rectangle([0, H-48, W, H], fill=(6, 14, 28))
draw.rectangle([0, H-50, W, H-48], fill=CYAN)
seq = ("FLOW: Cylinder Ass'y  →  HPT  →  LF  →  HPI  →  Reg-1  →  MPT  "
       "→  Reg-2  →  LPT  →  LPI  →  FPV  →  LF  →  FPT  →  PROCESS")
draw.text((20, H-38), seq, fill=LABEL_C, font=fnt_xs)

# ═══════════════════════════════════════════════════════════════════════════════
#  저장
# ═══════════════════════════════════════════════════════════════════════════════
out_path = (r"C:\Users\rokaf\.gemini\antigravity\brain"
            r"\9bf099c1-610b-408f-b5e2-f7535255d281"
            r"\pid_neon_redgas_v5.png")
img.save(out_path, "PNG")
print(f"[OK] 저장: {out_path}  ({W}x{H})")
