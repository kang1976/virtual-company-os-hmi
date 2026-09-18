# PLC 모니터링 & GMS 시스템 - 타 PC 설치 및 운영 매뉴얼

> **문서 번호**: DOC-PLC-INSTALL-001  
> **대상 프로그램**: `PLC-Monitoring-Setup.exe` (버전 1.0.0)  
> **배포 파일 위치**: `pc-app/dist-installer/output/PLC-Monitoring-Setup.exe` (약 58.8 MB)  
> **최종 수정일**: 2026-09-18  

---

## 1. 개요 및 시스템 권장 사양

본 설치 패키지는 **별도의 Node.js, Python, 빌드 도구 설치 없이**, 대상 윈도우 PC에서 설치 프로그램 하나로 즉시 구동될 수 있도록 포터블 런타임(`node.exe`)과 프로덕션 라이브러리 전체(`better-sqlite3`, `usb`, `express`, `exceljs` 등)를 압축 번들링한 통합 인스톨러입니다.

### 1.1 하드웨어 및 소프트웨어 사양
* **운영체제**: Microsoft Windows 10 / Windows 11 (64-bit 전용)
* **CPU / RAM**: Intel Core i3 이상 / RAM 4GB 이상 권장
* **디스크 공간**: 최소 300MB 여유 공간
* **통신 인터페이스**:
  * Ethernet (LAN / RJ45) 포트 (Omron FINS UDP/TCP 통신 시)
  * USB 2.0 / 3.0 포트 (Omron CS/CJ PLC 직결 통신 시)

---

## 2. 설치 방법 (3단계)

### 단계 1: 설치 파일 실행
1. 배포된 `PLC-Monitoring-Setup.exe` 파일을 대상 PC의 임의 폴더(바탕화면, 다운로드 등)로 복사합니다.
2. 마우스 우클릭 후 **[관리자 권한으로 실행]**을 권장합니다. (USB 드라이버 등록 및 시작메뉴 등록 권한 필요)

### 단계 2: 설치 마법사 진행
1. **설치 경로 지정**: 기본 경로(`C:\Program Files\PLC Monitoring` 또는 사용자 지정 경로)를 확인합니다.
2. **바탕화면 바로가기**: '바탕화면에 바로가기 아이콘 생성' 체크박스를 확인합니다.
3. **설치 클릭**: 자동으로 약 58MB의 압축 파일이 풀리며 전용 포터블 환경이 구성됩니다. (약 30초~1분 소요)

### 단계 3: Zadig USB 드라이버 설치 (USB 직결 시에만 해당)
* Omron CS/CJ 계열의 내장 USB 포트를 통해 통신하려는 경우, 설치 완료 후 번들된 `Zadig.exe` 드라이버 도구가 안내됩니다.
* USB 연결 후 `Options` -> `List All Devices` -> `OMRON PLC` 선택 -> 드라이버를 `WinUSB`로 교체 설치합니다.
* *※ 이더넷(UDP/TCP) 통신을 사용하는 경우에는 USB 드라이버 설치가 불필요합니다.*

---

## 3. 프로그램 실행 및 접속 방법

### 3.1 프로그램 실행
* 바탕화면의 **[PLC Monitoring]** 바로가기 아이콘을 더블 클릭합니다.
* 백그라운드에서 `run.vbs` 스크립트가 실행되어 콘솔 창 없이 무소음(Headless)으로 서비스가 백그라운드 가동됩니다.

### 3.2 관제 화면 접속
웹 브라우저(Chrome, Edge 권장)를 열고 다음 주소에 접속합니다:
* **GMS 중앙 관제 화면**: `http://localhost:3000/gms.html`
* **메모리 탐색기 / 그리드**: `http://localhost:3000/grid/`
* **실시간 트렌드 모니터링**: `http://localhost:3000/trend/`
* **환경 설정**: `http://localhost:3000/settings.html`

> 💡 **타 PC / 모바일에서 원격 접속 시**:
> 대상 PC의 IP가 `192.168.1.100`인 경우, 같은 공장 네트워크 내 다른 PC/태블릿에서 `http://192.168.1.100:3000/gms.html`로 접속할 수 있습니다.

---

## 4. 환경 설정 및 통신 연결

1. 브라우저 우측 상단 또는 사이드바의 **[Settings]** 메뉴로 이동합니다.
2. **PLC 연결 파라미터 입력**:
   * **Connection Type**: `UDP` (기본값) / `TCP` / `USB`
   * **PLC IP 주소**: 현장 PLC의 IP (예: `192.168.250.1`)
   * **PLC Port**: 기본 `9600`
   * **FINS 네트워크 주소**: DA1(PLC 노드번호), SA1(PC 노드번호) 설정
3. **[연결 테스트]** 버튼 클릭 후 `연결 성공` 확인
4. 메인 화면으로 복귀하여 실시간 데이터 수집 개시

---

## 5. 문제 해결 (FAQ & 트러블슈팅)

| 증상 | 원인 | 조치 방법 |
| :--- | :--- | :--- |
| 브라우저에서 `localhost:3000` 접속 불가 | 포트 충돌 또는 프로세스 미실행 | 작업 관리자에서 `node.exe`가 실행 중인지 확인. 다른 프로그램이 3000번 포트를 사용 중이면 `settings.json`에서 포트 변경 |
| PLC 연결 실패 (Timeout) | IP 대역 불일치 또는 방화벽 차단 | 대상 PC의 IP가 PLC와 동일 서브넷(예: `192.168.250.xxx`)인지 확인하고 윈도우 방화벽에서 UDP/TCP 9600 허용 |
| USB 통신 에러 | 전용 WinUSB 드라이버 미설치 | `C:\Program Files\PLC Monitoring\installer\driver\zadig.exe`를 실행하여 OMRON 장치에 WinUSB 드라이버 재적용 |
| 윈도우 재부팅 후 자동 실행 | 시작프로그램 미등록 | `C:\Program Files\PLC Monitoring\run.vbs`의 바로가기를 `shell:startup` 폴더에 복사 |

---

## 6. 프로그램 제거(언인스톨)
* 윈도우 [설정] -> [앱 및 기능] -> [PLC Monitoring] -> **[제거]**를 클릭하면 모든 파일과 바로가기가 깨끗하게 삭제됩니다.
