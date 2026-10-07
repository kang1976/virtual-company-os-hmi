const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-064] GSP 1단계 '공급전 압력및 Weight 확인' 화면 UI 디자인 및 실시간 센서 연동 개편 (2026-08-23)

**요청 내용:**
- GSP(가스공급 진행) 서브시퀀스 1단계 화면을 제공된 도면 이미지와 동일하게 전면 개편

**조치 내역 (\`public/OPERATION HTML/가스공급_압력확인.html\`, \`public/Operation.js\`, \`public/gms.js\`, \`public/gms.css\`):**
1. **상단 타이틀 및 설명 문구 개편:**
   - 상단 배지 헤더: \`[A] 가스공급 진행\` / \`[B] 가스공급 진행\`
   - 화면 타이틀: \`[ 공급전 압력및 Weight 확인 ]\`
   - 안내 문구: \`실린더 잠금 상태를 확인 하세요\` / \`가스공급 전 1차/2차 배관 라인의 압력및 무게 상태 확인\`
2. **5개 실시간 센서 계측값 목록 UI 구현:**
   - \`HPT_{side} :\`, \`MPT_{side} :\`, \`LPT_{side} :\`, \`NPT_{side} :\` ➔ \`[ ?????.?? ] psi\`
   - \`W/I_{side} :\` (무게 계측) ➔ \`[ ?????.?? ] kg\`
   - \`updateGspPressureCheckReadouts()\` 함수를 통해 PT 센서 폴링 시 1초마다 실시간 계측값 및 라벨 동적 갱신
3. **하단 4버튼 배치 유지:**
   - \`[ 가스공급 ]\` (Step 2로 이동), \`[ 조정모드 ]\`, \`[ Line Vent ]\`, \`[ 취소 ]\` (PC 화면 복귀)
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-064 appended to QNA.md');
