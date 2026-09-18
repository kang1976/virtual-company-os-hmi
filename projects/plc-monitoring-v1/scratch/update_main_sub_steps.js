const fs = require('fs');
const path = require('path');

const sequenceOrder = [
  { id: 'IdleCheck_v1', mainStep: 1, desc: '교환전 사전확인 (IDLE 상태 유지)' },
  { id: 'Puls_v1', mainStep: 2, desc: 'Puls 구간 (잔류가스 Check ~ Pulse Vent)' },
  { id: 'OneP_v1', mainStep: 3, desc: '1P 구간 (1·2차측 Vent Mode)' },
  { id: 'OneP2_v1', mainStep: 4, desc: '1P 구간 (2차측 Purge)' },
  { id: 'OneP3_v1', mainStep: 5, desc: '1P 구간 (Pumping)' },
  { id: 'OneP4_v1', mainStep: 6, desc: '1P 구간 (1차측 Purge)' },
  { id: 'ExchL_v1', mainStep: 7, desc: '교환전 -L 감압시험' },
  { id: 'TwoP_v1', mainStep: 8, desc: '2P 구간 (교환전 2차 배관청소)' },
  { id: 'VtTest_v1', mainStep: 9, desc: '교환전 -VT 감압시험' },
  { id: 'CylReplace_v1', mainStep: 10, desc: '용기교체(CC) 실린더 확인 및 교체 6화면' },
  { id: 'Bypass_v1', mainStep: 11, desc: 'Bypass 구간 (배관 By-pass 체크)' },
  { id: 'AfterThreeP_v1', mainStep: 12, desc: '3P 구간 (교환후 1차 배관청소)' },
  { id: 'AfterPlusL_v1', mainStep: 13, desc: '+L 구간 (교환후 가압시험)' },
  { id: 'AfterVtTest_v1', mainStep: 14, desc: '교환후 -VT 감압시험' },
  { id: 'AfterFourP_v1', mainStep: 15, desc: '4P 구간 (교환후 2차 배관청소)' },
  { id: 'AdjustMode_v1', mainStep: 16, desc: '압력조정모드 (조정모드 A/B)' }
];

const dir = path.join(__dirname, '../data/gmsSubSequences');

sequenceOrder.forEach(item => {
  const filePath = path.join(dir, `${item.id}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${item.id}.json`);
    return;
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  if (Array.isArray(data.steps)) {
    data.steps.forEach((step, idx) => {
      step.mainStep = item.mainStep;
      step.subStep = idx + 1;
    });
  }
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`[MainStep ${item.mainStep}] ${item.id} -> ${data.steps.length} steps updated (SubStep: 1 ~ ${data.steps.length})`);
});
