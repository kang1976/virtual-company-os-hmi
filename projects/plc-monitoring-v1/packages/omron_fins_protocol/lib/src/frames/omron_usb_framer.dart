import 'dart:async';
import 'dart:typed_data';

enum OmronUsbFramingMode {
  /// Smart auto-detection based on incoming packet signature
  autoDetect,

  /// Raw FINS frame directly passed to USB bulk endpoints (common on modern CJ2/CP1)
  directFins,

  /// Toolbus Binary framing (FINS payload + 16-bit additive checksum BigEndian)
  toolbus,

  /// Host Link ASCII framing (@00FA<FINS_HEX><FCS>*\r)
  hostLink,

  /// Omron standard USB encapsulation header (0xAB 0xCD + 2-byte Length BigEndian)
  magicHeaderAbCd,
}

/// Encapsulates FINS frames into USB Bulk Packets and decapsulates/defragments received USB byte streams
class OmronUsbFramer {
  OmronUsbFramingMode mode;
  final void Function(String log)? onLog;
  final _controller = StreamController<Uint8List>.broadcast();
  final BytesBuilder _buffer = BytesBuilder();

  OmronUsbFramer({
    this.mode = OmronUsbFramingMode.autoDetect,
    this.onLog,
  });

  Stream<Uint8List> get frames => _controller.stream;

  /// Toolbus sync handshake command (0xAC 0x01)
  static final Uint8List toolbusSyncCommand = Uint8List.fromList([0xAC, 0x01]);

  /// Encapsulates a raw FINS frame into a USB frame
  Uint8List frame(Uint8List finsFrame) {
    switch (mode) {
      case OmronUsbFramingMode.directFins:
      case OmronUsbFramingMode.autoDetect:
        return finsFrame;

      case OmronUsbFramingMode.toolbus:
        // Standard Omron Toolbus frame:
        // [0]: 0xAB (Start delimiter)
        // [1..2]: Length = payloadLength + 2 (BigEndian)
        // [3..3+payloadLen-1]: FINS frame payload
        // [last-1..last]: 16-bit additive checksum of all bytes in frame so far (BigEndian)
        final serialMsgLen = finsFrame.length + 2;
        final builder = BytesBuilder();
        builder.addByte(0xAB);
        builder.addByte((serialMsgLen >> 8) & 0xFF);
        builder.addByte(serialMsgLen & 0xFF);
        builder.add(finsFrame);

        final frameWithoutChecksum = builder.toBytes();
        int sum = 0;
        for (final b in frameWithoutChecksum) {
          sum = (sum + b) & 0xFFFF;
        }
        builder.addByte((sum >> 8) & 0xFF);
        builder.addByte(sum & 0xFF);
        return builder.toBytes();

      case OmronUsbFramingMode.hostLink:
        final hexStr = finsFrame.map((b) => b.toRadixString(16).padLeft(2, '0').toUpperCase()).join('');
        final cmdWithoutFcs = '@00FA$hexStr';
        int fcs = 0;
        for (var i = 0; i < cmdWithoutFcs.length; i++) {
          fcs ^= cmdWithoutFcs.codeUnitAt(i);
        }
        final fcsHex = fcs.toRadixString(16).padLeft(2, '0').toUpperCase();
        final fullFrame = '$cmdWithoutFcs$fcsHex*\r';
        return Uint8List.fromList(fullFrame.codeUnits);

      case OmronUsbFramingMode.magicHeaderAbCd:
        final builder = BytesBuilder();
        builder.addByte(0xAB);
        builder.addByte(0xCD);
        final len = finsFrame.length;
        builder.addByte((len >> 8) & 0xFF);
        builder.addByte(len & 0xFF);
        builder.add(finsFrame);
        return builder.toBytes();
    }
  }

  /// Ingests incoming USB raw chunk (from bulkTransfer IN) and emits complete FINS frames
  void ingest(Uint8List chunk) {
    if (chunk.isEmpty) return;
    _buffer.add(chunk);

    if (mode == OmronUsbFramingMode.hostLink) {
      _processHostLinkBuffer();
    } else if (mode == OmronUsbFramingMode.magicHeaderAbCd) {
      _processMagicHeaderBuffer();
    } else if (mode == OmronUsbFramingMode.toolbus) {
      _processToolbusBuffer();
    } else if (mode == OmronUsbFramingMode.directFins) {
      _processDirectFinsBuffer();
    } else {
      // autoDetect: examine buffer
      final current = _buffer.toBytes();
      if (current.isEmpty) return;
      if (current[0] == 0x40) { // '@' Host Link
        _processHostLinkBuffer();
      } else if (current.length >= 2 && current[0] == 0xAB && current[1] == 0xCD) {
        _processMagicHeaderBuffer();
      } else if (current.contains(0xAB) || (current.length >= 2 && current[0] == 0xAC && current[1] == 0x01)) {
        _processToolbusBuffer();
      } else {
        _processDirectOrToolbusBuffer();
      }
    }
  }

  void _processDirectFinsBuffer() {
    final current = _buffer.toBytes();
    if (current.length < 10) return; // Minimum FINS header is 10 bytes

    int startIdx = -1;
    for (var i = 0; i < current.length; i++) {
      final b = current[i];
      if (b == 0xC0 || b == 0xC1 || b == 0x80) {
        startIdx = i;
        break;
      }
    }

    if (startIdx == -1) {
      _buffer.clear();
      return;
    }

    final frame = Uint8List.fromList(current.sublist(startIdx));
    _buffer.clear();
    onLog?.call('[FRAMER] Direct FINS frame extracted (${frame.length}B)');
    _controller.add(frame);
  }

