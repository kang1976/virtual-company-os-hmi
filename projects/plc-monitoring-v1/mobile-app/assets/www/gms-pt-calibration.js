'use strict';

/**
 * 압력조정(PT/Weight 아날로그 교정) 화면 - 조정모드 화면의 "압력조정" 버튼이
 * window.openPressureAdjustScreen(side)로 연다. gms.js가 이미 로드해둔 ptCalibrationRows를
 * 원본으로 삼고, 여기서는 작업용 사본(workingRows)만 건드린다("저장"을 눌러야 실제
 * gms.js의 상태 + 서버 파일(data/gmsPtCalibration.json)에 반영된다 - Main 시퀀스 편집기와
 * 동일한 패턴). gms.html에서 반드시 gms.js/Operation.js 다음에 로드해야 한다(toast,
 * showProgressScreen, showProgressAdjustMode, progressCurrentSide를 그대로 가져다 쓴다).
 *
 * "ANALOG VALUE1"은 아직 실제 PLC 아날로그 배선 전이라 사용자가 직접 입력하는 테스트값이다
 * (0~분해능 카운트, row.analogValue) - 분해능은 흔한 산업용 아날로그 모듈 비트수(11~16bit)별
 * 선택지 중 고른다. "ANALOG VALUE2"는 분해능+ANALOG VALUE1만으로 계산하는 읽기 전용
 * 계측기 환산값(4.00~20.00mA, 1.000~5.000V - 같은 0~100% 신호의 두 표현이라 함께 보여준다).
 * 현재값(공학단위 환산값) = rangeMin + (analogValue/resolution)*(maxValue-rangeMin) + offset,
 * rangeMin은 센서 타입별로 PT=-14.7(진공 가능 압력계), VT=0(Torr, 절대 진공계), Weight=0
 * (무게는 음수가 없음).
 */

const RESOLUTION_OPTIONS = [
  { max: 4000, label: '11bit (0~4,000)' },
  { max: 8000, label: '12bit (0~8,000)' },
  { max: 10000, label: '13bit (0~10,000)' },
  { max: 16000, label: '14bit (0~16,000)' },
  { max: 27648, label: '15bit (0~27,648, Siemens)' },
  { max: 32000, label: '15bit (0~32,000)' },
  { max: 32767, label: '16bit (0~32,767)' },
];

let workingRows = [];
let activeSide = 'A';
let activeTab = 1;
let editingCell = null; // { tag, field }
let keypadBuffer = '';

function rangeMinForType(type) {
  return type === 'PT' ? -14.7 : 0;
}
function unitForType(type) {
  return type === 'PT' ? 'Psi' : type === 'VT' ? 'Torr' : 'kg';
}
// gms.js의 ptDisplayDecimals()와 반드시 동일하게 유지한다(배관도/GMS TREND 등 다른 화면도
// 전부 이 규칙을 그대로 따라간다 - "추후 모든 data값에 해당 값으로 유지" 요청).
function decimalsForType(type) {
  return type === 'VT' ? 3 : 2;
}
function fieldLabel(field) {
  return field === 'maxValue' ? 'MAX값' : field === 'analogValue' ? 'ANALOG VALUE1' : 'OFFSET VALUE';
}
function analogPercent(row) {
  const resolution = Number(row.resolution) || 1;
  const analog = Number(row.analogValue) || 0;
  return Math.max(0, Math.min(1, analog / resolution));
}
function computeCurrentValue(row) {
  const rangeMin = rangeMinForType(row.type);
  const percent = analogPercent(row);
  const max = Number(row.maxValue) || 0;
  const offset = Number(row.offset) || 0;
  return rangeMin + percent * (max - rangeMin) + offset;
}
/** ANALOG VALUE2 - 분해능+ANALOG VALUE1(row.analogValue)만으로 계산하는 읽기 전용 계측기
    환산값. 4.00~20.00mA와 1.000~5.000V는 같은 0~100% 신호를 표현하는 두 방식이라 함께
    보여준다(타입 선택 불필요 - 산업 표준 전류루프 신호는 저항 하나로 서로 변환됨). */
