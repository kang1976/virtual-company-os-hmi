'use strict';

/**
 * 헤더의 CPU 정보(#cpuInfo)를 클릭하면 PLC 세부 정보 팝업을 연다.
 * 자체적으로 스타일과 모달 DOM을 주입하므로 각 페이지 HTML은 <script src="plcInfo.js"> 한 줄과
 * (선택) window.__plcApiPrefix 설정만 있으면 된다.
 *  - 메인 화면:  prefix '' (→ /api/plc/...)
 *  - 그리드 화면: prefix '/api/grid'
 *  - 트렌드 화면: prefix '/api/trend'
 * CJ(FINS)는 상태/시계/운전모드/메모리까지, NX(CIP)는 기본 정보만 표시한다.
 */
(function () {
  var PREFIX = window.__plcApiPrefix || '';

  function injectStyle() {
    if (document.getElementById('__plcInfoStyle')) return;
    var css =
      '#cpuInfo.pi-clickable{cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px;}' +
      '#cpuInfo.pi-clickable:hover{color:var(--accent);}' +
      '.pi-modal{position:fixed;inset:0;z-index:4500;display:none;align-items:center;justify-content:center;}' +
      '.pi-modal.show{display:flex;}' +
      '.pi-backdrop{position:absolute;inset:0;background:rgba(0,0,0,0.5);}' +
      '.pi-box{position:relative;width:min(760px,94vw);max-height:88vh;display:flex;flex-direction:column;background:var(--panel);border:1px solid var(--panel-border);border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,0.45);overflow:hidden;}' +
      '.pi-head{flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;padding:13px 18px;border-bottom:1px solid var(--panel-border);font-weight:700;font-size:15px;background:var(--panel);}' +
      '.pi-head button{background:var(--input-bg);border:1px solid var(--panel-border);color:var(--text);border-radius:4px;padding:4px 9px;cursor:pointer;font-size:14px;}' +
      '.pi-body{flex:1 1 auto;overflow-y:auto;padding:6px 18px 18px;font-size:14px;color:var(--text);}' +
      '.pi-warn{background:var(--warn-bg);color:var(--warn-text);border:1px solid var(--warn);border-radius:6px;padding:7px 12px;font-size:12.5px;margin:10px 0;line-height:1.5;}' +
      '.pi-sec{margin:16px 0 6px;font-size:13px;font-weight:700;color:var(--accent);border-bottom:1px solid var(--panel-border);padding-bottom:4px;}' +
      '.pi-grid{display:grid;grid-template-columns:150px 1fr;gap:5px 12px;font-size:13.5px;}' +
      '.pi-grid .k{color:var(--muted);}' +
      '.pi-grid .v{font-family:var(--mono);word-break:break-all;}' +
      '.pi-badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;border:1px solid var(--panel-border);}' +
      '.pi-badge.run{background:var(--accent-dim);color:var(--primary-text);border-color:var(--accent);}' +
      '.pi-badge.prog{background:var(--warn-bg);color:var(--warn-text);border-color:var(--warn);}' +
      '.pi-badge.err{background:var(--danger-bg);color:var(--danger-text);border-color:var(--error);}' +
      '.pi-btnrow{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0;}' +
      '.pi-btn{padding:6px 14px;border-radius:4px;border:1px solid var(--panel-border);background:var(--input-bg);color:var(--text);cursor:pointer;font-size:13px;}' +
      '.pi-btn:hover:not(:disabled){border-color:var(--accent);}' +
      '.pi-btn:disabled{opacity:0.45;cursor:not-allowed;}' +
      '.pi-btn.primary{background:var(--accent-dim);border-color:var(--accent);color:var(--primary-text);font-weight:600;}' +
      '.pi-btn.danger{background:var(--danger-bg);border-color:var(--error);color:var(--danger-text);}' +
      '.pi-btn.cur{outline:2px solid var(--accent);}' +
      '.pi-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0;}' +
      '.pi-row input{background:var(--input-bg);border:1px solid var(--panel-border);color:var(--text);border-radius:4px;padding:5px 8px;font-size:13px;font-family:var(--mono);}' +
      '.pi-table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px;}' +
      '.pi-table th,.pi-table td{border:1px solid var(--panel-border);padding:3px 7px;text-align:left;white-space:nowrap;}' +
      '.pi-table th{background:var(--bg-alt);color:var(--muted);}' +
      '.pi-msg{font-size:12.5px;margin-top:8px;min-height:16px;}' +
      '.pi-msg.ok{color:var(--accent);}.pi-msg.bad{color:var(--error);}' +
      '.pi-muted{color:var(--muted);font-size:12.5px;}' +
      '.pi-bars{margin:10px 0 4px;}' +
      '.pi-bar-row{display:flex;align-items:center;gap:8px;margin:5px 0;font-size:12.5px;}' +
      '.pi-bar-label{flex:0 0 100px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.pi-bar-track{flex:1 1 auto;height:15px;background:var(--bg-alt);border:1px solid var(--panel-border);border-radius:3px;overflow:hidden;}' +
      '.pi-bar-fill{height:100%;background:var(--accent);border-radius:2px 0 0 2px;min-width:2px;}' +
      '.pi-bar-fill.em{background:var(--send-tag);}' +
      '.pi-bar-val{flex:0 0 150px;text-align:right;font-family:var(--mono);color:var(--text);white-space:nowrap;}';
    var s = document.createElement('style');
    s.id = '__plcInfoStyle';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function buildModal() {
    if (document.getElementById('__plcInfoModal')) return;
    var m = document.createElement('div');
    m.id = '__plcInfoModal';
    m.className = 'pi-modal';
    m.innerHTML =
      '<div class="pi-backdrop"></div>' +
      '<div class="pi-box">' +
      '  <div class="pi-head"><span>🖥 PLC 세부 정보</span><span><button id="piRefresh" title="새로고침">↻</button> <button id="piClose">✕</button></span></div>' +
      '  <div class="pi-body" id="piBody"></div>' +
      '</div>';
    document.body.appendChild(m);
    m.querySelector('.pi-backdrop').addEventListener('click', close);
    m.querySelector('#piClose').addEventListener('click', close);
    m.querySelector('#piRefresh').addEventListener('click', load);
  }

  function open() { buildModal(); document.getElementById('__plcInfoModal').classList.add('show'); load(); }
  function close() { var m = document.getElementById('__plcInfoModal'); if (m) m.classList.remove('show'); }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  function load() {
    var body = document.getElementById('piBody');
    body.innerHTML = '<p class="pi-muted">불러오는 중…</p>';
    var url = (PREFIX || '/api') + '/plc/details';
    fetch(url)
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (res) {
        if (!res.j || !res.j.ok) {
          body.innerHTML = '<p class="pi-warn">' + esc((res.j && res.j.error) || 'PLC 정보를 불러올 수 없습니다.') + '</p>';
          return;
        }
        render(res.j);
      })
      .catch(function (e) { body.innerHTML = '<p class="pi-warn">요청 실패: ' + esc(e.message) + '</p>'; });
  }

  function kv(rows) {
    return '<div class="pi-grid">' + rows.map(function (r) {
      return '<div class="k">' + esc(r[0]) + '</div><div class="v">' + (r[2] ? r[1] : esc(r[1])) + '</div>';
    }).join('') + '</div>';
  }

  // areas: [{ key, label, value, unit, group }] - 각 영역의 "용량"을 가로 막대로 상대 비교(최댓값=100%).
  // group === 'em' 인 항목(EM0~EMn)은 다른 색으로 묶어서 표시한다.
  function barChart(areas) {
    var max = areas.reduce(function (m, a) { return Math.max(m, a.value); }, 1);
    return '<div class="pi-bars">' + areas.map(function (a) {
      var pct = Math.max(0, Math.min(100, (a.value / max) * 100));
      var pctText = pct >= 10 ? pct.toFixed(0) : pct.toFixed(1);
      return '<div class="pi-bar-row">' +
        '<div class="pi-bar-label" title="' + esc(a.label) + '">' + esc(a.label) + '</div>' +
        '<div class="pi-bar-track"><div class="pi-bar-fill' + (a.group === 'em' ? ' em' : '') + '" style="width:' + pct.toFixed(1) + '%"></div></div>' +
        '<div class="pi-bar-val">' + esc(a.value.toLocaleString()) + ' ' + esc(a.unit) + ' (' + pctText + '%)</div>' +
        '</div>';
    }).join('') + '</div>';
  }

  function render(d) {
    var body = document.getElementById('piBody');
    var ci = d.controllerInfo || {};
    var conn = d.connection || {};
    var connText = conn.type + (conn.params && conn.params.host ? ' (' + conn.params.host + (conn.params.port ? ':' + conn.params.port : '') + ')' : '');

    // NX: 기본 정보만
    if (d.supported === false) {
      body.innerHTML =
        '<div class="pi-sec">CPU 및 시스템 정보</div>' +
        kv([['모델명', (d.controller && d.controller.model) || ci.model || '—'], ['버전', (d.controller && d.controller.version) || ci.version || '—'], ['연결', connText]]) +
        '<div class="pi-warn">NX/NJ 시리즈(EtherNet/IP)는 이 세부 정보(운전 상태·시계·운전 모드·메모리)를 FINS 명령으로 조회할 수 없어 CJ 시리즈에서만 지원됩니다.</div>';
      return;
    }

    var c = d.controller || {};
    var st = d.status || {};
    var clk = d.clock;
    var mem = c.memory || {};

    var html = '';
    html += '<div class="pi-warn">⚠️ 아래 항목 중 운전 상태·시계·운전 모드·메모리 조회와 <b>운전 모드 변경/시계 설정</b>은 실기로 검증되지 않은 FINS 명령을 사용합니다. 변경 기능은 영향 없는 환경에서 먼저 확인하세요.</div>';

    // 1. CPU 및 시스템 정보
    html += '<div class="pi-sec">CPU 및 시스템 정보</div>';
    html += kv([
      ['CPU 모델명', c.model || ci.model || '—'],
      ['내부 시스템 버전', c.version || ci.version || '—'],
      ['연결 방식', connText],
    ]);

    // 2. 운전 상태 및 통신 유닛/에러 상태
    var stateBadge = st.mode === 4 ? '<span class="pi-badge run">' + esc(st.modeText) + '</span>'
      : st.mode === 0 ? '<span class="pi-badge prog">' + esc(st.modeText) + '</span>'
      : '<span class="pi-badge">' + esc(st.modeText || '—') + '</span>';
    html += '<div class="pi-sec">운전 상태 · 에러 상태</div>';
    html += kv([
      ['운전 상태', esc(st.runText || '—')],
      ['운전 모드', stateBadge, true],
      ['치명적 에러', (st.hasFatal ? '<span class="pi-badge err">있음 ' + esc(st.fatalHex) + '</span>' : '<span class="pi-muted">없음</span>'), true],
      ['비치명 에러', (st.hasNonFatal ? '<span class="pi-badge err">있음 ' + esc(st.nonFatalHex) + '</span>' : '<span class="pi-muted">없음</span>'), true],
      ['FAL/FALS 코드', st.falCode ? ('0x' + st.falCode.toString(16).padStart(4, '0') + (st.falText ? ' — ' + esc(st.falText) : '')) : '없음'],
      ['등록 에러 메시지', st.errorMessage ? esc(st.errorMessage) : '없음'],
    ]);

    // 3. 운전 모드 변경
    html += '<div class="pi-sec">운전 모드 변경</div>';
    html += '<div class="pi-btnrow">' +
      '<button class="pi-btn primary' + (st.mode === 4 ? ' cur' : '') + '" data-mode="RUN">RUN</button>' +
      '<button class="pi-btn' + (st.mode === 2 ? ' cur' : '') + '" data-mode="MONITOR">MONITOR</button>' +
      '<button class="pi-btn danger' + (st.mode === 0 ? ' cur' : '') + '" data-mode="PROGRAM">PROGRAM(정지)</button>' +
      '</div><div class="pi-msg" id="piModeMsg"></div>';

    // 4. 시계
    html += '<div class="pi-sec">시계(RTC)</div>';
    if (clk) {
      html += kv([['PLC 현재 시각', esc(clk.text) + (clk.dayOfWeekText ? ' (' + clk.dayOfWeekText + ')' : '')]]);
      var dtLocal = pad4(clk.year) + '-' + pad2(clk.month) + '-' + pad2(clk.day) + 'T' + pad2(clk.hour) + ':' + pad2(clk.minute) + ':' + pad2(clk.second);
      html += '<div class="pi-row">' +
        '<input type="datetime-local" id="piClockInput" step="1" value="' + dtLocal + '" />' +
        '<button class="pi-btn" id="piClockSet">이 시각으로 설정</button>' +
        '<button class="pi-btn" id="piClockPc">PC 시각으로 설정</button>' +
        '</div><div class="pi-msg" id="piClockMsg"></div>';
    } else {
      html += '<p class="pi-muted">이 CPU에서는 시계 정보를 읽지 못했습니다.</p>';
    }

    // 5. 프로그램 메모리 · 메모리 영역
    html += '<div class="pi-sec">프로그램 메모리 상태</div>';
    if (mem.programCapacitySteps || mem.dmWords || mem.iomSizeK) {
      html += kv([
        ['프로그램 용량 (공식 스펙)', mem.programCapacitySteps ? mem.programCapacitySteps.toLocaleString() + ' steps' : '이 모델은 스펙표에 없어 확인할 수 없습니다'],
        ['DM 워드 수', mem.dmWords != null ? String(mem.dmWords) : '—'],
        ['IOM 크기', mem.iomSizeK ? mem.iomSizeK + ' K bytes' : '—'],
        ['타이머/카운터', mem.timerCounterCount ? mem.timerCounterCount + '개' : '—'],
        ['확장 DM(EM) 뱅크 수', mem.expansionDmBanks != null ? mem.expansionDmBanks + '뱅크' + (mem.emBanksMismatch ? ' ⚠️(화면 목록상 ' + mem.emBanksFromTable + '뱅크와 다름)' : '') : (mem.emBanksFromTable != null ? mem.emBanksFromTable + '뱅크 (모델명 기준 추정)' : '—')],
      ]);
      if (mem.programCapacitySteps) {
        html += '<p class="pi-muted">"프로그램 용량"은 PLC 응답이 아니라 Omron 공식 스펙 페이지(모델명 기준)에서 가져온 값입니다. FINS 응답에도 관련 필드가 있지만 실측값과 배율이 맞지 않아(예: CPU65 raw값 200 vs 실제 100,000steps) 신뢰할 수 없다고 판단해 사용하지 않았습니다.</p>';
      }
    } else {
      html += '<p class="pi-muted">이 CPU 응답에는 프로그램/DM 메모리 영역 정보가 포함되어 있지 않습니다.</p>';
    }
    // CIO/W/H는 FINS 응답이 아니라 CS/CJ 시리즈 공통 고정 규격값(memoryAreas.js)이라 별도로 표시한다.
    html += '<div class="pi-sec">기타 메모리 영역 (CS/CJ 공통 고정 규격)</div>';
    html += kv([
      ['CIO 영역', (mem.cioWords || 6144) + ' 워드'],
      ['W(Work) 영역', (mem.workWords || 512) + ' 워드'],
      ['H(Holding) 영역', (mem.holdingWords || 512) + ' 워드'],
    ]);
    html += '<p class="pi-muted">CIO/W/H 영역 크기는 PLC 응답이 아니라 Omron CS/CJ 시리즈 공통 규격값입니다. 실제 화면 브라우징 가능한 영역·범위는 상단 메모리 영역 탭에서 CPU 모델에 맞춰 자동으로 조정됩니다.</p>';

    // 5-1. 영역별 용량 비교 (가로 막대그래프) - EM은 EM0~EMn 개별로 표시
    if (mem.areas && mem.areas.length) {
      html += '<div class="pi-sec">영역별 용량 비교</div>';
      html += barChart(mem.areas);
      html += '<p class="pi-muted">⚠️ 이 그래프는 각 영역의 "최대 용량"을 비교한 것이며 <b>실제 사용 중인 비율(사용률)이 아닙니다</b> — D/W/H/CIO/EM 같은 데이터 영역은 CPU가 실사용률을 추적하지 않아(래더 프로그램을 분석해야 알 수 있음) 이 앱에서는 제공하지 않습니다. 또한 단위가 서로 달라(스텝/워드/바이트/개수) 막대 길이는 정확한 동일 단위 비교가 아니라 참고용 상대 비교입니다.</p>';
    }

    // 6. 최근 에러 로그
    if (d.errorLog && d.errorLog.records && d.errorLog.records.length) {
      html += '<div class="pi-sec">최근 에러 로그 (' + d.errorLog.currentCount + '개 중 ' + d.errorLog.records.length + '개)</div>';
      html += '<table class="pi-table"><tr><th>시각</th><th>코드</th><th>설명</th></tr>' +
        d.errorLog.records.map(function (r) {
          return '<tr><td>' + esc(r.time) + '</td><td>0x' + r.code.toString(16).padStart(4, '0') + '</td><td>' + esc(r.description) + '</td></tr>';
        }).join('') + '</table>';
    } else if (d.errorLog) {
      html += '<div class="pi-sec">최근 에러 로그</div><p class="pi-muted">기록된 에러가 없습니다.</p>';
    }

    body.innerHTML = html;
    wireActions();
  }

  function pad2(n) { return String(n).padStart(2, '0'); }
  function pad4(n) { return String(n).padStart(4, '0'); }

  function wireActions() {
    var body = document.getElementById('piBody');
    // 운전 모드 변경
    body.querySelectorAll('[data-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var mode = btn.dataset.mode;
        var warn = mode === 'PROGRAM'
          ? 'PROGRAM 모드로 바꾸면 PLC 프로그램이 정지합니다. 설비가 멈출 수 있습니다.\n정말 진행할까요?'
          : (mode + ' 모드로 변경합니다. 진행할까요?');
        if (!confirm('⚠️ 운전 모드 변경\n\n' + warn)) return;
        setMsg('piModeMsg', '변경 요청 중…', '');
        setDisabledAll(true);
        fetch((PREFIX || '/api') + '/plc/mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: mode }) })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            setDisabledAll(false);
            if (!res.ok) { setMsg('piModeMsg', '실패: ' + res.error, 'bad'); return; }
            setMsg('piModeMsg', '운전 모드가 변경되었습니다.', 'ok');
            setTimeout(load, 400);
          })
          .catch(function (e) { setDisabledAll(false); setMsg('piModeMsg', '실패: ' + e.message, 'bad'); });
      });
    });

    // 시계 설정 (수동)
    var setBtn = document.getElementById('piClockSet');
    if (setBtn) setBtn.addEventListener('click', function () {
      var val = document.getElementById('piClockInput').value; // yyyy-MM-ddThh:mm:ss
      if (!val) { setMsg('piClockMsg', '시각을 입력하세요.', 'bad'); return; }
      var d = new Date(val);
      if (isNaN(d.getTime())) { setMsg('piClockMsg', '시각 형식이 올바르지 않습니다.', 'bad'); return; }
      if (!confirm('⚠️ PLC 시계 설정\n\n' + val.replace('T', ' ') + ' 으로 PLC 시계를 변경합니다. 진행할까요?')) return;
      postClock({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds() });
    });
    var pcBtn = document.getElementById('piClockPc');
    if (pcBtn) pcBtn.addEventListener('click', function () {
      if (!confirm('⚠️ PLC 시계 설정\n\nPC 현재 시각으로 PLC 시계를 맞춥니다. 진행할까요?')) return;
      postClock({ fromPc: true });
    });
  }

  function postClock(payload) {
    setMsg('piClockMsg', '설정 중…', '');
    setDisabledAll(true);
    fetch((PREFIX || '/api') + '/plc/clock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        setDisabledAll(false);
        if (!res.ok) { setMsg('piClockMsg', '실패: ' + res.error, 'bad'); return; }
        setMsg('piClockMsg', 'PLC 시계가 설정되었습니다: ' + (res.clock ? res.clock.text : ''), 'ok');
        setTimeout(load, 400);
      })
      .catch(function (e) { setDisabledAll(false); setMsg('piClockMsg', '실패: ' + e.message, 'bad'); });
  }

  function setMsg(id, text, cls) { var el = document.getElementById(id); if (el) { el.textContent = text; el.className = 'pi-msg ' + (cls || ''); } }
  function setDisabledAll(v) { document.querySelectorAll('#piBody .pi-btn').forEach(function (b) { b.disabled = v; }); }

  function wireCpuInfo() {
    var el = document.getElementById('cpuInfo');
    if (!el || el.__piWired) return;
    el.__piWired = true;
    el.classList.add('pi-clickable');
    el.title = '클릭하면 PLC 세부 정보를 봅니다';
    el.addEventListener('click', open);
  }

  function init() {
    injectStyle();
    wireCpuInfo();
    // cpuInfo가 나중에 렌더되는 경우(그리드 등) 대비해 잠깐 재시도
    var tries = 0;
    var t = setInterval(function () { wireCpuInfo(); if (++tries > 20 || (document.getElementById('cpuInfo') && document.getElementById('cpuInfo').__piWired)) clearInterval(t); }, 300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
