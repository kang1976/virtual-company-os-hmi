import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import '../session/fins_session_manager.dart';

/// OMRON FINS over TCP/IP 전송 계층 클래스
///
/// OMRON FINS/TCP 표준 스펙:
/// 1. TCP 소켓 연결 (기본 포트: 9600, TCP_NODELAY 활성화)
/// 2. 노드 번호 자동 할당 핸드셰이크:
///    - Client -> Server (20B): 'FINS' + Length(12) + Command(0) + Error(0) + ClientNode(0)
///    - Server -> Client (24B): 'FINS' + Length(16) + Command(1) + Error(0) + ClientNode(uint32) + ServerNode(uint32)
/// 3. FINS 프레임 송수신:
///    - 송신 시: 'FINS' + Length(8 + fins.len) + Command(2) + Error(0) + [FINS Frame]
///    - 수신 시: 스트림 버퍼링 후 헤더(16B)를 디코딩하여 순수 FINS 프레임을 incomingBytes로 방출
class OmronTcpTransport implements FinsTransport {
  static const List<int> _magic = [0x46, 0x49, 0x4E, 0x53]; // ASCII 'FINS'

  final String plcIp;
  final int plcPort;
  final Duration connectTimeout;
  final void Function(String log)? onLog;

  Socket? _socket;
  StreamSubscription<Uint8List>? _sub;
  final _incomingController = StreamController<Uint8List>.broadcast();
  final BytesBuilder _rxBuffer = BytesBuilder();
  Completer<Uint8List>? _handshakeCompleter;

  bool _connected = false;
  int _clientNode = 0;
  int _serverNode = 0;

  OmronTcpTransport({
    this.plcIp = '192.168.250.1',
    this.plcPort = 9600,
    this.connectTimeout = const Duration(seconds: 5),
    this.onLog,
  });

  @override
  bool get isConnected => _connected;

  @override
  Stream<Uint8List> get incomingBytes => _incomingController.stream;

  /// PLC로부터 자동 할당받은 클라이언트 FINS 노드 번호
  int get clientNode => _clientNode;

  /// PLC 서버의 FINS 노드 번호
  int get serverNode => _serverNode;

  /// TCP 연결 수립 및 노드 자동 할당 핸드셰이크 실행
  Future<bool> connect() async {
    try {
      onLog?.call('[TCP-NET] FINS/TCP 소켓 연결 시도 중 ($plcIp:$plcPort)...');
      _socket = await Socket.connect(plcIp, plcPort, timeout: connectTimeout);
      _socket!.setOption(SocketOption.tcpNoDelay, true);

      _sub = _socket!.listen(
        _onDataReceived,
        onError: (err) {
          onLog?.call('[TCP-ERR] 소켓 오류 발생: $err');
          _cleanup();
        },
        onDone: () {
          onLog?.call('[TCP-NET] PLC 소켓 연결이 종료되었습니다.');
          _cleanup();
        },
        cancelOnError: false,
      );

      // 2. 노드 번호 자동 할당 핸드셰이크 송신
      onLog?.call('[TCP-HANDSHAKE] 노드 주소 자동 할당 요청 송신...');
      _handshakeCompleter = Completer<Uint8List>();
      final handshakePacket = _buildNodeAddressRequest();
      _socket!.add(handshakePacket);
      await _socket!.flush();

      // 핸드셰이크 응답 대기 (최대 3초)
      final handshakeResp = await _handshakeCompleter!.future.timeout(
        const Duration(seconds: 3),
        onTimeout: () {
          throw TimeoutException('FINS/TCP 노드 주소 핸드셰이크 응답 시간 초과');
        },
      );

      _parseNodeAddressResponse(handshakeResp);
      _connected = true;
      onLog?.call('[TCP-NET] ✅ FINS/TCP 연결 및 핸드셰이크 성공! (내 노드: $_clientNode, PLC 노드: $_serverNode)');
      return true;
    } catch (e) {
      onLog?.call('[TCP-ERR] ❌ FINS/TCP 연결 실패: $e');
      _cleanup();
      return false;
    }
  }

  /// 순수 FINS 바이트 프레임을 FINS/TCP 헤더로 래핑하여 전송
  @override
  Future<void> sendBytes(Uint8List finsData) async {
    if (_socket == null || !_connected) {
      throw StateError('FINS/TCP 소켓이 연결되어 있지 않습니다.');
    }

    final totalPayloadLen = 8 + finsData.length; // Command(4) + ErrorCode(4) + FINS Frame
    final b = BytesBuilder();
    b.add(_magic);
    b.add(_uint32Bytes(totalPayloadLen));
    b.add(_uint32Bytes(2)); // Command: 2 (FINS Frame Send)
    b.add(_uint32Bytes(0)); // Error Code: 0
    b.add(finsData);

    final tcpPacket = b.toBytes();
    onLog?.call('[TCP-TX] (${tcpPacket.length}B) >> ${_toHex(tcpPacket)}');
    _socket!.add(tcpPacket);
    await _socket!.flush();
  }