function computeAnalog2(row) {
  const percent = analogPercent(row);
  const mA = 4.00 + percent * (20.00 - 4.00);
  const v = 1.000 + percent * (5.000 - 1.000);
  return `${mA.toFixed(2)} mA / ${v.toFixed(3)} V`;
}
function rowsForTab(side, tab) {
  return workingRows.filter((r) => {
    if (r.side !== side && r.side !== 'common') return false;
    // OPTION 탭에서 미적용 처리한 태그는 압력조정 표에도 안 보이게 한다(요청사항 - gms.js의
    // isAnalogTagEnabled를 그대로 가져다 쓴다).
    if (typeof isAnalogTagEnabled === 'function' && !isAnalogTagEnabled(r.tag)) return false;
    const isPtLike = r.type === 'PT' || r.type === 'VT' || r.type === 'Weight';
    return tab === 1 ? isPtLike : !isPtLike;
  });
}

function renderTabs() {
  const tab1 = document.getElementById('ptCalibTab1Btn');
  const tab2 = document.getElementById('ptCalibTab2Btn');
  tab1.textContent = `조정모드 ${activeSide}-1`;
  tab2.textContent = `조정모드 ${activeSide}-2`;
  tab1.classList.toggle('active', activeTab === 1);
  tab2.classList.toggle('active', activeTab === 2);
}

function renderResolutionSelect(row) {
  const options = RESOLUTION_OPTIONS.map(
    (o) => `<option value="${o.max}"${Number(row.resolution) === o.max ? ' selected' : ''}>${o.label}</option>`
  ).join('');
  return `<select class="pt-calib-resolution" data-tag="${row.tag}">${options}</select>`;
}

