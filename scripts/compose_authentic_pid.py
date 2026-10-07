import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

out_path = r'C:\Users\rokaf\.gemini\antigravity\brain\9bf099c1-610b-408f-b5e2-f7535255d281\authentic_parts_sequence_red_gas_pid.png'
base_dir = r'C:\Users\rokaf\.gemini\antigravity\brain\9bf099c1-610b-408f-b5e2-f7535255d281'

cyl_path = os.path.join(base_dir, 'cylinder_unit_v3_balanced.png')
v_path = os.path.join(base_dir, 'part_valve_3d.png')
r_path = os.path.join(base_dir, 'part_reg_3d.png')
f_path = os.path.join(base_dir, 'part_filter_3d.png')

# Alpha keying function
def make_transparent(im, bg_color=(17, 24, 38), tolerance=22, softness=18):
    im = im.convert("RGBA")
    arr = np.array(im).astype(float)
    bg = np.array(bg_color).astype(float)
    dist = np.linalg.norm(arr[:, :, :3] - bg, axis=2)
    alpha = np.clip((dist - tolerance) / softness, 0, 1) * 255.0
    arr[:, :, 3] = alpha
    return Image.fromarray(arr.astype(np.uint8))

# Process components
valve_clean = make_transparent(Image.open(v_path), bg_color=(17, 24, 38), tolerance=24, softness=15).resize((130, 125), Image.Resampling.LANCZOS)
reg_clean = make_transparent(Image.open(r_path), bg_color=(18, 24, 38), tolerance=22, softness=15).resize((140, 135), Image.Resampling.LANCZOS)
filter_clean = make_transparent(Image.open(f_path), bg_color=(18, 24, 38), tolerance=22, softness=15).resize((145, 125), Image.Resampling.LANCZOS)
cyl_img = Image.open(cyl_path).convert("RGBA")

# 3. Canvas Setup: 2560 x 1440
W, H = 2560, 1440
bg_color = (13, 17, 26)
canvas = Image.new("RGBA", (W, H), bg_color)
draw = ImageDraw.Draw(canvas)

# Fonts
try:
    font_main = ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 36)
    font_sub = ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 22)
    font_tag = ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 19)
    font_name = ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 16)
    font_hud_tag = ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 15)
    font_hud_val = ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", 22)
    font_matrix = ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 17)
    font_matrix_bd = ImageFont.truetype(r"C:\Windows\Fonts\malgunbd.ttf", 19)
except Exception:
    font_main = font_sub = font_tag = font_name = font_hud_tag = font_hud_val = font_matrix = font_matrix_bd = ImageFont.load_default()

# 4. Paste Cylinder Module on bottom-left
cyl_w = 340
cyl_h = int(cyl_img.height * (cyl_w / cyl_img.width))
cyl_resized = cyl_img.resize((cyl_w, cyl_h), Image.Resampling.LANCZOS)
cyl_x = 90
cyl_y = H - cyl_h - 130
canvas.paste(cyl_resized, (cyl_x, cyl_y), cyl_resized)

ag_port_x = cyl_x + int(cyl_w * 0.72)
ag_port_y = cyl_y + int(cyl_h * 0.205)

# Pipeline Tiers
r1_y = ag_port_y
r2_y = 380
bend_x = 1040
proc_x = 2440

# 5. Draw 3D Transparent Red Glass Pipe with Metal Collar Sleeves
def draw_authentic_red_glass_pipe(p1, p2):
    x1, y1 = p1
    x2, y2 = p2
    draw.line([(x1, y1+10), (x2, y2+10)], fill=(5, 8, 12, 200), width=34)
    draw.line([(x1, y1), (x2, y2)], fill=(45, 12, 22, 255), width=28)
    draw.line([(x1, y1), (x2, y2)], fill=(120, 30, 42, 255), width=22)
    draw.line([(x1, y1), (x2, y2)], fill=(255, 35, 55, 255), width=14)
    draw.line([(x1, y1-2), (x2, y2-2)], fill=(255, 190, 190, 255), width=4)
    draw.line([(x1, y1-6), (x2, y2-6)], fill=(180, 220, 255, 180), width=2)

