import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/app_core.dart';

class AuthController extends StateNotifier<AsyncValue<bool>> {
  AuthController(this.ref) : super(const AsyncData(false));
  final Ref ref;
  Future<bool> restore() async {
    final storage = ref.read(secureStorageProvider);
    final token = await storage.read(key: 'accessToken');
    if (Environment.name == 'development' && Environment.devAuthBypass) {
      final profileId = await storage.read(key: 'developmentProfileId');
      if (profileId != 'test1') {
        await storage.deleteAll();
        state = const AsyncData(false);
        return false;
      }
    }
    state = AsyncData(token != null);
    return token != null;
  }

  Future<void> login({String profileId = 'test1'}) async {
    state = const AsyncLoading();
    try {
      if (Environment.name == 'development' && Environment.devAuthBypass) {
        await _exchange('/auth/development-login', {'profileId': profileId});
        await ref
            .read(secureStorageProvider)
            .write(key: 'developmentProfileId', value: profileId);
      } else {
        if (!Environment.facebookLoginEnabled) {
          throw Exception('ยังไม่ได้ตั้งค่าการเข้าสู่ระบบด้วย Facebook');
        }
        final result = await FacebookAuth.instance.login(
          permissions: ['public_profile', 'email'],
        );
        if (result.status != LoginStatus.success || result.accessToken == null)
          throw Exception('ยกเลิกการเข้าสู่ระบบ');
        await _exchange('/auth/facebook', {
          'accessToken': result.accessToken!.tokenString,
        });
      }
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
                  'platform': defaultTargetPlatform == TargetPlatform.iOS
                      ? 'IOS'
                      : 'ANDROID',
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
    final storage = ref.read(secureStorageProvider);
    final refreshToken = await storage.read(key: 'refreshToken');
    if (refreshToken != null) {
      try {
        await ref
            .read(apiClientProvider)
            .dio
            .post('/auth/logout', data: {'refreshToken': refreshToken});
      } catch (_) {
        // Local logout still completes when the server cannot be reached.
      }
    }
    await storage.deleteAll();
    await FacebookAuth.instance.logOut();
    ref.invalidate(citizenProfileProvider);
    state = const AsyncData(false);
  }

  Future<void> _exchange(String path, Map<String, dynamic> body) async {
    final response = await ref
        .read(apiClientProvider)
        .dio
        .post(path, data: body);
    final tokens =
        (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
    final storage = ref.read(secureStorageProvider);
    await storage.write(
      key: 'accessToken',
      value: tokens['accessToken'] as String,
    );
    await storage.write(
      key: 'refreshToken',
      value: tokens['refreshToken'] as String,
    );
  }
}

final authProvider = StateNotifierProvider<AuthController, AsyncValue<bool>>(
  (ref) => AuthController(ref),
);

class CitizenProfile {
  const CitizenProfile({
    required this.id,
    required this.fullName,
    this.email,
    this.phone,
    this.profileImageUrl,
  });
  final String id;
  final String fullName;
  final String? email;
  final String? phone;
  final String? profileImageUrl;

  factory CitizenProfile.fromJson(Map<String, dynamic> json) => CitizenProfile(
    id: json['id'] as String,
    fullName: json['fullName'] as String,
    email: json['email'] as String?,
    phone: json['phone'] as String?,
    profileImageUrl: json['profileImageUrl'] as String?,
  );
}

final citizenProfileProvider = FutureProvider<CitizenProfile>((ref) async {
  final response = await ref.read(apiClientProvider).dio.get('/auth/me');
  return CitizenProfile.fromJson(
    (response.data as Map<String, dynamic>)['data'] as Map<String, dynamic>,
  );
});

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
          PoliceAviationLogo(size: 150),
          SizedBox(height: 28),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              'หน่วยค้นหาและช่วยเหลือทางอากาศ (SRU)',
              maxLines: 1,
              softWrap: false,
              style: TextStyle(
                fontSize: 20,
                color: AppTheme.primaryDark,
                fontWeight: FontWeight.w700,
              ),
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
    final isDevBypass =
        Environment.name == 'development' && Environment.devAuthBypass;
    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(22, 28, 22, 24),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                minHeight: constraints.maxHeight - 52,
              ),
              child: Column(
                children: [
                  const SizedBox(height: 18),
                  const FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      'หน่วยค้นหาและช่วยเหลือทางอากาศ (SRU)',
                      maxLines: 1,
                      softWrap: false,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 25,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.primaryDark,
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'ระบบแจ้งเหตุและติดตามสถานะเหตุฉุกเฉิน',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 16,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    width: 68,
                    height: 4,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppTheme.primary, Color(0xFFE4BFC4)],
                      ),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  const SizedBox(height: 22),
                  const PoliceAviationLogo(size: 220),
                  const SizedBox(height: 22),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 22,
                        vertical: 28,
                      ),
                      child: Column(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppTheme.primaryLight,
                            ),
                            child: const Icon(
                              Icons.shield_outlined,
                              color: AppTheme.primary,
                              size: 42,
                            ),
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'เข้าสู่ระบบก่อนแจ้งเหตุ',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.w800,
                              color: AppTheme.primaryDark,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'เพื่อความปลอดภัยของข้อมูล และสามารถติดตามสถานะเหตุได้อย่างครบถ้วน',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              height: 1.55,
                              color: AppTheme.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  GradientButton(
                    label: isDevBypass
                        ? 'เข้าสู่ระบบสำหรับทดสอบ (test1)'
                        : 'เข้าสู่ระบบด้วย Facebook',
                    icon: isDevBypass ? Icons.login_rounded : Icons.facebook,
                    busy: auth.isLoading,
                    onPressed: isDevBypass
                        ? () => ref
                              .read(authProvider.notifier)
                              .login(profileId: 'test1')
                        : Environment.facebookLoginEnabled
                        ? () => ref.read(authProvider.notifier).login()
                        : null,
                  ),
                  if (!isDevBypass && !Environment.facebookLoginEnabled)
                    const Padding(
                      padding: EdgeInsets.only(top: 12),
                      child: Text(
                        'ยังไม่ได้ตั้งค่าการเข้าสู่ระบบด้วย Facebook',
                        style: TextStyle(color: AppTheme.warning),
                      ),
                    ),
                  if (auth.hasError)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Text(
                        thaiError(auth.error!),
                        style: const TextStyle(color: AppTheme.danger),
                      ),
                    ),
                  const SizedBox(height: 16),
                  const Text(
                    '🔒 เราจะไม่โพสต์สิ่งใดลงในนามของคุณ\nข้อมูลของคุณจะถูกเก็บเป็นความลับและปลอดภัย',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppTheme.textSecondary,
                      height: 1.5,
                    ),
                  ),
                  TextButton(
                    onPressed: () => context.push('/privacy'),
                    child: const Text('ดูนโยบายความเป็นส่วนตัว'),
                  ),
                  const Divider(height: 32),
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      RoyalThaiPoliceLogo(size: 64),
                      SizedBox(width: 14),
                      Flexible(
                        child: Text(
                          'กองบินตำรวจ\n701 ถนนรามอินทรา แขวงท่าแร้ง\nโทรศัพท์ 0 2509 1520',
                          style: TextStyle(
                            color: AppTheme.primaryDark,
                            height: 1.45,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
