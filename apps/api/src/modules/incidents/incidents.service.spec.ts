import { AdminRole } from '@prisma/client';
import type { AuthPrincipal } from '../../common/auth';
import { PrismaService } from '../core/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { IncidentsService } from './incidents.service';
import { PushNotificationService } from './push-notification.service';
import { UploadService } from './upload.service';

describe('IncidentsService map points', () => {
  it('โหลดหมุดทั้งหมดที่เจ้าหน้าที่มีสิทธิ์เห็นโดยไม่แบ่งหน้า', async () => {
    const points = [
      {
        id: 'incident-1',
        caseCode: 'CASE-001',
        latitude: '13.7563000',
        longitude: '100.5018000',
        address: 'กรุงเทพมหานคร',
        status: 'IN_PROGRESS',
      },
    ];
    const prisma = {
      incident: { findMany: jest.fn().mockResolvedValue(points) },
    };
    const service = new IncidentsService(
      prisma as unknown as PrismaService,
      {} as RealtimeGateway,
      {} as PushNotificationService,
      {} as UploadService,
    );
    const principal: AuthPrincipal = {
      sub: 'officer-1',
      kind: 'admin',
      role: AdminRole.OFFICER,
    };

    await expect(service.listMapPoints(principal)).resolves.toEqual(points);
    expect(prisma.incident.findMany).toHaveBeenCalledWith({
      where: { assignedAdminUserId: 'officer-1' },
      select: {
        id: true,
        caseCode: true,
        latitude: true,
        longitude: true,
        address: true,
        status: true,
      },
      orderBy: { reportedAt: 'desc' },
    });
  });
});
