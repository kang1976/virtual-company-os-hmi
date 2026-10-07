import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

out_path = r'C:\Users\rokaf\.gemini\antigravity\brain\9bf099c1-610b-408f-b5e2-f7535255d281\exact_sequence_red_gas_pid.png'
cyl_path = r'C:\Users\rokaf\.gemini\antigravity\brain\9bf099c1-610b-408f-b5e2-f7535255d281\cylinder_unit_v3_balanced.png'
master_path = r'C:\Users\rokaf\.gemini\antigravity\brain\9bf099c1-610b-408f-b5e2-f7535255d281\pid_master_with_vs_ag_1790086813308.jpg'

# 1. Base Canvas Dimensions: 2400 x 1350 (Ultra High-Res 16:9)
W, H = 2400, 1350
bg_color = (13, 17, 26) # Dark slate industrial SCADA background

canvas = Image.new("RGBA", (W, H), bg_color)
draw = ImageDraw.Draw(canvas)

# Load cylinder unit
cyl_img = Image.open(cyl_path).convert("RGBA")
# Load master parts source
master_img = Image.open(master_path).convert("RGBA")

# Extract parts from master_img:
# - Valve (Dome LED): roughly x: 235-285, y: 110-210 (Green) or x: 235-285, y: 250-350 (Red)
# Let's crop valve, regulator, filter, line heater from master_img
valve_green = master_img.crop((235, 110, 285, 210)).resize((70, 130), Image.Resampling.LANCZOS)
valve_red = master_img.crop((235, 250, 285, 350)).resize((70, 130), Image.Resampling.LANCZOS)

regulator_crop = master_img.crop((170, 245, 215, 350)).resize((110, 135), Image.Resampling.LANCZOS)
filter_crop = master_img.crop((95, 300, 155, 365)).resize((110, 65), Image.Resampling.LANCZOS)
heater_crop = master_img.crop((340, 290, 440, 350)).resize((150, 75), Image.Resampling.LANCZOS)

# Resize cylinder to fit bottom-left nicely
cyl_w = 340
cyl_h = int(cyl_img.height * (cyl_w / cyl_img.width))
cyl_resized = cyl_img.resize((cyl_w, cyl_h), Image.Resampling.LANCZOS)

# Position Cylinder on the bottom-left
cyl_x = 100
cyl_y = H - cyl_h - 100 # bottom aligned
canvas.paste(cyl_resized, (cyl_x, cyl_y), cyl_resized)

# The AG port is on the right of the cylinder neck:
# In the resized cylinder, neck AG center is around:
ag_port_x = cyl_x + int(cyl_w * 0.72)
ag_port_y = cyl_y + int(cyl_h * 0.175)

# Font loading (fallback to default if arial/consolas not found)
try:
    font_title = ImageFont.truetype("arialbd.ttf", 36)
    font_header = ImageFont.truetype("arialbd.ttf", 26)
    font_badge = ImageFont.truetype("consola.ttf", 20)
    font_sub = ImageFont.truetype("arial.ttf", 18)
    font_hud_title = ImageFont.truetype("arialbd.ttf", 16)
    font_hud_val = ImageFont.truetype("consola.ttf", 20)
except Exception:
    font_title = font_header = font_badge = font_sub = font_hud_title = font_hud_val = ImageFont.load_default()

# ── Title Banner ──
# Sub-header banner
draw.rectangle([(60, 40), (W - 60, 110)], fill=(20, 26, 38), outline=(40, 52, 75), width=2)
draw.text((90, 55), "SEMICONDUCTOR GAS CABINET P&ID — EXACT SEQUENCE FLOW", fill=(0, 240, 255), font=font_title)
draw.text((1600, 62), "GAS TYPE: HAZARDOUS SPECIALTY (RED GAS)", fill=(255, 75, 75), font=font_header)

# ── Sequence Path Coordinates (Orthogonal Layout) ──
# Sequence requested:
# Cylinder Ass'y -> PT(HPT) -> LF(Filter1) -> Air Valve(HPI) -> Reg 1 -> PT(MPT) -> Reg 2 -> PT(LPT) -> Air Valve(LPI) -> Air Valve(FPV) -> LF(Filter2) -> PT(FPT) -> PROCESS

# We layout in 2 clean horizontal tiers or 1 U-flow / serpentine flow:
# Tier 1 (Lower-Mid, going left to right from Cylinder):
# Start at AG port: (ag_port_x, ag_port_y) -> goes right -> PT(HPT) -> LF1 -> HPI -> goes UP to Tier 2
# Tier 2 (Upper-Mid, going right to left or continuing to top PROCESS):
# Reg 1 -> PT(MPT) -> Reg 2 -> PT(LPT) -> LPI -> FPV -> LF2 -> PT(FPT) -> PROCESS Header!

