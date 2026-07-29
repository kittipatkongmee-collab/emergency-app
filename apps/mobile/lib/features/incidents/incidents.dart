import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:permission_handler/permission_handler.dart' as permissions;
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../../core/app_core.dart';

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
  factory Incident.fromJson(Map<String, dynamic> j) => Incident(
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
  Future<List<Incident>> mine() async {
    final r = await api.dio.get('/incidents/me');
    return ((r.data as Map)['data'] as List)
        .map((e) => Incident.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Incident> detail(String id) async {
    final r = await api.dio.get('/incidents/$id');
    return Incident.fromJson((r.data as Map)['data'] as Map<String, dynamic>);
  }

  Future<Incident> create(ReportDraft d) async {
    final r = await api.dio.post('/incidents', data: d.toJson());
    final item = Incident.fromJson(
      (r.data as Map)['data'] as Map<String, dynamic>,
    );
    if (d.images.isNotEmpty) {
      final form = FormData();
      for (final image in d.images) {
        form.files.add(
          MapEntry(
            'files',
            await MultipartFile.fromFile(image.path, filename: image.name),
          ),
        );
      }
      await api.dio.post('/incidents/${item.id}/images', data: form);
    }
    return detail(item.id);
  }
}

final incidentRepositoryProvider = Provider(
  (ref) => IncidentRepository(ref.watch(apiClientProvider)),
);
final incidentsProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(incidentRepositoryProvider).mine(),
);

class ReportDraft {
  const ReportDraft({
    this.images = const [],
    this.reporterName = '',
    this.reporterPhone = '',
    this.type = 'ACCIDENT',
    this.description = '',
    this.latitude = 13.9126,
    this.longitude = 100.6068,
    this.address = 'ถนนวิภาวดีรังสิต เขตดอนเมือง กรุงเทพมหานคร',
  });
  final List<XFile> images;
  final String reporterName, reporterPhone, type, description, address;
  final double latitude, longitude;
  ReportDraft copyWith({
    List<XFile>? images,
    String? reporterName,
    String? reporterPhone,
    String? type,
    String? description,
    double? latitude,
    double? longitude,
    String? address,
  }) => ReportDraft(
    images: images ?? this.images,
    reporterName: reporterName ?? this.reporterName,
    reporterPhone: reporterPhone ?? this.reporterPhone,
    type: type ?? this.type,
    description: description ?? this.description,
    latitude: latitude ?? this.latitude,
    longitude: longitude ?? this.longitude,
    address: address ?? this.address,
  );
  Map<String, dynamic> toJson() => {
    'reporterName': reporterName,
    'reporterPhone': reporterPhone,
    'type': type,
    'description': description,
    'latitude': latitude.toStringAsFixed(7),
    'longitude': longitude.toStringAsFixed(7),
    'address': address,
    'province': 'กรุงเทพมหานคร',
    'priority': 'NORMAL',
  };
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
      appBar: AppBar(title: const Text('แจ้งเหตุ')),
      body: SafeArea(
        child: Form(
          key: formKey,
          child: ListView(
            padding: const EdgeInsets.all(18),
            children: [
              const Text(
                'ขั้นตอนที่ 1 จาก 3',
                style: TextStyle(
                  color: AppTheme.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'ข้อมูลเหตุการณ์',
                style: TextStyle(
                  fontSize: 25,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.primaryDark,
                ),
              ),
              const SizedBox(height: 16),
              _photoSection(draft),
              const SizedBox(height: 14),
              _detailsSection(draft),
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
          const Text(
            'ภาพถ่ายเหตุการณ์',
            style: TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w700,
              color: AppTheme.primaryDark,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              border: Border.all(
                color: AppTheme.primary.withValues(alpha: .35),
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
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
                const Text('แตะเพื่อถ่ายภาพ หรือเลือกจากแกลเลอรี'),
                const Text(
                  'JPG, PNG ไม่เกิน 10 MB · สูงสุด 5 รูป',
                  style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  children: [
                    OutlinedButton.icon(
                      onPressed: () => pick(ImageSource.camera),
                      icon: const Icon(Icons.camera_alt),
                      label: const Text('กล้อง'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => pick(ImageSource.gallery),
                      icon: const Icon(Icons.photo_library),
                      label: const Text('แกลเลอรี'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (draft.images.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: SizedBox(
                height: 90,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: draft.images.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, index) => Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.file(
                          File(draft.images[index].path),
                          width: 90,
                          height: 90,
                          fit: BoxFit.cover,
                        ),
                      ),
                      Positioned(
                        right: 2,
                        top: 2,
                        child: InkWell(
                          onTap: () => ref
                              .read(reportDraftProvider.notifier)
                              .update(
                                draft.copyWith(
                                  images: [...draft.images]..removeAt(index),
                                ),
                              ),
                          child: const CircleAvatar(
                            radius: 12,
                            backgroundColor: Colors.black54,
                            child: Icon(
                              Icons.close,
                              size: 15,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    ),
  );

  Widget _detailsSection(ReportDraft draft) => Card(
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'ข้อมูลผู้แจ้งและรายละเอียด',
            style: TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w700,
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
          DropdownButtonFormField<String>(
            initialValue: draft.type,
            decoration: const InputDecoration(labelText: 'ประเภทเหตุการณ์'),
            items: const [
              DropdownMenuItem(value: 'ACCIDENT', child: Text('อุบัติเหตุ')),
              DropdownMenuItem(value: 'FIRE', child: Text('ไฟไหม้')),
              DropdownMenuItem(
                value: 'MISSING_PERSON',
                child: Text('บุคคลสูญหาย'),
              ),
              DropdownMenuItem(
                value: 'OBSTRUCTION',
                child: Text('สิ่งกีดขวาง'),
              ),
              DropdownMenuItem(
                value: 'SUSPICIOUS',
                child: Text('เหตุต้องสงสัย'),
              ),
              DropdownMenuItem(value: 'OTHER', child: Text('อื่น ๆ')),
            ],
            onChanged: (value) => ref
                .read(reportDraftProvider.notifier)
                .update(draft.copyWith(type: value)),
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

class _LocationScreenState extends ConsumerState<LocationScreen> {
  late LatLng selected;
  late TextEditingController address;
  bool locating = false;
  @override
  void initState() {
    super.initState();
    final d = ref.read(reportDraftProvider);
    selected = LatLng(d.latitude, d.longitude);
    address = TextEditingController(text: d.address);
  }

  @override
  void dispose() {
    address.dispose();
    super.dispose();
  }

  Future<void> current() async {
    setState(() => locating = true);
    try {
      if (!await Geolocator.isLocationServiceEnabled())
        throw Exception('กรุณาเปิดบริการตำแหน่ง');
      var p = await Geolocator.checkPermission();
      if (p == LocationPermission.denied)
        p = await Geolocator.requestPermission();
      if (p == LocationPermission.denied ||
          p == LocationPermission.deniedForever)
        throw Exception('ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง');
      final pos = await Geolocator.getCurrentPosition();
      setState(() => selected = LatLng(pos.latitude, pos.longitude));
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
    } finally {
      if (mounted) setState(() => locating = false);
    }
  }

  void confirm() {
    if (address.text.trim().length < 3) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('กรุณาระบุที่อยู่หรือจุดสังเกต')),
      );
      return;
    }
    final d = ref.read(reportDraftProvider);
    ref
        .read(reportDraftProvider.notifier)
        .update(
          d.copyWith(
            latitude: selected.latitude,
            longitude: selected.longitude,
            address: address.text.trim(),
          ),
        );
    context.push('/review');
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('ระบุตำแหน่งเหตุการณ์')),
    body: SafeArea(
      child: Column(
        children: [
          Expanded(
            child: Environment.mapsEnabled
                ? GoogleMap(
                    initialCameraPosition: CameraPosition(
                      target: selected,
                      zoom: 15,
                    ),
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
                : Container(
                    width: double.infinity,
                    color: const Color(0xFFE9EDF0),
                    child: Stack(
                      children: [
                        CustomPaint(
                          size: Size.infinite,
                          painter: _MapGridPainter(),
                        ),
                        Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.location_pin,
                                color: AppTheme.primary,
                                size: 70,
                              ),
                              Text(
                                '${selected.latitude.toStringAsFixed(6)}, ${selected.longitude.toStringAsFixed(6)}',
                              ),
                              const Text(
                                'กำหนด MAPS_ENABLED=true เมื่อใส่ Google Maps Key',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: AppTheme.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
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
                  const Text(
                    'ตำแหน่งที่เลือก',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.primaryDark,
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: address,
                    decoration: const InputDecoration(
                      labelText: 'ที่อยู่หรือจุดสังเกต',
                      prefixIcon: Icon(Icons.search),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'ละติจูด ${selected.latitude.toStringAsFixed(7)}  ·  ลองจิจูด ${selected.longitude.toStringAsFixed(7)}',
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
                    _ReviewRow('ประเภท', d.type),
                    _ReviewRow('รายละเอียด', d.description),
                    _ReviewRow('ตำแหน่ง', d.address),
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
    socket!.connect();
  }

  @override
  void dispose() {
    socket?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('ติดตามสถานะ')),
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
  static const steps = [
    'RECEIVED',
    'FORWARDED',
    'INSPECTING',
    'IN_PROGRESS',
    'COMPLETED',
  ];
  static const labels = {
    'RECEIVED': 'รับแจ้งเหตุแล้ว',
    'FORWARDED': 'ส่งต่อเจ้าหน้าที่',
    'INSPECTING': 'กำลังเข้าตรวจสอบ',
    'IN_PROGRESS': 'กำลังดำเนินการ',
    'COMPLETED': 'เสร็จสิ้น',
  };
  @override
  Widget build(BuildContext context) {
    final current = steps.indexOf(incident.status);
    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                      child: SelectableText(
                        incident.caseCode,
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.primary,
                        ),
                      ),
                    ),
                    Chip(
                      label: Text(labels[incident.status] ?? incident.status),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  incident.description,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  DateFormat(
                    'd MMM yyyy · HH:mm',
                    'th',
                  ).format(DateTime.parse(incident.reportedAt).toLocal()),
                  style: const TextStyle(color: AppTheme.textSecondary),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'ความคืบหน้าของเหตุ',
                  style: TextStyle(
                    fontSize: 21,
                    fontWeight: FontWeight.w700,
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
            leading: const CircleAvatar(
              backgroundColor: AppTheme.primaryLight,
              child: Icon(Icons.location_pin, color: AppTheme.primary),
            ),
            title: const Text('สถานที่เกิดเหตุ'),
            subtitle: Text(incident.address),
          ),
        ),
        const SizedBox(height: 14),
        FilledButton.icon(
          onPressed: () => launchPhone(context, incident.reporterPhone),
          icon: const Icon(Icons.phone),
          label: const Text('ติดต่อเจ้าหน้าที่'),
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

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(title: const Text('การแจ้งเตือน')),
    body: FutureBuilder<Response<dynamic>>(
      future: ref.read(apiClientProvider).dio.get('/notifications'),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done)
          return const Center(child: CircularProgressIndicator());
        if (snapshot.hasError)
          return const Center(child: Text('ไม่สามารถโหลดการแจ้งเตือนได้'));
        final data = ((snapshot.data!.data as Map)['data'] as List);
        if (data.isEmpty)
          return const Center(child: Text('ยังไม่มีการแจ้งเตือน'));
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: data.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (_, i) {
            final n = data[i] as Map;
            return Card(
              child: ListTile(
                leading: const CircleAvatar(
                  backgroundColor: AppTheme.primaryLight,
                  child: Icon(Icons.notifications, color: AppTheme.primary),
                ),
                title: Text(n['title'].toString()),
                subtitle: Text(n['message'].toString()),
              ),
            );
          },
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
