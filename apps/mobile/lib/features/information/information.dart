import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';

import '../../core/app_core.dart';

class AircraftSpecification {
  const AircraftSpecification({required this.label, required this.value});

  final String label;
  final String value;
}

class AircraftSpecificationSection {
  const AircraftSpecificationSection({
    required this.title,
    required this.items,
  });

  final String title;
  final List<AircraftSpecification> items;
}

class AircraftInformation {
  const AircraftInformation({
    required this.id,
    required this.title,
    required this.thumbnailAsset,
    this.galleryAssets = const [],
    this.videoAsset,
    this.specificationSections = const [],
  });

  final String id;
  final String title;
  final String thumbnailAsset;
  final List<String> galleryAssets;
  final String? videoAsset;
  final List<AircraftSpecificationSection> specificationSections;
}

const aircraftInformationCatalog = <AircraftInformation>[
  AircraftInformation(
    id: 'bell-429-global-ranger',
    title: 'เฮลิคอปเตอร์ แบบ Bell429 GlobalRanger',
    thumbnailAsset: 'assets/images/bell-429-global-ranger.jpg',
    galleryAssets: [
      'assets/images/aircraft/bell-429/gallery-01.jpg',
      'assets/images/aircraft/bell-429/gallery-02.jpg',
      'assets/images/aircraft/bell-429/gallery-03.jpg',
      'assets/images/aircraft/bell-429/gallery-04.jpg',
      'assets/images/aircraft/bell-429/gallery-05.jpg',
    ],
    specificationSections: [
      AircraftSpecificationSection(
        title: 'Exterior',
        items: [
          AircraftSpecification(label: 'Exterior Height', value: '13 ft 3 in'),
          AircraftSpecification(label: 'Wing Span', value: '36 ft 0 in'),
          AircraftSpecification(label: 'Length', value: '41 ft 8 in'),
        ],
      ),
      AircraftSpecificationSection(
        title: 'Interior',
        items: [
          AircraftSpecification(label: 'Cabin Volume', value: '130 cu ft'),
          AircraftSpecification(label: 'Internal Baggage', value: '50 cu ft'),
        ],
      ),
      AircraftSpecificationSection(
        title: 'Occupancy',
        items: [
          AircraftSpecification(label: 'Crew', value: '2'),
          AircraftSpecification(label: 'Passengers', value: '5'),
        ],
      ),
      AircraftSpecificationSection(
        title: 'Operating Weights',
        items: [
          AircraftSpecification(label: 'Max T/O Weight', value: '7000 Lb'),
          AircraftSpecification(label: 'Operating Weight', value: '4647 Lb'),
          AircraftSpecification(label: 'Empty Weight', value: '4245 Lb'),
          AircraftSpecification(label: 'Fuel Capacity', value: '1471 Lb'),
          AircraftSpecification(label: 'Payload W/Full Fuel', value: '882 Lb'),
          AircraftSpecification(label: 'Max Payload', value: '2353 Lb'),
        ],
      ),
      AircraftSpecificationSection(
        title: 'Range',
        items: [
          AircraftSpecification(label: 'Service Ceiling', value: '20000 ft'),
        ],
      ),
      AircraftSpecificationSection(
        title: 'Performance',
        items: [
          AircraftSpecification(label: 'Rate of Climb', value: '2750 fpm'),
          AircraftSpecification(
            label: 'Climb Rate One Engine Inop',
            value: '300 fpm',
          ),
          AircraftSpecification(label: 'Max Speed', value: '155 kts'),
          AircraftSpecification(label: 'Normal Cruise', value: '150 kts'),
          AircraftSpecification(label: 'Economy Cruise', value: '130 kts'),
          AircraftSpecification(label: 'Cost per Hour', value: r'$ 1,075.85'),
        ],
      ),
      AircraftSpecificationSection(
        title: 'Power Plant',
        items: [
          AircraftSpecification(label: 'Engines', value: '2'),
          AircraftSpecification(
            label: 'Engine Mfg',
            value: 'Pratt & Whitney Canada',
          ),
          AircraftSpecification(label: 'Engine Model', value: 'PW207D1'),
        ],
      ),
    ],
  ),
  AircraftInformation(
    id: 'bell-412-ep',
    title: 'เฮลิคอปเตอร์ แบบ Bell 412 EP',
    thumbnailAsset: 'assets/images/bell-412-ep.jpg',
    galleryAssets: [
      'assets/images/aircraft/bell-412/gallery-01.jpg',
      'assets/images/aircraft/bell-412/gallery-02.jpg',
      'assets/images/aircraft/bell-412/gallery-03.jpg',
      'assets/images/aircraft/bell-412/gallery-04.jpg',
      'assets/images/aircraft/bell-412/gallery-05.jpg',
      'assets/images/aircraft/bell-412/gallery-06.jpg',
    ],
    videoAsset: 'assets/videos/aircraft/bell-412/trat.mp4',
    specificationSections: [
      AircraftSpecificationSection(
        title: 'General characteristics',
        items: [
          AircraftSpecification(label: 'Crew', value: 'one-two pilots'),
          AircraftSpecification(
            label: 'Capacity',
            value:
                'up to 13 passengers, maximum external load of almost 6,614 lb (3,000 kg)',
          ),
          AircraftSpecification(
            label: 'Length',
            value: '56 ft 1 in (17.09 m) including rotors',
          ),
          AircraftSpecification(
            label: 'Fuselage length',
            value: '43 ft (13 m)',
          ),
          AircraftSpecification(label: 'Height', value: '15 ft 0 in (4.57 m)'),
          AircraftSpecification(
            label: 'Empty weight',
            value: '6,789 lb (3,079 kg)',
          ),
          AircraftSpecification(
            label: 'Max takeoff weight',
            value: '11,900 lb (5,398 kg)',
          ),
          AircraftSpecification(
            label: 'Powerplant',
            value:
                '1 × Pratt & Whitney Canada PT6T-3D Twin-Pac or PT6T-3DF Twin-Pac coupled turboshaft engine, 1,250 shp (930 kW) / 900 shp (671 kW) single power section emergency power',
          ),
          AircraftSpecification(
            label: 'Main rotor diameter',
            value: '46 ft 0 in (14.02 m)',
          ),
          AircraftSpecification(
            label: 'Main rotor area',
            value: '1,662 sq ft (154.4 m²)',
          ),
          AircraftSpecification(
            label: 'Blade sections',
            value: 'root: Boeing VR-7; tip: Wortmann FX 71-H-080',
          ),
        ],
      ),
      AircraftSpecificationSection(
        title: 'Performance',
        items: [
          AircraftSpecification(
            label: 'Maximum speed',
            value: '140 kn (160 mph, 260 km/h)',
          ),
          AircraftSpecification(
            label: 'Cruise speed',
            value: '122 kn (140 mph, 226 km/h)',
          ),
          AircraftSpecification(
            label: 'Range',
            value: '529 nmi (609 mi, 980 km)',
          ),
          AircraftSpecification(
            label: 'Service ceiling',
            value: '20,000 ft (6,100 m)',
          ),
          AircraftSpecification(
            label: 'Rate of climb',
            value: '1,350 ft/min (6.9 m/s)',
          ),
          AircraftSpecification(
            label: 'Power/mass',
            value: '0.2663 hp/lb (0.4378 kW/kg)',
          ),
        ],
      ),
    ],
  ),
  AircraftInformation(
    id: 'as365n3-dauphin',
    title: 'เฮลิคอปเตอร์ค้นหาและกู้ภัย AS365N3+ Dauphin',
    thumbnailAsset: 'assets/images/as365n3-dauphin.gif',
    galleryAssets: [
      'assets/images/aircraft/as365n3-dauphin/gallery-01.jpg',
      'assets/images/aircraft/as365n3-dauphin/gallery-02.jpg',
      'assets/images/aircraft/as365n3-dauphin/gallery-03.jpg',
      'assets/images/aircraft/as365n3-dauphin/gallery-04.gif',
      'assets/images/aircraft/as365n3-dauphin/gallery-05.jpg',
      'assets/images/aircraft/as365n3-dauphin/gallery-06.jpg',
    ],
    videoAsset: 'assets/videos/aircraft/as365n3-dauphin/as.mp4',
    specificationSections: [
      AircraftSpecificationSection(
        title: 'General characteristics',
        items: [
          AircraftSpecification(label: 'Crew', value: '1 or 2 pilots'),
          AircraftSpecification(label: 'Capacity', value: '11 passengers'),
          AircraftSpecification(label: 'Length', value: '13.73 m (45 ft 1 in)'),
          AircraftSpecification(label: 'Height', value: '4.06 m (13 ft 4 in)'),
          AircraftSpecification(
            label: 'Empty weight',
            value: '2,411 kg (5,315 lb)',
          ),
          AircraftSpecification(
            label: 'Max takeoff weight',
            value: '4,300 kg (9,480 lb)',
          ),
          AircraftSpecification(
            label: 'Powerplant',
            value:
                '2 × Turboméca Arriel 2C turboshaft, Take-off Power, 625 kW (838 hp) each',
          ),
          AircraftSpecification(
            label: 'Main rotor diameter',
            value: '11.94 m (39 ft 2 in)',
          ),
          AircraftSpecification(
            label: 'Main rotor area',
            value: '111.98 m² (1,205.3 sq ft)',
          ),
        ],
      ),
      AircraftSpecificationSection(
        title: 'Performance',
        items: [
          AircraftSpecification(
            label: 'Maximum speed',
            value: '306 km/h (190 mph; 165 kn)',
          ),
          AircraftSpecification(
            label: 'Ferry range',
            value: '827 km (514 mi; 447 nmi)',
          ),
          AircraftSpecification(
            label: 'Service ceiling',
            value: '5,865 m (19,242 ft)',
          ),
          AircraftSpecification(
            label: 'Rate of climb',
            value: '8.9 m/s (1,750 ft/min)',
          ),
        ],
      ),
    ],
  ),
];