function renderTable() {
  const tbody = document.getElementById('ptCalibTableBody');
  const emptyMsg = document.getElementById('ptCalibEmptyMsg');
  const rows = rowsForTab(activeSide, activeTab);
  if (rows.length === 0) {
    tbody.innerHTML = '';
    emptyMsg.style.display = '';
    return;
  }
  emptyMsg.style.display = 'none';
  const isSelected = (tag, field) => editingCell && editingCell.tag === tag && editingCell.field === field ? ' selected' : '';
  tbody.innerHTML = rows.map((row) => {
    const unit = unitForType(row.type);
    const decimals = decimalsForType(row.type);
    const current = computeCurrentValue(row).toFixed(decimals);
    return `<tr>
      <td>${row.tag}</td>
      <td class="pt-calib-editable${isSelected(row.tag, 'maxValue')}" data-tag="${row.tag}" data-field="maxValue">${Number(row.maxValue).toFixed(decimals)} ${unit}</td>
      <td>${renderResolutionSelect(row)}</td>
      <td class="pt-calib-editable${isSelected(row.tag, 'analogValue')}" data-tag="${row.tag}" data-field="analogValue">${row.analogValue}</td>
      <td class="pt-calib-computed">${computeAnalog2(row)}</td>
      <td class="pt-calib-computed">${current} ${unit}</td>
      <td class="pt-calib-editable${isSelected(row.tag, 'offset')}" data-tag="${row.tag}" data-field="offset">${Number(row.offset).toFixed(decimals)} ${unit}</td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('.pt-calib-editable').forEach((td) => {
    td.addEventListener('click', () => openKeypadFor(td.dataset.tag, td.dataset.field));
  });
  tbody.querySelectorAll('.pt-calib-resolution').forEach((sel) => {
    sel.addEventListener('change', () => {
      const row = workingRows.find((r) => r.tag === sel.dataset.tag);
      row.resolution = Number(sel.value);
      renderTable();
    });
  });
}

function renderKeypadDisplay() {
  document.getElementById('ptCalibKeypadDisplay').textContent = keypadBuffer || '0';
}

function openKeypadFor(tag, field) {
  const row = workingRows.find((r) => r.tag === tag);
  if (!row) return;
  editingCell = { tag, field };
  keypadBuffer = String(row[field]);
  document.getElementById('ptCalibKeypadWrap').style.display = '';
  document.getElementById('ptCalibKeypadTitle').textContent = `${tag} - ${fieldLabel(field)} 편집`;
  renderKeypadDisplay();
  renderTable();
}

function hideKeypad() {
  editingCell = null;
  document.getElementById('ptCalibKeypadWrap').style.display = 'none';
}

function nudgeKeypadValue(dir) {
  const n = Number(keypadBuffer) || 0;
  keypadBuffer = String(n + dir);
  renderKeypadDisplay();
}

/** 키패드 버튼 클릭과 물리 키보드 입력이 공유하는 단일 처리 함수 - 어느 쪽으로 들어와도
    동작이 완전히 같아야 하므로 로직을 한 곳에 둔다. */
function handleKeypadKey(key) {
  if (!editingCell) return;
  if (key === 'esc') { hideKeypad(); renderTable(); return; }
  if (key === 'clear') { keypadBuffer = ''; renderKeypadDisplay(); return; }
  if (key === 'bs') { keypadBuffer = keypadBuffer.slice(0, -1); renderKeypadDisplay(); return; }
  if (key === 'enter') { commitKeypadValue(); return; }
  if (key === 'up') { nudgeKeypadValue(1); return; }
  if (key === 'down') { nudgeKeypadValue(-1); return; }
  if (key === '-') {
    keypadBuffer = keypadBuffer.startsWith('-') ? keypadBuffer.slice(1) : '-' + keypadBuffer;
    renderKeypadDisplay();
    return;
  }
  if (key === '.') {
    if (keypadBuffer.includes('.')) return;
    keypadBuffer += '.';
    renderKeypadDisplay();
    return;
  }
  if (/^[0-9]$/.test(key)) {
    keypadBuffer += key;
    renderKeypadDisplay();
  }
}

/** 지금 탭에 보이는 모든 행의 편집 가능한 칸을 표시 순서(행별 MAX값→ANALOG VALUE→OFFSET)
    대로 나열한다 - ENTER가 "다음 칸"을 찾을 때 쓴다. */
function editableFieldSequence() {
  const seq = [];
  rowsForTab(activeSide, activeTab).forEach((row) => {
    seq.push({ tag: row.tag, field: 'maxValue' });
    seq.push({ tag: row.tag, field: 'analogValue' });
    seq.push({ tag: row.tag, field: 'offset' });
  });
  return seq;
}

function commitKeypadValue() {
  const val = Number(keypadBuffer);
  if (keypadBuffer === '' || keypadBuffer === '-' || !Number.isFinite(val)) {
    toast('올바른 숫자를 입력하세요.', 'err');
    return;
  }
  const row = workingRows.find((r) => r.tag === editingCell.tag);
  row[editingCell.field] = val;

  // ENTER는 값을 저장한 뒤 키패드를 닫지 않고 다음 입력 칸으로 넘어가면서 버퍼를
  // 초기화한다(연속 입력 워크플로 - 칸마다 다시 클릭할 필요 없음). 마지막 칸이었으면
  // 그때 키패드를 닫는다.
  const seq = editableFieldSequence();
  const curIdx = seq.findIndex((s) => s.tag === editingCell.tag && s.field === editingCell.field);
  const next = curIdx !== -1 ? seq[curIdx + 1] : null;
  if (next) {
    editingCell = next;
    keypadBuffer = '';
    document.getElementById('ptCalibKeypadTitle').textContent = `${next.tag} - ${fieldLabel(next.field)} 편집`;
    renderKeypadDisplay();
    renderTable();
  } else {
    hideKeypad();
    renderTable();
  }
}

/** 표 헤더(th) 오른쪽 끝에 드래그 핸들을 붙여 마우스로 열 너비를 조절할 수 있게 한다.
    table-layout:fixed라 th 너비만 바꾸면 그 열의 td들도 함께 따라간다. thead는 매 렌더링마다
    다시 그리지 않는 정적 마크업이라 wireOncePtCalib()에서 한 번만 연결한다. */
function wireColumnResize() {
  const table = document.querySelector('.pt-calib-table');
  if (!table) return;
  table.querySelectorAll('thead th').forEach((th) => {
    const handle = document.createElement('span');
    handle.className = 'col-resize-handle';
    th.appendChild(handle);
    let startX = 0;
    let startWidth = 0;
    const onMouseMove = (e) => {
      th.style.width = `${Math.max(30, startWidth + (e.clientX - startX))}px`;
    };
    const onMouseUp = () => {
      handle.classList.remove('resizing');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startX = e.clientX;
      startWidth = th.offsetWidth;
      handle.classList.add('resizing');
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}

// ── 이 화면의 마크업(OPERATION HTML/압력조정.html)은 Operation.js의 loadOperationScreens()가
// 페이지 로드 후 fetch로 늦게 주입한다 - 이 스크립트가 로드되는 시점엔 아직 DOM에 없을 수
// 있으므로, gms-sequence-editor.js(정적 마크업)와 달리 top-level에서 바로 wiring하면 안
// 된다. 대신 openPressureAdjustScreen이 처음 호출될 때(=이미 주입 완료된 뒤) 한 번만
// wiring한다(gms.js 트렌드 기록 버튼의 dataset.wired 가드와 동일한 패턴). 함수 이름은 반드시
// 파일마다 고유해야 한다 - 이 프로젝트 화면 스크립트는 전부 classic <script>라 최상위 function
// 선언이 전역 스코프를 공유하는데, 예전에 gms-option-display.js도 똑같이 "wireOnce"를 써서
// 나중에 로드되는 그 파일의 정의가 이 함수를 조용히 덮어쓰는 바람에 압력조정 화면의
// 키패드/저장 버튼이 전혀 연결되지 않는 버그가 있었다(수정됨 - 이제 이름이 고유함). ──
function wireOncePtCalib() {
  const saveBtn = document.getElementById('ptCalibSaveBtn');
  if (!saveBtn || saveBtn.dataset.wired) return;
  saveBtn.dataset.wired = '1';

  wireColumnResize();

  document.querySelectorAll('.pt-calib-keypad .keypad-btn').forEach((btn) => {
    btn.addEventListener('click', () => handleKeypadKey(btn.dataset.key));
  });

  // 물리 키보드 지원 - 편집 중인 칸이 있을 때만(키패드가 열려 있을 때) 숫자/백스페이스/
  // Delete/Enter/Esc/화살표를 화면 키패드와 같은 동작으로 연결한다(로직은 handleKeypadKey
  // 하나로 공유 - 요청사항: "화면터치만 되는데 키보드 키패드도 함께 되었으면").
  document.addEventListener('keydown', (e) => {
    if (!editingCell) return;
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); handleKeypadKey(e.key); return; }
    const KEY_MAP = {
      Backspace: 'bs', Delete: 'clear', Enter: 'enter', Escape: 'esc',
      ArrowUp: 'up', ArrowDown: 'down', '-': '-', '.': '.',
    };
    if (KEY_MAP[e.key]) { e.preventDefault(); handleKeypadKey(KEY_MAP[e.key]); }
  });

  document.getElementById('ptCalibTab1Btn').addEventListener('click', () => {
    activeTab = 1; hideKeypad(); renderTabs(); renderTable();
  });
  document.getElementById('ptCalibTab2Btn').addEventListener('click', () => {
    activeTab = 2; hideKeypad(); renderTabs(); renderTable();
  });

  saveBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/gms/pt-calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: workingRows }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '저장 실패');
      ptCalibrationRows = workingRows;
      toast(`압력조정 저장 완료(${workingRows.length}개 센서)`, 'ok');
      showProgressAdjustMode(activeSide);
    } catch (e) {
      toast('압력조정 저장 실패: ' + e.message, 'err');
    }
  });

  document.getElementById('ptCalibCancelBtn').addEventListener('click', () => {
    showProgressAdjustMode(activeSide);
  });
}

/** gms.js의 WebSocket 핸들러가 ptCalibrationRows를 새로 받았을 때 호출한다(서버 저장/자동
    ZERO 반영이 다른 경로에서 일어나도 새로고침 없이 이 화면이 최신 값을 보여주도록). 압력조정
    화면이 지금 열려 있을 때만 workingRows를 다시 채운다 - 화면이 안 열려 있으면
    openPressureAdjustScreen이 다음에 열 때 어차피 최신 ptCalibrationRows를 복사해가므로 할 일이
    없고, 편집 중인 셀(editingCell)이 있으면 조작자가 지금 손으로 입력 중인 값을 덮어쓰지
    않도록 건너뛴다. */
window.refreshPressureAdjustScreen = function refreshPressureAdjustScreen() {
  if (typeof progressPressureAdjustBody === 'undefined' || !progressPressureAdjustBody) return;
  if (progressPressureAdjustBody.style.display === 'none') return;
  if (editingCell) return;
  workingRows = ptCalibrationRows.map((r) => ({ ...r }));
  renderTable();
};

window.openPressureAdjustScreen = function openPressureAdjustScreen(side) {
  activeSide = side || 'A';
  workingRows = ptCalibrationRows.map((r) => ({ ...r }));
  activeTab = 1;
  editingCell = null;
  keypadBuffer = '';
  wireOncePtCalib();
  hideKeypad();
  renderTabs();
  renderTable();
  showProgressScreen('pressureAdjust', `[${activeSide}] 압력조정`);
};
