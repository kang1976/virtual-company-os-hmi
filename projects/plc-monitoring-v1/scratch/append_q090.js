const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-090] HP&LP Pump 화면 취소 시 퍼지완료 이후 비밀번호 게이트 거쳐 퍼지완료(PC) 화면 복귀 구현 (2026-08-23)

**질문/요청 내용:**
- HP&LP Pump 화면에서 [취소]를 눌렀을 때 정상 동작하지 않는 문제 수정
- '퍼지완료 이후 취소' 규칙과 동일하게 비밀번호를 체크하고 통과 시 퍼지완료(PC) 화면으로 이동 및 밸브 all Close 처리

**원인 분석:**
- HP&LP Pump 서브시퀀스 화면의 취소 버튼(\`hpLpPumpIdleCancelBtn\`, \`hpLpPumpCancelBtn\`)이 \`cancelPostPcToPassword('hpLpPump')\` 경로에 명시적으로 연결되지 않고 \`proceedPastPasswordGate\`를 직접 타면서 직전 화면 정보가 유실되었던 문제.

**조치 내역 (\`public/Operation.js\`):**
1. \`hpLpPump\` 러너의 \`onCancel\` 및 HTML 취소 버튼 2종(\`hpLpPumpIdleCancelBtn\`, \`hpLpPumpCancelBtn\`)을 \`cancelPostPcToPassword('hpLpPump')\`에 명시적으로 바인딩.
2. 비밀번호 게이트 통과 시:
   - 모든 공정 밸브 일괄 CLOSE 및 배관 램프 OFF (\`closeAllProcessValvesDirect\`)
   - 진행 중이던 서브시퀀스 정지 (\`stopNamespacedSubSequenceRunner('hpLpPump')\`)
   - Status를 \`PC\`로 갱신하고 퍼지완료(\`exchangePurgeComplete\`) 화면으로 안전하게 복귀.
3. 비밀번호 화면에서 [취소] 클릭 시: 원래 화면인 \`hpLpPump\` 화면으로 100% 안전하게 복귀.
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-090 appended to QNA.md');
