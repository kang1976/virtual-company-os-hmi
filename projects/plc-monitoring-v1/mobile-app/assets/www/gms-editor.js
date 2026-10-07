'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// 맵 에디터 v1 (계획서 4장) - 배관도 위 밸브/PT 오버레이를 UI로 추가·이동·수정·저장한다.
// data/gmsValves/<unit>.json 손편집을 대체한다. 저장 전까지는 서버에 반영되지 않으며
// [취소]는 서버 저장본을 다시 불러온다.
// gms.js 뒤에 로드되어 그 전역(valves, pts, renderDiagram 등)을 그대로 쓴다.
// ═══════════════════════════════════════════════════════════════════════════
(function initMapEditor() {
  const diagramPanel = document.querySelector('.diagram-panel');
  const gmsSvg = document.getElementById('gmsSvg');
  const toggleBtn = document.getElementById('mapEditToggle');
  const bar = document.getElementById('mapEditorBar');
  const hintEl = document.getElementById('editorHint');
  const propBtn = document.getElementById('editorPropBtn');
  const deleteBtn = document.getElementById('editorDeleteBtn');
  const saveBtn = document.getElementById('editorSaveBtn');
  const cancelBtn = document.getElementById('editorCancelBtn');
  const modal = document.getElementById('editorPropModal');

  // 모니터링 모드에서는 맵 편집 기능 자체를 끈다(gms.js가 URL의 mode 파라미터로 설정해둔
  // 값) - 토글 버튼을 숨기고 아래 이벤트 배선을 전혀 하지 않는다.
  if (!window.__gmsOperationMode) {
    if (toggleBtn) toggleBtn.hidden = true;
    return;
  }

  let tool = 'select'; // 'select' | 'valve' | 'pt'
  let selected = null; // { kind: 'valve'|'pt', tag }
  let dirty = false;
  let drag = null; // { obj, g, startX, startY, startClientX, startClientY, scale, moved }
  let suppressClick = false; // 드래그 직후 발생하는 click 이벤트를 무시하기 위한 플래그

  // ── 화면 좌표 → SVG viewBox 좌표 변환 ──
  // getScreenCTM()은 body CSS zoom과 얽혀 신뢰할 수 없었던 전례가 있어(세션 초기 검증),
  // preserveAspectRatio 기본값(xMidYMid meet)을 가정하고 직접 계산한다.
  function clientToSvg(evt) {
    const rect = gmsSvg.getBoundingClientRect();
    const vb = gmsSvg.viewBox.baseVal;
    const scale = Math.min(rect.width / vb.width, rect.height / vb.height);
    const offX = (rect.width - vb.width * scale) / 2;
    const offY = (rect.height - vb.height * scale) / 2;
    return {
      x: vb.x + (evt.clientX - rect.left - offX) / scale,
      y: vb.y + (evt.clientY - rect.top - offY) / scale,
      scale,
    };
  }

  function findByTag(kind, tag) {
    const arr = kind === 'valve' ? valves : pts;
    return arr.find((o) => o.tag === tag) || null;
  }

  function rerenderAll() {
    renderDiagram();
    renderPts();
    applyGmsValues({ ...lastValueByTag });
    applyGmsPts({ ...lastPtByTag });
    applySelectionHighlight();
  }

  function applySelectionHighlight() {
    document.querySelectorAll('#gmsSvg g.editor-selected').forEach((g) => g.classList.remove('editor-selected'));
    if (!selected) { propBtn.disabled = true; deleteBtn.disabled = true; return; }
    const layer = selected.kind === 'valve' ? valveLayer : ptLayer;
    const g = layer.querySelector(`[data-tag="${CSS.escape(selected.tag)}"]`);
    if (g) g.classList.add('editor-selected');
    propBtn.disabled = false;
    deleteBtn.disabled = false;
  }

  function setTool(next) {
    tool = next;
    bar.querySelectorAll('.tool-btn').forEach((b) => b.classList.toggle('active', b.dataset.tool === next));
    diagramPanel.classList.toggle('tool-add', next !== 'select');
    if (next === 'select') hintEl.textContent = '요소 클릭=선택, 드래그=이동, 더블클릭=속성';
    else if (next === 'valve') hintEl.textContent = '배관도에서 밸브를 놓을 위치를 클릭하세요';
    else hintEl.textContent = '배관도에서 PT를 놓을 위치를 클릭하세요';
  }

  function uniqueTag(prefix) {
    const all = new Set([...valves.map((v) => v.tag), ...pts.map((p) => p.tag)]);
    let n = 1;
    while (all.has(prefix + n)) n += 1;
    return prefix + n;
  }

  // ── 편집 툴바(mapEditorBar) 드래그 이동 ──
  // 기본 상태에서는 left:8px~right:90px로 폭이 늘어나 있어(도면 상단 스트립) 그대로는
  // 자유롭게 옮길 수 없다. 드래그를 시작하는 순간 현재 렌더링된 폭으로 고정폭 전환하고
  // right 제약을 풀어(.free-position) 속성 팝업과 같은 방식으로 옮긴다.
  const dragHandle = document.getElementById('mapEditorDragHandle');

  function resetBarPosition() {
    bar.classList.remove('free-position');
    bar.style.left = '';
    bar.style.top = '';
    bar.style.width = '';
  }

  let barDrag = null; // { startClientX, startClientY, startLeft, startTop }
  dragHandle.addEventListener('mousedown', (e) => {
    const rect = bar.getBoundingClientRect();
    const panelRect = diagramPanel.getBoundingClientRect();
    bar.classList.add('free-position');
    bar.style.width = rect.width + 'px';
    bar.style.left = (rect.left - panelRect.left) + 'px';
    bar.style.top = (rect.top - panelRect.top) + 'px';
    barDrag = { startClientX: e.clientX, startClientY: e.clientY, startLeft: rect.left - panelRect.left, startTop: rect.top - panelRect.top };
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!barDrag) return;
    const panelRect = diagramPanel.getBoundingClientRect();
    const dx = e.clientX - barDrag.startClientX;
    const dy = e.clientY - barDrag.startClientY;
    const maxLeft = panelRect.width - bar.offsetWidth - 4;
    const maxTop = panelRect.height - bar.offsetHeight - 4;
    bar.style.left = Math.min(Math.max(barDrag.startLeft + dx, 4), Math.max(4, maxLeft)) + 'px';
    bar.style.top = Math.min(Math.max(barDrag.startTop + dy, 4), Math.max(4, maxTop)) + 'px';
  });
  window.addEventListener('mouseup', () => { barDrag = null; });

  function enterEditMode() {
    window.__gmsEditorActive = true;
    dirty = false;
    toggleBtn.classList.add('active');
    bar.hidden = false;
    resetBarPosition();
    diagramPanel.classList.add('editing');
    setTool('select');
  }

  async function exitEditMode(reload) {
    window.__gmsEditorActive = false;
    toggleBtn.classList.remove('active');
    bar.hidden = true;
    diagramPanel.classList.remove('editing');
    diagramPanel.classList.remove('tool-add');
    selected = null;
    if (reload) await fetchValves(); // 서버 저장본으로 되돌림 (fetchValves가 다시 렌더링까지 수행)
    rerenderAll();
  }

  toggleBtn.addEventListener('click', () => {
    if (window.__gmsEditorActive) {
      if (dirty && !confirm('저장하지 않은 변경이 있습니다. 편집을 종료할까요?')) return;
      exitEditMode(dirty);
    } else {
      enterEditMode();
    }
  });

  bar.querySelectorAll('.tool-btn').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));

  // ── 요소 추가 (밸브/PT 툴 상태에서 배관도 클릭) 및 선택 (select 툴) ──
  gmsSvg.addEventListener('click', (e) => {
    if (!window.__gmsEditorActive) return;
    if (suppressClick) { suppressClick = false; return; }
    const pos = clientToSvg(e);
    if (tool === 'valve') {
      const tag = uniqueTag('AV_NEW');
      valves.push({
        tag, label: '', x: Math.round(pos.x), y: Math.round(pos.y), dir: 'v',
        labelDx: 0, labelDy: -16, labelAnchor: 'middle',
        cmd: { area: 'CIO', address: 0, bit: 0 }, fb: { area: 'CIO', address: 0, bit: 1 },
      });
      dirty = true;
      selected = { kind: 'valve', tag };
      rerenderAll();
      setTool('select');
      openPropModal();
      return;
    }
    if (tool === 'pt') {
      const tag = uniqueTag('PT_NEW');
      pts.push({
        tag, label: '', x: Math.round(pos.x), y: Math.round(pos.y),
        labelDx: -19, labelDy: 24, labelAnchor: 'start',
        dataType: 'INT', decimals: 0, alert: false, read: { area: 'DM', address: 0 },
      });
      dirty = true;
      selected = { kind: 'pt', tag };
      rerenderAll();
      setTool('select');
      openPropModal();
      return;
    }
    // 히터 아이콘(gms-heater)도 밸브와 같은 valves[] 배열에 저장되므로 kind는 'valve'로
    // 취급한다(gms-pt만 예외) - 그래야 findByTag/applySelectionHighlight가 올바른
    // 배열(valves)/레이어(valveLayer)를 찾는다.
    const g = e.target.closest('g.gms-valve, g.gms-heater, g.gms-pt');
    if (g) selected = { kind: g.classList.contains('gms-pt') ? 'pt' : 'valve', tag: g.dataset.tag };
    else selected = null;
    applySelectionHighlight();
  });

  gmsSvg.addEventListener('dblclick', (e) => {
    if (!window.__gmsEditorActive) return;
    const g = e.target.closest('g.gms-valve, g.gms-heater, g.gms-pt');
    if (!g) return;
    selected = { kind: g.classList.contains('gms-pt') ? 'pt' : 'valve', tag: g.dataset.tag };
    applySelectionHighlight();
    openPropModal();
  });

  // ── 드래그 이동 ──
  gmsSvg.addEventListener('mousedown', (e) => {
    if (!window.__gmsEditorActive || tool !== 'select') return;
    const g = e.target.closest('g.gms-valve, g.gms-heater, g.gms-pt');
    if (!g) return;
    const kind = g.classList.contains('gms-pt') ? 'pt' : 'valve';
    const obj = findByTag(kind, g.dataset.tag);
    if (!obj) return;
    selected = { kind, tag: obj.tag };
    applySelectionHighlight();
    const pos = clientToSvg(e);
    drag = { obj, g, startX: obj.x, startY: obj.y, startClientX: e.clientX, startClientY: e.clientY, scale: pos.scale, moved: false };
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!drag) return;
    const dx = (e.clientX - drag.startClientX) / drag.scale;
    const dy = (e.clientY - drag.startClientY) / drag.scale;
    if (!drag.moved && Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    drag.moved = true;
    drag.obj.x = Math.round((drag.startX + dx) * 10) / 10;
    drag.obj.y = Math.round((drag.startY + dy) * 10) / 10;
    drag.g.setAttribute('transform', 'translate(' + drag.obj.x + ',' + drag.obj.y + ')');
  });
  window.addEventListener('mouseup', () => {
    if (!drag) return;
    if (drag.moved) { dirty = true; suppressClick = true; }
    drag = null;
  });

  // ── 삭제 ──
  deleteBtn.addEventListener('click', () => {
    if (!selected) return;
    const arr = selected.kind === 'valve' ? valves : pts;
    const idx = arr.findIndex((o) => o.tag === selected.tag);
    if (idx < 0) return;
    if (!confirm(selected.tag + ' 을(를) 삭제할까요?')) return;
    arr.splice(idx, 1);
    dirty = true;
    selected = null;
    rerenderAll();
  });

  // ── 속성 팝업 ──
  const $ = (id) => document.getElementById(id);
  function openPropModal() {
    if (!selected) return;
    const obj = findByTag(selected.kind, selected.tag);
    if (!obj) return;
    $('propTitle').textContent = (selected.kind === 'valve' ? '밸브' : 'PT') + ' 속성 - ' + obj.tag;
    $('propTag').value = obj.tag;
    $('propLabel').value = obj.label || '';
    const isValve = selected.kind === 'valve';
    $('propFieldsValve').style.display = isValve ? '' : 'none';
    $('propFieldsPt').style.display = isValve ? 'none' : '';
    if (isValve) {
      $('propDir').value = obj.dir || 'v';
      $('propLabelDx').value = obj.labelDx ?? 0;
      $('propLabelDy').value = obj.labelDy ?? -16;
      $('propLabelAnchor').value = obj.labelAnchor || 'middle';
      $('propCmdArea').value = (obj.cmd && obj.cmd.area) || 'CIO';
      $('propCmdAddr').value = (obj.cmd && obj.cmd.address) ?? 0;
      $('propCmdBit').value = (obj.cmd && obj.cmd.bit) ?? 0;
      $('propFbArea').value = (obj.fb && obj.fb.area) || 'CIO';
      $('propFbAddr').value = (obj.fb && obj.fb.address) ?? 0;
      $('propFbBit').value = (obj.fb && obj.fb.bit) ?? 0;
    } else {
      $('propPtType').value = obj.dataType || 'INT';
      $('propPtDecimals').value = obj.decimals ?? 0;
      $('propPtAlert').checked = !!obj.alert;
      $('propPtLabelDx').value = obj.labelDx ?? -19;
      $('propPtLabelDy').value = obj.labelDy ?? 24;
      $('propPtLabelAnchor').value = obj.labelAnchor || 'start';
      $('propReadArea').value = (obj.read && obj.read.area) || 'DM';
      $('propReadAddr').value = (obj.read && obj.read.address) ?? 0;
    }
    resetModalPosition();
    modal.hidden = false;
  }
  propBtn.addEventListener('click', openPropModal);
  $('propCloseBtn').addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });

  // ── 명칭(라벨) 위치 빠른 선택 (좌/우/상/하) ──
  // 눌러도 dx/dy/정렬 입력칸에 값만 채워질 뿐이라 이후 숫자를 더 조정해도 된다.
  // 밸브(bowtie 심볼)와 PT(값 박스)는 크기가 달라 프리셋 수치를 따로 둔다.
  const LABEL_POSITION_PRESETS = {
    valve: {
      left: { dx: -14, dy: 5, anchor: 'end' },
      right: { dx: 14, dy: 5, anchor: 'start' },
      top: { dx: 0, dy: -14, anchor: 'middle' },
      bottom: { dx: 0, dy: 24, anchor: 'middle' },
    },
    pt: {
      left: { dx: -22, dy: 4, anchor: 'end' },
      right: { dx: 22, dy: 4, anchor: 'start' },
      top: { dx: -19, dy: -14, anchor: 'start' },
      bottom: { dx: -19, dy: 24, anchor: 'start' },
    },
  };
  document.querySelectorAll('.pos-preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = LABEL_POSITION_PRESETS[btn.dataset.target][btn.dataset.side];
      if (btn.dataset.target === 'valve') {
        $('propLabelDx').value = preset.dx;
        $('propLabelDy').value = preset.dy;
        $('propLabelAnchor').value = preset.anchor;
      } else {
        $('propPtLabelDx').value = preset.dx;
        $('propPtLabelDy').value = preset.dy;
        $('propPtLabelAnchor').value = preset.anchor;
      }
    });
  });

  // ── 속성 팝업 드래그 이동 ──
  // 팝업이 화면 가운데(부모 flex 중앙정렬)에 뜨는데, 배관도 뒤쪽을 봐야 할 때가 있어서
  // 제목줄(⠿ 아이콘)을 드래그하면 옮길 수 있게 한다. position:fixed로 전환해 부모의
  // flex 중앙정렬에서 벗어나 자유롭게 배치한다.
  const modalBox = modal.querySelector('.editor-modal-box');
  const modalTitle = $('propTitle');

  function resetModalPosition() {
    modalBox.style.position = '';
    modalBox.style.left = '';
    modalBox.style.top = '';
    modalBox.style.margin = '';
  }

  let modalDrag = null; // { startClientX, startClientY, startLeft, startTop }
  modalTitle.addEventListener('mousedown', (e) => {
    const rect = modalBox.getBoundingClientRect();
    // 최초 드래그 시작 시 flex 중앙정렬을 벗어나 현재 위치를 절대좌표로 고정한다.
    modalBox.style.position = 'fixed';
    modalBox.style.left = rect.left + 'px';
    modalBox.style.top = rect.top + 'px';
    modalBox.style.margin = '0';
    modalDrag = { startClientX: e.clientX, startClientY: e.clientY, startLeft: rect.left, startTop: rect.top };
    modalBox.classList.add('dragging');
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!modalDrag) return;
    const dx = e.clientX - modalDrag.startClientX;
    const dy = e.clientY - modalDrag.startClientY;
    const maxLeft = window.innerWidth - 40;
    const maxTop = window.innerHeight - 40;
    modalBox.style.left = Math.min(Math.max(modalDrag.startLeft + dx, -modalBox.offsetWidth + 60), maxLeft) + 'px';
    modalBox.style.top = Math.min(Math.max(modalDrag.startTop + dy, 0), maxTop) + 'px';
  });
  window.addEventListener('mouseup', () => {
    if (!modalDrag) return;
    modalDrag = null;
    modalBox.classList.remove('dragging');
  });

  $('propApplyBtn').addEventListener('click', () => {
    if (!selected) return;
    const obj = findByTag(selected.kind, selected.tag);
    if (!obj) return;
    const newTag = $('propTag').value.trim();
    if (!newTag) { toast('태그를 입력하세요.', 'err'); return; }
    if (newTag !== obj.tag) {
      const dup = [...valves, ...pts].some((o) => o !== obj && o.tag === newTag);
      if (dup) { toast('태그 "' + newTag + '" 이(가) 이미 있습니다.', 'err'); return; }
    }
    obj.tag = newTag;
    obj.label = $('propLabel').value.trim();
    if (selected.kind === 'valve') {
      obj.dir = $('propDir').value;
      obj.labelDx = Number($('propLabelDx').value) || 0;
      obj.labelDy = Number($('propLabelDy').value) || 0;
      obj.labelAnchor = $('propLabelAnchor').value;
      obj.cmd = { area: ($('propCmdArea').value.trim().toUpperCase() || 'CIO'), address: Number($('propCmdAddr').value) || 0, bit: Number($('propCmdBit').value) || 0 };
      obj.fb = { area: ($('propFbArea').value.trim().toUpperCase() || 'CIO'), address: Number($('propFbAddr').value) || 0, bit: Number($('propFbBit').value) || 0 };
    } else {
      obj.dataType = $('propPtType').value;
      obj.decimals = Number($('propPtDecimals').value) || 0;
      obj.alert = $('propPtAlert').checked;
      obj.labelDx = Number($('propPtLabelDx').value) || 0;
      obj.labelDy = Number($('propPtLabelDy').value) || 0;
      obj.labelAnchor = $('propPtLabelAnchor').value;
      obj.read = { area: ($('propReadArea').value.trim().toUpperCase() || 'DM'), address: Number($('propReadAddr').value) || 0 };
    }
    selected.tag = newTag;
    dirty = true;
    modal.hidden = true;
    rerenderAll();
    toast(newTag + ' 속성 적용됨 (저장 전)', '');
  });

  // ── 저장 / 취소 ──
  saveBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/gms/valves?unit=' + encodeURIComponent(selectedUnitId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valves, pts }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '저장 실패');
      dirty = false;
      toast('맵 저장됨 (밸브 ' + valves.length + '개, PT ' + pts.length + '개)', 'ok');
      exitEditMode(false);
    } catch (e) {
      toast('맵 저장 실패: ' + e.message, 'err');
    }
  });

  cancelBtn.addEventListener('click', () => {
    if (dirty && !confirm('저장하지 않은 변경을 버리고 서버 저장본으로 되돌릴까요?')) return;
    exitEditMode(true);
  });

  // Delete 키로 선택 요소 삭제 (입력 필드 포커스/모달 열림 상태 제외)
  window.addEventListener('keydown', (e) => {
    if (!window.__gmsEditorActive || !modal.hidden) return;
    if (e.key === 'Delete' && selected && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) {
      deleteBtn.click();
    }
  });
})();
