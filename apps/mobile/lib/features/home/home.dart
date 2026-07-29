import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/app_core.dart';
import '../auth/auth.dart';
import '../incidents/incidents.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});
  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int index = 0;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: IndexedStack(
      index: index,
      children: const [HomeTab(), HistoryTab(), ProfileTab()],
    ),
    bottomNavigationBar: NavigationBar(
      selectedIndex: index,
      onDestinationSelected: (v) => setState(() => index = v),
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.home_outlined),
          selectedIcon: Icon(Icons.home),
          label: 'หน้าแรก',
        ),
        NavigationDestination(icon: Icon(Icons.history), label: 'ประวัติ'),
        NavigationDestination(
          icon: Icon(Icons.person_outline),
          selectedIcon: Icon(Icons.person),
          label: 'โปรไฟล์',
        ),
      ],
    ),
  );
}

class HomeTab extends StatelessWidget {
  const HomeTab({super.key});
  @override
  Widget build(BuildContext context) => SafeArea(
    child: CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Container(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 55),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF4A0007), Color(0xFF970010)],
              ),
              borderRadius: BorderRadius.vertical(bottom: Radius.circular(30)),
            ),
            child: Row(
              children: [
                const LogoPlaceholder(size: 64),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'ทีมค้นหาและช่วยเหลือ\nทางอากาศ บ.ตร.',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () => context.push('/notifications'),
                  icon: const Badge(
                    label: Text('2'),
                    child: Icon(
                      Icons.notifications_outlined,
                      color: Colors.white,
                      size: 30,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(18, 0, 18, 22),
          sliver: SliverList.list(
            children: [
              Transform.translate(
                offset: const Offset(0, -30),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Row(
                      children: [
                        const CircleAvatar(
                          radius: 32,
                          backgroundColor: AppTheme.primaryLight,
                          child: Icon(
                            Icons.person,
                            color: AppTheme.primary,
                            size: 34,
                          ),
                        ),
                        const SizedBox(width: 14),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'สวัสดี, ผู้ใช้งาน',
                                style: TextStyle(
                                  fontSize: 21,
                                  fontWeight: FontWeight.w700,
                                  color: AppTheme.primaryDark,
                                ),
                              ),
                              Text(
                                'หากพบเหตุฉุกเฉิน แจ้งเหตุได้ทันที\nเราพร้อมช่วยเหลือคุณ',
                                style: TextStyle(
                                  color: AppTheme.textSecondary,
                                  height: 1.4,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppTheme.primaryLight,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(
                            Icons.shield_outlined,
                            color: AppTheme.primary,
                            size: 32,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const Center(child: LogoPlaceholder(size: 160)),
              const SizedBox(height: 15),
              const Center(
                child: Text(
                  'แจ้งเหตุได้รวดเร็ว ติดตามสถานะได้แบบเรียลไทม์',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.primaryDark,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: _ActionCard(
                      icon: Icons.camera_alt_outlined,
                      title: 'แจ้งเหตุ',
                      subtitle: 'แจ้งเหตุฉุกเฉิน พร้อมแนบภาพและรายละเอียด',
                      button: 'แจ้งเหตุเลย',
                      onTap: () => context.push('/report'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _ActionCard(
                      icon: Icons.fact_check_outlined,
                      title: 'ติดตามสถานะ',
                      subtitle: 'ตรวจสอบความคืบหน้าของเหตุที่คุณแจ้งไว้',
                      button: 'เปิดประวัติ',
                      onTap: () => _showHistoryHint(context),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Row(
                    children: [
                      const CircleAvatar(
                        radius: 27,
                        backgroundColor: AppTheme.primaryLight,
                        child: Icon(Icons.phone, color: AppTheme.primary),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'ติดต่อฉุกเฉิน',
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Text(
                              'โทร. 0 2509 1520 (ตลอด 24 ชั่วโมง)',
                              style: TextStyle(color: AppTheme.primaryDark),
                            ),
                          ],
                        ),
                      ),
                      FilledButton.tonalIcon(
                        onPressed: () =>
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('โทร. 0 2509 1520')),
                            ),
                        icon: const Icon(Icons.phone),
                        label: const Text('โทรเลย'),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ],
    ),
  );
}

void _showHistoryHint(BuildContext context) =>
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('เลือกแท็บ “ประวัติ” ด้านล่างเพื่อเปิดรายการ'),
      ),
    );

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.button,
    required this.onTap,
  });
  final IconData icon;
  final String title, subtitle, button;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        children: [
          CircleAvatar(
            radius: 31,
            backgroundColor: AppTheme.primaryLight,
            child: Icon(icon, color: AppTheme.primary, size: 32),
          ),
          const SizedBox(height: 10),
          Text(
            title,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppTheme.primaryDark,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 13,
              color: AppTheme.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton(onPressed: onTap, child: Text(button)),
          ),
        ],
      ),
    ),
  );
}

class HistoryTab extends ConsumerWidget {
  const HistoryTab({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final incidents = ref.watch(incidentsProvider);
    return SafeArea(
      child: Scaffold(
        appBar: AppBar(title: const Text('ประวัติการแจ้งเหตุ')),
        body: incidents.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) =>
              _ErrorState(onRetry: () => ref.invalidate(incidentsProvider)),
          data: (items) {
            if (items.isEmpty) {
              return const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.history,
                      size: 70,
                      color: AppTheme.textSecondary,
                    ),
                    Text('ยังไม่มีประวัติการแจ้งเหตุ'),
                  ],
                ),
              );
            }
            return RefreshIndicator(
              onRefresh: () => ref.refresh(incidentsProvider.future),
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, i) {
                  final item = items[i];
                  return Card(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(
                        AppTheme.borderRadius,
                      ),
                      onTap: () => context.push('/tracking/${item.id}'),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            Container(
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(
                                color: AppTheme.primaryLight,
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: item.images.isEmpty
                                  ? const Icon(
                                      Icons.emergency,
                                      color: AppTheme.primary,
                                    )
                                  : ClipRRect(
                                      borderRadius: BorderRadius.circular(14),
                                      child: CachedNetworkImage(
                                        imageUrl: item.images.first,
                                        fit: BoxFit.cover,
                                      ),
                                    ),
                            ),
                            const SizedBox(width: 13),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.caseCode,
                                    style: const TextStyle(
                                      color: AppTheme.primary,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  Text(
                                    item.description,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  Text(
                                    DateFormat(
                                      'd MMM yyyy · HH:mm',
                                      'th',
                                    ).format(
                                      DateTime.parse(item.reportedAt).toLocal(),
                                    ),
                                    style: const TextStyle(
                                      color: AppTheme.textSecondary,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Chip(
                              label: Text(
                                item.status,
                                style: const TextStyle(fontSize: 10),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            );
          },
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.onRetry});
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.cloud_off, size: 60, color: AppTheme.textSecondary),
        const SizedBox(height: 12),
        const Text('ไม่สามารถโหลดข้อมูลได้'),
        TextButton(onPressed: onRetry, child: const Text('ลองอีกครั้ง')),
      ],
    ),
  );
}

class ProfileTab extends ConsumerWidget {
  const ProfileTab({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => SafeArea(
    child: Scaffold(
      appBar: AppBar(title: const Text('โปรไฟล์')),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(22),
              child: Column(
                children: [
                  const CircleAvatar(
                    radius: 45,
                    backgroundColor: AppTheme.primaryLight,
                    child: Icon(
                      Icons.person,
                      color: AppTheme.primary,
                      size: 48,
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'ผู้ใช้งานกองบินตำรวจ',
                    style: TextStyle(fontSize: 21, fontWeight: FontWeight.w700),
                  ),
                  const Text(
                    'บัญชีประชาชน',
                    style: TextStyle(color: AppTheme.textSecondary),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(
                    Icons.notifications_outlined,
                    color: AppTheme.primary,
                  ),
                  title: const Text('การแจ้งเตือน'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/notifications'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(
                    Icons.shield_outlined,
                    color: AppTheme.primary,
                  ),
                  title: const Text('สิทธิ์กล้องและตำแหน่ง'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/permissions'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(
                    Icons.privacy_tip_outlined,
                    color: AppTheme.primary,
                  ),
                  title: const Text('นโยบายความเป็นส่วนตัว'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/privacy'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: () async {
              await ref.read(authProvider.notifier).logout();
              if (context.mounted) context.go('/login');
            },
            icon: const Icon(Icons.logout),
            label: const Text('ออกจากระบบ'),
          ),
        ],
      ),
    ),
  );
}

class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('นโยบายความเป็นส่วนตัว')),
    body: ListView(
      padding: const EdgeInsets.all(20),
      children: const [
        Text(
          'การคุ้มครองข้อมูลส่วนบุคคล',
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w700,
            color: AppTheme.primaryDark,
          ),
        ),
        SizedBox(height: 14),
        Text(
          'ระบบเก็บเฉพาะข้อมูลที่จำเป็นต่อการรับแจ้งเหตุ การติดต่อกลับ การระบุตำแหน่ง และการติดตามผล โดยจำกัดการเข้าถึงตามหน้าที่ของเจ้าหน้าที่',
          style: TextStyle(height: 1.7),
        ),
        SizedBox(height: 12),
        Text(
          'ข้อมูลที่จัดเก็บ',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        ),
        Text(
          'ชื่อและข้อมูลติดต่อ รายละเอียดและภาพเหตุการณ์ พิกัดตำแหน่ง ประวัติสถานะ และข้อมูลบัญชี Facebook ที่ผู้ใช้อนุญาต',
          style: TextStyle(height: 1.7),
        ),
        SizedBox(height: 12),
        Text(
          'สิทธิ์ของผู้ใช้',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        ),
        Text(
          'ผู้ใช้สามารถขอเข้าถึง แก้ไข หรือสอบถามการใช้ข้อมูลผ่านกองบินตำรวจ โทรศัพท์ 0 2509 1520 ทั้งนี้ระยะเวลาเก็บรักษาต้องเป็นไปตามนโยบายฉบับอนุมัติของหน่วยงาน',
          style: TextStyle(height: 1.7),
        ),
      ],
    ),
  );
}
