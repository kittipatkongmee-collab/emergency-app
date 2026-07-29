import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { PrismaService } from '../core/prisma.service';

export interface PushNotificationAdapter {
  incidentStatusChanged(
    citizenUserId: string,
    caseCode: string,
    status: string,
  ): Promise<void>;
}

@Injectable()
export class PushNotificationService
  implements PushNotificationAdapter, OnModuleInit
{
  private readonly logger = new Logger(PushNotificationService.name);
  private messaging?: Messaging;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const projectId = process.env.FCM_PROJECT_ID;
    const clientEmail = process.env.FCM_CLIENT_EMAIL;
    const privateKey = process.env.FCM_PRIVATE_KEY?.replaceAll('\\n', '\n');
    if (!projectId || !clientEmail || !privateKey) return;
    const app =
      getApps()[0] ??
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
    this.messaging = getMessaging(app);
  }

  async incidentStatusChanged(
    citizenUserId: string,
    caseCode: string,
    status: string,
  ) {
    if (!this.messaging) return;
    const devices = await this.prisma.deviceToken.findMany({
      where: { citizenUserId, isActive: true },
      select: { token: true },
    });
    if (!devices.length) return;
    try {
      await this.messaging.sendEachForMulticast({
        tokens: devices.map((device) => device.token),
        notification: {
          title: 'สถานะเหตุการณ์เปลี่ยนแปลง',
          body: `${caseCode}: ${status}`,
        },
        data: { caseCode, status },
      });
    } catch (error) {
      this.logger.warn(
        `FCM delivery failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}
