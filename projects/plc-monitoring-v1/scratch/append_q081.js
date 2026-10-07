const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-081] Step 7 (가스공급 준비 완료) 문구, FPV 밸브 Open 및 반대측 연동 화면 전환 구현 (2026-08-23)

**질문/요청 내용:**
- Step 7 가스공급 준비 완료 사양 최종 반영:
  1. 안내 문구 추가: "확인을 누르면 가스공급 진행화면으로 전환 됩니다."
  2. 밸브 동작: \`FPV_{side}\` Open
  3. [확인] 클릭 시: 반대쪽 Status 상태가 \`Service\`(가스공급) 상태가 아니면 현재 측 가스공급 화면으로 이동, 반대쪽이 가스공급 중이면 반대쪽 가스공급 화면으로 이동
  4. [취소] 클릭 시: PC(퍼지완료) 화면으로 이동 및 시퀀스 PC로 이동 / Valve all Close

**조치 내역 (\`public/OPERATION HTML/가스공급_준비완료.html\`, \`public/Operation.js\`):**
1. **안내 문구 반영 (\`가스공급_준비완료.html\`):**
   \`\`\`html
   공급준비가 완료되었습니다.<br>
   실린더 압력및 무게값을 확인 하시기 바랍니다.<br>
   확인을 누르면 가스공급 진행화면으로 전환 됩니다.
   \`\`\`
2. **밸브 동작 및 화면 전환 로직 (\`Operation.js\`):**
   - [확인] 클릭 시 \`writeValveDirect('FPV_' + side, true)\` 실행
   - 반대쪽 실린더 Status가 \`Service\`이면 반대쪽 가스공급(\`showProgressGasSupplyActive(otherSide)\`) 화면으로 이동
   - 반대쪽이 \`Service\`가 아니면 현재 측 Status를 \`Service\`로 올리고 현재 측 가스공급(\`showProgressGasSupplyActive(side)\`) 화면으로 이동
3. **취소 시 일괄 Close 연동:**
   - \`gasSupplyReadyCancelBtn\` ➔ \`cancelPostPcToPassword\` ➔ \`cancelGasSupply()\` ➔ \`closeAllProcessValvesDirect(side)\`를 통해 모든 밸브 일괄 CLOSE 및 PC 화면 복귀 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-081 appended to QNA.md');
