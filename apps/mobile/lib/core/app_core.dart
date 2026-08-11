import 'dart:async';
import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_gateway_cookie_interceptor.dart';

class AppCopy {
  static const unitName =
      'หน่วยค้นหาและช่วยเหลืออากาศยานและเรือที่ประสบภัย กองบินตำรวจ(SRU)';
  static const unitNameMultiline =
      'หน่วยค้นหาและช่วยเหลืออากาศยาน\nและเรือที่ประสบภัย กองบินตำรวจ(SRU)';
}

class Environment {
  static const name = String.fromEnvironment(
    'APP_ENV',
    defaultValue: 'development',
  );
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000/api/v1',
  );
  static const firebaseRealtimeEnabled = bool.fromEnvironment(
    'FIREBASE_REALTIME_ENABLED',
    defaultValue: false,
  );
  static const mapsEnabled = bool.fromEnvironment(
    'MAPS_ENABLED',
    defaultValue: false,
  );
  static const fcmEnabled = bool.fromEnvironment(
    'FCM_ENABLED',
    defaultValue: false,
  );
  static const devAuthBypass = bool.fromEnvironment(
    'DEV_AUTH_BYPASS',
    defaultValue: false,
  );
  static const facebookLoginEnabled = bool.fromEnvironment(
    'FACEBOOK_LOGIN_ENABLED',
    defaultValue: false,
  );
  static const lineLoginEnabled = bool.fromEnvironment(
    'LINE_LOGIN_ENABLED',
    defaultValue: false,
  );
  static const lineChannelId = String.fromEnvironment('LINE_CHANNEL_ID');
  static const lineEmailScopeEnabled = bool.fromEnvironment(
    'LINE_EMAIL_SCOPE_ENABLED',
    defaultValue: false,
  );

  static bool get lineLoginConfigured =>
      lineLoginEnabled && lineChannelId.trim().isNotEmpty;
}

class AppTheme {
  static const primary = Color(0xFF97000F);
  static const primaryDark = Color(0xFF4A0007);
  static const primaryLight = Color(0xFFF9E9EB);
  static const gold = Color(0xFFFFD429);
  static const danger = Color(0xFFC31525);
  static const warning = Color(0xFFD97900);
  static const success = Color(0xFF17834E);
  static const background = Color(0xFFFAFAFB);
  static const surface = Colors.white;
  static const textPrimary = Color(0xFF271D1F);
  static const textSecondary = Color(0xFF746A6C);
  static const borderColor = Color(0xFFE8DFE1);
  static const borderRadius = 22.0;
  static const spacing = 8.0;
  static final light = ThemeData(
    useMaterial3: true,
    fontFamily: 'Sarabun',
    scaffoldBackgroundColor: background,
    colorScheme: ColorScheme.fromSeed(
      seedColor: primary,
      primary: primary,
      surface: surface,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: surface,
      foregroundColor: primaryDark,
      centerTitle: true,
      elevation: 0,
      scrolledUnderElevation: 1,
      titleTextStyle: TextStyle(
        color: primaryDark,
        fontSize: 22,
        fontWeight: FontWeight.w700,
        fontFamily: 'Sarabun',
      ),
    ),
    cardTheme: const CardThemeData(
      color: surface,
      elevation: 4,
      shadowColor: Color(0x1A4A0007),
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(borderRadius)),
      ),
    ),
    inputDecorationTheme: const InputDecorationTheme(
      filled: true,
      fillColor: surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(14)),
        borderSide: BorderSide(color: borderColor),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(14)),
        borderSide: BorderSide(color: borderColor),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(54),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
      ),
    ),
  );
}

