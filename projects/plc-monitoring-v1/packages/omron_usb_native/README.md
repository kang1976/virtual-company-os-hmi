# OMRON PLC USB OTG 직결 통신 패키지 (`omron_usb_native`)

> **개발/검증**: 20년 차 시니어 PLC/임베디드 엔지니어링 멘토링  
> **지원 플랫폼**: Android (USB-C OTG Host)  
> **지원 대상 PLC**: OMRON CJ2H, CJ1M, CJ1G, CJ1H, CS1G, CS1H 전면 USB-B 포트  

---

## 1. 개요 및 특징

이 패키지는 안드로이드 모바일 기기(스마트폰/태블릿)를 USB-C OTG 케이블로 OMRON CJ/CS 계열 PLC의 전면 USB-B 포트에 직결하여, **별도의 이더넷 스위치나 통신 모듈 없이도 실시간 고속 PLC 메모리 읽기/쓰기 및 진단을 수행할 수 있게 해주는 완성형 통신 소켓 엔진**입니다.

### 🌟 핵심 제공 기능
1. **원클릭 자동 핸드셰이크 (`connect()`)**:
   - 안드로이드 USB Host API를 통한 OMRON VID(`0x0590`) 장치 자동 검색.
   - Android OS 런타임 USB 권한 팝업 자동 요청 및 엔드포인트 점유.
   - **USB CDC DTR/RTS 신호 자동 인가**: OMRON 내장 모뎀 칩셋 활성화.
   - **Toolbus SYNC(`0xAC 0x01`) 동기화**: PLC 전면 포트 통신 엔진 시동.
2. **직관적인 고수준 FINS API**:
   - 워드 단위 읽기/쓰기 (`readWords`, `writeWords`) - DM, CIO, WR, HR, AR 영역 완벽 지원.
   - 비트 단위 접점 제어 (`readBits`, `writeBit`) - 현장 센서/솔레노이드 제어.
   - CPU 정보 및 상태 진단 (`readCpuData`, `readCpuStatus`) - 기종명(`CJ2H-CPU65-EIP`), 펌웨어, 운전모드(RUN/MONITOR/PROGRAM) 조회.
   - PLC 내장 RTC 시계 동기화 (`readClock`, `writeClock`).
3. **실시간 통신 디버깅 및 탈착 감지**:
   - 실시간 FINS 패킷 Hex 덤프 및 타임아웃/재시도 자동 관리.
   - USB 케이블 물리적 탈착(DETACHED) 실시간 스트림 제공.

---

## 2. 다른 프로젝트에 5분 만에 적용하기 (Quick Start)

### [1단계] `pubspec.yaml` 의존성 추가
새로운 프로젝트나 다른 프로젝트의 `pubspec.yaml`에 본 패키지를 추가합니다.

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # OMRON USB 통신 엔진 (로컬 경로 또는 Git 저장소)
  omron_usb_native:
    path: ../packages/omron_usb_native
```

> **Note**: `omron_usb_native` 패키지는 FINS 프로토콜 파서인 `omron_fins_protocol`을 내부적으로 포함하고 재수출(re-export)하므로, 별도로 프로토콜 라이브러리를 추가할 필요가 없습니다!

---

### [2단계] Android 네이티브 설정 (필수 2가지)

OMRON PLC 전면 포트는 산업용 USB 장치이므로, 안드로이드 OS가 장치를 인식하고 통신 권한을 부여할 수 있도록 설정해야 합니다.

#### 1) `android/app/src/main/res/xml/device_filter.xml` 생성
프로젝트의 `android/app/src/main/res/xml/` 폴더에 `device_filter.xml` 파일을 생성하고 아래 내용을 입력합니다:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- OMRON Corporation Vendor ID: 0x0590 (1424) -->
    <!-- CJ2H / CJ1 / CS1 USB Peripheral Port Product ID: 0x005B (91) -->
    <usb-device vendor-id="1424" product-id="91" />
    <usb-device vendor-id="1424" />
</resources>
```

#### 2) `android/app/src/main/AndroidManifest.xml` 수정
`<manifest>` 태그 바로 아래에 USB Host 하드웨어 요구사항을 추가하고, `<activity>` 안에 인텐트 필터를 추가합니다:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- [필수] USB Host 기능 선언 -->
    <uses-feature android:name="android.hardware.usb.host" />

    <application ...>
        <activity ...>
            
            <!-- [필수] OMRON USB 장치 연결 시 앱 감지 및 권한 연결 -->
            <intent-filter>
                <action android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED" />
            </intent-filter>
            <meta-data
                android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED"
                android:resource="@xml/device_filter" />

        </activity>
    </application>
