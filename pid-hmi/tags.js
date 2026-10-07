// ============================================================
// tags.js — P&ID Tag 정의 및 픽셀 정밀 좌표 매핑 (기준: 1128 x 1264 px)
// ============================================================

const TAGS = {
  // ── A SIDE (Left Column) ───────────────────────────────────
  // PT 압력 센서 카드 (x, y = 카드 중앙 좌표)
  A_FPT:    { label: 'FPT',  type: 'pressure', unit: 'psi', value: 36.0,   x: 306, y: 134,  side: 'A' },
  A_LPT:    { label: 'LPT',  type: 'pressure', unit: 'psi', value: 43.0,   x: 306, y: 394,  side: 'A' },
  A_MPT:    { label: 'MPT',  type: 'pressure', unit: 'psi', value: 116.0,  x: 306, y: 537,  side: 'A' },
  A_HPT:    { label: 'HPT',  type: 'pressure', unit: 'psi', value: 1813.0, x: 306, y: 818,  side: 'A' },

  // Air Valve 반원형(Dome) LED (LPI 열과 수직 정렬)
  A_FPV:    { label: 'FPV',  type: 'valve',    value: false, x: 369, y: 284, side: 'A' },
  A_LPI:    { label: 'LPI',  type: 'valve',    value: false, x: 370, y: 338, side: 'A' },
  A_HPI:    { label: 'HPI',  type: 'valve',    value: false, x: 370, y: 678, side: 'A' },

  // 실린더 파트
  A_VS:     { label: 'V/S',  type: 'valve_shutter', value: false, x: 492, y: 830,  side: 'A' },
  A_AG:     { label: 'AG',   type: 'auto_guard',    value: true,  x: 463, y: 899,  side: 'A' },
  A_LEVEL:  { label: 'LV',   type: 'level',    unit: '%',   value: 100,    x: 492, y: 946,  side: 'A' },
  A_BAR:    { label: 'BAR',  type: 'level_bar',             value: 100,    x: 556, y: 1051, side: 'A' },
  A_TEMP:   { label: 'TEMP', type: 'temp',     unit: '°C',  value: 65.0,   x: 470, y: 1128, side: 'A' },
  A_WEIGHT: { label: 'WT',   type: 'weight',   unit: 'kg',  value: 45.2,   x: 494, y: 1198, side: 'A' },

  // ── B SIDE (Right Column) ──────────────────────────────────
  // PT 압력 센서 카드
  B_FPT:    { label: 'FPT',  type: 'pressure', unit: 'psi', value: 36.0,   x: 718, y: 134,  side: 'B' },
  B_LPT:    { label: 'LPT',  type: 'pressure', unit: 'psi', value: 43.0,   x: 718, y: 394,  side: 'B' },
  B_MPT:    { label: 'MPT',  type: 'pressure', unit: 'psi', value: 116.0,  x: 718, y: 537,  side: 'B' },
  B_HPT:    { label: 'HPT',  type: 'pressure', unit: 'psi', value: 1813.0, x: 718, y: 818,  side: 'B' },

  // Air Valve 반원형(Dome) LED
  B_FPV:    { label: 'FPV',  type: 'valve',    value: false, x: 782, y: 284, side: 'B' },
  B_LPI:    { label: 'LPI',  type: 'valve',    value: false, x: 783, y: 338, side: 'B' },
  B_HPI:    { label: 'HPI',  type: 'valve',    value: false, x: 783, y: 678, side: 'B' },

  // 실린더 파트
  B_VS:     { label: 'V/S',  type: 'valve_shutter', value: false, x: 895, y: 830,  side: 'B' },
  B_AG:     { label: 'AG',   type: 'auto_guard',    value: true,  x: 865, y: 899,  side: 'B' },
  B_LEVEL:  { label: 'LV',   type: 'level',    unit: '%',   value: 100,    x: 894, y: 946,  side: 'B' },
  B_BAR:    { label: 'BAR',  type: 'level_bar',             value: 100,    x: 958, y: 1051, side: 'B' },
  B_TEMP:   { label: 'TEMP', type: 'temp',     unit: '°C',  value: 65.0,   x: 872, y: 1128, side: 'B' },
  B_WEIGHT: { label: 'WT',   type: 'weight',   unit: 'kg',  value: 45.2,   x: 896, y: 1198, side: 'B' },

  // ── VENT LINE SENSORS & VALVES ─────────────────────────────
  VT:       { label: 'VT',   type: 'pressure', unit: 'torr',value: 0.000,  x: 78,  y: 230, side: 'VENT' },
  VPT:      { label: 'VPT',  type: 'pressure', unit: 'psi', value: -14.70, x: 212, y: 268, side: 'VENT' },

  VN2:      { label: 'VN2',  type: 'vent_valve', value: false, x: 28,  y: 95,  side: 'VENT' },
  VN1:      { label: 'VN1',  type: 'vent_valve', value: false, x: 28,  y: 162, side: 'VENT' },
  PNV:      { label: 'PNV',  type: 'vent_valve', value: false, x: 70,  y: 128, side: 'VENT' },
  GNV:      { label: 'GNV',  type: 'vent_valve', value: false, x: 160, y: 195, side: 'VENT' },

  LPV_A:    { label: 'LPV_A',type: 'vent_valve', value: false, x: 322, y: 372, side: 'A' },
  HPV_A:    { label: 'HPV_A',type: 'vent_valve', value: false, x: 322, y: 645, side: 'A' },
  LPV_B:    { label: 'LPV_B',type: 'vent_valve', value: false, x: 876, y: 372, side: 'B' },
  HPV_B:    { label: 'HPV_B',type: 'vent_valve', value: false, x: 876, y: 645, side: 'B' },
};

const TAGS_DEFAULT = JSON.parse(JSON.stringify(TAGS));
