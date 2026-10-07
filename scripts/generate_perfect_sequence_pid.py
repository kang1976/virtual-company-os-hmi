import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

out_path = r'C:\Users\rokaf\.gemini\antigravity\brain\9bf099c1-610b-408f-b5e2-f7535255d281\exact_sequence_red_gas_pid.png'
cyl_path = r'C:\Users\rokaf\.gemini\antigravity\brain\9bf099c1-610b-408f-b5e2-f7535255d281\cylinder_unit_v3_balanced.png'

# 1. Base Dimensions: 2560 x 1440 (Ultra High-Definition 16:9)
W, H = 2560, 1440
bg_color = (11, 15, 23) # Dark modern SCADA slate

canvas = Image.new("RGBA", (W, H), bg_color)
draw = ImageDraw.Draw(canvas)

# Fonts: Malgun Gothic (Windows Standard)
try:
    font_main_title = ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 36)
    font_sub_title = ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 24)
    font_stage_num = ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 16)
    font_part_tag = ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 20)
    font_part_name = ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 16)
    font_hud_tag = ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 15)
    font_hud_val = ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", 22)
    font_matrix = ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 17)
    font_matrix_bd = ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 19)
except Exception:
    font_main_title = font_sub_title = font_stage_num = font_part_tag = font_part_name = font_hud_tag = font_hud_val = font_matrix = font_matrix_bd = ImageFont.load_default()

# ── Load and Prepare Cylinder Unit ──
cyl_raw = Image.open(cyl_path).convert("RGBA")
# Remove dark background around cylinder for clean alpha blending
cyl_arr = np.array(cyl_raw)
# Cylinder width and height scaling
cyl_target_w = 340
cyl_target_h = int(cyl_raw.height * (cyl_target_w / cyl_raw.width))
cyl_img = cyl_raw.resize((cyl_target_w, cyl_target_h), Image.Resampling.LANCZOS)

# Position Cylinder on bottom-left
cyl_x = 90
cyl_y = H - cyl_target_h - 120
canvas.paste(cyl_img, (cyl_x, cyl_y), cyl_img)

# Exact coordinate of AG outlet port
ag_port_x = cyl_x + int(cyl_target_w * 0.72)
ag_port_y = cyl_y + int(cyl_target_h * 0.205)

# ── Pipeline Coordinates ──
# 2-Tier Orthogonal Layout:
# Tier 1 (Lower Level at y = ag_port_y): Cylinder AG -> PT(HPT) -> LF(Filter 1) -> Air Valve(HPI) -> UP bend
# Tier 2 (Upper Level at y = 420): UP bend -> Regulator 1 -> PT(MPT) -> Regulator 2 -> PT(LPT) -> Air Valve(LPI) -> Air Valve(FPV) -> LF(Filter 2) -> PT(FPT) -> PROCESS Header

r1_y = ag_port_y
r2_y = 380
bend_x = 1060
proc_x = 2440

# Draw Glowing Red Glass Pipe
def draw_red_glass_pipe(p1, p2, width=20):
    x1, y1 = p1
    x2, y2 = p2
    # Outer dark glass sheath
    draw.line([(x1, y1), (x2, y2)], fill=(50, 15, 25, 255), width=width + 8)
    # Metallic glass rim reflections
    draw.line([(x1, y1), (x2, y2)], fill=(130, 35, 45, 255), width=width + 2)
    # Intense red glowing fluid core
    draw.line([(x1, y1), (x2, y2)], fill=(255, 30, 45, 255), width=width - 4)
    # Hot center laser reflection
    draw.line([(x1, y1), (x2, y2)], fill=(255, 180, 180, 255), width=4)

# ── Draw 3D Components Directly for Maximum Crispness ──

def draw_3d_valve(cx, cy, tag, name, is_open=True):
    # Valve body (metallic horizontal spool)
    draw.rounded_rectangle([(cx - 32, cy - 12), (cx + 32, cy + 12)], radius=4, fill=(180, 190, 205), outline=(90, 105, 125), width=2)
    # Vertical neck
    draw.rectangle([(cx - 10, cy - 35), (cx + 10, cy - 10)], fill=(160, 170, 185), outline=(80, 95, 115), width=1)
    # Cylinder actuator housing
    draw.rounded_rectangle([(cx - 24, cy - 80), (cx + 24, cy - 35)], radius=6, fill=(110, 125, 145), outline=(60, 75, 95), width=2)
    # Top Dome LED
    dome_color = (0, 255, 120) if is_open else (255, 40, 40)
    glow_color = (0, 255, 120, 120) if is_open else (255, 40, 40, 120)
    draw.chord([(cx - 18, cy - 110), (cx + 18, cy - 75)], 180, 360, fill=dome_color, outline=(255, 255, 255), width=2)
    # LED light center highlight
    draw.ellipse([(cx - 6, cy - 100), (cx + 6, cy - 90)], fill=(255, 255, 255))
    
    # Badge Underneath
    draw_part_badge(cx, cy, tag, name, (0, 255, 140) if is_open else (255, 80, 80))

