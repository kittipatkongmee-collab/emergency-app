import {
  AdminRole,
  IncidentPriority,
  IncidentStatus,
  IncidentType,
  PrismaClient,
} from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function seedAdmins(passwordHash: string) {
  const positionNames: Record<AdminRole, string> = {
    [AdminRole.SUPER_ADMIN]: 'ผู้ดูแลระบบสูงสุด',
    [AdminRole.SUPERVISOR]: 'หัวหน้าศูนย์',
    [AdminRole.OFFICER]: 'เจ้าหน้าที่ปฏิบัติการ',
    [AdminRole.VIEWER]: 'ผู้ดูข้อมูล',
  };
  const positionIds = new Map<AdminRole, string>();
  for (const role of Object.values(AdminRole)) {
    const name = positionNames[role];
    const position = await prisma.staffPosition.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    positionIds.set(role, position.id);
  }

  const definitions = [
    {
      username: process.env.ADMIN_SEED_USERNAME ?? 'admin',
      fullName: process.env.ADMIN_SEED_FULL_NAME ?? 'ผู้ดูแลระบบ',
      role: AdminRole.SUPER_ADMIN,
    },
    {
      username: 'supervisor1',
      fullName: 'หัวหน้าศูนย์ปฏิบัติการ',
      role: AdminRole.SUPERVISOR,
    },
    ...Array.from({ length: 3 }, (_, index) => ({
      username: `officer${index + 1}`,
      fullName: `เจ้าหน้าที่ปฏิบัติการ ${index + 1}`,
      role: AdminRole.OFFICER,
    })),
    {
      username: 'viewer1',
      fullName: 'เจ้าหน้าที่ตรวจสอบข้อมูล',
      role: AdminRole.VIEWER,
    },
  ];

  for (const definition of definitions) {
    await prisma.adminUser.upsert({
      where: { username: definition.username },
      update: {
        fullName: definition.fullName,
        role: definition.role,
        positionId: positionIds.get(definition.role),
        passwordHash,
        status: 'ACTIVE',
      },
      create: {
        ...definition,
        positionId: positionIds.get(definition.role),
        passwordHash,
        status: 'ACTIVE',
      },
    });
  }
}

interface DemoIncidentDefinition {
  readonly reporterName: string;
  readonly reporterPhone: string;
  readonly type: IncidentType;
  readonly description: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly address: string;
  readonly district: string;
  readonly province: string;
  readonly postalCode: string;
  readonly status: IncidentStatus;
  readonly priority: IncidentPriority;
}

