const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-068] HP&LP Pump 화면 헤더 타이틀 '[A] 가스공급 진행' 수정 및 취소 시 PC 화면 복귀/전 밸브 Close/초기화 (2026-08-23)

**질문/요청 내용:**
- "HPLP PUMP에서 취소를 하면:
   1. PC(퍼지 완료 화면)으로 이동
   2. 모든 밸브 Close / 서브시퀀스 초기화
   3. 화면 타이틀 화면도 [A] 자동진행 --> 가스공급 진행 으로 수정"

**조치 내역 (\`data/gmsScreenTitles.json\`, \`public/Operation.js\`):**
1. **화면 타이틀 수정:**
   - \`data/gmsScreenTitles.json\` 및 \`CYL_EXCHANGE_PURGE_STEPS\`의 \`hpLpPump\` 타이틀을 \`"가스공급 진행"\`으로 수정하여 상단 배지 헤더가 \`[A] 가스공급 진행\` / \`[B] 가스공급 진행\`으로 표시되도록 조치
2. **HP&LP Pump 취소 시 동작 개선:**
   - \`closeAllProcessValvesDirect(side)\`를 즉시 호출하여 **모든 공정 밸브 완전 전폐 (All Valve CLOSE)**
   - \`stopNamespacedSubSequenceRunner('hpLpPump')\`를 호출하여 **타이머 및 서브시퀀스 완전 초기화**
   - \`showProgressCylExchangePurgeStep(exchangePurgeComplete)\`를 호출하여 **PC (퍼지완료/가스공급) 화면으로 깔끔하게 이동**하도록 연결 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-068 appended to QNA.md');
