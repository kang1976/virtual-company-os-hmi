import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import '../session/fins_session_manager.dart';

/// Implements FinsTransport over UDP socket for Wi-Fi/Ethernet network communication
class OmronUdpTransport implements FinsTransport {
  final String plcIp;
  final int plcPort;
  final void Function(String log)? onLog;

  final int localNode;
  final int remoteNode;

  RawDatagramSocket? _socket;
  final _incomingController = StreamController<Uint8List>.broadcast();
  bool _connected = false;

  OmronUdpTransport({
    this.plcIp = '192.168.250.1',
    this.plcPort = 9600,
    int? localNode,
    int? remoteNode,
    this.onLog,
  })  : localNode = localNode ?? 1,
        remoteNode = remoteNode ?? _extractDefaultNode(plcIp);

  static int _extractDefaultNode(String ip) {
    try {
      final parts = ip.split('.');
      if (parts.length == 4) {
        return int.parse(parts[3]) & 0xFF;
      }
    } catch (_) {}
    return 1;
  }

  @override
  bool get isConnected => _connected;

  @override
  Stream<Uint8List> get incomingBytes => _incomingController.stream;

  Future<bool> connect() async {
    try {
      _socket = await RawDatagramSocket.bind(InternetAddress.anyIPv4, 0);
      _socket!.listen((event) {
        if (event == RawSocketEvent.read) {
          final dg = _socket!.receive();
          if (dg != null) {
            onLog?.call('[UDP-RX] ${dg.data.length}B << ${_toHex(dg.data)}');
            _incomingController.add(dg.data);
          }
        }
      }, onError: (err) {
        onLog?.call('[UDP-ERR] 소켓 오류: $err');
      });
      _connected = true;
      onLog?.call('[UDP-NET] FINS UDP 소켓 바인딩 성공 (Local Port: ${_socket!.port} -> Remote: $plcIp:$plcPort)');
      return true;
    } catch (e) {
      onLog?.call('[UDP-ERR] 소켓 바인딩 실패: $e');
      _connected = false;
      return false;
    }
  }

  @override
  Future<void> sendBytes(Uint8List data) async {
    if (_socket == null || !_connected) {
      throw StateError('UDP Socket not connected');
    }
    final sent = _socket!.send(data, InternetAddress(plcIp), plcPort);
    if (sent <= 0) {
      onLog?.call('[UDP-WARN] UDP 패킷 전송 경고 (전송 바이트: $sent)');
    }
  }

  Future<void> disconnect() async {
    _socket?.close();
    _socket = null;
    _connected = false;
    onLog?.call('[UDP-NET] FINS UDP 소켓 연결 종료');
  }

  static String _toHex(Uint8List data) {
    if (data.length > 24) {
      final preview = data.take(24).map((b) => b.toRadixString(16).toUpperCase().padLeft(2, '0')).join(' ');
      return '$preview ... (${data.length}B)';
    }
    return data.map((b) => b.toRadixString(16).toUpperCase().padLeft(2, '0')).join(' ');
  }
}
