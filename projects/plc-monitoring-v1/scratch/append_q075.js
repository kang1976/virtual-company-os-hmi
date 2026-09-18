const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-075] 비밀번호 입력 취소 시 전역 화면 복귀(Universal Previous Screen Fallback) 구조 구축 (2026-08-23)

**질문/요청 내용:**
- "비밀번호 화면에서 취소 시 원래 화면 복귀 처리는 현재 프로그램 전체 시퀀스에서 적용이 되어야 합니다. 전체 점검 및 확인 바랍니다."

**조치 내역 (\`public/Operation.js\`):**
1. **비밀번호 진입 직전 화면 정보 자동 백업 (\`passwordPreviousScreenInfo\`):**
   - \`showProgressPassword()\` 실행 시점에 현재 화면에 띄워져 있던 활성 화면 이름(\`name\`), 상단 헤더 문구(\`header\`), 현재 Side(\`A\`/\`B\`)를 자동으로 캡처하여 저장
2. **비밀번호 취소(\`passwordCancelBtn\`) 시 전역 안전 복귀 처리:**
   - 특정 고유 복귀 로직(수동밸브, 실린더교환 각 단계 등)을 우선 처리한 뒤,
   - 그 외 모든 진입 경로에 대해 \`passwordPreviousScreenInfo\`를 참조하여 **비밀번호를 호출했던 원래 직전 화면으로 100% 안전하게 복귀**하도록 시스템 전역 공통 복귀 메커니즘을 완성
   - 복귀 시 계측값(\`updateGspPressureCheckReadouts\`) 및 화면 요소 자동 새로고침 처리 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-075 appended to QNA.md');
