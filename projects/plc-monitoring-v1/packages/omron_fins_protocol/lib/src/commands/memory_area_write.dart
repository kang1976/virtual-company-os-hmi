import 'dart:typed_data';
import '../frames/fins_end_code.dart';
import '../frames/fins_header.dart';
import '../frames/fins_memory_area.dart';

/// FINS Command 01 02: Memory Area Write
class FinsMemoryAreaWriteCommand {
  final FinsHeader header;
  final FinsMemoryArea area;
  final int wordAddress;
  final int bitAddress;
  final int count;
  final bool isBit;
  final Uint8List data;

  const FinsMemoryAreaWriteCommand({
    required this.header,
    required this.area,
    required this.wordAddress,
    this.bitAddress = 0,
    required this.count,
    this.isBit = false,
    required this.data,
  });

  /// Factory helper for writing 16-bit words
  factory FinsMemoryAreaWriteCommand.words({
    required FinsHeader header,
    required FinsMemoryArea area,
    required int wordAddress,
    required List<int> words,
  }) {
    final byteData = ByteData(words.length * 2);
    for (var i = 0; i < words.length; i++) {
      byteData.setUint16(i * 2, words[i], Endian.big);
    }
    return FinsMemoryAreaWriteCommand(
      header: header,
      area: area,
      wordAddress: wordAddress,
      bitAddress: 0,
      count: words.length,
      isBit: false,
      data: byteData.buffer.asUint8List(),
    );
  }

  /// Factory helper for writing single/multiple bits
  factory FinsMemoryAreaWriteCommand.bits({
    required FinsHeader header,
    required FinsMemoryArea area,
    required int wordAddress,
    required int bitAddress,
    required List<bool> bits,
  }) {
    final raw = Uint8List.fromList(bits.map((b) => b ? 0x01 : 0x00).toList());
    return FinsMemoryAreaWriteCommand(
      header: header,
      area: area,
      wordAddress: wordAddress,
      bitAddress: bitAddress,
      count: bits.length,
      isBit: true,
      data: raw,
    );
  }

  static const int mrc = 0x01;
  static const int src = 0x02;

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
    builder.add(data);

    return builder.toBytes();
  }
}

/// Response to Memory Area Write Command
class FinsMemoryAreaWriteResponse {
  final FinsHeader header;
  final FinsEndCode endCode;

  const FinsMemoryAreaWriteResponse({
    required this.header,
    required this.endCode,
  });

  factory FinsMemoryAreaWriteResponse.fromBytes(Uint8List bytes) {
    if (bytes.length < 14) {
      throw ArgumentError('FINS Write response too short (min 14 bytes)');
    }
    final header = FinsHeader.fromBytes(bytes, 0);
    final mres = bytes[12];
    final sres = bytes[13];
    return FinsMemoryAreaWriteResponse(
      header: header,
      endCode: FinsEndCode(mres, sres),
    );
  }
}
