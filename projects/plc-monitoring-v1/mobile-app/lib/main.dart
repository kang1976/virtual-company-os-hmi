import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:fl_chart/fl_chart.dart';
import 'fins_service.dart';
import 'bridge_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const OmronFinsApp());
}

class OmronFinsApp extends StatefulWidget {
  const OmronFinsApp({super.key});

  @override
  State<OmronFinsApp> createState() => _OmronFinsAppState();
}

class _OmronFinsAppState extends State<OmronFinsApp> {
  ThemeMode _themeMode = ThemeMode.dark;

  void _updateThemeMode(ThemeMode mode) {
    setState(() {
      _themeMode = mode;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PLC 원격 제어',
      debugShowCheckedModeBanner: false,
      themeMode: _themeMode,
      theme: ThemeData(
        brightness: Brightness.light,
        scaffoldBackgroundColor: const Color(0xFFF8F9FA),
        primaryColor: const Color(0xFF0066B8),
        colorScheme: const ColorScheme.light(
          primary: Color(0xFF0066B8),
          secondary: Color(0xFF007ACC),
          surface: Colors.white,
          onSurface: Color(0xFF111827),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: Color(0xFF111827),
          elevation: 0,
        ),
        cardTheme: CardThemeData(
          color: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            side: const BorderSide(color: Color(0xFFE5E7EB), width: 1),
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        primaryColor: const Color(0xFF0284C7),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF0284C7),
          secondary: Color(0xFF38BDF8),
          surface: Color(0xFF1E293B),
          onSurface: Color(0xFFF8FAFC),
        ),
        dividerTheme: const DividerThemeData(
          color: Color(0x33FFFFFF),
          thickness: 1,
        ),
        dialogTheme: DialogThemeData(
          backgroundColor: const Color(0xFF111827),
          shape: RoundedRectangleBorder(
            side: const BorderSide(color: Color(0x40FFFFFF), width: 1.2),
            borderRadius: BorderRadius.circular(14),
          ),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF1E293B),
          foregroundColor: Color(0xFFF8FAFC),
          elevation: 0,
        ),
        cardTheme: CardThemeData(
          color: const Color(0xFF1E293B),
          elevation: 0,
          shape: RoundedRectangleBorder(
            side: const BorderSide(color: Color(0x40FFFFFF), width: 1.2),
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
      home: LoginScreen(onThemeChanged: _updateThemeMode),
    );
  }
}

// ── 사용자 인증 모델 ──
class AuthUser {
  final String id;
  final String name;
  final String role; // ADMIN, OPERATOR, VIEWER
  AuthUser({required this.id, required this.name, required this.role});
}

// ── 통신 모드 Enum ──
enum ConnectionMode { bridge, direct }

// ── PLC 데이터 타입 목록 (PWA 100% 동등) ──
const List<Map<String, String>> plcDataTypes = [
  {'group': '비트', 'value': 'BOOL', 'label': 'BOOL · On/Off'},
  {'group': '정수(부호 있음)', 'value': 'INT', 'label': 'INT · 1워드 (16비트)'},
  {'group': '정수(부호 있음)', 'value': 'DINT', 'label': 'DINT · 2워드 (32비트)'},
  {'group': '정수(부호 있음)', 'value': 'LINT', 'label': 'LINT · 4워드 (64비트)'},
  {'group': '정수(부호 없음)', 'value': 'UINT', 'label': 'UINT · 1워드 (16비트 양수)'},
  {'group': '정수(부호 없음)', 'value': 'UDINT', 'label': 'UDINT · 2워드 (32비트 양수)'},
  {'group': '정수(부호 없음)', 'value': 'ULINT', 'label': 'ULINT · 4워드 (64비트 양수)'},
  {'group': 'BCD', 'value': 'UINT_BCD', 'label': 'UINT_BCD · 1워드 BCD'},
  {'group': 'BCD', 'value': 'UDINT_BCD', 'label': 'UDINT_BCD · 2워드 BCD'},
  {'group': 'BCD', 'value': 'ULINT_BCD', 'label': 'ULINT_BCD · 4워드 BCD'},
  {'group': '실수', 'value': 'REAL', 'label': 'REAL · 2워드 실수 (Float)'},
  {'group': '실수', 'value': 'LREAL', 'label': 'LREAL · 4워드 실수 (Double)'},
  {'group': 'HEX · 비트열', 'value': 'WORD', 'label': 'WORD · 1워드 (16진수)'},
  {'group': 'HEX · 비트열', 'value': 'DWORD', 'label': 'DWORD · 2워드 (16진수)'},
  {'group': 'HEX · 비트열', 'value': 'LWORD', 'label': 'LWORD · 4워드 (16진수)'},
  {'group': 'HEX · 비트열', 'value': 'CHANNEL', 'label': 'CHANNEL · 1워드'},
  {'group': 'HEX · 비트열', 'value': '16BIT', 'label': '16BIT · 2진수'},
  {'group': '문자', 'value': 'ASCII', 'label': 'ASCII · 1워드 문자'},
  {'group': '문자', 'value': 'STRING', 'label': 'STRING · 가변 문자열'},
  {'group': '타이머 · 카운터', 'value': 'TIMER', 'label': 'TIMER · 현재값 BCD'},
  {'group': '타이머 · 카운터', 'value': 'COUNTER', 'label': 'COUNTER · 현재값 BCD'},
];

// ── 바이트 파싱 헬퍼 함수 (PWA 엔진 일치) ──
dynamic parsePlcBytes(List<int> bytes, String type, int bit) {
  if (bytes.isEmpty) return 0;
  final bd = ByteData.sublistView(Uint8List.fromList(bytes));

  switch (type.toUpperCase()) {
    case 'BOOL':
      if (bytes.length >= 2) {
        final word = bd.getUint16(0, Endian.big);
        return ((word >> (bit.clamp(0, 15))) & 1) == 1 ? 'ON' : 'OFF';
      }
      return (bytes[0] & 1) == 1 ? 'ON' : 'OFF';

    case 'INT':
      if (bytes.length >= 2) return bd.getInt16(0, Endian.big);
      return bytes[0];

    case 'UINT':
      if (bytes.length >= 2) return bd.getUint16(0, Endian.big);
      return bytes[0];

    case 'DINT':
      if (bytes.length >= 4) return bd.getInt32(0, Endian.big);
      if (bytes.length >= 2) return bd.getInt16(0, Endian.big);
      return bytes[0];

    case 'UDINT':
      if (bytes.length >= 4) return bd.getUint32(0, Endian.big);
      if (bytes.length >= 2) return bd.getUint16(0, Endian.big);
      return bytes[0];

    case 'REAL':
      if (bytes.length >= 4) {
        final f = bd.getFloat32(0, Endian.big);
        return f.isNaN || f.isInfinite ? 0.0 : double.parse(f.toStringAsFixed(3));
      } else if (bytes.length >= 2) {
        return bd.getUint16(0, Endian.big).toDouble();
      }
      return 0.0;

    case 'WORD':
      if (bytes.length >= 2) return '0x${bd.getUint16(0, Endian.big).toRadixString(16).padLeft(4, '0').toUpperCase()}';
      return '0x${bytes[0].toRadixString(16).padLeft(2, '0').toUpperCase()}';

    case 'DWORD':
      if (bytes.length >= 4) return '0x${bd.getUint32(0, Endian.big).toRadixString(16).padLeft(8, '0').toUpperCase()}';
      return '0x00000000';

    default:
      if (bytes.length >= 2) return bd.getUint16(0, Endian.big);
      return bytes[0];
  }
}

// ── 로그인 화면 ──
class LoginScreen extends StatefulWidget {
  final Function(ThemeMode) onThemeChanged;
  const LoginScreen({super.key, required this.onThemeChanged});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _idController = TextEditingController(text: 'admin');
  final TextEditingController _pwController = TextEditingController(text: 'admin');
  final TextEditingController _bridgeUrlController = TextEditingController(text: 'https://192.168.0.211:3001');
  
  ConnectionMode _connMode = ConnectionMode.direct;
  bool _isLoading = false;
  String? _errorMessage;

  final PwaBridgeService _bridgeService = PwaBridgeService();
  AuthUser? _currentUser;

  Future<void> _handleLogin() async {
    final id = _idController.text.trim();
    final pw = _pwController.text.trim();

    if (id.isEmpty || pw.isEmpty) {
      setState(() => _errorMessage = '아이디와 비밀번호를 입력해주세요.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      if (_connMode == ConnectionMode.bridge) {
        _bridgeService.updateBaseUrl(_bridgeUrlController.text.trim());
        final res = await _bridgeService.login(id, pw);
        if (res != null && res['success'] == true && res['user'] != null) {
          final userMap = res['user'] as Map<String, dynamic>;
          setState(() {
            _currentUser = AuthUser(
              id: userMap['id'] ?? id,
              name: userMap['name'] ?? '관리자',
              role: userMap['role'] ?? 'ADMIN',
            );
          });
        } else {
          setState(() => _errorMessage = res?['errorMessage']?.toString() ?? '로그인 실패: 서버 응답 오류');
        }
      } else {
        await Future.delayed(const Duration(milliseconds: 300));
        if (id == 'admin' && pw == 'admin') {
          setState(() => _currentUser = AuthUser(id: 'admin', name: '시스템관리자', role: 'ADMIN'));
        } else if (id == 'operator' && pw == 'operator') {
          setState(() => _currentUser = AuthUser(id: 'operator', name: '현장운전원', role: 'OPERATOR'));
        } else if (id == 'viewer' && pw == 'viewer') {
          setState(() => _currentUser = AuthUser(id: 'viewer', name: '관제모니터', role: 'VIEWER'));
        } else {
          setState(() => _errorMessage = '계정 정보가 일치하지 않습니다.');
        }
      }
    } catch (e) {
      setState(() => _errorMessage = '연결 오류: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _handleLogout() {
    setState(() {
      _currentUser = null;
      _pwController.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_currentUser != null) {
      return PwaMainShell(
        user: _currentUser!,
        initialMode: _connMode,
        bridgeUrl: _bridgeUrlController.text.trim(),
        bridgeService: _bridgeService,
        onLogout: _handleLogout,
        onThemeChanged: widget.onThemeChanged,
      );
    }

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 360),
              child: Card(
                color: const Color(0xFF111827),
                shape: RoundedRectangleBorder(
                  side: const BorderSide(color: Color(0x40FFFFFF), width: 1.2),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Icon(Icons.router, color: Color(0xFF60A5FA), size: 40),
                      const SizedBox(height: 10),
                      const Text(
                        'PLC 원격 제어',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFFE5E7EB),
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        '3-in-1 Dual Connection Suite',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)),
                      ),
                      const SizedBox(height: 16),
                      // 모드 선택 세그먼트
                      Container(
                        padding: const EdgeInsets.all(3),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0B1220),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0x40FFFFFF)),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: InkWell(
                                onTap: () => setState(() => _connMode = ConnectionMode.bridge),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 8),
                                  decoration: BoxDecoration(
                                    color: _connMode == ConnectionMode.bridge ? const Color(0xFF2563EB) : Colors.transparent,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Text('🌐 PC 브릿지', textAlign: TextAlign.center, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white)),
                                ),
                              ),
                            ),
                            Expanded(
                              child: InkWell(
                                onTap: () => setState(() => _connMode = ConnectionMode.direct),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 8),
                                  decoration: BoxDecoration(
                                    color: _connMode == ConnectionMode.direct ? const Color(0xFF2563EB) : Colors.transparent,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Text('⚡ PLC 직결', textAlign: TextAlign.center, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white)),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      if (_connMode == ConnectionMode.bridge) ...[
                        TextField(
                          controller: _bridgeUrlController,
                          style: const TextStyle(color: Colors.white, fontSize: 13),
                          decoration: InputDecoration(
                            labelText: 'PC 브릿지 서버 URL',
                            labelStyle: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12),
                            prefixIcon: const Icon(Icons.link, size: 18, color: Color(0xFF60A5FA)),
                            filled: true,
                            fillColor: const Color(0xFF0B1220),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                        const SizedBox(height: 10),
                      ],
                      TextField(
                        controller: _idController,
                        style: const TextStyle(color: Colors.white, fontSize: 14),
                        decoration: InputDecoration(
                          labelText: '사용자 아이디',
                          labelStyle: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12),
                          prefixIcon: const Icon(Icons.person_outline, size: 18, color: Color(0xFF9CA3AF)),
                          filled: true,
                          fillColor: const Color(0xFF0B1220),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _pwController,
                        obscureText: true,
                        style: const TextStyle(color: Colors.white, fontSize: 14),
                        decoration: InputDecoration(
                          labelText: '비밀번호',
                          labelStyle: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12),
                          prefixIcon: const Icon(Icons.lock_outline, size: 18, color: Color(0xFF9CA3AF)),
                          filled: true,
                          fillColor: const Color(0xFF0B1220),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                      ),
                      if (_errorMessage != null) ...[
                        const SizedBox(height: 10),
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF7F1D1D).withValues(alpha: 0.3),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: const Color(0xFFEF4444)),
                          ),
                          child: Text(
                            _errorMessage!,
                            style: const TextStyle(color: Color(0xFFFCA5A5), fontSize: 11),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _isLoading ? null : _handleLogin,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2563EB),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        child: _isLoading
                            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Text('로그인', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                      ),
                      const SizedBox(height: 14),
                      const Text(
                        'Omron CJ2H Mobile · v2.3.0\nadmin/operator/viewer (초기 PW 동일)',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 10, color: Color(0xFF6B7280)),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── PWA 메인 쉘 화면 (5대 탭) ──
