'use strict';

/**
 * CONFIG 탭(gms.html 상단 탭 전환 바 "CONFIG.") - 서브시퀀스(자동진행) Step이 조건 판단에
 * 쓰는 설정값(예: 진공하한치)을 조작자가 직접 입력/수정하는 표. data/gmsSubSequenceConfig.json
 * ↔ /api/gms/sub-sequence-config에 그대로 저장된다. 이 탭 자체는 gms.html에 정적으로 있어서
 * (OPERATION HTML처럼 fetch로 늦게 주입되는 fragment가 아님) gms-pt-calibration.js와 달리
 * wireOnce 지연 없이 바로 로드 시점에 wiring한다. gms.js 다음에 로드해야 한다(toast를
 * 그대로 가져다 쓴다).
 *
 * row 구조: { id, group, name, value, unit, desc, side, min, max, interlock, option }. id는
 * 서브시퀀스 Step의 "비교문"이 참조할 안정적인 키(예: 'vacuumLowerLimit') - group/name/unit/desc는
 * 화면 표시용이라 자유롭게 바꿔도 되지만 id는 엔진이 참조하므로 신중하게 바꿔야 한다.
 *
 * side/min/max/interlock/option은 보조메뉴 "설정모드 A/B" 화면(gms-configmode-widget.js)이
 * 쓴다 - side는 A/B/공통 중 하나(어느 화면에 보일지), min/max는 그 화면 키패드의 입력 범위,
 * interlock은 "<연산자> <참조ID>"(예: "< hptUpperLimit", {side} 치환 가능) 형식으로 다른
 * 설정값과의 대소관계 제약, option은 OPTION 탭 토글 키(CONFIG_OPTION_LOOKUP 참고, gms.js) -
 * 비어있으면 항상 보인다. 이 5개 필드가 없어도(옛 데이터) 빈 문자열로 취급되어 정상 동작한다.
 */

let configRows = [];

function configRowHtml(row, index) {
  const field = (key, type = 'text') =>
    `<input type="${type}" data-idx="${index}" data-field="${key}" value="${String(row[key] == null ? '' : row[key]).replace(/"/g, '&quot;')}" />`;
  const sideValue = row.side || '';
  const sideSelect = `<select data-idx="${index}" data-field="side">
    <option value=""${sideValue === '' ? ' selected' : ''}>(미지정)</option>
    <option value="A"${sideValue === 'A' ? ' selected' : ''}>A</option>
    <option value="B"${sideValue === 'B' ? ' selected' : ''}>B</option>
    <option value="common"${sideValue === 'common' ? ' selected' : ''}>공통</option>
  </select>`;
  return `
    <tr>
      <td>${field('group')}</td>
      <td>${field('name')}</td>
      <td>${field('id')}</td>
      <td>${field('value')}</td>
      <td>${field('unit')}</td>
      <td>${field('desc')}</td>
      <td>${sideSelect}</td>
      <td>${field('min')}</td>
      <td>${field('max')}</td>
      <td>${field('interlock')}</td>
      <td>${field('option')}</td>
      <td><button type="button" class="config-row-delete" data-idx="${index}" title="이 행 삭제">✕</button></td>
    </tr>`;
}

function renderConfigTable() {
  const tbody = document.getElementById('gmsConfigTableBody');
  if (!tbody) return;
  tbody.innerHTML = configRows.map((row, i) => configRowHtml(row, i)).join('');
  tbody.querySelectorAll('input, select').forEach((input) => {
    const evt = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(evt, () => {
      const idx = Number(input.dataset.idx);
      const field = input.dataset.field;
      if (configRows[idx]) configRows[idx][field] = input.value;
    });
  });
  tbody.querySelectorAll('.config-row-delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      configRows.splice(idx, 1);
      renderConfigTable();
    });
  });
}

async function loadGmsSubSequenceConfigRows() {
  try {
    const res = await fetch('/api/gms/sub-sequence-config');
    const data = await res.json();
    if (data.ok && Array.isArray(data.rows)) {
      configRows = data.rows;
      window.configRows = configRows;
      window.gmsSubSequenceConfigRows = configRows;
      renderConfigTable();
    }
  } catch (e) {
    toast('CONFIG 값 불러오기 실패: ' + e.message, 'err');
  }
}

async function saveGmsSubSequenceConfigRows() {
  try {
    const res = await fetch('/api/gms/sub-sequence-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: configRows }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || '저장 실패');
    window.configRows = configRows;
    window.gmsSubSequenceConfigRows = configRows;
    if (window.updateSubSeqConfigRows) window.updateSubSeqConfigRows(configRows);
    toast(`CONFIG 값 ${data.count}개 저장했습니다`, 'ok');
  } catch (e) {
    toast('CONFIG 값 저장 실패: ' + e.message, 'err');
  }
}

document.getElementById('gmsConfigSaveBtn')?.addEventListener('click', saveGmsSubSequenceConfigRows);
document.getElementById('gmsConfigReloadBtn')?.addEventListener('click', loadGmsSubSequenceConfigRows);
document.getElementById('gmsConfigAddRowBtn')?.addEventListener('click', () => {
  configRows.push({ id: '', group: '', name: '', value: '', unit: '', desc: '', side: '', min: '', max: '', interlock: '', option: '' });
  renderConfigTable();
});

// 엑셀 내보내기 - 서버가 지금 저장돼 있는 값 그대로 내보낸다(화면에서 아직 "저장"을 안 누른
// 편집 중인 값은 반영 안 됨 - 먼저 저장을 누르고 내보내는 것을 권장).
document.getElementById('gmsConfigExcelExportBtn')?.addEventListener('click', () => {
  fetchAndSave(
    '/api/gms/sub-sequence-config/export/xlsx',
    { method: 'GET' },
    `GMS_CONFIG_${nowLocalFilenameStamp()}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
});
// 엑셀 불러오기 - 서버가 즉시 파일까지 저장하므로(요청사항: "행 추가하면 바로 엑셀시트에
// 반영해서 바로 프로그램에 반영") 여기서 따로 "저장"을 다시 누를 필요 없이 화면만 새로
// 그려서 반영한다.
document.getElementById('gmsConfigExcelImportBtn')?.addEventListener('click', () => {
  const input = document.getElementById('gmsConfigExcelImportFile');
  input.value = '';
  input.click();
});
document.getElementById('gmsConfigExcelImportFile')?.addEventListener('change', async () => {
  const input = document.getElementById('gmsConfigExcelImportFile');
  const file = input.files && input.files[0];
  if (!file) return;
  try {
    const fileBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const res = await fetch('/api/gms/sub-sequence-config/import/xlsx', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileBase64 }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || '불러오기 실패');
    configRows = data.rows;
    renderConfigTable();
    if (data.warnings && data.warnings.length > 0) {
      toast(`CONFIG ${data.rows.length}개 불러와 즉시 저장했습니다 - ${data.warnings.length}건 확인 필요: ${data.warnings[0]}`, 'err');
    } else {
      toast(`CONFIG ${data.rows.length}개를 엑셀에서 불러와 즉시 저장했습니다`, 'ok');
    }
  } catch (e) {
    toast('불러오기 실패: ' + e.message, 'err');
  }
});

loadGmsSubSequenceConfigRows();
window.reloadGmsSubSequenceConfig = loadGmsSubSequenceConfigRows;

// 마우스로 열 너비 조절(요청사항) - thead가 정적 마크업이라 한 번만 연결하면 된다(gms.js의
// 공용 함수 - gms-pt-calibration.js와 동일한 로직 재사용).
if (typeof initColumnResize === 'function') initColumnResize(document.getElementById('gmsConfigTable'));
