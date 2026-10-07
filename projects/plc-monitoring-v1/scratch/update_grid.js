const fs = require('fs');
const p = 'D:/AI_Work/Antigravity/plc-monitoring/pc-app/public/grid/index.html';
let content = fs.readFileSync(p, 'utf8');

// 1. Update apply(z)
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
      syncControl(z);
    }`;

if (content.includes(oldApply)) {
  content = content.replace(oldApply, newApply);
  console.log('apply(z) updated');
} else {
  console.log('apply(z) not matched exactly, checking alternative');
}

// 2. Add .ui-zoom CSS and update #univer-container
const oldUniverCss = `  #univer-container {
    flex: 1 1 0;      /* 내용 크기 무시하고 flex-grow로만 높이 결정 (Univer 캔버스 크기 안정화용) */
    min-height: 0;
    width: 100%;
  }`;

const newUniverCss = `  /* ── 화면 배율 컨트롤(−/%/+) ── */
  .ui-zoom { display: inline-flex; align-items: stretch; border: 1px solid var(--panel-border); border-radius: 6px; overflow: hidden; height: 30px; }
  .ui-zoom button { border: none; background: var(--input-bg); padding: 0 10px; font-size: 15px; font-weight: 700; line-height: 1; cursor: pointer; color: var(--text); border-radius: 0; }
  .ui-zoom button:hover { background: var(--bg-alt); color: var(--accent); }
  .ui-zoom select { border: none; border-left: 1px solid var(--panel-border); border-right: 1px solid var(--panel-border); background: var(--input-bg); font-size: 13px; font-family: var(--mono); color: var(--text); padding: 0 4px; cursor: pointer; border-radius: 0; text-align: center; }

  #univer-container {
    flex: 1 1 0;      /* 내용 크기 무시하고 flex-grow로만 높이 결정 (Univer 캔버스 크기 안정화용) */
    min-height: 0;
    width: 100%;
    position: relative;
    overflow: hidden;
    zoom: calc(1 / var(--ui-zoom, 1));
  }`;

if (content.includes(oldUniverCss)) {
  content = content.replace(oldUniverCss, newUniverCss);
  console.log('#univer-container CSS updated');
}

// 3. Add ui-zoom controls before themeSelect
const zoomControlsHtml = `    <div class="ui-zoom" title="화면 배율 조절 (Ctrl+휠, Ctrl+0: 100%로 초기화)">
      <button type="button" id="uiZoomOut" aria-label="축소">−</button>
      <select id="uiZoomSelect" aria-label="배율 선택">
        <option value="40">40%</option>
        <option value="50">50%</option>
        <option value="67">67%</option>
        <option value="75">75%</option>
        <option value="80">80%</option>
        <option value="90">90%</option>
        <option value="100" selected>100%</option>
        <option value="110">110%</option>
        <option value="125">125%</option>
        <option value="150">150%</option>
        <option value="175">175%</option>
        <option value="200">200%</option>
      </select>
      <button type="button" id="uiZoomIn" aria-label="확대">+</button>
    </div>
    <select id="themeSelect"`;

if (content.includes('<select id="themeSelect"') && !content.includes('id="uiZoomSelect"')) {
  content = content.replace('<select id="themeSelect"', zoomControlsHtml);
  console.log('zoom controls added to header');
}

fs.writeFileSync(p, content, 'utf8');
console.log('grid/index.html written successfully');
