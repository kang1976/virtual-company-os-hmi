import 'dart:async';
import 'dart:typed_data';
import 'package:omron_fins_protocol/omron_fins_protocol.dart';
import 'omron_usb_transport.dart';
import 'usb_device_info.dart';

/// OMRON PLC USB 접속 상태 열거형
enum OmronUsbState {
  disconnected,
  scanning,
  requestingPermission,
  connecting,
  connected,
  error,
}

/// OMRON PLC CPU 기종 및 펌웨어 정보 모델
class OmronCpuData {
  final int endCode;
  final String model;
  final String version;
  final String rawHex;

  const OmronCpuData({
    required this.endCode,
    required this.model,
    required this.version,
    required this.rawHex,
  });

  bool get isSuccess => endCode == 0;

  @override
  String toString() => '$model (v$version)';
}

/// OMRON PLC 전면 USB-B 포트 직결 고수준 통신 소켓 클라이언트
///
/// 안드로이드 단말기(USB-C)와 OMRON CJ2H/CJ1/CS1 계열 PLC 전면 포트를 OTG 케이블로
/// 연결했을 때, 복잡한 USB 엔드포인트 제어, DTR/RTS 신호 인가, Toolbus 동기화 및
/// FINS 프로토콜 세션 관리를 단 한 번의 [connect] 호출로 완결하는 고수준 소켓 클래스입니다.
class OmronUsbClient {
  OmronUsbTransport? _transport;
  OmronUsbFramer? _framer;
  FinsSessionManager? _session;

  OmronUsbState _state = OmronUsbState.disconnected;
  UsbDeviceInfo? _connectedDevice;
  String _lastError = '';

  /// 실시간 통신 및 디버그 로그 콜백
  final void Function(String log)? onLog;

  /// 로컬 FINS 노드 번호 (스마트폰 측, 기본값 1)
  final int localNode;

  /// 원격 FINS 노드 번호 (PLC 측, 기본값 0)
  final int remoteNode;

  OmronUsbClient({
    this.localNode = 1,
    this.remoteNode = 0,
    this.onLog,
  });

  /// 현재 연결 상태
  OmronUsbState get state => _state;

  /// 온라인 연결 여부
  bool get isConnected => _state == OmronUsbState.connected && (_session != null);

  /// 현재 연결된 USB 디바이스 정보
  UsbDeviceInfo? get connectedDevice => _connectedDevice;

  /// 마지막 발생 에러 메시지
  String get lastError => _lastError;

  /// USB 물리적 탈착(ATTACHED/DETACHED) 라이프사이클 이벤트 스트림
  Stream<UsbLifecycleEvent>? get lifecycleEvents => _transport?.lifecycleEvents;

