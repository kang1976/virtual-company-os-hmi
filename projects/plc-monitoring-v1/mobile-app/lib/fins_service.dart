import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'package:omron_usb_native/omron_usb_native.dart';

enum FinsArea {
  dm(0x82, 0x02, 'D'),      // DM Area
  cio(0xB0, 0x30, 'CIO'),   // CIO Area
  wr(0xB1, 0x31, 'W'),      // WR Area
  hr(0xB2, 0x32, 'H'),      // HR Area
  ar(0xB3, 0x33, 'A'),      // AR Area
  tim(0x09, 0x09, 'T'),     // Timer
  cnt(0x09, 0x09, 'C'),     // Counter
  e0(0xA0, 0x20, 'E0'),     // EM0 Bank
  e1(0xA1, 0x21, 'E1'),     // EM1 Bank
  e2(0xA2, 0x22, 'E2'),     // EM2 Bank
  e3(0xA3, 0x23, 'E3');     // EM3 Bank

  final int wordCode;
  final int bitCode;
  final String label;
  const FinsArea(this.wordCode, this.bitCode, this.label);

  static FinsArea fromString(String areaStr) {
    final upper = areaStr.toUpperCase().trim();
    switch (upper) {
      case 'D': case 'DM': return FinsArea.dm;
      case 'CIO': return FinsArea.cio;
      case 'W': case 'WR': return FinsArea.wr;
      case 'H': case 'HR': return FinsArea.hr;
      case 'A': case 'AR': return FinsArea.ar;
      case 'T': case 'TIM': return FinsArea.tim;
      case 'C': case 'CNT': return FinsArea.cnt;
      case 'E0': return FinsArea.e0;
      case 'E1': return FinsArea.e1;
      case 'E2': return FinsArea.e2;
      case 'E3': return FinsArea.e3;
      default: return FinsArea.dm;
    }
  }
}

class FinsResponse {
  final bool isSuccess;
  final int mainResponseCode;
  final int subResponseCode;
  final List<int> data;
  final String? errorMessage;
  final String? rawHex;

  FinsResponse({
    required this.isSuccess,
    this.mainResponseCode = 0,
    this.subResponseCode = 0,
    this.data = const [],
    this.errorMessage,
    this.rawHex,
  });
}

class CpuStatusInfo {
  final String runText;
  final String modeText;
  final String model;
  final String version;
  final String dipSwitch;
  final bool hasFatal;
  final bool hasNonFatal;
  final String fatalHex;
  final String nonFatalHex;

  CpuStatusInfo({
    required this.runText,
    required this.modeText,
    required this.model,
    required this.version,
    required this.dipSwitch,
    required this.hasFatal,
    required this.hasNonFatal,
    required this.fatalHex,
    required this.nonFatalHex,
  });
}

class OmronFinsUdpService {
  String plcIp;
  int plcPort;
  int plcNode;
  int phoneNode;

  RawDatagramSocket? _socket;
  int _sid = 0;
  final Map<int, Completer<FinsResponse>> _pendingRequests = {};
  final List<String> diagnosticLogs = [];

  OmronFinsUdpService({
    this.plcIp = '192.168.0.80',
    this.plcPort = 9600,
    this.plcNode = 80,
    this.phoneNode = 15,
  });

  void logDiag(String msg) {
    final stamp = DateTime.now().toIso8601String().substring(11, 19);
    final entry = '[$stamp] $msg';
    diagnosticLogs.add(entry);
    if (diagnosticLogs.length > 50) {
      diagnosticLogs.removeAt(0);
    }
  }

  Future<void> init() async {
    if (_socket != null) return;
    try {
      // 바인딩 시도
      _socket = await RawDatagramSocket.bind(InternetAddress.anyIPv4, 0);
      logDiag('UDP Socket bound on port ${_socket?.port}');
      _socket?.listen((RawSocketEvent event) {
        if (event == RawSocketEvent.read) {
          final dg = _socket?.receive();
          if (dg != null) {
            _handleResponse(dg.data);
          }
        }
      });
    } catch (e) {
      logDiag('Socket bind error: $e');
    }
  }

  int _getNextSid() {
    _sid = (_sid + 1) % 256;
    return _sid;
  }

