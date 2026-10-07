"""
P&ID 배관도 v7 - 연결 완성 + 레이아웃 정밀 수정
수정사항:
1. 실린더 → 상단 배관 수직 연결 확실히 표시
2. 실린더를 좌측에 붙이고 배관 시작을 실린더 바로 오른쪽에서 시작
3. 컴포넌트 간격 더 균등하게
4. PROCESS + FPT 위치 겹침 해소
"""

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math

W, H = 2600, 1100
bg_color = (10, 20, 38)

img = Image.new("RGB", (W, H), bg_color)
draw = ImageDraw.Draw(img)
glow_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
glow_draw  = ImageDraw.Draw(glow_layer)

try:
    fnt_tag   = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 28)
    fnt_label = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 23)
    fnt_small = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 19)
    fnt_xs    = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 16)
    fnt_title = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 32)
    fnt_bold  = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 26)
except:
    fnt_tag = fnt_label = fnt_small = fnt_xs = fnt_title = fnt_bold = ImageFont.load_default()

# 색상
P_DARK  = (28, 40, 58);     P_MID   = (52, 70, 95)
P_LIGHT = (85, 110, 142);   P_HIGH  = (130, 160, 200)
G_GLOW  = (170, 8,   8);    G_MID   = (225, 35,  35)
G_CORE  = (255, 110, 110);  G_WHITE = (255, 200, 200)
V_DARK  = (40,  54,  72);   V_MID   = (72,  92,  118)
V_LIGHT = (122, 150, 185)
CYAN    = (0,   240, 220);  GREEN   = (0,   230, 90)
RED_LED = (255, 40,  40);   ORANGE  = (255, 140, 0)
WHITE   = (255, 255, 255);  PANEL   = (14,  24,  48)
LABEL_C = (185, 210, 255);  AMBER   = (255, 160, 0)
R = 32  # 파이프 반지름


# ── 파이프/엘보/VCR ──────────────────────────────────────────────────────────

def ph(x1, y, x2, r=R):
    if x2 <= x1: return
    draw.rectangle([x1, y-r, x2, y+r], fill=P_DARK)
    bw = r*2
    for bs, be, col in [(0,int(bw*.10),P_HIGH),(int(bw*.10),int(bw*.28),P_LIGHT),
                         (int(bw*.28),int(bw*.55),P_MID),(int(bw*.55),int(bw*.80),P_DARK),
                         (int(bw*.80),bw,(16,25,40))]:
        draw.rectangle([x1, y-r+bs, x2, y-r+be], fill=col)
    gr=int(r*.68); draw.rectangle([x1,y-gr,x2,y+gr], fill=G_GLOW)
    mr=int(r*.44); draw.rectangle([x1,y-mr,x2,y+mr], fill=G_MID)
    cr=int(r*.22); draw.rectangle([x1,y-cr,x2,y+cr], fill=G_CORE)
    hr=max(2,int(r*.10)); draw.rectangle([x1,y-hr,x2,y+hr], fill=G_WHITE)
    glow_draw.rectangle([x1-4,y-r-26,x2+4,y+r+26], fill=(210,0,0,50))

def pv(x, y1, y2, r=R):
    if y2 <= y1: return
    draw.rectangle([x-r, y1, x+r, y2], fill=P_DARK)
    bw = r*2
    for bs, be, col in [(0,int(bw*.10),P_HIGH),(int(bw*.10),int(bw*.28),P_LIGHT),
                         (int(bw*.28),int(bw*.55),P_MID),(int(bw*.55),int(bw*.80),P_DARK),
                         (int(bw*.80),bw,(16,25,40))]:
        draw.rectangle([x-r+bs, y1, x-r+be, y2], fill=col)
    gr=int(r*.68); draw.rectangle([x-gr,y1,x+gr,y2], fill=G_GLOW)
    mr=int(r*.44); draw.rectangle([x-mr,y1,x+mr,y2], fill=G_MID)
    cr=int(r*.22); draw.rectangle([x-cr,y1,x+cr,y2], fill=G_CORE)
    hr=max(2,int(r*.10)); draw.rectangle([x-hr,y1,x+hr,y2], fill=G_WHITE)
    glow_draw.rectangle([x-r-26,y1-4,x+r+26,y2+4], fill=(210,0,0,50))

