const fs = require('fs');
const path = require('path');

const publicDir = 'D:/AI_Work/Antigravity/plc-monitoring/pc-app/public';
const files = [
  'gms.css',
  'gms-select.html',
  'index.html',
  'monitoring.html',
  'settings.html',
  'grid/index.html'
];

files.forEach((file) => {
  const filePath = path.join(publicDir, file);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace legacy .page-tabs styles
  const regex = /\.page-tabs\s*\{[^}]*\}[\s\S]*?\.page-tabs\s+\.page-tab\.active\s*\{[^}]*\}/g;
  if (regex.test(content)) {
    content = content.replace(regex, `/* .page-tabs unified in theme-3d.css */`);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Cleaned legacy page-tabs in:', file);
  }
});