def draw_3d_regulator(cx, cy, tag, name):
    # Main brass/metallic block
    draw.rounded_rectangle([(cx - 36, cy - 22), (cx + 36, cy + 22)], radius=6, fill=(160, 175, 195), outline=(80, 95, 115), width=2)
    # Dual Mini Dial Pressure Gauges on top
    for dx, g_label in [(-22, "1차"), (22, "2차")]:
        # stem
        draw.line([(cx + dx, cy - 22), (cx + dx, cy - 42)], fill=(120, 135, 155), width=4)
        # dial gauge circle
        draw.ellipse([(cx + dx - 22, cy - 86), (cx + dx + 22, cy - 42)], fill=(240, 245, 250), outline=(50, 65, 85), width=2)
        # dial scale markings
        draw.arc([(cx + dx - 18, cy - 82), (cx + dx + 18, cy - 46)], 140, 40, fill=(40, 50, 65), width=2)
        # dial needle (pointing at high/regulated pressure)
        draw.line([(cx + dx, cy - 64), (cx + dx + 10, cy - 75)], fill=(255, 50, 50), width=2)
        draw.ellipse([(cx + dx - 3, cy - 67), (cx + dx + 3, cy - 61)], fill=(30, 40, 50))
    # Bottom adjustment knob
    draw.rounded_rectangle([(cx - 16, cy + 22), (cx + 16, cy + 42)], radius=4, fill=(90, 105, 125), outline=(50, 65, 85), width=1)
    
    draw_part_badge(cx, cy, tag, name, (255, 200, 50))

def draw_3d_filter(cx, cy, tag, name):
    # Stainless cylindrical filter housing
    draw.rounded_rectangle([(cx - 40, cy - 18), (cx + 40, cy + 18)], radius=8, fill=(175, 185, 200), outline=(90, 105, 125), width=2)
    # Center mesh inspection window
    draw.rounded_rectangle([(cx - 22, cy - 12), (cx + 22, cy + 12)], radius=4, fill=(40, 50, 65), outline=(200, 220, 245), width=1)
    # Mesh cross grid
    for mx in range(cx - 18, cx + 22, 6):
        draw.line([(mx, cy - 10), (mx, cy + 10)], fill=(120, 145, 175), width=1)
    for my in range(cy - 8, cy + 10, 5):
        draw.line([(cx - 20, my), (cx + 20, my)], fill=(120, 145, 175), width=1)
    
    draw_part_badge(cx, cy, tag, name, (100, 200, 255))

