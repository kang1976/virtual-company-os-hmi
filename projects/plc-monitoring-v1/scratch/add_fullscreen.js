const fs = require('fs');
const path = require('path');

const publicDir = 'D:/AI_Work/Antigravity/plc-monitoring/pc-app/public';
const btnHtml = '    <button type="button" id="fullscreenToggleBtn" class="fullscreen-btn" title="전체 화면 전환 (F11)">⛶ 전체 화면</button>\n';

// 1. Update HTML files
const htmlFiles = [
  'index.html',
  'monitoring.html',
  'grid/index.html',
  'gms-select.html',
  'settings.html'
];

htmlFiles.forEach((file) => {
  const filePath = path.join(publicDir, file);
  if (!fs.existsSync(filePath)) {
    console.log('File not found:', filePath);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('id="fullscreenToggleBtn"')) {
    console.log('Already has fullscreenToggleBtn:', file);
    return;
  }

  // Insert right after the closing </div> of .ui-zoom
  const zoomEndRegex = /(<\/div>\s*)(<select id="themeSelect"|<div class="page-tabs">)/;
  if (zoomEndRegex.test(content)) {
    content = content.replace(zoomEndRegex, `$1${btnHtml}    $2`);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Added fullscreenToggleBtn to:', file);
  } else {
    console.log('Regex match failed for:', file);
  }
});

// 2. Update appSettings.js to bind fullscreen button automatically
const appSettingsPath = path.join(publicDir, 'appSettings.js');
let appSettings = fs.readFileSync(appSettingsPath, 'utf8');

const fullscreenScript = `
  // ── 공통 전체 화면 / 창 모드 버튼 바인딩 ──
  function initFullscreenToggle() {
    var btn = document.getElementById('fullscreenToggleBtn');
    if (!btn || btn.__bound) return;
    btn.__bound = true;
    function updateBtn() {
      var isFull = !!document.fullscreenElement;
      btn.textContent = isFull ? '🗗 창 모드' : '⛶ 전체 화면';
      btn.title = isFull ? '창 모드로 복귀 (Esc / F11)' : '전체 화면 전환 (F11)';
      btn.classList.toggle('active', isFull);
    }
    btn.addEventListener('click', function () {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(function (e) { console.warn('전체화면 전환 실패:', e); });
      } else {
        document.exitFullscreen().catch(function (e) { console.warn('전체화면 종료 실패:', e); });
      }
    });
    document.addEventListener('fullscreenchange', updateBtn);
    updateBtn();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFullscreenToggle);
  } else {
    initFullscreenToggle();
  }
`;

if (!appSettings.includes('initFullscreenToggle')) {
  appSettings = appSettings.replace(/\}\)\(\);\s*$/, fullscreenScript + '\n})();');
  fs.writeFileSync(appSettingsPath, appSettings, 'utf8');
  console.log('appSettings.js updated with global fullscreen binder');
}

// 3. Update theme-3d.css for .fullscreen-btn
const theme3dPath = path.join(publicDir, 'theme-3d.css');
let theme3d = fs.readFileSync(theme3dPath, 'utf8');
const fullscreenCss = `
/* ── 전체 화면 / 창 모드 버튼 ── */
.fullscreen-btn {
  font-size: 13px !important;
  font-weight: 700 !important;
  padding: 5px 12px !important;
  border-radius: var(--3d-btn-radius) !important;
  cursor: pointer !important;
  white-space: nowrap !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
}
.fullscreen-btn.active {
  background: var(--accent-dim) !important;
  border-color: var(--accent) !important;
  color: var(--primary-text) !important;
}
`;

if (!theme3d.includes('.fullscreen-btn')) {
  theme3d += fullscreenCss;
  fs.writeFileSync(theme3dPath, theme3d, 'utf8');
  console.log('theme-3d.css updated with .fullscreen-btn style');
}
