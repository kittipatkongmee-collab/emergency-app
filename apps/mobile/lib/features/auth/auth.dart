import 'dart:convert';
import 'dart:math';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_line_sdk/flutter_line_sdk.dart';
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
        if (!Environment.lineLoginConfigured) {
          throw Exception('ยังไม่ได้ตั้งค่าการเข้าสู่ระบบด้วย LINE');
        }
        final nonce = _createNonce();
        final option = LoginOption(false, 'normal')..idTokenNonce = nonce;
        final scopes = <String>['profile', 'openid'];
        if (Environment.lineEmailScopeEnabled) scopes.add('email');
        final result = await LineSDK.instance.login(
          scopes: scopes,
          option: option,
        );
        final idToken = result.accessToken.idTokenRaw;
        if (idToken == null || idToken.isEmpty) {
          throw Exception('LINE ไม่ได้ส่งข้อมูลยืนยันตัวตนกลับมา');
        }
        await _exchange('/auth/line', {
          'idToken': idToken,
          'nonce': result.idTokenNonce ?? nonce,
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
    if (Environment.lineLoginConfigured) {
      try {
        await LineSDK.instance.logout();
      } catch (_) {
        // Local logout still completes if the LINE session is already gone.
      }
    }
    ref.invalidate(citizenProfileProvider);
    state = const AsyncData(false);
  }

  String _createNonce() {
    final random = Random.secure();
    final bytes = List<int>.generate(32, (_) => random.nextInt(256));
    return base64UrlEncode(bytes).replaceAll('=', '');
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

class CitizenAvatar extends StatelessWidget {
  const CitizenAvatar({this.profileImageUrl, this.radius = 34, super.key});

  final String? profileImageUrl;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final url = profileImageUrl?.trim();
    return CircleAvatar(
      radius: radius,
      backgroundColor: AppTheme.primaryLight,
      child: url == null || url.isEmpty
          ? Icon(
              Icons.person_rounded,
              size: radius * 1.1,
              color: AppTheme.primary,
            )
          : ClipOval(
              child: CachedNetworkImage(
                imageUrl: url,
                width: radius * 2,
                height: radius * 2,
                fit: BoxFit.cover,
                placeholder: (_, __) => const Center(
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                errorWidget: (_, __, ___) => Icon(
                  Icons.person_rounded,
                  size: radius * 1.1,
                  color: AppTheme.primary,
                ),
              ),
            ),
    );
  }
}

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
              AppCopy.unitNameMultiline,
              maxLines: 2,
              softWrap: false,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 18,
                height: 1.18,
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
              child: IntrinsicHeight(
                child: Column(
                  children: [
                    const SizedBox(height: 18),
                    Semantics(
                      header: true,
                      child: const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 4),
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            AppCopy.unitNameMultiline,
                            key: Key('login-unit-heading'),
                            maxLines: 2,
                            softWrap: false,
                            overflow: TextOverflow.visible,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 27,
                              height: 1.14,
                              fontWeight: FontWeight.w800,
                              color: AppTheme.primaryDark,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    const Spacer(),
                    Column(
                      key: const Key('login-brand-group'),
                      children: [
                        const Center(child: PoliceAviationLogo(size: 220)),
                        const SizedBox(height: 22),
                        Center(
                          child: Card(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 22,
                                vertical: 24,
                              ),
                              child: const Text(
                                'เข้าสู่ระบบก่อนแจ้งเหตุ',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.w800,
                                  color: AppTheme.primaryDark,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),
                    const SizedBox(height: 24),
                    GradientButton(
                      label: isDevBypass
                          ? 'เข้าสู่ระบบสำหรับทดสอบ (test1)'
                          : 'เชื่อมต่อและเข้าสู่ระบบด้วย LINE',
                      icon: isDevBypass ? Icons.login_rounded : null,
                      iconWidget: isDevBypass
                          ? null
                          : Image.asset(
                              'assets/images/line-logo.png',
                              width: 28,
                              height: 28,
                              semanticLabel: 'โลโก้ LINE',
                            ),
                      colors: isDevBypass
                          ? const [Color(0xFFB10017), Color(0xFF680008)]
                          : const [Color(0xFF06C755), Color(0xFF05B84E)],
                      shadowColor: isDevBypass
                          ? const Color(0x308F0010)
                          : const Color(0x3306C755),
                      busy: auth.isLoading,
                      onPressed: isDevBypass
                          ? () => ref
                                .read(authProvider.notifier)
                                .login(profileId: 'test1')
                          : Environment.lineLoginConfigured
                          ? () => ref.read(authProvider.notifier).login()
                          : null,
                    ),
                    if (!isDevBypass && !Environment.lineLoginConfigured)
                      const Padding(
                        padding: EdgeInsets.only(top: 12),
                        child: Text(
                          'ยังไม่ได้ตั้งค่า LINE Channel ID',
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
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: () => context.push('/privacy'),
                      child: const Text('ดูนโยบายความเป็นส่วนตัว'),
                    ),
                    const Divider(height: 32),
                    const Padding(
                      padding: EdgeInsets.only(top: 2),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          PoliceAviationLogo(size: 64),
                          SizedBox(width: 14),
                          Flexible(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                FittedBox(
                                  fit: BoxFit.scaleDown,
                                  alignment: Alignment.centerLeft,
                                  child: Text(
                                    AppCopy.unitNameMultiline,
                                    key: Key('login-contact-unit-name'),
                                    maxLines: 2,
                                    softWrap: false,
                                    style: TextStyle(
                                      color: AppTheme.primaryDark,
                                      fontSize: 13,
                                      height: 1.42,
                                    ),
                                  ),
                                ),
                                Text(
                                  '701 ถนนรามอินทรา แขวงท่าแร้ง\nโทรศัพท์ 0 2509 1520',
                                  style: TextStyle(
                                    color: AppTheme.primaryDark,
                                    fontSize: 13,
                                    height: 1.42,
                                  ),
                                ),
                              ],
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
        ),
      ),
    );
  }
}
