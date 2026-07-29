import { Module } from '@nestjs/common';
import {
  AdminOperationsController,
  HealthController,
  NotificationsController,
} from './operations.controller';
import {
  AdminIncidentsController,
  CitizenIncidentsController,
} from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { UploadService } from './upload.service';
import { PushNotificationService } from './push-notification.service';

@Module({
  controllers: [
    CitizenIncidentsController,
    AdminIncidentsController,
    AdminOperationsController,
    NotificationsController,
    HealthController,
  ],
  providers: [IncidentsService, UploadService, PushNotificationService],
})
export class IncidentsModule {}
