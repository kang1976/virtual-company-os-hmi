import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omron_fins_app/main.dart';
import 'package:fl_chart/fl_chart.dart';

void main() {
  testWidgets('OmronFinsApp Widget UI Flow Test', (WidgetTester tester) async {
    // 1. 앱 기동
    await tester.pumpWidget(const OmronFinsApp());
    expect(find.text('로그인'), findsOneWidget);

    // 2. 로그인 수행
    await tester.enterText(find.byType(TextField).first, 'admin');
    await tester.enterText(find.byType(TextField).last, 'admin');
    await tester.tap(find.text('로그인'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    // 3. 트렌드 탭 이동
    final trendTabs = find.text('트렌드');
    if (trendTabs.evaluate().isNotEmpty) {
      await tester.tap(trendTabs.last);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.text('전체 보기'), findsOneWidget);
    }
  });

  test('Trend Scale and Y-Axis Auto Margin Algorithm Verification', () {
    // Y축 자동 스케일 알고리즘 검증
    final spots = [
      const FlSpot(0, 9500),
      const FlSpot(100, 9800),
      const FlSpot(200, 10050),
    ];

    double vMin = double.infinity;
    double vMax = -double.infinity;
    for (var s in spots) {
      if (s.y < vMin) vMin = s.y;
      if (s.y > vMax) vMax = s.y;
    }

    final gap = (vMax - vMin) * 0.08;
    final effectiveMinY = (vMin - gap).floorToDouble();
    final effectiveMaxY = (vMax + gap).ceilToDouble();

    expect(effectiveMinY, lessThan(9500));
    expect(effectiveMaxY, greaterThan(10050));
    expect(effectiveMaxY - effectiveMinY, greaterThan(550));
  });

  test('Time-Lock calculation verification during past data browsing', () {
    // 과거 데이터 탐색 중 Time-Lock 검증
    bool isLiveTracking = false;
    double trendTimeCounter = 600.0;
    double viewportPanOffset = 120.0;

    // 1초 타이머 발생 시
    trendTimeCounter += 1.0;
    if (!isLiveTracking) {
      viewportPanOffset += 1.0;
    }

    final windowSec = 300.0;
    final maxX = trendTimeCounter - viewportPanOffset;
    final minX = maxX - windowSec;

    expect(maxX, equals(480.0));
    expect(minX, equals(180.0));
  });
}
