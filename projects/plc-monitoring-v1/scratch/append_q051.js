const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-051] 알람 발생 시 전 밸브 안전 전폐(All Valve CLOSE) 인터록 보강 (2026-08-23)

**요청/질문 내용:**
- "근데 알람이 발생을 하였는데 왜 밸브가 열려 있나요?"

**원인 분석:**
- 기존 \`subSeqCloseAllOpenValves\` 함수가 실행 중 \`valveOpenState\`에 기록된 밸브 태그만을 대상으로 CLOSE 명령을 내보냈음
- 이에 따라 비정상 시점이나 외부 요인으로 열려 있던 밸브가 누락될 수 있는 가능성이 존재했음

**조치 내역 (\`public/gms-sub-sequence-runner.js\`):**
- **포괄적 안전 전폐(Comprehensive All-Close) 인터록 적용**:
  1. 현재 실행에서 열려 있던 밸브뿐만 아니라,
  2. 해당 서브시퀀스에 정의된 전체 밸브 태그(\`valveTags\`),
  3. 공통 및 해당 측 안전 밸브 전수(\`PNV, GNV, HPIV, PNBV, PIV, LPV_{side}, HPI_{side}, HPV_{side}, PGI_{side}, PGII_{side}\` 등)
  - 상기 모든 밸브에 대해 알람 발생 시 즉시 일괄 \`value: false\` (전폐 CLOSE) 명령을 강제 출력하도록 로직을 전면 보강함
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-051 appended to QNA.md');
