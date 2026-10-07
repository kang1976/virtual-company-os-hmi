import 'dart:typed_data';
import 'package:test/test.dart';
import 'package:omron_fins_protocol/omron_fins_protocol.dart';

void main() {
  group('FINS Header & Memory Area Tests', () {
    test('FinsHeader serialization and deserialization', () {
      final header = FinsHeader(
        sid: 42,
        sa1: 1,
        da1: 0,
        icf: 0x80,
      );

      final bytes = header.toBytes();
      expect(bytes.length, equals(10));
      expect(bytes[0], equals(0x80)); // ICF
      expect(bytes[9], equals(42)); // SID

      final parsed = FinsHeader.fromBytes(bytes);
      expect(parsed.sid, equals(42));
      expect(parsed.sa1, equals(1));
      expect(parsed.da1, equals(0));
    });

    test('FinsMemoryArea codes and prefix mapping', () {
      expect(FinsMemoryArea.dm.wordCode, equals(0x82));
      expect(FinsMemoryArea.dm.bitCode, equals(0x02));
      expect(FinsMemoryArea.cio.wordCode, equals(0xB0));
      expect(FinsMemoryArea.cio.bitCode, equals(0x30));
      expect(FinsMemoryArea.work.wordCode, equals(0xB1));

      expect(FinsMemoryAreaExtension.fromPrefix('DM'), equals(FinsMemoryArea.dm));
      expect(FinsMemoryAreaExtension.fromPrefix('CIO'), equals(FinsMemoryArea.cio));
      expect(FinsMemoryAreaExtension.fromPrefix('W100'), equals(FinsMemoryArea.work));
    });
  });

  group('FINS Commands & Responses', () {
    test('Memory Area Read Command serialization', () {
      final cmd = FinsMemoryAreaReadCommand(
        header: FinsHeader(sid: 10),
        area: FinsMemoryArea.dm,
        wordAddress: 1000,
        count: 5,
      );

      final bytes = cmd.toBytes();
      // 10 (header) + 2 (MRC/SRC) + 1 (Area) + 2 (WordAddr) + 1 (BitAddr) + 2 (Count) = 18 bytes
      expect(bytes.length, equals(18));
      expect(bytes[10], equals(0x01)); // MRC
      expect(bytes[11], equals(0x01)); // SRC
      expect(bytes[12], equals(0x82)); // DM word code
      expect((bytes[13] << 8) | bytes[14], equals(1000)); // Word address
      expect(bytes[15], equals(0x00)); // Bit address
      expect((bytes[16] << 8) | bytes[17], equals(5)); // Count
    });

    test('Memory Area Read Response deserialization', () {
      // Create simulated response: 10B header + 01 01 + 00 00 (EndCode) + 2 words (0x0100, 0x0200)
      final raw = Uint8List.fromList([
        0xC0, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 10, // Header
        0x01, 0x01, // MRC, SRC
        0x00, 0x00, // EndCode OK
        0x03, 0xE8, // 1000 in Big Endian
        0x07, 0xD0, // 2000 in Big Endian
      ]);

      final resp = FinsMemoryAreaReadResponse.fromBytes(raw);
      expect(resp.endCode.isSuccess, isTrue);
      expect(resp.header.sid, equals(10));
      final words = resp.getWords();
      expect(words.length, equals(2));
      expect(words[0], equals(1000));
      expect(words[1], equals(2000));
    });

    test('Memory Area Write Command serialization', () {
      final cmd = FinsMemoryAreaWriteCommand.words(
        header: FinsHeader(sid: 11),
        area: FinsMemoryArea.dm,
        wordAddress: 200,
        words: [123, 456],
      );

      final bytes = cmd.toBytes();
      // 18 bytes base + 4 bytes data = 22 bytes
      expect(bytes.length, equals(22));
      expect(bytes[10], equals(0x01)); // MRC
      expect(bytes[11], equals(0x02)); // SRC
      expect((bytes[13] << 8) | bytes[14], equals(200));
      expect((bytes[16] << 8) | bytes[17], equals(2)); // count
      expect((bytes[18] << 8) | bytes[19], equals(123));
      expect((bytes[20] << 8) | bytes[21], equals(456));
    });

    test('CPU Status Read Response deserialization', () {
      final raw = Uint8List.fromList([
        0xC0, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 15, // Header
        0x06, 0x01, // MRC, SRC
        0x00, 0x00, // EndCode
        0x02, // Status: Monitor Mode (0x02)
        0x00, // Flags: No battery error
      ]);

      final resp = FinsCpuStatusReadResponse.fromBytes(raw);
      expect(resp.endCode.isSuccess, isTrue);
      expect(resp.mode, equals(CpuOperatingMode.monitor));
      expect(resp.hasFatalError, isFalse);
      expect(resp.isBatteryError, isFalse);
    });
  });

  group('Omron USB Framer', () {
    test('Direct FINS framing mode', () async {
      final framer = OmronUsbFramer(mode: OmronUsbFramingMode.directFins);
      final dummyFins = Uint8List.fromList([
        0xC0, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x00, 0x12, 0x34
      ]);

      expect(framer.frame(dummyFins), equals(dummyFins));

      final received = <Uint8List>[];
      framer.frames.listen(received.add);

      framer.ingest(dummyFins);
      await Future.delayed(const Duration(milliseconds: 10));

      expect(received.length, equals(1));
      expect(received.first, equals(dummyFins));
    });

    test('Magic Header 0xABCD framing mode', () async {
      final framer = OmronUsbFramer(mode: OmronUsbFramingMode.magicHeaderAbCd);
      final payload = Uint8List.fromList([1, 2, 3, 4, 5]);

      final framed = framer.frame(payload);
      expect(framed.length, equals(9)); // 4B header + 5B payload
      expect(framed[0], equals(0xAB));
      expect(framed[1], equals(0xCD));
      expect(framed[2], equals(0));
      expect(framed[3], equals(5));

      final received = <Uint8List>[];
      framer.frames.listen(received.add);

      // Ingest in 2 chunks to test defragmentation
      framer.ingest(framed.sublist(0, 3));
      framer.ingest(framed.sublist(3));

      await Future.delayed(const Duration(milliseconds: 10));
      expect(received.length, equals(1));
      expect(received.first, equals(payload));
    });

    test('Toolbus 0xAB header and 16-bit additive checksum framing mode', () async {
      final framer = OmronUsbFramer(mode: OmronUsbFramingMode.toolbus);
      final payload = Uint8List.fromList([
        0xC0, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x00, 0x12, 0x34
      ]);

      final framed = framer.frame(payload);
      expect(framed.length, equals(payload.length + 5));
      expect(framed[0], equals(0xAB));
      final expectedLenField = payload.length + 2;
      expect((framed[1] << 8) | framed[2], equals(expectedLenField));

      int expectedSum = 0;
      for (var i = 0; i < framed.length - 2; i++) {
        expectedSum = (expectedSum + framed[i]) & 0xFFFF;
      }
      expect((framed[framed.length - 2] << 8) | framed[framed.length - 1], equals(expectedSum));

      final received = <Uint8List>[];
      framer.frames.listen(received.add);

      // Ingest sync response (0xAC 0x01) followed by framed packet
      framer.ingest(Uint8List.fromList([0xAC, 0x01]));
      framer.ingest(framed);
      await Future.delayed(const Duration(milliseconds: 10));

      expect(received.length, equals(1));
      expect(received.first, equals(payload));
    });

    test('Host Link ASCII framing mode', () async {
      final framer = OmronUsbFramer(mode: OmronUsbFramingMode.hostLink);
      final payload = Uint8List.fromList([
        0xC0, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x00
      ]);

      final framed = framer.frame(payload);
      final framedStr = String.fromCharCodes(framed);
      expect(framedStr.startsWith('@00FA'), isTrue);
      expect(framedStr.endsWith('*\r'), isTrue);

      // Ingest simulated Host Link response: @00FA00 + HEX(payload) + FCS + *\r
      final hexPayload = payload.map((b) => b.toRadixString(16).padLeft(2, '0').toUpperCase()).join('');
      final respText = '@00FA00$hexPayload';
      int fcs = 0;
      for (var i = 0; i < respText.length; i++) {
        fcs ^= respText.codeUnitAt(i);
      }
      final fcsHex = fcs.toRadixString(16).padLeft(2, '0').toUpperCase();
      final fullResp = '$respText$fcsHex*\r';

      final received = <Uint8List>[];
      framer.frames.listen(received.add);
      framer.ingest(Uint8List.fromList(fullResp.codeUnits));
      await Future.delayed(const Duration(milliseconds: 10));

      expect(received.length, equals(1));
      expect(received.first, equals(payload));
    });
  });
}