const demoIncidents: readonly DemoIncidentDefinition[] = [
  {
    reporterName: 'สมชาย ใจดี',
    reporterPhone: '0812345601',
    type: IncidentType.AIRCRAFT_ACCIDENT,
    description: 'พบอากาศยานขนาดเล็กลงจอดฉุกเฉินใกล้ท่าอากาศยานดอนเมือง',
    latitude: 13.9126,
    longitude: 100.6068,
    address: 'ท่าอากาศยานดอนเมือง ถนนวิภาวดีรังสิต',
    district: 'ดอนเมือง',
    province: 'กรุงเทพมหานคร',
    postalCode: '10210',
    status: IncidentStatus.RECEIVED,
    priority: IncidentPriority.HIGH,
  },
  {
    reporterName: 'วิภาดา แสงสว่าง',
    reporterPhone: '0812345602',
    type: IncidentType.DISASTER_RELIEF,
    description: 'น้ำท่วมขังในชุมชนริมคลองและประชาชนต้องการการอพยพเร่งด่วน',
    latitude: 13.7285,
    longitude: 100.5341,
    address: 'ชุมชนริมคลอง เขตคลองเตย กรุงเทพมหานคร',
    district: 'คลองเตย',
    province: 'กรุงเทพมหานคร',
    postalCode: '10110',
    status: IncidentStatus.RECEIVED,
    priority: IncidentPriority.HIGH,
  },
  {
    reporterName: 'ธนพล สืบสง่า',
    reporterPhone: '0812345603',
    type: IncidentType.AIRCRAFT_ACCIDENT,
    description: 'เฮลิคอปเตอร์แจ้งขัดข้องระหว่างเข้าใกล้ท่าอากาศยานเชียงใหม่',
    latitude: 18.7668,
    longitude: 98.9626,
    address: 'ท่าอากาศยานนานาชาติเชียงใหม่',
    district: 'เมืองเชียงใหม่',
    province: 'เชียงใหม่',
    postalCode: '50200',
    status: IncidentStatus.RECEIVED,
    priority: IncidentPriority.CRITICAL,
  },
  {
    reporterName: 'ชลธิชา พรหมมา',
    reporterPhone: '0812345604',
    type: IncidentType.DISASTER_RELIEF,
    description: 'เกิดไฟป่าใกล้พื้นที่ชุมชนและมีควันหนาแน่นปกคลุมเส้นทาง',
    latitude: 19.9105,
    longitude: 99.8406,
    address: 'ตำบลแม่ยาว อำเภอเมืองเชียงราย',
    district: 'เมืองเชียงราย',
    province: 'เชียงราย',
    postalCode: '57100',
    status: IncidentStatus.RECEIVED,
    priority: IncidentPriority.CRITICAL,
  },
  {
    reporterName: 'เอกชัย ใจกว้าง',
    reporterPhone: '0812345605',
    type: IncidentType.AIRCRAFT_ACCIDENT,
    description: 'อากาศยานประสบปัญหาระบบล้อและต้องการหน่วยสนับสนุนภาคพื้น',
    latitude: 8.1132,
    longitude: 98.3169,
    address: 'ท่าอากาศยานนานาชาติภูเก็ต',
    district: 'ถลาง',
    province: 'ภูเก็ต',
    postalCode: '83110',
    status: IncidentStatus.IN_PROGRESS,
    priority: IncidentPriority.HIGH,
  },
  {
    reporterName: 'พิมพ์ชนก รักษ์ถิ่น',
    reporterPhone: '0812345606',
    type: IncidentType.DISASTER_RELIEF,
    description: 'ดินสไลด์ปิดเส้นทางขึ้นดอยและมีนักท่องเที่ยวติดค้างหลายคน',
    latitude: 18.8792,
    longitude: 98.8243,
    address: 'เส้นทางดอยสุเทพ ตำบลสุเทพ',
    district: 'เมืองเชียงใหม่',
    province: 'เชียงใหม่',
    postalCode: '50200',
    status: IncidentStatus.IN_PROGRESS,
    priority: IncidentPriority.HIGH,
  },
  {
    reporterName: 'นรินทร์ สุขใจ',
    reporterPhone: '0812345607',
    type: IncidentType.AIRCRAFT_ACCIDENT,
    description: 'เครื่องบินฝึกขอความช่วยเหลือหลังลงจอดฉุกเฉินนอกทางวิ่ง',
    latitude: 6.9332,
    longitude: 100.3929,
    address: 'ท่าอากาศยานนานาชาติหาดใหญ่',
    district: 'คลองหอยโข่ง',
    province: 'สงขลา',
    postalCode: '90115',
    status: IncidentStatus.IN_PROGRESS,
    priority: IncidentPriority.CRITICAL,
  },
  {
    reporterName: 'สุรีย์พร มีสุข',
    reporterPhone: '0812345608',
    type: IncidentType.DISASTER_RELIEF,
    description: 'พายุลมแรงทำให้หลังคาบ้านเรือนเสียหายและมีต้นไม้ล้มกีดขวาง',
    latitude: 7.9519,
    longitude: 98.3381,
    address: 'ตำบลวิชิต อำเภอเมืองภูเก็ต',
    district: 'เมืองภูเก็ต',
    province: 'ภูเก็ต',
    postalCode: '83000',
    status: IncidentStatus.IN_PROGRESS,
    priority: IncidentPriority.NORMAL,
  },
  {
    reporterName: 'กิตติพงษ์ ร่มเย็น',
    reporterPhone: '0812345609',
    type: IncidentType.AIRCRAFT_ACCIDENT,
    description:
      'อากาศยานแจ้งเตือนเครื่องยนต์และจอดรอการตรวจสอบในพื้นที่ปลอดภัย',
    latitude: 17.3864,
    longitude: 102.7883,
    address: 'ท่าอากาศยานนานาชาติอุดรธานี',
    district: 'เมืองอุดรธานี',
    province: 'อุดรธานี',
    postalCode: '41000',
    status: IncidentStatus.IN_PROGRESS,
    priority: IncidentPriority.HIGH,
  },
  {
    reporterName: 'จารุณี ทองดี',
    reporterPhone: '0812345610',
    type: IncidentType.DISASTER_RELIEF,
    description: 'น้ำป่าไหลหลากเข้าท่วมพื้นที่เกษตรและบ้านเรือนริมแม่น้ำ',
    latitude: 9.1382,
    longitude: 99.3217,
    address: 'ตำบลพุนพิน อำเภอพุนพิน',
    district: 'พุนพิน',
    province: 'สุราษฎร์ธานี',
    postalCode: '84130',
    status: IncidentStatus.IN_PROGRESS,
    priority: IncidentPriority.CRITICAL,
  },
  {
    reporterName: 'ปกรณ์ กล้าหาญ',
    reporterPhone: '0812345611',
    type: IncidentType.AIRCRAFT_ACCIDENT,
    description: 'เฮลิคอปเตอร์ฝึกบินลงจอดฉุกเฉินและลูกเรือปลอดภัยทั้งหมด',
    latitude: 19.9523,
    longitude: 99.8829,
    address: 'ท่าอากาศยานแม่ฟ้าหลวง เชียงราย',
    district: 'เมืองเชียงราย',
    province: 'เชียงราย',
    postalCode: '57100',
    status: IncidentStatus.IN_PROGRESS,
    priority: IncidentPriority.NORMAL,
  },
  {
    reporterName: 'รัตนา บุญส่ง',
    reporterPhone: '0812345612',
    type: IncidentType.DISASTER_RELIEF,
    description: 'เกิดไฟไหม้ป่าหญ้าใกล้ชุมชนและต้องการอากาศยานสนับสนุนดับไฟ',
    latitude: 14.9799,
    longitude: 102.0977,
    address: 'ตำบลโคกกรวด อำเภอเมืองนครราชสีมา',
    district: 'เมืองนครราชสีมา',
    province: 'นครราชสีมา',
    postalCode: '30280',
    status: IncidentStatus.IN_PROGRESS,
    priority: IncidentPriority.HIGH,
  },
  {
    reporterName: 'อำนาจ วิไล',
    reporterPhone: '0812345613',
    type: IncidentType.AIRCRAFT_ACCIDENT,
    description:
      'เครื่องบินโดยสารแจ้งเหตุขัดข้องก่อนลงจอดและเข้าจอดได้อย่างปลอดภัย',
    latitude: 16.4666,
    longitude: 102.7837,
    address: 'ท่าอากาศยานขอนแก่น',
    district: 'เมืองขอนแก่น',
    province: 'ขอนแก่น',
    postalCode: '40000',
    status: IncidentStatus.COMPLETED,
    priority: IncidentPriority.HIGH,
  },
  {
    reporterName: 'เบญจมาศ ศรีทอง',
    reporterPhone: '0812345614',
    type: IncidentType.DISASTER_RELIEF,
    description: 'น้ำล้นตลิ่งเข้าท่วมชุมชนและดำเนินการอพยพประชาชนเรียบร้อยแล้ว',
    latitude: 14.3532,
    longitude: 100.5689,
    address: 'ตำบลบ้านเกาะ อำเภอพระนครศรีอยุธยา',
    district: 'พระนครศรีอยุธยา',
    province: 'พระนครศรีอยุธยา',
    postalCode: '13000',
    status: IncidentStatus.COMPLETED,
    priority: IncidentPriority.HIGH,
  },
  {
    reporterName: 'ชัยวัฒน์ มั่นคง',
    reporterPhone: '0812345615',
    type: IncidentType.AIRCRAFT_ACCIDENT,
    description: 'อากาศยานขนส่งมีสัญญาณเตือนระบบไฟฟ้าและได้รับการช่วยเหลือแล้ว',
    latitude: 9.1326,
    longitude: 99.1356,
    address: 'ท่าอากาศยานสุราษฎร์ธานี',
    district: 'พุนพิน',
    province: 'สุราษฎร์ธานี',
    postalCode: '84130',
    status: IncidentStatus.COMPLETED,
    priority: IncidentPriority.NORMAL,
  },
  {
    reporterName: 'อรทัย พูนผล',
    reporterPhone: '0812345616',
    type: IncidentType.DISASTER_RELIEF,
    description:
      'พายุฤดูร้อนสร้างความเสียหายต่อบ้านเรือนและส่งมอบสิ่งของช่วยเหลือแล้ว',
    latitude: 16.4322,
    longitude: 102.8236,
    address: 'ตำบลในเมือง อำเภอเมืองขอนแก่น',
    district: 'เมืองขอนแก่น',
    province: 'ขอนแก่น',
    postalCode: '40000',
    status: IncidentStatus.COMPLETED,
    priority: IncidentPriority.NORMAL,
  },
  {
    reporterName: 'ณัฐวุฒิ พิทักษ์',
    reporterPhone: '0812345617',
    type: IncidentType.AIRCRAFT_ACCIDENT,
    description:
      'เฮลิคอปเตอร์ตรวจการณ์ลงจอดฉุกเฉินและเคลื่อนย้ายออกจากพื้นที่แล้ว',
    latitude: 12.6799,
    longitude: 101.005,
    address: 'ท่าอากาศยานนานาชาติอู่ตะเภา',
    district: 'บ้านฉาง',
    province: 'ระยอง',
    postalCode: '21130',
    status: IncidentStatus.COMPLETED,
    priority: IncidentPriority.HIGH,
  },
  {
    reporterName: 'ศิริพร มากมี',
    reporterPhone: '0812345618',
    type: IncidentType.DISASTER_RELIEF,
    description:
      'น้ำท่วมฉับพลันในชุมชนและเจ้าหน้าที่ช่วยเหลือผู้ประสบภัยครบถ้วนแล้ว',
    latitude: 7.0086,
    longitude: 100.4747,
    address: 'ตำบลคอหงส์ อำเภอหาดใหญ่',
    district: 'หาดใหญ่',
    province: 'สงขลา',
    postalCode: '90110',
    status: IncidentStatus.COMPLETED,
    priority: IncidentPriority.CRITICAL,
  },
  {
    reporterName: 'วรเมธ เกื้อกูล',
    reporterPhone: '0812345619',
    type: IncidentType.AIRCRAFT_ACCIDENT,
    description: 'อากาศยานฝึกบินประสบเหตุยางแตกและเคลียร์ทางวิ่งเรียบร้อยแล้ว',
    latitude: 12.6362,
    longitude: 99.9515,
    address: 'ท่าอากาศยานหัวหิน',
    district: 'หัวหิน',
    province: 'ประจวบคีรีขันธ์',
    postalCode: '77110',
    status: IncidentStatus.COMPLETED,
    priority: IncidentPriority.NORMAL,
  },
  {
    reporterName: 'กมลชนก ทะเลงาม',
    reporterPhone: '0812345620',
    type: IncidentType.DISASTER_RELIEF,
    description:
      'คลื่นลมแรงทำให้เรือประมงขอความช่วยเหลือและนำลูกเรือขึ้นฝั่งแล้ว',
    latitude: 12.2428,
    longitude: 102.5151,
    address: 'ชายฝั่งอ่าวไทย อำเภอเมืองตราด',
    district: 'เมืองตราด',
    province: 'ตราด',
    postalCode: '23000',
    status: IncidentStatus.COMPLETED,
    priority: IncidentPriority.HIGH,
  },
];

