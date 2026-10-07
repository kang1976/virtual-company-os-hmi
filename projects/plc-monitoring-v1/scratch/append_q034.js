const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-034] Bypass 서브시퀀스 19A 이후 PGII Valve Open 및 HPT 진공유지 변화량 체크(CAPTURE:HPT) 연동 (2026-08-22)

**요청 내용:**
- 19A(NPT 진공유지 시간 도달) 이후에 PGII 밸브를 Open하고, NPT와 동일하게 HPT의 초기값을 캡처하고 현재값 변화량을 실시간 체크할 수 있도록 시퀀스 스텝 및 엑셀 시트 확장 반영 요청

**처리 내역 (\`data/gmsSubSequences/Bypass_v1.json\`):**
1. **스텝 확장 및 HPT 캡처 연동:**
   - **Step 19 / 19A**: \`[ NPT 진공유지 확인 ]\` (\`CAPTURE:NPT_{side}\`, NPT 초기값 캡처 및 실시간 모니터링)
   - **Step 20**: \`PGII_{side}: O\` (\`Message: PGII Valve Open\`, \`Next Step: 21\`)
   - **Step 21**: \`[ HPT 진공유지 확인 ]\` (\`CAPTURE:HPT_{side}\`, \`Alarm Monitoring: HPT_{side}\`, \`Time: 60초\`, \`Next Step: 21A\`)
   - **Step 21A**: HPT 진공유지 시간 판정 (\`진행횟수 >= Bypass 진공유지 확인시간[분]\`, 미달 시 21로 되돌아가 반복, 도달 시 Step 22)
   - **Step 22**: \`[ Bypass Sequence Complet ]\` (전 밸브 \`HPIV: C, PGII: C, PIV: C, PNBV: C\` Close 및 완료)
2. **화면 UI 실시간 동적 라벨 전환 (\`public/gms-sub-sequence-runner.js\` & \`시퀀스_Bypass.html\`):**
   - Step 19(NPT 구간) 도달 시: \`초기값(NPT)\`, \`현재값(NPT)\`로 레이블 자동 전환 및 NPT 값 표시
   - Step 21(HPT 구간) 도달 시: \`초기값(HPT)\`, \`현재값(HPT)\`로 레이블 자동 전환 및 HPT 값 표시
3. **마스터 엑셀 및 내보내기 동기화 완료:** \`docs/GMS_Cylinder_Exchange_Master_Total.xlsx\`
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-034 appended to QNA.md');
