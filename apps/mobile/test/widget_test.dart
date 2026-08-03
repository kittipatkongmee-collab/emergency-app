import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:police_incident_mobile/core/app_core.dart';
import 'package:police_incident_mobile/features/auth/auth.dart';
import 'package:police_incident_mobile/features/home/operational_home.dart';
import 'package:police_incident_mobile/features/information/information.dart';
import 'package:police_incident_mobile/features/incidents/incidents.dart';

void main() {
  group('ข้อมูลการแจ้งเหตุ', () {
    test('แปลงพิกัดเป็นทศนิยม 7 ตำแหน่ง', () {
      const draft = ReportDraft(
        reporterName: 'สมชาย ใจดี',
        reporterPhone: '0812345678',
        description: 'พบต้นไม้ล้มขวางถนนและรถไม่สามารถผ่านได้',
        latitude: 13.767254,
        longitude: 100.70514,
        address: 'ถนนวิภาวดีรังสิต กรุงเทพมหานคร',
        locationSelected: true,
      );
      expect(draft.toJson()['latitude'], '13.7672540');
      expect(draft.toJson()['longitude'], '100.7051400');
      expect(draft.toJson()['type'], 'AIRCRAFT_ACCIDENT');
      expect(draft.validate(), isEmpty);
    });

    test('แสดงชื่อประเภทภัยพิบัติที่กำหนดทั้งสองประเภท', () {
      expect(incidentTypeLabel('AIRCRAFT_ACCIDENT'), 'อากาศยานประสบภัย');
      expect(incidentTypeLabel('DISASTER_RELIEF'), 'ช่วยเหลือบรรเทาสาธารณภัย');
    });

    testWidgets('หน้าแจ้งเหตุแสดงประเภทที่เลือกแล้ว', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SelectedIncidentTypeCard(type: 'DISASTER_RELIEF'),
          ),
        ),
      );

      expect(find.text('ประเภทการแจ้งเหตุที่เลือก'), findsOneWidget);
      expect(find.text('ช่วยเหลือบรรเทาสาธารณภัย'), findsOneWidget);
      expect(find.text('เลือกแล้ว'), findsOneWidget);
    });

    test('ตรวจพบฟอร์มที่ข้อมูลสำคัญไม่ครบ', () {
      const draft = ReportDraft(
        reporterName: '',
        reporterPhone: '123',
        description: 'สั้น',
        address: '',
      );
      expect(draft.validate(), hasLength(4));
    });

    test('สร้าง incident และ timeline จาก API JSON ได้', () {
      final incident = Incident.fromJson({
        'id': 'incident-id',
        'caseCode': 'INC-2026-000001',
        'reporterName': 'ประชาชนทดสอบ',
        'reporterPhone': '0812345678',
        'type': 'AIRCRAFT_ACCIDENT',
        'description': 'พบอุบัติเหตุบนถนน',
        'latitude': '13.9126000',
        'longitude': '100.6068000',
        'address': 'กรุงเทพมหานคร',
        'status': 'RECEIVED',
        'reportedAt': '2026-07-31T00:00:00.000Z',
        'images': [
          {'imageUrl': '/uploads/incident.jpg'},
        ],
        'statusHistory': [
          {
            'id': 'history-id',
            'toStatus': 'RECEIVED',
            'changedAt': '2026-07-31T00:00:00.000Z',
            'note': 'รับแจ้งแล้ว',
          },
        ],
      }, (value) => 'http://localhost:3000$value');
      expect(incident.caseCode, 'INC-2026-000001');
      expect(incident.images.single, contains('/uploads/incident.jpg'));
      expect(incident.history.single.status, 'RECEIVED');
      expect(incident.history.single.note, 'รับแจ้งแล้ว');
    });

    test('ReportDraftNotifier ล้างข้อมูลหลังส่งสำเร็จได้', () {
      final notifier = ReportDraftNotifier();
      notifier.update(
        const ReportDraft(
          reporterName: 'ประชาชนทดสอบ',
          reporterPhone: '0812345678',
          description: 'รายละเอียดเหตุการณ์ทดสอบ',
        ),
      );
      expect(notifier.state.reporterName, isNotEmpty);
      notifier.clear();
      expect(notifier.state.reporterName, isEmpty);
    });
  });

  group('บัญชีผู้ใช้และการแสดงผล', () {
    test('สร้างข้อมูลประชาชนจาก API JSON ได้', () {
      final profile = CitizenProfile.fromJson({
        'id': 'citizen-id',
        'fullName': 'ประชาชนทดสอบ',
        'email': 'citizen@example.test',
        'phone': '0812345678',
      });
      expect(profile.id, 'citizen-id');
      expect(profile.fullName, 'ประชาชนทดสอบ');
      expect(profile.phone, '0812345678');
    });

    test('ข้อความผิดพลาดทั่วไปเป็นภาษาไทย', () {
      expect(thaiError(Exception('network')), contains('เกิดข้อผิดพลาด'));
    });

    testWidgets('ปุ่มหลักแสดงข้อความไทยและป้องกันกดเมื่อกำลังทำงาน', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            body: GradientButton(
              label: 'แจ้งเหตุเลย',
              busy: true,
              onPressed: () {},
            ),
          ),
        ),
      );
      expect(find.text('กำลังดำเนินการ…'), findsOneWidget);
      final button = tester.widget<FilledButton>(find.byType(FilledButton));
      expect(button.onPressed, isNull);
    });

    testWidgets('ปุ่มหลักเปิดให้กดเมื่อไม่อยู่ในสถานะโหลด', (tester) async {
      var pressed = false;
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            body: GradientButton(
              label: 'แจ้งเหตุเลย',
              onPressed: () => pressed = true,
            ),
          ),
        ),
      );
      await tester.tap(find.byType(FilledButton));
      expect(pressed, isTrue);
    });

    testWidgets('เลือกประเภทเหตุการณ์ก่อนเข้าสู่ฟอร์มแจ้งเหตุ', (tester) async {
      String? selectedType;
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Builder(
            builder: (context) => Scaffold(
              body: FilledButton(
                onPressed: () async {
                  selectedType = await showIncidentTypeDialog(context);
                },
                child: const Text('แจ้งเหตุ'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('แจ้งเหตุ'));
      await tester.pumpAndSettle();
      expect(find.text('เลือกประเภทการแจ้งเหตุ'), findsOneWidget);
      expect(find.text('อากาศยานประสบภัย'), findsOneWidget);
      expect(find.text('ช่วยเหลือบรรเทาสาธารณภัย'), findsOneWidget);
      await tester.tap(find.text('ช่วยเหลือบรรเทาสาธารณภัย'));
      await tester.pumpAndSettle();
      expect(selectedType, 'DISASTER_RELIEF');
    });

    testWidgets('หน้าแรกแสดงชื่อผู้ใช้ ปุ่มแจ้งเหตุ และ empty state', (
      tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            citizenProfileProvider.overrideWith(
              (_) async =>
                  const CitizenProfile(id: 'citizen-id', fullName: 'test1'),
            ),
            unreadCountProvider.overrideWith((_) async => 0),
            incidentsProvider.overrideWith((_) async => []),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            home: OperationalHomeTab(onOpenHistory: () {}),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('สวัสดี test1'), findsOneWidget);
      expect(find.text('หน่วยค้นหาและช่วยเหลือทางอากาศ (SRU)'), findsOneWidget);
      final welcomeMessage = tester.widget<Text>(
        find.text('หากพบเหตุฉุกเฉิน แจ้งเหตุได้ทันที\nเราพร้อมช่วยเหลือคุณ'),
      );
      expect(welcomeMessage.maxLines, 2);
      expect(welcomeMessage.softWrap, isFalse);
      final logoAssets = tester
          .widgetList<Image>(find.byType(Image))
          .map((image) => image.image)
          .whereType<AssetImage>()
          .map((image) => image.assetName);
      expect(
        logoAssets,
        containsAll([
          'assets/images/royal-thai-police-logo.png',
          'assets/images/police-aviation-logo.png',
        ]),
      );
      expect(
        tester
            .widget<Text>(
              find.text('แจ้งเหตุได้รวดเร็ว ติดตามสถานะได้แบบเรียลไทม์'),
            )
            .maxLines,
        1,
      );
      final trackingButtonText = tester.widget<Text>(
        find.descendant(
          of: find.byType(FilledButton),
          matching: find.text('ติดตาม'),
        ),
      );
      expect(trackingButtonText.maxLines, 1);
      expect(trackingButtonText.softWrap, isFalse);
      expect(
        find.text('0 2509 1520\nให้บริการตลอด 24 ชั่วโมง'),
        findsOneWidget,
      );
      expect(find.textContaining('กองบินตำรวจ 0 2509 1520'), findsNothing);
      expect(find.text('แจ้งเหตุใหม่'), findsOneWidget);
      expect(find.text('ยังไม่มีรายการแจ้งเหตุ'), findsOneWidget);
    });
  });

  group('เมนูข้อมูลอากาศยาน', () {
    testWidgets('แสดงการ์ดข้อมูลครบ 3 รายการ', (tester) async {
      await tester.pumpWidget(const MaterialApp(home: InformationTab()));

      expect(
        find.text('เฮลิคอปเตอร์ แบบ Bell429 GlobalRanger'),
        findsOneWidget,
      );
      expect(find.text('เฮลิคอปเตอร์ แบบ Bell 412 EP'), findsOneWidget);
      expect(
        find.text('เฮลิคอปเตอร์ค้นหาและกู้ภัย AS365N3+ Dauphin'),
        findsOneWidget,
      );
      for (final item in aircraftInformationCatalog) {
        expect(
          find.byKey(ValueKey('aircraft-information-${item.id}')),
          findsOneWidget,
        );
      }
      final thumbnailAssets = tester
          .widgetList<Image>(find.byType(Image))
          .map((image) => image.image)
          .whereType<AssetImage>()
          .map((image) => image.assetName);
      expect(
        thumbnailAssets,
        containsAll([
          'assets/images/bell-429-global-ranger.jpg',
          'assets/images/bell-412-ep.jpg',
          'assets/images/as365n3-dauphin.gif',
        ]),
      );
    });

    testWidgets('รายละเอียด Bell429 ปัดดูรูปภาพจริงซ้ายขวาได้', (tester) async {
      await tester.binding.setSurfaceSize(const Size(430, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final bell429 = aircraftInformationById('bell-429-global-ranger')!;
      expect(bell429.galleryAssets, hasLength(5));
      expect(bell429.specificationSections, hasLength(7));
      expect(
        bell429.specificationSections.first.items.first.value,
        '13 ft 3 in',
      );
      expect(bell429.specificationSections.last.items.last.value, 'PW207D1');
      await tester.pumpWidget(
        const MaterialApp(
          home: AircraftInformationDetailScreen(
            aircraftId: 'bell-429-global-ranger',
          ),
        ),
      );

      expect(find.text('รูปภาพ 1 จาก 5'), findsOneWidget);
      expect(find.text('Exterior'), findsOneWidget);
      expect(find.text('Exterior Height'), findsOneWidget);
      expect(find.text('13 ft 3 in'), findsOneWidget);
      await tester.drag(find.byType(PageView), const Offset(-500, 0));
      await tester.pumpAndSettle();
      expect(find.text('รูปภาพ 2 จาก 5'), findsOneWidget);
    });

    testWidgets('รายละเอียด Bell 412 EP ปัดดูรูปภาพจริงซ้ายขวาได้', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(430, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final bell412 = aircraftInformationById('bell-412-ep')!;
      expect(bell412.galleryAssets, hasLength(6));
      expect(bell412.videoAsset, 'assets/videos/aircraft/bell-412/trat.mp4');
      expect(bell412.specificationSections, hasLength(2));
      expect(
        bell412.specificationSections.first.items.first.value,
        'one-two pilots',
      );
      expect(
        bell412.specificationSections.last.items.last.value,
        '0.2663 hp/lb (0.4378 kW/kg)',
      );
      await tester.pumpWidget(
        const MaterialApp(
          home: AircraftInformationDetailScreen(aircraftId: 'bell-412-ep'),
        ),
      );

      expect(find.text('รูปภาพ 1 จาก 6'), findsOneWidget);
      expect(find.text('General characteristics'), findsOneWidget);
      expect(find.text('Crew'), findsOneWidget);
      expect(find.text('one-two pilots'), findsOneWidget);
      await tester.drag(find.byType(PageView), const Offset(-500, 0));
      await tester.pumpAndSettle();
      expect(find.text('รูปภาพ 2 จาก 6'), findsOneWidget);
    });

    testWidgets('รายละเอียด AS365N3+ ปัดดูรูปภาพจริงซ้ายขวาได้', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(430, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final dauphin = aircraftInformationById('as365n3-dauphin')!;
      expect(dauphin.galleryAssets, hasLength(6));
      expect(dauphin.galleryAssets[3], endsWith('.gif'));
      expect(
        dauphin.videoAsset,
        'assets/videos/aircraft/as365n3-dauphin/as.mp4',
      );
      expect(dauphin.specificationSections, hasLength(2));
      expect(
        dauphin.specificationSections.first.items.first.value,
        '1 or 2 pilots',
      );
      expect(
        dauphin.specificationSections.last.items.last.value,
        '8.9 m/s (1,750 ft/min)',
      );
      await tester.pumpWidget(
        const MaterialApp(
          home: AircraftInformationDetailScreen(aircraftId: 'as365n3-dauphin'),
        ),
      );

      expect(find.text('รูปภาพ 1 จาก 6'), findsOneWidget);
      expect(find.text('General characteristics'), findsOneWidget);
      expect(find.text('Capacity'), findsOneWidget);
      expect(find.text('11 passengers'), findsOneWidget);
      await tester.drag(find.byType(PageView), const Offset(-500, 0));
      await tester.pumpAndSettle();
      expect(find.text('รูปภาพ 2 จาก 6'), findsOneWidget);
    });
  });
}