  void _processToolbusBuffer() {
    var buf = _buffer.toBytes();
    if (buf.isEmpty) return;

    // Check for Toolbus Sync response (0xAC 0x01)
    for (var i = 0; i < buf.length - 1; i++) {
      if (buf[i] == 0xAC && buf[i + 1] == 0x01) {
        onLog?.call('[TOOLBUS-SYNC] ✅ Omron PLC Toolbus Sync 응답(0xAC 0x01) 수신됨!');
        final remaining = Uint8List.fromList(buf.sublist(i + 2));
        _buffer.clear();
        _buffer.add(remaining);
        buf = remaining;
        break;
      }
    }

    while (buf.isNotEmpty) {
      final startIdx = buf.indexOf(0xAB);
      if (startIdx == -1) {
        // No start delimiter found
        if (buf.length > 256) _buffer.clear();
        return;
      }

      // Need at least 0xAB + 2-byte Length = 3 bytes
      if (buf.length < startIdx + 3) return;

      final fLength = (buf[startIdx + 1] << 8) | buf[startIdx + 2];
      // Total frame length = 0xAB(1) + length(2) + payload(fLength-2) + checksum(2) = fLength + 3
      final totalFrameLen = fLength + 3;

      if (buf.length < startIdx + totalFrameLen) {
        // Need more bytes to complete frame
        return;
      }

      final frame = buf.sublist(startIdx, startIdx + totalFrameLen);
      int calcSum = 0;
      for (var i = 0; i < frame.length - 2; i++) {
        calcSum = (calcSum + frame[i]) & 0xFFFF;
      }
      final rxSum = (frame[frame.length - 2] << 8) | frame[frame.length - 1];

      if (calcSum == rxSum) {
        final finsPayload = Uint8List.fromList(frame.sublist(3, frame.length - 2));
        onLog?.call('[FRAMER] Toolbus FINS 프레임 정상 수신 및 검증 완료 (${finsPayload.length}B)');
        _controller.add(finsPayload);

        // Advance buffer past this frame
        final nextBytes = Uint8List.fromList(buf.sublist(startIdx + totalFrameLen));
        _buffer.clear();
        _buffer.add(nextBytes);
        buf = nextBytes;
      } else {
        onLog?.call('[FRAMER-WARN] Toolbus 체크섬 불일치 (계산: 0x${calcSum.toRadixString(16)}, 수신: 0x${rxSum.toRadixString(16)})');
        // Discard this 0xAB and search again
        final nextBytes = Uint8List.fromList(buf.sublist(startIdx + 1));
        _buffer.clear();
        _buffer.add(nextBytes);
        buf = nextBytes;
      }
    }
  }

  void _processHostLinkBuffer() {
    final bytes = _buffer.toBytes();
    final str = String.fromCharCodes(bytes);
    final atIdx = str.indexOf('@');
    if (atIdx == -1) {
      _buffer.clear();
      return;
    }

    final termIdx = str.indexOf('*', atIdx);
    if (termIdx == -1) return; // Incomplete, wait for more data

    final fullCmd = str.substring(atIdx, termIdx); // e.g. @00FA00<HEX_DATA><FCS>
    _buffer.clear();

    try {
      // Expected: @ + Unit(2) + Header(2: FA) + EndCode(2: 00) + HexData... + FCS(2)
      if (fullCmd.length >= 9 && fullCmd.substring(3, 5) == 'FA') {
        final hexData = fullCmd.substring(7, fullCmd.length - 2);
        final rawBytes = <int>[];
        for (var i = 0; i < hexData.length - 1; i += 2) {
          rawBytes.add(int.parse(hexData.substring(i, i + 2), radix: 16));
        }
        final frame = Uint8List.fromList(rawBytes);
        onLog?.call('[FRAMER] Host Link FINS response extracted (${frame.length}B)');
        _controller.add(frame);
      } else {
        onLog?.call('[FRAMER] Host Link generic response: $fullCmd');
      }
    } catch (e) {
      onLog?.call('[FRAMER] Host Link parse warning: $e');
    }
  }

  void _processDirectOrToolbusBuffer() {
    final current = _buffer.toBytes();
    if (current.length < 10) return;

    int startIdx = -1;
    for (var i = 0; i < current.length; i++) {
      final b = current[i];
      if (b == 0xC0 || b == 0xC1 || b == 0x80) {
        startIdx = i;
        break;
      }
    }

    if (startIdx == -1) {
      _buffer.clear();
      return;
    }

    final frame = Uint8List.fromList(current.sublist(startIdx));
    _buffer.clear();
    onLog?.call('[FRAMER] FINS frame extracted (${frame.length}B)');
    _controller.add(frame);
  }

  void _processMagicHeaderBuffer() {
    var bytes = _buffer.toBytes();
    while (bytes.length >= 4) {
      if (bytes[0] == 0xAB && bytes[1] == 0xCD) {
        final payloadLen = (bytes[2] << 8) | bytes[3];
        final totalPacketLen = 4 + payloadLen;
        if (bytes.length >= totalPacketLen) {
          final finsPayload = Uint8List.fromList(bytes.sublist(4, totalPacketLen));
          onLog?.call('[FRAMER] Magic 0xABCD frame extracted (${finsPayload.length}B)');
          _controller.add(finsPayload);
          bytes = Uint8List.fromList(bytes.sublist(totalPacketLen));
        } else {
          break;
        }
      } else {
        bytes = Uint8List.fromList(bytes.sublist(1));
      }
    }
    _buffer.clear();
    _buffer.add(bytes);
  }

  void dispose() {
    _controller.close();
  }
}
