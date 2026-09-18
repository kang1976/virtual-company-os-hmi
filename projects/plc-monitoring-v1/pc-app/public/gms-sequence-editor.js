'use strict';

/**
 * Main 시퀀스(CYLINDER STEP STATUS) 순서 편집 팝업 - OPTION 탭의 "Main 시퀀스 순서" 편집
 * 버튼(gms.js의 renderOptionTable)이 window.openMainSequenceEditor()로 연다. gms.js가 이미
 * 로드해둔 MAIN_SEQUENCE_TYPE_DEFS/mainSequenceOrder/mainSequenceEnabledTypes를 그대로
 * 가져다 쓴다 - gms.html에서 반드시 gms.js 다음에 로드해야 한다.
 *
 * 편집 중에는 작업용 사본(workingOrder/workingEnabled)만 건드리고, "저장"을 눌러야 실제
 * gms.js의 상태 + 서버 파일(data/gmsMainSequence.json)에 반영된다("취소"는 사본을 버린다).
 * 저장 성공 시 Operation.js의 rebuildCylinderStepOrder()를 불러서 CYLINDER_STEP_ORDER(배지/
 * 자동 진행 순서)를 즉시 다시 계산한다.
 */

// gmsManager.js의 MAIN_SEQUENCE_DEFAULT_ORDER와 동일한 값(Main Sequence.csv 16행) - "기본값으로
// 초기화" 버튼이 서버 왕복 없이 즉시 되돌릴 수 있도록 여기도 같은 값을 상수로 둔다.
const MAIN_SEQUENCE_DEFAULT_ORDER = [
  { id: 'seq1', type: 'IDLE' }, { id: 'seq2', type: 'Puls' }, { id: 'seq3', type: '1P' },
  { id: 'seq4', type: '-L' }, { id: 'seq5', type: '-VT' }, { id: 'seq6', type: '2P' },
  { id: 'seq7', type: 'CC' }, { id: 'seq8', type: 'Bypass' }, { id: 'seq9', type: '+L' },
  { id: 'seq10', type: '3P' }, { id: 'seq11', type: '-VT' }, { id: 'seq12', type: '4P' },
  { id: 'seq13', type: 'PC' }, { id: 'seq14', type: 'RGV' }, { id: 'seq15', type: 'READY' },
  { id: 'seq16', type: 'Service' },
];

let workingOrder = [];
let workingEnabled = {};
let draggedId = null;

