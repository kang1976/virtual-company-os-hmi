// ============================================================
// app.js — P&ID HMI 인터랙티브 실시간 제어 & 네온 플라즈마 가스 유동
// ============================================================

const WS_URL = window.location.protocol === 'http:' || window.location.protocol === 'https:'
  ? `ws://${window.location.host}/pid`
  : 'ws://localhost:3005/pid';

let ws = null;
let mockMode = true;
let mockInterval = null;
let simRunning = false;
let scaleRatio = 1;

// ── 배관 중심축 기준 가스 유동 세그먼트 (기준: 1128 x 1264 px) ──
// A-side 메인 x=404, B-side 메인 x=816
const TUBE_SEGMENTS = [
  // A-Side 메인 가스 배관 구간 (x = 404)
  { seg: 'A_SEG_1', id: 'a_seg1', d: 'M 463 899 L 425 899 Q 404 899 404 875 L 404 678' }, // AG 토출구 -> HPI 하단
  { seg: 'A_SEG_2', id: 'a_seg2', d: 'M 404 678 L 404 537' },                               // HPI -> MPT
  { seg: 'A_SEG_3', id: 'a_seg3', d: 'M 404 537 L 404 338' },                               // MPT -> LPI
  { seg: 'A_SEG_4', id: 'a_seg4', d: 'M 404 338 L 404 284' },                               // LPI -> FPV
  { seg: 'A_SEG_5', id: 'a_seg5', d: 'M 404 284 L 404 45' },                                // FPV -> Process Outlet

  // B-Side 메인 가스 배관 구간 (x = 816)
  { seg: 'B_SEG_1', id: 'b_seg1', d: 'M 865 899 L 838 899 Q 816 899 816 875 L 816 678' }, // AG 토출구 -> HPI 하단
  { seg: 'B_SEG_2', id: 'b_seg2', d: 'M 816 678 L 816 537' },                               // HPI -> MPT
  { seg: 'B_SEG_3', id: 'b_seg3', d: 'M 816 537 L 816 338' },                               // MPT -> LPI
  { seg: 'B_SEG_4', id: 'b_seg4', d: 'M 816 338 L 816 284' },                               // LPI -> FPV
  { seg: 'B_SEG_5', id: 'b_seg5', d: 'M 816 284 L 816 45' },                                // FPV -> Process Outlet

  // VENT 배관 구간 (화이트 플라즈마 유동)
  { seg: 'VENT_A_HPV', id: 'vent_a_hpv', isVent: true, d: 'M 404 645 L 248 645 L 248 372' },
  { seg: 'VENT_A_LPV', id: 'vent_a_lpv', isVent: true, d: 'M 404 372 L 248 372 L 248 195' },
  { seg: 'VENT_HDR_A', id: 'vent_hdr_a', isVent: true, d: 'M 248 195 L 160 195' },
  { seg: 'VENT_GNV',   id: 'vent_gnv',   isVent: true, d: 'M 160 195 L 70 195 L 70 30' },
  { seg: 'VENT_PNV',   id: 'vent_pnv',   isVent: true, d: 'M 70 195 L 70 30' },
  { seg: 'VENT_PUMP',  id: 'vent_pump',  isVent: true, d: 'M 28 195 L 28 30' },
  { seg: 'VENT_CAL',   id: 'vent_cal',   isVent: true, d: 'M 404 195 L 610 195 L 610 30' },
  { seg: 'VENT_B_LPV', id: 'vent_b_lpv', isVent: true, d: 'M 816 372 L 874 372 L 874 195' },
  { seg: 'VENT_B_HPV', id: 'vent_b_hpv', isVent: true, d: 'M 816 645 L 874 645 L 874 195' },
  { seg: 'VENT_HDR_B', id: 'vent_hdr_b', isVent: true, d: 'M 874 195 L 610 195' },
];

// ── DOM 초기화 ──────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const bgImg = document.getElementById('pid-bg');
  
  if (bgImg.complete && bgImg.naturalWidth > 0) {
    initApp();
  } else {
    bgImg.onload = initApp;
  }
});

function initApp() {
  buildPipeSvg();
  buildOverlays();
  updateScale();
  updatePipeFlows();
  window.addEventListener('resize', updateScale);
  setInterval(updateClock, 1000);
  updateClock();
  tryWebSocket();
}