def draw_hud_card(cx, cy, stage_num, tag, value, unit="PSI"):
    card_w, card_h = 145, 80
    card_top = cy - card_h - 26
    # Connecting line from pipe to card
    draw.line([(cx, cy), (cx, cy - 26)], fill=(0, 240, 255), width=2)
    draw.ellipse([(cx - 4, cy - 4), (cx + 4, cy + 4)], fill=(0, 240, 255))
    
    # Semi-transparent glassmorphism box
    draw.rounded_rectangle([(cx - card_w//2, card_top), (cx + card_w//2, card_top + card_h)], radius=10, fill=(16, 24, 38), outline=(0, 240, 255), width=2)
    # Top header bar inside card
    draw.rounded_rectangle([(cx - card_w//2 + 2, card_top + 2), (cx + card_w//2 - 2, card_top + 24)], radius=8, fill=(24, 36, 56))
    
    # Stage & Tag
    draw.text((cx - card_w//2 + 10, card_top + 4), f"#{stage_num} {tag}", fill=(0, 240, 255), font=font_hud_tag)
    # Big Value Display
    draw.text((cx - card_w//2 + 12, card_top + 34), f"{value}", fill=(255, 255, 255), font=font_hud_val)
    draw.text((cx + card_w//2 - 45, card_top + 42), f"{unit}", fill=(0, 240, 255), font=font_hud_tag)

def draw_part_badge(cx, cy, tag, name, tag_color):
    box_w, box_h = 145, 55
    box_top = cy + 30
    draw.rounded_rectangle([(cx - box_w//2, box_top), (cx + box_w//2, box_top + box_h)], radius=8, fill=(16, 22, 34), outline=(50, 70, 95), width=1)
    draw.text((cx - box_w//2 + 10, box_top + 6), tag, fill=tag_color, font=font_part_tag)
    draw.text((cx - box_w//2 + 10, box_top + 30), name, fill=(210, 220, 235), font=font_part_name)

# ── Draw Main Pipeline ──
# 1. Tier 1 horizontal: Cylinder AG -> Bend
draw_red_glass_pipe((ag_port_x, r1_y), (bend_x, r1_y))
# 2. Vertical rising pipe: Bend Tier 1 -> Tier 2
draw_red_glass_pipe((bend_x, r1_y), (bend_x, r2_y))
# 3. Tier 2 horizontal: Bend -> Process Terminal
draw_red_glass_pipe((bend_x, r2_y), (proc_x, r2_y))

# Draw Spiral Cyber-Neon Line Heater on vertical pipe
for sy in range(r2_y + 40, r1_y - 40, 35):
    draw.arc([(bend_x - 35, sy - 15), (bend_x + 35, sy + 15)], 0, 180, fill=(255, 140, 0), width=6)
    draw.arc([(bend_x - 35, sy - 15), (bend_x + 35, sy + 15)], 180, 360, fill=(255, 80, 0), width=3)
# Line heater HUD
draw.rounded_rectangle([(bend_x + 45, (r1_y + r2_y)//2 - 20), (bend_x + 160, (r1_y + r2_y)//2 + 20)], radius=6, fill=(20, 25, 35), outline=(255, 140, 0), width=1)
draw.text((bend_x + 55, (r1_y + r2_y)//2 - 10), "HEATER 65°C", fill=(255, 160, 40), font=font_hud_tag)

# ── 1. Sequence Stage Placement (Left to Right Exactly as Requested) ──

# [Stage 1]: 실린더 Ass'y (Bottom Left, already placed)
draw.rounded_rectangle([(cyl_x, cyl_y - 50), (cyl_x + 300, cyl_y - 10)], radius=8, fill=(18, 25, 40), outline=(0, 240, 255), width=2)
draw.text((cyl_x + 15, cyl_y - 42), "1. 실린더 Ass'y (VS+AG+히터+저울)", fill=(0, 240, 255), font=font_part_tag)

# [Stage 2]: PT(HPT) 고압 압력 센서
s2_x = 510
draw_hud_card(s2_x, r1_y, 2, "PT (HPT)", "2250.0", "PSI")
draw_part_badge(s2_x, r1_y, "PT (HPT)", "고압 센서", (0, 240, 255))

# [Stage 3]: LF(필터 1) 메쉬 라인 필터
s3_x = 700
draw_3d_filter(s3_x, r1_y, "LF (필터 1)", "고압 라인필터")

# [Stage 4]: Air Valve(HPI) 고압 공압 밸브
s4_x = 890
draw_3d_valve(s4_x, r1_y, "Air Valve(HPI)", "고압 인바운드 밸브", True)

# [Stage 5]: Regulator 1 (1단 감압 레귤레이터)
s5_x = 1220
draw_3d_regulator(s5_x, r2_y, "Regulator 1", "1차 감압 (H to M)")

# [Stage 6]: PT(MPT) 중압 압력 센서
s6_x = 1390
draw_hud_card(s6_x, r2_y, 6, "PT (MPT)", "350.0", "PSI")
draw_part_badge(s6_x, r2_y, "PT (MPT)", "중압 센서", (0, 240, 255))

# [Stage 7]: Regulator 2 (2단 감압 레귤레이터)
s7_x = 1560
draw_3d_regulator(s7_x, r2_y, "Regulator 2", "2차 감압 (M to L)")

# [Stage 8]: PT(LPT) 저압 압력 센서
s8_x = 1730
draw_hud_card(s8_x, r2_y, 8, "PT (LPT)", "65.0", "PSI")
draw_part_badge(s8_x, r2_y, "PT (LPT)", "저압 센서", (0, 240, 255))

# [Stage 9]: Air Valve(LPI) 저압 공압 밸브
s9_x = 1900
draw_3d_valve(s9_x, r2_y, "Air Valve(LPI)", "저압 인바운드 밸브", True)

# [Stage 10]: Air Valve(FPV) 최종 공정 밸브
s10_x = 2060
draw_3d_valve(s10_x, r2_y, "Air Valve(FPV)", "최종 공정 공급밸브", True)

# [Stage 11]: LF(필터 2) 최종 라인 필터
s11_x = 2210
draw_3d_filter(s11_x, r2_y, "LF (필터 2)", "최종 공정필터")

# [Stage 12]: PT(FPT) 최종 공정 압력 센서
s12_x = 2340
draw_hud_card(s12_x, r2_y, 12, "PT (FPT)", "60.2", "PSI")
draw_part_badge(s12_x, r2_y, "PT (FPT)", "최종 공정압 센서", (0, 240, 255))

# [Stage 13]: PROCESS 공정 배관 헤더 터미널
draw.rounded_rectangle([(proc_x - 35, r2_y - 130), (proc_x + 50, r2_y + 130)], radius=14, fill=(25, 38, 58), outline=(0, 240, 255), width=3)
# Vertical PROCESS text
p_text = ["P", "R", "O", "C", "E", "S", "S"]
for idx, ch in enumerate(p_text):
    draw.text((proc_x - 10, r2_y - 110 + idx * 32), ch, fill=(0, 240, 255), font=font_sub_title)
# Outbound directional arrow
draw.polygon([(proc_x + 65, r2_y), (proc_x + 95, r2_y - 20), (proc_x + 95, r2_y + 20)], fill=(0, 240, 255))
draw.text((proc_x - 20, r2_y + 145), "13. PROCESS", fill=(0, 240, 255), font=font_part_tag)

# ── Draw Flow Direction Arrows along Red Gas Pipe ──
flow_x_positions = [420, 600, 790, 975, 1060, 1140, 1310, 1475, 1645, 1815, 1980, 2135, 2275]
for fx in flow_x_positions:
    if fx == 1060:
        # vertical arrow going up
        fy = (r1_y + r2_y) // 2 + 30
        draw.polygon([(fx, fy - 16), (fx - 10, fy + 8), (fx + 10, fy + 8)], fill=(255, 140, 140))
    else:
        fy = r1_y if fx < bend_x else r2_y
        draw.polygon([(fx + 16, fy), (fx - 8, fy - 10), (fx - 8, fy + 10)], fill=(255, 140, 140))

# ── Title Bar ──
draw.rounded_rectangle([(70, 35), (W - 70, 115)], radius=12, fill=(18, 24, 38), outline=(45, 60, 85), width=2)
draw.text((100, 52), "반도체 특수가스 캐비닛 P&ID — 사장님 지정 단일 계통 완벽 순서도", fill=(0, 240, 255), font=font_main_title)
# Red gas indicator badge
draw.rounded_rectangle([(1850, 48), (W - 90, 102)], radius=8, fill=(45, 15, 25), outline=(255, 40, 60), width=2)
draw.ellipse([(1870, 67), (1886, 83)], fill=(255, 30, 45))
draw.text((1900, 60), "가스 라인 상태: RED GAS (특수가스 공정 모드)", fill=(255, 120, 120), font=font_sub_title)

# ── Bottom 100% Sequence Flow Matrix ──
matrix_y = H - 210
draw.rounded_rectangle([(cyl_x + cyl_target_w + 40, matrix_y), (W - 70, H - 50)], radius=14, fill=(16, 22, 34), outline=(45, 60, 85), width=2)

draw.text((cyl_x + cyl_target_w + 70, matrix_y + 20), "📋 13단계 지정 배관 공정 순서(P&ID Sequence) 100% 일치 검증표", fill=(0, 240, 255), font=font_matrix_bd)

line1 = "1. 실린더 Ass'y (VS+AG+자켓히터+저울)  ➔  2. PT (HPT 고압)  ➔  3. LF (고압라인필터)  ➔  4. Air Valve (HPI 고압밸브)"
line2 = "5. Regulator 1 (1차 감압)  ➔  6. PT (MPT 중압)  ➔  7. Regulator 2 (2차 감압)  ➔  8. PT (LPT 저압)"
line3 = "9. Air Valve (LPI 저압밸브)  ➔  10. Air Valve (FPV 최종밸브)  ➔  11. LF (최종필터)  ➔  12. PT (FPT 최종압력)  ➔  13. PROCESS (공정 이송)"

draw.text((cyl_x + cyl_target_w + 70, matrix_y + 58), line1, fill=(225, 235, 250), font=font_matrix)
draw.text((cyl_x + cyl_target_w + 70, matrix_y + 92), line2, fill=(225, 235, 250), font=font_matrix)
draw.text((cyl_x + cyl_target_w + 70, matrix_y + 126), line3, fill=(255, 180, 80), font=font_matrix_bd)

# Save
canvas.convert("RGB").save(out_path, "PNG", quality=95)
print("Successfully generated perfect sequence P&ID:", out_path)
