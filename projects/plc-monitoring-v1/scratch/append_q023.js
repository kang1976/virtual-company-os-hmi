const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-023] 조작화면 상단 중간 큰 배지(Step Badge) 3단계 상태 표준 규칙 명문화 및 3P 완료 시 적색 On 연동 점검 (2026-08-22)

**요청 내용:**
- 3P 완료 후 다음 단계(Bypass/+L)로 넘어왔을 때 3P 배지가 적색 LAMP(On/완료 상태)로 켜져 있어야 하는 핵심 규칙 명문화 요청
- **[중간 배지 표준 규칙]**:
  1. **점멸 (Blinking / 점멸 애니메이션)**: 현재 실행 중인 해당 Status
  2. **On 상태 (Done / 적색 고정 LAMP)**: 이미 정상 완료(Pass)된 이전 Status
  3. **Off 상태 (Default / 흰색 배경)**: 아직 도달하지 않은 대기 Status

**처리 내역:**
1. **중간 배지 상태 전이 표준 규칙 설계 반영 (\`public/Operation.js\` & \`public/gms.css\`):**
   - \`applyCylinderStepStatus()\`에서 현재 실행 중인 Status는 \`blinking\`(점멸), 이미 통과 완료한 이전 Status는 \`done\`(적색 LAMP On)으로 철저히 동기화
   - 3P 정상 완료 시 \`markStepComplete(side, 3P_idx)\`가 등록되어, Bypass / +L / -VT / 4P 진행 중에도 3P 배지가 **적색 LAMP On**으로 유지됨
2. **시퀀스 간 배지 공유 규칙 메모:**
   - \`Puls\` 진행 중 ➔ \`1P\` 배지 점멸
   - \`Bypass\` 진행 중 ➔ \`3P\` 배지 적색 On + \`+L\` 배지 점멸
3. **표준 규칙 문서화:** \`docs/QNA.md\` 및 \`docs/PROJECT_MASTER_PDCA.md\`에 영구 표준으로 기록 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-023 appended to QNA.md');
