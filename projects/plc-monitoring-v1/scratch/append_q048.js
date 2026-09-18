const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-048] 퍼지완료(PC) 후 가스공급 전 신규 스텝 "HP&LP Pump" 추가 및 시스템 연동 (2026-08-23)

**요청 내용:**
- 퍼지완료(PC) 화면에서 가스공급 단계로 넘어가기 전, 배관 진공을 잡는 신규 스텝 추가 요청
- 시퀀스 로직은 "Pumping 서브시퀀스 (\`OneP3_v1.json\`)"와 동일하게 구성하고, 상단 배지 명칭은 **\`HP&LP Pump\`** 로 지정

**전체 시퀀스 순서:**
\`\`\`
[4P] ➔ [PC (퍼지완료)] ➔ [HP&LP Pump (신규)] ➔ [READY] ➔ [Service]
\`\`\`

**조치 내역:**
1. **신규 서브시퀀스 정의 (\`data/gmsSubSequences/HpLpPump_v1.json\`):**
   - Main Step: 15 (\`HpLpPump\`, ID: \`HpLpPump_v1\`)
   - Step 1: \`[ HP&LP Pump Mode ]\` 시작
   - Step 2~6: \`PNV(O) ➔ LPV(O) ➔ HPI(O) ➔ HPV(O) ➔ PGI(O)\` 순차 개방 및 진공도 확인
   - Step 7~7A: \`PGII: OPEN\` 상태에서 분(分) 단위 Pumping 대기 & 실시간 HPT 감시 (\`진행시간 >= PUMPING 시간[분]\`)
   - Step 8~13: \`PGII(C) ➔ PGI(C) ➔ HPV(C) ➔ HPI(C) ➔ LPV(C) ➔ PNV(C)\` 역순 밸브 차단
   - Step 14: \`[ HP&LP Pump Sequence Complet ]\` 완료 ➔ \`READY\`로 이동
2. **독립 화면 생성 (\`public/OPERATION HTML/HP&LP_Pump.html\`):**
   - 상단 배지: \`[HP&LP Pump (점멸)]\`
   - 초기값(HPT) / 현재값(HPT) / 설정시간(분) / 진행시간(분) 실시간 패널 및 하단 정렬 레이아웃 적용
   - 실행 / 일시정지 / 초기화 / 취소 / TREND / 서브시퀀스 엑셀 내보내기·불러오기 버튼 완비
3. **시스템 연동 (\`public/Operation.js\`, \`public/gms.css\`, \`public/gms-sub-sequence-runner.js\`, \`public/gms.html\`):**
   - \`CYLINDER_STEP_ORDER\`에 \`HP&LP Pump\` 추가 (\`PC\` 다음 위치)
   - \`STATUS_ENTRY_SCREEN_BY_TYPE['HP&LP Pump'] = 'hpLpPump'\` 등록
   - \`SUBSEQ_NS.hpLpPump\` 러너 네임스페이스 등록 (\`cycleCurrentAsTime: true\`)
   - \`PC\` 화면에서 "가스공급" 버튼 클릭 시 \`HP&LP Pump\`로 자동 진입 및 완료 시 \`READY\`로 연결
4. **마스터 엑셀 동기화:** \`docs/GMS_Cylinder_Exchange_Master_Total.xlsx\`에 \`HpLpPump_v1\` 시트 빌드 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-048 appended to QNA.md');