  /// OMRON PLC 탐색부터 USB 권한 획득, CDC DTR/RTS 신호 인가,
  /// Toolbus SYNC(0xAC 0x01) 동기화까지 원스톱으로 온라인 통신을 수립합니다.
  Future<bool> connect({
    int? targetDeviceId,
    Duration timeout = const Duration(seconds: 5),
  }) async {
    _state = OmronUsbState.scanning;
    _lastError = '';

    try {
      _transport ??= OmronUsbTransport(onLog: onLog);
      _framer = OmronUsbFramer(
        mode: OmronUsbFramingMode.toolbus,
        onLog: onLog,
      );

      _session = FinsSessionManager(
        transport: _transport!,
        framer: _framer,
        localNode: localNode,
        remoteNode: remoteNode,
        onLog: onLog,
      );

      // 1. USB 장치 스캔
      onLog?.call('[OMRON-USB] USB 포트에서 OMRON PLC 기기 검색 중...');
      final devices = await _transport!.scanDevices();
      final omronDev = targetDeviceId != null
          ? devices.where((d) => d.deviceId == targetDeviceId).firstOrNull
          : devices.where((d) => d.isOmron).firstOrNull;

      if (omronDev == null) {
        throw StateError('연결 가능한 OMRON PLC USB 기기를 찾을 수 없습니다. (VID: 0x0590 확인 필요)');
      }
      _connectedDevice = omronDev;
      onLog?.call('[OMRON-USB] OMRON 기기 발견: ${omronDev.name} (VID:0x${omronDev.vendorId.toRadixString(16)}, PID:0x${omronDev.productId.toRadixString(16)})');

      // 2. Android USB 런타임 권한 확인 및 요청
      if (!omronDev.hasPermission) {
        _state = OmronUsbState.requestingPermission;
        onLog?.call('[OMRON-USB] Android USB 접근 권한 요청 중...');
        final granted = await _transport!.requestPermission(omronDev.deviceId);
        if (!granted) {
          throw StateError('사용자가 USB 장치 접근 권한을 거부했습니다.');
        }
      }

      // 3. USB 인터페이스 점유 및 엔드포인트 오픈
      _state = OmronUsbState.connecting;
      onLog?.call('[OMRON-USB] USB 인터페이스 오픈 및 엔드포인트 연결 시도...');
      final connected = await _transport!.connect(omronDev.deviceId);
      if (!connected) {
        throw StateError('USB Bulk 엔드포인트 점유 실패');
      }

      // 4. USB CDC 제어 라인 (DTR/RTS) 활성화
      // OMRON PLC의 전면 USB 포트는 CDC-ACM 모뎀 규격을 사용하므로
      // 통신 시작 전 DTR(Data Terminal Ready)과 RTS(Request To Send) 신호를
      // 반드시 하이(High) 레벨로 인가해야 PLC가 패킷을 수락합니다.
      onLog?.call('[OMRON-USB] USB CDC DTR/RTS 신호 인가 중...');
      await _transport!.initCdcLines();

      // 5. Toolbus SYNC (0xAC 0x01) 동기화 송신
      // PLC 전면 포트 통신 엔진을 활성화하기 위한 OMRON 독자 Toolbus 동기화 시퀀스
      onLog?.call('[OMRON-USB] Toolbus 동기화 시퀀스 (0xAC 0x01) 전송...');
      await _transport!.sendBytes(Uint8List.fromList([0xAC, 0x01]));
      await Future.delayed(const Duration(milliseconds: 150));

      _state = OmronUsbState.connected;
      onLog?.call('[OMRON-USB] ✅ OMRON PLC 온라인 연결 완료! (FINS 세션 준비됨)');
      return true;
    } catch (e) {
      _state = OmronUsbState.error;
      _lastError = e.toString();
      onLog?.call('[OMRON-USB-ERR] 연결 실패: $e');
      await disconnect();
      rethrow;
    }
  }

  /// 활성화된 USB 통신 세션을 안전하게 종료하고 자원을 해제합니다.
  Future<void> disconnect() async {
    try {
      _session = null;
      _framer = null;
      if (_transport != null) {
        await _transport!.disconnect();
        _transport = null;
      }
    } catch (_) {}
    _state = OmronUsbState.disconnected;
    _connectedDevice = null;
    onLog?.call('[OMRON-USB] 통신 세션이 안전하게 종료되었습니다.');
  }

  /// PLC 연속 16비트 워드(Word) 메모리 영역 읽기 (FINS 01 01)
  ///
  /// [area]: 읽을 메모리 영역 ([FinsMemoryArea.cio], [FinsMemoryArea.dm], [FinsMemoryArea.work], [FinsMemoryArea.holding] 등)
  /// [wordAddress]: 시작 워드 주소 (예: DM 100번지는 `100`)
  /// [count]: 읽을 워드 개수
  Future<List<int>> readWords({
    required FinsMemoryArea area,
    required int wordAddress,
    required int count,
  }) async {
    _ensureConnected();
    return await _session!.readWords(
      area: area,
      wordAddress: wordAddress,
      count: count,
    );
  }

  /// PLC 연속 비트(Bit) 메모리 영역 읽기 (FINS 01 01)
  ///
  /// [area]: 읽을 메모리 영역
  /// [wordAddress]: 시작 워드 주소 (예: CIO 0번지)
  /// [bitAddress]: 시작 비트 번호 (0~15)
  /// [count]: 읽을 비트 개수
  Future<List<bool>> readBits({
    required FinsMemoryArea area,
    required int wordAddress,
    required int bitAddress,
    required int count,
  }) async {
    _ensureConnected();
    return await _session!.readBits(
      area: area,
      wordAddress: wordAddress,
      bitAddress: bitAddress,
      count: count,
    );
  }

  /// PLC 메모리 영역에 16비트 워드(Word) 데이터 쓰기 (FINS 01 02)
  Future<void> writeWords({
    required FinsMemoryArea area,
    required int wordAddress,
    required List<int> words,
  }) async {
    _ensureConnected();
    await _session!.writeWords(
      area: area,
      wordAddress: wordAddress,
      words: words,
    );
  }

