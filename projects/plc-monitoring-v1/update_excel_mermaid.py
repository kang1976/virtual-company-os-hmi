import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import openpyxl

init_header = "%%{init: {'flowchart': {'htmlLabels': true}, 'themeCSS': '.node foreignObject { overflow: visible !important; } .node foreignObject div { width: 360px !important; text-align: center; line-height: 1.5; white-space: normal; }'} }%%"

target_file = 'GMS_자동진행_시퀀스_표준템플릿_v4.xlsx'
wb = openpyxl.load_workbook(target_file)
count = 0
for ws in wb.worksheets:
    for r in range(1, ws.max_row+1):
        for c in range(1, ws.max_column+1):
            val = ws.cell(row=r, column=c).value
            if val and isinstance(val, str) and 'flowchart TD' in val:
                lines = [l.rstrip() for l in val.splitlines() if not l.strip().startswith('```')]
                lines = [l for l in lines if not l.strip().startswith('%%{init:')]
                new_lines = []
                for l in lines:
                    if l.strip().startswith('classDef '):
                        l = l.replace(',width:320px', '').replace(',width:280px', '').replace(',width:340px', '')
                    new_lines.append(l)
                
                final_code = init_header + '\n' + '\n'.join(new_lines).strip()
                ws.cell(row=r, column=c).value = final_code
                count += 1
                print(f'{ws.title} R{r}C{c} updated successfully')

wb.save(target_file)
print(f'Successfully updated {count} sheets in {target_file}!')
