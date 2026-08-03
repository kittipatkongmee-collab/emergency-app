import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/app_core.dart';
import '../auth/auth.dart';
import '../incidents/incidents.dart';

class OperationalHomeTab extends ConsumerWidget {
  const OperationalHomeTab({required this.onOpenHistory, super.key});

  final VoidCallback onOpenHistory;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(citizenProfileProvider);
    return SafeArea(
      child: profile.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => _ProfileLoadError(
          onRetry: () => ref.invalidate(citizenProfileProvider),
          onLogout: () => ref.read(authProvider.notifier).logout(),
        ),
        data: (user) => _HomeContent(user: user, onOpenHistory: onOpenHistory),
      ),
    );
  }
}

class _HomeContent extends ConsumerWidget {
  const _HomeContent({required this.user, required this.onOpenHistory});

  final CitizenProfile user;
  final VoidCallback onOpenHistory;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(unreadCountProvider).valueOrNull ?? 0;
    final incidents = ref.watch(incidentsProvider);
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(citizenProfileProvider);
        ref.invalidate(unreadCountProvider);
        ref.invalidate(incidentsProvider);
        await ref.read(citizenProfileProvider.future);
      },
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.zero,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 60),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF3B0006), Color(0xFF9F0014)],
              ),
            ),
            child: Row(
              children: [
                const RoyalThaiPoliceLogo(size: 58),
                const SizedBox(width: 12),
                const Expanded(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'หน่วยค้นหาและช่วยเหลือทางอากาศ (SRU)',
                      maxLines: 1,
                      softWrap: false,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'การแจ้งเตือน',
                  onPressed: () => context.push('/notifications'),
                  icon: Badge(
                    isLabelVisible: unread > 0,
                    label: Text(unread > 99 ? '99+' : '$unread'),
                    child: const Icon(
                      Icons.notifications_none_rounded,
                      color: Colors.white,
                      size: 30,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Transform.translate(
            offset: const Offset(0, -38),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Row(
                    children: [
                      const CircleAvatar(
                        radius: 34,
                        backgroundColor: AppTheme.primaryLight,
                        child: Icon(
                          Icons.person_rounded,
                          size: 38,
                          color: AppTheme.primary,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'สวัสดี ${user.fullName}',
                              style: const TextStyle(
                                color: AppTheme.primaryDark,
                                fontSize: 22,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 4),
                            const FittedBox(
                              fit: BoxFit.scaleDown,
                              alignment: Alignment.centerLeft,
                              child: Text(
                                'หากพบเหตุฉุกเฉิน แจ้งเหตุได้ทันที\nเราพร้อมช่วยเหลือคุณ',
                                maxLines: 2,
                                softWrap: false,
                                style: TextStyle(
                                  color: AppTheme.textSecondary,
                                  fontSize: 14,
                                  height: 1.4,
                                ),
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
          Transform.translate(
            offset: const Offset(0, -22),
            child: Column(
              children: [
                const PoliceAviationLogo(size: 205),
                const SizedBox(height: 6),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      'แจ้งเหตุได้รวดเร็ว ติดตามสถานะได้แบบเรียลไทม์',
                      maxLines: 1,
                      softWrap: false,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppTheme.primaryDark,
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 26),
            child: Column(
              children: [
                IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Expanded(
                        child: _FeatureCard(
                          icon: Icons.add_a_photo_outlined,
                          title: 'แจ้งเหตุใหม่',
                          subtitle: 'แจ้งเหตุฉุกเฉิน พร้อมแนบภาพและรายละเอียด',
                          buttonLabel: 'แจ้งเหตุ',
                          onTap: () => openIncidentReport(context, ref),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _FeatureCard(
                          icon: Icons.manage_search_rounded,
                          title: 'ติดตามสถานะ',
                          subtitle: 'ตรวจสอบความคืบหน้าของเหตุที่คุณแจ้งไว้',
                          buttonLabel: 'ติดตาม',
                          onTap: onOpenHistory,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(17),
                    child: Row(
                      children: [
                        const CircleAvatar(
                          radius: 29,
                          backgroundColor: AppTheme.primaryLight,
                          child: Icon(
                            Icons.phone_rounded,
                            color: AppTheme.primaryDark,
                            size: 30,
                          ),
                        ),
                        const SizedBox(width: 14),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'ติดต่อฉุกเฉิน',
                                style: TextStyle(
                                  color: AppTheme.primaryDark,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 18,
                                ),
                              ),
                              Text(
                                '0 2509 1520\nให้บริการตลอด 24 ชั่วโมง',
                                style: TextStyle(
                                  color: AppTheme.textSecondary,
                                  height: 1.4,
                                ),
                              ),
                            ],
                          ),
                        ),
                        FilledButton.icon(
                          onPressed: () => launchPhone(context, '0 2509 1520'),
                          style: FilledButton.styleFrom(
                            minimumSize: const Size(0, 48),
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                          ),
                          icon: const Icon(Icons.phone, size: 18),
                          label: const Text('โทรเลย'),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                incidents.when(
                  loading: () => const Card(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                  ),
                  error: (_, __) => _InlineError(
                    onRetry: () => ref.invalidate(incidentsProvider),
                  ),
                  data: (items) {
                    if (items.isEmpty) {
                      return const Card(
                        child: Padding(
                          padding: EdgeInsets.all(20),
                          child: Row(
                            children: [
                              CircleAvatar(
                                backgroundColor: AppTheme.primaryLight,
                                child: Icon(
                                  Icons.inbox_outlined,
                                  color: AppTheme.primary,
                                ),
                              ),
                              SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'ยังไม่มีรายการแจ้งเหตุ',
                                      style: TextStyle(
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                    Text(
                                      'เมื่อแจ้งเหตุแล้ว รายการล่าสุดจะแสดงที่นี่',
                                      style: TextStyle(
                                        color: AppTheme.textSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }
                    final latest = items.first;
                    return Card(
                      child: ListTile(
                        contentPadding: const EdgeInsets.all(16),
                        leading: const CircleAvatar(
                          backgroundColor: AppTheme.primaryLight,
                          child: Icon(
                            Icons.emergency_outlined,
                            color: AppTheme.primary,
                          ),
                        ),
                        title: Text(
                          latest.caseCode,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        subtitle: Text(
                          latest.description,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => context.push('/tracking/${latest.id}'),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FeatureCard extends StatelessWidget {
  const _FeatureCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.buttonLabel,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String buttonLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          CircleAvatar(
            radius: 36,
            backgroundColor: AppTheme.primaryLight,
            child: Icon(icon, size: 36, color: AppTheme.primary),
          ),
          const SizedBox(height: 12),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppTheme.primaryDark,
              fontSize: 19,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          Expanded(
            child: Text(
              subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppTheme.textSecondary,
                fontSize: 13,
                height: 1.4,
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: onTap,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    buttonLabel,
                    maxLines: 1,
                    softWrap: false,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(width: 4),
                  const Icon(Icons.chevron_right, size: 19),
                ],
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class _InlineError extends StatelessWidget {
  const _InlineError({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Row(
        children: [
          const Expanded(child: Text('โหลดรายการล่าสุดไม่สำเร็จ')),
          TextButton(onPressed: onRetry, child: const Text('ลองอีกครั้ง')),
        ],
      ),
    ),
  );
}

class _ProfileLoadError extends StatelessWidget {
  const _ProfileLoadError({required this.onRetry, required this.onLogout});

  final VoidCallback onRetry;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.cloud_off_outlined,
            size: 64,
            color: AppTheme.textSecondary,
          ),
          const SizedBox(height: 14),
          const Text(
            'ไม่สามารถโหลดข้อมูลบัญชีได้',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
          ),
          const Text(
            'กรุณาตรวจสอบว่า Backend เปิดอยู่ แล้วลองอีกครั้ง',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppTheme.textSecondary),
          ),
          const SizedBox(height: 18),
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('ลองอีกครั้ง'),
          ),
          TextButton(onPressed: onLogout, child: const Text('ออกจากระบบ')),
        ],
      ),
    ),
  );
}
