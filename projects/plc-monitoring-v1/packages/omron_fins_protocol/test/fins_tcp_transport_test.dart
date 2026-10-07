import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'package:test/test.dart';
import 'package:omron_fins_protocol/omron_fins_protocol.dart';

void main() {
  group('OmronTcpTransport Unit Tests', () {
    late ServerSocket mockServer;
    late int serverPort;

    setUp(() async {
      // 로컬 루프백 모의 FINS/TCP 서버 바인딩
      mockServer = await ServerSocket.bind(InternetAddress.loopbackIPv4, 0);
      serverPort = mockServer.port;
    });

    tearDown(() async {
      await mockServer.close();
    });

    test('FINS/TCP 소켓 연결, 노드 핸드셰이크 및 프레임 송수신 정상 동작 테스트', () async {
      final serverReceivedFrames = <Uint8List>[];

      // 모의 PLC 서버 핸들러
      mockServer.listen((clientSocket) {
        clientSocket.listen((data) {
          // 1. 노드 핸드셰이크 요청 (Command 0, 20바이트) 확인
          if (data.length >= 20 && data[8] == 0 && data[9] == 0 && data[10] == 0 && data[11] == 0) {
            // 노드 응답 전송 (Command 1, 총 24바이트)
            // Magic 'FINS' + Len 16 + Command 1 + Error 0 + ClientNode 239 + ServerNode 1
            final resp = BytesBuilder();
            resp.add([0x46, 0x49, 0x4E, 0x53]); // FINS
            resp.add([0x00, 0x00, 0x00, 0x10]); // Len 16
            resp.add([0x00, 0x00, 0x00, 0x01]); // Command 1
            resp.add([0x00, 0x00, 0x00, 0x00]); // Error 0
            resp.add([0x00, 0x00, 0x00, 0xEF]); // ClientNode 239
            resp.add([0x00, 0x00, 0x00, 0x01]); // ServerNode 1
            clientSocket.add(resp.toBytes());
          }
          // 2. FINS 프레임 전송 (Command 2) 확인
          else if (data.length >= 16 && data[11] == 0x02) {
            serverReceivedFrames.add(Uint8List.fromList(data));
            // 모의 FINS 응답 패킷 전송 (Command 2)
            // 순수 FINS 응답 예: [0xC0, 0x00, 0x02, 0x00, 0x01, 0x00, 0x00, 0xEF, 0x00, 0x01, 0x01, 0x01, 0x00, 0x00, 0x12, 0x34]
            final mockFinsResp = [0xC0, 0x00, 0x02, 0x00, 0x01, 0x00, 0x00, 0xEF, 0x00, 0x01, 0x01, 0x01, 0x00, 0x00, 0x12, 0x34];
            final b = BytesBuilder();
            b.add([0x46, 0x49, 0x4E, 0x53]);
            final payloadLen = 8 + mockFinsResp.length;
            b.add([(payloadLen >> 24) & 0xFF, (payloadLen >> 16) & 0xFF, (payloadLen >> 8) & 0xFF, payloadLen & 0xFF]);
            b.add([0x00, 0x00, 0x00, 0x02]); // Command 2
            b.add([0x00, 0x00, 0x00, 0x00]); // Error 0
            b.add(mockFinsResp);
            clientSocket.add(b.toBytes());
          }
        });
      });

      final transport = OmronTcpTransport(
        plcIp: InternetAddress.loopbackIPv4.address,
        plcPort: serverPort,
      );

      final rxCompleter = Completer<Uint8List>();
      transport.incomingBytes.listen((data) {
        if (!rxCompleter.isCompleted) rxCompleter.complete(data);
      });

      // 1. 연결 및 핸드셰이크 실행
      final connected = await transport.connect();
      expect(connected, isTrue);
      expect(transport.isConnected, isTrue);
      expect(transport.clientNode, equals(239));
      expect(transport.serverNode, equals(1));

      // 2. FINS 패킷 송신
      final mockFinsTx = Uint8List.fromList([0x80, 0x00, 0x02, 0x00, 0x01, 0x00, 0x00, 0xEF, 0x00, 0x01, 0x01, 0x01, 0x82, 0x03, 0xE8, 0x00, 0x00, 0x01]);
      await transport.sendBytes(mockFinsTx);

      // 3. 서버가 헤더 16B + FINS 패킷을 수신했는지 확인
      await Future.delayed(const Duration(milliseconds: 50));
      expect(serverReceivedFrames.length, equals(1));
      final rxPacket = serverReceivedFrames.first;
      expect(rxPacket.sublist(0, 4), equals([0x46, 0x49, 0x4E, 0x53])); // 'FINS'
      expect(rxPacket[11], equals(2)); // Command 2
      expect(rxPacket.sublist(16), equals(mockFinsTx)); // 순수 FINS 페이로드

      // 4. 클라이언트가 응답을 파싱하여 순수 FINS 바이트로 수신했는지 확인
      final clientReceived = await rxCompleter.future.timeout(const Duration(seconds: 2));
      expect(clientReceived.length, equals(16));
      expect(clientReceived[0], equals(0xC0));
      expect(clientReceived[14], equals(0x12));
      expect(clientReceived[15], equals(0x34));

      await transport.disconnect();
      expect(transport.isConnected, isFalse);
    });
  });
}
