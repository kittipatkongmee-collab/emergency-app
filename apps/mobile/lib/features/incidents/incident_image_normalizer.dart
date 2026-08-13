import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:image/image.dart' as image_lib;
import 'package:image_picker/image_picker.dart';

const int _maxImageDimension = 2048;
const int _jpegQuality = 82;

Future<XFile> normalizeIncidentImage(XFile source) async {
  final bytes = await source.readAsBytes();
  final normalizedBytes = await compute(_normalizeImageBytes, bytes);
  final directory = await Directory.systemTemp.createTemp('incident-image-');
  final random = Random.secure().nextInt(0x7fffffff).toRadixString(16);
  final path =
      '${directory.path}/incident-${DateTime.now().microsecondsSinceEpoch}-$random.jpg';
  final file = File(path);
  await file.writeAsBytes(normalizedBytes, flush: true);
  return XFile(
    path,
    name: path.split(Platform.pathSeparator).last,
    mimeType: 'image/jpeg',
  );
}

@visibleForTesting
Uint8List normalizeIncidentImageBytes(Uint8List bytes) =>
    _normalizeImageBytes(bytes);

Uint8List _normalizeImageBytes(Uint8List bytes) {
  image_lib.Image? decoded;
  try {
    decoded = image_lib.decodeImage(bytes);
  } catch (_) {
    throw const FormatException('Unsupported image data');
  }
  if (decoded == null) {
    throw const FormatException('Unsupported image data');
  }

  var normalized = image_lib.bakeOrientation(decoded);
  final longestSide = max(normalized.width, normalized.height);
  if (longestSide > _maxImageDimension) {
    final scale = _maxImageDimension / longestSide;
    normalized = image_lib.copyResize(
      normalized,
      width: max(1, (normalized.width * scale).round()),
      height: max(1, (normalized.height * scale).round()),
      interpolation: image_lib.Interpolation.cubic,
    );
  }

  normalized.exif.clear();
  return Uint8List.fromList(
    image_lib.encodeJpg(normalized, quality: _jpegQuality),
  );
}
