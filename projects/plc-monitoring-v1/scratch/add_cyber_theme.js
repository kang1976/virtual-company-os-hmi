const fs = require('fs');
const path = require('path');

const publicDir = 'D:/AI_Work/Antigravity/plc-monitoring/pc-app/public';

// 1. Update settings.js THEME_PRESETS
const settingsJsPath = path.join(publicDir, 'settings.js');
let settingsJs = fs.readFileSync(settingsJsPath, 'utf8');
if (!settingsJs.includes("'cyber'")) {
  settingsJs = settingsJs.replace(
    "const THEME_PRESETS = ['light', 'dark', 'orange', 'blue', 'green', 'gray'];",
    "const THEME_PRESETS = ['light', 'dark', 'cyber', 'orange', 'blue', 'green', 'gray'];"
  );
  fs.writeFileSync(settingsJsPath, settingsJs, 'utf8');
  console.log('settings.js updated with cyber theme');
}

// 2. Update theme-3d.css with :root[data-theme="cyber"] and overflow guards
const theme3dPath = path.join(publicDir, 'theme-3d.css');
let theme3d = fs.readFileSync(theme3dPath, 'utf8');

const cyberThemeCss = `
/* 🌌 사이버네틱 다크 (Velocity Grid / Cyber Dark) 테마 */
:root[data-theme='cyber'] {
  --bg: #0b0f19;
  --panel: #131b2e;
  --panel-border: rgba(56, 189, 248, 0.22);
  --panel-border-strong: #0284c7;
  --text: #f1f5f9;
  --muted: #8493a8;
  --accent: #00f0ff;
  --accent-dim: rgba(0, 240, 255, 0.16);
  --primary-text: #00f0ff;
  --warn: #fbbf24;
  --warn-bg: rgba(251, 191, 36, 0.16);
  --warn-text: #fbbf24;
  --error: #f43f5e;
  --danger-bg: rgba(244, 63, 94, 0.16);
  --danger-text: #f43f5e;
  --input-bg: #0f172a;
  --bg-alt: #182235;
  --flash-bg: rgba(0, 240, 255, 0.2);
  --send-tag: #a855f7;
  --hex-text: #38bdf8;

  --3d-bevel-light: rgba(0, 240, 255, 0.2);
  --3d-bevel-shadow: rgba(0, 0, 0, 0.6);
  --3d-card-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 1px 1px rgba(56, 189, 248, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  --3d-input-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.5), 0 1px 0 rgba(0, 240, 255, 0.1);
  --3d-slot-bg: rgba(11, 15, 25, 0.85);
  --3d-slot-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.5), 0 1px 0 rgba(0, 240, 255, 0.1);
}
`;

if (!theme3d.includes("[data-theme='cyber']")) {
  theme3d = cyberThemeCss + '\n' + theme3d;
  fs.writeFileSync(theme3dPath, theme3d, 'utf8');
  console.log('theme-3d.css updated with cyber theme definition');
}

// 3. Add cyber option to all HTML files with themeSelect and settings swatch
const htmlFiles = [
  'index.html',
  'monitoring.html',
  'grid/index.html',
  'gms.html',
  'gms-select.html',
  'settings.html'
];

htmlFiles.forEach((file) => {
  const filePath = path.join(publicDir, file);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Add cyber option to select#themeSelect
  if (content.includes('id="themeSelect"') && !content.includes('value="cyber"')) {
    content = content.replace(
      '<option value="dark">🌙 다크</option>',
      '<option value="dark">🌙 다크</option><option value="cyber">🌌 사이버 다크</option>'
    );
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Added cyber option to themeSelect in:', file);
  }
});

// 4. Update settings.html theme swatches
const settingsHtmlPath = path.join(publicDir, 'settings.html');
let settingsHtml = fs.readFileSync(settingsHtmlPath, 'utf8');

if (!settingsHtml.includes('data-theme="cyber"')) {
  const cyberSwatch = `      <button type="button" class="theme-swatch" data-theme="cyber" data-color="#00f0ff"><span class="sw-circle" style="background:#0b0f19;border-color:#00f0ff;"></span><span class="sw-label">사이버 다크</span></button>\n`;
  settingsHtml = settingsHtml.replace(
    /(<button type="button" class="theme-swatch" data-theme="dark"[^>]*>[\s\S]*?<\/button>\s*)/,
    `$1${cyberSwatch}`
  );
  
  const cyberSwatchCss = `  .theme-swatch[data-theme="cyber"] .sw-circle { --sw-color: #00f0ff; background: #0b0f19; border-color: #00f0ff; box-shadow: 0 0 8px rgba(0,240,255,0.4); }\n`;
  if (!settingsHtml.includes('.theme-swatch[data-theme="cyber"]')) {
    settingsHtml = settingsHtml.replace(
      '.theme-swatch[data-theme="dark"] .sw-circle { --sw-color: #3ddc84; }',
      `.theme-swatch[data-theme="dark"] .sw-circle { --sw-color: #3ddc84; }\n${cyberSwatchCss}`
    );
  }
  fs.writeFileSync(settingsHtmlPath, settingsHtml, 'utf8');
  console.log('settings.html updated with cyber swatch button');
}
