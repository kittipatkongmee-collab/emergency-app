import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/app_core.dart';
import '../auth/auth.dart';
import '../information/information.dart';
import '../incidents/incidents.dart';
import 'operational_home.dart';

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
      children: [
        OperationalHomeTab(onOpenHistory: () => setState(() => index = 2)),
        const InformationTab(),
        const HistoryTab(),
        const ProfileTab(),
      ],
    ),
    bottomNavigationBar: DecoratedBox(
      decoration: const BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Color(0x1A4A0007),
            blurRadius: 18,
            offset: Offset(0, -4),
          ),
        ],
      ),
      child: NavigationBar(
        selectedIndex: index,
        backgroundColor: Colors.white,
        indicatorColor: AppTheme.primaryLight,
        onDestinationSelected: (v) => setState(() => index = v),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home, color: AppTheme.primary),
            label: 'หน้าแรก',
          ),
          NavigationDestination(
            icon: Icon(Icons.menu_book_outlined),
            selectedIcon: Icon(Icons.menu_book, color: AppTheme.primary),
            label: 'ข้อมูล',
          ),
          NavigationDestination(
            icon: Icon(Icons.assignment_outlined),
            selectedIcon: Icon(Icons.assignment, color: AppTheme.primary),
            label: 'ประวัติ',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person, color: AppTheme.primary),
            label: 'โปรไฟล์',
          ),
        ],
      ),
    ),
  );
}

