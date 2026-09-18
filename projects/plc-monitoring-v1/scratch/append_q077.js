const fs = require('fs');
const path = require('path');

const qnaPath = path.join(__dirname, '../docs/QNA.md');
const appendContent = `
## [Q-077] GSP 가스공급 진행 단계별 배관 적색 착색 (그림 1~4) 구현 (2026-08-23)

**질문/요청 내용:**
- GSP 각 단계별 실린더 ➔ 배관 가스 유입 적색 착색 구간 반영 (그림 1 ~ 그림 4)

**배관 착색 구간 및 단계 매핑 (\`public/gms-diagram.svg\`, \`public/Operation.js\`, \`public/gms.js\`):**
1. **그림 1 (Step 4 - Cylinder Open 진입 시 / V/S Open):**
   - 실린더 ➔ V/S ➔ 주 배관 수평관, 아래쪽 PGI 앞단, 위쪽 LF1 필터를 거쳐 HPV 분기 및 HPI 앞단까지 적색 착색
2. **그림 2 (Step 4 - HPT 압력 도달 후 / HPI Open):**
   - 그림 1 구간 + HPI 밸브를 지나 REG1 (1차 레귤레이터) 앞단까지 적색 착색
3. **그림 3 (Step 5 - Regulator 조정 및 LPI Open 시점):**
   - 그림 2 구간 + REG1 및 REG2 레귤레이터를 통과하여 LPV 분기 및 LPI 앞단까지 적색 착색
4. **그림 4 (Step 6/7/Service - FPV Open 확인 및 공급 준비/가스공급 중):**
   - 그림 3 구간 + LPI 밸브를 통과하여 최상단 공정 메인 공급 밸브(FPV) 앞단까지 적색 착색
5. **초기화 및 취소 시:**
   - Step 1~3 및 시퀀스 취소/리셋 시 배관 적색 착색 해제 (기본 상태 복귀)
`;

fs.appendFileSync(qnaPath, appendContent, { encoding: 'utf8' });
console.log('Q-077 appended to QNA.md');