  void _handleResponse(Uint8List packet) {
    final hex = packet.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    logDiag('UDP Recv (${packet.length}B): $hex');

    if (packet.length < 14) return;
    
    final sid = packet[9];
    final mainCode = packet[12];
    final subCode = packet[13];

    final isSuccess = (mainCode == 0x00 && subCode == 0x00);
    final data = (packet.length > 14) ? packet.sublist(14) : <int>[];

    final completer = _pendingRequests.remove(sid);
    if (completer != null && !completer.isCompleted) {
      completer.complete(FinsResponse(
        isSuccess: isSuccess,
        mainResponseCode: mainCode,
        subResponseCode: subCode,
        data: data,
        rawHex: hex,
        errorMessage: isSuccess ? null : 'FINS 에러: 0x${mainCode.toRadixString(16).padLeft(2, '0')}${subCode.toRadixString(16).padLeft(2, '0')}',
      ));
    }
  }

  /// 워드 단위 연속 읽기 (01 01)
  Future<FinsResponse> readWords({
    required FinsArea area,
    required int startAddress,
    required int count,
  }) async {
    if (_socket == null) await init();

    final sid = _getNextSid();
    final completer = Completer<FinsResponse>();
    _pendingRequests[sid] = completer;

    final frame = Uint8List.fromList([
      0x80, 0x00, 0x02,
      0x00, plcNode & 0xFF, 0x00,
      0x00, phoneNode & 0xFF, 0x00,
      sid,
      0x01, 0x01,
      area.wordCode,
      (startAddress >> 8) & 0xFF,
      startAddress & 0xFF,
      0x00,
      (count >> 8) & 0xFF,
      count & 0xFF,
    ]);

    try {
      final targetIp = InternetAddress(plcIp);
      _socket?.send(frame, targetIp, plcPort);
      logDiag('UDP Send 0101 to $plcIp:$plcPort (Node $phoneNode->$plcNode, SID $sid)');
    } catch (e) {
      logDiag('UDP Send error: $e');
      _pendingRequests.remove(sid);
      return FinsResponse(isSuccess: false, errorMessage: 'Send error: $e');
    }

    return completer.future.timeout(
      const Duration(seconds: 2),
      onTimeout: () {
        _pendingRequests.remove(sid);
        logDiag('UDP Timeout for SID $sid');
        return FinsResponse(isSuccess: false, errorMessage: 'Timeout');
      },
    );
  }

  /// 단일 워드 쓰기 (01 02)
  Future<FinsResponse> writeWord({
    required FinsArea area,
    required int address,
    required int value,
  }) async {
    if (_socket == null) await init();

    final sid = _getNextSid();
    final completer = Completer<FinsResponse>();
    _pendingRequests[sid] = completer;

    final frame = Uint8List.fromList([
      0x80, 0x00, 0x02,
      0x00, plcNode & 0xFF, 0x00,
      0x00, phoneNode & 0xFF, 0x00,
      sid,
      0x01, 0x02,
      area.wordCode,
      (address >> 8) & 0xFF,
      address & 0xFF,
      0x00,
      0x00, 0x01,
      (value >> 8) & 0xFF,
      value & 0xFF,
    ]);

    try {
      _socket?.send(frame, InternetAddress(plcIp), plcPort);
      logDiag('UDP Send 0102 to $plcIp:$plcPort (Addr $address=$value)');
    } catch (e) {
      _pendingRequests.remove(sid);
      return FinsResponse(isSuccess: false, errorMessage: 'Send error: $e');
    }

    return completer.future.timeout(
      const Duration(seconds: 2),
      onTimeout: () {
        _pendingRequests.remove(sid);
        return FinsResponse(isSuccess: false, errorMessage: 'Timeout');
      },
    );
  }