def elb(cx, cy, r=R):
    er=r+16; draw.ellipse([cx-er,cy-er,cx+er,cy+er], fill=P_MID)
    draw.ellipse([cx-r,cy-r,cx+r,cy+r], fill=P_HIGH)
    gr=int(r*.68); draw.ellipse([cx-gr,cy-gr,cx+gr,cy+gr], fill=G_GLOW)
    mr=int(r*.44); draw.ellipse([cx-mr,cy-mr,cx+mr,cy+mr], fill=G_MID)
    cr=int(r*.22); draw.ellipse([cx-cr,cy-cr,cx+cr,cy+cr], fill=G_CORE)
    glow_draw.ellipse([cx-r-28,cy-r-28,cx+r+28,cy+r+28], fill=(210,0,0,68))

def vcr(cx, cy, r=R):
    fw=int(r*.92); fh=r+12
    draw.rectangle([cx-fw,cy-fh,cx+fw,cy+fh], fill=V_MID)
    draw.rectangle([cx-fw,cy-fh,cx+fw,cy-fh+6], fill=V_LIGHT)
    draw.rectangle([cx-fw,cy+fh-6,cx+fw,cy+fh], fill=V_DARK)
    draw.rectangle([cx-fw,cy-fh,cx-fw+5,cy+fh], fill=V_LIGHT)
    draw.rectangle([cx+fw-5,cy-fh,cx+fw,cy+fh], fill=V_DARK)
    gr=int(r*.62); draw.rectangle([cx-gr,cy-gr,cx+gr,cy+gr], fill=G_MID)


# ── 컴포넌트 ─────────────────────────────────────────────────────────────────

def pt(cx, cy, tag, val, r=R):
    stub=40
    draw.rectangle([cx-8,cy-r-stub,cx+8,cy-r], fill=V_MID)
    sw,sh=155,80; sx,sy=cx-sw//2, cy-r-stub-sh
    draw.rectangle([sx,sy,sx+sw,sy+sh], fill=PANEL)
    draw.rectangle([sx,sy,sx+sw,sy+3],  fill=CYAN)
    draw.rectangle([sx,sy,sx+3,sy+sh],  fill=CYAN)
    draw.text((sx+8,sy+8),  tag, fill=CYAN,  font=fnt_label)
    draw.text((sx+8,sy+34), val, fill=WHITE, font=fnt_tag)
    draw.text((sx+8,sy+62), "MPa", fill=(95,135,185), font=fnt_xs)

def lf(cx, cy, tag, r=R):
    fw=82; fh=r+38
    draw.rectangle([cx-fw,cy-fh,cx+fw,cy+fh], fill=(26,38,58))
    draw.rectangle([cx-fw,cy-fh,cx+fw,cy-fh+6], fill=V_LIGHT)
    draw.rectangle([cx-fw,cy+fh-6,cx+fw,cy+fh], fill=V_DARK)
    draw.rectangle([cx-fw,cy-fh,cx-fw+5,cy+fh], fill=V_LIGHT)
    draw.rectangle([cx+fw-5,cy-fh,cx+fw,cy+fh], fill=V_DARK)
    for i in range(-5, 6):
        lx=cx+i*14; col=(42,60,82) if abs(i)%2==0 else (34,50,70)
        draw.rectangle([lx-4,cy-fh+8,lx+4,cy+fh-8], fill=col)
    gr=int(r*.68); draw.rectangle([cx-fw,cy-gr,cx+fw,cy+gr], fill=G_GLOW)
    mr=int(r*.44); draw.rectangle([cx-fw,cy-mr,cx+fw,cy+mr], fill=G_MID)
    cr=int(r*.22); draw.rectangle([cx-fw,cy-cr,cx+fw,cy+cr], fill=G_CORE)
    # dP 게이지
    gx,gy=cx,cy-fh-38; draw.rectangle([cx-5,cy-fh-6,cx+5,cy-fh], fill=V_MID)
    draw.ellipse([gx-26,gy-26,gx+26,gy+26], fill=(20,32,52))
    draw.ellipse([gx-24,gy-24,gx+24,gy+24], fill=(14,24,42))
    for ang in range(0,360,30):
        rad=math.radians(ang)
        draw.line([gx+int(16*math.cos(rad)),gy+int(16*math.sin(rad)),
                   gx+int(22*math.cos(rad)),gy+int(22*math.sin(rad))],
                  fill=(52,76,110),width=1)
    nang=math.radians(-40)
    draw.line([gx,gy,gx+int(16*math.cos(nang)),gy+int(16*math.sin(nang))],
              fill=ORANGE,width=2)
    draw.text((cx-26,cy+fh+10), tag, fill=LABEL_C, font=fnt_small)

