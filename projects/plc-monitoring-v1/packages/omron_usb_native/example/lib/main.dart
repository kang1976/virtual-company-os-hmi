import 'package:flutter/material.dart';
import 'package:omron_usb_native/omron_usb_native.dart';

void main() {
  runApp(const MaterialApp(
    debugShowCheckedModeBanner: false,
    home: OmronUsbExamplePage(),
  ));
}

class OmronUsbExamplePage extends StatefulWidget {
  const OmronUsbExamplePage({super.key});

  @override
  State<OmronUsbExamplePage> createState() => _OmronUsbExamplePageState();
}

class _OmronUsbExamplePageState extends State<OmronUsbExamplePage> {
  late final OmronUsbClient _client;
  final List<String> _logs = [];
  bool _busy = false;

  String _cpuInfo = '미연결';
  String _dmValues = '-';
  bool _cio0_00 = false;

  @override
  void initState() {
    super.initState();
    // 1. OmronUsbClient 초기화 (실시간 로그 수신)
    _client = OmronUsbClient(
      onLog: (msg) {
        setState(() {
          _logs.insert(0, msg);
          if (_logs.length > 100) _logs.removeLast();
        });
      },
    );

    // 2. USB 물리적 탈착 감지 리스너
    _client.lifecycleEvents?.listen((evt) {
      if (evt.event == 'DETACHED' || evt.event == 'DISCONNECTED') {
        setState(() {
          _cpuInfo = '연결 해제됨';
        });
      }
    });
  }

  @override
  void dispose() {
    _client.disconnect();
    super.dispose();
  }

  /// PLC USB 온라인 접속
  Future<void> _handleConnect() async {
    setState(() => _busy = true);
    try {
      // USB 스캔 -> 권한 확인 -> DTR/RTS 인가 -> Toolbus 동기화까지 원스톱 수행
      final ok = await _client.connect();
      if (ok) {
        // CPU 모델명 및 운전 모드 조회
        final cpu = await _client.readCpuData();
        final status = await _client.readCpuStatus();
        setState(() {
          _cpuInfo = '${cpu.model} (${cpu.version}) [모드: ${status.mode.name.toUpperCase()}]';
        });
        await _handleReadData();
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('접속 오류: $e')),
      );
    } finally {
      setState(() => _busy = false);
    }
  }

  /// PLC 메모리 데이터 읽기 (DM 영역 및 CIO 비트)
  Future<void> _handleReadData() async {
    if (!_client.isConnected) return;
    setState(() => _busy = true);
    try {
      // 1. DM 0번지부터 5개 워드 읽기 (FINS 01 01)
      final dmWords = await _client.readWords(
        area: FinsMemoryArea.dm,
        wordAddress: 0,
        count: 5,
      );

      // 2. CIO 0.00 비트 상태 읽기 (FINS 01 01)
      final bits = await _client.readBits(
        area: FinsMemoryArea.cio,
        wordAddress: 0,
        bitAddress: 0,
        count: 1,
      );

      setState(() {
        _dmValues = dmWords.map((w) => '0x${w.toRadixString(16).padLeft(4, '0')}').join(', ');
        _cio0_00 = bits.isNotEmpty ? bits.first : false;
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('데이터 읽기 오류: $e')),
      );
    } finally {
      setState(() => _busy = false);
    }
  }

  /// CIO 0.00 접점 토글 쓰기 (FINS 01 02)
  Future<void> _handleToggleBit() async {
    if (!_client.isConnected) return;
    setState(() => _busy = true);
    try {
      final nextVal = !_cio0_00;
      await _client.writeBit(
        area: FinsMemoryArea.cio,
        wordAddress: 0,
        bitAddress: 0,
        value: nextVal,
      );
      setState(() => _cio0_00 = nextVal);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('비트 쓰기 오류: $e')),
      );
    } finally {
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final connected = _client.isConnected;

    return Scaffold(
      appBar: AppBar(
        title: const Text('OMRON USB PLC 연결 예제'),
        backgroundColor: Colors.blueGrey[900],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 연결 상태 카드
            Card(
              color: connected ? Colors.green[900] : Colors.grey[850],
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          connected ? Icons.usb : Icons.usb_off,
                          color: connected ? Colors.greenAccent : Colors.grey,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          connected ? 'PLC 온라인 연결됨' : 'PLC 미연결',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'CPU 기종: $_cpuInfo',
                      style: const TextStyle(color: Colors.white70, fontSize: 14),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            // 동작 제어 버튼 그룹
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _busy
                        ? null
                        : (connected ? () => _client.disconnect().then((_) => setState(() {})) : _handleConnect),
                    icon: Icon(connected ? Icons.power_off : Icons.power),
                    label: Text(connected ? '연결 해제' : 'USB 직결 연결'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: connected ? Colors.redAccent : Colors.teal,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  onPressed: (!connected || _busy) ? null : _handleReadData,
                  icon: const Icon(Icons.refresh),
                  label: const Text('새로고침'),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // I/O 모니터링 및 제어 섹션
            Card(
              color: Colors.grey[900],
              child: Padding(
                padding: const EdgeInsets.all(12.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'I/O 접점 및 메모리 모니터링',
                      style: TextStyle(fontWeight: FontWeight.bold, color: Colors.amber),
                    ),
                    const Divider(color: Colors.white24),
                    Text('DM 0..4 값: $_dmValues', style: const TextStyle(color: Colors.white)),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('CIO 0.00 접점 상태: ${_cio0_00 ? "ON" : "OFF"}',
                            style: TextStyle(
                              color: _cio0_00 ? Colors.greenAccent : Colors.redAccent,
                              fontWeight: FontWeight.bold,
                            )),
                        ElevatedButton(
                          onPressed: (!connected || _busy) ? null : _handleToggleBit,
                          child: Text(_cio0_00 ? '비트 OFF 쓰기' : '비트 ON 쓰기'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // 실시간 통신 로그 콘솔
            const Text('실시간 FINS 통신 로그:', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.black,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: Colors.white24),
                ),
                child: ListView.builder(
                  itemCount: _logs.length,
                  itemBuilder: (context, idx) => Text(
                    _logs[idx],
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 11,
                      color: Colors.lightGreenAccent,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
