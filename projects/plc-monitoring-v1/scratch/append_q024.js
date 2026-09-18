const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-024] By-pass 체크 화면 UI 및 서브시퀀스 구조를 가압시험(+L) 화면과 100% 동일하게 일치화 (2026-08-22)

**요청 내용:**
- 바이패스(By-pass 체크) 화면이 가압시험(+L) 서브시퀀스 화면과 100% 동일한 구성(배지, 초기값/현재값 HPT, 설정시간/진행시간 분 단위 패널 등)을 가지도록 수정 요청

**처리 내역:**
1. **By-pass 화면 구조 전면 개편 (\`public/OPERATION HTML/시퀀스_Bypass.html\`):**
   - 상단 큰 배지 \`[ 3P(done) ] [ +L(blinking) ] [ -VT ] [ 4P ]\` 표준 적용
   - 대기 화면: \`설정시간(분)\` / \`진행시간(분)\`
   - 진행 패널: \`초기값(HPT)\` / \`현재값(HPT)\` / \`설정시간(분)\` / \`진행시간(분)\` 패널 탑재
   - 조작 버튼: \`[일시정지] [초기화] [취소] [TREND]\` + \`[서브시퀀스 엑셀 내보내기/불러오기]\` 100% 일치화
2. **러너 엔진 센서 캡처 연동 (\`public/gms-sub-sequence-runner.js\`):**
   - \`SUBSEQ_NS.bypass\`에 \`captureInitial: 'sequenceBypassCaptureInitial'\`, \`captureCurrent: 'sequenceBypassCaptureCurrent'\`, \`captureDecimals: 2\` 연동 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-024 appended to QNA.md');
