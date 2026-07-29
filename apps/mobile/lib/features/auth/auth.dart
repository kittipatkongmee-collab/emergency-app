import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/app_core.dart';

class AuthController extends StateNotifier<AsyncValue<bool>> {
  AuthController(this.ref) : super(const AsyncData(false));
  final Ref ref;
  Future<bool> restore() async {
    final token = await ref
        .read(secureStorageProvider)
        .read(key: 'accessToken');
    state = AsyncData(token != null);
    return token != null;
  }

  Future<void> login() async {
    state = const AsyncLoading();
    try {
      String providerToken;
      if (Environment.name == 'development' && Environment.devAuthBypass) {
        providerToken = 'dev-citizen-mobile';
      } else {
        final result = await FacebookAuth.instance.login(
          permissions: ['public_profile', 'email'],
        );
        if (result.status != LoginStatus.success || result.accessToken == null)
          throw Exception('ยกเลิกการเข้าสู่ระบบ');
        providerToken = result.accessToken!.tokenString;
      }
      final response = await ref
          .read(apiClientProvider)
          .dio
          .post(
            '/auth/facebook',
            data: {
              'accessToken': providerToken,
              'fullName': 'ผู้ใช้งานกองบินตำรวจ',
            },
          );
      final tokens =
          (response.data as Map<String, dynamic>)['data']
              as Map<String, dynamic>;
      final storage = ref.read(secureStorageProvider);
      await storage.write(
        key: 'accessToken',
        value: tokens['accessToken'] as String,
      );
      await storage.write(
        key: 'refreshToken',
        value: tokens['refreshToken'] as String,
      );
      if (Environment.fcmEnabled) {
        final deviceToken = await FirebaseMessaging.instance.getToken();
        if (deviceToken != null) {
          await ref
              .read(apiClientProvider)
              .dio
              .post(
                '/devices/register',
                data: {
                  'token': deviceToken,
                  'platform': Platform.isIOS ? 'IOS' : 'ANDROID',
                },
              );
        }
      }
      state = const AsyncData(true);
    } catch (error, stack) {
      state = AsyncError(error, stack);
    }
  }

  Future<void> logout() async {
    await ref.read(secureStorageProvider).deleteAll();
    await FacebookAuth.instance.logOut();
    state = const AsyncData(false);
  }
}

final authProvider = StateNotifierProvider<AuthController, AsyncValue<bool>>(
  (ref) => AuthController(ref),
);

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});
  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Future<void>.delayed(const Duration(milliseconds: 900), () async {
      final signedIn = await ref.read(authProvider.notifier).restore();
      if (mounted) context.go(signedIn ? '/home' : '/login');
    });
  }

  @override
  Widget build(BuildContext context) => const Scaffold(
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          LogoPlaceholder(size: 150),
          SizedBox(height: 28),
          Text(
            'ทีมค้นหาและช่วยเหลือทางอากาศ บ.ตร.',
            style: TextStyle(
              fontSize: 20,
              color: AppTheme.primaryDark,
              fontWeight: FontWeight.w700,
            ),
          ),
          SizedBox(height: 8),
          Text('ระบบแจ้งเหตุและติดตามสถานะเหตุฉุกเฉิน'),
          SizedBox(height: 30),
          CircularProgressIndicator(),
        ],
      ),
    ),
  );
}

class LoginScreen extends ConsumerWidget {
  const LoginScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen(authProvider, (_, next) {
      if (next.value == true) context.go('/home');
    });
    final auth = ref.watch(authProvider);
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(26),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: MediaQuery.sizeOf(context).height - 80,
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text(
                  'ทีมค้นหาและช่วยเหลือทางอากาศ บ.ตร.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 25,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.primaryDark,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'ระบบแจ้งเหตุและติดตามสถานะเหตุฉุกเฉิน',
                  style: TextStyle(color: AppTheme.textSecondary),
                ),
                const SizedBox(height: 25),
                const LogoPlaceholder(size: 170),
                const SizedBox(height: 30),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(18),
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            color: AppTheme.primaryLight,
                          ),
                          child: const Icon(
                            Icons.shield_outlined,
                            color: AppTheme.primary,
                            size: 46,
                          ),
                        ),
                        const SizedBox(height: 16),
                        const Text(
                          'เข้าสู่ระบบก่อนแจ้งเหตุ',
                          style: TextStyle(
                            fontSize: 23,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.primaryDark,
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'เพื่อความปลอดภัยของข้อมูลและสามารถติดตามสถานะเหตุได้อย่างครบถ้วน',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            height: 1.6,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                GradientButton(
                  label: 'เข้าสู่ระบบด้วย Facebook',
                  icon: Icons.facebook,
                  busy: auth.isLoading,
                  onPressed: () => ref.read(authProvider.notifier).login(),
                ),
                if (auth.hasError)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(
                      thaiError(auth.error!),
                      style: const TextStyle(color: AppTheme.danger),
                    ),
                  ),
                const SizedBox(height: 18),
                const Text(
                  '🔒 เราจะไม่โพสต์สิ่งใดลงในนามของคุณ\nข้อมูลของคุณจะถูกเก็บเป็นความลับและปลอดภัย',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppTheme.textSecondary, height: 1.5),
                ),
                TextButton(
                  onPressed: () => context.push('/privacy'),
                  child: const Text('ดูนโยบายความเป็นส่วนตัว'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
