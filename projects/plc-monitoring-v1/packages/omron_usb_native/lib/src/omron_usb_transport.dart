import 'dart:async';
import 'package:flutter/services.dart';
import 'package:omron_fins_protocol/omron_fins_protocol.dart';
import 'usb_device_info.dart';

/// Implements FinsTransport over Android USB Host API
class OmronUsbTransport implements FinsTransport {
  static const MethodChannel _methodChannel =
      MethodChannel('com.iconnmake.omron_usb_native/methods');
  static const EventChannel _byteChannel =
      EventChannel('com.iconnmake.omron_usb_native/bytes');
  static const EventChannel _lifecycleChannel =
      EventChannel('com.iconnmake.omron_usb_native/lifecycle');

  final _incomingBytesController = StreamController<Uint8List>.broadcast();
  final _lifecycleController = StreamController<UsbLifecycleEvent>.broadcast();

  StreamSubscription? _byteSub;
  StreamSubscription? _lifeSub;
  bool _connected = false;
  void Function(String log)? onLog;

  OmronUsbTransport({this.onLog}) {
    _initChannels();
  }

  void _initChannels() {
    _byteSub = _byteChannel.receiveBroadcastStream().listen((dynamic data) {
      Uint8List bytes;
      if (data is Uint8List) {
        bytes = data;
      } else if (data is List) {
        bytes = Uint8List.fromList(List<int>.from(data));
      } else {
        return;
      }
      onLog?.call('[USB-RX] ${bytes.length}B << ${_toHex(bytes)}');
      _incomingBytesController.add(bytes);
    }, onError: (err) {
      onLog?.call('[USB-ERR] Byte stream error: $err');
    });

    _lifeSub = _lifecycleChannel.receiveBroadcastStream().listen((dynamic data) {
      if (data is Map) {
        final evt = UsbLifecycleEvent.fromMap(data);
        if (evt.event == 'CONNECTED') {
          _connected = true;
        } else if (evt.event == 'DISCONNECTED' || evt.event == 'DETACHED') {
          _connected = false;
        }
        _lifecycleController.add(evt);
      }
    });
  }

  @override
  bool get isConnected => _connected;

  @override
  Stream<Uint8List> get incomingBytes => _incomingBytesController.stream;

  Stream<UsbLifecycleEvent> get lifecycleEvents => _lifecycleController.stream;

  /// Scan for connected USB devices (filtered by Omron)
  Future<List<UsbDeviceInfo>> scanDevices() async {
    final list = await _methodChannel.invokeListMethod<Map>('scanDevices');
    if (list == null) return [];
    return list.map((m) => UsbDeviceInfo.fromMap(m)).toList();
  }

  /// Request runtime USB communication permission for device
  Future<bool> requestPermission(int deviceId) async {
    final res = await _methodChannel.invokeMethod<bool>('requestPermission', {
      'deviceId': deviceId,
    });
    return res ?? false;
  }

  /// Open USB device, claim bulk endpoints, and start read loop
  Future<bool> connect(int deviceId) async {
    final res = await _methodChannel.invokeMethod<bool>('connect', {
      'deviceId': deviceId,
    });
    _connected = res ?? false;
    return _connected;
  }

  /// Disconnect active USB session
  Future<void> disconnect() async {
    await _methodChannel.invokeMethod('disconnect');
    _connected = false;
  }

  /// Assert USB CDC DTR/RTS signals and configure line coding (115200 8-N-1)
  Future<bool> initCdcLines() async {
    try {
      final res = await _methodChannel.invokeMethod<bool>('initCdcLines');
      onLog?.call('[CDC-CTRL] DTR/RTS 신호 인가 완료 (결과: $res)');
      return res ?? false;
    } catch (e) {
      onLog?.call('[CDC-CTRL-ERR] DTR/RTS 인가 실패: $e');
      return false;
    }
  }

  @override
  Future<void> sendBytes(Uint8List data) async {
    if (!_connected) {
      final nativeConnected = await _methodChannel.invokeMethod<bool>('isConnected') ?? false;
      if (nativeConnected) {
        _connected = true;
      } else {
        throw StateError('Omron USB port not connected');
      }
    }
    onLog?.call('[USB-TX] ${data.length}B >> ${_toHex(data)}');
    await _methodChannel.invokeMethod('sendBytes', {
      'bytes': data,
    });
  }

  static String _toHex(Uint8List data) {
    if (data.length > 32) {
      final preview = data.take(32).map((b) => b.toRadixString(16).toUpperCase().padLeft(2, '0')).join(' ');
      return '$preview ... (${data.length} bytes)';
    }
    return data.map((b) => b.toRadixString(16).toUpperCase().padLeft(2, '0')).join(' ');
  }

  void dispose() {
    _byteSub?.cancel();
    _lifeSub?.cancel();
    _incomingBytesController.close();
    _lifecycleController.close();
  }
}
