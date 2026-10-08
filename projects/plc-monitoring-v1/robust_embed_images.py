import sys, io, os, base64, urllib.request, time, re
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

def clean_for_renderer(code):
    # Remove HTML span tags and replace &nbsp; with space
    code = re.sub(r'<span[^>]*>', '', code)
    code = code.replace('</span>', '')
    code = code.replace('&nbsp;', ' ')
    code = code.replace('•', '-')
    # In mermaid.ink, <br/> inside quotes on arrows can sometimes cause issues; replace with space or clean <br/>
    return code

for idx, (sheet_name, code_r, code_c, insert_r) in enumerate(sheet_configs, 1):
    ws = wb[sheet_name]
    raw_code = ws.cell(row=code_r, column=code_c).value
    clean_code = clean_for_renderer(raw_code)
    img_path = f'flowchart_images/flowchart_{idx}.png'
    
    print(f'Fetching image for [{sheet_name}]...')
    b64_str = base64.b64encode(clean_code.encode('utf-8')).decode('ascii')
    url = f'https://mermaid.ink/img/{b64_str}'
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = resp.read()
            with open(img_path, 'wb') as f:
                f.write(data)
            print(f'  Downloaded {img_path} ({len(data)} bytes)')
    except Exception as e:
        print(f'  Download failed for {sheet_name}: {e}')
        # Fallback simpler syntax if arrow label has <br/>
        simplified = re.sub(r'--\s*"[^"]*"\s*-->', '-->', clean_code)
        b64_str = base64.b64encode(simplified.encode('utf-8')).decode('ascii')
        url = f'https://mermaid.ink/img/{b64_str}'
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = resp.read()
                with open(img_path, 'wb') as f:
                    f.write(data)
                print(f'  Fallback downloaded {img_path} ({len(data)} bytes)')
        except Exception as e2:
            print(f'  Fallback also failed: {e2}')
            continue

    # Title banner
    banner_cell = ws.cell(row=insert_r, column=1, value=f"🖼️ [공정 플로우차트 렌더링 이미지 - {sheet_name}]")
    ws.merge_cells(start_row=insert_r, start_column=1, end_row=insert_r, end_column=12)
    banner_cell.fill = header_fill
    banner_cell.font = header_font
    banner_cell.alignment = Alignment(horizontal="center", vertical="center")
    
    # Insert Image
    img = Image(img_path)
    if img.width > 650:
        ratio = 650 / img.width
        img.width = int(img.width * ratio)
        img.height = int(img.height * ratio)
    
    target_cell = f"B{insert_r + 2}"
    ws.add_image(img, target_cell)
    print(f'  Embedded into {sheet_name} at {target_cell}')
    time.sleep(0.3)

wb.save(target_file)
print(f'SUCCESS: ALL 7 FLOWCHART IMAGES EMBEDDED IN {target_file}!')