</manifest>
```

---

### [3단계] 코드에서 바로 사용하기 (단 10줄로 통신 수립)

```dart
import 'package:flutter/material.dart';
import 'package:omron_usb_native/omron_usb_native.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 1. 클라이언트 생성
  final client = OmronUsbClient(
    onLog: (msg) => print('[PLC-LOG] $msg'),
  );

  // 2. USB 온라인 연결 (스캔 -> 권한 획득 -> DTR/RTS -> Toolbus 동기화 자동 완결)
  final isConnected = await client.connect();
  if (isConnected) {
    print('✅ PLC 온라인 연결 성공!');

    // 3. CPU 모델명 및 운전 모드 조회
    final cpu = await client.readCpuData();
    final status = await client.readCpuStatus();
    print('CPU 모델: ${cpu.model}, 모드: ${status.mode.name}');

    // 4. DM 100번지부터 5워드 읽기
    final dmWords = await client.readWords(
      area: FinsMemoryArea.dm,
      wordAddress: 100,
      count: 5,
    );
    print('DM100 값: $dmWords');

    // 5. CIO 0.00 비트(출력) ON 쓰기
    await client.writeBit(
      area: FinsMemoryArea.cio,
      wordAddress: 0,
      bitAddress: 0,
      value: true,
    );
    print('CIO 0.00 접점 ON 출력 완료');
  }
}
```

---

## 3. 핵심 API 레퍼런스

### `OmronUsbClient` 클래스

| 메서드 | 설명 | 주요 매개변수 / 반환값 |
| :--- | :--- | :--- |
| `connect()` | PLC USB 탐색 및 온라인 세션 수립 | 반환: `Future<bool>` |
| `disconnect()` | 통신 세션 종료 및 USB 포트 해제 | 반환: `Future<void>` |
| `readWords(...)` | 16비트 워드 데이터 연속 읽기 | `area`, `wordAddress`, `count` -> `Future<List<int>>` |
| `readBits(...)` | 단일/연속 비트 데이터 읽기 | `area`, `wordAddress`, `bitAddress`, `count` -> `Future<List<bool>>` |
| `writeWords(...)` | 16비트 워드 데이터 연속 쓰기 | `area`, `wordAddress`, `words` -> `Future<void>` |
| `writeBit(...)` | 단일 비트 접점 쓰기 | `area`, `wordAddress`, `bitAddress`, `value` -> `Future<void>` |
| `readCpuData()` | CPU 모델명 및 펌웨어 버전 조회 | 반환: `Future<OmronCpuData>` (`model`, `version`) |
| `readCpuStatus()` | CPU 운전 모드 및 에러 상태 조회 | 반환: `Future<FinsCpuStatusReadResponse>` |
| `readClock()` | PLC 내부 RTC 현재 시각 조회 | 반환: `Future<DateTime?>` |
| `writeClock(time)`| PLC 내부 RTC 시각 동기화 쓰기 | `time` -> `Future<bool>` |
| `sendRawFinsCommand(...)` | 임의의 원시 FINS 바이트 송수신 | `commandPayload` -> `Future<Uint8List>` |

### 지원 메모리 영역 (`FinsMemoryArea`)
- `FinsMemoryArea.cio`: 입출력 릴레이 (CIO 영역)
- `FinsMemoryArea.dm`: 데이터 메모리 (DM 영역)
- `FinsMemoryArea.work`: 내부 보조 릴레이 (WR 영역)
- `FinsMemoryArea.holding`: 정전 유지 릴레이 (HR 영역)
- `FinsMemoryArea.auxiliary`: 특수 보조 릴레이 (AR 영역)

---

## 4. 20년 차 시니어가 전수하는 현장 PLC USB 통신 실무 노하우

### Q1. 일반 USB 통신 라이브러리를 쓰면 왜 OMRON PLC와 연결이 안 될까요?
> **비하인드 스토리**:  
> OMRON CJ2H 전면의 USB 포트는 겉보기엔 일반 시리얼 포트처럼 보이지만, 내부적으로 **CDC-ACM(가상 모뎀) 인터페이스**로 설계되어 있습니다.  
> 따라서 단순히 USB 포트를 오픈하는 것만으로는 PLC CPU가 응답하지 않으며, 반드시 운영체제 레벨에서 **DTR(Data Terminal Ready)과 RTS(Request To Send)** 제어 라인을 활성화해주어야 합니다.  
> 본 패키지의 `OmronUsbTransport.initCdcLines()`가 이 신호를 자동으로 인가하여 하드웨어 락을 해제합니다.

### Q2. Toolbus `0xAC 0x01` 동기화는 왜 필요한가요?
> OMRON PLC의 전면 포트는 'Toolbus(주변기기 전용)' 모드로 동작합니다.  
> CX-Programmer나 터치스크린이 연결될 때 최초로 전송하는 매직 시퀀스가 바로 `0xAC 0x01`입니다. 이 패킷을 수신해야만 PLC CPU 통신 태스크가 대기 상태에서 활성 상태로 전환됩니다. 본 패키지는 연결 즉시 이 동기화를 자동 수행합니다.

### Q3. 현장 케이블 및 OTG 젠더 선정 주의사항
- **반드시 '데이터 전송 가능(Data Sync)' OTG 케이블**을 사용해야 합니다. 시중의 저가형 케이블 중에는 VBUS/GND 전원 핀만 연결된 '충전 전용' 케이블이 많으므로 주의하십시오.
- 공장 설비 내부에는 대용량 모터, 인버터, 솔레노이드 밸브로 인한 **강한 노이즈(EMI/Surge)**가 존재합니다. 가급적 **페라이트 코어(노이즈 필터)가 장착된 쉴드 USB 케이블**을 권장합니다.

---

## 5. 라이선스 및 기술 지원
- 사내 전용 프로젝트 및 반도체/가스 캐비닛/산업 설비 점검 장비에 자유롭게 사용 가능합니다.