// ── SVG 가스 유동 레이어 빌드 (네온 글로우 + 펄스 애니메이션 + 코어) ──
function buildPipeSvg() {
  const svg = document.getElementById('pipe-layer');
  if (!svg) return;
  svg.innerHTML = '';

  TUBE_SEGMENTS.forEach((w) => {
    const glowClass = w.isVent ? 'vent-glow' : 'gas-glow';
    const flowClass = w.isVent ? 'vent-flow' : 'gas-flow';
    const coreClass = w.isVent ? 'vent-core' : 'gas-core';

    // 1. 가스 외곽 네온 플라즈마 글로우
    const pGlow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pGlow.setAttribute('d', w.d);
    pGlow.setAttribute('id', `glow-${w.id}`);
    pGlow.setAttribute('class', `${glowClass} ${w.seg}`);
    svg.appendChild(pGlow);

    // 2. 가스 상향 유동 펄스선 (연속 이동)
    const pFlow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pFlow.setAttribute('d', w.d);
    pFlow.setAttribute('id', `flow-${w.id}`);
    pFlow.setAttribute('class', `${flowClass} ${w.seg}`);
    svg.appendChild(pFlow);

    // 3. 가스 중심 화이트 플라즈마 코어
    const pCore = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pCore.setAttribute('d', w.d);
    pCore.setAttribute('id', `core-${w.id}`);
    pCore.setAttribute('class', `${coreClass} ${w.seg}`);
    svg.appendChild(pCore);
  });
}

// ── 밸브 상태에 따른 배관 가스 유동/가압 상태 실시간 계산 ───
function updatePipeFlows() {
  // A-Side 가스 흐름 계산
  const a_ag  = TAGS.A_AG  ? TAGS.A_AG.value  : true;
  const a_hpi = TAGS.A_HPI ? TAGS.A_HPI.value : false;
  const a_lpi = TAGS.A_LPI ? TAGS.A_LPI.value : false;
  const a_fpv = TAGS.A_FPV ? TAGS.A_FPV.value : false;

  const a_s1 = a_ag;
  const a_s2 = a_s1 && a_hpi;
  const a_s3 = a_s2; // 레귤레이터는 상시 통과
  const a_s4 = a_s3 && a_lpi;
  const a_s5 = a_s4 && a_fpv;

  setSegmentState('A_SEG_1', a_s1);
  setSegmentState('A_SEG_2', a_s2);
  setSegmentState('A_SEG_3', a_s3);
  setSegmentState('A_SEG_4', a_s4);
  setSegmentState('A_SEG_5', a_s5);

  // B-Side 가스 흐름 계산
  const b_ag  = TAGS.B_AG  ? TAGS.B_AG.value  : true;
  const b_hpi = TAGS.B_HPI ? TAGS.B_HPI.value : false;
  const b_lpi = TAGS.B_LPI ? TAGS.B_LPI.value : false;
  const b_fpv = TAGS.B_FPV ? TAGS.B_FPV.value : false;

  const b_s1 = b_ag;
  const b_s2 = b_s1 && b_hpi;
  const b_s3 = b_s2;
  const b_s4 = b_s3 && b_lpi;
  const b_s5 = b_s4 && b_fpv;

  setSegmentState('B_SEG_1', b_s1);
  setSegmentState('B_SEG_2', b_s2);
  setSegmentState('B_SEG_3', b_s3);
  setSegmentState('B_SEG_4', b_s4);
  setSegmentState('B_SEG_5', b_s5);

  // VENT 가스 유동 계산 (화이트 플라즈마)
  const hpv_a = TAGS.HPV_A ? TAGS.HPV_A.value : false;
  const lpv_a = TAGS.LPV_A ? TAGS.LPV_A.value : false;
  const gnv   = TAGS.GNV   ? TAGS.GNV.value   : false;
  const pnv   = TAGS.PNV   ? TAGS.PNV.value   : false;
  const vn1   = TAGS.VN1   ? TAGS.VN1.value   : false;
  const vn2   = TAGS.VN2   ? TAGS.VN2.value   : false;
  const lpv_b = TAGS.LPV_B ? TAGS.LPV_B.value : false;
  const hpv_b = TAGS.HPV_B ? TAGS.HPV_B.value : false;

  const v_hpv_a = a_s2 && hpv_a;
  const v_lpv_a = a_s3 && lpv_a;
  const v_a_flow = v_hpv_a || v_lpv_a;

  const v_hpv_b = b_s2 && hpv_b;
  const v_lpv_b = b_s3 && lpv_b;
  const v_b_flow = v_hpv_b || v_lpv_b;

  const vent_hdr = (v_a_flow || v_b_flow);
  const vent_out = vent_hdr || gnv;
  const pump_out = vent_hdr && (vn1 || vn2);

  setSegmentState('VENT_A_HPV', v_hpv_a);
  setSegmentState('VENT_A_LPV', v_lpv_a);
  setSegmentState('VENT_HDR_A', vent_hdr);
  setSegmentState('VENT_GNV',   vent_out);
  setSegmentState('VENT_PNV',   pnv);
  setSegmentState('VENT_PUMP',  pump_out);
  setSegmentState('VENT_CAL',   vent_hdr);
  setSegmentState('VENT_B_LPV', v_lpv_b);
  setSegmentState('VENT_B_HPV', v_hpv_b);
  setSegmentState('VENT_HDR_B', v_b_flow);
}

