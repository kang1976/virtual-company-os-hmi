const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../data/gmsSubSequenceConfig.json');
const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const subSeqDir = path.join(__dirname, '../data/gmsSubSequences');
const subSeqFiles = fs.readdirSync(subSeqDir).filter(f => f.endsWith('.json'));

const usageMap = {};

configData.rows.forEach(row => {
  usageMap[row.name] = [];
  usageMap[row.id] = [];
});

subSeqFiles.forEach(file => {
  const content = JSON.parse(fs.readFileSync(path.join(subSeqDir, file), 'utf8'));
  const steps = content.steps || [];
  
  steps.forEach(s => {
    if (!s.conditionValue) return;
    const condTags = String(s.alarmMonitoring || '').split('&').map(x => x.trim());
    const condOps = String(s.conditionOp || '').split('&').map(x => x.trim());
    const condVals = String(s.conditionValue || '').split('&').map(x => x.trim());
    
    condVals.forEach((val, idx) => {
      const tag = condTags[idx] || condTags[0] || '';
      const op = condOps[idx] || condOps[0] || '';
      
      const entry = {
        file,
        label: content.label || file,
        mainStep: s.mainStep,
        subStep: s.subStep,
        no: s.no,
        operation: s.operation,
        tag,
        op,
        rawVal: val,
        alarmSeq: s.alarmSeq,
        alarmGoto: s.alarmGoto,
        nextStep: s.nextStep,
        alarmMessage: s.alarmMessage,
        earlyPass: s.earlyPass
      };
      
      configData.rows.forEach(row => {
        // A/B 및 {side} 매칭
        const matched = (
          val === row.name ||
          val === row.id ||
          val === row.name.replace(`_${row.side}`, '_{side}') ||
          val === row.id.replace(`_${row.side}`, '_{side}')
        );
        if (matched) {
          usageMap[row.name].push(entry);
        }
      });
    });
  });
});

configData.rows.forEach((row, idx) => {
  const uses = usageMap[row.name] || [];
  console.log(`\n[${idx + 1}] ${row.name} (${row.id}) [${row.side}] - 사용처: ${uses.length}개`);
  uses.forEach(u => {
    console.log(`  - [${u.file}] Step ${u.no} (Main ${u.mainStep}-Sub ${u.subStep}) [${u.operation}]: ${u.tag} ${u.op} ${row.name} | AlarmSeq:${u.alarmSeq || '-'}, AlarmGoto:${u.alarmGoto || '-'}, NextStep:${u.nextStep || '-'}`);
  });
});