class ApiClient {
  ApiClient(this.storage)
    : dio = Dio(
        BaseOptions(
          baseUrl: Environment.apiBaseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 20),
          followRedirects: false,
        ),
      ) {
    dio.interceptors.add(ApiGatewayCookieInterceptor(dio));
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await storage.read(key: 'accessToken');
          if (token != null) options.headers['Authorization'] = 'Bearer $token';
          handler.next(options);
        },
        onError: (error, handler) async {
          if (error.response?.statusCode == 401 &&
              error.requestOptions.extra['retriedAfterRefresh'] != true &&
              !error.requestOptions.path.contains('/auth/refresh')) {
            final refreshed = await _refresh();
            if (refreshed) {
              try {
                final token = await storage.read(key: 'accessToken');
                final options = error.requestOptions;
                options.extra['retriedAfterRefresh'] = true;
                options.headers['Authorization'] = 'Bearer $token';
                return handler.resolve(await dio.fetch<dynamic>(options));
              } catch (_) {
                await storage.deleteAll();
              }
            }
          }
          final data = error.response?.data;
          final apiError = data is Map ? data['error'] : null;
          final code = apiError is Map ? apiError['code']?.toString() : null;
          final message = code == null
              ? 'ไม่สามารถเชื่อมต่อระบบได้'
              : _thaiMessage(code, apiError?['message']?.toString());
          handler.next(error.copyWith(error: message));
        },
      ),
    );
  }
  final FlutterSecureStorage storage;
  final Dio dio;
  Future<bool>? _refreshing;

  Future<bool> _refresh() {
    return _refreshing ??= _performRefresh().whenComplete(
      () => _refreshing = null,
    );
  }

  Future<bool> _performRefresh() async {
    final refreshToken = await storage.read(key: 'refreshToken');
    if (refreshToken == null) return false;
    try {
      final response = await Dio(
        BaseOptions(baseUrl: Environment.apiBaseUrl),
      ).post<dynamic>('/auth/refresh', data: {'refreshToken': refreshToken});
      final tokens =
          (response.data as Map<String, dynamic>)['data']
              as Map<String, dynamic>;
      await storage.write(
        key: 'accessToken',
        value: tokens['accessToken'] as String,
      );
      await storage.write(
        key: 'refreshToken',
        value: tokens['refreshToken'] as String,
      );
      return true;
    } catch (_) {
      await storage.deleteAll();
      return false;
    }
  }

  String _thaiMessage(String code, String? fallback) {
    const messages = {
      'INVALID_CREDENTIALS': 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง',
      'ACCOUNT_DISABLED': 'บัญชีนี้ถูกระงับการใช้งาน',
      'TOKEN_EXPIRED': 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
      'TOKEN_REVOKED': 'เซสชันถูกยกเลิก กรุณาเข้าสู่ระบบใหม่',
      'FACEBOOK_LOGIN_NOT_CONFIGURED':
          'ยังไม่ได้ตั้งค่าการเข้าสู่ระบบด้วย Facebook',
      'LINE_LOGIN_NOT_CONFIGURED': 'ยังไม่ได้ตั้งค่าการเข้าสู่ระบบด้วย LINE',
      'LINE_TOKEN_INVALID': 'ข้อมูลเข้าสู่ระบบ LINE ไม่ถูกต้องหรือหมดอายุ',
      'LINE_SERVICE_UNAVAILABLE':
          'ไม่สามารถตรวจสอบบัญชี LINE ได้ในขณะนี้ กรุณาลองใหม่',
      'INCIDENT_NOT_FOUND': 'ไม่พบข้อมูลเหตุการณ์',
      'INCIDENT_ACCESS_DENIED': 'คุณไม่มีสิทธิ์เปิดเหตุการณ์นี้',
      'FILE_TOO_LARGE': 'รูปภาพมีขนาดใหญ่เกินกำหนด',
      'FILE_TYPE_NOT_ALLOWED': 'ชนิดรูปภาพไม่รองรับ',
      'FILE_LIMIT_EXCEEDED': 'จำนวนรูปภาพเกินกำหนด',
    };
    return messages[code] ?? fallback ?? 'ไม่สามารถดำเนินการได้';
  }

  T data<T>(Response<dynamic> response) =>
      (response.data as Map<String, dynamic>)['data'] as T;

  String mediaUrl(String value) {
    if (Uri.tryParse(value)?.hasAbsolutePath == true &&
        Uri.parse(value).hasScheme) {
      return value;
    }
    final base = Uri.parse(Environment.apiBaseUrl);
    return base
        .replace(path: value.startsWith('/') ? value : '/$value')
        .toString();
  }
}

final secureStorageProvider = Provider((_) => const FlutterSecureStorage());
final apiClientProvider = Provider(
  (ref) => ApiClient(ref.watch(secureStorageProvider)),
);

class RealtimeEvent {
  const RealtimeEvent({required this.eventId, required this.type});

  final String eventId;
  final String type;
}

class FirebaseRealtimeService {
  FirebaseRealtimeService(this.apiClient);

  final ApiClient apiClient;
  final _events = StreamController<RealtimeEvent>.broadcast();
  final _seenEventIds = <String>{};
  final _subscriptions = <StreamSubscription<DatabaseEvent>>[];
  Future<void>? _connecting;

