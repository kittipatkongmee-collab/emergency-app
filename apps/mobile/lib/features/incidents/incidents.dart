import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:permission_handler/permission_handler.dart' as permissions;
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../../core/app_core.dart';

String incidentTypeLabel(String type) => switch (type) {
  'AIRCRAFT_ACCIDENT' => 'อากาศยานประสบภัย',
  'DISASTER_RELIEF' => 'ช่วยเหลือบรรเทาสาธารณภัย',
  _ => type,
};

String incidentStatusLabel(String status) => switch (status) {
  'RECEIVED' => 'รอดำเนินการ',
  'FORWARDED' => 'ส่งต่อเจ้าหน้าที่',
  'INSPECTING' => 'กำลังเข้าตรวจสอบ',
  'IN_PROGRESS' => 'กำลังดำเนินการ',
  'COMPLETED' => 'ภารกิจสำเร็จ',
  'CANCELLED' => 'ยกเลิก',
  _ => 'ไม่ทราบสถานะ',
};

class SelectedIncidentTypeCard extends StatelessWidget {
  const SelectedIncidentTypeCard({required this.type, super.key});

  final String type;

  @override
  Widget build(BuildContext context) {
    final isAircraftAccident = type == 'AIRCRAFT_ACCIDENT';
    return Card(
      color: const Color(0xFFFFF7F8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: AppTheme.primary.withValues(alpha: .28)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            CircleAvatar(
              radius: 24,
              backgroundColor: AppTheme.primaryLight,
              child: Icon(
                isAircraftAccident
                    ? Icons.flight_outlined
                    : Icons.health_and_safety_outlined,
                color: AppTheme.primary,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'ประเภทการแจ้งเหตุที่เลือก',
                    style: TextStyle(
                      color: AppTheme.textSecondary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    incidentTypeLabel(type),
                    style: const TextStyle(
                      color: AppTheme.primaryDark,
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: AppTheme.primary,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                'เลือกแล้ว',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Future<String?> showIncidentTypeDialog(
  BuildContext context,
) => showDialog<String>(
  context: context,
  barrierColor: Colors.black.withValues(alpha: .62),
  builder: (dialogContext) => Dialog(
    insetPadding: const EdgeInsets.symmetric(horizontal: 22, vertical: 24),
    backgroundColor: Colors.transparent,
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 460),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(30),
          border: Border.all(color: Colors.white.withValues(alpha: .8)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x4D290005),
              blurRadius: 38,
              offset: Offset(0, 18),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(30),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(24, 23, 24, 20),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF4A0007), Color(0xFF97000F)],
                  ),
                ),
                child: const Row(
                  children: [
                    DecoratedBox(
                      decoration: BoxDecoration(
                        color: Color(0x26FFFFFF),
                        borderRadius: BorderRadius.all(Radius.circular(15)),
                      ),
                      child: Padding(
                        padding: EdgeInsets.all(11),
                        child: Icon(
                          Icons.emergency_share_outlined,
                          color: Colors.white,
                          size: 27,
                        ),
                      ),
                    ),
                    SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'แจ้งเหตุใหม่',
                            style: TextStyle(
                              color: Color(0xFFFFD7DC),
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'เลือกประเภทการแจ้งเหตุ',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 18, 18, 8),
                child: Column(
                  children: [
                    _IncidentTypeOption(
                      icon: Icons.flight_rounded,
                      title: 'อากาศยานประสบภัย',
                      accentColor: AppTheme.primary,
                      onTap: () =>
                          Navigator.of(dialogContext).pop('AIRCRAFT_ACCIDENT'),
                    ),
                    const SizedBox(height: 12),
                    _IncidentTypeOption(
                      icon: Icons.health_and_safety_rounded,
                      title: 'ช่วยเหลือบรรเทาสาธารณภัย',
                      accentColor: const Color(0xFF9A5A00),
                      onTap: () =>
                          Navigator.of(dialogContext).pop('DISASTER_RELIEF'),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 4, 18, 16),
                child: TextButton.icon(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  icon: const Icon(Icons.close_rounded, size: 19),
                  label: const Text('ยกเลิก'),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  ),
);

class _IncidentTypeOption extends StatelessWidget {
  const _IncidentTypeOption({
    required this.icon,
    required this.title,
    required this.accentColor,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final Color accentColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: title,
    child: Material(
      color: accentColor.withValues(alpha: .045),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: accentColor.withValues(alpha: .18)),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 16),
          child: Row(
            children: [
              Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(
                  color: accentColor.withValues(alpha: .11),
                  borderRadius: BorderRadius.circular(17),
                ),
                child: Icon(icon, color: accentColor, size: 28),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    title,
                    maxLines: 1,
                    softWrap: false,
                    style: const TextStyle(
                      color: AppTheme.primaryDark,
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: accentColor.withValues(alpha: .12),
                      blurRadius: 12,
                    ),
                  ],
                ),
                child: Icon(
                  Icons.arrow_forward_rounded,
                  color: accentColor,
                  size: 20,
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

Future<void> openIncidentReport(BuildContext context, WidgetRef ref) async {
  final type = await showIncidentTypeDialog(context);
  if (type == null || !context.mounted) return;
  final draft = ref.read(reportDraftProvider);
  ref.read(reportDraftProvider.notifier).update(draft.copyWith(type: type));
  context.push('/report');
}

class Incident {
  Incident({
    required this.id,
    required this.caseCode,
    required this.reporterName,
    required this.reporterPhone,
    required this.type,
    required this.description,
    required this.latitude,
    required this.longitude,
    required this.address,
    required this.status,
    required this.reportedAt,
    required this.images,
    required this.history,
  });
  final String id,
      caseCode,
      reporterName,
      reporterPhone,
      type,
      description,
      latitude,
      longitude,
      address,
      status,
      reportedAt;
  final List<String> images;
  final List<IncidentHistory> history;
  factory Incident.fromJson(
    Map<String, dynamic> j, [
    String Function(String)? resolveMediaUrl,
  ]) => Incident(
    id: j['id'] as String,
    caseCode: j['caseCode'] as String,
    reporterName: j['reporterName'] as String,
    reporterPhone: j['reporterPhone'] as String,
    type: j['type'] as String,
    description: j['description'] as String,
    latitude: j['latitude'].toString(),
    longitude: j['longitude'].toString(),
    address: j['address'] as String,
    status: j['status'] as String,
    reportedAt: j['reportedAt'] as String,
    images: (j['images'] as List? ?? [])
        .map((e) => (e as Map<String, dynamic>)['imageUrl'] as String)
        .map((value) => resolveMediaUrl?.call(value) ?? value)
        .toList(),
    history: (j['statusHistory'] as List? ?? [])
        .map((e) => IncidentHistory.fromJson(e as Map<String, dynamic>))
        .toList(),
  );
}

class IncidentHistory {
  IncidentHistory({
    required this.id,
    required this.status,
    required this.changedAt,
    this.note,
  });
  final String id, status, changedAt;
  final String? note;
  factory IncidentHistory.fromJson(Map<String, dynamic> j) => IncidentHistory(
    id: j['id'] as String,
    status: j['toStatus'] as String,
    changedAt: j['changedAt'] as String,
    note: j['note'] as String?,
  );
}

class IncidentRepository {
  IncidentRepository(this.api);
  final ApiClient api;
  Future<List<Incident>> mine({String? status}) async {
    final r = await api.dio.get(
      '/incidents/me',
      queryParameters: {
        'limit': 100,
        if (status != null && status.isNotEmpty) 'status': status,
      },
    );
    final data = (r.data as Map)['data'] as Map;
    return (data['items'] as List)
        .map((e) => Incident.fromJson(e as Map<String, dynamic>, api.mediaUrl))
        .toList();
  }

  Future<Incident> detail(String id) async {
    final r = await api.dio.get('/incidents/$id');
    return Incident.fromJson(
      (r.data as Map)['data'] as Map<String, dynamic>,
      api.mediaUrl,
    );
  }

  Future<Incident> create(ReportDraft d) async {
    final validationErrors = d.validate();
    if (validationErrors.isNotEmpty) {
      throw ArgumentError(validationErrors.first);
    }
    final r = await api.dio.post(
      '/incidents',
      data: d.toJson(),
      options: Options(
        headers: {
          'Idempotency-Key': 'mobile-${DateTime.now().microsecondsSinceEpoch}',
        },
      ),
    );
    final item = Incident.fromJson(
      (r.data as Map)['data'] as Map<String, dynamic>,
      api.mediaUrl,
    );
    if (d.images.isNotEmpty) {
      final form = FormData();
      for (final image in d.images) {
        final contentType = incidentImageMediaType(image.name);
        form.files.add(
          MapEntry(
            'files',
            await MultipartFile.fromFile(
              image.path,
              filename: image.name,
              contentType: contentType,
            ),
          ),
        );
      }
      await api.dio.post('/incidents/${item.id}/images', data: form);
    }
    return detail(item.id);
  }
}

DioMediaType? incidentImageMediaType(String filename) =>
    MultipartFile.lookupMediaType(filename);

final incidentRepositoryProvider = Provider(
  (ref) => IncidentRepository(ref.watch(apiClientProvider)),
);
final incidentsProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(incidentRepositoryProvider).mine(),
);
final incidentHistoryProvider = FutureProvider.autoDispose
    .family<List<Incident>, String?>(
      (ref, status) =>
          ref.watch(incidentRepositoryProvider).mine(status: status),
    );

class ReportDraft {
  const ReportDraft({
    this.images = const [],
    this.reporterName = '',
    this.reporterPhone = '',
    this.type = 'AIRCRAFT_ACCIDENT',
    this.description = '',
    this.latitude = 0,
    this.longitude = 0,
    this.address = '',
    this.locationSelected = false,
  });
  final List<XFile> images;
  final String reporterName, reporterPhone, type, description, address;
  final double latitude, longitude;
  final bool locationSelected;
  ReportDraft copyWith({
    List<XFile>? images,
    String? reporterName,
    String? reporterPhone,
    String? type,
    String? description,
    double? latitude,
    double? longitude,
    String? address,
    bool? locationSelected,
  }) => ReportDraft(
    images: images ?? this.images,
    reporterName: reporterName ?? this.reporterName,
    reporterPhone: reporterPhone ?? this.reporterPhone,
    type: type ?? this.type,
    description: description ?? this.description,
    latitude: latitude ?? this.latitude,
    longitude: longitude ?? this.longitude,
    address: address ?? this.address,
    locationSelected: locationSelected ?? this.locationSelected,
  );
  Map<String, dynamic> toJson() => {
    'reporterName': reporterName,
    'reporterPhone': reporterPhone,
    'type': type,
    'description': description,
    'latitude': latitude.toStringAsFixed(7),
    'longitude': longitude.toStringAsFixed(7),
    'address': address,
    'priority': 'NORMAL',
  };

  List<String> validate() {
    final errors = <String>[];
    if (reporterName.trim().length < 2) {
      errors.add('กรุณาระบุชื่อผู้แจ้ง');
    }
    if (!RegExp(r'^0\d{8,9}$').hasMatch(reporterPhone)) {
      errors.add('กรุณาระบุเบอร์โทรศัพท์ให้ถูกต้อง');
    }
    if (description.trim().length < 10) {
      errors.add('กรุณาอธิบายเหตุการณ์อย่างน้อย 10 ตัวอักษร');
    }
    if (!locationSelected) {
      errors.add('กรุณาเลือกตำแหน่งเหตุการณ์');
    }
    return errors;
  }
}

class ReportDraftNotifier extends StateNotifier<ReportDraft> {
  ReportDraftNotifier() : super(const ReportDraft());
  void update(ReportDraft value) => state = value;
  void clear() => state = const ReportDraft();
}

final reportDraftProvider =
    StateNotifierProvider<ReportDraftNotifier, ReportDraft>(
      (_) => ReportDraftNotifier(),
    );

class ReportScreen extends ConsumerStatefulWidget {
  const ReportScreen({super.key});
  @override
  ConsumerState<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends ConsumerState<ReportScreen> {
  final formKey = GlobalKey<FormState>();
  final picker = ImagePicker();
  late final TextEditingController name;
  late final TextEditingController phone;
  late final TextEditingController description;

  @override
  void initState() {
    super.initState();
    final draft = ref.read(reportDraftProvider);
    name = TextEditingController(text: draft.reporterName);
    phone = TextEditingController(text: draft.reporterPhone);
    description = TextEditingController(text: draft.description);
  }

  @override
  void dispose() {
    name.dispose();
    phone.dispose();
    description.dispose();
    super.dispose();
  }

  Future<void> pick(ImageSource source) async {
    final draft = ref.read(reportDraftProvider);
    if (draft.images.length >= 5) return;
    final selected = <XFile>[];
    if (source == ImageSource.gallery) {
      selected.addAll(
        await picker.pickMultiImage(
          imageQuality: 82,
          limit: 5 - draft.images.length,
        ),
      );
    } else {
      final image = await picker.pickImage(source: source, imageQuality: 82);
      if (image != null) selected.add(image);
    }
    final valid = <XFile>[];
    for (final image in selected) {
      if (await image.length() <= 10 * 1024 * 1024) valid.add(image);
    }
    ref
        .read(reportDraftProvider.notifier)
        .update(
          draft.copyWith(images: [...draft.images, ...valid].take(5).toList()),
        );
  }

  void next() {
    final draft = ref.read(reportDraftProvider);
    if (!formKey.currentState!.validate()) return;
    if (draft.images.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('กรุณาแนบรูปภาพอย่างน้อย 1 รูป')),
      );
      return;
    }
    ref
        .read(reportDraftProvider.notifier)
        .update(
          draft.copyWith(
            reporterName: name.text.trim(),
            reporterPhone: phone.text.trim(),
            description: description.text.trim(),
          ),
        );
    context.push('/location');
  }

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(reportDraftProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('แจ้งเหตุ'),
        actions: const [
          Padding(
            padding: EdgeInsets.only(right: 12),
            child: RoyalThaiPoliceLogo(size: 42),
          ),
        ],
      ),
      body: SafeArea(
        child: Form(
          key: formKey,
          child: ListView(
            padding: const EdgeInsets.all(18),
            children: [
              SelectedIncidentTypeCard(type: draft.type),
              const SizedBox(height: 14),
              _photoSection(draft),
              const SizedBox(height: 14),
              _detailsSection(),
              const SizedBox(height: 14),
              Card(
                color: const Color(0xFFFFFBFB),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                  side: const BorderSide(color: Color(0xFFE4B2B8)),
                ),
                child: const Padding(
                  padding: EdgeInsets.all(15),
                  child: Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: AppTheme.primaryLight,
                        child: Icon(
                          Icons.verified_user_outlined,
                          color: AppTheme.primary,
                        ),
                      ),
                      SizedBox(width: 12),
                      Expanded(
                        child: Text.rich(
                          TextSpan(
                            children: [
                              TextSpan(
                                text: 'กรุณาระบุข้อมูลให้ถูกต้องและครบถ้วน\n',
                                style: TextStyle(
                                  color: AppTheme.primaryDark,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              TextSpan(
                                text:
                                    'ข้อมูลของคุณจะช่วยให้เจ้าหน้าที่ช่วยเหลือได้รวดเร็วและมีประสิทธิภาพ',
                                style: TextStyle(
                                  color: AppTheme.textSecondary,
                                  height: 1.4,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),
              GradientButton(label: 'ถัดไป: ระบุตำแหน่ง', onPressed: next),
            ],
          ),
        ),
      ),
    );
  }

  Widget _photoSection(ReportDraft draft) => Card(
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Expanded(
                child: Text(
                  'ภาพถ่ายเหตุการณ์',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.primaryDark,
                  ),
                ),
              ),
              PoliceAviationLogo(size: 74),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: EdgeInsets.symmetric(
              horizontal: draft.images.isEmpty ? 18 : 10,
              vertical: draft.images.isEmpty ? 24 : 10,
            ),
            decoration: BoxDecoration(
              border: Border.all(
                color: AppTheme.primary.withValues(alpha: .35),
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                if (draft.images.isEmpty) ...[
                  const CircleAvatar(
                    radius: 35,
                    backgroundColor: AppTheme.primaryLight,
                    child: Icon(
                      Icons.camera_alt_outlined,
                      color: AppTheme.primary,
                      size: 34,
                    ),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'แตะเพื่อถ่ายภาพ',
                    style: TextStyle(
                      color: AppTheme.primaryDark,
                      fontWeight: FontWeight.w800,
                      fontSize: 18,
                    ),
                  ),
                  const Text('หรืออัปโหลดภาพจากแกลเลอรี'),
                  const Text(
                    'JPG, PNG ไม่เกิน 10 MB · สูงสุด 5 รูป',
                    style: TextStyle(
                      color: AppTheme.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                ] else ...[
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final tileWidth = constraints.maxWidth > 420
                          ? 285.0
                          : constraints.maxWidth * .82;
                      return SizedBox(
                        height: 205,
                        child: ListView.separated(
                          key: const PageStorageKey('incident-photo-carousel'),
                          scrollDirection: Axis.horizontal,
                          physics: const BouncingScrollPhysics(),
                          itemCount: draft.images.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(width: 10),
                          itemBuilder: (context, index) => Semantics(
                            label:
                                'รูปเหตุการณ์ที่ ${index + 1} จาก ${draft.images.length}',
                            image: true,
                            child: SizedBox(
                              width: tileWidth,
                              child: Stack(
                                fit: StackFit.expand,
                                children: [
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(15),
                                    child: Image.file(
                                      File(draft.images[index].path),
                                      fit: BoxFit.cover,
                                    ),
                                  ),
                                  const DecoratedBox(
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.all(
                                        Radius.circular(15),
                                      ),
                                      gradient: LinearGradient(
                                        begin: Alignment.topCenter,
                                        end: Alignment.bottomCenter,
                                        colors: [
                                          Colors.transparent,
                                          Color(0x99000000),
                                        ],
                                        stops: [.55, 1],
                                      ),
                                    ),
                                  ),
                                  Positioned(
                                    right: 9,
                                    top: 9,
                                    child: IconButton.filled(
                                      tooltip: 'ลบรูปที่ ${index + 1}',
                                      onPressed: () => ref
                                          .read(reportDraftProvider.notifier)
                                          .update(
                                            draft.copyWith(
                                              images: [...draft.images]
                                                ..removeAt(index),
                                            ),
                                          ),
                                      style: IconButton.styleFrom(
                                        backgroundColor: const Color(
                                          0xB33B0006,
                                        ),
                                        foregroundColor: Colors.white,
                                        minimumSize: const Size(38, 38),
                                        padding: EdgeInsets.zero,
                                      ),
                                      icon: const Icon(
                                        Icons.close_rounded,
                                        size: 20,
                                      ),
                                    ),
                                  ),
                                  Positioned(
                                    left: 12,
                                    right: 12,
                                    bottom: 11,
                                    child: Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 10,
                                            vertical: 5,
                                          ),
                                          decoration: BoxDecoration(
                                            color: Colors.white.withValues(
                                              alpha: .92,
                                            ),
                                            borderRadius: BorderRadius.circular(
                                              20,
                                            ),
                                          ),
                                          child: Text(
                                            'รูปที่ ${index + 1}',
                                            style: const TextStyle(
                                              color: AppTheme.primaryDark,
                                              fontSize: 11,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                        ),
                                        const Spacer(),
                                        Text(
                                          '${index + 1}/${draft.images.length}',
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'เพิ่มแล้ว ${draft.images.length} จาก 5 รูป',
                        style: const TextStyle(
                          color: AppTheme.textSecondary,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const Row(
                        children: [
                          Icon(
                            Icons.swipe_rounded,
                            size: 17,
                            color: AppTheme.primary,
                          ),
                          SizedBox(width: 4),
                          Text(
                            'ปัดซ้าย–ขวา',
                            style: TextStyle(
                              color: AppTheme.primary,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  alignment: WrapAlignment.center,
                  children: [
                    OutlinedButton.icon(
                      onPressed: draft.images.length >= 5
                          ? null
                          : () => pick(ImageSource.camera),
                      icon: const Icon(Icons.camera_alt),
                      label: const Text('กล้อง'),
                    ),
                    OutlinedButton.icon(
                      onPressed: draft.images.length >= 5
                          ? null
                          : () => pick(ImageSource.gallery),
                      icon: const Icon(Icons.photo_library),
                      label: const Text('แกลเลอรี'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );

  Widget _detailsSection() => Card(
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'ข้อมูลผู้แจ้งและรายละเอียด',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: AppTheme.primaryDark,
            ),
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: name,
            decoration: const InputDecoration(
              labelText: 'ชื่อผู้แจ้ง',
              prefixIcon: Icon(Icons.person_outline),
            ),
            validator: (value) => value == null || value.trim().length < 2
                ? 'กรุณาระบุชื่อผู้แจ้ง'
                : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: phone,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              labelText: 'หมายเลขโทรศัพท์',
              prefixIcon: Icon(Icons.phone_outlined),
            ),
            validator: (value) => RegExp(r'^0\d{8,9}$').hasMatch(value ?? '')
                ? null
                : 'กรุณาระบุหมายเลขโทรศัพท์ที่ติดต่อได้',
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: description,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: 'รายละเอียดเหตุการณ์',
              alignLabelWithHint: true,
              prefixIcon: Icon(Icons.notes),
            ),
            validator: (value) => value == null || value.trim().length < 10
                ? 'กรุณาอธิบายเหตุการณ์อย่างน้อย 10 ตัวอักษร'
                : null,
          ),
        ],
      ),
    ),
  );
}

class LocationScreen extends ConsumerStatefulWidget {
  const LocationScreen({super.key});
  @override
  ConsumerState<LocationScreen> createState() => _LocationScreenState();
}

class DevicePosition {
  const DevicePosition({required this.latitude, required this.longitude});
  final double latitude;
  final double longitude;
}

abstract interface class DeviceLocationAdapter {
  Future<DevicePosition> currentPosition();
}

class GeolocatorLocationAdapter implements DeviceLocationAdapter {
  @override
  Future<DevicePosition> currentPosition() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw Exception('กรุณาเปิดบริการตำแหน่ง');
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw Exception('ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง');
    }
    final position = await Geolocator.getCurrentPosition();
    return DevicePosition(
      latitude: position.latitude,
      longitude: position.longitude,
    );
  }
}

final deviceLocationProvider = Provider<DeviceLocationAdapter>(
  (_) => GeolocatorLocationAdapter(),
);

class _LocationScreenState extends ConsumerState<LocationScreen> {
  static const fallbackMapCenter = LatLng(13.7563, 100.5018);

  late LatLng selected;
  GoogleMapController? mapController;
  Offset simulatedMarkerFraction = const Offset(.5, .5);
  bool locating = false;
  bool resolvedDevicePosition = false;

  @override
  void initState() {
    super.initState();
    final d = ref.read(reportDraftProvider);
    selected = d.locationSelected
        ? LatLng(d.latitude, d.longitude)
        : fallbackMapCenter;
    if (!d.locationSelected) {
      WidgetsBinding.instance.addPostFrameCallback((_) => current());
    }
  }

  Future<void> current() async {
    if (locating) return;
    setState(() => locating = true);
    try {
      final position = await ref.read(deviceLocationProvider).currentPosition();
      if (!mounted) return;
      final nextPosition = LatLng(position.latitude, position.longitude);
      setState(() {
        selected = nextPosition;
        simulatedMarkerFraction = const Offset(.5, .5);
        resolvedDevicePosition = true;
      });
      await mapController?.animateCamera(
        CameraUpdate.newLatLngZoom(nextPosition, 16),
      );
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
    } finally {
      if (mounted) setState(() => locating = false);
    }
  }

  @override
  void dispose() {
    mapController?.dispose();
    super.dispose();
  }

  void updateSimulatedLocation(Offset localPosition, Size mapSize) {
    if (mapSize.width <= 0 || mapSize.height <= 0) return;
    final nextFraction = Offset(
      (localPosition.dx / mapSize.width).clamp(.08, .92).toDouble(),
      (localPosition.dy / mapSize.height).clamp(.1, .9).toDouble(),
    );
    final latitudeDelta = (simulatedMarkerFraction.dy - nextFraction.dy) * .02;
    final longitudeDelta = (nextFraction.dx - simulatedMarkerFraction.dx) * .02;
    setState(() {
      selected = LatLng(
        (selected.latitude + latitudeDelta).clamp(-90, 90).toDouble(),
        (selected.longitude + longitudeDelta).clamp(-180, 180).toDouble(),
      );
      simulatedMarkerFraction = nextFraction;
    });
  }

  void confirm() {
    final d = ref.read(reportDraftProvider);
    final latitude = selected.latitude.toStringAsFixed(7);
    final longitude = selected.longitude.toStringAsFixed(7);
    ref
        .read(reportDraftProvider.notifier)
        .update(
          d.copyWith(
            latitude: selected.latitude,
            longitude: selected.longitude,
            address: 'พิกัด $latitude, $longitude',
            locationSelected: true,
          ),
        );
    context.push('/review');
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const BrandedAppBarTitle('ระบุตำแหน่งเหตุการณ์'),
      toolbarHeight: 72,
    ),
    body: SafeArea(
      child: Column(
        children: [
          Expanded(
            child: Stack(
              children: [
                Positioned.fill(
                  child: Environment.mapsEnabled
                      ? GoogleMap(
                          initialCameraPosition: CameraPosition(
                            target: selected,
                            zoom: 15,
                          ),
                          onMapCreated: (controller) {
                            mapController = controller;
                            if (resolvedDevicePosition) {
                              controller.moveCamera(
                                CameraUpdate.newLatLngZoom(selected, 16),
                              );
                            }
                          },
                          markers: {
                            Marker(
                              markerId: const MarkerId('incident'),
                              position: selected,
                              draggable: true,
                              onDragEnd: (v) => setState(() => selected = v),
                            ),
                          },
                          onTap: (v) => setState(() => selected = v),
                          myLocationButtonEnabled: false,
                        )
                      : LayoutBuilder(
                          builder: (context, constraints) {
                            final mapSize = constraints.biggest;
                            final markerPosition = Offset(
                              simulatedMarkerFraction.dx * mapSize.width,
                              simulatedMarkerFraction.dy * mapSize.height,
                            );
                            return GestureDetector(
                              key: const Key('interactive-simulated-map'),
                              behavior: HitTestBehavior.opaque,
                              onTapDown: (details) => updateSimulatedLocation(
                                details.localPosition,
                                mapSize,
                              ),
                              onPanStart: (details) => updateSimulatedLocation(
                                details.localPosition,
                                mapSize,
                              ),
                              onPanUpdate: (details) => updateSimulatedLocation(
                                details.localPosition,
                                mapSize,
                              ),
                              child: ColoredBox(
                                color: const Color(0xFFF0F3F5),
                                child: Stack(
                                  children: [
                                    CustomPaint(
                                      size: Size.infinite,
                                      painter: _MapGridPainter(),
                                    ),
                                    Positioned(
                                      left: markerPosition.dx - 38,
                                      top: markerPosition.dy - 70,
                                      child: const IgnorePointer(
                                        child: Icon(
                                          Icons.location_pin,
                                          color: AppTheme.primary,
                                          size: 76,
                                        ),
                                      ),
                                    ),
                                    Positioned(
                                      left: 12,
                                      top: 12,
                                      child: DecoratedBox(
                                        decoration: BoxDecoration(
                                          color: Colors.white.withValues(
                                            alpha: .9,
                                          ),
                                          borderRadius: BorderRadius.circular(
                                            10,
                                          ),
                                        ),
                                        child: Padding(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 10,
                                            vertical: 6,
                                          ),
                                          child: Text(
                                            '${selected.latitude.toStringAsFixed(6)}, ${selected.longitude.toStringAsFixed(6)}',
                                          ),
                                        ),
                                      ),
                                    ),
                                    const Positioned(
                                      right: 12,
                                      bottom: 12,
                                      child: Text(
                                        'แตะหรือลากหมุดเพื่อเลือกตำแหน่ง',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: AppTheme.textSecondary,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                ),
                Positioned(
                  right: 18,
                  bottom: 18,
                  child: FloatingActionButton(
                    heroTag: 'current-location',
                    backgroundColor: Colors.white,
                    foregroundColor: AppTheme.primary,
                    onPressed: locating ? null : current,
                    child: locating
                        ? const CircularProgressIndicator()
                        : const Icon(Icons.my_location),
                  ),
                ),
              ],
            ),
          ),
          Card(
            margin: const EdgeInsets.all(14),
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: AppTheme.primaryLight,
                        child: Icon(
                          Icons.location_on_outlined,
                          color: AppTheme.primary,
                        ),
                      ),
                      SizedBox(width: 12),
                      Expanded(
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(
                            'ตำแหน่งที่เลือก',
                            maxLines: 1,
                            softWrap: false,
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              color: AppTheme.primaryDark,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'แตะแผนที่หรือลากหมุดเพื่อเลือกตำแหน่งเหตุการณ์',
                    style: TextStyle(
                      color: AppTheme.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'ละติจูด ${selected.latitude.toStringAsFixed(7)}    |    ลองจิจูด ${selected.longitude.toStringAsFixed(7)}',
                    style: const TextStyle(color: AppTheme.textSecondary),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: locating ? null : current,
                          icon: const Icon(Icons.my_location),
                          label: Text(
                            locating ? 'กำลังค้นหา…' : 'ใช้ตำแหน่งปัจจุบัน',
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: GradientButton(
                          label: 'ยืนยันตำแหน่ง',
                          icon: Icons.check_circle,
                          onPressed: confirm,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class _MapGridPainter extends CustomPainter {
  @override
  void paint(Canvas c, Size s) {
    final p = Paint()
      ..color = const Color(0xFFCBD5DC)
      ..strokeWidth = 2;
    for (double x = 0; x < s.width; x += 65)
      c.drawLine(Offset(x, 0), Offset(x, s.height), p);
    for (double y = 0; y < s.height; y += 65)
      c.drawLine(Offset(0, y), Offset(s.width, y), p);
    final river = Paint()
      ..color = const Color(0xFFB8DFF3)
      ..strokeWidth = 20;
    c.drawLine(
      Offset(0, s.height * .7),
      Offset(s.width, s.height * .25),
      river,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}

class ReviewScreen extends ConsumerStatefulWidget {
  const ReviewScreen({super.key});
  @override
  ConsumerState<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends ConsumerState<ReviewScreen> {
  bool busy = false;
  String? error;
  Future<void> submit() async {
    if (busy) return;
    final validationErrors = ref.read(reportDraftProvider).validate();
    if (validationErrors.isNotEmpty) {
      setState(() => error = validationErrors.first);
      return;
    }
    setState(() => busy = true);
    try {
      final incident = await ref
          .read(incidentRepositoryProvider)
          .create(ref.read(reportDraftProvider));
      ref.read(reportDraftProvider.notifier).clear();
      if (mounted) context.go('/success', extra: incident);
    } catch (e) {
      setState(() => error = thaiError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = ref.watch(reportDraftProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('ตรวจสอบข้อมูล')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            const Text(
              'ขั้นตอนที่ 3 จาก 3',
              style: TextStyle(
                color: AppTheme.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const Text(
              'ตรวจสอบและส่งข้อมูล',
              style: TextStyle(
                fontSize: 25,
                fontWeight: FontWeight.w700,
                color: AppTheme.primaryDark,
              ),
            ),
            const SizedBox(height: 15),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      height: 110,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: d.images.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemBuilder: (_, i) => ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.file(
                            File(d.images[i].path),
                            width: 130,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    _ReviewRow('ผู้แจ้ง', d.reporterName),
                    _ReviewRow('โทรศัพท์', d.reporterPhone),
                    _ReviewRow('ประเภท', incidentTypeLabel(d.type)),
                    _ReviewRow('รายละเอียด', d.description),
                    _ReviewRow(
                      'พิกัด',
                      '${d.latitude.toStringAsFixed(7)}, ${d.longitude.toStringAsFixed(7)}',
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            if (error != null)
              Padding(
                padding: const EdgeInsets.all(10),
                child: Text(
                  error!,
                  style: const TextStyle(color: AppTheme.danger),
                ),
              ),
            OutlinedButton.icon(
              onPressed: busy ? null : () => context.pop(),
              icon: const Icon(Icons.edit),
              label: const Text('แก้ไขข้อมูล'),
            ),
            const SizedBox(height: 10),
            GradientButton(
              label: 'ยืนยันและส่งข้อมูล',
              icon: Icons.send,
              busy: busy,
              onPressed: submit,
            ),
          ],
        ),
      ),
    );
  }
}

class _ReviewRow extends StatelessWidget {
  const _ReviewRow(this.label, this.value);
  final String label, value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 7),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 92,
          child: Text(
            label,
            style: const TextStyle(color: AppTheme.textSecondary),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
      ],
    ),
  );
}

class SuccessScreen extends StatelessWidget {
  const SuccessScreen({required this.result, super.key});
  final Incident result;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(25),
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xFFE4F5EC),
              ),
              child: const Icon(
                Icons.check_circle,
                color: AppTheme.success,
                size: 72,
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'ส่งข้อมูลสำเร็จ',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w700,
                color: AppTheme.primaryDark,
              ),
            ),
            const Text('เจ้าหน้าที่ได้รับข้อมูลของคุณแล้ว'),
            const SizedBox(height: 25),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    const Text(
                      'รหัสแจ้งเหตุ',
                      style: TextStyle(color: AppTheme.textSecondary),
                    ),
                    SelectableText(
                      result.caseCode,
                      style: const TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.primary,
                      ),
                    ),
                    TextButton.icon(
                      onPressed: () async {
                        await Clipboard.setData(
                          ClipboardData(text: result.caseCode),
                        );
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('คัดลอกรหัสแจ้งเหตุแล้ว'),
                            ),
                          );
                        }
                      },
                      icon: const Icon(Icons.copy),
                      label: const Text('คัดลอกรหัส'),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'โปรดเก็บรหัสนี้ไว้สำหรับติดตามสถานะ',
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            GradientButton(
              label: 'ติดตามสถานะทันที',
              onPressed: () => context.go('/tracking/${result.id}'),
            ),
            TextButton(
              onPressed: () => context.go('/home'),
              child: const Text('กลับหน้าแรก'),
            ),
          ],
        ),
      ),
    ),
  );
}

class TrackingScreen extends ConsumerStatefulWidget {
  const TrackingScreen({required this.incidentId, super.key});
  final String incidentId;
  @override
  ConsumerState<TrackingScreen> createState() => _TrackingScreenState();
}

class _TrackingScreenState extends ConsumerState<TrackingScreen> {
  Incident? incident;
  String? error;
  io.Socket? socket;
  @override
  void initState() {
    super.initState();
    load();
    connect();
  }

  Future<void> load() async {
    try {
      final v = await ref
          .read(incidentRepositoryProvider)
          .detail(widget.incidentId);
      if (mounted) setState(() => incident = v);
    } catch (e) {
      if (mounted) setState(() => error = thaiError(e));
    }
  }

  Future<void> connect() async {
    final token = await ref
        .read(secureStorageProvider)
        .read(key: 'accessToken');
    socket = io.io(
      Environment.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .disableAutoConnect()
          .build(),
    );
    socket!.on('incident.status.changed', (_) => load());
    socket!.on('notification.created', (_) {
      ref.invalidate(notificationsProvider);
      ref.invalidate(unreadCountProvider);
    });
    socket!.connect();
  }

  @override
  void dispose() {
    socket?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const BrandedAppBarTitle('ติดตามสถานะ'),
      toolbarHeight: 72,
    ),
    body: error != null
        ? Center(child: Text(error!))
        : incident == null
        ? const Center(child: CircularProgressIndicator())
        : _TrackingBody(incident: incident!),
  );
}

class _TrackingBody extends StatelessWidget {
  const _TrackingBody({required this.incident});
  final Incident incident;
  static const steps = ['RECEIVED', 'IN_PROGRESS', 'COMPLETED'];
  static const labels = {
    'RECEIVED': 'รอดำเนินการ',
    'FORWARDED': 'ส่งต่อเจ้าหน้าที่',
    'INSPECTING': 'กำลังเข้าตรวจสอบ',
    'IN_PROGRESS': 'กำลังดำเนินการ',
    'COMPLETED': 'ภารกิจสำเร็จ',
  };
  @override
  Widget build(BuildContext context) {
    final current = switch (incident.status) {
      'COMPLETED' => 2,
      'IN_PROGRESS' => 1,
      _ => 0,
    };
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'รหัสแจ้งเหตุ',
                  style: TextStyle(
                    color: AppTheme.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Row(
                  children: [
                    Expanded(
                      child: Row(
                        children: [
                          Flexible(
                            child: SelectableText(
                              incident.caseCode,
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: AppTheme.primary,
                              ),
                            ),
                          ),
                          IconButton(
                            tooltip: 'คัดลอกรหัสแจ้งเหตุ',
                            onPressed: () {
                              Clipboard.setData(
                                ClipboardData(text: incident.caseCode),
                              );
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('คัดลอกรหัสแจ้งเหตุแล้ว'),
                                ),
                              );
                            },
                            icon: const Icon(
                              Icons.copy_outlined,
                              color: AppTheme.primary,
                              size: 20,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Chip(
                      label: Text(labels[incident.status] ?? incident.status),
                      labelStyle: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.primaryDark,
                      ),
                      visualDensity: VisualDensity.compact,
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (incident.images.isNotEmpty)
                      ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: Image.network(
                          incident.images.first,
                          width: 118,
                          height: 106,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Container(
                            width: 118,
                            height: 106,
                            color: AppTheme.primaryLight,
                            child: const Icon(
                              Icons.broken_image_outlined,
                              color: AppTheme.primary,
                            ),
                          ),
                        ),
                      )
                    else
                      Container(
                        width: 118,
                        height: 106,
                        decoration: BoxDecoration(
                          color: AppTheme.primaryLight,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Icon(
                          Icons.image_outlined,
                          color: AppTheme.primary,
                          size: 40,
                        ),
                      ),
                    const SizedBox(width: 15),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            incidentTypeLabel(incident.type),
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: AppTheme.primaryDark,
                            ),
                          ),
                          const SizedBox(height: 5),
                          Text(
                            incident.description,
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AppTheme.textSecondary,
                              height: 1.45,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    const Icon(
                      Icons.calendar_month_outlined,
                      color: AppTheme.primary,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'แจ้งเหตุเมื่อ  ${DateFormat('d MMM yyyy · HH:mm น.', 'th').format(DateTime.parse(incident.reportedAt).toLocal())}',
                      style: const TextStyle(color: AppTheme.textSecondary),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'ความคืบหน้าของเหตุ',
                  style: TextStyle(
                    fontSize: 21,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.primaryDark,
                  ),
                ),
                const SizedBox(height: 15),
                for (var i = 0; i < steps.length; i++)
                  _TimelineItem(
                    label: labels[steps[i]]!,
                    complete: i <= current,
                    active: i == current,
                    history: incident.history
                        .where((h) => h.status == steps[i])
                        .firstOrNull,
                    last: i == steps.length - 1,
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        Card(
          child: ListTile(
            contentPadding: const EdgeInsets.all(16),
            leading: const CircleAvatar(
              backgroundColor: AppTheme.primaryLight,
              child: Icon(Icons.location_pin, color: AppTheme.primary),
            ),
            title: const Text(
              'สถานที่เกิดเหตุ',
              style: TextStyle(
                color: AppTheme.primaryDark,
                fontWeight: FontWeight.w800,
              ),
            ),
            subtitle: Text(
              '${incident.address}\nพิกัด ${incident.latitude}, ${incident.longitude}',
            ),
            isThreeLine: true,
            trailing: const Icon(Icons.chevron_right),
          ),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      'พิกัด ${incident.latitude}, ${incident.longitude}',
                    ),
                  ),
                ),
                icon: const Icon(Icons.map_outlined),
                label: const Text('ดูตำแหน่งบนแผนที่'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: FilledButton.icon(
                onPressed: () => launchPhone(context, '0 2509 1520'),
                icon: const Icon(Icons.phone),
                label: const Text('ติดต่อเจ้าหน้าที่'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _TimelineItem extends StatelessWidget {
  const _TimelineItem({
    required this.label,
    required this.complete,
    required this.active,
    required this.last,
    this.history,
  });
  final String label;
  final bool complete, active, last;
  final IncidentHistory? history;
  @override
  Widget build(BuildContext context) => IntrinsicHeight(
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 42,
          child: Column(
            children: [
              CircleAvatar(
                radius: 17,
                backgroundColor: complete
                    ? AppTheme.primary
                    : const Color(0xFFE3DEDF),
                child: Icon(
                  complete ? Icons.check : Icons.circle,
                  size: active ? 14 : 8,
                  color: complete ? Colors.white : AppTheme.textSecondary,
                ),
              ),
              if (!last)
                Expanded(
                  child: Container(
                    width: 2,
                    color: complete
                        ? AppTheme.primary
                        : const Color(0xFFE3DEDF),
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(left: 8, bottom: 25),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                    color: active ? AppTheme.primaryDark : AppTheme.textPrimary,
                  ),
                ),
                if (history != null)
                  Text(
                    DateFormat(
                      'd MMM yyyy · HH:mm',
                      'th',
                    ).format(DateTime.parse(history!.changedAt).toLocal()),
                    style: const TextStyle(color: AppTheme.textSecondary),
                  ),
                if (history?.note != null)
                  Text(
                    history!.note!,
                    style: const TextStyle(color: AppTheme.textSecondary),
                  ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}

void launchPhone(BuildContext context, String phone) {
  ScaffoldMessenger.of(
    context,
  ).showSnackBar(SnackBar(content: Text('หมายเลขติดต่อ: $phone')));
}

class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    required this.message,
    required this.createdAt,
    required this.isRead,
    this.incidentId,
  });
  final String id, title, message, createdAt;
  final String? incidentId;
  final bool isRead;
  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      AppNotification(
        id: json['id'] as String,
        title: json['title'] as String,
        message: json['message'] as String,
        createdAt: json['createdAt'] as String,
        isRead: json['isRead'] as bool,
        incidentId: json['incidentId'] as String?,
      );
}

class NotificationRepository {
  const NotificationRepository(this.api);
  final ApiClient api;
  Future<List<AppNotification>> list() async {
    final response = await api.dio.get('/notifications');
    final page = (response.data as Map)['data'] as Map;
    return (page['items'] as List)
        .map((item) => AppNotification.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<void> read(String id) =>
      api.dio.patch<void>('/notifications/$id/read');
  Future<void> readAll() => api.dio.patch<void>('/notifications/read-all');
}

final notificationRepositoryProvider = Provider(
  (ref) => NotificationRepository(ref.watch(apiClientProvider)),
);
final notificationsProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(notificationRepositoryProvider).list(),
);
final unreadCountProvider = FutureProvider.autoDispose((ref) async {
  final response = await ref
      .watch(apiClientProvider)
      .dio
      .get('/notifications/unread-count');
  return ((response.data as Map)['data'] as Map)['count'] as int;
});

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(
      title: const Text('การแจ้งเตือน'),
      actions: [
        TextButton(
          onPressed: () async {
            await ref.read(notificationRepositoryProvider).readAll();
            ref.invalidate(notificationsProvider);
            ref.invalidate(unreadCountProvider);
          },
          child: const Text('อ่านทั้งหมด'),
        ),
      ],
    ),
    body: ref
        .watch(notificationsProvider)
        .when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('ไม่สามารถโหลดการแจ้งเตือนได้'),
                TextButton(
                  onPressed: () => ref.invalidate(notificationsProvider),
                  child: const Text('ลองอีกครั้ง'),
                ),
              ],
            ),
          ),
          data: (items) {
            if (items.isEmpty) {
              return const Center(child: Text('ยังไม่มีการแจ้งเตือน'));
            }
            return RefreshIndicator(
              onRefresh: () => ref.refresh(notificationsProvider.future),
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (_, i) {
                  final notice = items[i];
                  return Card(
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: AppTheme.primaryLight,
                        child: Icon(
                          notice.isRead
                              ? Icons.notifications_none
                              : Icons.notifications,
                          color: AppTheme.primary,
                        ),
                      ),
                      title: Text(
                        notice.title,
                        style: TextStyle(
                          fontWeight: notice.isRead
                              ? FontWeight.w500
                              : FontWeight.w700,
                        ),
                      ),
                      subtitle: Text(notice.message),
                      onTap: () async {
                        if (!notice.isRead) {
                          await ref
                              .read(notificationRepositoryProvider)
                              .read(notice.id);
                          ref.invalidate(notificationsProvider);
                          ref.invalidate(unreadCountProvider);
                        }
                        if (notice.incidentId != null && context.mounted) {
                          context.push('/tracking/${notice.incidentId}');
                        }
                      },
                    ),
                  );
                },
              ),
            );
          },
        ),
  );
}

class PermissionsScreen extends StatefulWidget {
  const PermissionsScreen({super.key});
  @override
  State<PermissionsScreen> createState() => _PermissionsScreenState();
}

class _PermissionsScreenState extends State<PermissionsScreen> {
  Future<void> request() async {
    await [
      permissions.Permission.camera,
      permissions.Permission.location,
      permissions.Permission.notification,
    ].request();
    if (mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('สิทธิ์การใช้งาน')),
    body: Padding(
      padding: const EdgeInsets.all(22),
      child: Column(
        children: [
          const Icon(Icons.shield_outlined, size: 90, color: AppTheme.primary),
          const Text(
            'อนุญาตกล้องและตำแหน่ง',
            style: TextStyle(fontSize: 23, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 12),
          const Text(
            'ระบบใช้กล้องสำหรับแนบหลักฐาน ใช้ตำแหน่งเพื่อส่งพิกัดที่แม่นยำ และใช้การแจ้งเตือนเมื่อสถานะเปลี่ยนแปลง',
            textAlign: TextAlign.center,
            style: TextStyle(height: 1.6),
          ),
          const Spacer(),
          GradientButton(label: 'ตรวจสอบและอนุญาต', onPressed: request),
        ],
      ),
    ),
  );
}
