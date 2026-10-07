const fs = require('fs');
const path = require('path');

const basePath = 'D:\\02. AI 작업\\01.Antigravity 공유 File\\02. plc-monitoring ver1.0 - google\\docs';
const qnaPath = path.join(basePath, 'QNA.md');
const mobileQaPath = path.join(basePath, 'mobile', '00-start', 'QA_LOG.md');
const pwaQaPath = path.join(basePath, 'pwa-bridge', '00-start', 'QA_LOG.md');

let mainQnaContent = fs.readFileSync(qnaPath, 'utf8');
let mobileQaContent = fs.existsSync(mobileQaPath) ? fs.readFileSync(mobileQaPath, 'utf8') : '';
let pwaQaContent = fs.existsSync(pwaQaPath) ? fs.readFileSync(pwaQaPath, 'utf8') : '';

const masterHeader = `# [MASTER QNA] 3-in-1 PLC 모니터링 & 제어 통합 질의응답 마스터

> **문서 목적 및 관리 규칙**
> - 본 문서는 **PC 웹 & GMS 관제 시스템**, **스마트폰 직결 모바일 앱**, **모바일 PWA 브릿지** 전체 프로젝트의 모든 질의응답 및 수정 이력을 일원화하여 관리하는 **단일 통합 최우선 마스터 문서**입니다.
> - 앞으로 추가되는 모든 작업 지시, 기술 문답, 수정 사항은 본 문서의 최하단에 순차적으로 기록합니다.

---

## 📑 3대 시스템 통합 인덱스

| 구분 | 접두사 | 범위 | 관리 대상 시스템 | 바로가기 |
|:---|:---:|:---:|:---|:---:|
| **Part 1. PC 웹 & GMS 시스템** | \`[Q-xxx]\` | Q-001 ~ Q-099 | PC 웹 대시보드, Univer 그리드, 트렌드, P&ID 배관도 및 7단계 시퀀스 | [Part 1 이동](#part-1-pc-웹--gms-가스공급-관제-시스템-qna) |
| **Part 2. 스마트폰 직결 모바일 앱** | \`[M-xxx]\` | M-001 ~ M-038 | Flutter FINS/UDP 직결 네이티브 앱 (갤럭시 Z 폴드5 최적화, Release APK) | [Part 2 이동](#part-2-스마트폰-직결-모바일-앱-qna) |
| **Part 3. 모바일 PWA 브릿지** | \`[P-xxx]\` | P-001 ~ P-027 | PC 중계 HTTPS 브릿지 서버 + 모바일 브라우저 PWA 웹앱, 3단계 RBAC | [Part 3 이동](#part-3-모바일-pwa-브릿지-시스템-qna) |

---

# Part 1. 🖥️ PC 웹 & GMS 가스공급 관제 시스템 QNA

`;

// QNA 마스터 파일 재작성
let combined = masterHeader + mainQnaContent.replace(/^#\s*.*QNA.*/i, '');

// Part 2: 모바일 앱 섹션 추가
combined += `

---

# Part 2. 📱 스마트폰 직결 모바일 앱 QNA

> **담당 시스템**: \`mobile-app/\` (Flutter FINS/UDP P2P 모바일 직결 앱 및 배포 APK)

` + mobileQaContent.replace(/^#\s*.*QA_LOG.*/i, '');

// Part 3: PWA 브릿지 섹션 추가
if (pwaQaContent) {
  combined += `

---

# Part 3. 🌐 모바일 PWA 브릿지 시스템 QNA

> **담당 시스템**: \`pwa-bridge/\` (PC 중계 HTTPS 서버 + 모바일 PWA 웹앱)

` + pwaQaContent.replace(/^#\s*.*QA_LOG.*/i, '');
}

fs.writeFileSync(qnaPath, combined, { encoding: 'utf8' });
console.log('Master QNA created and unified successfully at:', qnaPath);
