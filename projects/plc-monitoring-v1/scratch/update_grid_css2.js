const fs = require('fs');
const p = 'D:/AI_Work/Antigravity/plc-monitoring/pc-app/public/grid/index.html';
let content = fs.readFileSync(p, 'utf8');

content = content.replace(/#univer-container\s*\{[\s\S]*?\}/, `/* ── 화면 배율 컨트롤(−/%/+) ── */
  .ui-zoom { display: inline-flex; align-items: stretch; border: 1px solid var(--panel-border); border-radius: 6px; overflow: hidden; height: 30px; }
  .ui-zoom button { border: none; background: var(--input-bg); padding: 0 10px; font-size: 15px; font-weight: 700; line-height: 1; cursor: pointer; color: var(--text); border-radius: 0; }
  .ui-zoom button:hover { background: var(--bg-alt); color: var(--accent); }
  .ui-zoom select { border: none; border-left: 1px solid var(--panel-border); border-right: 1px solid var(--panel-border); background: var(--input-bg); font-size: 13px; font-family: var(--mono); color: var(--text); padding: 0 4px; cursor: pointer; border-radius: 0; text-align: center; }

  #univer-container {
    flex: 1 1 0;
    min-height: 0;
    width: 100%;
    position: relative;
    overflow: hidden;
    background: #fff;
    zoom: calc(1 / var(--ui-zoom, 1));
  }`);

fs.writeFileSync(p, content, 'utf8');
console.log('Regex updated grid/index.html successfully');