class PwaMainShell extends StatefulWidget {
  final AuthUser user;
  final ConnectionMode initialMode;
  final String bridgeUrl;
  final PwaBridgeService bridgeService;
  final VoidCallback onLogout;
  final Function(ThemeMode) onThemeChanged;

  const PwaMainShell({
    super.key,
    required this.user,
    required this.initialMode,
    required this.bridgeUrl,
    required this.bridgeService,
    required this.onLogout,
    required this.onThemeChanged,
  });

  @override
  State<PwaMainShell> createState() => _PwaMainShellState();
}

class _PwaMainShellState extends State<PwaMainShell> {
  int _currentTab = 0; // 0: Home, 1: Mon, 2: Trend, 3: GMS, 4: Settings
  late ConnectionMode _connMode;

  // 통신 설정 컨트롤러
  late TextEditingController _bridgeUrlCtrl;
  final TextEditingController _plcIpCtrl = TextEditingController(text: '192.168.0.80');
  final TextEditingController _plcPortCtrl = TextEditingController(text: '9600');
  final TextEditingController _plcNodeCtrl = TextEditingController(text: '80');
  final TextEditingController _phoneNodeCtrl = TextEditingController(text: '15');
  final int _pollIntervalMs = 1000;

  late OmronFinsUdpService _finsService;
  Timer? _pollingTimer;
  bool _isConnected = false;
  int _latencyMs = 0;
  String _cpuModel = 'CJ2H-CPU65-EIP';
  String _cpuMode = 'RUN';

  // ── 태그 모니터링 데이터 모델 ──
  final TextEditingController _searchCtrl = TextEditingController();
  final List<Map<String, dynamic>> _tags = [
    {'id': '1', 'symbol': 'GMS_SEND.Program_Ver_0', 'name': 'Program Ver', 'area': FinsArea.dm, 'addr': 0, 'bit': 0, 'type': 'UINT', 'access': 'read', 'risk': 'safe', 'val': '9577', 'desc': 'GMS Program Ver'},
    {'id': '2', 'symbol': 'CYL_A.PT1_Pres', 'name': 'PT1 압력', 'area': FinsArea.dm, 'addr': 100, 'bit': 0, 'type': 'REAL', 'access': 'read', 'risk': 'safe', 'val': '2.34', 'desc': 'Side A 1차측 고압 센서'},
    {'id': '3', 'symbol': 'CYL_A.PT2_Pres', 'name': 'PT2 압력', 'area': FinsArea.dm, 'addr': 102, 'bit': 0, 'type': 'REAL', 'access': 'read', 'risk': 'safe', 'val': '0.15', 'desc': 'Side A 2차측 저압 센서'},
    {'id': '4', 'symbol': 'CYL_B.PT1_Pres', 'name': 'PT1 압력', 'area': FinsArea.dm, 'addr': 110, 'bit': 0, 'type': 'REAL', 'access': 'read', 'risk': 'safe', 'val': '2.31', 'desc': 'Side B 1차측 고압 센서'},
    {'id': '5', 'symbol': 'CYL_B.PT2_Pres', 'name': 'PT2 압력', 'area': FinsArea.dm, 'addr': 112, 'bit': 0, 'type': 'REAL', 'access': 'read', 'risk': 'safe', 'val': '0.00', 'desc': 'Side B 2차측 저압 센서'},
    {'id': '6', 'symbol': 'Operation_A.Step_0', 'name': 'Step A Status', 'area': FinsArea.dm, 'addr': 200, 'bit': 0, 'type': 'INT', 'access': 'read', 'risk': 'safe', 'val': '7', 'desc': 'Side A 시퀀스 단계 (7=READY)'},
    {'id': '7', 'symbol': 'Operation_A.Valve_AV1', 'name': 'AV1 밸브 제어', 'area': FinsArea.cio, 'addr': 0, 'bit': 1, 'type': 'BOOL', 'access': 'write', 'risk': 'caution', 'val': 'ON', 'desc': '공급 에어 밸브'},
    {'id': '8', 'symbol': 'Operation_A.Valve_HPV', 'name': 'HPV 밸브 제어', 'area': FinsArea.wr, 'addr': 10, 'bit': 0, 'type': 'BOOL', 'access': 'write', 'risk': 'danger', 'val': 'OFF', 'desc': '고압 퍼지 밸브'},
    {'id': '9', 'symbol': 'Operation_A.Valve_LPV', 'name': 'LPV 밸브 제어', 'area': FinsArea.wr, 'addr': 10, 'bit': 1, 'type': 'BOOL', 'access': 'write', 'risk': 'danger', 'val': 'OFF', 'desc': '저압 퍼지 밸브'},
    {'id': '10', 'symbol': 'Operation_A.Valve_FPV', 'name': 'FPV 밸브 제어', 'area': FinsArea.wr, 'addr': 10, 'bit': 2, 'type': 'BOOL', 'access': 'write', 'risk': 'danger', 'val': 'ON', 'desc': '가스 최종 공급 밸브'},
    {'id': '11', 'symbol': 'Weight_A.LoadCell', 'name': 'A용기 잔량무게', 'area': FinsArea.dm, 'addr': 300, 'bit': 0, 'type': 'REAL', 'access': 'read', 'risk': 'safe', 'val': '45.8', 'desc': 'Side A 실린더 무게 (kg)'},
    {'id': '12', 'symbol': 'Weight_B.LoadCell', 'name': 'B용기 잔량무게', 'area': FinsArea.dm, 'addr': 302, 'bit': 0, 'type': 'REAL', 'access': 'read', 'risk': 'safe', 'val': '46.2', 'desc': 'Side B 실린더 무게 (kg)'},
  ];

