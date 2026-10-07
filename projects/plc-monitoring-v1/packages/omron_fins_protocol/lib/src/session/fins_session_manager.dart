import 'dart:async';
import 'dart:typed_data';
import '../commands/cpu_mode_change.dart';
import '../commands/cpu_unit_status.dart';
import '../commands/cpu_clock.dart';
import '../commands/memory_area_read.dart';
import '../commands/memory_area_write.dart';
import '../frames/fins_header.dart';
import '../frames/fins_memory_area.dart';
import '../frames/omron_usb_framer.dart';

/// Abstract transport layer interface (USB, TCP, Mock, etc.)
abstract class FinsTransport {
  Future<void> sendBytes(Uint8List data);
  Stream<Uint8List> get incomingBytes;
  bool get isConnected;
}

/// FINS Session Manager handles packet sequencing, SID tracking, timeouts and retries
class FinsSessionManager {
  final FinsTransport transport;
  final OmronUsbFramer framer;
  final int localNode;
  final int remoteNode;
  final void Function(String log)? onLog;

  int _nextSid = 0;
  final Map<int, Completer<Uint8List>> _pendingRequests = {};
  StreamSubscription? _sub;

  FinsSessionManager({
    required this.transport,
    OmronUsbFramer? framer,
    this.localNode = 1,
    this.remoteNode = 0,
    this.onLog,
  }) : framer = framer ?? OmronUsbFramer() {
    _init();
  }

  void _init() {
    // Pipe transport bytes into framer
    _sub = transport.incomingBytes.listen((chunk) {
      framer.ingest(chunk);
    });

    // Listen for complete FINS frames from framer
    framer.frames.listen(_handleIncomingFinsFrame);
  }

  int _getAndIncrementSid() {
    final sid = _nextSid;
    _nextSid = (_nextSid + 1) & 0xFF;
    return sid;
  }

  void _handleIncomingFinsFrame(Uint8List frame) {
    if (frame.length < 10) return;
    try {
      final header = FinsHeader.fromBytes(frame, 0);
      onLog?.call('[FINS-RX] SID=0x${header.sid.toRadixString(16).padLeft(2, "0")} (${frame.length}B) << ${_toHex(frame)}');
      final completer = _pendingRequests.remove(header.sid);
      if (completer != null && !completer.isCompleted) {
        completer.complete(frame);
      }
    } catch (e) {
      onLog?.call('[FINS-PARSE-ERR] Frame parse failed: $e');
    }
  }

  static String _toHex(Uint8List data) {
    if (data.length > 24) {
      final preview = data.take(24).map((b) => b.toRadixString(16).toUpperCase().padLeft(2, '0')).join(' ');
      return '$preview ... (${data.length}B)';
    }
    return data.map((b) => b.toRadixString(16).toUpperCase().padLeft(2, '0')).join(' ');
  }

  /// Sends a raw FINS command and awaits the matched response by SID
  Future<Uint8List> sendFinsCommand(
    Uint8List commandPayloadWithoutHeader, {
    int? explicitSid,
    Duration timeout = const Duration(milliseconds: 1500),
    int retries = 2,
  }) async {
    final sid = explicitSid ?? _getAndIncrementSid();
    final header = FinsHeader(
      sid: sid,
      sa1: localNode,
      da1: remoteNode,
      icf: 0x80, // Command, response required
    );

    final builder = BytesBuilder();
    builder.add(header.toBytes());
    builder.add(commandPayloadWithoutHeader);
    final finsFrame = builder.toBytes();
    final usbFrame = framer.frame(finsFrame);

    onLog?.call('[FINS-TX] SID=0x${sid.toRadixString(16).padLeft(2, "0")} (${finsFrame.length}B) >> ${_toHex(finsFrame)}');

    for (var attempt = 0; attempt <= retries; attempt++) {
      final completer = Completer<Uint8List>();
      _pendingRequests[sid] = completer;

      try {
        await transport.sendBytes(usbFrame);
        final response = await completer.future.timeout(timeout);
        return response;
      } on TimeoutException {
        _pendingRequests.remove(sid);
        onLog?.call('[FINS-TIMEOUT] SID=0x${sid.toRadixString(16).padLeft(2, "0")} (시도 ${attempt + 1}/${retries + 1}) 응답 대기 시간 초과');
        if (attempt >= retries) {
          throw TimeoutException('FINS Command timed out after $retries retries (SID: $sid)');
        }
        await Future.delayed(const Duration(milliseconds: 100));
      } catch (e) {
        _pendingRequests.remove(sid);
        onLog?.call('[FINS-ERR] SID=0x${sid.toRadixString(16).padLeft(2, "0")} 에러: $e');
        if (attempt >= retries) rethrow;
      }
    }

    throw StateError('Unexpected state in sendFinsCommand');
  }

  /// Read contiguous 16-bit words from PLC memory
  Future<List<int>> readWords({
    required FinsMemoryArea area,
    required int wordAddress,
    required int count,
  }) async {
    final sid = _getAndIncrementSid();
    final cmd = FinsMemoryAreaReadCommand(
      header: FinsHeader(sid: sid, sa1: localNode, da1: remoteNode),
      area: area,
      wordAddress: wordAddress,
      count: count,
      isBit: false,
    );

    final usbFrame = framer.frame(cmd.toBytes());
    final completer = Completer<Uint8List>();
    _pendingRequests[sid] = completer;

    await transport.sendBytes(usbFrame);
    final respBytes = await completer.future.timeout(const Duration(milliseconds: 1500));
    final resp = FinsMemoryAreaReadResponse.fromBytes(respBytes);

    if (!resp.endCode.isSuccess) {
      throw StateError('FINS Read failed: ${resp.endCode}');
    }
    return resp.getWords();
  }

