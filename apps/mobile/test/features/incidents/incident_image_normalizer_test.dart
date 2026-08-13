import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as image_lib;
import 'package:police_incident_mobile/features/incidents/incident_image_normalizer.dart';

void main() {
  test('bakes EXIF orientation into the JPEG pixels', () {
    final source = image_lib.Image(width: 40, height: 20)
      ..exif.imageIfd.orientation = 6;
    image_lib.fill(source, color: image_lib.ColorRgb8(240, 20, 20));

    final result = image_lib.decodeJpg(
      normalizeIncidentImageBytes(
        Uint8List.fromList(image_lib.encodeJpg(source, quality: 100)),
      ),
    );

    expect(result, isNotNull);
    expect(result!.width, 20);
    expect(result.height, 40);
    expect(result.exif.imageIfd.hasOrientation, isFalse);
  });

  test('resizes the longest side to 2048 pixels', () {
    final source = image_lib.Image(width: 2600, height: 1300);
    image_lib.fill(source, color: image_lib.ColorRgb8(20, 40, 80));

    final result = image_lib.decodeJpg(
      normalizeIncidentImageBytes(
        Uint8List.fromList(image_lib.encodeJpg(source, quality: 90)),
      ),
    );

    expect(result, isNotNull);
    expect(result!.width, 2048);
    expect(result.height, 1024);
  });

  test('rejects data that is not an image', () {
    expect(
      () => normalizeIncidentImageBytes(Uint8List.fromList([1, 2, 3])),
      throwsFormatException,
    );
  });
}
