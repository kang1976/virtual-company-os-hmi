const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-069] HP&LP Pump 취소 시 '퍼지완료 이후 취소 비밀번호' 옵션 게이트 적용 및 옵션명 수정 (2026-08-23)

**질문/요청 내용:**
- "취소를 누르면 비밀번호를 적용을 해야 하는데... 옵션 'PC 이후 취소 비밀번호'"
- "옵션명도 PC 이후 취소 비밀번호 ----> '퍼지완료 이후 취소 비밀번호' 이렇게 수정을 해줘"

**조치 내역 (\`public/gms.js\`, \`public/Operation.js\`):**
1. **옵션 명칭 수정:**
   - \`gms.js\`의 \`PASSWORD_GATE_DEFS\` 및 \`Operation.js\`의 \`PASSWORD_CANCEL_TITLES\`에서 \`postPcCancel\`의 라벨을 \`'PC 이후 취소 비밀번호'\` ➔ **\`'퍼지완료 이후 취소 비밀번호'\`**로 일괄 수정
2. **HP&LP Pump 취소 시 비밀번호 게이트 연동:**
   - \`hpLpPump\`의 \`onCancel\`에 \`proceedPastPasswordGate('postPcCancel', advancePostPcCancelExit)\` 연결
   - OPTION 탭에서 '퍼지완료 이후 취소 비밀번호'가 적용(ON)되어 있으면 취소 시 **PASSWORD 입력 화면**으로 진입하며, 비밀번호 일치 시 **모든 밸브 CLOSE + 서브시퀀스 초기화 + PC(퍼지완료) 화면으로 복귀**
   - 옵션이 미적용(OFF)되어 있으면 비밀번호 입력 없이 곧바로 PC 화면으로 안전하게 복귀하도록 연동 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-069 appended to QNA.md');
