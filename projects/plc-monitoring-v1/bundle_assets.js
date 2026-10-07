const fs = require('fs');
const path = require('path');

const rootDir = 'D:\\AI_Work\\Antigravity\\plc-monitoring';
const mobileAssetsDir = path.join(rootDir, 'mobile-app', 'assets', 'www');
const pcPublicDir = path.join(rootDir, 'pc-app', 'public');

function processDir(targetDir) {
  console.log('[Bundle] Processing:', targetDir);
  const svgPath = path.join(targetDir, 'gms-diagram.svg');
  const gmsHtmlPath = path.join(targetDir, 'gms.html');
  const opDir = path.join(targetDir, 'OPERATION HTML');

  // 1. OPERATION HTML 번들 생성
  const files = fs.readdirSync(opDir).filter(f => f.endsWith('.html'));
  const bundle = {};
  for (const file of files) {
    const filePath = path.join(opDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    bundle[file] = content;
  }
  const bundleJs = 'window.OPERATION_SCREEN_BUNDLE = ' + JSON.stringify(bundle) + ';\n';
  const bundleJsPath = path.join(targetDir, 'operation-screens-bundle.js');
  fs.writeFileSync(bundleJsPath, bundleJs, 'utf8');
  console.log('[Bundle] Generated', bundleJsPath, 'with', files.length, 'screens.');

  // 2. gms.html 갱신 (SVG 인라인 삽입 & bundle script 태그 삽입)
  let html = fs.readFileSync(gmsHtmlPath, 'utf8');
  const svg = fs.readFileSync(svgPath, 'utf8');

  if (html.includes('<!--GMS_DIAGRAM_SVG-->')) {
    html = html.replace('<!--GMS_DIAGRAM_SVG-->', svg);
    console.log('[Bundle] Replaced <!--GMS_DIAGRAM_SVG--> with full SVG diagram.');
  }

  if (!html.includes('operation-screens-bundle.js')) {
    html = html.replace('<script src= Operation.js></script>', '<script src=operation-screens-bundle.js></script>\n<script src=Operation.js></script>');
    console.log('[Bundle] Injected operation-screens-bundle.js script tag.');
  }

  fs.writeFileSync(gmsHtmlPath, html, 'utf8');
}

processDir(mobileAssetsDir);
processDir(pcPublicDir);
