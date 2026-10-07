const fs = require('fs');
const p = 'D:/AI_Work/Antigravity/plc-monitoring/pc-app/public/grid/index.html';
let content = fs.readFileSync(p, 'utf8');

const target = `  #univer-container {
    flex: 1 1 0;      /* 내용 크기 무시하고 flex-grow로만 높이 결정 (Univer 캔버스 크기 안정화용) */
    min-height: 0;
    width: 100%;
    position: relative; /* Univer 내부의 절대배치 요소들이 이 기준으로 잡히도록 */
    overflow: hidden;
  }`;

const replacement = `  /* ── 화면 배율 컨트롤(−/%/+) ── */
  .ui-zoom { display: inline-flex; align-items: stretch; border: 1px solid var(--panel-border); border-radius: 6px; overflow: hidden; height: 30px; }
  .ui-zoom button { border: none; background: var(--input-bg); padding: 0 10px; font-size: 15px; font-weight: 700; line-height: 1; cursor: pointer; color: var(--text); border-radius: 0; }
  .ui-zoom button:hover { background: var(--bg-alt); color: var(--accent); }
  .ui-zoom select { border: none; border-left: 1px solid var(--panel-border); border-right: 1px solid var(--panel-border); background: var(--input-bg); font-size: 13px; font-family: var(--mono); color: var(--text); padding: 0 4px; cursor: pointer; border-radius: 0; text-align: center; }

  #univer-container {
    flex: 1 1 0;      /* 내용 크기 무시하고 flex-grow로만 높이 결정 (Univer 캔버스 크기 안정화용) */
    min-height: 0;
    width: 100%;
    position: relative; /* Univer 내부의 절대배치 요소들이 이 기준으로 잡히도록 */
    overflow: hidden;
    zoom: calc(1 / var(--ui-zoom, 1));
  }`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(p, content, 'utf8');
  console.log('#univer-container CSS and .ui-zoom CSS updated in grid/index.html');
} else {
  console.log('target not found in grid/index.html');
}
