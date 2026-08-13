import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:police_incident_mobile/core/app_core.dart';
import 'package:police_incident_mobile/core/phone_dialer.dart';
import 'package:police_incident_mobile/features/auth/auth.dart';
import 'package:police_incident_mobile/features/home/home.dart';
import 'package:police_incident_mobile/features/home/operational_home.dart';
import 'package:police_incident_mobile/features/information/information.dart';
import 'package:police_incident_mobile/features/incidents/incidents.dart';

class _FakePhoneDialer implements PhoneDialer {
  _FakePhoneDialer({this.result = true});

  final bool result;
  Uri? openedUri;

  @override
  Future<bool> open(Uri phoneUri) async {
    openedUri = phoneUri;
    return result;
  }
}

class _FakeNotificationDataSource implements NotificationDataSource {
  _FakeNotificationDataSource(this.pages);

  final Map<int, NotificationPageData> pages;
  final List<({int page, int limit})> requests = [];

  @override
  Future<NotificationPageData> listPage({
    required int page,
    required int limit,
  }) async {
    requests.add((page: page, limit: limit));
    return pages[page]!;
  }

  @override
  Future<void> read(String id) async {}

  @override
  Future<void> readAll() async {}
}

void main() {
  test('ใช้ฟอนต์ Sarabun เป็นฟอนต์หลักทั้งแอป', () {
    expect(AppTheme.light.textTheme.bodyMedium?.fontFamily, 'Sarabun');
    expect(AppTheme.light.appBarTheme.titleTextStyle?.fontFamily, 'Sarabun');
  });

  testWidgets('ปุ่มโทรเปิดหน้าโทรศัพท์พร้อมหมายเลขโดยไม่แสดง Snackbar', (
    tester,
  ) async {
    final dialer = _FakePhoneDialer();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => FilledButton(
              onPressed: () =>
                  launchPhone(context, '0 2509 1520', dialer: dialer),
              child: const Text('โทร'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('โทร'));
    await tester.pump();

    expect(dialer.openedUri, Uri.parse('tel:025091520'));
    expect(find.byType(SnackBar), findsNothing);
  });

  testWidgets('แจ้งข้อผิดพลาดเมื่อเครื่องเปิดหน้าโทรศัพท์ไม่ได้', (
    tester,
  ) async {
    final dialer = _FakePhoneDialer(result: false);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => FilledButton(
              onPressed: () =>
                  launchPhone(context, '0 2509 1520', dialer: dialer),
              child: const Text('โทร'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('โทร'));
    await tester.pump();

    expect(
      find.text('ไม่สามารถเปิดแอปโทรศัพท์บนเครื่องนี้ได้'),
      findsOneWidget,
    );
  });

  group('ข้อมูลการแจ้งเหตุ', () {
    test('แปลงพิกัดเป็นทศนิยม 7 ตำแหน่ง', () {
      final draft = ReportDraft(
        images: [XFile('assets/images/bell-429-global-ranger.jpg')],
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

    test('ระบุชนิดไฟล์รูปภาพก่อนอัปโหลด', () {
      expect(incidentImageMediaType('evidence.jpg').toString(), 'image/jpeg');
      expect(incidentImageMediaType('evidence.png').toString(), 'image/png');
    });

    test('แสดงชื่อสถานะการแจ้งเหตุเป็นภาษาไทย', () {
      expect(incidentStatusLabel('RECEIVED'), 'รอดำเนินการ');
      expect(incidentStatusLabel('FORWARDED'), 'ส่งต่อเจ้าหน้าที่');
      expect(incidentStatusLabel('INSPECTING'), 'กำลังเข้าตรวจสอบ');
      expect(incidentStatusLabel('IN_PROGRESS'), 'กำลังดำเนินการ');
      expect(incidentStatusLabel('COMPLETED'), 'ภารกิจสำเร็จ');
      expect(incidentStatusLabel('CANCELLED'), 'ยกเลิก');
      expect(incidentStatusLabel('UNKNOWN'), 'ไม่ทราบสถานะ');
    });

    test('แสดงเลขหน้าประวัติครั้งละ 3 หน้าโดยเริ่มจากหน้าปัจจุบัน', () {
      expect(visiblePageNumbers(currentPage: 1, totalPages: 8, windowSize: 3), [
        1,
        2,
        3,
      ]);
      expect(visiblePageNumbers(currentPage: 2, totalPages: 8, windowSize: 3), [
        2,
        3,
        4,
      ]);
      expect(visiblePageNumbers(currentPage: 8, totalPages: 8, windowSize: 3), [
        6,
        7,
        8,
      ]);
    });

    test('หน้าแจ้งเตือนโหลดครั้งละ 9 รายการและต่อท้ายเมื่อโหลดเพิ่ม', () async {
      AppNotification notification(int index) => AppNotification(
        id: 'notification-$index',
        title: 'การแจ้งเตือน $index',
        message: 'รายละเอียด $index',
        createdAt: '2026-08-01T06:00:00.000Z',
        isRead: false,
      );

      final source = _FakeNotificationDataSource({
        1: NotificationPageData(
          items: List.generate(9, (index) => notification(index + 1)),
          page: 1,
          total: 12,
          totalPages: 2,
        ),
        2: NotificationPageData(
          items: List.generate(3, (index) => notification(index + 10)),
          page: 2,
          total: 12,
          totalPages: 2,
        ),
      });
      final container = ProviderContainer(
        overrides: [notificationRepositoryProvider.overrideWithValue(source)],
      );
      final subscription = container.listen(
        notificationsProvider,
        (_, __) {},
        fireImmediately: true,
      );
      addTearDown(() {
        subscription.close();
        container.dispose();
      });

      final firstPage = await container.read(notificationsProvider.future);
      expect(firstPage.items, hasLength(9));
      expect(source.requests, [(page: 1, limit: 9)]);

      await container.read(notificationsProvider.notifier).loadMore();
      final completedFeed = container.read(notificationsProvider).valueOrNull!;
      expect(completedFeed.items, hasLength(12));
      expect(completedFeed.hasMore, isFalse);
      expect(source.requests, [(page: 1, limit: 9), (page: 2, limit: 9)]);

      await container.read(notificationsProvider.notifier).loadMore();
      expect(source.requests, hasLength(2));
    });

    testWidgets('ป้ายสถานะใช้สีไล่เฉดและเงาตามหน้าเว็บ', (tester) async {
      const expectedColors = {
        'RECEIVED': [Color(0xFFFF394B), Color(0xFFDF001C)],
        'IN_PROGRESS': [Color(0xFFFFC928), Color(0xFFF29A00)],
        'COMPLETED': [Color(0xFF2BCF65), Color(0xFF07983D)],
      };

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Column(
              children: [
                IncidentStatusBadge(
                  key: Key('status-received'),
                  status: 'RECEIVED',
                ),
                IncidentStatusBadge(
                  key: Key('status-in-progress'),
                  status: 'IN_PROGRESS',
                ),
                IncidentStatusBadge(
                  key: Key('status-completed'),
                  status: 'COMPLETED',
                ),
              ],
            ),
          ),
        ),
      );

      for (final MapEntry(key: status, value: colors)
          in expectedColors.entries) {
        final badge = find.byKey(
          Key('status-${status.toLowerCase().replaceAll('_', '-')}'),
        );
        final container = tester.widget<Container>(
          find.descendant(of: badge, matching: find.byType(Container)),
        );
        final decoration = container.decoration! as BoxDecoration;
        final gradient = decoration.gradient! as LinearGradient;

        expect(gradient.colors, colors);
        expect(decoration.boxShadow, isNotEmpty);
      }

      for (final label in ['รอดำเนินการ', 'กำลังดำเนินการ', 'ภารกิจสำเร็จ']) {
        final text = tester.widget<Text>(find.text(label));
        expect(text.style?.color, Colors.white);
        expect(text.maxLines, 1);
        expect(text.softWrap, isFalse);
      }
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

    testWidgets('หน้าเลือกตำแหน่งใช้ OpenStreetMap โดยไม่ต้องมี Google key', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(411, 923));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final notifier = ReportDraftNotifier()
        ..update(
          const ReportDraft(
            latitude: 37.4219983,
            longitude: -122.084,
            locationSelected: true,
          ),
        );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [reportDraftProvider.overrideWith((_) => notifier)],
          child: MaterialApp(
            theme: AppTheme.light,
            home: const LocationScreen(),
          ),
        ),
      );
      await tester.pump();

      const originalCoordinates =
          'ละติจูด 37.4219983    |    ลองจิจูด -122.0840000';
      expect(find.text(originalCoordinates), findsOneWidget);
      expect(
        find.byKey(const Key('openstreetmap-location-picker')),
        findsOneWidget,
      );
      final tileLayer = tester.widget<TileLayer>(find.byType(TileLayer));
      expect(tileLayer.urlTemplate, Environment.mapTileUrl);
      expect(find.textContaining('OpenStreetMap contributors'), findsOneWidget);

      final confirmLabel = tester.widget<Text>(find.text('ยืนยันตำแหน่ง'));
      expect(confirmLabel.maxLines, 1);
      expect(confirmLabel.softWrap, isFalse);
    });

    testWidgets('แผนที่ใช้ตำแหน่งจริงของอุปกรณ์เป็นจุดเริ่มต้น', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(411, 923));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final locationAdapter = _FixedDeviceLocationAdapter(
        latitude: 13.7563301,
        longitude: 100.5017652,
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            deviceLocationProvider.overrideWithValue(locationAdapter),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            home: const LocationScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(locationAdapter.requestCount, 1);
      expect(
        find.text('ละติจูด 13.7563301    |    ลองจิจูด 100.5017652'),
        findsOneWidget,
      );
    });

    testWidgets('หน้าแจ้งเหตุแสดงรูปที่เพิ่มเป็นรายการเลื่อนแนวนอน', (
      tester,
    ) async {
      final notifier = ReportDraftNotifier()
        ..update(
          ReportDraft(
            images: [
              XFile('assets/images/bell-429-global-ranger.jpg'),
              XFile('assets/images/bell-412-ep.jpg'),
            ],
          ),
        );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [reportDraftProvider.overrideWith((_) => notifier)],
          child: MaterialApp(theme: AppTheme.light, home: const ReportScreen()),
        ),
      );
      await tester.pump();

      final photoCarousel = tester.widget<ListView>(
        find.byKey(const PageStorageKey('incident-photo-carousel')),
      );
      expect(photoCarousel.scrollDirection, Axis.horizontal);
      expect(find.text('ปัดซ้าย–ขวา'), findsOneWidget);
      expect(find.text('เพิ่มแล้ว 2 จาก 5 รูป'), findsOneWidget);
    });

    test('ตรวจพบฟอร์มที่ข้อมูลสำคัญไม่ครบ', () {
      const draft = ReportDraft(
        reporterName: '',
        reporterPhone: '123',
        description: 'สั้น',
        address: '',
      );
      expect(draft.validate(), hasLength(5));
      expect(draft.validate().first, contains('รูปภาพ'));
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

    testWidgets('หน้าเข้าสู่ระบบจัดหัวข้อสองบรรทัดและข้อมูลติดต่อไว้ล่างสุด', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(411, 923));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(
        const ProviderScope(child: MaterialApp(home: LoginScreen())),
      );
      await tester.pumpAndSettle();

      final heading = tester.widget<Text>(
        find.byKey(const Key('login-unit-heading')),
      );
      expect(heading.data, AppCopy.unitNameMultiline);
      expect(heading.data?.split('\n'), [
        'หน่วยค้นหาและช่วยเหลืออากาศยาน',
        'และเรือที่ประสบภัย กองบินตำรวจ(SRU)',
      ]);
      expect(heading.maxLines, 2);
      expect(heading.softWrap, false);
      expect(heading.style?.fontSize, 27);
      expect(find.text('ระบบแจ้งเหตุและติดตามสถานะเหตุฉุกเฉิน'), findsNothing);
      expect(
        find.text(
          'เพื่อความปลอดภัยของข้อมูล และสามารถติดตามสถานะเหตุได้อย่างครบถ้วน',
        ),
        findsNothing,
      );

      final aviationLogo = find.byWidgetPredicate(
        (widget) =>
            widget is Image &&
            widget.image is AssetImage &&
            (widget.image as AssetImage).assetName ==
                'assets/images/police-aviation-logo.png',
      );
      expect(tester.getCenter(aviationLogo.first).dx, closeTo(205.5, 1));
      expect(tester.getCenter(find.byType(Card)).dx, closeTo(205.5, 1));

      final headingBottom = tester
          .getBottomRight(find.byKey(const Key('login-unit-heading')))
          .dy;
      final lineButtonTop = tester.getTopLeft(find.byType(GradientButton)).dy;
      final brandGroupCenter = tester
          .getRect(find.byKey(const Key('login-brand-group')))
          .center
          .dy;
      expect(brandGroupCenter, closeTo((headingBottom + lineButtonTop) / 2, 1));

      final privacyBottom = tester.getBottomRight(
        find.text('ดูนโยบายความเป็นส่วนตัว'),
      );
      final contactBottom = tester.getBottomRight(
        find.text('701 ถนนรามอินทรา แขวงท่าแร้ง\nโทรศัพท์ 0 2509 1520'),
      );
      expect(contactBottom.dy, greaterThan(privacyBottom.dy));
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
      expect(
        find.text('อุบัติเหตุ เหตุฉุกเฉิน หรือขอความช่วยเหลือด้านอากาศยาน'),
        findsNothing,
      );
      expect(
        find.text('ขอความช่วยเหลือจากภัยพิบัติหรือเหตุฉุกเฉินของประชาชน'),
        findsNothing,
      );
      final disasterReliefTitle = tester.widget<Text>(
        find.text('ช่วยเหลือบรรเทาสาธารณภัย'),
      );
      expect(disasterReliefTitle.maxLines, 1);
      expect(disasterReliefTitle.softWrap, isFalse);
      await tester.tap(find.text('ช่วยเหลือบรรเทาสาธารณภัย'));
      await tester.pumpAndSettle();
      expect(selectedType, 'DISASTER_RELIEF');
    });

    testWidgets('หน้าแรกแสดงชื่อผู้ใช้และซ่อนกล่องรายการเมื่อยังไม่มีเหตุ', (
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
      expect(find.text(AppCopy.unitNameMultiline), findsOneWidget);
      final header = tester.widget<Container>(
        find.byKey(const Key('home-header-background')),
      );
      final headerDecoration = header.decoration as BoxDecoration;
      expect(
        (headerDecoration.image?.image as AssetImage).assetName,
        'assets/images/home-header-background.png',
      );
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
        logoAssets
            .where((asset) => asset == 'assets/images/police-aviation-logo.png')
            .length,
        greaterThanOrEqualTo(2),
      );
      expect(
        logoAssets,
        isNot(contains('assets/images/royal-thai-police-logo.png')),
      );
      final realtimeCaption = tester.widget<Text>(
        find.text('แจ้งเหตุได้รวดเร็ว ติดตามสถานะได้แบบเรียลไทม์'),
      );
      expect(realtimeCaption.maxLines, 1);
      expect(realtimeCaption.style?.fontSize, 15);
      final trackingButtonText = tester.widget<Text>(
        find.descendant(
          of: find.byType(FilledButton),
          matching: find.text('ติดตาม'),
        ),
      );
      expect(trackingButtonText.maxLines, 1);
      expect(trackingButtonText.softWrap, isFalse);
      final emergencyDescription = tester.widget<Text>(
        find.text('หากต้องการความช่วยเหลือเร่งด่วน'),
      );
      expect(emergencyDescription.maxLines, 1);
      expect(emergencyDescription.softWrap, isFalse);
      final emergencyPhone = tester.widget<Text>(
        find.text('โทร. 0 2509 1520 (ตลอด 24 ชั่วโมง)'),
      );
      expect(emergencyPhone.maxLines, 1);
      expect(emergencyPhone.softWrap, isFalse);
      final emergencyCallButton = tester.widget<FilledButton>(
        find.byKey(const Key('emergency-call-button')),
      );
      expect(
        emergencyCallButton.style?.minimumSize?.resolve(<WidgetState>{}),
        const Size(0, 40),
      );
      expect(find.textContaining('กองบินตำรวจ 0 2509 1520'), findsNothing);
      expect(find.text('แจ้งเหตุใหม่'), findsOneWidget);
      expect(find.text('ยังไม่มีรายการแจ้งเหตุ'), findsNothing);
      expect(
        find.text('เมื่อแจ้งเหตุแล้ว รายการล่าสุดจะแสดงที่นี่'),
        findsNothing,
      );
    });

    testWidgets('หน้าประวัติแสดงปุ่มหน้า 1 เมื่อมีข้อมูลเพียงหน้าเดียว', (
      tester,
    ) async {
      await initializeDateFormatting('th');
      final incident = Incident(
        id: 'incident-1',
        caseCode: 'CASE-001',
        reporterName: 'ผู้แจ้ง',
        reporterPhone: '0812345678',
        type: 'AIRCRAFT_ACCIDENT',
        description: 'รายละเอียดเหตุการณ์',
        latitude: '13.7563',
        longitude: '100.5018',
        address: 'กรุงเทพมหานคร',
        status: 'COMPLETED',
        reportedAt: '2026-08-01T06:00:00.000Z',
        images: const [],
        history: const [],
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            incidentHistoryProvider.overrideWith(
              (_, __) async => IncidentPageData(
                items: [incident],
                page: 1,
                limit: 10,
                total: 1,
                totalPages: 1,
              ),
            ),
          ],
          child: MaterialApp(theme: AppTheme.light, home: const HistoryTab()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('CASE-001'), findsOneWidget);
      expect(find.text('1'), findsOneWidget);
      expect(find.byTooltip('หน้าก่อนหน้า'), findsOneWidget);
      expect(find.byTooltip('หน้าถัดไป'), findsOneWidget);
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
      expect(
        bell429.videoAsset,
        'assets/videos/aircraft/bell-429/bell-429.mp4',
      );
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
      expect(bell412.galleryAssets, hasLength(10));
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

      expect(find.text('รูปภาพ 1 จาก 10'), findsOneWidget);
      expect(find.text('General characteristics'), findsOneWidget);
      expect(find.text('Crew'), findsOneWidget);
      expect(find.text('one-two pilots'), findsOneWidget);
      await tester.drag(find.byType(PageView), const Offset(-500, 0));
      await tester.pumpAndSettle();
      expect(find.text('รูปภาพ 2 จาก 10'), findsOneWidget);
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

class _FixedDeviceLocationAdapter implements DeviceLocationAdapter {
  _FixedDeviceLocationAdapter({
    required this.latitude,
    required this.longitude,
  });

  final double latitude;
  final double longitude;
  int requestCount = 0;

  @override
  Future<DevicePosition> currentPosition() async {
    requestCount += 1;
    return DevicePosition(latitude: latitude, longitude: longitude);
  }
}
