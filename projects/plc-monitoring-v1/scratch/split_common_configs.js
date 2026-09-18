const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../data/gmsSubSequenceConfig.json');
const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const newRows = [];

configData.rows.forEach(row => {
  if (row.side === 'common') {
    // A측 생성
    const rowA = {
      ...row,
      name: `${row.name}_A`,
      id: `${row.id}_A`,
      side: 'A',
      desc: row.desc ? row.desc.replace(/A\/B 공통|공통/g, 'A측') + ' (A측)' : ''
    };
    // B측 생성
    const rowB = {
      ...row,
      name: `${row.name}_B`,
      id: `${row.id}_B`,
      side: 'B',
      desc: row.desc ? row.desc.replace(/A\/B 공통|공통/g, 'B측') + ' (B측)' : ''
    };
    newRows.push(rowA, rowB);
  } else {
    newRows.push(row);
  }
});

fs.writeFileSync(configPath, JSON.stringify({ rows: newRows }, null, 2), 'utf8');
console.log(`Common 분리 완료! 총 설정값 수: ${newRows.length}개 (A: ${newRows.filter(r => r.side === 'A').length}개, B: ${newRows.filter(r => r.side === 'B').length}개)`);