async function seedDemoIncidents() {
  if (process.env.NODE_ENV === 'production') return;

  const aircraftCount = demoIncidents.filter(
    (incident) => incident.type === IncidentType.AIRCRAFT_ACCIDENT,
  ).length;
  const reliefCount = demoIncidents.filter(
    (incident) => incident.type === IncidentType.DISASTER_RELIEF,
  ).length;
  if (
    demoIncidents.length !== 20 ||
    aircraftCount !== 10 ||
    reliefCount !== 10
  ) {
    throw new Error('ข้อมูลตัวอย่างต้องมี 20 รายการและแบ่งประเภทละ 10 รายการ');
  }

  const citizen = await prisma.citizenUser.upsert({
    where: { facebookId: 'development-seed-citizen-thailand' },
    update: {
      fullName: 'ผู้แจ้งเหตุตัวอย่างในประเทศไทย',
      phone: '0812345600',
      status: 'ACTIVE',
    },
    create: {
      facebookId: 'development-seed-citizen-thailand',
      fullName: 'ผู้แจ้งเหตุตัวอย่างในประเทศไทย',
      phone: '0812345600',
      status: 'ACTIVE',
    },
  });
  const officer = await prisma.adminUser.findUnique({
    where: { username: 'officer1' },
  });
  const baseReportedAt = new Date('2026-08-04T12:00:00.000Z');

  for (const [index, definition] of demoIncidents.entries()) {
    const sequence = String(index + 1).padStart(4, '0');
    const reportedAt = new Date(
      baseReportedAt.getTime() - index * 18 * 60 * 60 * 1000,
    );
    const completedAt =
      definition.status === IncidentStatus.COMPLETED
        ? new Date(reportedAt.getTime() + 3 * 60 * 60 * 1000)
        : null;
    const assignedAdminUserId =
      definition.status === IncidentStatus.RECEIVED ? null : officer?.id;
    const incident = await prisma.incident.upsert({
      where: { caseCode: `DEMO-TH-2026-${sequence}` },
      update: {
        citizenUserId: citizen.id,
        reporterName: definition.reporterName,
        reporterPhone: definition.reporterPhone,
        type: definition.type,
        description: definition.description,
        latitude: definition.latitude,
        longitude: definition.longitude,
        address: definition.address,
        district: definition.district,
        province: definition.province,
        postalCode: definition.postalCode,
        status: definition.status,
        priority: definition.priority,
        assignedAdminUserId,
        reportedAt,
        completedAt,
      },
      create: {
        caseCode: `DEMO-TH-2026-${sequence}`,
        clientRequestId: `development-seed-thailand-${sequence}`,
        citizenUserId: citizen.id,
        reporterName: definition.reporterName,
        reporterPhone: definition.reporterPhone,
        type: definition.type,
        description: definition.description,
        latitude: definition.latitude,
        longitude: definition.longitude,
        address: definition.address,
        district: definition.district,
        province: definition.province,
        postalCode: definition.postalCode,
        status: definition.status,
        priority: definition.priority,
        assignedAdminUserId,
        reportedAt,
        completedAt,
      },
    });

    await prisma.incidentStatusHistory.deleteMany({
      where: { incidentId: incident.id },
    });
    await prisma.incidentStatusHistory.create({
      data: {
        incidentId: incident.id,
        toStatus: IncidentStatus.RECEIVED,
        note: 'รอดำเนินการ',
        changedAt: reportedAt,
      },
    });
    if (definition.status !== IncidentStatus.RECEIVED) {
      await prisma.incidentStatusHistory.create({
        data: {
          incidentId: incident.id,
          fromStatus: IncidentStatus.RECEIVED,
          toStatus: IncidentStatus.IN_PROGRESS,
          note: 'เจ้าหน้าที่กำลังดำเนินการ',
          changedByAdminUserId: officer?.id,
          changedAt: new Date(reportedAt.getTime() + 60 * 60 * 1000),
        },
      });
    }
    if (definition.status === IncidentStatus.COMPLETED) {
      await prisma.incidentStatusHistory.create({
        data: {
          incidentId: incident.id,
          fromStatus: IncidentStatus.IN_PROGRESS,
          toStatus: IncidentStatus.COMPLETED,
          note: 'ภารกิจสำเร็จ',
          changedByAdminUserId: officer?.id,
          changedAt: completedAt!,
        },
      });
    }
  }

  const [seededCount, seededAircraftCount, seededReliefCount] =
    await Promise.all([
      prisma.incident.count({
        where: { caseCode: { startsWith: 'DEMO-TH-2026-' } },
      }),
      prisma.incident.count({
        where: {
          caseCode: { startsWith: 'DEMO-TH-2026-' },
          type: IncidentType.AIRCRAFT_ACCIDENT,
        },
      }),
      prisma.incident.count({
        where: {
          caseCode: { startsWith: 'DEMO-TH-2026-' },
          type: IncidentType.DISASTER_RELIEF,
        },
      }),
    ]);
  if (
    seededCount !== 20 ||
    seededAircraftCount !== 10 ||
    seededReliefCount !== 10
  ) {
    throw new Error('ตรวจสอบข้อมูลตัวอย่างในฐานข้อมูลไม่ผ่าน');
  }
  console.log(
    `สร้างข้อมูลแจ้งเหตุตัวอย่าง ${seededCount} รายการ (อากาศยาน ${seededAircraftCount}, บรรเทาสาธารณภัย ${seededReliefCount})`,
  );
}

async function main() {
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error('ADMIN_SEED_PASSWORD ต้องมีอย่างน้อย 12 ตัวอักษร');
  }

  await seedAdmins(await argon2.hash(password));
  await seedDemoIncidents();

  const superAdmin = await prisma.adminUser.findUniqueOrThrow({
    where: { username: process.env.ADMIN_SEED_USERNAME ?? 'admin' },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'emergencyContact' },
    update: {
      value: {
        phone: '025091520',
        hours: '24 ชั่วโมง',
        announcement: '',
      },
      updatedByAdminUserId: superAdmin.id,
    },
    create: {
      key: 'emergencyContact',
      value: {
        phone: '025091520',
        hours: '24 ชั่วโมง',
        announcement: '',
      },
      updatedByAdminUserId: superAdmin.id,
    },
  });
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Seed failed');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