# Let's do a crisp 2-row SCADA loop:
# Row 1 (Bottom line at y = ag_port_y):
# From AG port (x=345, y=550) -> x=480: PT(HPT) -> x=680: LF1 -> x=880: HPI -> x=1050 (bends UP to y=260)
# Row 2 (Top line at y=260, flowing from x=1050 to x=2200):
# x=1050 (Turn UP) -> x=1180: Reg 1 -> x=1350: PT(MPT) -> x=1520: Reg 2 -> x=1690: PT(LPT) -> x=1860: LPI -> x=2020: FPV -> x=2160: LF2 -> x=2280: PT(FPT) -> x=2350: PROCESS Header!

# Helper function to draw glowing 3D red glass pipe
def draw_glowing_red_pipe(p1, p2, width=18):
    x1, y1 = p1
    x2, y2 = p2
    # Outer glass tube
    draw.line([(x1, y1), (x2, y2)], fill=(45, 15, 20, 255), width=width+8)
    # Metallic glass rim reflections
    draw.line([(x1, y1), (x2, y2)], fill=(120, 40, 50, 255), width=width+2)
    # Intense red glowing fluid core
    draw.line([(x1, y1), (x2, y2)], fill=(255, 30, 45, 255), width=width-4)
    # Center white-hot laser reflection
    draw.line([(x1, y1), (x2, y2)], fill=(255, 160, 160, 255), width=3)

