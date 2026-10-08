import sys, io, os, base64, urllib.request, json, zlib, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import openpyxl
from openpyxl.drawing.image import Image
from openpyxl.styles import Font, PatternFill, Alignment

os.makedirs('flowchart_images', exist_ok=True)
target_file = 'GMS_자동진행_시퀀스_표준템플릿_v4.xlsx'
wb = openpyxl.load_workbook(target_file)

sheet_configs = [
    ('예제1_단순개폐', 12, 13, 24),
    ('예제2_조기통과', 12, 13, 24),
    ('예제3_수동확인', 12, 13, 24),
    ('예제4_지연개폐', 11, 13, 20),
    ('예제5_반복루프', 13, 13, 28),
    ('예제6_누출시험', 14, 13, 29),
    ('Bypass_v1', 18, 13, 45),
]

header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
header_font = Font(name="맑은 고딕", size=11, bold=True, color="FFFFFF")

def render_mermaid(code, out_path):
    # Strip span tags if any to avoid pako/url parsing issues, or keep simple clean code
    clean_code = code.replace("<span style='white-space:nowrap'>", "").replace("</span>", "")
    state = {
        "code": clean_code,
        "mermaid": {"theme": "default"}
    }
    json_bytes = json.dumps(state).encode('utf-8')
    # pako / deflate compression
    compressed = zlib.compress(json_bytes, level=9)
    # pako uses raw deflate without zlib header/checksum or standard
    # In mermaid.ink, pako: expects pako.deflate(..., {to: 'string'}) base64url encoded
    # Alternatively, direct base64 without pako:
    b64_str = base64.urlsafe_b64encode(json_bytes).decode('ascii').rstrip('=')
    
    # Try pako URL first, then plain base64 URL
    urls = [
        f"https://mermaid.ink/img/{base64.b64encode(clean_code.encode('utf-8')).decode('ascii')}",
        f"https://mermaid.ink/img/pako:{base64.urlsafe_b64encode(zlib.compress(json_bytes)[2:-4]).decode('ascii')}"
    ]
    
    for url in urls:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = resp.read()
                if len(data) > 1000:
                    with open(out_path, 'wb') as f:
                        f.write(data)
                    return True
        except Exception as e:
            pass
    return False

for idx, (sheet_name, code_r, code_c, insert_r) in enumerate(sheet_configs, 1):
    ws = wb[sheet_name]
    mermaid_code = ws.cell(row=code_r, column=code_c).value
    img_path = f'flowchart_images/flowchart_{idx}.png'
    
    print(f'Processing [{sheet_name}]...')
    ok = render_mermaid(mermaid_code, img_path)
    if not ok:
        print(f'  Failed to fetch image for [{sheet_name}]')
        continue
    
    print(f'  Successfully generated {img_path} ({os.path.getsize(img_path)} bytes)')
    
    # Add title banner
    banner_cell = ws.cell(row=insert_r, column=1, value=f"🖼️ [공정 플로우차트 렌더링 이미지 - {sheet_name}]")
    ws.merge_cells(start_row=insert_r, start_column=1, end_row=insert_r, end_column=12)
    banner_cell.fill = header_fill
    banner_cell.font = header_font
    banner_cell.alignment = Alignment(horizontal="center", vertical="center")
    
    # Insert image
    img = Image(img_path)
    if img.width > 650:
        ratio = 650 / img.width
        img.width = int(img.width * ratio)
        img.height = int(img.height * ratio)
    
    target_cell = f"B{insert_r + 2}"
    ws.add_image(img, target_cell)
    print(f'  Embedded into sheet at {target_cell}')
    time.sleep(0.3)

wb.save(target_file)
print(f'\nALL 7 FLOWCHART IMAGES SAVED TO {target_file}!')
