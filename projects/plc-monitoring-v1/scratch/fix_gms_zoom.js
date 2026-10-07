const fs = require('fs');

// 1. Update gms.html apply(z)
const gmsHtmlPath = 'D:/AI_Work/Antigravity/plc-monitoring/pc-app/public/gms.html';
let gmsHtml = fs.readFileSync(gmsHtmlPath, 'utf8');

const oldApply = `    function apply(z) {
      if (!document.body) return;
      document.body.style.zoom = '';
      document.body.style.height = '';
      document.documentElement.style.setProperty('--ui-zoom', String(z));
      window.dispatchEvent(new CustomEvent('setGridZoom', { detail: { zoom: z } }));
      syncControl(z);
    }`;

const newApply = `    function apply(z) {
      if (!document.body) return;
      document.documentElement.style.setProperty('--ui-zoom', String(z));
      if (Math.abs(z - 1) < 0.001) {
        document.body.style.zoom = '';
        document.body.style.height = '';
      } else {
        document.body.style.zoom = String(z);
        document.body.style.height = (100 / z) + 'vh';
      }
      window.dispatchEvent(new CustomEvent('setGridZoom', { detail: { zoom: z } }));
      syncControl(z);
    }`;

if (gmsHtml.includes(oldApply)) {
  gmsHtml = gmsHtml.replace(oldApply, newApply);
  fs.writeFileSync(gmsHtmlPath, gmsHtml, 'utf8');
  console.log('gms.html apply(z) updated');
} else {
  console.log('oldApply in gms.html not matched, checking regex');
  gmsHtml = gmsHtml.replace(/function apply\(z\)\s*\{[\s\S]*?syncControl\(z\);\s*\}/, newApply.trim());
  fs.writeFileSync(gmsHtmlPath, gmsHtml, 'utf8');
  console.log('gms.html apply(z) updated via regex');
}

// 2. Add Univer isolation rule to theme-3d.css
const theme3dPath = 'D:/AI_Work/Antigravity/plc-monitoring/pc-app/public/theme-3d.css';
let theme3d = fs.readFileSync(theme3dPath, 'utf8');

const isolationRule = `
/* GMS & Common Univer Grid Containers Standard Coordinate Isolation */
#gmsTrendGridContainer,
#gmsUserGridContainer,
#gmsWorkLogGridContainer,
#gmsWorklogGridContainer,
#gmsErrorLogGridContainer,
#gmsErrorlogGridContainer,
#gmsConfigModeGridContainer,
#gmsConfigmodeGridContainer,
#trendGridContainer,
#univer-container {
  zoom: calc(1 / var(--ui-zoom, 1));
}
`;

if (!theme3d.includes('#gmsTrendGridContainer')) {
  theme3d += isolationRule;
  fs.writeFileSync(theme3dPath, theme3d, 'utf8');
  console.log('theme-3d.css updated with GMS Univer grid isolation rule');
}
