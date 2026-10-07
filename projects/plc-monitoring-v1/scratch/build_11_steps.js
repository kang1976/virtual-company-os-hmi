const fs = require('fs');
const ExcelJS = require('exceljs');
const path = require('path');

// We need to require gmsManager.js functions.
// Let's modify gmsManager.js slightly if needed, or just require it.
const gmsManager = require('../src/gmsManager.js');

const steps = [
  'IdleCheck_v1',
  'Puls_v1',
  'OneP_v1',
  'OneP2_v1',
  'OneP3_v1',
  'OneP4_v1',
  'ExchL_v1',
  'TwoP_v1',
  'VtTest_v1',
  'CylReplace_v1',
  'AfterThreeP_v1'
];

async function main() {
  const wb = new ExcelJS.Workbook();
  
  for (const id of steps) {
    const data = gmsManager.loadGmsSubSequence(id);
    if (!data) {
      console.log('Skipping ' + id);
      continue;
    }
    
    // Use the logic from buildSubSequenceWorkbook to add a sheet
    const valveTags = Array.isArray(data.valveTags) ? data.valveTags : [];
    const columns = [
      ...gmsManager.SUB_SEQ_FIXED_COLUMNS,
      ...valveTags.map((tag) => ({ key: tag, header: tag })),
      ...gmsManager.SUB_SEQ_TRAILING_COLUMNS,
    ];
    const totalCols = columns.length;
    const valveStartCol = gmsManager.SUB_SEQ_FIXED_COLUMNS.length + 1;
    const valveEndCol = valveStartCol + valveTags.length - 1;

    // Remove invalid characters from sheet name
    const safeSheetName = id.replace(/[\\/?*[\]]/g, '').substring(0, 31);
    const ws = wb.addWorksheet(safeSheetName);
    
    ws.columns = columns.map((c) => ({ key: c.key, width: c.key === 'operation' || c.key === 'message' || c.key === 'remarks' ? 26 : 14 }));

    ws.mergeCells(1, 1, 1, totalCols);
    ws.getCell(1, 1).value = `${data.label || id} (${data.mainStepType || ''}) - GMS 서브시퀀스`;
    ws.getCell(1, 1).font = { bold: true };

    ws.mergeCells(2, 2, 2, 4);
    ws.getCell(2, 2).value = 'STEP';
    ws.mergeCells(2, 6, 2, 12);
    ws.getCell(2, 6).value = 'TIMING / CONDITION';
    if (valveTags.length) {
      ws.mergeCells(2, valveStartCol, 2, valveEndCol);
      ws.getCell(2, valveStartCol).value = 'VALVE (O=Open, C=Close, 공백=이전 상태 유지, O+n/C+n=n초 뒤 순차 적용)';
    }
    ws.mergeCells(2, valveEndCol + 1, 2, totalCols);
    ws.getCell(2, valveEndCol + 1).value = 'ALARM / REMARKS';
    ws.getRow(2).font = { bold: true };
    ws.getRow(2).alignment = { horizontal: 'center' };

    const timeSecCol = gmsManager.SUB_SEQ_FIXED_COLUMNS.findIndex((c) => c.key === 'timeSec') + 1;
    const accTimeSecCol = gmsManager.SUB_SEQ_FIXED_COLUMNS.findIndex((c) => c.key === 'accTimeSec') + 1;
    ws.getCell(3, timeSecCol).value = 'Sec';
    ws.getCell(3, accTimeSecCol).value = 'Sec';

    columns.forEach((c, i) => {
      ws.getCell(4, i + 1).value = c.header;
    });
    ws.getRow(4).font = { bold: true };

    const excelColLetter = (colIdx) => {
      let temp = '';
      let num = colIdx;
      while (num > 0) {
        const mod = (num - 1) % 26;
        temp = String.fromCharCode(65 + mod) + temp;
        num = Math.floor((num - mod) / 26);
      }
      return temp;
    };
    
    const timeSecColLetter = excelColLetter(timeSecCol);
    let cumulativeSec = 0;
    
    (data.steps || []).forEach((step, i) => {
      const rowValues = {};
      rowValues.no = step.no != null ? step.no : '';
      rowValues.mainStep = step.mainStep != null ? step.mainStep : '';
      rowValues.subStep = step.subStep != null ? step.subStep : '';
      rowValues.nextStep = step.nextStep || '';
      rowValues.operation = step.operation || '';
      rowValues.cycle = step.cycle || '';
      rowValues.advance = step.advance === 'ack' ? '확인' : '자동';
      rowValues.ackGoto = step.ackGoto || '';
      rowValues.alarmGoto = step.alarmGoto || '';
      rowValues.message = step.message || '';
      rowValues.timeSec = step.timeSec != null ? step.timeSec : '';
      valveTags.forEach((tag) => {
        rowValues[tag] = step.valves && step.valves[tag] ? step.valves[tag] : '';
      });
      rowValues.alarmMonitoring = step.alarmMonitoring || '';
      rowValues.conditionOp = step.conditionOp || '';
      rowValues.conditionValue = step.conditionValue || '';
      rowValues.earlyPass = step.earlyPass || '';
      rowValues.alarmSeq = step.alarmSeq || '';
      rowValues.alarmMessage = step.alarmMessage || '';
      rowValues.remarks = step.remarks || '';

      const r = ws.addRow(rowValues);
      
      const rowNum = r.number;
      if (rowValues.timeSec) {
        const sec = Number(rowValues.timeSec) || 0;
        cumulativeSec += sec;
        r.getCell(accTimeSecCol).value = { formula: `SUM($${timeSecColLetter}$5:${timeSecColLetter}${rowNum})`, result: cumulativeSec };
      }
    });
  }

  const outPath = path.join(__dirname, '../docs/GMS_Cylinder_Exchange_1_to_11.xlsx');
  await wb.xlsx.writeFile(outPath);
  console.log('Saved to ' + outPath);
}
main().catch(console.error);
