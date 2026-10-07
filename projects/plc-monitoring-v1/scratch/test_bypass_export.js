const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const { buildSubSequenceWorkbook } = require('../src/gmsManager');

async function testExportBypass() {
  const jsonPath = path.join(__dirname, '../data/gmsSubSequences/Bypass_v1.json');
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const wb = buildSubSequenceWorkbook('Bypass_v1', data);

  const outTestPath = path.join(__dirname, '../docs/test_Bypass_v1_export.xlsx');
  await wb.xlsx.writeFile(outTestPath);
  console.log('Test Bypass export succeeded:', outTestPath);

  // Read back and inspect rows
  const readWb = new ExcelJS.Workbook();
  await readWb.xlsx.readFile(outTestPath);
  const ws = readWb.worksheets[0];
  console.log('Worksheet Name:', ws.name);
  console.log('Total Rows:', ws.rowCount);
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const values = [];
    row.eachCell({ includeEmpty: true }, (c, col) => {
      values.push(c.value);
    });
    if (r <= 5 || r >= 17) {
      console.log(`Row ${r}:`, values.slice(0, 15).map(v => v === null ? '' : v).join(' | '));
    }
  }
}

testExportBypass().catch(console.error);
