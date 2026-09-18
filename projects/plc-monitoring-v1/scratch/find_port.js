const fs = require('fs');
const content = fs.readFileSync('D:\\02. AI 작업\\PLC monitoring_01\\plc-monitoring ver1.0 - google\\src\\server.js', 'utf8');

const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('listen(') || lines[i].includes('PORT') || lines[i].includes('port')) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
