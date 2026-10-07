import 'dart:typed_data';

/// FINS Frame Header (10 bytes)
class FinsHeader {
  /// Information Control Field (Default: 0x80 for command requesting response, 0xC0 for response)
  final int icf;

  /// Reserved (0x00)
  final int rsv;

  /// Gateway Count (0x02)
  final int gct;

  /// Destination Network Address (0x00 = Local)
  final int dna;

  /// Destination Node Number (0x00 = Internal CPU / Local)
  final int da1;

  /// Destination Unit Address (0x00 = CPU Unit)
  final int da2;

  /// Source Network Address (0x00 = Local)
  final int sna;

  /// Source Node Number (0x01 = Host / Mobile)
  final int sa1;

  /// Source Unit Address (0x00 = Host Application)
  final int sa2;

  /// Service ID (Sequence number 0x00..0xFF)
  final int sid;

  const FinsHeader({
    this.icf = 0x80,
    this.rsv = 0x00,
    this.gct = 0x02,
    this.dna = 0x00,
    this.da1 = 0x00,
    this.da2 = 0x00,
    this.sna = 0x00,
    this.sa1 = 0x01,
    this.sa2 = 0x00,
    required this.sid,
  });

  /// Serializes header to exactly 10 bytes
  Uint8List toBytes() {
    return Uint8List.fromList([
      icf,
      rsv,
      gct,
      dna,
      da1,
      da2,
      sna,
      sa1,
      sa2,
      sid,
    ]);
  }

  /// Parses header from a byte slice (at least 10 bytes)
  factory FinsHeader.fromBytes(Uint8List bytes, [int offset = 0]) {
    if (bytes.length < offset + 10) {
      throw ArgumentError('Bytes buffer too short for FinsHeader (need 10 bytes)');
    }
    return FinsHeader(
      icf: bytes[offset + 0],
      rsv: bytes[offset + 1],
      gct: bytes[offset + 2],
      dna: bytes[offset + 3],
      da1: bytes[offset + 4],
      da2: bytes[offset + 5],
      sna: bytes[offset + 6],
      sa1: bytes[offset + 7],
      sa2: bytes[offset + 8],
      sid: bytes[offset + 9],
    );
  }

  @override
  String toString() {
    return 'FinsHeader(SID: $sid, DA: $dna.$da1.$da2, SA: $sna.$sa1.$sa2, ICF: 0x${icf.toRadixString(16).padLeft(2, '0')})';
  }
}