function newInstanceId() {
  return `seq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function typeLabel(type) {
  const def = MAIN_SEQUENCE_TYPE_DEFS.find((d) => d.type === type);
  return def ? `${def.type} (${def.korLabel})` : type;
}

function renderChips() {
  const list = document.getElementById('mainSequenceChipList');
  list.innerHTML = '';
  workingOrder.forEach((inst) => {
    const enabled = workingEnabled[inst.type] !== false;
    const chip = document.createElement('div');
    chip.className = 'seq-chip' + (enabled ? '' : ' disabled-type');
    chip.draggable = true;
    chip.dataset.id = inst.id;
    chip.title = typeLabel(inst.type);
    const label = document.createElement('span');
    label.textContent = inst.type;
    chip.appendChild(label);
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'seq-chip-remove';
    removeBtn.textContent = '×';
    removeBtn.title = '삭제';
    removeBtn.addEventListener('click', () => {
      workingOrder = workingOrder.filter((s) => s.id !== inst.id);
      renderChips();
    });
    chip.appendChild(removeBtn);

    chip.addEventListener('dragstart', (e) => {
      draggedId = inst.id;
      chip.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', inst.id); } catch (err) { /* 일부 브라우저는 필요 */ }
    });
    chip.addEventListener('dragend', () => {
      chip.classList.remove('dragging');
      draggedId = null;
      list.querySelectorAll('.seq-chip.drag-over').forEach((el) => el.classList.remove('drag-over'));
    });
    chip.addEventListener('dragover', (e) => {
      if (!draggedId || draggedId === inst.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      chip.classList.add('drag-over');
    });
    chip.addEventListener('dragleave', () => chip.classList.remove('drag-over'));
    chip.addEventListener('drop', (e) => {
      e.preventDefault();
      chip.classList.remove('drag-over');
      if (!draggedId || draggedId === inst.id) return;
      const fromIdx = workingOrder.findIndex((s) => s.id === draggedId);
      const toIdx = workingOrder.findIndex((s) => s.id === inst.id);
      if (fromIdx === -1 || toIdx === -1) return;
      const [moved] = workingOrder.splice(fromIdx, 1);
      // 드롭 대상의 왼쪽 절반이면 그 앞에, 오른쪽 절반이면 그 뒤에 넣는다(자연스러운 순서 편집).
      const rect = chip.getBoundingClientRect();
      const before = e.clientX < rect.left + rect.width / 2;
      const insertAt = workingOrder.findIndex((s) => s.id === inst.id);
      workingOrder.splice(before ? insertAt : insertAt + 1, 0, moved);
      renderChips();
    });

    list.appendChild(chip);
  });
}

function renderAddSelect() {
  const select = document.getElementById('mainSequenceAddSelect');
  select.innerHTML = MAIN_SEQUENCE_TYPE_DEFS
    .map((def) => `<option value="${def.type}">${def.type} - ${def.korLabel}</option>`)
    .join('');
}

function renderEnabledTable() {
  const tbody = document.getElementById('mainSequenceEnabledBody');
  tbody.innerHTML = MAIN_SEQUENCE_TYPE_DEFS.map((def) => `<tr>`
    + `<td>${def.type} <span style="color:var(--muted);font-size:11px;">${def.korLabel}</span></td>`
    + `<td><button type="button" class="seq-enable-btn" data-type="${def.type}" style="font-size:12px;padding:3px 10px;width:100%;"></button></td>`
    + `</tr>`).join('');
  tbody.querySelectorAll('.seq-enable-btn').forEach((btn) => {
    const type = btn.dataset.type;
    const sync = () => {
      const enabled = workingEnabled[type] !== false;
      btn.textContent = enabled ? '적용' : '미적용';
      btn.classList.toggle('primary', enabled);
    };
    sync();
    btn.addEventListener('click', () => {
      workingEnabled[type] = workingEnabled[type] === false;
      sync();
      renderChips(); // 미적용 표시(취소선)를 칩 목록에도 즉시 반영
    });
  });
}

window.openMainSequenceEditor = function openMainSequenceEditor() {
  // 편집은 항상 지금 저장된(라이브) 값의 사본에서 시작 - "취소"를 누르면 이 사본만 버려진다.
  workingOrder = mainSequenceOrder.map((s) => ({ ...s }));
  workingEnabled = { ...mainSequenceEnabledTypes };
  renderChips();
  renderAddSelect();
  renderEnabledTable();
  document.getElementById('mainSequenceEditorModal').hidden = false;
};

function closeMainSequenceEditor() {
  document.getElementById('mainSequenceEditorModal').hidden = true;
}

document.getElementById('mainSequenceAddBtn').addEventListener('click', () => {
  const type = document.getElementById('mainSequenceAddSelect').value;
  if (!type) return;
  workingOrder.push({ id: newInstanceId(), type });
  renderChips();
});

document.getElementById('mainSequenceResetBtn').addEventListener('click', () => {
  workingOrder = MAIN_SEQUENCE_DEFAULT_ORDER.map((s) => ({ ...s, id: newInstanceId() }));
  workingEnabled = {};
  MAIN_SEQUENCE_TYPE_DEFS.forEach((def) => { workingEnabled[def.type] = true; });
  renderChips();
  renderEnabledTable();
});

document.getElementById('mainSequenceCancelBtn').addEventListener('click', closeMainSequenceEditor);

// ── 엑셀로 내보내기/불러오기 - gms.js의 fileToBase64/fetchAndSave(TREND 기록 불러오기/내보내기와
// 동일한 헬퍼)를 그대로 재사용한다. 내보내기는 지금 화면(workingOrder/workingEnabled, 저장
// 전이어도 그대로)을 보내고, 불러오기는 서버가 파싱/검증한 결과를 작업용 사본에만 반영한다
// (바로 저장되지 않음 - "취소"로 되돌릴 수 있고, "저장"을 눌러야 실제 반영). ──
document.getElementById('mainSequenceExcelExportBtn').addEventListener('click', async () => {
  await fetchAndSave(
    '/api/gms/main-sequence/export/xlsx',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: workingOrder, enabledTypes: workingEnabled }),
    },
    `GMS_MainSequence_${Date.now()}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
});

document.getElementById('mainSequenceExcelImportBtn').addEventListener('click', () => {
  const input = document.getElementById('mainSequenceExcelImportFile');
  input.value = '';
  input.click();
});

document.getElementById('mainSequenceExcelImportFile').addEventListener('change', async () => {
  const input = document.getElementById('mainSequenceExcelImportFile');
  const file = input.files && input.files[0];
  if (!file) return;
  try {
    const fileBase64 = await fileToBase64(file);
    const res = await fetch('/api/gms/main-sequence/import/xlsx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileBase64 }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || '불러오기 실패');
    workingOrder = data.order;
    // 파일에 없던 타입은 지금 작업용 사본의 값을 그대로 유지한다(서버는 파일에 나온 타입만
    // 채워서 돌려줌) - 새로 불러온 값으로 덮어쓰되, 기존 값은 남겨둔다.
    workingEnabled = { ...workingEnabled, ...data.enabledTypes };
    renderChips();
    renderEnabledTable();
    if (data.warnings && data.warnings.length > 0) {
      toast(`엑셀 불러옴(${workingOrder.length}단계) - ${data.warnings.length}개 행 무시됨: ${data.warnings[0]}`, 'err');
    } else {
      toast(`엑셀에서 ${workingOrder.length}단계 불러왔습니다. "저장"을 눌러야 반영됩니다.`, 'ok');
    }
  } catch (e) {
    toast('엑셀 불러오기 실패: ' + e.message, 'err');
  }
});

document.getElementById('mainSequenceSaveBtn').addEventListener('click', async () => {
  if (workingOrder.length === 0) {
    toast('시퀀스에 항목이 하나 이상 있어야 합니다.', 'err');
    return;
  }
  try {
    const res = await fetch('/api/gms/main-sequence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: workingOrder, enabledTypes: workingEnabled }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || '저장 실패');
    mainSequenceOrder = workingOrder;
    mainSequenceEnabledTypes = workingEnabled;
    if (window.rebuildCylinderStepOrder) window.rebuildCylinderStepOrder();
    toast(`Main 시퀀스 저장 완료(${workingOrder.length}단계)`, 'ok');
    closeMainSequenceEditor();
  } catch (e) {
    toast('Main 시퀀스 저장 실패: ' + e.message, 'err');
  }
});