function setSegmentState(segClass, isPressurized) {
  document.querySelectorAll(`.gas-glow.${segClass}, .vent-glow.${segClass}`).forEach(el => {
    el.classList.toggle('active', isPressurized);
  });
  document.querySelectorAll(`.gas-flow.${segClass}, .vent-flow.${segClass}`).forEach(el => {
    el.classList.toggle('active', isPressurized);
  });
  document.querySelectorAll(`.gas-core.${segClass}, .vent-core.${segClass}`).forEach(el => {
    el.classList.toggle('active', isPressurized);
  });
}

// ── 이미지 리사이즈 시 오버레이 위치/크기 자동 스케일링 ───
function updateScale() {
  const img = document.getElementById('pid-bg');
  if (!img || !img.naturalWidth) return;

  scaleRatio = img.clientWidth / img.naturalWidth;
  document.querySelectorAll('.overlay').forEach(el => {
    const baseX = parseFloat(el.dataset.bx);
    const baseY = parseFloat(el.dataset.by);
    el.style.left = (baseX * scaleRatio) + 'px';
    el.style.top  = (baseY * scaleRatio) + 'px';
    el.style.transform = `translate(-50%, -50%) scale(${scaleRatio})`;
  });
}

// ── 동적 오버레이 DOM 생성 ──────────────────────────────────
function buildOverlays() {
  const container = document.getElementById('pid-container');
  container.querySelectorAll('.overlay').forEach(el => el.remove());

  Object.entries(TAGS).forEach(([key, tag]) => {
    let el;

    if (tag.type === 'pressure') {
      // 1. PT 압력/진공 센서 카드
      const unitStr = tag.unit || 'psi';
      el = document.createElement('div');
      el.className = 'overlay pt-card';
      el.id = `card-${key}`;
      el.innerHTML = `<span class="val" id="val-${key}">${tag.value.toFixed(1)}</span><span class="unit">${unitStr}</span>`;

    } else if (tag.type === 'valve') {
      // 2. Air Valve 반원형 돔 액추에이터
      el = document.createElement('div');
      el.className = `overlay valve-led ${tag.value ? 'open' : 'closed'}`;
      el.id = `val-${key}`;
      el.title = `[${tag.side}-SIDE] ${tag.label} Air Valve (클릭: ON/OFF)`;
      el.addEventListener('click', () => toggleValve(key, el));

    } else if (tag.type === 'vent_valve') {
      // 2b. Vent Valve 화이트 글로우 액추에이터
      el = document.createElement('div');
      el.className = `overlay vent-valve-led ${tag.value ? 'open' : 'closed'}`;
      el.id = `val-${key}`;
      el.title = `[${tag.side}] ${tag.label} Vent Valve (클릭: ON/OFF)`;
      el.addEventListener('click', () => toggleValve(key, el));

    } else if (tag.type === 'valve_shutter') {
      // 3. V/S (Valve Shutter) 상단 타원형 형광 링
      el = document.createElement('div');
      el.className = `overlay vs-led ${tag.value ? 'open' : 'closed'}`;
      el.id = `val-${key}`;
      el.title = `[${tag.side}-SIDE] V/S (Valve Shutter 비상 락)`;
      el.addEventListener('click', () => {
        tag.value = !tag.value;
        el.classList.toggle('open', tag.value);
        el.classList.toggle('closed', !tag.value);
        sendWsTag(key, tag.value);
      });

    } else if (tag.type === 'auto_guard') {
      // 4. AG (Auto Guard) 사이언 네온 링
      el = document.createElement('div');
      el.className = `overlay ag-ring ${tag.value ? 'open' : 'closed'}`;
      el.id = `val-${key}`;
      el.title = `[${tag.side}-SIDE] AG (Auto Guard 토출 가스켓 링)`;
      el.addEventListener('click', () => {
        tag.value = !tag.value;
        el.classList.toggle('open', tag.value);
        el.classList.toggle('closed', !tag.value);
        updatePipeFlows();
        sendWsTag(key, tag.value);
      });

    } else if (tag.type === 'temp') {
      // 5. 자켓 히터 온도 (TEMP)
      el = document.createElement('div');
      el.className = 'overlay temp-display';
      el.id = `card-${key}`;
      el.innerHTML = `<span class="val" id="val-${key}">${tag.value.toFixed(1)}</span><span class="unit">°C</span>`;

    } else if (tag.type === 'weight') {
      // 6. 로드셀 저울 중량 (WEIGHT)
      el = document.createElement('div');
      el.className = 'overlay weight-display';
      el.id = `card-${key}`;
      el.innerHTML = `<span class="val" id="val-${key}">${tag.value.toFixed(1)}</span><span class="unit">kg</span>`;

    } else if (tag.type === 'level') {
      // 7. 실린더 잔량 (LV)
      el = document.createElement('div');
      el.className = 'overlay level-display';
      el.id = `card-${key}`;
      el.innerHTML = `<span class="tag">LV</span><span class="val" id="val-${key}">${tag.value}</span><span class="unit">%</span>`;

    } else if (tag.type === 'level_bar') {
      // 8. 실린더 잔량 세로 LED 바
      el = document.createElement('div');
      el.className = 'overlay level-bar-box';
      el.id = `box-${key}`;
      el.innerHTML = `<div class="level-bar-fill" id="bar-${key}" style="height: ${tag.value}%;"></div>`;
    }

    if (el) {
      el.dataset.bx = tag.x;
      el.dataset.by = tag.y;
      el.style.left = tag.x + 'px';
      el.style.top  = tag.y + 'px';
      container.appendChild(el);
    }
  });
}

