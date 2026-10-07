'use strict';

/**
 * 보조메뉴 "설정모드 A/B" 화면의 우측 도킹 키패드 + 저장/복사/단수전환 컨트롤러.
 * 그리드 자체(gms-configmode-widget.js, Univer)는 값 셀이 선택되면
 * window.gmsConfigModeOnCellSelected(row)를 호출해 여기로 넘겨준다 - 이 파일은 그 콜백을
 * 받아 키패드를 열고, ENTER/저장/복사/단수 버튼을 처리한 뒤 window.gmsConfigModeGrid API로
 * 그리드에 값을 반영한다(gms-pt-calibration.js의 키패드 구조를 참고했지만, 배치는 인라인이
 * 아니라 화면 우측에 항상 떠있는 도킹 패널이고, 상하좌우 버튼은 값 조정이 아니라 그리드 안에서
 * 다음/이전 설정행으로 이동하는 용도다).
 *
 * 이 화면 마크업(OPERATION HTML/설정모드.html)은 Operation.js가 fetch로 늦게 주입하므로,
 * gms-pt-calibration.js와 동일한 이유로 top-level에서 바로 wiring하지 않는다 - Operation.js의
 * showProgressConfigMode가 화면을 보여줄 때마다 window.wireGmsConfigModeKeypad()를 호출하되
 * dataset.wired 가드로 중복 연결을 막는다.
 */

let configModeEditingId = null; // 지금 키패드가 편집 중인 설정값 id
let configModeKeypadBuffer = '';

function configModeRenderKeypadDisplay() {
  const el = document.getElementById('configModeKeypadDisplay');
  if (el) el.textContent = configModeKeypadBuffer || '0';
}

function configModeOpenKeypadFor(row) {
  if (!row) return;
  configModeEditingId = row.id;
  configModeKeypadBuffer = row.value === null || row.value === undefined ? '' : String(row.value);
  const wrap = document.getElementById('configModeKeypadWrap');
  if (wrap) wrap.style.display = '';
  const title = document.getElementById('configModeKeypadTitle');
  if (title) title.textContent = `${row.name || row.id} 편집`;
  const rangeEl = document.getElementById('configModeKeypadRange');
  if (rangeEl) {
    const hasMin = row.min !== '' && row.min !== null && row.min !== undefined;
    const hasMax = row.max !== '' && row.max !== null && row.max !== undefined;
    rangeEl.textContent = hasMin || hasMax ? `입력범위: ${hasMin ? row.min : '-'} ~ ${hasMax ? row.max : '-'}` : '';
  }
  configModeRenderKeypadDisplay();
}

function configModeHideKeypad() {
  configModeEditingId = null;
  const wrap = document.getElementById('configModeKeypadWrap');
  if (wrap) wrap.style.display = 'none';
}

/** gms-configmode-widget.js가 값 셀 클릭 때마다 호출한다. */
window.gmsConfigModeOnCellSelected = function gmsConfigModeOnCellSelected(row) {
  configModeOpenKeypadFor(row);
};

/** 상하좌우 - 지금 블록 배치(2차원 id 배열) 안에서 위/아래는 같은 열(블록), 좌/우는 같은
    줄(dataRow)의 옆 블록으로 이동한다(다단 레이아웃일 때만 좌/우가 의미 있음 - 1단이면
    블록이 하나뿐이라 좌/우는 조용히 아무 일도 안 한다). */
function configModeMoveSelection(dir) {
  if (!configModeEditingId || !window.gmsConfigModeGrid) return;
  const blocks = window.gmsConfigModeGrid.getBlocksSnapshot();
  let blockIdx = -1;
  let dataIdx = -1;
  for (let b = 0; b < blocks.length; b++) {
    const idx = blocks[b].indexOf(configModeEditingId);
    if (idx !== -1) { blockIdx = b; dataIdx = idx; break; }
  }
  if (blockIdx === -1) return;
  let nextBlock = blockIdx;
  let nextData = dataIdx;
  if (dir === 'up') nextData -= 1;
  else if (dir === 'down') nextData += 1;
  else if (dir === 'left') nextBlock -= 1;
  else if (dir === 'right') nextBlock += 1;
  if (nextBlock < 0 || nextBlock >= blocks.length || !blocks[nextBlock]) return;
  if (nextData < 0 || nextData >= blocks[nextBlock].length) return;
  const targetId = blocks[nextBlock][nextData];
  const row = window.gmsConfigModeGrid.focusRow(targetId);
  if (row) configModeOpenKeypadFor(row);
}

