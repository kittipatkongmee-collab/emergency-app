import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:police_incident_mobile/core/app_core.dart';
import 'package:police_incident_mobile/features/incidents/incidents.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('creates the incident and image in one API request', () async {
    FlutterSecureStorage.setMockInitialValues({});
    final adapter = _IncidentAdapter();
    final api = ApiClient(const FlutterSecureStorage());
    api.dio.httpClientAdapter = adapter;
    final repository = IncidentRepository(api);

    final incident = await repository.create(
      ReportDraft(
        images: [XFile('assets/images/bell-429-global-ranger.jpg')],
        reporterName: 'ผู้ทดสอบระบบ',
        reporterPhone: '0812345678',
        description: 'รายละเอียดเหตุการณ์สำหรับทดสอบระบบอัปโหลดรูปภาพ',
        latitude: 13.7563,
        longitude: 100.5018,
        address: 'กรุงเทพมหานคร',
        locationSelected: true,
      ),
    );

    expect(adapter.createRequests, 1);
    expect(adapter.sentBase64Json, isTrue);
    expect(incident.images, hasLength(1));
  });
}

Map<String, dynamic> _incidentJson({
  required List<Map<String, dynamic>> images,
}) {
  return {
    'success': true,
    'data': {
      'id': 'incident-id',
      'caseCode': 'CASE-2026-00001',
      'reporterName': 'ผู้ทดสอบระบบ',
      'reporterPhone': '0812345678',
      'type': 'AIRCRAFT_ACCIDENT',
      'description': 'รายละเอียดเหตุการณ์สำหรับทดสอบระบบอัปโหลดรูปภาพ',
      'latitude': '13.7563000',
      'longitude': '100.5018000',
      'address': 'กรุงเทพมหานคร',
      'status': 'RECEIVED',
      'reportedAt': '2026-08-11T14:00:00Z',
      'images': images,
      'statusHistory': <Map<String, dynamic>>[],
    },
  };
}

Map<String, dynamic> _imageJson() => {
  'id': 'image-id',
  'imageUrl': '/image_emer/2026/08/incident.jpg',
};

final class _IncidentAdapter implements HttpClientAdapter {
  var createRequests = 0;
  var sentBase64Json = false;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    await requestStream?.drain<void>();
    final path = options.uri.path.replaceFirst('/api/v1', '');

    if (options.method == 'POST' && path == '/incidents') {
      createRequests += 1;
      final body = options.data as Map<String, dynamic>;
      final images = body['images'] as List<dynamic>;
      final image = images.single as Map<String, dynamic>;
      expect(image['fileName'], endsWith('.jpg'));
      expect(base64Decode(image['contentBase64'] as String), isNotEmpty);
      sentBase64Json = true;
      return _json(_incidentJson(images: [_imageJson()]), 201);
    }
    return _json({'success': false}, 404);
  }

  ResponseBody _json(Map<String, dynamic> body, int statusCode) {
    return ResponseBody.fromString(
      jsonEncode(body),
      statusCode,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}
