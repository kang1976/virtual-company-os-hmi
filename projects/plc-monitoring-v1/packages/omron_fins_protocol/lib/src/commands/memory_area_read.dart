import 'dart:typed_data';
import '../frames/fins_end_code.dart';
import '../frames/fins_header.dart';
import '../frames/fins_memory_area.dart';

/// FINS Command 01 01: Memory Area Read
class FinsMemoryAreaReadCommand {
  final FinsHeader header;
  final FinsMemoryArea area;
  final int wordAddress;
  final int bitAddress;
  final int count;
  final bool isBit;

  const FinsMemoryAreaReadCommand({
    required this.header,
    required this.area,
    required this.wordAddress,
    this.bitAddress = 0,
    required this.count,
    this.isBit = false,
  });

  /// MRC: 0x01, SRC: 0x01
  static const int mrc = 0x01;
  static const int src = 0x01;

  /// Serializes the entire FINS frame (Header + MRC/SRC + Payload)
  Uint8List toBytes() {
    final headerBytes = header.toBytes();
    final areaCode = isBit ? area.bitCode : area.wordCode;

    final builder = BytesBuilder();
    builder.add(headerBytes);
    builder.addByte(mrc);
    builder.addByte(src);
    builder.addByte(areaCode);
    builder.addByte((wordAddress >> 8) & 0xFF);
    builder.addByte(wordAddress & 0xFF);
    builder.addByte(bitAddress & 0xFF);
    builder.addByte((count >> 8) & 0xFF);
    builder.addByte(count & 0xFF);

    return builder.toBytes();
  }
}

/// Response to Memory Area Read Command
class FinsMemoryAreaReadResponse {
  final FinsHeader header;
  final FinsEndCode endCode;
  final Uint8List rawData;

  const FinsMemoryAreaReadResponse({
    required this.header,
    required this.endCode,
    required this.rawData,
  });

  factory FinsMemoryAreaReadResponse.fromBytes(Uint8List bytes) {
    if (bytes.length < 14) {
      throw ArgumentError('FINS Read response too short (min 14 bytes)');
    }
    final header = FinsHeader.fromBytes(bytes, 0);
    // bytes[10]: MRC (0x01)
    // bytes[11]: SRC (0x01)
    final mres = bytes[12];
    final sres = bytes[13];
    final endCode = FinsEndCode(mres, sres);
    final rawData = bytes.sublist(14);

    return FinsMemoryAreaReadResponse(
      header: header,
      endCode: endCode,
      rawData: rawData,
    );
  }

  /// Extracts 16-bit Big-Endian words
  List<int> getWords() {
    final words = <int>[];
    final byteData = ByteData.sublistView(rawData);
    for (var i = 0; i + 1 < rawData.length; i += 2) {
      words.add(byteData.getUint16(i, Endian.big));
    }
    return words;
  }

  /// Extracts 1-byte booleans (for bit reads)
  List<bool> getBits() {
    return rawData.map((b) => b != 0).toList();
  }
}