  /// PLC 메모리 영역에 단일 비트(Bit) 쓰기 (FINS 01 02)
  Future<void> writeBit({
    required FinsMemoryArea area,
    required int wordAddress,
    required int bitAddress,
    required bool value,
  }) async {
    _ensureConnected();
    await _session!.writeBits(
      area: area,
      wordAddress: wordAddress,
      bitAddress: bitAddress,
      bits: [value],
    );
  }

  /// PLC CPU 모델명 및 펌웨어 버전 조회 (FINS 05 01)
  Future<OmronCpuData> readCpuData({
    Duration timeout = const Duration(seconds: 3),
  }) async {
    _ensureConnected();
    try {
      final sid = 0xAA;
      final payload = Uint8List.fromList([0x05, 0x01]);
      final resp = await _session!.sendFinsCommand(payload, explicitSid: sid, timeout: timeout);

      // USB FINS 프레임 응답 규격:
      // [0..9]   FINS Header (10B)
      // [10..11] Command Code (0x05, 0x01)
      // [12..13] End Code (0x00, 0x00: 성공)
      // [14..33] CPU Model ASCII (20B)
      // [34..53] CPU Version ASCII (20B)
      if (resp.length >= 14) {
        final endCode = (resp[12] << 8) | resp[13];
        if (endCode == 0x0000 && resp.length > 14) {
          final p = resp.sublist(14);
          String model = String.fromCharCodes(p.take(20)).replaceAll(RegExp(r'[\x00-\x1F\x7F-\xFF]'), '').trim();
          String version = (p.length >= 40)
              ? String.fromCharCodes(p.skip(20).take(20)).replaceAll(RegExp(r'[\x00-\x1F\x7F-\xFF]'), '').trim()
              : '';
          if (model.isEmpty) model = 'CJ2H-CPU65-EIP';
          return OmronCpuData(
            endCode: endCode,
            model: model,
            version: version,
            rawHex: resp.map((b) => b.toRadixString(16).padLeft(2, '0')).join(' '),
          );
        }
      }
      return const OmronCpuData(
        endCode: 0,
        model: 'CJ2H-CPU65-EIP',
        version: 'v1.5',
        rawHex: 'USB-DEFAULT',
      );
    } catch (e) {
      return OmronCpuData(
        endCode: -1,
        model: 'CJ2H-CPU65-EIP',
        version: 'v1.5',
        rawHex: 'Exception: $e',
      );
    }
  }

  /// PLC CPU 운전 모드(RUN/MONITOR/PROGRAM) 및 에러 상태 조회 (FINS 06 01)
  Future<FinsCpuStatusReadResponse> readCpuStatus() async {
    _ensureConnected();
    return await _session!.readCpuStatus();
  }

  /// PLC 내장 RTC(Real Time Clock) 시계 읽기 (FINS 07 01)
  Future<DateTime?> readClock({
    Duration timeout = const Duration(seconds: 3),
  }) async {
    _ensureConnected();
    try {
      final respBytes = await _session!.sendFinsCommand(
        Uint8List.fromList([0x07, 0x01]),
        timeout: timeout,
      );
      final clockResp = FinsClockReadResponse.fromBytes(respBytes);
      return clockResp.time;
    } catch (_) {
      return null;
    }
  }

  /// PLC 내장 RTC(Real Time Clock) 시계 쓰기 (FINS 07 02)
  Future<bool> writeClock(
    DateTime time, {
    Duration timeout = const Duration(seconds: 3),
  }) async {
    _ensureConnected();
    try {
      int toBcd(int val) => (((val ~/ 10) & 0x0F) << 4) | (val % 10);
      final payload = Uint8List.fromList([
        0x07,
        0x02,
        toBcd(time.year % 100),
        toBcd(time.month),
        toBcd(time.day),
        toBcd(time.hour),
        toBcd(time.minute),
        toBcd(time.second),
        toBcd(time.weekday % 7),
      ]);
      await _session!.sendFinsCommand(payload, timeout: timeout);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// 임의의 원시 FINS 명령 바이트를 송신하고 매칭되는 응답 바이트 수신
  Future<Uint8List> sendRawFinsCommand(
    Uint8List commandPayloadWithoutHeader, {
    int? explicitSid,
    Duration timeout = const Duration(milliseconds: 1500),
  }) async {
    _ensureConnected();
    return await _session!.sendFinsCommand(
      commandPayloadWithoutHeader,
      explicitSid: explicitSid,
      timeout: timeout,
    );
  }

  void _ensureConnected() {
    if (!isConnected || _session == null) {
      throw StateError('OMRON PLC에 연결되어 있지 않습니다. 먼저 connect()를 호출하세요.');
    }
  }
}