  /// 소켓 종료 및 리소스 해제
  Future<void> disconnect() async {
    _cleanup();
    onLog?.call('[TCP-NET] FINS/TCP 소켓 연결 해제 완료');
  }

  void _cleanup() {
    _connected = false;
    _sub?.cancel();
    _sub = null;
    _socket?.destroy();
    _socket = null;
    _rxBuffer.clear();
    if (_handshakeCompleter != null && !_handshakeCompleter!.isCompleted) {
      _handshakeCompleter!.completeError(StateError('소켓이 닫혔습니다.'));
    }
    _handshakeCompleter = null;
  }

  /// TCP 스트림 수신 청크 버퍼링 및 패킷 파싱 (Deframer)
  void _onDataReceived(Uint8List chunk) {
    _rxBuffer.add(chunk);

    while (true) {
      final currentBytes = _rxBuffer.toBytes();
      if (currentBytes.length < 16) {
        // 헤더(최소 16바이트) 부족: 다음 데이터 대기
        break;
      }

      // 1. 'FINS' 매직 일치 확인
      if (currentBytes[0] != 0x46 ||
          currentBytes[1] != 0x49 ||
          currentBytes[2] != 0x4E ||
          currentBytes[3] != 0x53) {
        // 매직 싱크 깨짐: 1바이트 건너뛰고 재시도
        final skipped = currentBytes.sublist(1);
        _rxBuffer.clear();
        _rxBuffer.add(skipped);
        continue;
      }

      // 2. 헤더의 패킷 길이(Length 필드: 8바이트 이후의 총 바이트 수) 읽기
      final length = _readUint32(currentBytes, 4);
      final totalFrameSize = 8 + length; // Magic(4) + Length(4) + payload(length)

      if (currentBytes.length < totalFrameSize) {
        // 완전한 패킷이 아직 다 도착하지 않음: 추가 수신 대기
        break;
      }

      // 3. 완전한 1개 패킷 추출
      final fullPacket = Uint8List.fromList(currentBytes.sublist(0, totalFrameSize));
      final remaining = currentBytes.sublist(totalFrameSize);
      _rxBuffer.clear();
      _rxBuffer.add(remaining);

      // 4. 패킷 커맨드 확인
      final command = _readUint32(fullPacket, 8);
      final errorCode = _readUint32(fullPacket, 12);

      if (command == 1) {
        // 노드 주소 응답 패킷 (총 24바이트)
        if (_handshakeCompleter != null && !_handshakeCompleter!.isCompleted) {
          _handshakeCompleter!.complete(fullPacket);
        }
      } else if (command == 2) {
        // FINS 프레임 응답 패킷
        if (errorCode != 0) {
          onLog?.call('[TCP-WARN] FINS/TCP 서버 오류 응답: 0x${errorCode.toRadixString(16)}');
        }
        // 헤더 16바이트 제외한 순수 FINS 바이트 추출
        final pureFinsBytes = Uint8List.fromList(fullPacket.sublist(16));
        onLog?.call('[TCP-RX] (${pureFinsBytes.length}B) << ${_toHex(pureFinsBytes)}');
        _incomingController.add(pureFinsBytes);
      } else {
        onLog?.call('[TCP-WARN] 알 수 없는 FINS/TCP 커맨드: 0x${command.toRadixString(16)}');
      }
    }
  }

  Uint8List _buildNodeAddressRequest() {
    final b = BytesBuilder();
    b.add(_magic);
    b.add(_uint32Bytes(12)); // Length: 12바이트 (Command 4 + Error 4 + ClientNode 4)
    b.add(_uint32Bytes(0));  // Command: 0 (Node Address Request)
    b.add(_uint32Bytes(0));  // Error Code: 0
    b.add(_uint32Bytes(0));  // Client Node Address: 0 (자동 할당 요청)
    return b.toBytes();
  }

  void _parseNodeAddressResponse(Uint8List data) {
    if (data.length < 24) {
      throw FormatException('노드 주소 응답 길이 부족 (${data.length}B, 최소 24B 필요)');
    }
    final errorCode = _readUint32(data, 12);
    if (errorCode != 0) {
      throw StateError('노드 주소 할당 오류 (코드: 0x${errorCode.toRadixString(16)})');
    }
    _clientNode = _readUint32(data, 16);
    _serverNode = _readUint32(data, 20);
  }

  static Uint8List _uint32Bytes(int value) {
    final bytes = Uint8List(4);
    final bd = ByteData.sublistView(bytes);
    bd.setUint32(0, value, Endian.big);
    return bytes;
  }

  static int _readUint32(List<int> bytes, int offset) {
    final bd = ByteData.sublistView(Uint8List.fromList(bytes.sublist(offset, offset + 4)));
    return bd.getUint32(0, Endian.big);
  }

  static String _toHex(Uint8List data) {
    if (data.length > 24) {
      final preview = data.take(24).map((b) => b.toRadixString(16).toUpperCase().padLeft(2, '0')).join(' ');
      return '$preview ... (${data.length}B)';
    }
    return data.map((b) => b.toRadixString(16).toUpperCase().padLeft(2, '0')).join(' ');
  }
}