def draw_metal_collar(cx, cy, is_vertical=False):
    if not is_vertical:
        draw.rounded_rectangle([(cx - 8, cy - 18), (cx + 8, cy + 18)], radius=3, fill=(180, 195, 215), outline=(70, 85, 105), width=2)
        draw.line([(cx - 3, cy - 16), (cx - 3, cy + 16)], fill=(240, 245, 255), width=2)
    else:
        draw.rounded_rectangle([(cx - 18, cy - 8), (cx + 18, cy + 8)], radius=3, fill=(180, 195, 215), outline=(70, 85, 105), width=2)
        draw.line([(cx - 16, cy - 3), (cx + 16, cy - 3)], fill=(240, 245, 255), width=2)

# Draw Pipes
draw_authentic_red_glass_pipe((ag_port_x, r1_y), (bend_x, r1_y))
draw_authentic_red_glass_pipe((bend_x, r1_y), (bend_x, r2_y))
draw_authentic_red_glass_pipe((bend_x, r2_y), (proc_x, r2_y))

draw_metal_collar(bend_x, r1_y, True)
draw_metal_collar(bend_x, r2_y, True)

# Spiral Cyber-Neon Line Heater on vertical rising pipe
for sy in range(r2_y + 35, r1_y - 35, 30):
    draw.arc([(bend_x - 34, sy - 14), (bend_x + 34, sy + 14)], 0, 180, fill=(0, 240, 255), width=6)
    draw.arc([(bend_x - 34, sy - 14), (bend_x + 34, sy + 14)], 180, 360, fill=(0, 150, 200), width=3)
