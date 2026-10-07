const fs = require('fs');
const path = require('path');

const pdcaPath = path.join(__dirname, '../docs/PROJECT_MASTER_PDCA.md');
let content = fs.readFileSync(pdcaPath, 'utf8');

const badgeRuleSection = `
### 2.4 조작화면 상단 중간 큰 배지(Step Badge) 3단계 상태 표준 규칙
* **[규칙 1] 점멸 (Blinking / 점멸 애니메이션)**: 현재 실행 중인 해당 Status
* **[규칙 2] On 상태 (Done / 적색 고정 LAMP)**: 이미 정상 완료(Pass)된 이전 Status
* **[규칙 3] Off 상태 (Default / 흰색 배경)**: 아직 도달하지 않은 대기 Status
* **시퀀스 간 배지 공유 규칙**:
  * \`Puls\` 진행 중 ➔ \`1P\` 배지 점멸
  * \`Bypass\` 진행 중 ➔ 앞선 \`3P\` 배지 적색 On + \`+L\` 배지 점멸
`;

if (!content.includes('2.4 조작화면 상단 중간 큰 배지')) {
  content = content.replace('## 3. [DO]', badgeRuleSection + '\n## 3. [DO]');
  fs.writeFileSync(pdcaPath, content, { encoding: 'utf8' });
  console.log('Badge rule added to PROJECT_MASTER_PDCA.md');
}
