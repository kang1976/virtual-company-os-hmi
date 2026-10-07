import 'dart:typed_data';
import '../frames/fins_end_code.dart';
import '../frames/fins_header.dart';
import 'cpu_unit_status.dart';

/// FINS Command 04 01 (RUN) / 04 02 (STOP/PROGRAM)
class FinsCpuModeChangeCommand {
  final FinsHeader header;
  final CpuOperatingMode targetMode;

  const FinsCpuModeChangeCommand({
    required this.header,
    required this.targetMode,
  });

  Uint8List toBytes() {
    final builder = BytesBuilder();
    builder.add(header.toBytes());

    if (targetMode == CpuOperatingMode.program) {
      // 04 02: STOP
      builder.addByte(0x04);
      builder.addByte(0x02);
    } else {
      // 04 01: RUN / MONITOR
      builder.addByte(0x04);
      builder.addByte(0x01);
      // Program number (0xFF, 0xFF = current)
      builder.addByte(0xFF);
      builder.addByte(0xFF);
      // Mode: 0x02 for MONITOR, 0x04 for RUN
      builder.addByte(targetMode == CpuOperatingMode.run ? 0x04 : 0x02);
    }

    return builder.toBytes();
  }
}

class FinsCpuModeChangeResponse {
  final FinsHeader header;
  final FinsEndCode endCode;

  const FinsCpuModeChangeResponse({
    required this.header,
    required this.endCode,
  });

  factory FinsCpuModeChangeResponse.fromBytes(Uint8List bytes) {
    if (bytes.length < 14) {
      throw ArgumentError('FINS Mode Change response too short');
    }
    return FinsCpuModeChangeResponse(
      header: FinsHeader.fromBytes(bytes, 0),
      endCode: FinsEndCode(bytes[12], bytes[13]),
    );
  }
}
