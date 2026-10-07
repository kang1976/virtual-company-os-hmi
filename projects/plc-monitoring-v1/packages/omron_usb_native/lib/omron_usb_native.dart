/// OMRON PLC USB OTG 직결 네이티브 통신 및 FINS 프로토콜 통합 패키지
///
/// 안드로이드 스마트폰(USB-C)과 OMRON CJ2H/CJ1/CS1 계열 PLC 전면 USB-B 포트를
/// 연결하여 실시간 고속 PLC 메모리 I/O, CPU 모니터링, RTC 시계 동기화를 수행합니다.
library omron_usb_native;

// 고수준 소켓 클라이언트 및 디바이스 모델
export 'src/omron_usb_client.dart';
export 'src/usb_device_info.dart';
export 'src/omron_usb_transport.dart';

// FINS 프로토콜 핵심 타입 Re-export (외부 프로젝트 편의성 제공)
export 'package:omron_fins_protocol/omron_fins_protocol.dart'
    show
        FinsMemoryArea,
        FinsHeader,
        FinsEndCode,
        CpuOperatingMode,
        FinsCpuStatusReadResponse,
        FinsCpuStatusReadCommand,
        FinsClockReadResponse,
        OmronUsbFramingMode,
        OmronUsbFramer,
        FinsSessionManager;
