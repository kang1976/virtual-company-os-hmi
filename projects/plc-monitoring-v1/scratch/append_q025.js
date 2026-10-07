const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-025] 용기교체(CC) 및 배관도 화면에서 HPIV Valve가 Open 상태로 남아있던 현상 수정 (2026-08-22)

**요청 내용:**
- 용기교체(CC) 진행 시 배관도 화면에서 HPIV Valve가 Open(적색)되어 있는 원인 분석 및 닫힘(Close) 조치 요청

**원인 분석:**
1. **Bypass 시퀀스 완료 시 Close 누락**:
   - Bypass 시퀀스(\`Bypass_v1.json\` Step 28)에서 고압 He Leak check 확인을 위해 \`HPIV\`를 \`OPEN\`한 후, 시퀀스 완료 단계(\`Step 33\`)에서 \`HPIV\`를 \`CLOSE\`하는 정의가 누락되어 Open 상태가 유지됨
2. **용기교체(CC) 진입 시 초기 안전 Close 미보장**:
   - 용기교체(CC) 화면 가이드에는 "단, HPIV는 Close 입니다."라고 명시되어 있으나, \`CylReplace_v1.json\` Step 1의 \`valves\`가 빈 객체(\`{}\`)로 되어 있어 이전 공정의 잔류 Open 상태가 초기화되지 않음

**처리 내역:**
1. **Bypass 완료 스텝 밸브 안전 Close 추가 (\`data/gmsSubSequences/Bypass_v1.json\`):**
   - Step 33 (Bypass Sequence Complete)에 \`HPIV: "C"\`, \`PGII: "C"\`, \`PIV: "C"\`, \`PNBV: "C"\` 정의 추가
2. **용기교체(CC) 진입 스텝 HPIV Close 보장 (\`data/gmsSubSequences/CylReplace_v1.json\`):**
   - Step 1 (실린더 확인)에 \`HPIV: "C"\` 명시하여 진입 즉시 HPIV가 Close 상태로 고정되도록 반영
3. **현재 서버 버퍼 즉시 리셋:** \`HPIV\`를 Close(\`false\`)로 즉시 명령 전송하여 배관도 밸브 아이콘을 흰색(Close)으로 복구
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-025 appended to QNA.md');
