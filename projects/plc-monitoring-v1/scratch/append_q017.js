const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-017] 작업이력 C열 사람 중심 4단 정밀 표기 포맷(공정/스텝/밸브/판정/시간) 엔진 탑재 및 사용자 편집 연동 (2026-08-22)

**요청 내용:**
- 작업이력 자동진행 C열(조작 Key)에서 어떤 시퀀스를 진행하는지 엑셀을 일일이 대조하지 않고도 한눈에 알 수 있도록 개선 요청
- [Main 공정 / Sub 시퀀스 Step : 안정화 시간, 초기값 반영, 진행시간 누적, 밸브 작동상태, 비교 판단 내용] 반영
- 사용자가 내용을 쉽게 편집/커스터마이징할 수 있는 구조 제공

**처리 내역:**
1. **작업이력 C열 4단 표준 포맷팅 엔진 탑재 (\`public/gms-sub-sequence-runner.js\`):**
   - \`[Main No: 공정명 / Step No (스텝명)] | 밸브: [OPEN/CLOSE 태그 목록] | 판정: 센서연산자 + 초기값(P0) + 안정화시간 | 시간: 스텝시간 (누적초)\`
   - 16개 Main 공정 한글 표준명 매핑 및 side(A/B) 접미사 자동 해석 연동
2. **사용자 문구 커스터마이징 우선 반영:**
   - 엑셀 마스터(\`GMS_Cylinder_Exchange_Master_Total.xlsx\`) 시트의 \`설명(Remarks)\` 열에 기입된 사용자 문구를 최우선으로 이력에 조합
   - 그리드 상단 [메시지 설정 내보내기/불러오기]를 통한 템플릿 일괄 편집 지원
3. **Univer 작업이력 그리드 위젯 (\`grid-app/src/gms-worklog-widget.js\`) 렌더러 최적화 및 빌드 완료.**
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-017 appended to QNA.md');
