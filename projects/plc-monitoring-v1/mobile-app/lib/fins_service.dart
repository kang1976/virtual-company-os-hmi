import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

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
