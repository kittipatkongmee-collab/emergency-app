import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class Environment {
  static const name = String.fromEnvironment(
    'APP_ENV',
    defaultValue: 'development',
  );
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000/api/v1',
  );
  static const socketUrl = String.fromEnvironment(
    'SOCKET_URL',
    defaultValue: 'http://10.0.2.2:3000',
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
}

class AppTheme {
  static const primary = Color(0xFF8F0010);
  static const primaryDark = Color(0xFF4B0007);
  static const primaryLight = Color(0xFFF8E7E9);
  static const danger = Color(0xFFC31525);
  static const warning = Color(0xFFD97900);
  static const success = Color(0xFF17834E);
  static const background = Color(0xFFF7F7F8);
  static const surface = Colors.white;
  static const textPrimary = Color(0xFF271D1F);
  static const textSecondary = Color(0xFF746A6C);
  static const borderColor = Color(0xFFE8DFE1);
  static const borderRadius = 20.0;
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
    ),
    cardTheme: const CardThemeData(
      color: surface,
      elevation: 2,
      shadowColor: Color(0x16000000),
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
        ),
      ) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await storage.read(key: 'accessToken');
          if (token != null) options.headers['Authorization'] = 'Bearer $token';
          handler.next(options);
        },
        onError: (error, handler) {
          final data = error.response?.data;
          final apiError = data is Map ? data['error'] : null;
          final message = apiError is Map
              ? apiError['message'] ?? 'ไม่สามารถเชื่อมต่อระบบได้'
              : 'ไม่สามารถเชื่อมต่อระบบได้';
          handler.next(error.copyWith(error: message));
        },
      ),
    );
  }
  final FlutterSecureStorage storage;
  final Dio dio;
  T data<T>(Response<dynamic> response) =>
      (response.data as Map<String, dynamic>)['data'] as T;
}

final secureStorageProvider = Provider((_) => const FlutterSecureStorage());
final apiClientProvider = Provider(
  (ref) => ApiClient(ref.watch(secureStorageProvider)),
);

class GradientButton extends StatelessWidget {
  const GradientButton({
    required this.label,
    required this.onPressed,
    this.icon,
    this.busy = false,
    super.key,
  });
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool busy;
  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [Color(0xFFB10017), Color(0xFF680008)],
      ),
      borderRadius: BorderRadius.circular(14),
      boxShadow: const [
        BoxShadow(
          color: Color(0x308F0010),
          blurRadius: 14,
          offset: Offset(0, 7),
        ),
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
          : Icon(icon ?? Icons.arrow_forward_rounded),
      label: Text(busy ? 'กำลังดำเนินการ…' : label),
    ),
  );
}

class LogoPlaceholder extends StatelessWidget {
  const LogoPlaceholder({this.size = 120, super.key});
  final double size;
  @override
  Widget build(BuildContext context) => Semantics(
    label: 'ตำแหน่งโลโก้กองบินตำรวจ รอไฟล์ต้นฉบับที่อนุมัติ',
    child: Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: const Color(0xFF130003),
        border: Border.all(color: const Color(0xFFD4001B), width: 3),
        borderRadius: BorderRadius.circular(size * .28),
      ),
      child: const Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.flight, color: Color(0xFFFFD21F), size: 42),
          Text(
            'TPAD',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    ),
  );
}

String thaiError(Object error) => error is DioException
    ? (error.error?.toString() ?? 'ไม่สามารถเชื่อมต่อระบบได้')
    : 'เกิดข้อผิดพลาด กรุณาลองใหม่';
