import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_line_sdk/flutter_line_sdk.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'core/app_core.dart';
import 'features/auth/auth.dart';
import 'features/home/home.dart';
import 'features/information/information.dart';
import 'features/incidents/incidents.dart';

@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  unawaited(initializeDateFormatting('th'));
  if (Environment.lineLoginConfigured) {
    await LineSDK.instance.setup(Environment.lineChannelId);
  }
  if (Environment.fcmEnabled) {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);
  }
  runApp(const ProviderScope(child: PoliceIncidentApp()));
}

final routerProvider = Provider<GoRouter>(
  (ref) => GoRouter(
    initialLocation: '/splash',
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/home', builder: (_, __) => const MainShell()),
      GoRoute(
        path: '/information/:id',
        builder: (_, state) => AircraftInformationDetailScreen(
          aircraftId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(path: '/report', builder: (_, __) => const ReportScreen()),
      GoRoute(path: '/location', builder: (_, __) => const LocationScreen()),
      GoRoute(path: '/review', builder: (_, __) => const ReviewScreen()),
      GoRoute(
        path: '/success',
        builder: (_, state) => SuccessScreen(result: state.extra! as Incident),
      ),
      GoRoute(
        path: '/tracking/:id',
        builder: (_, state) =>
            TrackingScreen(incidentId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/notifications',
        builder: (_, __) => const NotificationsScreen(),
      ),
      GoRoute(path: '/privacy', builder: (_, __) => const PrivacyScreen()),
      GoRoute(
        path: '/permissions',
        builder: (_, __) => const PermissionsScreen(),
      ),
    ],
  ),
);

class PoliceIncidentApp extends ConsumerWidget {
  const PoliceIncidentApp({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => MaterialApp.router(
    title: AppCopy.unitName,
    debugShowCheckedModeBanner: false,
    locale: const Locale('th', 'TH'),
    supportedLocales: const [Locale('th', 'TH')],
    localizationsDelegates: const [
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    theme: AppTheme.light,
    routerConfig: ref.watch(routerProvider),
  );
}