function configModeCommitValue() {
  const val = Number(configModeKeypadBuffer);
  if (configModeKeypadBuffer === '' || configModeKeypadBuffer === '-' || !Number.isFinite(val)) {
    toast('올바른 숫자를 입력하세요.', 'err');
    return;
  }
  const rows = window.gmsConfigModeGrid.getAllRows();
  const row = rows.find((r) => r.id === configModeEditingId);
  if (!row) return;
  const min = row.min === '' || row.min === null || row.min === undefined ? null : Number(row.min);
  const max = row.max === '' || row.max === null || row.max === undefined ? null : Number(row.max);
  if (min !== null && Number.isFinite(min) && val < min) {
    toast(`${row.name || row.id}: 최소값(${min}) 미만입니다.`, 'err');
    return;
  }
  if (max !== null && Number.isFinite(max) && val > max) {
    toast(`${row.name || row.id}: 최대값(${max}) 초과입니다.`, 'err');
    return;
  }
  window.gmsConfigModeGrid.setCellValue(row.id, val);
  configModeKeypadBuffer = String(val);
  configModeRenderKeypadDisplay();
  toast(`${row.name || row.id} = ${val} (저장 전 - "저장"을 눌러야 반영됩니다)`, 'ok');
}

/** 키패드 버튼 클릭과 물리 키보드 입력이 공유하는 단일 처리 함수(gms-pt-calibration.js와
    동일한 설계). */
function configModeHandleKey(key) {
  if (!configModeEditingId) return;
  if (key === 'esc') { configModeHideKeypad(); return; }
  if (key === 'clear') { configModeKeypadBuffer = ''; configModeRenderKeypadDisplay(); return; }
  if (key === 'bs') { configModeKeypadBuffer = configModeKeypadBuffer.slice(0, -1); configModeRenderKeypadDisplay(); return; }
  if (key === 'enter') { configModeCommitValue(); return; }
  if (key === 'up' || key === 'down' || key === 'left' || key === 'right') { configModeMoveSelection(key); return; }
  if (key === '-') {
    configModeKeypadBuffer = configModeKeypadBuffer.startsWith('-') ? configModeKeypadBuffer.slice(1) : '-' + configModeKeypadBuffer;
    configModeRenderKeypadDisplay();
    return;
  }
  if (key === '.') {
    if (configModeKeypadBuffer.includes('.')) return;
    configModeKeypadBuffer += '.';
    configModeRenderKeypadDisplay();
    return;
  }
  if (/^[0-9]$/.test(key)) {
    configModeKeypadBuffer += key;
    configModeRenderKeypadDisplay();
  }
}

/** "<연산자> <참조ID>" 형식 파싱(예: "< hptUpperLimit", "<= secondaryLimit_{side}"). */
function configModeParseInterlock(str) {
  const m = String(str || '').trim().match(/^(<=|>=|<|>)\s*(.+)$/);
  if (!m) return null;
  return { op: m[1], targetId: m[2].trim() };
}

/** 전체 행에 대해 인터락을 검사한다 - 위반 메시지 배열을 돌려준다(비어있으면 통과).
    요청사항: "저장 자체를 막는다" - 저장 버튼 핸들러가 이 결과를 보고 POST 여부를 결정한다. */
function configModeValidateInterlocks(rows) {
  const violations = [];
  rows.forEach((row) => {
    const parsed = configModeParseInterlock(row.interlock);
    if (!parsed) return;
    const side = row.side === 'B' ? 'B' : 'A'; // 공통 행의 인터락은 A 기준으로 치환(흔치 않은 경우)
    const targetId = parsed.targetId.replace('{side}', side);
    const target = rows.find((r) => r.id === targetId);
    if (!target) {
      violations.push(`${row.name || row.id}: 인터락 대상 "${targetId}"을(를) 찾을 수 없습니다(설정값 ID 확인 필요).`);
      return;
    }
    const a = Number(row.value);
    const b = Number(target.value);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return; // 숫자가 아니면 비교 불가 - 조용히 통과
    let ok = true;
    if (parsed.op === '<') ok = a < b;
    else if (parsed.op === '<=') ok = a <= b;
    else if (parsed.op === '>') ok = a > b;
    else if (parsed.op === '>=') ok = a >= b;
    if (!ok) violations.push(`${row.name || row.id}(${a})는 ${target.name || target.id}(${b})보다 ${parsed.op === '<' || parsed.op === '<=' ? '작아야' : '커야'} 합니다(인터락 위반).`);
  });
  return violations;
}