  /// Write contiguous 16-bit words to PLC memory
  Future<void> writeWords({
    required FinsMemoryArea area,
    required int wordAddress,
    required List<int> words,
  }) async {
    final sid = _getAndIncrementSid();
    final cmd = FinsMemoryAreaWriteCommand.words(
      header: FinsHeader(sid: sid, sa1: localNode, da1: remoteNode),
      area: area,
      wordAddress: wordAddress,
      words: words,
    );

    final usbFrame = framer.frame(cmd.toBytes());
    final completer = Completer<Uint8List>();
    _pendingRequests[sid] = completer;

    await transport.sendBytes(usbFrame);
    final respBytes = await completer.future.timeout(const Duration(milliseconds: 1500));
    final resp = FinsMemoryAreaWriteResponse.fromBytes(respBytes);

    if (!resp.endCode.isSuccess) {
      throw StateError('FINS Write failed: ${resp.endCode}');
    }
  }

  /// Read bit value (or multiple bits)
  Future<List<bool>> readBits({
    required FinsMemoryArea area,
    required int wordAddress,
    required int bitAddress,
    required int count,
  }) async {
    final sid = _getAndIncrementSid();
    final cmd = FinsMemoryAreaReadCommand(
      header: FinsHeader(sid: sid, sa1: localNode, da1: remoteNode),
      area: area,
      wordAddress: wordAddress,
      bitAddress: bitAddress,
      count: count,
      isBit: true,
    );

    final usbFrame = framer.frame(cmd.toBytes());
    final completer = Completer<Uint8List>();
    _pendingRequests[sid] = completer;

    await transport.sendBytes(usbFrame);
    final respBytes = await completer.future.timeout(const Duration(milliseconds: 1500));
    final resp = FinsMemoryAreaReadResponse.fromBytes(respBytes);

    if (!resp.endCode.isSuccess) {
      throw StateError('FINS Read Bit failed: ${resp.endCode}');
    }
    return resp.getBits();
  }

  /// Write bit value (or multiple bits)
  Future<void> writeBits({
    required FinsMemoryArea area,
    required int wordAddress,
    required int bitAddress,
    required List<bool> bits,
  }) async {
    final sid = _getAndIncrementSid();
    final cmd = FinsMemoryAreaWriteCommand.bits(
      header: FinsHeader(sid: sid, sa1: localNode, da1: remoteNode),
      area: area,
      wordAddress: wordAddress,
      bitAddress: bitAddress,
      bits: bits,
    );

    final usbFrame = framer.frame(cmd.toBytes());
    final completer = Completer<Uint8List>();
    _pendingRequests[sid] = completer;

    await transport.sendBytes(usbFrame);
    final respBytes = await completer.future.timeout(const Duration(milliseconds: 1500));
    final resp = FinsMemoryAreaWriteResponse.fromBytes(respBytes);

    if (!resp.endCode.isSuccess) {
      throw StateError('FINS Write Bit failed: ${resp.endCode}');
    }
  }

  /// Read CPU Unit Status
  Future<FinsCpuStatusReadResponse> readCpuStatus() async {
    final sid = _getAndIncrementSid();
    final cmd = FinsCpuStatusReadCommand(
      header: FinsHeader(sid: sid, sa1: localNode, da1: remoteNode),
    );

    final usbFrame = framer.frame(cmd.toBytes());
    final completer = Completer<Uint8List>();
    _pendingRequests[sid] = completer;

    await transport.sendBytes(usbFrame);
    final respBytes = await completer.future.timeout(const Duration(milliseconds: 1500));
    return FinsCpuStatusReadResponse.fromBytes(respBytes);
  }

  /// Change CPU Mode (RUN / MONITOR / PROGRAM)
  Future<void> setCpuMode(CpuOperatingMode targetMode) async {
    final sid = _getAndIncrementSid();
    final cmd = FinsCpuModeChangeCommand(
      header: FinsHeader(sid: sid, sa1: localNode, da1: remoteNode),
      targetMode: targetMode,
    );

    final usbFrame = framer.frame(cmd.toBytes());
    final completer = Completer<Uint8List>();
    _pendingRequests[sid] = completer;

    await transport.sendBytes(usbFrame);
    final respBytes = await completer.future.timeout(const Duration(milliseconds: 2000));
    final resp = FinsCpuModeChangeResponse.fromBytes(respBytes);

    if (!resp.endCode.isSuccess) {
      throw StateError('FINS Mode Change failed: ${resp.endCode}');
    }
  }

  /// Read CPU RTC Clock
  Future<DateTime?> readClock() async {
    final sid = _getAndIncrementSid();
    final cmd = FinsClockReadCommand(
      header: FinsHeader(sid: sid, sa1: localNode, da1: remoteNode),
    );

    final usbFrame = framer.frame(cmd.toBytes());
    final completer = Completer<Uint8List>();
    _pendingRequests[sid] = completer;

    await transport.sendBytes(usbFrame);
    final respBytes = await completer.future.timeout(const Duration(milliseconds: 1500));
    final resp = FinsClockReadResponse.fromBytes(respBytes);
    return resp.time;
  }

  void dispose() {
    _sub?.cancel();
    framer.dispose();
    _pendingRequests.clear();
  }
}