# Helper function for drawing HUD sensor cards
def draw_hud_card(x, y, tag, value, unit="PSI"):
    card_w, card_h = 130, 75
    # Semi-transparent glass box
    draw.rounded_rectangle([(x - card_w//2, y - card_h - 20), (x + card_w//2, y - 20)], radius=8, fill=(20, 28, 42, 230), outline=(0, 240, 255), width=2)
    # Pointer line to pipe
    draw.line([(x, y - 20), (x, y)], fill=(0, 240, 255), width=2)
    draw.ellipse([(x-3, y-3), (x+3, y+3)], fill=(0, 240, 255))
    # Tag and Value text
    draw.text((x - card_w//2 + 10, y - card_h - 15), tag, fill=(160, 200, 230), font=font_hud_title)
    draw.text((x - card_w//2 + 10, y - card_h + 12), f"{value} {unit}", fill=(0, 240, 255), font=font_hud_val)

# Helper for component label badges
def draw_component_badge(x, y, name, tag, is_open=True):
    # Under-pipe label box
    box_w, box_h = 130, 50
    draw.rounded_rectangle([(x - box_w//2, y + 25), (x + box_w//2, y + 25 + box_h)], radius=6, fill=(15, 20, 30), outline=(60, 80, 110), width=1)
    color = (50, 255, 120) if is_open else (255, 70, 70)
    draw.text((x - box_w//2 + 10, y + 30), tag, fill=color, font=font_hud_title)
    draw.text((x - box_w//2 + 10, y + 50), name, fill=(200, 210, 225), font=font_sub)

# Pipe layout points
r1_y = ag_port_y
r2_y = 360
bend_x = 1000

# 1. Pipe: Cylinder AG -> Bend
draw_glowing_red_pipe((ag_port_x, r1_y), (bend_x, r1_y))
# 2. Pipe: Bend UP
draw_glowing_red_pipe((bend_x, r1_y), (bend_x, r2_y))
# 3. Pipe: Bend -> Process Terminal
draw_glowing_red_pipe((bend_x, r2_y), (2320, r2_y))

# ── Place Stage 1: PT (HPT) ──
hpt_x = 480
draw_hud_card(hpt_x, r1_y, "PT (HPT)", "2250.0", "PSI")
draw_component_badge(hpt_x, r1_y, "High Press.", "HPT")

# ── Place Stage 2: LF (Line Filter 1) ──
lf1_x = 650
canvas.paste(filter_crop, (lf1_x - filter_crop.width//2, r1_y - filter_crop.height//2), filter_crop)
draw_component_badge(lf1_x, r1_y, "Line Filter 1", "LF_A")

# ── Place Stage 3: Air Valve (HPI) ──
hpi_x = 830
canvas.paste(valve_green, (hpi_x - valve_green.width//2, r1_y - valve_green.height//2 - 15), valve_green)
draw_component_badge(hpi_x, r1_y, "High Press In", "HPI (OPEN)", True)

# Line heater on rising pipe
canvas.paste(heater_crop, (bend_x - heater_crop.width//2, (r1_y + r2_y)//2 - heater_crop.height//2), heater_crop)

# ── Place Stage 4: Regulator 1 (1st Stage) ──
reg1_x = 1130
canvas.paste(regulator_crop, (reg1_x - regulator_crop.width//2, r2_y - regulator_crop.height//2 - 15), regulator_crop)
draw_component_badge(reg1_x, r2_y, "1st Reducer", "Regulator 1")

# ── Place Stage 5: PT (MPT - Medium Pressure) ──
mpt_x = 1300
draw_hud_card(mpt_x, r2_y, "PT (MPT)", "350.0", "PSI")
draw_component_badge(mpt_x, r2_y, "Mid Press.", "MPT")

# ── Place Stage 6: Regulator 2 (2nd Stage) ──
reg2_x = 1460
canvas.paste(regulator_crop, (reg2_x - regulator_crop.width//2, r2_y - regulator_crop.height//2 - 15), regulator_crop)
draw_component_badge(reg2_x, r2_y, "2nd Reducer", "Regulator 2")

# ── Place Stage 7: PT (LPT - Low Pressure) ──
lpt_x = 1630
draw_hud_card(lpt_x, r2_y, "PT (LPT)", "65.0", "PSI")
draw_component_badge(lpt_x, r2_y, "Low Press.", "LPT")

# ── Place Stage 8: Air Valve (LPI) ──
lpi_x = 1790
canvas.paste(valve_green, (lpi_x - valve_green.width//2, r2_y - valve_green.height//2 - 15), valve_green)
draw_component_badge(lpi_x, r2_y, "Low Press In", "LPI (OPEN)", True)

# ── Place Stage 9: Air Valve (FPV - Final Process Valve) ──
fpv_x = 1940
canvas.paste(valve_green, (fpv_x - valve_green.width//2, r2_y - valve_green.height//2 - 15), valve_green)
draw_component_badge(fpv_x, r2_y, "Final Process", "FPV (OPEN)", True)

# ── Place Stage 10: LF (Line Filter 2) ──
lf2_x = 2080
canvas.paste(filter_crop, (lf2_x - filter_crop.width//2, r2_y - filter_crop.height//2), filter_crop)
draw_component_badge(lf2_x, r2_y, "Line Filter 2", "LF_PROC")

# ── Place Stage 11: PT (FPT - Final Process Transmitter) ──
fpt_x = 2210
draw_hud_card(fpt_x, r2_y, "PT (FPT)", "60.2", "PSI")
draw_component_badge(fpt_x, r2_y, "Final Delivery", "FPT")

# ── Place Stage 12: PROCESS Header Manifold ──
proc_x = 2320
draw.rounded_rectangle([(proc_x - 30, r2_y - 120), (proc_x + 50, r2_y + 120)], radius=12, fill=(30, 42, 60), outline=(0, 240, 255), width=3)
draw.text((proc_x - 15, r2_y - 80), "P\nR\nO\nC\nE\nS\nS", fill=(0, 240, 255), font=font_header)
draw.polygon([(proc_x + 60, r2_y), (proc_x + 85, r2_y - 15), (proc_x + 85, r2_y + 15)], fill=(0, 240, 255))

# Flow directional glowing arrows along the pipe
arrow_x_coords = [400, 560, 740, 930, 1000, 1220, 1380, 1550, 1710, 1870, 2010, 2140, 2270]
for ax in arrow_x_coords:
    if ax == 1000:
        # vertical arrow
        ay = (r1_y + r2_y) // 2 + 50
        draw.polygon([(ax, ay - 12), (ax - 8, ay + 6), (ax + 8, ay + 6)], fill=(255, 120, 120))
    else:
        ay = r1_y if ax < bend_x else r2_y
        draw.polygon([(ax + 12, ay), (ax - 6, ay - 8), (ax - 6, ay + 8)], fill=(255, 120, 120))

# ── Bottom Summary Information Box ──
info_y = H - 240
draw.rounded_rectangle([(cyl_x + cyl_w + 50, info_y), (W - 80, H - 80)], radius=12, fill=(18, 24, 36), outline=(45, 60, 85), width=2)
draw.text((cyl_x + cyl_w + 80, info_y + 25), "📌 100% SEQUENCE VERIFICATION MATRIX", fill=(0, 240, 255), font=font_header)

seq_text_1 = "1. 실린더 Ass'y (VS+AG+자켓히터+저울)  ➔  2. PT (HPT 고압센서)  ➔  3. LF (고압라인필터)  ➔  4. Air Valve (HPI 고압공압밸브)"
seq_text_2 = "5. Regulator 1 (1단 감압)  ➔  6. PT (MPT 중압센서)  ➔  7. Regulator 2 (2단 정밀감압)  ➔  8. PT (LPT 저압센서)"
seq_text_3 = "9. Air Valve (LPI 저압밸브)  ➔  10. Air Valve (FPV 최종밸브)  ➔  11. LF (최종라인필터)  ➔  12. PT (FPT 최종압력)  ➔  13. PROCESS (공정 이송)"

draw.text((cyl_x + cyl_w + 80, info_y + 65), seq_text_1, fill=(220, 230, 245), font=font_badge)
draw.text((cyl_x + cyl_w + 80, info_y + 100), seq_text_2, fill=(220, 230, 245), font=font_badge)
draw.text((cyl_x + cyl_w + 80, info_y + 135), seq_text_3, fill=(255, 180, 100), font=font_badge)

# Save image
canvas.convert("RGB").save(out_path, "PNG", quality=95)
print("Successfully generated exact sequence P&ID:", out_path)