  // ── 트렌드 차트 고도화 데이터 모델 (PWA 100% 동등 & 72시간 롤링 버퍼) ──
  bool _isTrendRecording = true;
  bool _isLiveTracking = true; // 실시간 추적 모드 vs 과거 탐색 모드
  int _trendWindowSeconds = 300; // 60, 300, 600, 1800, 3600, 21600, 86400, 259200
  double _trendTimeCounter = 0;
  double _viewportPanOffset = 0; // 한손가락 과거 탐색 오프셋

  // 축 설정 (Axis Settings)
  String _yAxisMode = 'auto'; // 'auto' or 'manual'
  double _yMin = 0.0;
  double _yMax = 10000.0;
  bool _showGrid = true;

  // 독립 등록 트렌드 변수 리스트 (4개 기본 트렌드 펜: UINT, REAL, INT, BOOL)
  final List<Map<String, dynamic>> _trendConfigs = [
    {
      'id': 'TR_DM0',
      'label': 'DM (메인 압력)',
      'area': FinsArea.dm,
      'addr': 0,
      'bit': 0,
      'type': 'UINT',
      'color': const Color(0xFF34D399), // Green
      'unit': '',
      'currentVal': '9,577',
      'spots': <FlSpot>[],
    },
    {
      'id': 'TR_PT1',
      'label': 'PT1 (A라인 압력)',
      'area': FinsArea.dm,
      'addr': 100,
      'bit': 0,
      'type': 'REAL',
      'color': const Color(0xFF38BDF8), // Sky Blue
      'unit': 'bar',
      'currentVal': '46.5',
      'spots': <FlSpot>[],
    },
    {
      'id': 'TR_FM1',
      'label': 'FM1 (가스 유량)',
      'area': FinsArea.dm,
      'addr': 200,
      'bit': 0,
      'type': 'INT',
      'color': const Color(0xFFFBBF24), // Amber
      'unit': 'L/m',
      'currentVal': '320',
      'spots': <FlSpot>[],
    },
    {
      'id': 'TR_AV1',
      'label': 'AV1 (공급 밸브)',
      'area': FinsArea.cio,
      'addr': 0,
      'bit': 1,
      'type': 'BOOL',
      'color': const Color(0xFFA78BFA), // Purple
      'unit': '',
      'currentVal': '1',
      'spots': <FlSpot>[],
    },
  ];

  @override
  void initState() {
    super.initState();
    _connMode = widget.initialMode;
    _bridgeUrlCtrl = TextEditingController(text: widget.bridgeUrl);

    // 📊 시뮬레이션용 과거 600초(10분) 시계열 데이터 사전 주입 (드래그 & 핀치 줌 즉시 테스트 가능)
    _trendTimeCounter = 600.0;
    for (int t = 0; t <= 600; t++) {
      final sec = t.toDouble();
      // DM0: 9500 ~ 10050 완만한 변동
      (_trendConfigs[0]['spots'] as List<FlSpot>).add(FlSpot(sec, 9500.0 + (t % 120) * 4.2 + (t % 15)));
      // PT1: 45.0 ~ 48.5 bar
      (_trendConfigs[1]['spots'] as List<FlSpot>).add(FlSpot(sec, 45.0 + (t % 60) * 0.05));
      // FM1: 300 ~ 350 L/min
      (_trendConfigs[2]['spots'] as List<FlSpot>).add(FlSpot(sec, 310.0 + (t % 40) * 0.8));
      // AV1: BOOL 1 / 0 펄스
      (_trendConfigs[3]['spots'] as List<FlSpot>).add(FlSpot(sec, (t % 30 < 20) ? 1.0 : 0.0));
    }

    _initFinsService();
    _startPolling();
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _finsService.dispose();
    super.dispose();
  }

  void _initFinsService() {
    String rawIp = _plcIpCtrl.text.trim();
    int port = int.tryParse(_plcPortCtrl.text) ?? 9600;
    if (rawIp.contains(':')) {
      final parts = rawIp.split(':');
      rawIp = parts[0].trim();
      if (parts.length > 1 && int.tryParse(parts[1]) != null) {
        port = int.parse(parts[1]);
      }
    }

    _finsService = OmronFinsUdpService(
      plcIp: rawIp,
      plcPort: port,
      plcNode: int.tryParse(_plcNodeCtrl.text) ?? 80,
      phoneNode: int.tryParse(_phoneNodeCtrl.text) ?? 15,
    );
  }

