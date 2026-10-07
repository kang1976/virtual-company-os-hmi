# [모바일 프로그램 & 관제 시스템] 버전 관리 체계 및 변경 이력 공식 보고서

> **문서 번호**: DOC-VER-20260922-01  
> **보고 일시**: 2026-09-22 21:10 (KST)  
> **수신**: 대표이사 (CEO)  
> **작성 주관**: AI 개발 총괄 어시스턴트  
> **대상 시스템**: Omron CJ2H Direct Monitor (Android 모바일 앱 & 관제 시스템)

---

## 1. 버전 관리 실제 수행 프로세스 (4단계)

모바일 프로그램 및 관제 시스템의 버전 관리는 **다음 4단계의 표준 프로세스**에 따라 엄격하게 통제 및 배포됩니다.

```
[1. 시맨틱 버전 정의] ➔ [2. 소스코드 & 릴리즈노트 반영] ➔ [3. Release APK 최적화 빌드] ➔ [4. 버전별 파일 아카이빙 & Git 보존]
```

### 1.1 버전 번호 체계 (Semantic Versioning: `vMajor.Minor.Patch`)
* **Major (2.x.x)**: 통신 아키텍처 대규모 변경 (예: FINS UDP 직결, Android USB-OTG 네이티브 드라이버 도입)
* **Minor (x.5.x)**: 주요 화면 및 대형 기능 추가 (예: GMS 57개 배관도 인라인 번들링, 30일 로컬 SQLite 스토리지 탑재)
* **Patch (x.x.8)**: 세부 기능 수정, 파형 보정, UI 테마 및 빌드 용량 최적화 (예: 트렌드 폴링타임 10ms~1시간 직접 타이핑 모달 신설, 다크 테마 고정, 52MB 릴리즈 최적화)

### 1.2 소스코드 및 앱 내부 메타데이터 반영 위치
* **앱 패키지 버전 설정**: `projects/plc-monitoring-v1/mobile-app/pubspec.yaml`
  * 설정 예: `version: 2.5.8+10` (버전명 2.5.8, 빌드번호 10)
* **앱 내 [버전 변경이력] 팝업 연동**: `projects/plc-monitoring-v1/mobile-app/lib/main.dart`
  * `_showVersionHistoryDialog()` 함수 내에 버전별 출시일자 및 변경 내역이 영구 코딩되어 있어, 사용자가 스마트폰 화면 상단의 **버전 배지(v2.5.8)**를 터치하면 앱 내에서 실시간 팝업으로 조회 가능합니다.

### 1.3 프로덕션 릴리즈 빌드 및 용량 최적화
* 배포용 파일은 반드시 **Release 모드(`flutter build apk --release`)**로 빌드하여 디버그 심볼과 불필요한 JIT 엔진을 제거합니다.
* **용량 통제**: 디버그 빌드(174MB) 대비 **52.4MB로 압축 경량화**하여 현장 스마트폰 설치 및 구동 속도를 보장합니다.

### 1.4 버전별 바이너리 아카이빙 & Git 형상관리
* 빌드된 APK는 기존 파일을 덮어쓰지 않고 **버전명을 붙여 개별 보관**하므로, 현장에서 이전 버전으로 즉시 롤백 설치가 가능합니다.
* 모든 소스코드 변경 내역은 **Git 커밋(`git log`)**으로 영구 보존되어 언제든 특정 버전 시점의 코드로 복원할 수 있습니다.

---

## 2. 모바일 프로그램 버전별 변경 이력 총괄표 (v2.3.0 ~ v2.5.8)

