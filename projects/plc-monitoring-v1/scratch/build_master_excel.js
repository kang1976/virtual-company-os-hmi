const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

async function buildMasterExcel() {
  const dataDir = path.join(__dirname, '../data/gmsSubSequences');
  const outPath = path.join(__dirname, '../docs/GMS_Cylinder_Exchange_Master_Total.xlsx');
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GMS System';
  workbook.created = new Date();

  for (const file of files) {
    const jsonPath = path.join(dataDir, file);
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const sheetName = (data.id || file.replace('.json', '')).substring(0, 31);
    const ws = workbook.addWorksheet(sheetName);

    // Row 1: Title
    ws.mergeCells('A1:J1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `${data.label || data.id} (Main: ${data.mainStepType})`;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 2: Group Header
    ws.mergeCells('A2:B2'); ws.getCell('A2').value = 'STEP';
    ws.mergeCells('C2:E2'); ws.getCell('C2').value = 'TIMING / CONDITION';
    ws.mergeCells('F2:H2'); ws.getCell('F2').value = 'VALVE';
    ws.mergeCells('I2:J2'); ws.getCell('I2').value = 'ALARM / REMARKS';
    ['A2', 'C2', 'F2', 'I2'].forEach(c => {
      ws.getCell(c).font = { bold: true };
      ws.getCell(c).alignment = { horizontal: 'center' };
      ws.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    });

    // Row 3: Unit hint
    ws.getCell('A3').value = '';
    ws.getCell('C3').value = 'Sec';
    ws.getCell('D3').value = 'Sec';

    // Row 4: Header
    const headers = [
      'S/No.', 'Main-Sub', 'Time(Sec)', 'Acc.Time(Sec)', 'Advance',
      'Valve Action', 'Target Valves', 'Operation/Message', 'Alarm Condition', 'Remarks'
    ];
    ws.getRow(4).values = headers;
    ws.getRow(4).font = { bold: true };
    ws.getRow(4).alignment = { horizontal: 'center' };

    // Data rows
    (data.steps || []).forEach((step, idx) => {
      const valvesStr = step.valves ? Object.entries(step.valves).map(([k, v]) => `${k}:${v}`).join(', ') : '';
      ws.addRow([
        step.no || (idx + 1),
        `${step.mainStep || ''}-${step.subStep || ''}`,
        step.timeSec || '',
        step.accTimeSec || '',
        step.advance || 'auto',
        valvesStr,
        step.operation || '',
        step.message || '',
        step.alarmMonitoring ? `${step.alarmMonitoring} ${step.conditionOp || ''} ${step.conditionValue || ''}` : '',
        step.remarks || ''
      ]);
    });

    ws.columns.forEach(col => { col.width = 15; });
    ws.getColumn(8).width = 30;
    ws.getColumn(10).width = 30;
  }

  await workbook.xlsx.writeFile(outPath);
  console.log('Master Excel rebuilt successfully at:', outPath);

  // 에디터에서 바로 열어볼 수 있는 UTF-8 BOM CSV 파일도 함께 생성
  const csvOutDir = path.join(__dirname, '../docs/csv_subsequences');
  if (!fs.existsSync(csvOutDir)) fs.mkdirSync(csvOutDir, { recursive: true });

  const totalCsvLines = ['\uFEFF=== GMS 전체 서브시퀀스 마스터 통합 CSV ===\n'];

  for (const file of files) {
    const jsonPath = path.join(dataDir, file);
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const subSeqId = data.id || file.replace('.json', '');

    const lines = [];
    lines.push(`\uFEFF# ${data.label || subSeqId} (Main: ${data.mainStepType})`);
    lines.push('S/No.,Main-Sub,Time(Sec),Acc.Time(Sec),Advance,Valves,Operation,Message,Alarm Condition,Remarks');

    (data.steps || []).forEach((step, idx) => {
      const valvesStr = step.valves ? Object.entries(step.valves).map(([k, v]) => `${k}:${v}`).join(' ') : '';
      const alarmStr = step.alarmMonitoring ? `${step.alarmMonitoring} ${step.conditionOp || ''} ${step.conditionValue || ''}` : '';
      const escape = (s) => `"${String(s || '').replace(/"/g, '""')}"`;

      lines.push([
        escape(step.no || (idx + 1)),
        escape(`${step.mainStep || ''}-${step.subStep || ''}`),
        escape(step.timeSec || ''),
        escape(step.accTimeSec || ''),
        escape(step.advance || 'auto'),
        escape(valvesStr),
        escape(step.operation || ''),
        escape(step.message || ''),
        escape(alarmStr),
        escape(step.remarks || '')
      ].join(','));
    });

    // 개별 CSV 저장
    const singleCsvPath = path.join(csvOutDir, `${subSeqId}.csv`);
    fs.writeFileSync(singleCsvPath, lines.join('\n'), 'utf8');

    // 통합 CSV에 추가
    totalCsvLines.push(`\n\n--- [ ${subSeqId} : ${data.label || ''} ] ---`);
    totalCsvLines.push(...lines.slice(1));
  }

  const totalCsvPath = path.join(__dirname, '../docs/GMS_Cylinder_Exchange_Master_Total.csv');
  fs.writeFileSync(totalCsvPath, totalCsvLines.join('\n'), 'utf8');
  console.log('Master CSV rebuilt successfully at:', totalCsvPath);
}

buildMasterExcel().catch(console.error);
