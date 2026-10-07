const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-021] 교환후 1차 배관청소(3P) 진행 시 -VT 배지에 잘못 램프(적색 완료)가 켜지던 현상 수정 (2026-08-22)

**요청 내용:**
- 교환후 1차 배관청소(3P) 모드인데 화면 상단 큰 배지에서 왜 \`-VT\` 중간 배지에 램프가 들어와 있는지 원인 분석 및 수정 요청

**원인 분석:**
- \`-VT\` 공정은 전체 시퀀스(\`CYLINDER_STEP_ORDER\`)에 **교환전**과 **교환후** 두 번 나타남
- 3P 위치(\`idx = 7\`)에서 배지 판정 시, 교환전 -VT(\`index 4\`, 거리 3)와 교환후 -VT(\`index 10\`, 거리 3)의 인덱스 거리가 똑같이 3으로 계산됨
- 이로 인해 교환전 -VT(\`index 4\`)로 매핑되었고, 이미 실린더 교체(CC) 전에 완료했던 이력(\`completedStatusSteps\`) 때문에 **교환후 화면의 -VT 배지에 \`done\`(적색 완료) 불이 켜지는 오작동** 발생

**처리 내역:**
1. **CC(용기교체) 경계 기준 -VT 인스턴스 정확 매핑 (\`public/Operation.js\`):**
   - 현재 진행 중인 공정이 CC 이전이면 무조건 **교환전 -VT**를 참조
   - 현재 진행 중인 공정이 CC 이후(3P, +L, 4P 등)이면 무조건 **교환후 -VT**를 참조하도록 수정
2. **결과:**
   - 3P 진행 시 \`3P\` 배지만 정상 점멸(\`blinking\`)하고, 아직 거치지 않은 \`-VT\` 배지는 꺼진 상태(대기)로 유지됨
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-021 appended to QNA.md');
