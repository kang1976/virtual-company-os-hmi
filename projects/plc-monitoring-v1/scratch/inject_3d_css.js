const fs = require('fs');
const path = require('path');

const publicDir = 'D:/AI_Work/Antigravity/plc-monitoring/pc-app/public';
const files = [
  'index.html',
  'monitoring.html',
  'grid/index.html',
  'gms.html',
  'gms-select.html',
  'settings.html'
];

files.forEach((rel) => {
  const fullPath = path.join(publicDir, rel);
  if (!fs.existsSync(fullPath)) {
    console.log('File not found:', fullPath);
    return;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  if (content.includes('theme-3d.css')) {
    console.log('Already has theme-3d.css:', rel);
    return;
  }
  const linkTag = '  <link rel="stylesheet" href="/theme-3d.css" />\n</head>';
  if (content.includes('</head>')) {
    content = content.replace('</head>', linkTag);
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log('Injected theme-3d.css into:', rel);
  } else {
    console.log('No </head> found in:', rel);
  }
});