# Heater HUD Badge
draw.rounded_rectangle([(bend_x + 45, (r1_y + r2_y)//2 - 20), (bend_x + 175, (r1_y + r2_y)//2 + 20)], radius=6, fill=(16, 24, 38), outline=(0, 240, 255), width=1)
draw.text((bend_x + 55, (r1_y + r2_y)//2 - 10), "HEATER 65°C", fill=(0, 240, 255), font=font_hud_tag)

# Helper for Glassmorphism HUD Card
def draw_glass_hud_card(cx, cy, stage_num, tag, value, unit="PSI"):
    card_w, card_h = 145, 80
    card_top = cy - card_h - 30
    draw.line([(cx, cy), (cx, cy - 30)], fill=(0, 240, 255), width=2)
    draw.ellipse([(cx - 4, cy - 4), (cx + 4, cy + 4)], fill=(0, 240, 255))
    draw.rounded_rectangle([(cx - card_w//2, card_top), (cx + card_w//2, card_top + card_h)], radius=10, fill=(18, 26, 42), outline=(0, 240, 255), width=2)
    draw.rounded_rectangle([(cx - card_w//2 + 2, card_top + 2), (cx + card_w//2 - 2, card_top + 24)], radius=8, fill=(26, 40, 62))
    draw.text((cx - card_w//2 + 10, card_top + 4), f"#{stage_num} {tag}", fill=(0, 240, 255), font=font_hud_tag)
    draw.text((cx - card_w//2 + 12, card_top + 34), f"{value}", fill=(255, 255, 255), font=font_hud_val)
    draw.text((cx + card_w//2 - 45, card_top + 42), f"{unit}", fill=(0, 240, 255), font=font_hud_tag)

def draw_part_label(cx, cy, tag, name, tag_color=(0, 240, 255)):
    box_w, box_h = 150, 58
    box_top = cy + 70
    draw.rounded_rectangle([(cx - box_w//2, box_top), (cx + box_w//2, box_top + box_h)], radius=8, fill=(16, 22, 34), outline=(55, 75, 105), width=1)
    draw.text((cx - box_w//2 + 10, box_top + 6), tag, fill=tag_color, font=font_tag)
    draw.text((cx - box_w//2 + 10, box_top + 32), name, fill=(210, 220, 235), font=font_name)

# ── Place 13 Stages in Exact Flow Order ──

# [Stage 1]: 실린더 Ass'y (Bottom-Left)
draw.rounded_rectangle([(cyl_x, cyl_y - 50), (cyl_x + 310, cyl_y - 10)], radius=8, fill=(18, 25, 40), outline=(0, 240, 255), width=2)
draw.text((cyl_x + 15, cyl_y - 42), "1. 실린더 Ass'y (VS+AG+히터+저울)", fill=(0, 240, 255), font=font_tag)

# [Stage 2]: PT (HPT)
s2_x = 510
draw_metal_collar(s2_x, r1_y)
draw_glass_hud_card(s2_x, r1_y, 2, "PT (HPT)", "2250.0", "PSI")
draw_part_label(s2_x, r1_y, "PT (HPT)", "고압 압력센서", (0, 240, 255))

# [Stage 3]: LF (필터 1) - Authentic 3D Mesh Filter
s3_x = 700
canvas.paste(filter_clean, (s3_x - filter_clean.width//2, r1_y - filter_clean.height//2 - 15), filter_clean)
draw_metal_collar(s3_x - 65, r1_y)
draw_metal_collar(s3_x + 65, r1_y)
draw_part_label(s3_x, r1_y, "LF (필터 1)", "3D 고압 라인필터", (100, 200, 255))

# [Stage 4]: Air Valve (HPI) - Authentic 3D Pneumatic Dome LED Valve
s4_x = 890
canvas.paste(valve_clean, (s4_x - valve_clean.width//2, r1_y - valve_clean.height//2 - 20), valve_clean)
draw_metal_collar(s4_x - 55, r1_y)
draw_metal_collar(s4_x + 55, r1_y)
draw_part_label(s4_x, r1_y, "Air Valve(HPI)", "3D 공압 돔LED 밸브", (0, 255, 140))

# [Stage 5]: Regulator 1 (1차 감압) - Authentic 3D Dual Gauge Regulator
s5_x = 1220
canvas.paste(reg_clean, (s5_x - reg_clean.width//2, r2_y - reg_clean.height//2 - 15), reg_clean)
draw_metal_collar(s5_x - 60, r2_y)
draw_metal_collar(s5_x + 60, r2_y)
draw_part_label(s5_x, r2_y, "Regulator 1", "3D 1차 감압기 (H->M)", (255, 200, 50))

# [Stage 6]: PT (MPT)
s6_x = 1390
draw_metal_collar(s6_x, r2_y)
draw_glass_hud_card(s6_x, r2_y, 6, "PT (MPT)", "350.0", "PSI")
draw_part_label(s6_x, r2_y, "PT (MPT)", "중압 압력센서", (0, 240, 255))

# [Stage 7]: Regulator 2 (2차 감압) - Authentic 3D Dual Gauge Regulator
s7_x = 1560
canvas.paste(reg_clean, (s7_x - reg_clean.width//2, r2_y - reg_clean.height//2 - 15), reg_clean)
draw_metal_collar(s7_x - 60, r2_y)
draw_metal_collar(s7_x + 60, r2_y)
draw_part_label(s7_x, r2_y, "Regulator 2", "3D 2차 감압기 (M->L)", (255, 200, 50))

# [Stage 8]: PT (LPT)
s8_x = 1730
draw_metal_collar(s8_x, r2_y)
draw_glass_hud_card(s8_x, r2_y, 8, "PT (LPT)", "65.0", "PSI")
draw_part_label(s8_x, r2_y, "PT (LPT)", "저압 압력센서", (0, 240, 255))

# [Stage 9]: Air Valve (LPI) - Authentic 3D Pneumatic Dome LED Valve
s9_x = 1900
canvas.paste(valve_clean, (s9_x - valve_clean.width//2, r2_y - valve_clean.height//2 - 20), valve_clean)
draw_metal_collar(s9_x - 55, r2_y)
draw_metal_collar(s9_x + 55, r2_y)
draw_part_label(s9_x, r2_y, "Air Valve(LPI)", "3D 저압 인바운드", (0, 255, 140))

# [Stage 10]: Air Valve (FPV) - Authentic 3D Pneumatic Dome LED Valve
s10_x = 2060
canvas.paste(valve_clean, (s10_x - valve_clean.width//2, r2_y - valve_clean.height//2 - 20), valve_clean)
draw_metal_collar(s10_x - 55, r2_y)
draw_metal_collar(s10_x + 55, r2_y)
draw_part_label(s10_x, r2_y, "Air Valve(FPV)", "3D 최종공정 밸브", (0, 255, 140))

# [Stage 11]: LF (필터 2) - Authentic 3D Mesh Filter
s11_x = 2210
canvas.paste(filter_clean, (s11_x - filter_clean.width//2, r2_y - filter_clean.height//2 - 15), filter_clean)
draw_metal_collar(s11_x - 65, r2_y)
draw_metal_collar(s11_x + 65, r2_y)
draw_part_label(s11_x, r2_y, "LF (필터 2)", "3D 최종 라인필터", (100, 200, 255))

# [Stage 12]: PT (FPT)
s12_x = 2340
draw_metal_collar(s12_x, r2_y)
draw_glass_hud_card(s12_x, r2_y, 12, "PT (FPT)", "60.2", "PSI")
draw_part_label(s12_x, r2_y, "PT (FPT)", "최종 공정압센서", (0, 240, 255))

# [Stage 13]: PROCESS Manifold Terminal Header
draw.rounded_rectangle([(proc_x - 35, r2_y - 130), (proc_x + 50, r2_y + 130)], radius=14, fill=(25, 38, 58), outline=(0, 240, 255), width=3)
p_text = ["P", "R", "O", "C", "E", "S", "S"]
for idx, ch in enumerate(p_text):
    draw.text((proc_x - 10, r2_y - 110 + idx * 32), ch, fill=(0, 240, 255), font=font_sub)
draw.polygon([(proc_x + 65, r2_y), (proc_x + 95, r2_y - 20), (proc_x + 95, r2_y + 20)], fill=(0, 240, 255))
draw.text((proc_x - 20, r2_y + 145), "13. PROCESS", fill=(0, 240, 255), font=font_tag)

# Directional Arrows on Red Gas Pipe
flow_x_positions = [420, 600, 790, 975, 1040, 1130, 1310, 1475, 1645, 1815, 1980, 2135, 2275]
for fx in flow_x_positions:
    if fx == 1040:
        fy = (r1_y + r2_y) // 2 + 30
        draw.polygon([(fx, fy - 16), (fx - 10, fy + 8), (fx + 10, fy + 8)], fill=(255, 140, 140))
    else:
        fy = r1_y if fx < bend_x else r2_y
        draw.polygon([(fx + 16, fy), (fx - 8, fy - 10), (fx - 8, fy + 10)], fill=(255, 140, 140))

# ── Title Header ──
draw.rounded_rectangle([(70, 35), (W - 70, 115)], radius=12, fill=(18, 24, 38), outline=(45, 60, 85), width=2)
draw.text((100, 52), "반도체 특수가스 캐비닛 P&ID — 사장님 확정 3D 실물 파트 100% 반영 공정 순서도", fill=(0, 240, 255), font=font_main)
draw.rounded_rectangle([(1850, 48), (W - 90, 102)], radius=8, fill=(45, 15, 25), outline=(255, 40, 60), width=2)
draw.ellipse([(1870, 67), (1886, 83)], fill=(255, 30, 45))
draw.text((1900, 60), "가스 라인: RED GAS (특수가스 투명유리관)", fill=(255, 120, 120), font=font_sub)

# ── Bottom 100% Sequence Flow Matrix ──
matrix_y = H - 210
draw.rounded_rectangle([(cyl_x + cyl_w + 40, matrix_y), (W - 70, H - 50)], radius=14, fill=(16, 22, 34), outline=(45, 60, 85), width=2)
draw.text((cyl_x + cyl_w + 70, matrix_y + 20), "📋 13단계 지정 배관 공정 순서(P&ID Sequence) 100% 실물 3D 파트 매칭표", fill=(0, 240, 255), font=font_matrix_bd)

line1 = "1. 실린더 Ass'y (VS+AG+자켓히터+저울)  ➔  2. PT (HPT 고압)  ➔  3. LF (3D고압필터)  ➔  4. Air Valve (3D 돔LED HPI)"
line2 = "5. Regulator 1 (3D 듀얼감압기)  ➔  6. PT (MPT 중압)  ➔  7. Regulator 2 (3D 듀얼감압기)  ➔  8. PT (LPT 저압)"
line3 = "9. Air Valve (3D 돔LED LPI)  ➔  10. Air Valve (3D 돔LED FPV)  ➔  11. LF (3D최종필터)  ➔  12. PT (FPT 최종압력)  ➔  13. PROCESS (공정 이송)"

draw.text((cyl_x + cyl_w + 70, matrix_y + 58), line1, fill=(225, 235, 250), font=font_matrix)
draw.text((cyl_x + cyl_w + 70, matrix_y + 92), line2, fill=(225, 235, 250), font=font_matrix)
draw.text((cyl_x + cyl_w + 70, matrix_y + 126), line3, fill=(255, 180, 80), font=font_matrix_bd)

# Save
canvas.convert("RGB").save(out_path, "PNG", quality=95)
print("Successfully generated clean authentic 3D parts sequence P&ID:", out_path)