AircraftInformation? aircraftInformationById(String id) {
  for (final item in aircraftInformationCatalog) {
    if (item.id == id) return item;
  }
  return null;
}

class InformationTab extends StatelessWidget {
  const InformationTab({super.key});

  @override
  Widget build(BuildContext context) => SafeArea(
    child: Scaffold(
      appBar: AppBar(
        title: const Text('ข้อมูล'),
        actions: const [
          Padding(
            padding: EdgeInsets.only(right: 14),
            child: PoliceAviationLogo(size: 42),
          ),
        ],
      ),
      body: ListView.separated(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 28),
        itemCount: aircraftInformationCatalog.length,
        separatorBuilder: (_, __) => const SizedBox(height: 16),
        itemBuilder: (context, index) {
          final item = aircraftInformationCatalog[index];
          return _AircraftInformationCard(
            item: item,
            onTap: () => context.push('/information/${item.id}'),
          );
        },
      ),
    ),
  );
}

class _AircraftInformationCard extends StatelessWidget {
  const _AircraftInformationCard({required this.item, required this.onTap});

  final AircraftInformation item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      key: ValueKey('aircraft-information-${item.id}'),
      borderRadius: BorderRadius.circular(AppTheme.borderRadius),
      onTap: onTap,
      child: SizedBox(
        height: 142,
        child: Row(
          children: [
            SizedBox(
              width: 126,
              height: double.infinity,
              child: Image.asset(
                item.thumbnailAsset,
                fit: BoxFit.cover,
                filterQuality: FilterQuality.high,
                gaplessPlayback: true,
                semanticLabel: 'รูป ${item.title}',
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      item.title,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppTheme.primaryDark,
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'แตะเพื่อดูรูปภาพและรายละเอียด',
                      style: TextStyle(
                        color: AppTheme.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const Padding(
              padding: EdgeInsets.only(right: 12),
              child: Icon(Icons.chevron_right, color: AppTheme.primary),
            ),
          ],
        ),
      ),
    ),
  );
}

class AircraftInformationDetailScreen extends StatefulWidget {
  const AircraftInformationDetailScreen({required this.aircraftId, super.key});

