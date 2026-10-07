const fs = require('fs');
const p = 'D:/AI_Work/Antigravity/plc-monitoring/pc-app/public/settings.js';
let content = fs.readFileSync(p, 'utf8');

// 1. In populate(s)
content = content.replace(
  `  $('zoomPct').value = Math.round((Number(s.zoom) || 1) * 100);`,
  `  const storedZoom = parseFloat(localStorage.getItem('plcUiZoom'));
  const currentZoom = !isNaN(storedZoom) ? storedZoom : (Number(s.zoom) || 1);
  $('zoomPct').value = Math.round(currentZoom * 100);`
);

// 2. In persistClientSide(s)
content = content.replace(
  `function persistClientSide(s) {
  // 테마/폰트/배율을 localStorage에 반영해 다른 페이지에서도 즉시 적용되게 한다.
  window.__theme.applyTheme(s.theme);
  window.__applyDisplay(s.display);
  if (window.__setUiZoom) window.__setUiZoom(Number(s.zoom) || 1);
}`,
  `function persistClientSide(s) {
  // 테마/폰트/배율을 localStorage에 반영해 다른 페이지에서도 즉시 적용되게 한다.
  window.__theme.applyTheme(s.theme);
  window.__applyDisplay(s.display);
  const z = Number(s.zoom) || 1;
  localStorage.setItem('plcUiZoom', String(z));
  if (window.__setUiZoom) window.__setUiZoom(z);
}`
);

// 3. In init()
content = content.replace(
  `  $('tableFontSize').addEventListener('change', () => window.__applyDisplay({ tableFontSize: Number($('tableFontSize').value) }));`,
  `  $('tableFontSize').addEventListener('change', () => window.__applyDisplay({ tableFontSize: Number($('tableFontSize').value) }));
  $('zoomPct').addEventListener('change', () => {
    const z = (Number($('zoomPct').value) || 100) / 100;
    if (window.__setUiZoom) window.__setUiZoom(z);
  });
  window.addEventListener('storage', (e) => {
    if (e.key === 'plcUiZoom' && $('zoomPct')) {
      $('zoomPct').value = Math.round((parseFloat(e.newValue) || 1) * 100);
    }
  });`
);

fs.writeFileSync(p, content, 'utf8');
console.log('settings.js updated successfully');
