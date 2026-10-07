import os
from PIL import Image, ImageFilter, ImageEnhance
import numpy as np

src_path = r'C:\Users\rokaf\.gemini\antigravity\brain\9bf099c1-610b-408f-b5e2-f7535255d281\cylinder_unit_v2_1790087505486.jpg'
out_path = r'C:\Users\rokaf\.gemini\antigravity\brain\9bf099c1-610b-408f-b5e2-f7535255d281\cylinder_unit_v3_balanced.png'

im = Image.open(src_path).convert("RGBA")
w, h = im.size # 896 x 1200

# Background color sampling
bg_color = im.getpixel((50, 50)) # Dark navy background

# Extract components:
# 1. Top Neck & Handle Assembly (VS + AG + Shroud + Brass Valve)
# In original, neck assembly is roughly y: 40 to 395, x: 280 to 680
neck_crop = im.crop((280, 45, 680, 395))

# 2. Cylinder Shoulder with LEVEL 85%
shoulder_crop = im.crop((200, 395, 696, 545))

# 3. Jacket Heater with 65.0C & LED bar
jacket_crop = im.crop((200, 545, 696, 940))

# 4. Cylinder Lower Body
lower_body_crop = im.crop((200, 940, 696, 1030))

# 5. Base Scale
scale_crop = im.crop((180, 1030, 716, 1165))

# We want the cylinder body to be larger/taller, and the top handle/neck to be compact.
# Let's create a canvas of 896 x 1200
canvas = Image.new("RGBA", (w, h), bg_color)

# Scale neck assembly down by an additional 25% (0.72 * 0.75 = 0.54)
# This makes the top handle collar and guard sleek, realistic, and perfectly proportioned to the cylinder tank
nw = int(neck_crop.width * 0.54)
nh = int(neck_crop.height * 0.54)
neck_scaled = neck_crop.resize((nw, nh), Image.Resampling.LANCZOS)


# Cylinder body width remains full and sturdy (or slightly widened to 105% for a massive tank look)
bw = int(shoulder_crop.width * 1.02)
# Shoulder
sh_w = bw
sh_h = int(shoulder_crop.height * 1.05)
shoulder_scaled = shoulder_crop.resize((sh_w, sh_h), Image.Resampling.LANCZOS)

# Jacket heater
jk_w = bw
jk_h = int(jacket_crop.height * 1.05)
jacket_scaled = jacket_crop.resize((jk_w, jk_h), Image.Resampling.LANCZOS)

# Elongate lower body by repeating/interpolating seamless metallic texture
lb_w = bw
lb_h = 160
lower_body_scaled = lower_body_crop.resize((lb_w, lb_h), Image.Resampling.LANCZOS)

# Scale base
sc_w = int(scale_crop.width * 0.98)
sc_h = int(scale_crop.height * 0.98)
scale_scaled = scale_crop.resize((sc_w, sc_h), Image.Resampling.LANCZOS)

# Layout positions on canvas:
# Target cylinder base at bottom:
scale_y = 1040
scale_x = (w - sc_w) // 2

lower_body_y = scale_y - lb_h + 10
lower_body_x = (w - lb_w) // 2

jacket_y = lower_body_y - jk_h + 5
jacket_x = (w - jk_w) // 2

shoulder_y = jacket_y - sh_h + 5
shoulder_x = (w - sh_w) // 2

neck_y = shoulder_y - nh + 12
neck_x = (w - nw) // 2 + 18 # align neck center with cylinder center

# Paste with smooth alpha blending / feathering
canvas.paste(lower_body_scaled, (lower_body_x, lower_body_y))
canvas.paste(jacket_scaled, (jacket_x, jacket_y))
canvas.paste(shoulder_scaled, (shoulder_x, shoulder_y))
canvas.paste(neck_scaled, (neck_x, neck_y), neck_scaled)
canvas.paste(scale_scaled, (scale_x, scale_y), scale_scaled)

# Convert to RGB and save
canvas.convert("RGB").save(out_path, "PNG", quality=95)
print("Successfully generated balanced cylinder:", out_path)