// ── 밸브 토글 핸들러 ────────────────────────────────────────
function toggleValve(key, el) {
  TAGS[key].value = !TAGS[key].value;
  el.classList.toggle('open',   TAGS[key].value);
  el.classList.toggle('closed', !TAGS[key].value);
  updatePipeFlows();
  sendWsTag(key, TAGS[key].value);
}

function sendWsTag(key, val) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ action: 'set_tag', tag: key, value: val }));
  }
}

// ── 화면 값 실시간 갱신 ─────────────────────────────────────
function updateDisplay(tagData) {
  Object.entries(tagData).forEach(([key, val]) => {
    const tag = TAGS[key];
    if (!tag) return;
    tag.value = val;

    if (tag.type === 'pressure') {
      const el = document.getElementById(`val-${key}`);
      if (el) el.textContent = parseFloat(val).toFixed(1);

    } else if (tag.type === 'valve' || tag.type === 'vent_valve') {
      const el = document.getElementById(`val-${key}`);
      if (el) {
        const isOpen = val === true || val === 1;
        el.classList.toggle('open', isOpen);
        el.classList.toggle('closed', !isOpen);
      }

    } else if (tag.type === 'valve_shutter') {
      const el = document.getElementById(`val-${key}`);
      if (el) {
        const isTriggered = val === true || val === 1;
        el.classList.toggle('open', isTriggered);
        el.classList.toggle('closed', !isTriggered);
      }

    } else if (tag.type === 'auto_guard') {
      const el = document.getElementById(`val-${key}`);
      if (el) {
        const isActive = val === true || val === 1;
        el.classList.toggle('open', isActive);
        el.classList.toggle('closed', !isActive);
      }

    } else if (tag.type === 'temp') {
      const el = document.getElementById(`val-${key}`);
      if (el) el.textContent = parseFloat(val).toFixed(1);

    } else if (tag.type === 'weight') {
      const el = document.getElementById(`val-${key}`);
      if (el) el.textContent = parseFloat(val).toFixed(1);

    } else if (tag.type === 'level') {
      const el = document.getElementById(`val-${key}`);
      if (el) el.textContent = Math.round(val);
      
      // 세로 LED 바 실시간 높이 동기화
      const barKey = key === 'A_LEVEL' ? 'A_BAR' : (key === 'B_LEVEL' ? 'B_BAR' : null);
      if (barKey) {
        const barEl = document.getElementById(`bar-${barKey}`);
        if (barEl) {
          barEl.style.height = `${Math.max(0, Math.min(100, val))}%`;
        }
      }
    } else if (tag.type === 'level_bar') {
      const barEl = document.getElementById(`bar-${key}`);
      if (barEl) {
        barEl.style.height = `${Math.max(0, Math.min(100, val))}%`;
      }
    }
  });

  updatePipeFlows();
}