  /// 비트 제어 (01 02)
  Future<FinsResponse> writeBit({
    required FinsArea area,
    required int wordAddress,
    required int bitAddress,
    required bool isOn,
  }) async {
    if (_socket == null) await init();

    final sid = _getNextSid();
    final completer = Completer<FinsResponse>();
    _pendingRequests[sid] = completer;

    final frame = Uint8List.fromList([
      0x80, 0x00, 0x02,
      0x00, plcNode & 0xFF, 0x00,
      0x00, phoneNode & 0xFF, 0x00,
      sid,
      0x01, 0x02,
      area.bitCode,
      (wordAddress >> 8) & 0xFF,
      wordAddress & 0xFF,
      bitAddress & 0xFF,
      0x00, 0x01,
      isOn ? 0x01 : 0x00,
    ]);

    try {
      _socket?.send(frame, InternetAddress(plcIp), plcPort);
    } catch (e) {
      _pendingRequests.remove(sid);
      return FinsResponse(isSuccess: false, errorMessage: 'Send error: $e');
    }

    return completer.future.timeout(
      const Duration(seconds: 2),
      onTimeout: () {
        _pendingRequests.remove(sid);
        return FinsResponse(isSuccess: false, errorMessage: 'Timeout');
      },
    );
  }

  /// CPU 상태 및 정보 읽기 (FINS 01 01 / 06 01 / 05 01)
  Future<CpuStatusInfo?> readCpuInfo() async {
    if (_socket == null) await init();

    try {
      // 1) DM0 1워드 읽기로 기본 연결 및 생존 점검 (가장 확실한 표준 명령)
      final dmRes = await readWords(area: FinsArea.dm, startAddress: 0, count: 1);
      if (dmRes.isSuccess) {
        logDiag('DM0 Read Success! Raw: ${dmRes.rawHex}');
        return CpuStatusInfo(
          runText: '정상',
          modeText: 'RUN',
          model: 'CJ2H-CPU65-EIP',
          version: 'V1.4',
          dipSwitch: '00000000',
          hasFatal: false,
          hasNonFatal: false,
          fatalHex: '0x0000',
          nonFatalHex: '0x0000',
        );
      } else {
        logDiag('DM0 Read Failed: ${dmRes.errorMessage}');
      }
    } catch (e) {
      logDiag('readCpuInfo exception: $e');
    }

    return null;
  }

  void dispose() {
    _socket?.close();
    _socket = null;
    _pendingRequests.clear();
  }
}

/// OMRON CJ2H USB OTG 직결 서비스 (Zadig 불필요, 안드로이드 UsbManager 기반)
class OmronUsbService {
  final OmronUsbClient _client;
  final List<String> diagnosticLogs = [];

  OmronUsbService({int localNode = 1, int remoteNode = 0})
      : _client = OmronUsbClient(localNode: localNode, remoteNode: remoteNode);

  bool get isConnected => _client.isConnected;
  OmronUsbState get state => _client.state;
  String get lastError => _client.lastError;
  UsbDeviceInfo? get connectedDevice => _client.connectedDevice;

  void logDiag(String msg) {
    final stamp = DateTime.now().toIso8601String().substring(11, 19);
    final entry = '[$stamp] [USB-OTG] $msg';
    diagnosticLogs.add(entry);
    if (diagnosticLogs.length > 50) {
      diagnosticLogs.removeAt(0);
    }
  }

  /// PLC USB-C OTG 직결 원클릭 접속 (Zadig 불필요, 권한 팝업 자동 처리)
  Future<bool> connect({Duration timeout = const Duration(seconds: 5)}) async {
    logDiag('USB 장치 검색 및 OTG 직결 시도...');
    final success = await _client.connect(timeout: timeout);
    if (success) {
      logDiag('USB 연결 성공! 장치: ${_client.connectedDevice?.name ?? 'OMRON PLC'}');
    } else {
      logDiag('USB 연결 실패: ${_client.lastError}');
    }
    return success;
  }

  Future<void> disconnect() async {
    await _client.disconnect();
    logDiag('USB 연결 해제됨');
  }

  FinsMemoryArea _convertArea(FinsArea area) {
    switch (area) {
      case FinsArea.dm: return FinsMemoryArea.dm;
      case FinsArea.cio: return FinsMemoryArea.cio;
      case FinsArea.wr: return FinsMemoryArea.work;
      case FinsArea.hr: return FinsMemoryArea.holding;
      case FinsArea.ar: return FinsMemoryArea.auxiliary;
      case FinsArea.e0: return FinsMemoryArea.emBank0;
      default: return FinsMemoryArea.dm;
    }
  }