async function configModeSave() {
  const rows = window.gmsConfigModeGrid.getAllRows();
  const violations = configModeValidateInterlocks(rows);
  if (violations.length > 0) {
    toast(`저장 실패 - ${violations[0]}${violations.length > 1 ? ` 외 ${violations.length - 1}건` : ''}`, 'err');
    return;
  }
  try {
    const res = await fetch('/api/gms/sub-sequence-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || '저장 실패');
    await window.gmsConfigModeGrid.refresh();
    configModeHideKeypad();
    toast(`설정값 ${data.count}개 저장했습니다`, 'ok');
  } catch (e) {
    toast('저장 실패: ' + e.message, 'err');
  }
}

function configModeUpdateColsButtons() {
  const n = window.gmsConfigModeGrid ? window.gmsConfigModeGrid.getColumnCount() : 1;
  ['1', '2', '3', '4'].forEach((k) => {
    const btn = document.getElementById(`configModeCols${k}Btn`);
    if (btn) btn.classList.toggle('primary', Number(k) === n);
  });
}

/** 설정모드 B 화면에서만 "A값 전체 복사" 버튼을 보여준다(요청사항 - A 화면에는 복사할 대상이
    없으므로). */
function configModeUpdateCopyBtnVisibility() {
  const btn = document.getElementById('configModeCopyBtn');
  if (!btn || !window.gmsConfigModeGrid) return;
  btn.style.display = window.gmsConfigModeGrid.getSide() === 'B' ? '' : 'none';
}

/** Operation.js의 showProgressConfigMode가 화면을 보여줄 때마다 호출한다(그리드 마운트와는
    별개로, 이 파일의 버튼/키패드 wiring은 한 번만 하면 된다 - dataset.wired 가드). */
window.wireGmsConfigModeKeypad = function wireGmsConfigModeKeypad() {
  const saveBtn = document.getElementById('configModeSaveBtn');
  if (!saveBtn || saveBtn.dataset.wired) {
    configModeUpdateColsButtons();
    configModeUpdateCopyBtnVisibility();
    return;
  }
  saveBtn.dataset.wired = '1';
  saveBtn.addEventListener('click', configModeSave);

  // 그리드 세로 폭(높이) 마우스 드래그 조절 - 작업이력/USER 탭과 동일한 공용 헬퍼(gms.js).
  // 열 폭/행 높이(Univer 내부)는 위젯이 이미 처리하지만, 그리드 컨테이너 자체의 높이는
  // 이 화면엔 없던 조절 수단이라 요청에 따라 추가한다.
  if (typeof initGridHeightResizer === 'function') {
    initGridHeightResizer({
      splitterId: 'gmsConfigModeGridResizeHandle',
      boxId: 'gmsConfigModeGridContainer',
      storageKey: 'gmsConfigModeGridHeight',
    });
  }

  document.querySelectorAll('.config-mode-keypad .keypad-btn, .config-mode-nav-pad .keypad-btn').forEach((btn) => {
    btn.addEventListener('click', () => configModeHandleKey(btn.dataset.key));
  });

  // 물리 키보드 지원(gms-pt-calibration.js와 동일한 패턴) - 편집 중인 칸이 있을 때만.
  document.addEventListener('keydown', (e) => {
    if (!configModeEditingId) return;
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); configModeHandleKey(e.key); return; }
    const KEY_MAP = {
      Backspace: 'bs', Delete: 'clear', Enter: 'enter', Escape: 'esc',
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      '-': '-', '.': '.',
    };
    if (KEY_MAP[e.key]) { e.preventDefault(); configModeHandleKey(KEY_MAP[e.key]); }
  });

  document.getElementById('configModeCopyBtn')?.addEventListener('click', () => {
    const count = window.gmsConfigModeGrid.copyFromOppositeSide();
    toast(`${count}개 값을 복사했습니다(저장 전 - 확인 후 "저장"을 누르세요)`, count > 0 ? 'ok' : '');
  });

  ['1', '2', '3', '4'].forEach((k) => {
    document.getElementById(`configModeCols${k}Btn`)?.addEventListener('click', () => {
      window.gmsConfigModeGrid.setColumnCount(Number(k));
      configModeHideKeypad();
      configModeUpdateColsButtons();
    });
  });

  document.getElementById('configModeRefreshBtn')?.addEventListener('click', async () => {
    if (!confirm('편집 중인(저장 전) 내용을 버리고 서버에 저장된 값을 다시 불러올까요?')) return;
    await window.gmsConfigModeGrid.refresh();
    configModeHideKeypad();
    toast('설정값을 다시 불러왔습니다.', 'ok');
  });

  configModeUpdateColsButtons();
  configModeUpdateCopyBtnVisibility();
};