// ── Mock 시뮬레이션 로직 ────────────────────────────────────
function startMock() {
  if (simRunning) return;
  simRunning = true;
  document.getElementById('btn-sim').classList.add('active');
  setStatus('mock', 'MOCK 시뮬레이션 동작 중 (실시간 압력/온도/잔량 변동)');

  mockInterval = setInterval(() => {
    const delta = {};

    ['A_HPT', 'B_HPT'].forEach(k => delta[k] = +(1813.0 + (Math.random() - 0.5) * 5.0).toFixed(1));
    ['A_MPT', 'B_MPT'].forEach(k => delta[k] = +(116.0 + (Math.random() - 0.5) * 2.0).toFixed(1));
    ['A_LPT', 'B_LPT'].forEach(k => delta[k] = +(43.0 + (Math.random() - 0.5) * 1.2).toFixed(1));
    ['A_FPT', 'B_FPT'].forEach(k => delta[k] = +(36.0 + (Math.random() - 0.5) * 0.8).toFixed(1));
    ['A_TEMP', 'B_TEMP'].forEach(k => delta[k] = +(65.0 + (Math.random() - 0.5) * 0.4).toFixed(1));

    // 실린더 Level 및 Weight 점진 감소 시뮬레이션
    ['A_LEVEL', 'B_LEVEL'].forEach(k => {
      let cur = TAGS[k].value;
      let next = cur - 1;
      if (next <= 5) next = 100;
      delta[k] = next;
    });

    ['A_WEIGHT', 'B_WEIGHT'].forEach(k => {
      let cur = TAGS[k].value;
      let next = +(cur - 0.05).toFixed(1);
      if (next <= 10.0) next = 45.2;
      delta[k] = next;
    });

    updateDisplay(delta);
  }, 800);
}

function stopMock() {
  simRunning = false;
  clearInterval(mockInterval);
  document.getElementById('btn-sim').classList.remove('active');
  setStatus('mock', 'MOCK 시뮬레이션 일시 정지');
}

function resetValues() {
  stopMock();
  const reset = {};
  Object.entries(TAGS_DEFAULT).forEach(([key, tag]) => {
    reset[key] = tag.value;
    TAGS[key].value = tag.value;
  });
  updateDisplay(reset);

  Object.entries(TAGS).forEach(([key, tag]) => {
    if (tag.type === 'valve' || tag.type === 'vent_valve') {
      const el = document.getElementById(`val-${key}`);
      if (el) {
        el.classList.add('closed');
        el.classList.remove('open');
      }
    }
  });
  updatePipeFlows();
  document.getElementById('btn-sim').textContent = '▶ 실시간 변동 시뮬레이션';
}

// ── WebSocket 통신 연결 ──────────────────────────────────────
function tryWebSocket() {
  try {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      mockMode = false;
      setStatus('connected', 'PLC 백엔드 WebSocket 연결됨 (:3005)');
    };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        updateDisplay(data);
      } catch {}
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      mockMode = true;
      setStatus('disconnected', '서버 미연결 — MOCK 모드');
      setTimeout(tryWebSocket, 4000);
    };
  } catch {
    setStatus('mock', 'MOCK 모드');
  }
}

function setStatus(state, msg) {
  const dot  = document.getElementById('ws-dot');
  const text = document.getElementById('ws-text');
  if (dot) dot.className = state;
  if (text) text.textContent = msg;
}

function updateClock() {
  const el = document.getElementById('clock-tick');
  if (el) el.textContent = new Date().toLocaleString('ko-KR');
}
