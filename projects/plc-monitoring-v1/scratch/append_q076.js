const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-076] GSP 가스공급 진행 7단계 시퀀스 사양 전면 구현 (2026-08-23)

**질문/요청 내용:**
- GSP 가스공급 진행 7단계 시퀀스 사양표 반영 (Step 1~7 화면 연동, 밸브 동작, 실시간 압력/무게 인터락, 배관 색상 변경 및 FPV Open 매핑)

**조치 내역 (\`data/gmsSubSequenceConfig.json\`, \`public/Operation.js\`, \`public/gms.html\`, \`public/OPERATION HTML/가스공급_FPV Open 확인.html\`):**
1. **CONFIG 설정 파라미터 등록:**
   - \`WI_{side} Gas[Net] 무게 1차 하한\` / \`상한\`, \`HPT_{side} 1차 저압\` / \`고압\`, \`LPT_{side} 1차 저압\` / \`1차 고압\`, \`MPT_{side} 저압\` / \`고압\` 등록 완료
2. **Step 1 (공급 압력 확인):**
   - HPT, MPT, LPT, NPT 및 WI 실시간 계측값 표시
   - **인터락**: 모든 PT 센서 \`<= 진공하한치_{side}\` 및 WI 옵션 ON 시 \`무게 하한 < WI < 무게 상한\` 충족 시 Step 2 이동
3. **Step 2 (Valve Shutter 장착) & Step 3 (Regulator Close):**
   - 육안 및 닫힘 상태 확인 후 [확인] 클릭 시 다음 스텝 순차 이동
4. **Step 4 (Cylinder Open):**
   - 진입 시 \`V/S_{side}\` Open ➔ 배관 라인 가스 유입
   - **인터락**: \`HPT 1차 저압 <= HPT_{side} <= HPT 고압\` 충족 시 \`HPI_{side}\` Open 및 Step 5 이동
5. **Step 5 (Regulator 조정):**
   - 진입 시 \`LPI_{side}\` Open
   - **인터락**: \`LPT 1차 저압 <= LPT_{side} <= LPT 1차 고압\` & (MPT 옵션 On 시) \`MPT 저압 <= MPT_{side} <= MPT 고압\` 충족 시 Step 6 이동
6. **Step 6 (FPV Open 확인):**
   - \`가스공급_FPV Open 확인.html\` 생성 및 컨테이너 연동, [확인] 시 Step 7 이동
7. **Step 7 (가스공급 준비 완료):**
   - Status를 **\`READY\`**로 전환, [확인] 클릭 시 **\`Service\`** (가스공급 중) 상태로 전환되며 \`gasSupplyActive\` 화면으로 진입 완료
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-076 appended to QNA.md');