def av(cx, cy, tag, is_open=True, r=R):
    bw=60; bh=50; aw=42; ah=78
    led_col=GREEN if is_open else RED_LED
    draw.rectangle([cx-bw,cy-bh,cx+bw,cy+bh], fill=(34,48,70))
    draw.rectangle([cx-bw,cy-bh,cx+bw,cy-bh+6],  fill=V_LIGHT)
    draw.rectangle([cx-bw,cy+bh-6,cx+bw,cy+bh],  fill=V_DARK)
    draw.rectangle([cx-bw,cy-bh,cx-bw+6,cy+bh],  fill=V_LIGHT)
    gr=int(r*.68); draw.rectangle([cx-bw,cy-gr,cx+bw,cy+gr], fill=G_GLOW)
    mr=int(r*.44); draw.rectangle([cx-bw,cy-mr,cx+bw,cy+mr], fill=G_MID)
    cr=int(r*.22); draw.rectangle([cx-bw,cy-cr,cx+bw,cy+cr], fill=G_CORE)
    draw.rectangle([cx-aw,cy-bh-ah,cx+aw,cy-bh], fill=(34,50,72))
    draw.rectangle([cx-aw,cy-bh-ah,cx+aw,cy-bh-ah+5], fill=(65,88,122))
    draw.rectangle([cx-aw,cy-bh-ah,cx-aw+5,cy-bh], fill=(65,88,122))
    for ly in range(cy-bh-ah+16, cy-bh, 24):
        draw.rectangle([cx-aw+5,ly,cx+aw-5,ly+6], fill=(20,30,50))
    dy=cy-bh-ah-28
    draw.ellipse([cx-24,dy-24,cx+24,dy+24], fill=(16,28,48))
    draw.ellipse([cx-20,dy-20,cx+20,dy+20], fill=led_col)
    draw.ellipse([cx-10,dy-17,cx+10,dy-4],  fill=WHITE)
    glow_draw.ellipse([cx-28,dy-28,cx+28,dy+28], fill=(*led_col,85))
    draw.text((cx-28,cy+bh+10), tag, fill=LABEL_C, font=fnt_small)

def reg(cx, cy, tag, r=R):
    bw=74; bh=60
    draw.rectangle([cx-bw,cy-bh,cx+bw,cy+bh], fill=(34,50,72))
    draw.rectangle([cx-bw,cy-bh,cx+bw,cy-bh+6],  fill=V_LIGHT)
    draw.rectangle([cx-bw,cy+bh-6,cx+bw,cy+bh],  fill=V_DARK)
    draw.rectangle([cx-bw,cy-bh,cx-bw+7,cy+bh],  fill=P_HIGH)
    draw.rectangle([cx+bw-7,cy-bh,cx+bw,cy+bh],  fill=P_DARK)
    gr=int(r*.68); draw.rectangle([cx-bw,cy-gr,cx+bw,cy+gr], fill=G_GLOW)
    mr=int(r*.44); draw.rectangle([cx-bw,cy-mr,cx+bw,cy+mr], fill=G_MID)
    cr=int(r*.22); draw.rectangle([cx-bw,cy-cr,cx+bw,cy+cr], fill=G_CORE)
    draw.ellipse([cx-14,cy-bh-26,cx+14,cy-bh],   fill=(46,64,90))
    draw.ellipse([cx-11,cy-bh-23,cx+11,cy-bh-2], fill=(70,94,130))
    for gx_off in [-40,40]:
        gx=cx+gx_off; gy=cy-bh-64
        draw.rectangle([gx-5,gy+22,gx+5,gy+30], fill=V_MID)
        draw.ellipse([gx-26,gy-26,gx+26,gy+26], fill=(18,28,46))
        draw.ellipse([gx-24,gy-24,gx+24,gy+24], fill=(24,38,60))
        for ang in range(0,360,30):
            rad=math.radians(ang)
            draw.line([gx+int(16*math.cos(rad)),gy+int(16*math.sin(rad)),
                       gx+int(22*math.cos(rad)),gy+int(22*math.sin(rad))],
                      fill=(50,76,112),width=1)
        nang=math.radians(-55 if gx_off<0 else -25)
        draw.line([gx,gy,gx+int(15*math.cos(nang)),gy+int(15*math.sin(nang))],
                  fill=ORANGE,width=2)
        draw.ellipse([gx-3,gy-3,gx+3,gy+3], fill=ORANGE)
    draw.text((cx-28,cy+bh+10), tag, fill=LABEL_C, font=fnt_small)

