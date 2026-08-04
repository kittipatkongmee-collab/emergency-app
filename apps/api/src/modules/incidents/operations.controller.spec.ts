import { BadRequestException } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import type { AuthenticatedRequest } from '../../common/auth';
import { PrismaService } from '../core/prisma.service';
import { AdminOperationsController } from './operations.controller';

describe('AdminOperationsController user deletion', () => {
  function createPrisma(referenceCount = 0) {
    const prisma = {
      adminUser: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'officer-1',
          username: 'officer',
          role: AdminRole.OFFICER,
          status: 'ACTIVE',
        }),
        delete: jest.fn().mockResolvedValue({ id: 'officer-1' }),
      },
      incident: { count: jest.fn().mockResolvedValue(referenceCount) },
      incidentStatusHistory: { count: jest.fn().mockResolvedValue(0) },
      incidentNote: { count: jest.fn().mockResolvedValue(0) },
      incidentAssignment: { count: jest.fn().mockResolvedValue(0) },
      notification: { count: jest.fn().mockResolvedValue(0) },
      auditLog: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      systemSetting: { count: jest.fn().mockResolvedValue(0) },
      refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      $transaction: jest.fn((operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
    };
    return prisma;
  }

  function request(sub = 'admin-1') {
    return {
      user: { sub, kind: 'admin', role: AdminRole.SUPER_ADMIN },
    } as unknown as AuthenticatedRequest;
  }

  it('ลบบัญชีที่ยังไม่มีประวัติอ้างอิงและบันทึก audit log', async () => {
    const prisma = createPrisma();
    const controller = new AdminOperationsController(
      prisma as unknown as PrismaService,
    );

    await expect(
      controller.deleteUser(request(), 'officer-1'),
    ).resolves.toEqual({
      deleted: true,
    });
    expect(prisma.adminUser.delete).toHaveBeenCalledWith({
      where: { id: 'officer-1' },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        adminUserId: 'admin-1',
        action: 'ADMIN_DELETED',
        entityType: 'AdminUser',
        entityId: 'officer-1',
        oldValue: {
          username: 'officer',
          role: AdminRole.OFFICER,
          status: 'ACTIVE',
        },
      },
    });
  });

  it('ไม่ลบบัญชีที่มีประวัติการใช้งานเพื่อรักษาข้อมูลย้อนหลัง', async () => {
    const prisma = createPrisma(1);
    const controller = new AdminOperationsController(
      prisma as unknown as PrismaService,
    );

    await expect(
      controller.deleteUser(request(), 'officer-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.adminUser.delete).not.toHaveBeenCalled();
  });

  it('ไม่อนุญาตให้ผู้ใช้ลบบัญชีของตนเอง', async () => {
    const prisma = createPrisma();
    const controller = new AdminOperationsController(
      prisma as unknown as PrismaService,
    );

    await expect(
      controller.deleteUser(request('officer-1'), 'officer-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.adminUser.delete).not.toHaveBeenCalled();
  });
});

describe('AdminOperationsController staff positions', () => {
  function request() {
    return {
      user: { sub: 'admin-1', kind: 'admin', role: AdminRole.SUPER_ADMIN },
    } as unknown as AuthenticatedRequest;
  }

  it('บันทึกตำแหน่งใหม่และสร้าง audit log', async () => {
    const position = {
      id: 'position-1',
      name: 'เจ้าหน้าที่ประสานงาน',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const transactionClient = {
      staffPosition: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(position),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = {
      ...transactionClient,
      $transaction: jest.fn(
        async (operation: (tx: typeof transactionClient) => Promise<unknown>) =>
          operation(transactionClient),
      ),
    };
    const controller = new AdminOperationsController(
      prisma as unknown as PrismaService,
    );

    await expect(
      controller.createStaffPosition(request(), {
        name: ' เจ้าหน้าที่ประสานงาน ',
      }),
    ).resolves.toEqual(position);
    expect(prisma.staffPosition.create).toHaveBeenCalledWith({
      data: { name: 'เจ้าหน้าที่ประสานงาน' },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        adminUserId: 'admin-1',
        action: 'STAFF_POSITION_CREATED',
        entityType: 'StaffPosition',
        entityId: 'position-1',
        newValue: { name: 'เจ้าหน้าที่ประสานงาน' },
      },
    });
  });

  it('ไม่บันทึกชื่อตำแหน่งซ้ำ', async () => {
    const prisma = {
      staffPosition: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'position-1',
          name: 'เจ้าหน้าที่ปฏิบัติการ',
        }),
      },
    };
    const controller = new AdminOperationsController(
      prisma as unknown as PrismaService,
    );

    await expect(
      controller.createStaffPosition(request(), {
        name: 'เจ้าหน้าที่ปฏิบัติการ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AdminOperationsController dashboard date range', () => {
  function createDashboardPrisma() {
    const prisma = {
      incident: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
    };
    return prisma;
  }

  it('กรองข้อมูลสรุปตามวันในเขตเวลาไทยและรวมวันสิ้นสุด', async () => {
    const prisma = createDashboardPrisma();
    const controller = new AdminOperationsController(
      prisma as unknown as PrismaService,
    );

    await controller.summary({ dateFrom: '2026-08-01', dateTo: '2026-08-04' });

    expect(prisma.incident.count).toHaveBeenCalledWith({
      where: {
        reportedAt: {
          gte: new Date('2026-07-31T17:00:00.000Z'),
          lt: new Date('2026-08-04T17:00:00.000Z'),
        },
      },
    });
    expect(prisma.incident.count).toHaveBeenCalledWith({
      where: {
        reportedAt: {
          gte: new Date('2026-07-31T17:00:00.000Z'),
          lt: new Date('2026-08-04T17:00:00.000Z'),
        },
        status: 'RECEIVED',
      },
    });
  });

  it('กรองรายการล่าสุดด้วยช่วงวันที่เดียวกับข้อมูลสรุป', async () => {
    const prisma = createDashboardPrisma();
    const controller = new AdminOperationsController(
      prisma as unknown as PrismaService,
    );

    await controller.recent({ dateFrom: '2026-08-04', dateTo: '2026-08-04' });

    expect(prisma.incident.findMany).toHaveBeenCalledWith({
      where: {
        reportedAt: {
          gte: new Date('2026-08-03T17:00:00.000Z'),
          lt: new Date('2026-08-04T17:00:00.000Z'),
        },
      },
      take: 5,
      orderBy: { reportedAt: 'desc' },
      include: {
        images: { take: 1 },
        assignedAdminUser: { select: { id: true, fullName: true } },
      },
    });
  });

  it('ปฏิเสธช่วงวันที่ที่วันเริ่มต้นอยู่หลังวันสิ้นสุด', async () => {
    const prisma = createDashboardPrisma();
    const controller = new AdminOperationsController(
      prisma as unknown as PrismaService,
    );

    await expect(
      controller.summary({ dateFrom: '2026-08-05', dateTo: '2026-08-04' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.incident.count).not.toHaveBeenCalled();
  });
});
