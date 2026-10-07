import 'dart:typed_data';
import '../frames/fins_end_code.dart';
import '../frames/fins_header.dart';

enum CpuOperatingMode {
  program,
  monitor,
  run,
  unknown,
}

/// FINS Command 06 01: CPU Unit Status Read
class FinsCpuStatusReadCommand {
  final FinsHeader header;

  const FinsCpuStatusReadCommand({required this.header});

  static const int mrc = 0x06;
  static const int src = 0x01;

  Uint8List toBytes() {
    final builder = BytesBuilder();
    builder.add(header.toBytes());
    builder.addByte(mrc);
    builder.addByte(src);
    return builder.toBytes();
  }
}

/// Response to CPU Unit Status Read
class FinsCpuStatusReadResponse {
  final FinsHeader header;
  final FinsEndCode endCode;
  final CpuOperatingMode mode;
  final bool hasFatalError;
  final bool hasNonFatalError;
  final bool isBatteryError;
  final String cpuUnitName;

  const FinsCpuStatusReadResponse({
    required this.header,
    required this.endCode,
    required this.mode,
    required this.hasFatalError,
    required this.hasNonFatalError,
    required this.isBatteryError,
    required this.cpuUnitName,
  });

  factory FinsCpuStatusReadResponse.fromBytes(Uint8List bytes) {
    if (bytes.length < 14) {
      throw ArgumentError('FINS CPU Status response too short');
    }
    final header = FinsHeader.fromBytes(bytes, 0);
    final endCode = FinsEndCode(bytes[12], bytes[13]);

    CpuOperatingMode mode = CpuOperatingMode.unknown;
    bool hasFatal = false;
    bool hasNonFatal = false;
    bool isBattery = false;
    String unitName = 'CJ2H-CPU65-EIP';

    if (bytes.length >= 15) {
      final statusByte = bytes[14];
      final modeVal = statusByte & 0x03;
      if (modeVal == 0x00) {
        mode = CpuOperatingMode.program;
      } else if (modeVal == 0x02) {
        mode = CpuOperatingMode.monitor;
      } else if (modeVal == 0x04 || modeVal == 0x03) {
        mode = CpuOperatingMode.run;
      }
      hasFatal = (statusByte & 0x80) != 0;
      hasNonFatal = (statusByte & 0x40) != 0;
    }

    if (bytes.length >= 16) {
      // Flags
      isBattery = (bytes[15] & 0x04) != 0;
    }

    if (bytes.length >= 36) {
      final nameBytes = bytes.sublist(16, 36);
      unitName = String.fromCharCodes(nameBytes.where((c) => c >= 32 && c <= 126)).trim();
      if (unitName.isEmpty) unitName = 'CJ2H-CPU65-EIP';
    }

    return FinsCpuStatusReadResponse(
      header: header,
      endCode: endCode,
      mode: mode,
      hasFatalError: hasFatal,
      hasNonFatalError: hasNonFatal,
      isBatteryError: isBattery,
      cpuUnitName: unitName,
    );
  }
}
