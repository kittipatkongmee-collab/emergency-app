import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:police_incident_mobile/core/app_core.dart';
import 'package:police_incident_mobile/features/incidents/incidents.dart';

void main() {
  test('report draft serializes precise coordinates', () {
    const draft = ReportDraft(
      reporterName: 'สมชาย ใจดี',
      reporterPhone: '0812345678',
      description: 'พบต้นไม้ล้มขวางถนนและรถไม่สามารถผ่านได้',
      latitude: 13.767254,
      longitude: 100.70514,
    );
    expect(draft.toJson()['latitude'], '13.7672540');
    expect(draft.toJson()['type'], 'ACCIDENT');
  });

  testWidgets('gradient action exposes Thai label', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: GradientButton(label: 'แจ้งเหตุเลย', onPressed: () {}),
        ),
      ),
    );
    expect(find.text('แจ้งเหตุเลย'), findsOneWidget);
    expect(find.byType(FilledButton), findsOneWidget);
  });
}
