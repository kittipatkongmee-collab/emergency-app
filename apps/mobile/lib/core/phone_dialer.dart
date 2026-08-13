import 'package:url_launcher/url_launcher.dart';

abstract interface class PhoneDialer {
  Future<bool> open(Uri phoneUri);
}

final class SystemPhoneDialer implements PhoneDialer {
  const SystemPhoneDialer();

  @override
  Future<bool> open(Uri phoneUri) =>
      launchUrl(phoneUri, mode: LaunchMode.externalApplication);
}

Uri? createPhoneUri(String phone) {
  final trimmed = phone.trim();
  final digits = trimmed.replaceAll(RegExp(r'\D'), '');
  if (digits.isEmpty) return null;

  final normalized = trimmed.startsWith('+') ? '+$digits' : digits;
  return Uri(scheme: 'tel', path: normalized);
}
