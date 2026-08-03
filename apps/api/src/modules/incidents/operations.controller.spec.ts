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