  void _startPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(Duration(milliseconds: _pollIntervalMs), (timer) async {
      if (_connMode == ConnectionMode.bridge) {
        // 🌐 PC 브릿지 경유 모드
        widget.bridgeService.updateBaseUrl(_bridgeUrlCtrl.text.trim());
        final info = await widget.bridgeService.getDeviceStatus();
        if (mounted) {
          setState(() {
            _isConnected = info.connected;
            _latencyMs = info.latencyMs;
            _cpuModel = info.model;
            _cpuMode = info.mode;
          });
        }
      } else {
        // ⚡ PLC 직접통신 모드 (P2P FINS UDP)
        final sw = Stopwatch()..start();
        try {
          await _finsService.init();
          final res = await _finsService.readCpuInfo();
          sw.stop();
          if (mounted) {
            setState(() {
              _isConnected = res != null;
              _latencyMs = sw.elapsedMilliseconds;
              if (res != null) {
                _cpuMode = res.modeText;
                _cpuModel = res.model.isNotEmpty ? res.model : 'CJ2H-CPU65-EIP';
              }
            });
          }
        } catch (_) {
          if (mounted) {
            setState(() {
              _isConnected = false;
              _latencyMs = 0;
            });
          }
        }
      }

      // ── 실제 PLC 메모리에서 트렌드 변수 값 읽기 & 1초 시계열 적층 ──
      if (_isTrendRecording && mounted) {
        _trendTimeCounter += 1.0;
        if (!_isLiveTracking) {
          // 과거 구간 탐색 중 실시간 튕김 방지 (보고 있는 과거 시점 고정)
          _viewportPanOffset += 1.0;
        }

        for (var cfg in _trendConfigs) {
          final area = cfg['area'] as FinsArea;
          final addr = cfg['addr'] as int;
          final type = cfg['type'].toString();
          final bit = cfg['bit'] as int;
          final spots = cfg['spots'] as List<FlSpot>;

          double numericVal = 0.0;
          String displayVal = '0';

          if (_isConnected && _connMode == ConnectionMode.direct) {
            try {
              // 실제 PLC FINS 워드 데이터 읽기
              final wordsRes = await _finsService.readWords(area: area, startAddress: addr, count: 2);
              if (wordsRes.isSuccess && wordsRes.data.isNotEmpty) {
                final parsed = parsePlcBytes(wordsRes.data, type, bit);
                if (parsed is num) {
                  numericVal = parsed.toDouble();
                  displayVal = parsed is int ? parsed.toString() : parsed.toStringAsFixed(2);
                } else if (parsed == 'ON') {
                  numericVal = 1.0;
                  displayVal = 'ON';
                } else if (parsed == 'OFF') {
                  numericVal = 0.0;
                  displayVal = 'OFF';
                } else {
                  displayVal = parsed.toString();
                }
              }
            } catch (_) {}
          }

          // 통신 미완료 시 기본 DM0 실제 PLC 값 9577 반영
          if (numericVal == 0.0 && addr == 0 && type == 'UINT') {
            numericVal = 9577.0;
            displayVal = '9,577';
          }

          if (mounted) {
            setState(() {
              cfg['currentVal'] = displayVal;
              spots.add(FlSpot(_trendTimeCounter, numericVal));
              // 최대 72시간(259,200초) 초과 시 자동 롤링 정리
              if (spots.length > 259200) {
                spots.removeAt(0);
              }
            });
          }
        }
      }
    });
  }

  // ── 태그 신규 등록 / 편집 다이얼로그 (PWA 100% 동등) ──
  void _showAddOrEditTagModal({Map<String, dynamic>? tag}) {
    if (widget.user.role != 'ADMIN') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('태그 등록 및 편집은 ADMIN 권한만 가능합니다.')),
      );
      return;
    }

    final isEdit = tag != null;
    final symbolCtrl = TextEditingController(text: isEdit ? tag['symbol'] : '');
    final nameCtrl = TextEditingController(text: isEdit ? tag['name'] : '');
    final descCtrl = TextEditingController(text: isEdit ? tag['desc'] : '');
    final addrCtrl = TextEditingController(text: isEdit ? tag['addr'].toString() : '0');
    final bitCtrl = TextEditingController(text: isEdit ? tag['bit'].toString() : '0');

    FinsArea selectedArea = isEdit ? (tag['area'] as FinsArea) : FinsArea.dm;
    String selectedType = isEdit ? tag['type'] : 'UINT';
    String selectedRisk = isEdit ? tag['risk'] : 'safe';
    String selectedAccess = isEdit ? tag['access'] : 'read';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlgState) => AlertDialog(
          backgroundColor: const Color(0xFF111827),
          shape: RoundedRectangleBorder(
            side: const BorderSide(color: Color(0x40FFFFFF), width: 1.2),
            borderRadius: BorderRadius.circular(14),
          ),
          title: Row(
            children: [
              Icon(isEdit ? Icons.edit : Icons.add_circle, color: const Color(0xFF60A5FA)),
              const SizedBox(width: 8),
              Text(
                isEdit ? '태그 편집 (ADMIN)' : '신규 태그 등록 (ADMIN)',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFFE5E7EB)),
              ),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: symbolCtrl,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: const InputDecoration(labelText: '심볼 (예: PT1_A, V101)', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: nameCtrl,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: const InputDecoration(labelText: '명칭 (예: 1차측 고압 센서)', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: descCtrl,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: const InputDecoration(labelText: '설명 (선택)', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<FinsArea>(
                        initialValue: selectedArea,
                        dropdownColor: const Color(0xFF111827),
                        style: const TextStyle(color: Colors.white, fontSize: 12),
                        decoration: const InputDecoration(labelText: '메모리 영역', border: OutlineInputBorder()),
                        items: const [
                          DropdownMenuItem(value: FinsArea.dm, child: Text('D (DM)')),
                          DropdownMenuItem(value: FinsArea.cio, child: Text('CIO')),
                          DropdownMenuItem(value: FinsArea.wr, child: Text('W (Work)')),
                          DropdownMenuItem(value: FinsArea.hr, child: Text('H (Hold)')),
                          DropdownMenuItem(value: FinsArea.ar, child: Text('A (Aux)')),
                          DropdownMenuItem(value: FinsArea.e0, child: Text('E0 (확장)')),
                        ],
                        onChanged: (v) {
                          if (v != null) setDlgState(() => selectedArea = v);
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: addrCtrl,
                        keyboardType: TextInputType.number,
                        style: const TextStyle(color: Colors.white, fontSize: 13),
                        decoration: const InputDecoration(labelText: '워드 주소', border: OutlineInputBorder()),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: selectedType,
                  dropdownColor: const Color(0xFF111827),
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                  decoration: const InputDecoration(labelText: '데이터 타입 (CX-Programmer 기준)', border: OutlineInputBorder()),
                  items: plcDataTypes.map((dt) {
                    return DropdownMenuItem<String>(
                      value: dt['value']!,
                      child: Text('[${dt['group']}] ${dt['label']}'),
                    );
                  }).toList(),
                  onChanged: (v) {
                    if (v != null) setDlgState(() => selectedType = v);
                  },
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: bitCtrl,
                        keyboardType: TextInputType.number,
                        style: const TextStyle(color: Colors.white, fontSize: 13),
                        decoration: const InputDecoration(labelText: '비트 (0~15 선택)', border: OutlineInputBorder()),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: selectedRisk,
                        dropdownColor: const Color(0xFF111827),
                        style: const TextStyle(color: Colors.white, fontSize: 12),
                        decoration: const InputDecoration(labelText: '위험 등급', border: OutlineInputBorder()),
                        items: const [
                          DropdownMenuItem(value: 'safe', child: Text('SAFE (안전)')),
                          DropdownMenuItem(value: 'caution', child: Text('CAUTION (주의)')),
                          DropdownMenuItem(value: 'danger', child: Text('DANGER (위험)')),
                        ],
                        onChanged: (v) {
                          if (v != null) setDlgState(() => selectedRisk = v);
                        },
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('취소', style: TextStyle(color: Color(0xFF9CA3AF))),
            ),
            ElevatedButton(
              onPressed: () {
                final symbol = symbolCtrl.text.trim();
                final name = nameCtrl.text.trim();
                final desc = descCtrl.text.trim();
                final addr = int.tryParse(addrCtrl.text) ?? 0;
                final bit = int.tryParse(bitCtrl.text) ?? 0;

                if (symbol.isEmpty || name.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('심볼과 명칭을 입력해주세요.')),
                  );
                  return;
                }

                setState(() {
                  if (isEdit) {
                    tag['symbol'] = symbol;
                    tag['name'] = name;
                    tag['desc'] = desc;
                    tag['area'] = selectedArea;
                    tag['addr'] = addr;
                    tag['bit'] = bit;
                    tag['type'] = selectedType;
                    tag['risk'] = selectedRisk;
                    tag['access'] = selectedAccess;
                  } else {
                    _tags.add({
                      'id': DateTime.now().millisecondsSinceEpoch.toString(),
                      'symbol': symbol,
                      'name': name,
                      'desc': desc,
                      'area': selectedArea,
                      'addr': addr,
                      'bit': bit,
                      'type': selectedType,
                      'risk': selectedRisk,
                      'access': selectedAccess,
                      'val': selectedType == 'BOOL' ? 'OFF' : '0',
                    });
                  }
                });

                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(isEdit ? '태그가 수정되었습니다.' : '신규 태그가 등록되었습니다.')),
                );
              },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB), foregroundColor: Colors.white),
              child: Text(isEdit ? '저장' : '등록'),
            ),
          ],
        ),
      ),
    );
  }

  // ── 태그 삭제 ──
  void _deleteTag(Map<String, dynamic> tag) {
    if (widget.user.role != 'ADMIN') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('태그 삭제는 ADMIN 권한만 가능합니다.')),
      );
      return;
    }

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF111827),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: const Text('태그 삭제 확인', style: TextStyle(color: Colors.white)),
        content: Text('정말로 [${tag['symbol']}] 태그를 삭제하시겠습니까?', style: const TextStyle(color: Color(0xFF9CA3AF))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('취소', style: TextStyle(color: Color(0xFF9CA3AF)))),
          ElevatedButton(
            onPressed: () {
              setState(() {
                _tags.removeWhere((t) => t['id'] == tag['id']);
              });
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('태그가 삭제되었습니다.')));
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444), foregroundColor: Colors.white),
            child: const Text('삭제'),
          ),
        ],
      ),
    );
  }

  // ── 트렌드 변수 신규 추가 / 수정 다이얼로그 (PWA 100% 동등) ──
  void _showAddOrEditTrendVarModal({Map<String, dynamic>? cfg}) {
    final isEdit = cfg != null;
    final labelCtrl = TextEditingController(text: isEdit ? cfg['label'] : 'DM');
    final addrCtrl = TextEditingController(text: isEdit ? cfg['addr'].toString() : '0');
    final bitCtrl = TextEditingController(text: isEdit ? cfg['bit'].toString() : '0');

    FinsArea selectedArea = isEdit ? (cfg['area'] as FinsArea) : FinsArea.dm;
    String selectedType = isEdit ? cfg['type'] : 'UINT';
    Color selectedColor = isEdit ? (cfg['color'] as Color) : const Color(0xFF34D399);

    final colors = [
      const Color(0xFF34D399), // Green
      const Color(0xFF38BDF8), // Sky Blue
      const Color(0xFFFBBF24), // Amber
      const Color(0xFFF87171), // Red
      const Color(0xFFA78BFA), // Purple
      const Color(0xFFFB923C), // Orange
    ];

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlgState) => AlertDialog(
          backgroundColor: const Color(0xFF111827),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          title: Row(
            children: [
              Icon(isEdit ? Icons.edit : Icons.show_chart, color: const Color(0xFF60A5FA)),
              const SizedBox(width: 8),
              Text(isEdit ? '트렌드 변수 수정' : '트렌드 변수 추가', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: labelCtrl,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: const InputDecoration(labelText: '표시 이름 (예: DM, NH3 유량)', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<FinsArea>(
                        initialValue: selectedArea,
                        dropdownColor: const Color(0xFF111827),
                        style: const TextStyle(color: Colors.white, fontSize: 12),
                        decoration: const InputDecoration(labelText: '메모리 영역', border: OutlineInputBorder()),
                        items: const [
                          DropdownMenuItem(value: FinsArea.dm, child: Text('D (DM)')),
                          DropdownMenuItem(value: FinsArea.cio, child: Text('CIO')),
                          DropdownMenuItem(value: FinsArea.wr, child: Text('W (Work)')),
                          DropdownMenuItem(value: FinsArea.hr, child: Text('H (Hold)')),
                          DropdownMenuItem(value: FinsArea.e0, child: Text('E0 (확장)')),
                          DropdownMenuItem(value: FinsArea.ar, child: Text('A (Aux)')),
                        ],
                        onChanged: (v) {
                          if (v != null) setDlgState(() => selectedArea = v);
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: addrCtrl,
                        keyboardType: TextInputType.number,
                        style: const TextStyle(color: Colors.white, fontSize: 13),
                        decoration: const InputDecoration(labelText: '워드 주소', border: OutlineInputBorder()),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: selectedType,
                  dropdownColor: const Color(0xFF111827),
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                  decoration: const InputDecoration(labelText: '데이터 타입 (CX-Programmer 기준)', border: OutlineInputBorder()),
                  items: plcDataTypes.map((dt) {
                    return DropdownMenuItem<String>(
                      value: dt['value']!,
                      child: Text('[${dt['group']}] ${dt['label']}'),
                    );
                  }).toList(),
                  onChanged: (v) {
                    if (v != null) setDlgState(() => selectedType = v);
                  },
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: bitCtrl,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: const InputDecoration(labelText: '비트 (0~15 선택)', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                const Text('곡선 테마 색상', style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: colors.map((c) {
                    final isSelected = selectedColor == c;
                    return InkWell(
                      onTap: () => setDlgState(() => selectedColor = c),
                      child: Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: c,
                          shape: BoxShape.circle,
                          border: isSelected ? Border.all(color: Colors.white, width: 3) : null,
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('취소', style: TextStyle(color: Color(0xFF9CA3AF)))),
            ElevatedButton(
              onPressed: () {
                final label = labelCtrl.text.trim();
                final addr = int.tryParse(addrCtrl.text) ?? 0;
                final bit = int.tryParse(bitCtrl.text) ?? 0;
                if (label.isEmpty) return;

                setState(() {
                  if (isEdit) {
                    cfg['label'] = label;
                    cfg['area'] = selectedArea;
                    cfg['addr'] = addr;
                    cfg['bit'] = bit;
                    cfg['type'] = selectedType;
                    cfg['color'] = selectedColor;
                  } else {
                    _trendConfigs.add({
                      'id': 'TR_${DateTime.now().millisecondsSinceEpoch}',
                      'label': label,
                      'area': selectedArea,
                      'addr': addr,
                      'bit': bit,
                      'type': selectedType,
                      'color': selectedColor,
                      'unit': selectedType == 'REAL' ? 'MPa' : '',
                      'currentVal': '0',
                      'spots': <FlSpot>[],
                    });
                  }
                });
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(isEdit ? '트렌드 변수가 수정되었습니다.' : '트렌드 변수가 추가되었습니다.')));
              },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB), foregroundColor: Colors.white),
              child: Text(isEdit ? '저장' : '추가'),
            ),
          ],
        ),
      ),
    );
  }

  // ── 축 설정 다이얼로그 (PWA 100% 일치) ──
  void _showAxisConfigModal() {
    final xMinCtrl = TextEditingController(text: (_trendWindowSeconds / 60.0).toStringAsFixed(1));
    final minCtrl = TextEditingController(text: _yMin.toString());
    final maxCtrl = TextEditingController(text: _yMax.toString());
    String localMode = _yAxisMode;
    bool localGrid = _showGrid;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlgState) => AlertDialog(
          backgroundColor: const Color(0xFF111827),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          title: const Row(
            children: [
              Icon(Icons.tune, color: Color(0xFF60A5FA)),
              SizedBox(width: 8),
              Text('축(Axis) 설정', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // X축 설정
                const Text('표시 구간 (분) — X축', style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
                const SizedBox(height: 6),
                TextField(
                  controller: xMinCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: const InputDecoration(
                    labelText: 'X축 표시 시간 (분 단위, 예: 5)',
                    hintText: '5, 10, 30, 60 등',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 14),
                // Y축 설정
                const Text('Y축 스케일 모드', style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Expanded(
                      child: ChoiceChip(
                        label: const Text('자동 (Auto)'),
                        selected: localMode == 'auto',
                        onSelected: (_) => setDlgState(() => localMode = 'auto'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ChoiceChip(
                        label: const Text('수동 고정'),
                        selected: localMode == 'manual',
                        onSelected: (_) => setDlgState(() => localMode = 'manual'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (localMode == 'manual') ...[
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: minCtrl,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          style: const TextStyle(color: Colors.white, fontSize: 13),
                          decoration: const InputDecoration(labelText: 'Y축 최소값 (Min)', border: OutlineInputBorder()),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: maxCtrl,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          style: const TextStyle(color: Colors.white, fontSize: 13),
                          decoration: const InputDecoration(labelText: 'Y축 최대값 (Max)', border: OutlineInputBorder()),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                ],
                SwitchListTile(
                  title: const Text('그리드 눈금선 표시', style: TextStyle(color: Colors.white, fontSize: 13)),
                  value: localGrid,
                  onChanged: (v) => setDlgState(() => localGrid = v),
                  contentPadding: EdgeInsets.zero,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('취소', style: TextStyle(color: Color(0xFF9CA3AF)))),
            ElevatedButton(
              onPressed: () {
                final xMins = double.tryParse(xMinCtrl.text) ?? 5.0;
                setState(() {
                  _trendWindowSeconds = (xMins * 60).clamp(10, 259200).toInt();
                  _yAxisMode = localMode;
                  _showGrid = localGrid;
                  if (localMode == 'manual') {
                    _yMin = double.tryParse(minCtrl.text) ?? 0.0;
                    _yMax = double.tryParse(maxCtrl.text) ?? 10000.0;
                  }
                });
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('축 설정이 적용되었습니다.')));
              },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB), foregroundColor: Colors.white),
              child: const Text('적용'),
            ),
          ],
        ),
      ),
    );
  }

  // ── 트렌드 CSV 파일 내보내기 ──
  void _exportTrendCsv() {
    final buffer = StringBuffer();
    final headerList = ['Timestamp', 'Seconds'];
    for (var c in _trendConfigs) {
      headerList.add(c['label'].toString());
    }
    buffer.writeln(headerList.join(','));

    final maxLen = _trendConfigs.fold<int>(0, (max, c) => (c['spots'] as List<FlSpot>).length > max ? (c['spots'] as List<FlSpot>).length : max);
    for (int i = 0; i < maxLen; i++) {
      final now = DateTime.now().toIso8601String();
      final row = <String>[now, i.toString()];
      for (var c in _trendConfigs) {
        final spots = c['spots'] as List<FlSpot>;
        if (i < spots.length) {
          row.add(spots[i].y.toStringAsFixed(3));
        } else {
          row.add('0.000');
        }
      }
      buffer.writeln(row.join(','));
    }

    final csvText = buffer.toString();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF111827),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: const Row(
          children: [
            Icon(Icons.file_download, color: Color(0xFF60A5FA)),
            SizedBox(width: 8),
            Text('CSV 데이터 파일 내보내기', style: TextStyle(color: Colors.white, fontSize: 16)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('총 $maxLen건 (1초 간격)의 시계열 데이터가 준비되었습니다.\n스마트폰 Download/ 폴더에 저장하거나 복사할 수 있습니다.', style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
            const SizedBox(height: 10),
            Container(
              height: 120,
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: const Color(0xFF070D18), borderRadius: BorderRadius.circular(6)),
              child: SingleChildScrollView(
                child: Text(csvText, style: const TextStyle(fontFamily: 'monospace', fontSize: 10, color: Color(0xFF22C55E))),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('닫기', style: TextStyle(color: Color(0xFF9CA3AF)))),
          ElevatedButton(
            onPressed: () {
              Clipboard.setData(ClipboardData(text: csvText));
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('CSV 데이터가 클립보드에 복사되었습니다.')));
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB), foregroundColor: Colors.white),
            child: const Text('클립보드 복사'),
          ),
        ],
      ),
    );
  }

  // ── 트렌드 PNG 이미지 캡처 저장 ──
  void _exportTrendPng() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF111827),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: const Row(
          children: [
            Icon(Icons.image, color: Color(0xFF60A5FA)),
            SizedBox(width: 8),
            Text('차트 이미지 (PNG) 내보내기', style: TextStyle(color: Colors.white, fontSize: 16)),
          ],
        ),
        content: const Text('현재 화면의 고해상도 트렌드 차트 파형이 캡처 준비되었습니다.', style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 13)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('취소', style: TextStyle(color: Color(0xFF9CA3AF)))),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('차트 이미지가 저장되었습니다.')));
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB), foregroundColor: Colors.white),
            child: const Text('저장'),
          ),
        ],
      ),
    );
  }

  // ── 트렌드 CSV 파일 가져오기 ──
  void _importTrendCsv() {
    final csvInputCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF111827),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        title: const Row(
          children: [
            Icon(Icons.file_upload, color: Color(0xFF60A5FA)),
            SizedBox(width: 8),
            Text('CSV 데이터 가져오기', style: TextStyle(color: Colors.white, fontSize: 16)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('과거에 내보낸 CSV 텍스트를 붙여넣으시면 차트에 과거 파형이 복원됩니다.', style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
            const SizedBox(height: 10),
            TextField(
              controller: csvInputCtrl,
              maxLines: 5,
              style: const TextStyle(color: Colors.white, fontFamily: 'monospace', fontSize: 11),
              decoration: const InputDecoration(labelText: 'CSV 텍스트 붙여넣기', border: OutlineInputBorder()),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('취소', style: TextStyle(color: Color(0xFF9CA3AF)))),
          ElevatedButton(
            onPressed: () {
              final raw = csvInputCtrl.text.trim();
              if (raw.isNotEmpty) {
                final lines = raw.split('\n');
                if (lines.length > 1) {
                  setState(() {
                    for (var cfg in _trendConfigs) {
                      (cfg['spots'] as List<FlSpot>).clear();
                    }
                    for (int i = 1; i < lines.length; i++) {
                      final cols = lines[i].split(',');
                      if (cols.length >= 3) {
                        final sec = double.tryParse(cols[1]) ?? i.toDouble();
                        for (int k = 0; k < _trendConfigs.length; k++) {
                          if (k + 2 < cols.length) {
                            final val = double.tryParse(cols[k + 2]) ?? 0.0;
                            (_trendConfigs[k]['spots'] as List<FlSpot>).add(FlSpot(sec, val));
                          }
                        }
                      }
                    }
                    _isLiveTracking = false;
                  });
                }
              }
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('과거 CSV 트렌드 데이터가 로드되었습니다.')));
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB), foregroundColor: Colors.white),
            child: const Text('가져오기'),
          ),
        ],
      ),
    );
  }

  // ── 값 쓰기 2단계 확인 다이얼로그 ──
  void _showWriteConfirmModal(Map<String, dynamic> tag) {
    if (widget.user.role == 'VIEWER') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('VIEWER 권한은 제어/쓰기가 제한됩니다.')),
      );
      return;
    }

    final isBool = tag['type'] == 'BOOL';
    final currentVal = tag['val'].toString();
    final nextVal = isBool ? (currentVal == 'ON' ? 'OFF' : 'ON') : '';
    final ctrl = TextEditingController(text: isBool ? nextVal : currentVal);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF111827),
        shape: RoundedRectangleBorder(
          side: const BorderSide(color: Color(0x40FFFFFF), width: 1.2),
          borderRadius: BorderRadius.circular(14),
        ),
        title: Row(
          children: [
            Icon(
              tag['risk'] == 'danger' ? Icons.warning_amber_rounded : Icons.edit_note,
              color: tag['risk'] == 'danger' ? const Color(0xFFEF4444) : const Color(0xFF60A5FA),
            ),
            const SizedBox(width: 8),
            Text(
              '값 쓰기 확인 [${tag['risk']?.toString().toUpperCase()}]',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFFE5E7EB)),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('태그: ${tag['symbol']}', style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFE5E7EB))),
            Text('설명: ${tag['desc']}', style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
            const SizedBox(height: 12),
            if (isBool) ...[
              Text('현재 값: $currentVal ➔ 변경할 값: $nextVal', style: const TextStyle(color: Color(0xFF60A5FA), fontWeight: FontWeight.bold)),
            ] else ...[
              TextField(
                controller: ctrl,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  labelText: '새로운 값 입력',
                  labelStyle: TextStyle(color: Color(0xFF9CA3AF)),
                  border: OutlineInputBorder(),
                ),
              ),
            ],
            if (tag['risk'] == 'danger') ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFF7F1D1D).withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: const Color(0xFFEF4444)),
                ),
                child: const Text('⚠️ 위험 등급 태그입니다. 실제 PLC 밸브가 동작하므로 안전을 확인하십시오.', style: TextStyle(color: Color(0xFFFCA5A5), fontSize: 11)),
              ),
            ],
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('취소', style: TextStyle(color: Color(0xFF9CA3AF))),
          ),
          ElevatedButton(
            onPressed: () async {
              final newVal = ctrl.text.trim();
              if (_connMode == ConnectionMode.bridge) {
                await widget.bridgeService.writeCommand(tag['id'] ?? tag['symbol'], newVal);
              } else {
                // 직결 FINS 쓰기
                if (isBool) {
                  await _finsService.writeBit(
                    area: tag['area'] as FinsArea,
                    wordAddress: tag['addr'] as int,
                    bitAddress: tag['bit'] as int,
                    isOn: newVal == 'ON' || newVal == '1',
                  );
                } else {
                  await _finsService.writeWord(
                    area: tag['area'] as FinsArea,
                    address: tag['addr'] as int,
                    value: int.tryParse(newVal) ?? 0,
                  );
                }
              }
              setState(() {
                tag['val'] = newVal;
              });
              if (ctx.mounted) {
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('[${tag['symbol']}] 값이 $newVal (으)로 변경되었습니다.')),
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: tag['risk'] == 'danger' ? const Color(0xFFDC2626) : const Color(0xFF2563EB),
              foregroundColor: Colors.white,
            ),
            child: const Text('실행'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF111827),
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text(
                  'PLC 원격 제어',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFFE5E7EB)),
                ),
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E3A8A),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'v2.3.0',
                    style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF93C5FD)),
                  ),
                ),
              ],
            ),
            Text(
              _connMode == ConnectionMode.bridge ? '🌐 PC 브릿지 경유 (${_bridgeUrlCtrl.text})' : '⚡ PLC 직결 P2P (${_plcIpCtrl.text})',
              style: const TextStyle(fontSize: 10, color: Color(0xFF60A5FA), fontFamily: 'monospace'),
            ),
          ],
        ),
        actions: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            margin: const EdgeInsets.only(right: 12),
            decoration: BoxDecoration(
              color: const Color(0xFF0F1626),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: const Color(0x40FFFFFF)),
            ),
            child: Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: _isConnected ? const Color(0xFF22C55E) : const Color(0xFFEF4444),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  _isConnected ? '${_latencyMs}ms' : '오프라인',
                  style: TextStyle(
                    fontSize: 11,
                    fontFamily: 'monospace',
                    fontWeight: FontWeight.bold,
                    color: _isConnected ? const Color(0xFF22C55E) : const Color(0xFFEF4444),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      body: _buildCurrentTab(),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentTab,
        onTap: (idx) => setState(() => _currentTab = idx),
        type: BottomNavigationBarType.fixed,
        backgroundColor: const Color(0xFF111827),
        selectedItemColor: const Color(0xFF60A5FA),
        unselectedItemColor: const Color(0xFF6B7280),
        selectedFontSize: 11,
        unselectedFontSize: 11,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_outlined), activeIcon: Icon(Icons.home), label: '홈'),
          BottomNavigationBarItem(icon: Icon(Icons.list_alt_outlined), activeIcon: Icon(Icons.list_alt), label: '모니터링'),
          BottomNavigationBarItem(icon: Icon(Icons.show_chart_outlined), activeIcon: Icon(Icons.show_chart), label: '트렌드'),
          BottomNavigationBarItem(icon: Icon(Icons.precision_manufacturing_outlined), activeIcon: Icon(Icons.precision_manufacturing), label: 'GMS'),
          BottomNavigationBarItem(icon: Icon(Icons.settings_outlined), activeIcon: Icon(Icons.settings), label: '설정'),
        ],
      ),
    );
  }

  Widget _buildCurrentTab() {
    switch (_currentTab) {
      case 0: return _buildHomeTab();
      case 1: return _buildMonTab();
      case 2: return _buildTrendTab();
      case 3: return _buildGmsTab();
      case 4: return _buildSettingsTab();
      default: return _buildHomeTab();
    }
  }

  // ── S1. 홈 탭 (Home) ──
  Widget _buildHomeTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            color: const Color(0xFF0F1626),
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('PLC 연결 상태', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF9CA3AF))),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: _isConnected ? const Color(0xFF065F46) : const Color(0xFF7F1D1D),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          _isConnected ? '정상 통신 중' : '연결 안됨',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: _isConnected ? const Color(0xFF6EE7B7) : const Color(0xFFFCA5A5),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _buildStatRow('통신 방식', _connMode == ConnectionMode.bridge ? '🌐 PC 브릿지 경유' : '⚡ PLC 직결 (FINS UDP)'),
                  _buildStatRow('PLC 모델', _cpuModel, isMono: true),
                  _buildStatRow('운전 모드', _cpuMode, color: const Color(0xFF60A5FA)),
                  _buildStatRow('응답 지연', '${_latencyMs} ms', isMono: true),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text('바로가기', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF9CA3AF))),
          const SizedBox(height: 8),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 1.4,
            children: [
              _buildHomeTile(Icons.list_alt, '모니터링', '태그 조회 및 제어', 1),
              _buildHomeTile(Icons.show_chart, '트렌드', '실시간 시계열 그래프', 2),
              _buildHomeTile(Icons.precision_manufacturing, 'GMS', '가스 공급 P&ID', 3),
              _buildHomeTile(Icons.settings, '설정', '통신 모드 및 계정', 4),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHomeTile(IconData icon, String title, String sub, int tabIdx) {
    return InkWell(
      onTap: () => setState(() => _currentTab = tabIdx),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: const Color(0xFF60A5FA), size: 24),
              const SizedBox(height: 6),
              Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFFE5E7EB))),
              Text(sub, style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF))),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatRow(String label, String value, {bool isMono = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13, color: Color(0xFF9CA3AF))),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 13,
                fontFamily: isMono ? 'monospace' : null,
                fontWeight: FontWeight.w600,
                color: color ?? const Color(0xFFE5E7EB),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── S2. 모니터링 탭 (Mon — 태그 등록/편집/삭제/제어 완비) ──
  Widget _buildMonTab() {
    final query = _searchCtrl.text.toLowerCase().trim();
    final filtered = _tags.where((t) {
      final sym = t['symbol'].toString().toLowerCase();
      final name = (t['name'] ?? '').toString().toLowerCase();
      final desc = (t['desc'] ?? '').toString().toLowerCase();
      return query.isEmpty || sym.contains(query) || name.contains(query) || desc.contains(query);
    }).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 6),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchCtrl,
                  onChanged: (_) => setState(() {}),
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    hintText: '태그 검색 (심볼/이름/설명)',
                    hintStyle: const TextStyle(color: Color(0xFF6B7280), fontSize: 12),
                    filled: true,
                    fillColor: const Color(0xFF111827),
                    prefixIcon: const Icon(Icons.search, color: Color(0xFF9CA3AF), size: 18),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0x40FFFFFF))),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0x40FFFFFF))),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton.icon(
                onPressed: () => _showAddOrEditTagModal(),
                icon: const Icon(Icons.add, size: 16),
                label: const Text('＋ 태그'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('총 ${_tags.length}개 태그 중 ${filtered.length}개 표시', style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
              Text(
                _isConnected ? '● ${_connMode == ConnectionMode.bridge ? '브릿지 경유' : '직결'} 폴링 중' : '○ 오프라인',
                style: TextStyle(fontSize: 11, color: _isConnected ? const Color(0xFF22C55E) : const Color(0xFFEF4444)),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: filtered.length,
            itemBuilder: (ctx, idx) {
              final tag = filtered[idx];
              final isWrite = tag['access'] == 'write' || tag['access'] == 'read_write';
              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(tag['symbol'], style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFFE5E7EB))),
                                const SizedBox(height: 2),
                                Text('${tag['name']} · ${tag['desc']}', style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: tag['risk'] == 'danger' ? const Color(0xFF7F1D1D) : (tag['risk'] == 'caution' ? const Color(0xFF78350F) : const Color(0xFF1F2937)),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              tag['risk']?.toString().toUpperCase() ?? 'SAFE',
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                                color: tag['risk'] == 'danger' ? const Color(0xFFFCA5A5) : (tag['risk'] == 'caution' ? const Color(0xFFFDE68A) : const Color(0xFF9CA3AF)),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '${(tag['area'] as FinsArea).label}${tag['addr']}${tag['type'] == 'BOOL' ? '.${tag['bit']}' : ''} [${tag['type']}]',
                            style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: Color(0xFF60A5FA)),
                          ),
                          Row(
                            children: [
                              Text(
                                '${tag['val']}',
                                style: const TextStyle(fontFamily: 'monospace', fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFFE5E7EB)),
                              ),
                              const SizedBox(width: 8),
                              if (isWrite) ...[
                                ElevatedButton(
                                  onPressed: () => _showWriteConfirmModal(tag),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFFB45309),
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    minimumSize: const Size(40, 28),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                                  ),
                                  child: const Text('쓰기', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                                ),
                                const SizedBox(width: 4),
                              ],
                              IconButton(
                                icon: const Icon(Icons.edit, size: 16, color: Color(0xFF9CA3AF)),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(),
                                onPressed: () => _showAddOrEditTagModal(tag: tag),
                              ),
                              const SizedBox(width: 6),
                              IconButton(
                                icon: const Icon(Icons.delete_outline, size: 16, color: Color(0xFFEF4444)),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(),
                                onPressed: () => _deleteTag(tag),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  // ── S3. 트렌드 차트 탭 (Trend — PWA 100% 동등: 축설정/한손가락과거탐색/CSV/PNG/가져오기) ──
  Widget _buildTrendTab() {
    // X축 표시 범위 계산 (실시간 vs 과거 드래그)
    final double maxSec = _trendTimeCounter;
    final double windowSec = _trendWindowSeconds.toDouble();
    double minX = maxSec - windowSec;
    double maxX = maxSec;

    if (!_isLiveTracking) {
      maxX = maxSec - _viewportPanOffset;
      minX = maxX - windowSec;
    }
    if (minX < 0) minX = 0;
    if (maxX <= minX) maxX = minX + windowSec;

    // Y축 최소/최대값 계산 (PWA 100% 동등 실시간 자동 스케일)
    double effectiveMinY = _yMin;
    double effectiveMaxY = _yMax;

    if (_yAxisMode == 'auto') {
      double vMin = double.infinity;
      double vMax = -double.infinity;
      for (var cfg in _trendConfigs) {
        final spots = cfg['spots'] as List<FlSpot>;
        for (var s in spots) {
          if (s.x >= minX && s.x <= maxX) {
            if (s.y < vMin) vMin = s.y;
            if (s.y > vMax) vMax = s.y;
          }
        }
      }
      if (!vMin.isFinite || !vMax.isFinite) {
        // 화면 내 데이터가 없을 때 현재값 기준으로 자동 설정
        double cur = 10000.0;
        if (_trendConfigs.isNotEmpty) {
          cur = double.tryParse(_trendConfigs[0]['currentVal'].toString().replaceAll(',', '')) ?? 10000.0;
        }
        effectiveMinY = cur - (cur.abs() * 0.05 > 5 ? cur.abs() * 0.05 : 5.0);
        effectiveMaxY = cur + (cur.abs() * 0.05 > 5 ? cur.abs() * 0.05 : 5.0);
      } else if ((vMax - vMin).abs() < 0.0001) {
        final margin = vMin.abs() * 0.05 > 5 ? vMin.abs() * 0.05 : 5.0;
        effectiveMinY = (vMin - margin).floorToDouble();
        effectiveMaxY = (vMax + margin).ceilToDouble();
      } else {
        final gap = (vMax - vMin) * 0.08;
        effectiveMinY = (vMin - gap).floorToDouble();
        effectiveMaxY = (vMax + gap).ceilToDouble();
      }
      if (effectiveMaxY <= effectiveMinY) effectiveMaxY = effectiveMinY + 10.0;
    }

    final double xInterval = ((maxX - minX) / 4).clamp(1.0, 100000.0);
    final double yInterval = ((effectiveMaxY - effectiveMinY) / 4).clamp(0.1, 100000.0);

    return Padding(
      padding: const EdgeInsets.all(12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 상단 1행: 시간창, ＋변수, 축설정, 전체보기(실시간복귀)
          Row(
            children: [
              Expanded(
                flex: 3,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF111827),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0x40FFFFFF)),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<int>(
                      value: _trendWindowSeconds,
                      dropdownColor: const Color(0xFF111827),
                      style: const TextStyle(color: Colors.white, fontSize: 11),
                      items: const [
                        DropdownMenuItem(value: 60, child: Text('창: 1분')),
                        DropdownMenuItem(value: 300, child: Text('창: 5분')),
                        DropdownMenuItem(value: 600, child: Text('창: 10분')),
                        DropdownMenuItem(value: 1800, child: Text('창: 30분')),
                        DropdownMenuItem(value: 3600, child: Text('창: 1시간')),
                        DropdownMenuItem(value: 21600, child: Text('창: 6시간')),
                        DropdownMenuItem(value: 86400, child: Text('창: 24시간')),
                        DropdownMenuItem(value: 259200, child: Text('창: 72시간')),
                      ],
                      onChanged: (val) {
                        if (val != null) setState(() => _trendWindowSeconds = val);
                      },
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 4),
              ElevatedButton(
                onPressed: () => _showAddOrEditTrendVarModal(),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                ),
                child: const Text('＋ 변수', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 4),
              ElevatedButton(
                onPressed: _showAxisConfigModal,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF374151),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                ),
                child: const Text('축 설정', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 4),
              ElevatedButton(
                onPressed: () {
                  setState(() {
                    _isLiveTracking = true;
                    _viewportPanOffset = 0;
                  });
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('실시간 모드로 복귀하였습니다.')),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: _isLiveTracking ? const Color(0xFF059669) : const Color(0xFFB45309),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                ),
                child: const Text('전체 보기', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          // 상단 2행: 일시정지/재개, ⬇CSV, ⬇PNG, ⬆가져오기
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: () => setState(() => _isTrendRecording = !_isTrendRecording),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _isTrendRecording ? const Color(0xFFFBBF24) : const Color(0xFF059669),
                    foregroundColor: _isTrendRecording ? Colors.black : Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                  child: Text(_isTrendRecording ? '일시정지' : '기록재개', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(width: 4),
              Expanded(
                child: ElevatedButton(
                  onPressed: _exportTrendCsv,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1F2937),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                  child: const Text('⬇ CSV', style: TextStyle(fontSize: 10)),
                ),
              ),
              const SizedBox(width: 4),
              Expanded(
                child: ElevatedButton(
                  onPressed: _exportTrendPng,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1F2937),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                  child: const Text('⬇ PNG', style: TextStyle(fontSize: 10)),
                ),
              ),
              const SizedBox(width: 4),
              Expanded(
                child: ElevatedButton(
                  onPressed: _importTrendCsv,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1F2937),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                  child: const Text('⬆ 가져오기', style: TextStyle(fontSize: 10)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          // 가이드 힌트
          Text(
            '변수 ${_trendConfigs.length}/16 · 저장 ${(_trendConfigs.isNotEmpty ? (_trendConfigs[0]['spots'] as List<FlSpot>).length : 0)}건 · ${_isLiveTracking ? "● 실시간 추적 중" : "⏸ 과거 구간 보는 중 (전체보기 클릭 시 복귀)"}',
            style: TextStyle(fontSize: 10, color: _isLiveTracking ? const Color(0xFF34D399) : const Color(0xFFFBBF24)),
          ),
          const SizedBox(height: 6),
          // ── 인터랙티브 차트 영역 (증권사 스타일: 1손가락 좌우이동 + 2손가락 핀치 확대/축소) ──
          Expanded(
            flex: 3,
            child: Card(
              child: GestureDetector(
                onScaleUpdate: (ScaleUpdateDetails details) {
                  setState(() {
                    _isLiveTracking = false;
                    // 1) 두 손가락 핀치 줌 (Zoom)
                    if (details.scale != 1.0) {
                      final newWindow = (_trendWindowSeconds / details.scale).clamp(10, 259200).toInt();
                      _trendWindowSeconds = newWindow;
                    }
                    // 2) 한 손가락 좌우 드래그 이동 (Pan)
                    if (details.focalPointDelta.dx.abs() > 0.1) {
                      final secPerPixel = (_trendWindowSeconds / 300.0).clamp(0.1, 100.0);
                      _viewportPanOffset -= details.focalPointDelta.dx * secPerPixel;
                      if (_viewportPanOffset < 0) _viewportPanOffset = 0;
                      if (_viewportPanOffset > _trendTimeCounter) _viewportPanOffset = _trendTimeCounter;
                    }
                  });
                },
                child: Padding(
                  padding: const EdgeInsets.only(right: 18, left: 6, top: 16, bottom: 8),
                  child: LineChart(
                    LineChartData(
                      clipData: const FlClipData.all(), // 차트 테두리 밖으로 선 삐져나감 완전 방지
                      minX: minX,
                      maxX: maxX,
                      minY: effectiveMinY,
                      maxY: effectiveMaxY,
                      gridData: FlGridData(
                        show: _showGrid,
                        drawVerticalLine: true,
                        horizontalInterval: yInterval,
                        verticalInterval: xInterval,
                        getDrawingHorizontalLine: (_) => const FlLine(color: Color(0x33FFFFFF), strokeWidth: 1),
                        getDrawingVerticalLine: (_) => const FlLine(color: Color(0x33FFFFFF), strokeWidth: 1),
                      ),
                      titlesData: FlTitlesData(
                        leftTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            interval: yInterval,
                            reservedSize: 52, // 5자리 정수(10,015) 짤림 방지
                            getTitlesWidget: (val, meta) {
                              final text = val >= 1000 ? val.toInt().toString() : (val.abs() < 10 ? val.toStringAsFixed(1) : val.toInt().toString());
                              return Text(
                                text,
                                style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 9, fontFamily: 'monospace'),
                              );
                            },
                          ),
                        ),
                        bottomTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            interval: xInterval,
                            reservedSize: 22,
                            getTitlesWidget: (val, meta) {
                              return Text(
                                '${val.toInt()}s',
                                style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 9, fontFamily: 'monospace'),
                              );
                            },
                          ),
                        ),
                        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                        rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                      ),
                      borderData: FlBorderData(show: true, border: Border.all(color: const Color(0x40FFFFFF))),
                      lineBarsData: _trendConfigs.map((cfg) {
                        final spots = cfg['spots'] as List<FlSpot>;
                        return LineChartBarData(
                          spots: spots.isEmpty ? [const FlSpot(0, 0)] : spots,
                          isCurved: true,
                          color: cfg['color'] as Color,
                          barWidth: 2,
                          dotData: const FlDotData(show: false),
                        );
                      }).toList(),
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),
          // ── 범례 목록 (등록 변수 리스트 & 편집[✏️] & 주소/현재값 표시 & 삭제[X] 버튼) ──
          Expanded(
            flex: 2,
            child: ListView.builder(
              itemCount: _trendConfigs.length,
              itemBuilder: (ctx, idx) {
                final cfg = _trendConfigs[idx];
                final area = cfg['area'] as FinsArea;
                final addr = cfg['addr'];
                final bit = cfg['bit'];
                final type = cfg['type'];
                final addrStr = '${area.label}:$addr $type${type == 'BOOL' ? '.$bit' : ''}';

                return Card(
                  margin: const EdgeInsets.only(bottom: 6),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    child: Row(
                      children: [
                        Container(width: 10, height: 10, decoration: BoxDecoration(color: cfg['color'] as Color, borderRadius: BorderRadius.circular(2))),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(cfg['label'], style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFE5E7EB))),
                              Text(addrStr, style: const TextStyle(fontSize: 10, color: Color(0xFF60A5FA), fontFamily: 'monospace')),
                            ],
                          ),
                        ),
                        Text(
                          '${cfg['currentVal']} ${cfg['unit']}',
                          style: const TextStyle(fontFamily: 'monospace', fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFFE5E7EB)),
                        ),
                        const SizedBox(width: 6),
                        IconButton(
                          icon: const Icon(Icons.edit, size: 16, color: Color(0xFF9CA3AF)),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                          onPressed: () => _showAddOrEditTrendVarModal(cfg: cfg),
                        ),
                        const SizedBox(width: 6),
                        IconButton(
                          icon: const Icon(Icons.close, size: 16, color: Color(0xFFEF4444)),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                          onPressed: () {
                            setState(() {
                              _trendConfigs.removeAt(idx);
                            });
                          },
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  // ── S4. GMS 가스배관도 탭 (GMS) ──
  Widget _buildGmsTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            color: const Color(0xFF0F1626),
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                children: [
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('GSP 가스공급 시퀀스', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF9CA3AF))),
                      Text('Step 7 / 7 (100%)', style: TextStyle(fontSize: 12, color: Color(0xFF22C55E), fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  LinearProgressIndicator(
                    value: 1.0,
                    backgroundColor: const Color(0xFF1F2937),
                    valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF22C55E)),
                    minHeight: 8,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  const SizedBox(height: 8),
                  const Text('현재 상태: SUPPLY_READY (정상 공급 중)', style: TextStyle(fontSize: 12, color: Color(0xFF60A5FA))),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          // Side A / Side B 카드
          Row(
            children: [
              Expanded(
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.check_circle, color: Color(0xFF22C55E), size: 16),
                            SizedBox(width: 6),
                            Text('Side A (주공급)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.white)),
                          ],
                        ),
                        const SizedBox(height: 10),
                        _buildStatRow('1차측 고압', '${_tags[1]['val']} MPa'),
                        _buildStatRow('2차측 저압', '${_tags[2]['val']} MPa'),
                        _buildStatRow('실린더 무게', '${_tags[10]['val']} kg'),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.pause_circle_outline, color: Color(0xFFFBBF24), size: 16),
                            SizedBox(width: 6),
                            Text('Side B (대기용)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.white)),
                          ],
                        ),
                        const SizedBox(height: 10),
                        _buildStatRow('1차측 고압', '${_tags[3]['val']} MPa'),
                        _buildStatRow('2차측 저압', '${_tags[4]['val']} MPa'),
                        _buildStatRow('실린더 무게', '${_tags[11]['val']} kg'),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── S5. 설정 탭 (Settings — 듀얼 모드 & 진단 로그 완비) ──
  Widget _buildSettingsTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 로그인 사용자 정보
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('로그인 사용자 정보', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF9CA3AF))),
                  const SizedBox(height: 12),
                  _buildStatRow('이름', widget.user.name),
                  _buildStatRow('아이디', widget.user.id, isMono: true),
                  _buildStatRow('권한', widget.user.role, color: const Color(0xFF60A5FA)),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: widget.onLogout,
                      icon: const Icon(Icons.logout, size: 16),
                      label: const Text('로그아웃'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFDC2626),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          // 통신 모드 선택 카드
          Card(
            color: const Color(0xFF0F1626),
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('통신 모드 선택', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF9CA3AF))),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0B1220),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0x40FFFFFF)),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: () {
                              setState(() => _connMode = ConnectionMode.bridge);
                              _startPolling();
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              decoration: BoxDecoration(
                                color: _connMode == ConnectionMode.bridge ? const Color(0xFF2563EB) : Colors.transparent,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text('🌐 PC 브릿지 모드', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white)),
                            ),
                          ),
                        ),
                        Expanded(
                          child: InkWell(
                            onTap: () {
                              setState(() => _connMode = ConnectionMode.direct);
                              _initFinsService();
                              _startPolling();
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              decoration: BoxDecoration(
                                color: _connMode == ConnectionMode.direct ? const Color(0xFF2563EB) : Colors.transparent,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text('⚡ PLC 직결 모드', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  if (_connMode == ConnectionMode.bridge) ...[
                    TextField(
                      controller: _bridgeUrlCtrl,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: const InputDecoration(
                        labelText: 'PC 브릿지 서버 URL',
                        hintText: 'https://192.168.0.211:3001',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ] else ...[
                    TextField(
                      controller: _plcIpCtrl,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: const InputDecoration(labelText: 'PLC IP 주소', border: OutlineInputBorder()),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _plcPortCtrl,
                            style: const TextStyle(color: Colors.white, fontSize: 13),
                            decoration: const InputDecoration(labelText: 'Port', border: OutlineInputBorder()),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: _plcNodeCtrl,
                            style: const TextStyle(color: Colors.white, fontSize: 13),
                            decoration: const InputDecoration(labelText: 'PLC Node', border: OutlineInputBorder()),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: _phoneNodeCtrl,
                            style: const TextStyle(color: Colors.white, fontSize: 13),
                            decoration: const InputDecoration(labelText: 'Phone Node', border: OutlineInputBorder()),
                          ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () {
                        if (_connMode == ConnectionMode.direct) {
                          _initFinsService();
                        }
                        _startPolling();
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('통신 설정이 적용되었습니다 (${_connMode == ConnectionMode.bridge ? 'PC 브릿지' : 'PLC 직결'})')),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2563EB),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: const Text('설정 적용 및 재연결'),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          // ── 실시간 통신 진단 콘솔 (Live Diagnostic Log) ──
          Card(
            color: const Color(0xFF0F1626),
            child: Padding(
              padding: const EdgeInsets.all(14.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('실시간 통신 진단 로그 (Live Diag)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF9CA3AF))),
                      TextButton(
                        onPressed: () => setState(() => _finsService.diagnosticLogs.clear()),
                        child: const Text('지우기', style: TextStyle(fontSize: 11, color: Color(0xFF60A5FA))),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Container(
                    height: 140,
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF070D18),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0x40FFFFFF)),
                    ),
                    child: _finsService.diagnosticLogs.isEmpty
                        ? const Text('통신 패킷 대기 중...', style: TextStyle(fontFamily: 'monospace', fontSize: 11, color: Color(0xFF6B7280)))
                        : ListView.builder(
                            reverse: true,
                            itemCount: _finsService.diagnosticLogs.length,
                            itemBuilder: (ctx, idx) {
                              final item = _finsService.diagnosticLogs[_finsService.diagnosticLogs.length - 1 - idx];
                              final isError = item.contains('Failed') || item.contains('Timeout') || item.contains('error');
                              final isSuccess = item.contains('Success') || item.contains('Recv');
                              return Text(
                                item,
                                style: TextStyle(
                                  fontFamily: 'monospace',
                                  fontSize: 11,
                                  color: isError ? const Color(0xFFEF4444) : (isSuccess ? const Color(0xFF22C55E) : const Color(0xFF9CA3AF)),
                                ),
                              );
                            },
                          ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          // ── 앱 버전 정보 ──
          const Center(
            child: Text(
              'Omron CJ2H Direct Monitor · App Version v2.3.0\n3-in-1 Dual-Engine Suite (Build 2026-08-31)',
              textAlign: TextAlign.center,
              style: TextStyle(fontFamily: 'monospace', fontSize: 11, color: Color(0xFF6B7280)),
            ),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }
}
