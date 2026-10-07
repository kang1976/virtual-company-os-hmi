const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-018] 작업이력 과거 데이터 vs 신규 데이터 차이 원인 분석 및 웹 그리드 ↔ 엑셀 내보내기 열 순서 일치화 (2026-08-22)

**요청 내용:**
- 엑셀 내보내기 화면에서 Valve Open/Close 동작 내용이 안 보이는 이유 질의
- 웹 그리드 화면과 엑셀 내보내기 파일 간의 D열(메시지) 불일치 원인 분석 및 수정 요청

**처리 내역:**
1. **과거 데이터 vs 신규 데이터 차이 안내:**
   - 사용자가 확인한 데이터는 포맷팅 엔진 업데이트 이전에 DB에 저장되었던 과거 기록(Legacy log)임
   - 신규 포맷 엔진 배포 이후 실행되는 공정부터는 C열에 \`[Main 8: 2P / Step 16] | 밸브: AV1_A, AV2_A [OPEN] | 판정: ...\` 형태로 실시간 기록됨
2. **웹 그리드 ↔ 엑셀 내보내기 열(D열) 순서 및 헤더 100% 일치화 (\`src/server.js\`):**
   - 기존: 웹 화면(C: 조작 Key ➔ D: 측) vs 엑셀 파일(C: 조작 Key ➔ D: 메시지 ➔ E: 측)으로 열이 어긋나 있던 문제 해결
   - \`A: 구분 | B: HTML화면 | C: 조작 Key | D: 측 | E: 시각 | F: 조작자 | G: 권한 | H: 자동진행 Step | I: 자동진행 누적(초)\`로 완벽 동기화 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-018 appended to QNA.md');
