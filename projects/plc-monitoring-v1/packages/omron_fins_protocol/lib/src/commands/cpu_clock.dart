import 'dart:typed_data';
import '../frames/fins_end_code.dart';
import '../frames/fins_header.dart';

/// FINS Command 07 01: Clock Read
class FinsClockReadCommand {
  final FinsHeader header;
  const FinsClockReadCommand({required this.header});

  Uint8List toBytes() {
    final builder = BytesBuilder();
    builder.add(header.toBytes());
    builder.addByte(0x07);
    builder.addByte(0x01);
    return builder.toBytes();
  }
}

class FinsClockReadResponse {
  final FinsHeader header;
  final FinsEndCode endCode;
  final DateTime? time;

  const FinsClockReadResponse({
    required this.header,
    required this.endCode,
    this.time,
  });

  factory FinsClockReadResponse.fromBytes(Uint8List bytes) {
    if (bytes.length < 14) {
      throw ArgumentError('FINS Clock Read response too short');
    }
    final header = FinsHeader.fromBytes(bytes, 0);
    final endCode = FinsEndCode(bytes[12], bytes[13]);
    DateTime? dt;

    if (endCode.isSuccess && bytes.length >= 21) {
      // Omron BCD format: YY MM DD HH MM SS DayOfWeek
      int fromBcd(int bcd) => ((bcd >> 4) * 10) + (bcd & 0x0F);
      try {
        final year = 2000 + fromBcd(bytes[14]);
        final month = fromBcd(bytes[15]);
        final day = fromBcd(bytes[16]);
        final hour = fromBcd(bytes[17]);
        final minute = fromBcd(bytes[18]);
        final second = fromBcd(bytes[19]);
        dt = DateTime(year, month, day, hour, minute, second);
      } catch (_) {}
    }

    return FinsClockReadResponse(
      header: header,
      endCode: endCode,
      time: dt,
    );
  }
}
