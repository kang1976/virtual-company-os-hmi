import 'dart:async';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart' as p;

/// 모바일 단독 실행 시 1달(30일) 데이터 롤링 보존을 담당하는 로컬 SQLite 스토리지
class LocalStorageService {
  static final LocalStorageService instance = LocalStorageService._internal();
  LocalStorageService._internal();

  Database? _db;

  Future<Database> get database async {
    if (_db != null) return _db!;
    _db = await _initDatabase();
    return _db!;
  }

  Future<Database> _initDatabase() async {
    final databasesPath = await getDatabasesPath();
    final path = p.join(databasesPath, 'plc_mobile_30d.db');

    final db = await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        // 1. 트렌드 데이터 이력 (태그 수치, 시각)
        await db.execute('''
          CREATE TABLE IF NOT EXISTS trend_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            address TEXT NOT NULL,
            numeric_val REAL,
            text_val TEXT,
            timestamp INTEGER NOT NULL
          )
        ''');
        await db.execute('CREATE INDEX IF NOT EXISTS idx_trend_sym_time ON trend_records (symbol, timestamp)');

        // 2. 알람 및 이벤트 이력
        await db.execute('''
          CREATE TABLE IF NOT EXISTS alarm_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alarm_code TEXT,
            message TEXT NOT NULL,
            severity TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            cleared_at INTEGER
          )
        ''');

        // 3. 조작 및 제어 감사 로그
        await db.execute('''
          CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            action TEXT NOT NULL,
            details TEXT,
            timestamp INTEGER NOT NULL
          )
        ''');
      },
    );

    // 초기 구동 시 30일 이전의 오래된 데이터 즉각 정리
    await _autoPrune30Days(db);
    return db;
  }

  /// 정확히 30일(1달)을 초과한 데이터를 자동 정리 (롤링 보존)
  Future<int> _autoPrune30Days(Database db) async {
    final thirtyDaysAgoMs = DateTime.now().subtract(const Duration(days: 30)).millisecondsSinceEpoch;
    final deletedTrends = await db.delete('trend_records', where: 'timestamp < ?', whereArgs: [thirtyDaysAgoMs]);
    await db.delete('alarm_records', where: 'created_at < ?', whereArgs: [thirtyDaysAgoMs]);
    await db.delete('audit_logs', where: 'timestamp < ?', whereArgs: [thirtyDaysAgoMs]);
    return deletedTrends;
  }

  /// 트렌드 데이터 1포인트 기록
  Future<void> recordTrendSample({
    required String symbol,
    required String address,
    required dynamic value,
  }) async {
    try {
      final db = await database;
      double? numVal;
      String? textVal;

      if (value is num) {
        numVal = value.toDouble();
      } else if (value != null) {
        final parsed = double.tryParse(value.toString());
        if (parsed != null) {
          numVal = parsed;
        } else {
          textVal = value.toString();
        }
      }

      await db.insert('trend_records', {
        'symbol': symbol,
        'address': address,
        'numeric_val': numVal,
        'text_val': textVal,
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      });
    } catch (_) {}
  }

  /// 지정한 시간 범위(기본 최근 1시간 ~ 최대 30일) 내의 트렌드 이력 조회
  Future<List<Map<String, dynamic>>> queryTrendHistory({
    required String symbol,
    required DateTime from,
    required DateTime to,
    int limit = 2000,
  }) async {
    try {
      final db = await database;
      return await db.query(
        'trend_records',
        where: 'symbol = ? AND timestamp >= ? AND timestamp <= ?',
        whereArgs: [symbol, from.millisecondsSinceEpoch, to.millisecondsSinceEpoch],
        orderBy: 'timestamp ASC',
        limit: limit,
      );
    } catch (_) {
      return [];
    }
  }

  /// 알람 기록 저장
  Future<void> recordAlarm({
    required String message,
    String? code,
    String severity = 'WARN',
  }) async {
    try {
      final db = await database;
      await db.insert('alarm_records', {
        'alarm_code': code,
        'message': message,
        'severity': severity,
        'created_at': DateTime.now().millisecondsSinceEpoch,
      });
    } catch (_) {}
  }

  /// 감사 로그 기록
  Future<void> recordAuditLog({
    required String userId,
    required String action,
    String? details,
  }) async {
    try {
      final db = await database;
      await db.insert('audit_logs', {
        'user_id': userId,
        'action': action,
        'details': details,
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      });
    } catch (_) {}
  }

  /// 주기적 롤링 정리 실행 (1일 1회 호출 권장)
  Future<void> pruneOldData() async {
    try {
      final db = await database;
      await _autoPrune30Days(db);
    } catch (_) {}
  }
}