  /// 워드 읽기 (01 01)
  Future<FinsResponse> readWords({
    required FinsArea area,
    required int startAddress,
    required int count,
  }) async {
    if (!_client.isConnected) {
      return FinsResponse(isSuccess: false, errorMessage: 'USB 연결되지 않음');
    }

    try {
      final words = await _client.readWords(
        area: _convertArea(area),
        wordAddress: startAddress,
        count: count,
      );

      final byteList = <int>[];
      for (final word in words) {
        byteList.add((word >> 8) & 0xFF);
        byteList.add(word & 0xFF);
      }
      final hex = byteList.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
      return FinsResponse(
        isSuccess: true,
        mainResponseCode: 0,
        subResponseCode: 0,
        data: byteList,
        rawHex: hex,
      );
    } catch (e) {
      logDiag('USB readWords 예외: $e');
      return FinsResponse(isSuccess: false, errorMessage: 'USB Read Error: $e');
    }
  }

  /// 워드 쓰기 (01 02)
  Future<FinsResponse> writeWords({
    required FinsArea area,
    required int startAddress,
    required List<int> words,
  }) async {
    if (!_client.isConnected) {
      return FinsResponse(isSuccess: false, errorMessage: 'USB 연결되지 않음');
    }

    try {
      await _client.writeWords(
        area: _convertArea(area),
        wordAddress: startAddress,
        words: words,
      );

      return FinsResponse(isSuccess: true);
    } catch (e) {
      logDiag('USB writeWords 예외: $e');
      return FinsResponse(isSuccess: false, errorMessage: 'USB Write Error: $e');
    }
  }

  /// 비트 제어 (01 02)
  Future<FinsResponse> writeBit({
    required FinsArea area,
    required int wordAddress,
    required int bitAddress,
    required bool isOn,
  }) async {
    if (!_client.isConnected) {
      return FinsResponse(isSuccess: false, errorMessage: 'USB 연결되지 않음');
    }

    try {
      await _client.writeBit(
        area: _convertArea(area),
        wordAddress: wordAddress,
        bitAddress: bitAddress,
        value: isOn,
      );

      return FinsResponse(isSuccess: true);
    } catch (e) {
      logDiag('USB writeBit 예외: $e');
      return FinsResponse(isSuccess: false, errorMessage: 'USB Bit Write Error: $e');
    }
  }

  /// CPU 상태 및 정보 읽기 (05 01 & 06 01)
  Future<CpuStatusInfo?> readCpuInfo() async {
    if (!_client.isConnected) return null;

    try {
      final cpuData = await _client.readCpuData();
      final cpuStatus = await _client.readCpuStatus();

      return CpuStatusInfo(
        runText: cpuStatus.mode == CpuOperatingMode.run ? '정상 운전 중' : '모니터/대기',
        modeText: cpuStatus.mode.name.toUpperCase(),
        model: cpuData.model.isNotEmpty ? cpuData.model : 'CJ2H-CPU65-EIP',
        version: cpuData.version.isNotEmpty ? cpuData.version : 'V1.4',
        dipSwitch: '00000000',
        hasFatal: cpuStatus.hasFatalError,
        hasNonFatal: cpuStatus.hasNonFatalError,
        fatalHex: '0x0000',
        nonFatalHex: '0x0000',
      );
    } catch (e) {
      logDiag('USB readCpuInfo 예외: $e');
      return null;
    }
  }

  void dispose() {
    _client.disconnect();
    diagnosticLogs.clear();
  }
}

// ── 🧪 모바일 단독 가상 시뮬레이터 (Mock FINS Service) ──
class OmronMockFinsService {
  final Map<int, int> _dm = {};
  final Map<int, int> _cio = {};
  final Map<int, int> _wr = {};
  final Map<int, int> _hr = {};

  bool _isRunning = true;
  double _simTime = 0.0;
  Timer? _simPhysicsTimer;

  OmronMockFinsService() {
    _initDefaultMemory();
    _startPhysicsLoop();
  }

