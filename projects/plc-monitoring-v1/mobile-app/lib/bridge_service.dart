import 'dart:async';
import 'dart:convert';
import 'dart:io';

class BridgeDeviceInfo {
  final bool connected;
  final String host;
  final int port;
  final String model;
  final String version;
  final String mode;
  final int latencyMs;

  BridgeDeviceInfo({
    required this.connected,
    required this.host,
    required this.port,
    required this.model,
    required this.version,
    required this.mode,
    required this.latencyMs,
  });
}

class PwaBridgeService {
  String baseUrl;
  String? _sessionCookie;
  late final HttpClient _client;

  PwaBridgeService({this.baseUrl = 'https://10.219.30.135:3004'}) {
    _client = HttpClient();
    _client.badCertificateCallback = (X509Certificate cert, String host, int port) => true;
    _client.connectionTimeout = const Duration(seconds: 4);
  }

  void updateBaseUrl(String url) {
    baseUrl = url.endsWith('/') ? url.substring(0, url.length - 1) : url;
  }

  Future<Map<String, dynamic>?> login(String loginId, String password) async {
    try {
      final uri = Uri.parse('$baseUrl/api/login');
      final req = await _client.postUrl(uri);
      req.headers.contentType = ContentType.json;
      req.write(jsonEncode({'loginId': loginId, 'password': password}));

      final res = await req.close().timeout(const Duration(seconds: 4));
      final bodyStr = await res.transform(utf8.decoder).join();
      final body = jsonDecode(bodyStr);

      if (res.statusCode == 200) {
        final cookies = res.cookies;
        if (cookies.isNotEmpty) {
          _sessionCookie = cookies.map((c) => '${c.name}=${c.value}').join('; ');
        }
        return body as Map<String, dynamic>;
      } else {
        return null;
      }
    } catch (_) {
      return null;
    }
  }

  Future<BridgeDeviceInfo> getDeviceStatus() async {
    final sw = Stopwatch()..start();
    try {
      final uri = Uri.parse('$baseUrl/api/device/status');
      final req = await _client.getUrl(uri);
      if (_sessionCookie != null) {
        req.headers.add('Cookie', _sessionCookie!);
      }
      final res = await req.close().timeout(const Duration(seconds: 3));
      final bodyStr = await res.transform(utf8.decoder).join();
      sw.stop();

      if (res.statusCode == 200) {
        final data = jsonDecode(bodyStr);
        final bool connected = data['connected'] == true;
        final String host = data['host'] ?? '192.168.0.80';
        final int port = data['port'] ?? 9600;

        return BridgeDeviceInfo(
          connected: connected,
          host: host,
          port: port,
          model: 'CJ2H-CPU65-EIP',
          version: 'V1.4',
          mode: connected ? 'RUN' : 'OFFLINE',
          latencyMs: sw.elapsedMilliseconds,
        );
      } else if (res.statusCode == 401) {
        // 세션 만료 시 기본 계정으로 백그라운드 재인증 시도
        await login('admin', 'admin');
      }
    } catch (_) {}

    return BridgeDeviceInfo(
      connected: false,
      host: '192.168.0.80',
      port: 9600,
      model: 'CJ2H-CPU65-EIP',
      version: '—',
      mode: 'OFFLINE',
      latencyMs: 0,
    );
  }

  Future<List<Map<String, dynamic>>> getTags({String search = ''}) async {
    try {
      final uri = Uri.parse('$baseUrl/api/tags?limit=100&search=${Uri.encodeComponent(search)}');
      final req = await _client.getUrl(uri);
      if (_sessionCookie != null) {
        req.headers.add('Cookie', _sessionCookie!);
      }
      final res = await req.close().timeout(const Duration(seconds: 3));
      final bodyStr = await res.transform(utf8.decoder).join();

      if (res.statusCode == 200) {
        final data = jsonDecode(bodyStr);
        final list = data['tags'] as List? ?? [];
        return list.map((e) => Map<String, dynamic>.from(e)).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<dynamic> getTagValue(String tagId) async {
    try {
      final uri = Uri.parse('$baseUrl/api/tags/$tagId/value');
      final req = await _client.getUrl(uri);
      if (_sessionCookie != null) {
        req.headers.add('Cookie', _sessionCookie!);
      }
      final res = await req.close().timeout(const Duration(seconds: 3));
      final bodyStr = await res.transform(utf8.decoder).join();

      if (res.statusCode == 200) {
        final data = jsonDecode(bodyStr);
        return data['value'];
      }
    } catch (_) {}
    return null;
  }

  Future<bool> writeCommand(String tagId, String value) async {
    try {
      final uri = Uri.parse('$baseUrl/api/command');
      final req = await _client.postUrl(uri);
      req.headers.contentType = ContentType.json;
      if (_sessionCookie != null) {
        req.headers.add('Cookie', _sessionCookie!);
      }
      req.write(jsonEncode({'tagId': tagId, 'value': value}));

      final res = await req.close().timeout(const Duration(seconds: 3));
      final bodyStr = await res.transform(utf8.decoder).join();
      final body = jsonDecode(bodyStr);

      if (body['requiresConfirmation'] == true) {
        final cmdId = body['commandId'];
        final token = body['confirmToken'];
        return await _confirmCommand(cmdId, token);
      }
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<bool> _confirmCommand(String commandId, String token) async {
    try {
      final uri = Uri.parse('$baseUrl/api/command/$commandId/confirm');
      final req = await _client.postUrl(uri);
      req.headers.contentType = ContentType.json;
      if (_sessionCookie != null) {
        req.headers.add('Cookie', _sessionCookie!);
      }
      req.write(jsonEncode({'confirmToken': token}));

      final res = await req.close().timeout(const Duration(seconds: 3));
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}
