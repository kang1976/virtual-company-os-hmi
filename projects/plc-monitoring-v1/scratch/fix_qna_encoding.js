const fs = require('fs');
const path = require('path');

const content = `# [QNA] PLC 모니터링 & GMS 시스템 작업 및 질의응답 이력

이 문서는 프로젝트 개발 및 운영 과정에서 사용자와 주고받은 모든 요청, 기술적 결정 사유, 변경 내역을 일련번호(\`[Q-001]\`, \`[Q-002]\`...) 기반으로 기록하는 공식 작업 로그입니다.

---

## [Q-001] 프로젝트 분석 및 QNA 번호 관리 체계 도입 (2026-08-22)

**요청 내용:**
- Claude 코드에서 진행하던 프로젝트를 Antigravity 환경으로 이관하여 분석 요청
- 앞으로 주고받는 모든 작업 내역을 MD 문서의 \`Q-001\`, \`Q-002\` 등의 일련번호 체계로 관리할 것을 요청

**처리 내역:**
1. 프로젝트 아키텍처 및 소스 코드 전면 분석 (Omron PLC FINS/CIP 통신, Express/WebSocket 서버, GMS 가스 제어 상태 머신, Univer 그리드 레시피)
2. \`docs/QNA.md\` 문서를 신규 생성하고 질의응답 일련번호 체계 공식 도입

---

## [Q-002] 불필요 파일 정리 및 bkit PDCA 단일 마스터 문서 구축 (2026-08-22)

**요청 내용:**
- 실행 및 운영에 불필요한 파일 전체 삭제 정리
- 여러 MD 문서들을 bkit 사이트의 PDCA (Plan-Design-Do-Check-Act) 구조 단일 마스터 문서로 통합

**처리 내역:**
1. 불필요한 빌드 아티팩트(\`dist-installer/\`), 과거 로그(\`logs/*\`), 아카이브(\`docs/archive/*\`), 덤프 파일(\`docs/질문답변.*\`) 안전 삭제
2. \`docs/PROJECT_MASTER_PDCA.md\` 생성 (프로젝트 목적, 아키텍처 및 설계 사유, 기능별 진척도, 수정 이력 및 원인 분석, 롤백 가이드 일원화)
3. \`CLAUDE.md\`, \`README.md\`, \`docs/TASK.md\`를 프로젝트 마스터 문서 중심으로 갱신

---

## [Q-003] 수동 승인 프롬프트 자동화 가이드 제공 (2026-08-22)

**요청 내용:**
- 도구 실행 및 아티팩트 생성 시 수동 승인 요청을 자동으로 처리하는 방법 문의

**처리 내역:**
1. Antigravity 환경의 Tool Execution Policy 및 Artifact Review Mode 설정 가이드 안내
2. Yolo 모드 및 신뢰할 수 있는 도구 자동 승인 구성 방법 설명

---

## [Q-004] 프로젝트 실행 구조 분석 및 Mermaid 아키텍처 플로우차트 작성 (2026-08-22)

**요청 내용:**
- 프로젝트 실행 및 전체 구동 구조 파악, 상세 플로우차트를 Mermaid 기법으로 작성 요청

**처리 내역:**
1. Node 24 환경에서 \`better-sqlite3@13.0.3\` 네이티브 바인딩 호환성 패치
2. 시스템 3대 핵심 Mermaid 다이어그램 작성 및 \`PROJECT_MASTER_PDCA.md\` 반영:
   - 시스템 전체 계층 아키텍처 구조도 (Frontend ↔ Backend ↔ PLC Driver)
   - GMS 실린더 교환 12단계 상태머신 흐름도 (IDLE ➔ Puls ➔ 1P ➔ -L ➔ 2P ➔ CC ➔ 3P ➔ +L ➔ 4P ➔ PC ➔ Service)
   - 세션 격리 기반 PLC 데이터 폴링 라이프사이클

---

## [Q-005] 갱신된 MD 문서 현황 요약 (2026-08-22)

**요청 내용:**
- 현재까지 생성 및 갱신된 MD 파일 현황 확인

**처리 내역:**
1. \`docs/PROJECT_MASTER_PDCA.md\` (단일 소스 마스터 문서)
2. \`docs/QNA.md\` (질의응답 이력)
3. \`CLAUDE.md\`, \`README.md\` 갱신 상태 보고

---

## [Q-006] GMS 실린더 교환 1~11단계 엑셀 파일 생성 및 사용자 매뉴얼 작성 (2026-08-22)

**요청 내용:**
- 실린더 교환 자동 시퀀스 공정별 최종본 확인 및 11단계까지 1개 엑셀 파일로 통합
- 엑셀 시퀀스 수정을 위한 셀별 세부 규칙 사용자 매뉴얼 작성

**처리 내역:**
1. \`data/gmsSubSequences/\` 폴더 기반 시퀀스 엑셀 생성
2. \`docs/GMS_SUBSEQUENCE_EXCEL_GUIDE.md\` 기반 셀별 세부 규칙 매뉴얼 작성 (S/No., Next Step, Alarm Goto, 밸브 태그, Alarm Monitoring, 조기통과 등)

---

## [Q-007] NPM 정적 분석 라이브러리(dependency-cruiser) 도입 및 의존성 Mermaid 플로우차트 작성 (2026-08-22)

**요청 내용:**
- 디렉토리 구조 및 파일 간 require/import 의존 관계를 Mermaid.js 플로우차트로 작성
- 정적 분석을 위해 dependency-cruiser 도입

**처리 내역:**
1. \`dependency-cruiser\` 라이브러리 설치 및 \`.dependency-cruiser.cjs\` 설정 파일 생성
2. \`package.json\`에 \`npm run analyze:mermaid\`, \`npm run analyze:deps\` 스크립트 추가
3. 백엔드 주요 모듈 간 require 의존 관계 Mermaid 다이어그램 작성 완료

---

## [Q-008] PLC 모니터링 & GMS 서버 기동 (\`npm start\`) (2026-08-22)

**요청 내용:**
- \`npm start\` 실행 요청

**처리 내역:**
1. Express HTTP 및 WebSocket 서버 백그라운드 구동 (\`http://localhost:3000\`)
2. 세션 로그 파일 정상 생성 및 폴링 준비 완료

---

## [Q-009] CONFIG 미사용 설정값 일괄 정리 및 설정명/ID 매칭 구조 분석 (2026-08-22)

**요청 내용:**
- CONFIG 설정값 중 미사용 항목 정리(삭제)
- 설정명 변경 시 프로그램 영향 여부 확인

**처리 내역:**
1. 전체 86개 설정값 중 실제 16개 서브시퀀스에서 쓰이는 35개 유효 설정값만 남기고 51개 미사용 더미값 일괄 삭제 (\`data/gmsSubSequenceConfig.json\`)
2. 설정명(name)과 ID 매칭 원리 분석: 엔진은 id와 name 둘 다 검색하므로, 설정명을 바꿀 경우 서브시퀀스 엑셀의 \`설정명(비교대상ID)\`도 함께 변경해야 정상 매칭됨을 안내

---

## [Q-010] CONFIG 설정값의 Common(공통) 항목을 A/B측 개별 항목으로 분리 (2026-08-22)

**요청 내용:**
- 측(A/B/공통)에서 Common으로 되어 있는 항목들을 A/B로 개별 분리 요청

**처리 내역:**
1. 9개 Common 설정값(Pulse Vent 횟수, 펌핑 시간, 퍼지 횟수 등)을 각각 \`_A\`, \`_B\`로 복제 분리하여 총 44개 설정값(A측 22개 / B측 22개) 대칭 구조 구축
2. 서브시퀀스 파일 내 \`conditionValue\`를 \`{설정명}_{side}\` 템플릿으로 표준화
3. \`gms-sub-sequence-runner.js\`에 \`subSeqFindConfigRow\` 헬퍼를 추가하여 A/B측 자동 매칭 보강

---

## [Q-011] 16개 공정 전체 시트 통합 마스터 엑셀 생성 및 Main Step 순차 재정렬 (2026-08-22)

**요청 내용:**
- 1차 퍼지, 가압, 실린더교체 등 누락된 공정 시트를 모두 포함한 마스터 엑셀 제작
- 중복되고 뒤섞인 Main Step 번호를 공정 순서대로 순차 정렬

**처리 내역:**
1. 전체 16개 공정 시트를 완벽히 포함한 통합 마스터 엑셀 생성 (\`docs/GMS_Cylinder_Exchange_Master_Total.xlsx\`, \`docs/GMS_SubSequence_Total.xlsx\`)
2. 공정 진행 순서에 맞춰 Main Step 1부터 16까지 1:1 순차 매핑 및 각 시트별 Sub Step 1부터 순차 재정렬:
   - \`[Main 1]\` **IdleCheck_v1** : 교환전 사전확인 (9 Steps)
   - \`[Main 2]\` **Puls_v1** : Puls 잔류가스 Check / Pulse Vent (11 Steps)
   - \`[Main 3]\` **OneP_v1** : 1P 1·2차측 Vent Mode (14 Steps)
   - \`[Main 4]\` **OneP2_v1** : 1P 2차측 Purge (24 Steps)
   - \`[Main 5]\` **OneP3_v1** : 1P Pumping (15 Steps)
   - \`[Main 6]\` **OneP4_v1** : 1P 1차측 Purge (18 Steps)
   - \`[Main 7]\` **ExchL_v1** : 교환전 -L 감압시험 (10 Steps)
   - \`[Main 8]\` **TwoP_v1** : 교환전 2P 2차 배관청소 (18 Steps)
   - \`[Main 9]\` **VtTest_v1** : 교환전 -VT 감압시험 (27 Steps)
   - \`[Main 10]\` **CylReplace_v1** : 용기교체(CC) 실린더 확인 및 교체 (6 Steps)
   - \`[Main 11]\` **Bypass_v1** : Bypass 배관 체크 (34 Steps)
   - \`[Main 12]\` **AfterThreeP_v1** : 교환후 3P 1차 배관청소 (18 Steps)
   - \`[Main 13]\` **AfterPlusL_v1** : 교환후 +L 가압시험 (23 Steps)
   - \`[Main 14]\` **AfterVtTest_v1** : 교환후 -VT 감압시험 (27 Steps)
   - \`[Main 15]\` **AfterFourP_v1** : 교환후 4P 2차 배관청소 (18 Steps)
   - \`[Main 16]\` **AdjustMode_v1** : 압력조정모드 (38 Steps)

---

## [Q-012] CONFIG 설정값의 설명(desc) 엔지니어링 표준 전면 개편 (2026-08-22)

**요청 내용:**
- CONFIG 화면의 설정값 설명 열에 어느 공정/스텝에 어떤 기준으로 적용되고 알람과 어떤 관계가 있는지 상세 작성 요청

**처리 내역:**
1. \`[적용 공정] <Main Step/시퀀스ID>\` | \`[판정 기준] <센서태그> <연산자> <설정값>\` | \`[알람/분기] <Alarm Goto 반복 또는 Alarm Seq 1 셧다운>\` 3단계 표준 포맷 수립
2. \`data/gmsSubSequenceConfig.json\`의 44개 전체 설정값 설명 전면 업데이트 완료

---

## [Q-013] 실린더 교환 전체 공정 옵션 및 취소 분기 Mermaid 플로우차트 작성 (2026-08-22)

**요청 내용:**
- 실린더교환 버튼 클릭부터 옵션 분기 및 취소 버튼 클릭을 반영한 Mermaid 플로우차트 작성

**처리 내역:**
1. 비밀번호 인증, 사전확인, 1P 4개 서브공정 선택, -VT 옵션, CC, Bypass(고압He라인 옵션), +L(PulseVent 옵션), 4P, PC에 이르는 전체 흐름도 작성
2. 각 스텝에서 [취소/중지] 클릭 시 \`All Valves CLOSE\` 및 \`resetCylinderStepStatus()\`를 통한 \`IDLE\` 안전 복구 경로 명시
3. Mermaid 플로우차트 다이어그램 설계 완료
`;

const qnaPath = path.join(__dirname, '../docs/QNA.md');
fs.writeFileSync(qnaPath, content, { encoding: 'utf8' });
console.log('QNA.md rewritten successfully with UTF-8 encoding (size: ' + Buffer.byteLength(content, 'utf8') + ' bytes)');