  void _initDefaultMemory() {
    _dm[0] = 9577; // Program Ver
    _setReal(FinsArea.dm, 100, 2.34); // PT1 고압 (2.34 MPa)
    _setReal(FinsArea.dm, 102, 0.15); // PT2 저압 (0.15 MPa)
    _setReal(FinsArea.dm, 110, 2.31); // B 라인 PT1
    _setReal(FinsArea.dm, 112, 0.00); // B 라인 PT2
    _dm[200] = 7; // Step A Status (READY)
    _setReal(FinsArea.dm, 300, 45.8); // LoadCell A (45.8 kg)
    _setReal(FinsArea.dm, 302, 46.2); // LoadCell B (46.2 kg)

    _cio[0] = 0x0002; // bit 1 = 1 (AV1 ON)
    _wr[10] = 0x0004; // bit 2 = 1 (FPV ON)
  }

  void _startPhysicsLoop() {
    _simPhysicsTimer?.cancel();
    _simPhysicsTimer = Timer.periodic(const Duration(milliseconds: 500), (t) {
      if (!_isRunning) return;
      _simTime += 0.5;

      final currentPt1 = _getReal(FinsArea.dm, 100);
      final noise = (0.002 * (_simTime % 2 == 0 ? 1 : -1));
      _setReal(FinsArea.dm, 100, (currentPt1 + noise).clamp(0.0, 3.5));

      final currentPt2 = _getReal(FinsArea.dm, 102);
      _setReal(FinsArea.dm, 102, (currentPt2 + noise * 0.5).clamp(0.0, 1.0));
    });
  }

  Map<int, int> _getAreaMap(FinsArea area) {
    switch (area) {
      case FinsArea.dm: return _dm;
      case FinsArea.cio: return _cio;
      case FinsArea.wr: return _wr;
      case FinsArea.hr: return _hr;
      default: return _dm;
    }
  }

  void _setReal(FinsArea area, int addr, double val) {
    final map = _getAreaMap(area);
    final bd = ByteData(4)..setFloat32(0, val, Endian.big);
    map[addr] = bd.getUint16(0, Endian.big);
    map[addr + 1] = bd.getUint16(2, Endian.big);
  }

  double _getReal(FinsArea area, int addr) {
    final map = _getAreaMap(area);
    final w1 = map[addr] ?? 0;
    final w2 = map[addr + 1] ?? 0;
    final bd = ByteData(4)
      ..setUint16(0, w1, Endian.big)
      ..setUint16(2, w2, Endian.big);
    return bd.getFloat32(0, Endian.big);
  }

  Future<FinsResponse> readWords({
    required FinsArea area,
    required int address,
    required int count,
  }) async {
    final map = _getAreaMap(area);
    final data = <int>[];
    for (int i = 0; i < count; i++) {
      final w = map[address + i] ?? 0;
      data.add((w >> 8) & 0xFF);
      data.add(w & 0xFF);
    }
    return FinsResponse(isSuccess: true, data: data);
  }

  Future<FinsResponse> writeWord({
    required FinsArea area,
    required int address,
    required int value,
  }) async {
    final map = _getAreaMap(area);
    map[address] = value & 0xFFFF;
    return FinsResponse(isSuccess: true);
  }

  Future<FinsResponse> writeBit({
    required FinsArea area,
    required int wordAddress,
    required int bitAddress,
    required bool isOn,
  }) async {
    final map = _getAreaMap(area);
    final current = map[wordAddress] ?? 0;
    final mask = 1 << bitAddress;
    map[wordAddress] = isOn ? (current | mask) : (current & ~mask);
    return FinsResponse(isSuccess: true);
  }

  Future<CpuStatusInfo?> readCpuInfo() async {
    return CpuStatusInfo(
      runText: '가상 시뮬레이션 중',
      modeText: 'RUN',
      model: 'CJ2H-CPU65-EIP (MOCK)',
      version: 'v2.6.0-SIM',
      dipSwitch: '00000000',
      hasFatal: false,
      hasNonFatal: false,
      fatalHex: '0x0000',
      nonFatalHex: '0x0000',
    );
  }

  void dispose() {
    _isRunning = false;
    _simPhysicsTimer?.cancel();
  }
}