class HomeTab extends ConsumerWidget {
  const HomeTab({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(citizenProfileProvider);
    final unread = ref.watch(unreadCountProvider).valueOrNull ?? 0;
    return SafeArea(
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Container(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 55),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF4A0007), Color(0xFF970010)],
                ),
                borderRadius: BorderRadius.vertical(
                  bottom: Radius.circular(30),
                ),
              ),
              child: Row(
                children: [
                  const PoliceAviationLogo(size: 64),
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
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => context.push('/notifications'),
                    icon: Badge(
                      isLabelVisible: unread > 0,
                      label: Text(unread > 99 ? '99+' : '$unread'),
                      child: const Icon(
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
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'สวัสดี, ${profile.valueOrNull?.fullName ?? 'ผู้ใช้งาน'}',
                                  style: const TextStyle(
                                    fontSize: 21,
                                    fontWeight: FontWeight.w700,
                                    color: AppTheme.primaryDark,
                                  ),
                                ),
                                const Text(
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
                const Center(child: PoliceAviationLogo(size: 160)),
                const SizedBox(height: 15),
                const Center(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      'แจ้งเหตุได้รวดเร็ว ติดตามสถานะได้แบบเรียลไทม์',
                      maxLines: 1,
                      softWrap: false,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.primaryDark,
                      ),
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
                        onTap: () => openIncidentReport(context, ref),
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
                                const SnackBar(
                                  content: Text('โทร. 0 2509 1520'),
                                ),
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

class HistoryTab extends ConsumerStatefulWidget {
  const HistoryTab({super.key});
  @override
  ConsumerState<HistoryTab> createState() => _HistoryTabState();
}

class _HistoryTabState extends ConsumerState<HistoryTab> {
  String status = '';
  int page = 1;

  @override
  Widget build(BuildContext context) {
    final provider = incidentHistoryProvider((page: page, status: status));
    final incidents = ref.watch(provider);
    return SafeArea(
      child: Scaffold(
        appBar: AppBar(
          title: const Text('ประวัติการแจ้งเหตุ'),
          actions: [
            PopupMenuButton<String>(
              tooltip: 'กรองตามสถานะ',
              initialValue: status,
              onSelected: (value) => setState(() {
                status = value;
                page = 1;
              }),
              itemBuilder: (_) => const [
                PopupMenuItem(value: '', child: Text('ทุกสถานะ')),
                PopupMenuItem(value: 'RECEIVED', child: Text('รอดำเนินการ')),
                PopupMenuItem(
                  value: 'IN_PROGRESS',
                  child: Text('กำลังดำเนินการ'),
                ),
                PopupMenuItem(value: 'COMPLETED', child: Text('ภารกิจสำเร็จ')),
                PopupMenuItem(value: 'CANCELLED', child: Text('ยกเลิก')),
              ],
              icon: const Icon(Icons.filter_list),
            ),
          ],
        ),
        body: incidents.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) =>
              _ErrorState(onRetry: () => ref.invalidate(provider)),
          data: (historyPage) {
            final items = historyPage.items;
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
              onRefresh: () => ref.refresh(provider.future),
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: items.length + (historyPage.totalPages > 0 ? 1 : 0),
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, i) {
                  if (i == items.length) {
                    return Padding(
                      padding: const EdgeInsets.only(top: 6, bottom: 8),
                      child: _HistoryPagination(
                        currentPage: historyPage.page,
                        totalPages: historyPage.totalPages,
                        onPageSelected: (selectedPage) =>
                            setState(() => page = selectedPage),
                      ),
                    );
                  }
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
                            IncidentStatusBadge(status: item.status),
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

List<int> visiblePageNumbers({
  required int currentPage,
  required int totalPages,
  required int windowSize,
}) {
  if (totalPages <= 0 || windowSize <= 0) return const [];
  final visibleCount = totalPages < windowSize ? totalPages : windowSize;
  final latestStart = totalPages - visibleCount + 1;
  final start = currentPage.clamp(1, latestStart);
  return List.generate(visibleCount, (index) => start + index);
}

class _HistoryPagination extends StatelessWidget {
  const _HistoryPagination({
    required this.currentPage,
    required this.totalPages,
    required this.onPageSelected,
  });

  final int currentPage;
  final int totalPages;
  final ValueChanged<int> onPageSelected;

  @override
  Widget build(BuildContext context) {
    final pages = visiblePageNumbers(
      currentPage: currentPage,
      totalPages: totalPages,
      windowSize: 3,
    );
    return Semantics(
      container: true,
      label: 'เลือกหน้าประวัติการแจ้งเหตุ',
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          IconButton.outlined(
            tooltip: 'หน้าก่อนหน้า',
            onPressed: currentPage > 1
                ? () => onPageSelected(currentPage - 1)
                : null,
            icon: const Icon(Icons.chevron_left),
          ),
          const SizedBox(width: 4),
          for (final pageNumber in pages) ...[
            SizedBox(
              width: 40,
              height: 40,
              child: TextButton(
                onPressed: pageNumber == currentPage
                    ? null
                    : () => onPageSelected(pageNumber),
                style: TextButton.styleFrom(
                  disabledForegroundColor: Colors.white,
                  foregroundColor: AppTheme.primaryDark,
                  backgroundColor: pageNumber == currentPage
                      ? AppTheme.primary
                      : Colors.white,
                  padding: EdgeInsets.zero,
                  side: BorderSide(
                    color: pageNumber == currentPage
                        ? AppTheme.primary
                        : AppTheme.borderColor,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: Text(
                  '$pageNumber',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            ),
            const SizedBox(width: 4),
          ],
          IconButton.outlined(
            tooltip: 'หน้าถัดไป',
            onPressed: currentPage < totalPages
                ? () => onPageSelected(currentPage + 1)
                : null,
            icon: const Icon(Icons.chevron_right),
          ),
        ],
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
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(citizenProfileProvider);
    return SafeArea(
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
                    profile.when(
                      loading: () => const CircularProgressIndicator(),
                      error: (_, __) => TextButton(
                        onPressed: () => ref.invalidate(citizenProfileProvider),
                        child: const Text('โหลดโปรไฟล์อีกครั้ง'),
                      ),
                      data: (user) => Column(
                        children: [
                          CitizenAvatar(
                            profileImageUrl: user.profileImageUrl,
                            radius: 45,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            user.fullName,
                            style: const TextStyle(
                              fontSize: 21,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          if (user.phone != null) Text(user.phone!),
                        ],
                      ),
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
          'ชื่อ รูปโปรไฟล์ และอีเมล (เมื่อผู้ใช้อนุญาต) จากบัญชี LINE รวมถึงรายละเอียดและภาพเหตุการณ์ พิกัดตำแหน่ง และประวัติสถานะ',
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