def cyl(cx, cy):
    """실린더 어셈블리, 반환: (파이프연결X, 파이프연결Y)"""
    cw=95; ch=210; cy_top=cy-ch; cy_bot=cy+ch
    sw=cw+40
    # 저울
    draw.rectangle([cx-sw,cy_bot,cx+sw,cy_bot+28], fill=(34,50,72))
    draw.rectangle([cx-sw,cy_bot,cx+sw,cy_bot+5],  fill=V_LIGHT)
    draw.text((cx-46,cy_bot+8), "45.2 kg", fill=CYAN, font=fnt_label)
    # 실린더 몸체
    draw.rectangle([cx-cw,cy_top,cx+cw,cy_bot], fill=(56,72,94))
    draw.rectangle([cx-cw,cy_top,cx-cw+14,cy_bot], fill=P_HIGH)
    draw.rectangle([cx+cw-14,cy_top,cx+cw,cy_bot], fill=P_DARK)
    # 자켓 히터
    jy1,jy2=cy-95,cy+95
    draw.rectangle([cx-cw+2,jy1,cx+cw-2,jy2], fill=(16,16,16))
    for i in range(9):
        yy=jy1+7+i*21
        draw.rectangle([cx-cw+4,yy,cx+cw-4,yy+14], fill=(145,52,0))
        draw.rectangle([cx-cw+4,yy,cx+cw-4,yy+3],  fill=(205,88,0))
    draw.rectangle([cx-62,jy1-46,cx+62,jy1-8], fill=PANEL)
    draw.rectangle([cx-62,jy1-46,cx+62,jy1-43], fill=ORANGE)
    draw.text((cx-54,jy1-42), "65.0°C", fill=WHITE, font=fnt_label)
    # 잔량 바
    bx=cx+cw+12; bh2=172
    draw.rectangle([bx,cy-bh2//2,bx+18,cy+bh2//2], fill=(10,18,32))
    segs=9; seg_h=bh2//segs
    for i in range(segs):
        col=(0,195,60) if i<6 else (215,195,0) if i<8 else (28,42,60)
        yy=cy+bh2//2-(i+1)*seg_h
        draw.rectangle([bx+1,yy+2,bx+17,yy+seg_h-2], fill=col)
    draw.text((bx-26,cy-bh2//2-24), "LEVEL 85%", fill=(0,210,100), font=fnt_xs)
    # 어깨 돔
    draw.ellipse([cx-cw,cy_top-38,cx+cw,cy_top+38], fill=(60,76,98))
    draw.ellipse([cx-cw,cy_top-38,cx-cw+14,cy_top+10], fill=P_HIGH)
    # 넥 가드
    nw=int(cw*.60)
    draw.rectangle([cx-nw,cy_top-38-52,cx+nw,cy_top-38], fill=(44,60,82))
    draw.rectangle([cx-nw,cy_top-38-52,cx+nw,cy_top-38-47], fill=V_LIGHT)
    # V/S 캡
    vs_w=int(nw*.80); vs_y=cy_top-38-52
    draw.rectangle([cx-vs_w,vs_y-35,cx+vs_w,vs_y], fill=(30,44,64))
    draw.ellipse([cx-vs_w+5,vs_y-50,cx+vs_w-5,vs_y-8], fill=(36,52,74))
    draw.ellipse([cx-vs_w+12,vs_y-46,cx+vs_w-12,vs_y-16], fill=(22,34,54))
    draw.ellipse([cx-11,vs_y-44,cx+11,vs_y-26], fill=(200,0,0))
    draw.ellipse([cx-5, vs_y-42,cx+5, vs_y-32], fill=(255,80,80))
    # AG 토출구
    ag_x=cx+nw; ag_y=cy_top-38-26
    draw.rectangle([ag_x,ag_y-13,ag_x+42,ag_y+13], fill=(34,50,72))
    draw.ellipse([ag_x+34,ag_y-20,ag_x+74,ag_y+20], fill=(18,30,50))
    draw.ellipse([ag_x+36,ag_y-18,ag_x+72,ag_y+18], fill=(0,155,225))
    draw.ellipse([ag_x+46,ag_y-8, ag_x+62,ag_y+8],  fill=(0,80,200))
    glow_draw.ellipse([ag_x+32,ag_y-22,ag_x+76,ag_y+22], fill=(0,180,255,80))
    # AG 출구 소켓 → 수직파이프 연결점
    out_x=ag_x+74; out_y=ag_y
    draw.rectangle([out_x,out_y-R,out_x+22,out_y+R], fill=P_MID)
    draw.rectangle([out_x,out_y-int(R*.44),out_x+22,out_y+int(R*.44)], fill=G_MID)
    # 라벨
    draw.text((cx-72,cy_bot+34), "Cylinder Ass'y", fill=WHITE, font=fnt_label)
    return out_x+22, out_y

def proc(x, cy):
    pw,ph=130,68
    draw.rectangle([x,cy-ph//2,x+pw,cy+ph//2], fill=PANEL)
    draw.rectangle([x,cy-ph//2,x+5, cy+ph//2], fill=ORANGE)
    draw.rectangle([x,cy-ph//2,x+pw,cy-ph//2+4], fill=ORANGE)
    draw.text((x+10,cy-26), "PROCESS", fill=WHITE,   font=fnt_bold)
    draw.text((x+22,cy+6),  "OUTLET",  fill=LABEL_C, font=fnt_small)


# ═══════════════════════════════════════════════════════════════════════════════
#  레이아웃
# ═══════════════════════════════════════════════════════════════════════════════
Y_TOP = 340; Y_BOT = 780
CYL_CX = 165; CYL_CY = (Y_TOP+Y_BOT)//2   # 560

BEND_X = W - 80

# 실린더 AG 출구 → 수직파이프 X
# nw = int(95*0.60) = 57 → ag_x = 165+57=222, out_x = 222+74+22 = 318
VERT_X = 318

# 상단 배관: VERT_X+R ~ BEND_X
# 5개 컴포넌트: HPT, LF1, HPI, REG1, MPT
# 각 폭: 8, 82, 60, 74, 8 → total = 232 × 2 = 464
# 전체 공간 = BEND_X - (VERT_X+R) = (2600-80) - (318+32) = 2170
# 공간 - 464 = 1706 → 6 gap = ~284 each

TOP_AVAIL = BEND_X - (VERT_X + R)
COMP_W_TOP = [8,82,60,74,8]  # 각 반폭
COMP_TOTAL  = sum(w*2 for w in COMP_W_TOP)
GAP_T = (TOP_AVAIL - COMP_TOTAL) // 6

cx = VERT_X + R + GAP_T
HPT_X  = cx + COMP_W_TOP[0]; cx = HPT_X  + COMP_W_TOP[0] + GAP_T
LF1_X  = cx + COMP_W_TOP[1]; cx = LF1_X  + COMP_W_TOP[1] + GAP_T
HPI_X  = cx + COMP_W_TOP[2]; cx = HPI_X  + COMP_W_TOP[2] + GAP_T
REG1_X = cx + COMP_W_TOP[3]; cx = REG1_X + COMP_W_TOP[3] + GAP_T
MPT_X  = cx + COMP_W_TOP[4]

# 하단 배관: PROC_X+130 ~ BEND_X
# 컴포넌트: PROCESS(130), FPT, LF2, FPV, LPI, LPT, REG2
# 반폭: FPT=8, LF2=82, FPV=60, LPI=60, LPT=8, REG2=74
# PROC_X는 좌측 여백에 고정 → PROC_X = VERT_X - R (배관 시작과 맞춤)
PROC_X = VERT_X - R

BOT_AVAIL = BEND_X - (PROC_X + 130)
COMP_W_BOT = [8,82,60,60,8,74]  # FPT, LF2, FPV, LPI, LPT, REG2 반폭
COMP_TOTAL_B = sum(w*2 for w in COMP_W_BOT)
GAP_B = (BOT_AVAIL - COMP_TOTAL_B) // 7

cx = PROC_X + 130 + GAP_B
FPT_X  = cx + COMP_W_BOT[0]; cx = FPT_X  + COMP_W_BOT[0] + GAP_B
LF2_X  = cx + COMP_W_BOT[1]; cx = LF2_X  + COMP_W_BOT[1] + GAP_B
FPV_X  = cx + COMP_W_BOT[2]; cx = FPV_X  + COMP_W_BOT[2] + GAP_B
LPI_X  = cx + COMP_W_BOT[3]; cx = LPI_X  + COMP_W_BOT[3] + GAP_B
LPT_X  = cx + COMP_W_BOT[4]; cx = LPT_X  + COMP_W_BOT[4] + GAP_B
REG2_X = cx + COMP_W_BOT[5]

print(f"Layout: VERT_X={VERT_X}, BEND_X={BEND_X}")
print(f"TOP: HPT={HPT_X}, LF1={LF1_X}, HPI={HPI_X}, REG1={REG1_X}, MPT={MPT_X}")
print(f"BOT: FPT={FPT_X}, LF2={LF2_X}, FPV={FPV_X}, LPI={LPI_X}, LPT={LPT_X}, REG2={REG2_X}")

# ═══════════════════════════════════════════════════════════════════════════════
#  그리기
# ═══════════════════════════════════════════════════════════════════════════════

# 격자
for gx_i in range(0,W,80): draw.line([gx_i,65,gx_i,H-50], fill=(14,24,40), width=1)
for gy_i in range(65,H-50,80): draw.line([0,gy_i,W,gy_i], fill=(14,24,40), width=1)

# 실린더
ag_ox, ag_oy = cyl(CYL_CX, CYL_CY)

# 실린더 AG 출구 → 수직파이프 → 상단 배관 Y
pv(VERT_X, ag_oy, Y_TOP, R)

# 상단 배관
ph(VERT_X+R, Y_TOP, HPT_X-8,   R); vcr(HPT_X-8,   Y_TOP, R)
ph(HPT_X+8,  Y_TOP, LF1_X-82,  R); vcr(LF1_X-82,  Y_TOP, R)
ph(LF1_X+82, Y_TOP, HPI_X-60,  R); vcr(HPI_X-60,  Y_TOP, R)
ph(HPI_X+60, Y_TOP, REG1_X-74, R); vcr(REG1_X-74, Y_TOP, R)
ph(REG1_X+74,Y_TOP, MPT_X-8,   R); vcr(MPT_X-8,   Y_TOP, R)
ph(MPT_X+8,  Y_TOP, BEND_X,    R)

# 수직 엘보
elb(BEND_X, Y_TOP, R)
pv(BEND_X, Y_TOP+R, Y_BOT-R, R)
elb(BEND_X, Y_BOT, R)

# 하단 배관 (우→좌)
ph(REG2_X+74, Y_BOT, BEND_X, R);      vcr(REG2_X+74, Y_BOT, R)
ph(LPT_X+8,   Y_BOT, REG2_X-74, R);   vcr(REG2_X-74, Y_BOT, R); vcr(LPT_X+8,   Y_BOT, R)
ph(LPI_X+60,  Y_BOT, LPT_X-8,   R);   vcr(LPT_X-8,   Y_BOT, R); vcr(LPI_X+60,  Y_BOT, R)
ph(FPV_X+60,  Y_BOT, LPI_X-60,  R);   vcr(LPI_X-60,  Y_BOT, R); vcr(FPV_X+60,  Y_BOT, R)
ph(LF2_X+82,  Y_BOT, FPV_X-60,  R);   vcr(FPV_X-60,  Y_BOT, R); vcr(LF2_X+82,  Y_BOT, R)
ph(FPT_X+8,   Y_BOT, LF2_X-82,  R);   vcr(LF2_X-82,  Y_BOT, R); vcr(FPT_X+8,   Y_BOT, R)
ph(PROC_X+130,Y_BOT, FPT_X-8,   R);   vcr(FPT_X-8,   Y_BOT, R)

# 컴포넌트 오버레이 (파이프 위에 그려서 자연스럽게)
pt(HPT_X,  Y_TOP, "HPT",  "12.500", R)
lf(LF1_X,  Y_TOP, "LF-1", R)
av(HPI_X,  Y_TOP, "HPI",  is_open=True,  r=R)
reg(REG1_X, Y_TOP, "Reg-1", R)
pt(MPT_X,  Y_TOP, "MPT",  "0.800",  R)

reg(REG2_X, Y_BOT, "Reg-2", R)
pt(LPT_X,  Y_BOT, "LPT",  "0.300",  R)
av(LPI_X,  Y_BOT, "LPI",  is_open=True,  r=R)
av(FPV_X,  Y_BOT, "FPV",  is_open=False, r=R)
lf(LF2_X,  Y_BOT, "LF-2", R)
pt(FPT_X,  Y_BOT, "FPT",  "0.250",  R)
proc(PROC_X, Y_BOT)

# 글로우 합성
glow_blurred = glow_layer.filter(ImageFilter.GaussianBlur(radius=28))
img_rgba = img.convert("RGBA")
img_rgba = Image.alpha_composite(img_rgba, glow_blurred)
img = img_rgba.convert("RGB")
draw = ImageDraw.Draw(img)

# 타이틀 바
draw.rectangle([0,0,W,65], fill=(4,12,26))
draw.rectangle([0,63,W,67], fill=CYAN)
draw.text((30,14), "GAS CABINET P&ID  —  RED GAS PROCESS LINE", fill=WHITE, font=fnt_title)
draw.text((W-430,18), "REV.07  |  MONITORING PC", fill=LABEL_C, font=fnt_label)

# 흐름 화살표 (상단 우향)
for ax in [VERT_X+R+80, (HPT_X+LF1_X)//2, (LF1_X+HPI_X)//2, (HPI_X+REG1_X)//2, (REG1_X+MPT_X)//2]:
    pts=[(ax,Y_TOP-46),(ax+26,Y_TOP-28),(ax,Y_TOP-10)]
    draw.polygon(pts, fill=(255,50,50))

# 흐름 화살표 (하단 좌향)
for ax in [(LPT_X+LPI_X)//2, (FPV_X+LF2_X)//2, (LF2_X+FPT_X)//2, FPT_X-100]:
    pts=[(ax,Y_BOT-46),(ax-26,Y_BOT-28),(ax,Y_BOT-10)]
    draw.polygon(pts, fill=(255,50,50))

# 하단 바
draw.rectangle([0,H-52,W,H], fill=(4,12,26))
draw.rectangle([0,H-54,W,H-52], fill=CYAN)
seq=("FLOW: Cylinder Ass'y  →  HPT  →  LF-1  →  HPI  →  Reg-1  →  MPT  "
     "║  Reg-2  →  LPT  →  LPI  →  FPV  →  LF-2  →  FPT  →  PROCESS")
draw.text((24,H-42), seq, fill=LABEL_C, font=fnt_xs)

# 저장
out=r"C:\Users\rokaf\.gemini\antigravity\brain\9bf099c1-610b-408f-b5e2-f7535255d281\pid_neon_redgas_v7.png"
img.save(out,"PNG")
print(f"[OK] 저장: {out}  ({W}x{H})")