| 버전 | 릴리즈 일시 | 핵심 변경 및 조치 내역 | 바이너리 용량 | 배포 상태 |
| :---: | :---: | :--- | :---: | :---: |
| **v2.5.8** | **2026-09-22** | • **USB-OTG 케이블 직결 통신** 안정화<br/>• **트렌드 폴링타임 직접 타이핑 (10ms ~ 1시간)** 및 15종 원클릭 프리셋 모달 신설<br/>• **밝은 테마 선택 시 트렌드 다크 테마 고정** (파형 및 범례 가독성 극대화)<br/>• **CSV 저장 시 모바일 폴더 선택 탐색기** 및 규격 파일명(`접두사_TREND_한국날짜시간.CSV`) 자동 생성<br/>• **Release 최적화 빌드 완료 (52.4MB)** | **52.4 MB** | **최신 배포** |
| **v2.5.7** | 2026-09-20 | • GMS P&ID 배관도 SVG 인라인 번들링 탑재 (모바일 오프라인 단독 구동)<br/>• 57개 OPERATION 조작 화면 완전 번들링 (Failed to fetch 완벽 해결)<br/>• GMS 장비 선택 화면 최상단 타이틀(GAS CABINET 등) 및 OMRON 제조사 레이아웃 적용 | 52.3 MB | 이전 버전 |
| **v2.5.6** | 2026-09-20 | • PC 전용 웹 모니터링(포트 3004) 및 PWA 브릿지(포트 3000 HTTPS) 통신 정비<br/>• GMS 장비 선택 화면 서브헤더 표준화 | 52.2 MB | 이전 버전 |
| **v2.5.2** | 2026-09-20 | • PC 관제 설정 항목 100% 통합 (일반/연결/리포트/표시/테마)<br/>• 스마트폰 홈 화면 100% 배율 No-Scroll 컴팩트 최적화<br/>• 첫 화면(홈)에 [접속 모드 변경(로그아웃)] 버튼 신설<br/>• 📱 PLC 세부정보 모달 신설 (운전상태, RTC시계 동기화, 운전모드 제어) | 52.1 MB | 이전 버전 |
| **v2.5.1** | 2026-09-20 | • GMS 및 모니터링 탭 위치 사용자 최적화 (GMS 우선 배치)<br/>• 상단 앱바 줌(확대/축소) & 전체화면 컨트롤 통합<br/>• GMS 통신/폴링 설정 아코디언(접기/펼치기) 적용<br/>• 버전 배지 터치 시 릴리즈 변경이력 팝업 신설 | 52.0 MB | 이전 버전 |
| **v2.5.0** | 2026-09-20 | • 사이버 인더스트리얼 테마 전용 런처 아이콘 전면 교체<br/>• 화면 하단 고정 통신 로그 패널 삭제 및 상단 모달 팝업화 (100% 전체화면 확보)<br/>• 스마트폰 로컬 1달(30일) 롤링 SQLite 스토리지 탑재 (`plc_mobile_30d.db`) | 51.8 MB | 이전 버전 |
| **v2.4.0** | 2026-08-31 | • Android 네이티브 USB OTG 직결 FINS 통신 드라이버 구현<br/>• P&ID 그래픽 배관도 SVG 렌더링 연동 | 51.2 MB | 이전 버전 |
| **v2.3.0** | 2026-08-25 | • Omron CJ2H FINS UDP 고속 직결 통신 드라이버 구현 (0.01초 주기)<br/>• 실시간 시계열 인터랙티브 트렌드 분석 차트 탑재 | 50.5 MB | 초기 버전 |

---

## 3. 실물 소스코드 및 배포 파일 위치

대표님께서 확인 및 다운로드하실 수 있는 실제 파일 경로입니다.

### 📱 최신 릴리즈 APK 설치 파일
1. **루트 배포 파일**: [`Omron_CJ2H_Direct_Monitor_v2.5.8.apk`](file:///d:/AI_Work/Antigravity/06.CEO/Omron_CJ2H_Direct_Monitor_v2.5.8.apk) (52.4MB)
2. **모바일 설치 프로그램 보관 폴더**: [`모바일 설치 프로그램/Omron_CJ2H_Direct_Monitor_v2.5.8.apk`](file:///d:/AI_Work/Antigravity/06.CEO/모바일%20설치%20프로그램/Omron_CJ2H_Direct_Monitor_v2.5.8.apk) (52.4MB)
3. **기본 설치용 심볼릭 파일**: [`Omron_CJ2H_Direct_Monitor.apk`](file:///d:/AI_Work/Antigravity/06.CEO/Omron_CJ2H_Direct_Monitor.apk) (52.4MB)

### 💻 소스코드 및 메타데이터 파일
1. **버전 메타데이터 정의 파일**: [`projects/plc-monitoring-v1/mobile-app/pubspec.yaml`](file:///d:/AI_Work/Antigravity/06.CEO/projects/plc-monitoring-v1/mobile-app/pubspec.yaml)
2. **앱 메인 소스 및 릴리즈 팝업 코드**: [`projects/plc-monitoring-v1/mobile-app/lib/main.dart`](file:///d:/AI_Work/Antigravity/06.CEO/projects/plc-monitoring-v1/mobile-app/lib/main.dart#L4471-L4654)
3. **서버 1-Click 통합 기동기**: [`start_all.bat`](file:///d:/AI_Work/Antigravity/06.CEO/start_all.bat)

---

## 4. 보고 및 책임 체계

* **보고 주체**: AI 개발 총괄 어시스턴트가 대표님의 지시사항을 직접 접수하여 코드를 수정한 후, **수정 내역·변경된 버전 번호·릴리즈 APK 파일·동작 검증 결과**를 종합하여 대표님께 직속으로 보고합니다.
* **보고서 갱신 원칙**: 기능 추가나 패치가 발생할 때마다 본 공식 보고서([`docs/CEO_VERSION_MANAGEMENT_AND_OPERATIONS_REPORT.md`](file:///d:/AI_Work/Antigravity/06.CEO/docs/CEO_VERSION_MANAGEMENT_AND_OPERATIONS_REPORT.md))에 변경 이력을 누적하여 최신 상태로 유지합니다.
