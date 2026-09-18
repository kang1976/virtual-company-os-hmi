const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../data/gmsSubSequenceConfig.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const newParams = [
  {
    group: '설정값',
    name: 'WI_A Gas[Net] 무게 1차 하한',
    id: 'wi_net_weight_lower_limit_A',
    value: 5.0,
    unit: 'kg',
    desc: '[GSP Step 1] WI_A 가스공급 진행 전 용기 유효 Net 무게 1차 하한 기준값',
    side: 'A', min: 0, max: 200, interlock: '', option: 'WI_A',
  },
  {
    group: '설정값',
    name: 'WI_A Gas[Net] 무게 상한',
    id: 'wi_net_weight_upper_limit_A',
    value: 50.0,
    unit: 'kg',
    desc: '[GSP Step 1] WI_A 가스공급 진행 전 용기 유효 Net 무게 상한 기준값',
    side: 'A', min: 0, max: 200, interlock: '', option: 'WI_A',
  },
  {
    group: '설정값',
    name: 'WI_B Gas[Net] 무게 1차 하한',
    id: 'wi_net_weight_lower_limit_B',
    value: 5.0,
    unit: 'kg',
    desc: '[GSP Step 1] WI_B 가스공급 진행 전 용기 유효 Net 무게 1차 하한 기준값',
    side: 'B', min: 0, max: 200, interlock: '', option: 'WI_B',
  },
  {
    group: '설정값',
    name: 'WI_B Gas[Net] 무게 상한',
    id: 'wi_net_weight_upper_limit_B',
    value: 50.0,
    unit: 'kg',
    desc: '[GSP Step 1] WI_B 가스공급 진행 전 용기 유효 Net 무게 상한 기준값',
    side: 'B', min: 0, max: 200, interlock: '', option: 'WI_B',
  },
  {
    group: '설정값',
    name: 'HPT_A 1차 저압',
    id: 'hpt_primary_low_pressure_A',
    value: 100.0,
    unit: 'PSI',
    desc: '[GSP Step 4] HPT_A 실린더 메인 밸브 개방 후 1차 저압 충족 기준값',
    side: 'A', min: 0, max: 3000, interlock: '', option: '',
  },
  {
    group: '설정값',
    name: 'HPT_A 고압',
    id: 'hpt_high_pressure_A',
    value: 2500.0,
    unit: 'PSI',
    desc: '[GSP Step 4] HPT_A 실린더 메인 밸브 개방 후 고압 상한 기준값',
    side: 'A', min: 0, max: 3000, interlock: '', option: '',
  },
  {
    group: '설정값',
    name: 'HPT_B 1차 저압',
    id: 'hpt_primary_low_pressure_B',
    value: 100.0,
    unit: 'PSI',
    desc: '[GSP Step 4] HPT_B 실린더 메인 밸브 개방 후 1차 저압 충족 기준값',
    side: 'B', min: 0, max: 3000, interlock: '', option: '',
  },
  {
    group: '설정값',
    name: 'HPT_B 고압',
    id: 'hpt_high_pressure_B',
    value: 2500.0,
    unit: 'PSI',
    desc: '[GSP Step 4] HPT_B 실린더 메인 밸브 개방 후 고압 상한 기준값',
    side: 'B', min: 0, max: 3000, interlock: '', option: '',
  },
  {
    group: '설정값',
    name: 'LPT_A 1차 저압',
    id: 'lpt_primary_low_pressure_A',
    value: 10.0,
    unit: 'PSI',
    desc: '[GSP Step 5] LPT_A 레귤레이터 조정 후 2차측 저압 하한 기준값',
    side: 'A', min: 0, max: 200, interlock: '', option: '',
  },
  {
    group: '설정값',
    name: 'LPT_A 1차 고압',
    id: 'lpt_primary_high_pressure_A',
    value: 100.0,
    unit: 'PSI',
    desc: '[GSP Step 5] LPT_A 레귤레이터 조정 후 2차측 고압 상한 기준값',
    side: 'A', min: 0, max: 200, interlock: '', option: '',
  },
  {
    group: '설정값',
    name: 'LPT_B 1차 저압',
    id: 'lpt_primary_low_pressure_B',
    value: 10.0,
    unit: 'PSI',
    desc: '[GSP Step 5] LPT_B 레귤레이터 조정 후 2차측 저압 하한 기준값',
    side: 'B', min: 0, max: 200, interlock: '', option: '',
  },
  {
    group: '설정값',
    name: 'LPT_B 1차 고압',
    id: 'lpt_primary_high_pressure_B',
    value: 100.0,
    unit: 'PSI',
    desc: '[GSP Step 5] LPT_B 레귤레이터 조정 후 2차측 고압 상한 기준값',
    side: 'B', min: 0, max: 200, interlock: '', option: '',
  },
  {
    group: '설정값',
    name: 'MPT_A 저압',
    id: 'mpt_low_pressure_A',
    value: 10.0,
    unit: 'PSI',
    desc: '[GSP Step 5] MPT_A 레귤레이터 조정 후 매니폴드 저압 하한 기준값 (옵션)',
    side: 'A', min: 0, max: 300, interlock: '', option: 'MPT_A',
  },
  {
    group: '설정값',
    name: 'MPT_A 고압',
    id: 'mpt_high_pressure_A',
    value: 150.0,
    unit: 'PSI',
    desc: '[GSP Step 5] MPT_A 레귤레이터 조정 후 매니폴드 고압 상한 기준값 (옵션)',
    side: 'A', min: 0, max: 300, interlock: '', option: 'MPT_A',
  },
  {
    group: '설정값',
    name: 'MPT_B 저압',
    id: 'mpt_low_pressure_B',
    value: 10.0,
    unit: 'PSI',
    desc: '[GSP Step 5] MPT_B 레귤레이터 조정 후 매니폴드 저압 하한 기준값 (옵션)',
    side: 'B', min: 0, max: 300, interlock: '', option: 'MPT_B',
  },
  {
    group: '설정값',
    name: 'MPT_B 고압',
    id: 'mpt_high_pressure_B',
    value: 150.0,
    unit: 'PSI',
    desc: '[GSP Step 5] MPT_B 레귤레이터 조정 후 매니폴드 고압 상한 기준값 (옵션)',
    side: 'B', min: 0, max: 300, interlock: '', option: 'MPT_B',
  },
];

newParams.forEach((param) => {
  const existingIdx = config.rows.findIndex((r) => r.name === param.name);
  if (existingIdx !== -1) {
    config.rows[existingIdx] = param;
  } else {
    config.rows.push(param);
  }
});

config.savedAt = new Date().toISOString();
fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
console.log('GSP config parameters added successfully. Total rows:', config.rows.length);
