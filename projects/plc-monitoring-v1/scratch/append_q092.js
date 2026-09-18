const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-092] SVG 레이어 스택 재구성 (검정 배관선 ➔ 적색 가스선 ➔ 부품/밸브/센서 순 렌더링) (2026-08-24)

**질문/요청 내용:**
- 배관 밑으로 레이어를 옮겼더니 검정 배관선에 가려 적색 라인이 사라지는 현상 발생
- 검정색 선을 변경하는 것이 아니라 **적색 라인을 검정 배관 위에 추가로 그리고, 부품들(레귤레이터, 필터, 체크밸브, 밸브 기호, 센서 박스) 밑으로 통과하도록 정밀 레이어링** 조치

**원인 분석:**
- SVG 상에서 \`<g id="gasFlowLayer"></g>\`가 정적 배관선(\`path.pipe\`)보다 앞에 위치하여 검정 배관선에 완전히 가려졌던 문제.

**조치 내역 (\`public/gms-diagram.svg\`):**
- SVG 내부 렌더링 계층 구조(Stack)를 5단계로 체계화하여 재구성:
  1. **1단계: \`<g id="pipesBaseLayer">\`** ➔ 기본 검정색 배관선들 (가장 밑바탕)
  2. **2단계: \`<g id="gasFlowLayer">\`** ➔ **추가로 그려지는 적색 가스 흐름선** (검정 배관선 위에 선명하게 오버레이)
  3. **3단계: \`<g id="staticPartsLayer">\`** ➔ 정적 부품들 (레귤레이터 \`REG1\`/\`REG2\`, 필터 \`LF1\`/\`LF2\`, 체크밸브 \`CV1\`~\`CV3\`, 실린더 외형, 라벨)
  4. **4단계: \`<g id="valveLayer">\`** ➔ 동적 밸브 심볼들 (\`V/S\`, \`HPI\`, \`LPI\`, \`FPV\` 등)
  5. **5단계: \`<g id="ptLayer">\`** ➔ 압력/무게 센서 박스들 (\`HPT\`, \`LPT\`, \`MPT\` 등)
- 결과: 적색 가스선이 검정 배관 위에 선명하게 표시되면서, 밸브/레귤레이터/필터 등 모든 부품 기호들 밑으로 자연스럽게 통과함.
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-092 appended to QNA.md');
