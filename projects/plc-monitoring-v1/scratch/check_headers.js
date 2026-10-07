const fs = require('fs');
const path = require('path');
const publicDir = 'D:/AI_Work/Antigravity/plc-monitoring/pc-app/public';
['index.html', 'monitoring.html', 'grid/index.html', 'gms.html', 'gms-select.html', 'settings.html'].forEach(f => {
  const p = path.join(publicDir, f);
  const content = fs.readFileSync(p, 'utf8');
  const m = content.match(/<header[\s\S]*?<\/header>/);
  console.log('=== ' + f + ' ===\n' + (m ? m[0] : 'NO HEADER') + '\n');
});