  Stream<RealtimeEvent> get events => _events.stream;

  Future<void> connect() {
    if (!Environment.firebaseRealtimeEnabled) return Future<void>.value();
    return _connecting ??= _connect().whenComplete(() => _connecting = null);
  }

  Future<void> _connect() async {
    final response = await apiClient.dio.post<dynamic>('/realtime/token');
    final data = apiClient.data<Map<String, dynamic>>(response);
    final credential = await FirebaseAuth.instance.signInWithCustomToken(
      data['customToken'] as String,
    );
    final user = credential.user;
    if (user == null) throw StateError('Firebase authentication failed');

    await _cancelSubscriptions();
    _subscriptions.add(
      FirebaseDatabase.instance.ref('.info/connected').onValue.listen((event) {
        if (event.snapshot.value == true) {
          _events.add(const RealtimeEvent(eventId: 'reconnect', type: 'realtime.resync'));
        }
      }),
    );
    _watch('channels/users/${user.uid}');
  }

  void _watch(String path) {
    _subscriptions.add(
      FirebaseDatabase.instance.ref(path).onValue.listen((event) {
        final value = event.snapshot.value;
        if (value is! Map) return;
        final eventId = value['eventId'];
        final type = value['type'];
        if (eventId is! String || type is! String || _seenEventIds.contains(eventId)) return;
        _seenEventIds.add(eventId);
        if (_seenEventIds.length > 100) {
          _seenEventIds
            ..clear()
            ..add(eventId);
        }
        _events.add(RealtimeEvent(eventId: eventId, type: type));
      }),
    );
  }

  Future<void> disconnect() async {
    await _cancelSubscriptions();
    _seenEventIds.clear();
    if (Environment.firebaseRealtimeEnabled) await FirebaseAuth.instance.signOut();
  }

  Future<void> _cancelSubscriptions() async {
    final pending = _subscriptions.map((subscription) => subscription.cancel()).toList();
    _subscriptions.clear();
    await Future.wait(pending);
  }
}

final firebaseRealtimeProvider = Provider(
  (ref) => FirebaseRealtimeService(ref.watch(apiClientProvider)),
);

class GradientButton extends StatelessWidget {
  const GradientButton({
    required this.label,
    required this.onPressed,
    this.icon,
    this.iconWidget,
    this.colors = const [Color(0xFFB10017), Color(0xFF680008)],
    this.shadowColor = const Color(0x308F0010),
    this.busy = false,
    super.key,
  });
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final Widget? iconWidget;
  final List<Color> colors;
  final Color shadowColor;
  final bool busy;
  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      gradient: LinearGradient(colors: colors),
      borderRadius: BorderRadius.circular(14),
      boxShadow: [
        BoxShadow(color: shadowColor, blurRadius: 14, offset: Offset(0, 7)),
      ],
    ),
    child: FilledButton.icon(
      onPressed: busy ? null : onPressed,
      style: FilledButton.styleFrom(
        backgroundColor: Colors.transparent,
        shadowColor: Colors.transparent,
      ),
      icon: busy
          ? const SizedBox.square(
              dimension: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.white,
              ),
            )
          : iconWidget ?? Icon(icon ?? Icons.arrow_forward_rounded),
      label: FittedBox(
        fit: BoxFit.scaleDown,
        child: Text(
          busy ? 'กำลังดำเนินการ…' : label,
          maxLines: 1,
          softWrap: false,
        ),
      ),
    ),
  );
}

class PoliceAviationLogo extends StatelessWidget {
  const PoliceAviationLogo({this.size = 120, super.key});
  final double size;

  @override
  Widget build(BuildContext context) => SizedBox.square(
    dimension: size,
    child: Image.asset(
      'assets/images/police-aviation-logo.png',
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
      semanticLabel:
          'โลโก้หน่วยค้นหาและช่วยเหลืออากาศยานและเรือที่ประสบภัย กองบินตำรวจ(SRU)',
    ),
  );
}

class BrandedAppBarTitle extends StatelessWidget {
  const BrandedAppBarTitle(this.title, {super.key});
  final String title;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Flexible(child: Text(title, overflow: TextOverflow.ellipsis)),
      const SizedBox(width: 10),
      const PoliceAviationLogo(size: 44),
    ],
  );
}

String thaiError(Object error) => error is DioException
    ? (error.error?.toString() ?? 'ไม่สามารถเชื่อมต่อระบบได้')
    : 'เกิดข้อผิดพลาด กรุณาลองใหม่';