  final String aircraftId;

  @override
  State<AircraftInformationDetailScreen> createState() =>
      _AircraftInformationDetailScreenState();
}

class _AircraftInformationDetailScreenState
    extends State<AircraftInformationDetailScreen> {
  static const placeholderImageCount = 3;
  int selectedImage = 0;

  @override
  Widget build(BuildContext context) {
    final item = aircraftInformationById(widget.aircraftId);
    if (item == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('ข้อมูลอากาศยาน')),
        body: const Center(child: Text('ไม่พบข้อมูลอากาศยาน')),
      );
    }
    final imageCount = item.galleryAssets.isEmpty
        ? placeholderImageCount
        : item.galleryAssets.length;
    final mediaCount = imageCount + (item.videoAsset == null ? 0 : 1);
    final selectedMediaIsVideo =
        item.videoAsset != null && selectedImage == imageCount;

    return Scaffold(
      appBar: AppBar(title: const Text('รายละเอียดอากาศยาน')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 30),
        children: [
          Text(
            item.title,
            style: const TextStyle(
              color: AppTheme.primaryDark,
              fontSize: 22,
              fontWeight: FontWeight.w800,
              height: 1.3,
            ),
          ),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(22),
            child: AspectRatio(
              aspectRatio: 16 / 10,
              child: PageView.builder(
                itemCount: mediaCount,
                onPageChanged: (index) => setState(() => selectedImage = index),
                itemBuilder: (_, index) {
                  if (index == imageCount && item.videoAsset != null) {
                    return _AircraftVideoPlayer(
                      key: ValueKey(item.videoAsset),
                      assetPath: item.videoAsset!,
                      active: selectedMediaIsVideo,
                    );
                  }
                  return item.galleryAssets.isEmpty
                      ? _GalleryPlaceholder(index: index)
                      : Image.asset(
                          item.galleryAssets[index],
                          fit: BoxFit.cover,
                          filterQuality: FilterQuality.high,
                          semanticLabel:
                              'รูป ${item.title} ลำดับที่ ${index + 1}',
                        );
                },
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var index = 0; index < mediaCount; index++)
                AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: selectedImage == index ? 24 : 8,
                  height: 8,
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  decoration: BoxDecoration(
                    color: selectedImage == index
                        ? AppTheme.primary
                        : AppTheme.borderColor,
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Center(
            child: Text(
              selectedMediaIsVideo
                  ? 'วิดีโอ 1 จาก 1'
                  : 'รูปภาพ ${selectedImage + 1} จาก $imageCount',
              style: const TextStyle(
                color: AppTheme.textSecondary,
                fontSize: 12,
              ),
            ),
          ),
          const SizedBox(height: 20),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: AppTheme.primaryLight,
                        child: Icon(
                          Icons.description_outlined,
                          color: AppTheme.primary,
                        ),
                      ),
                      SizedBox(width: 12),
                      Text(
                        'รายละเอียด',
                        style: TextStyle(
                          color: AppTheme.primaryDark,
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  if (item.specificationSections.isEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: AppTheme.background,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppTheme.borderColor),
                      ),
                      child: const Text(
                        'รอข้อมูลรายละเอียดอากาศยาน',
                        style: TextStyle(
                          color: AppTheme.textSecondary,
                          height: 1.5,
                        ),
                      ),
                    )
                  else
                    for (
                      var sectionIndex = 0;
                      sectionIndex < item.specificationSections.length;
                      sectionIndex++
                    ) ...[
                      _SpecificationSection(
                        section: item.specificationSections[sectionIndex],
                      ),
                      if (sectionIndex < item.specificationSections.length - 1)
                        const SizedBox(height: 14),
                    ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AircraftVideoPlayer extends StatefulWidget {
  const _AircraftVideoPlayer({
    required this.assetPath,
    required this.active,
    super.key,
  });

  final String assetPath;
  final bool active;

  @override
  State<_AircraftVideoPlayer> createState() => _AircraftVideoPlayerState();
}

class _AircraftVideoPlayerState extends State<_AircraftVideoPlayer> {
  late final VideoPlayerController controller;

  @override
  void initState() {
    super.initState();
    controller = VideoPlayerController.asset(widget.assetPath)
      ..initialize().then((_) {
        if (mounted) setState(() {});
      });
  }

  @override
  void didUpdateWidget(covariant _AircraftVideoPlayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.active && !widget.active && controller.value.isPlaying) {
      controller.pause();
    }
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  void togglePlayback() {
    if (!controller.value.isInitialized) return;
    setState(() {
      if (controller.value.isPlaying) {
        controller.pause();
      } else {
        controller.play();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (controller.value.hasError) {
      return const ColoredBox(
        color: Colors.black,
        child: Center(
          child: Text(
            'ไม่สามารถเปิดวิดีโอได้',
            style: TextStyle(color: Colors.white),
          ),
        ),
      );
    }
    if (!controller.value.isInitialized) {
      return const ColoredBox(
        color: Colors.black,
        child: Center(child: CircularProgressIndicator(color: Colors.white)),
      );
    }

    return ColoredBox(
      color: Colors.black,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Center(
            child: AspectRatio(
              aspectRatio: controller.value.aspectRatio,
              child: VideoPlayer(controller),
            ),
          ),
          Semantics(
            button: true,
            label: controller.value.isPlaying
                ? 'หยุดวิดีโอชั่วคราว'
                : 'เล่นวิดีโอ',
            child: InkWell(
              onTap: togglePlayback,
              child: Center(
                child: AnimatedOpacity(
                  duration: const Duration(milliseconds: 180),
                  opacity: controller.value.isPlaying ? 0 : 1,
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: const BoxDecoration(
                      color: Colors.black54,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.play_arrow_rounded,
                      color: Colors.white,
                      size: 42,
                    ),
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            left: 12,
            right: 12,
            bottom: 10,
            child: VideoProgressIndicator(
              controller,
              allowScrubbing: true,
              colors: const VideoProgressColors(
                playedColor: AppTheme.primary,
                bufferedColor: Colors.white54,
                backgroundColor: Colors.white24,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SpecificationSection extends StatelessWidget {
  const _SpecificationSection({required this.section});

  final AircraftSpecificationSection section;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        section.title,
        style: const TextStyle(
          color: AppTheme.primary,
          fontSize: 17,
          fontWeight: FontWeight.w800,
        ),
      ),
      const SizedBox(height: 8),
      Container(
        decoration: BoxDecoration(
          color: AppTheme.background,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.borderColor),
        ),
        child: Column(
          children: [
            for (var index = 0; index < section.items.length; index++) ...[
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 11,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 6,
                      child: Text(
                        section.items[index].label,
                        style: const TextStyle(
                          color: AppTheme.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 5,
                      child: Text(
                        section.items[index].value,
                        textAlign: TextAlign.end,
                        style: const TextStyle(
                          color: AppTheme.primaryDark,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (index < section.items.length - 1)
                const Divider(height: 1, indent: 14, endIndent: 14),
            ],
          ],
        ),
      ),
    ],
  );
}

class _GalleryPlaceholder extends StatelessWidget {
  const _GalleryPlaceholder({required this.index});

  final int index;

  @override
  Widget build(BuildContext context) => Container(
    color: const Color(0xFFF8E8EA),
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(Icons.image_outlined, size: 64, color: AppTheme.primary),
        const SizedBox(height: 10),
        Text(
          'พื้นที่รูปภาพที่ ${index + 1}',
          style: const TextStyle(
            color: AppTheme.primaryDark,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'รอไฟล์รูปภาพจริง',
          style: TextStyle(color: AppTheme.textSecondary),
        ),
      ],
    ),
  );
}
