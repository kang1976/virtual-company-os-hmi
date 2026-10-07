const fs = require('fs');
const path = require('path');

const twoP = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/gmsSubSequences/TwoP_v1.json'), 'utf8'));

function subSeqResolveTag(tag, side) {
  return tag.replace('{side}', side);
}

const MAIN_STEP_INFO = {
  TwoP: { no: 8, name: '2P', title: '2차 배관청소' },
};

function subSeqFormatWorklogMessage(step, side, elapsedSec, valveOpenState, extraLabel) {
  const mInfo = MAIN_STEP_INFO.TwoP;
  const stepName = step.operation || step.message || step.remarks || '자동진행';
  const headerPart = `[Main ${mInfo.no}: ${mInfo.name} / Step ${step.no} (${stepName}${extraLabel ? ` - ${extraLabel}` : ''})]`;

  let valvePart = '';
  const valveEntries = Object.entries(step.valves || {});
  const opens = [];
  const closes = [];
  valveEntries.forEach(([tag, mark]) => {
    const resolved = subSeqResolveTag(tag, side);
    if (mark === 'O') opens.push(resolved);
    else if (mark === 'C') closes.push(resolved);
  });

  if (opens.length > 0 && closes.length > 0) {
    valvePart = `밸브 동작: ${opens.join(', ')} [OPEN] / ${closes.join(', ')} [CLOSE]`;
  } else if (opens.length > 0) {
    valvePart = `밸브 동작: ${opens.join(', ')} [OPEN]`;
  } else if (closes.length > 0) {
    valvePart = `밸브 동작: ${closes.join(', ')} [CLOSE]`;
  } else {
    const currentlyOpen = Object.entries(valveOpenState || {})
      .filter(([_, isOpen]) => isOpen === true)
      .map(([tag]) => tag);
    if (currentlyOpen.length > 0) {
      valvePart = `밸브 상태: ${currentlyOpen.join(', ')} [OPEN 유지]`;
    } else {
      valvePart = '밸브 상태: 전 밸브 [CLOSE]';
    }
  }

  let condPart = '';
  const delaySec = Number(step.timeSec) || 0;
  const rawCondTag = step.alarmMonitoring || '';
  if (rawCondTag && rawCondTag.trim() !== '') {
    const condTag = subSeqResolveTag(rawCondTag, side);
    const op = step.conditionOp || '==';
    const val = step.conditionValue != null ? subSeqResolveTag(step.conditionValue, side) : '';
    condPart = `판정: ${condTag} ${op} ${val} (안정화: ${delaySec}초)`;
  } else if (delaySec > 0) {
    condPart = `대기: ${delaySec}초 안정화 대기`;
  } else {
    condPart = '판정: 동작 완료 후 Next Step 이동';
  }

  const timePart = `시간: ${delaySec > 0 ? `${delaySec}초` : '-'} (누적 ${elapsedSec || 0}초)`;
  return `${headerPart} | ${valvePart} | ${condPart} | ${timePart}`;
}

const state = {};
let acc = 0;
twoP.steps.slice(0, 18).forEach((step) => {
  // apply valves
  Object.entries(step.valves || {}).forEach(([tag, mark]) => {
    state[subSeqResolveTag(tag, 'A')] = mark === 'O';
  });
  acc += (Number(step.timeSec) || 0);
  const msg = subSeqFormatWorklogMessage(step, 'A', acc, state);
  console.log(`Step ${step.no.padStart(2)}: ${msg}`);
});
