-- Citizen identities are normalized so additional providers can be added safely.
ALTER TABLE `CitizenUser`
  MODIFY `facebookId` VARCHAR(191) NULL;

ALTER TABLE `Incident`
  ADD COLUMN `clientRequestId` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `Incident_clientRequestId_key`(`clientRequestId`);

CREATE TABLE `ExternalIdentity` (
    `id` CHAR(36) NOT NULL,
    `citizenUserId` CHAR(36) NOT NULL,
    `provider` ENUM('DEVELOPMENT', 'FACEBOOK') NOT NULL,
    `providerUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ExternalIdentity_provider_providerUserId_key`(`provider`, `providerUserId`),
    INDEX `ExternalIdentity_citizenUserId_idx`(`citizenUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Preserve existing notification rows while adopting the public enum contract.
ALTER TABLE `Notification`
  MODIFY `type` ENUM(
    'INCIDENT_CREATED',
    'INCIDENT_ASSIGNED',
    'INCIDENT_STATUS_CHANGED',
    'STATUS_CHANGED',
    'ASSIGNMENT',
    'SYSTEM'
  ) NOT NULL;
UPDATE `Notification`
SET `type` = 'INCIDENT_STATUS_CHANGED'
WHERE `type` = 'STATUS_CHANGED';
UPDATE `Notification`
SET `type` = 'INCIDENT_ASSIGNED'
WHERE `type` = 'ASSIGNMENT';
ALTER TABLE `Notification`
  MODIFY `type` ENUM(
    'INCIDENT_CREATED',
    'INCIDENT_ASSIGNED',
    'INCIDENT_STATUS_CHANGED',
    'SYSTEM'
  ) NOT NULL;

ALTER TABLE `IncidentNote`
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

ALTER TABLE `RefreshToken`
  ADD COLUMN `replacedByTokenId` CHAR(36) NULL,
  ADD UNIQUE INDEX `RefreshToken_replacedByTokenId_key`(`replacedByTokenId`),
  ADD INDEX `RefreshToken_expiresAt_idx`(`expiresAt`),
  ADD INDEX `RefreshToken_revokedAt_idx`(`revokedAt`);

CREATE TABLE `CaseCounter` (
    `id` CHAR(36) NOT NULL,
    `year` INTEGER NOT NULL,
    `lastNumber` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CaseCounter_year_key`(`year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `Incident_priority_idx` ON `Incident`(`priority`);
CREATE INDEX `Incident_status_reportedAt_idx` ON `Incident`(`status`, `reportedAt`);
CREATE INDEX `IncidentNote_incidentId_idx` ON `IncidentNote`(`incidentId`);
CREATE INDEX `IncidentNote_adminUserId_idx` ON `IncidentNote`(`adminUserId`);
CREATE INDEX `IncidentAssignment_incidentId_assignedAt_idx` ON `IncidentAssignment`(`incidentId`, `assignedAt`);
CREATE INDEX `IncidentAssignment_assignedToAdminUserId_unassignedAt_idx` ON `IncidentAssignment`(`assignedToAdminUserId`, `unassignedAt`);
CREATE INDEX `Notification_citizenUserId_isRead_idx` ON `Notification`(`citizenUserId`, `isRead`);
CREATE INDEX `Notification_adminUserId_isRead_idx` ON `Notification`(`adminUserId`, `isRead`);
CREATE INDEX `Notification_isRead_idx` ON `Notification`(`isRead`);
CREATE INDEX `Notification_createdAt_idx` ON `Notification`(`createdAt`);
CREATE INDEX `AuditLog_adminUserId_idx` ON `AuditLog`(`adminUserId`);
CREATE INDEX `AuditLog_action_idx` ON `AuditLog`(`action`);
CREATE INDEX `AuditLog_entityType_idx` ON `AuditLog`(`entityType`);

ALTER TABLE `ExternalIdentity`
  ADD CONSTRAINT `ExternalIdentity_citizenUserId_fkey`
  FOREIGN KEY (`citizenUserId`) REFERENCES `CitizenUser`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `RefreshToken`
  ADD CONSTRAINT `RefreshToken_replacedByTokenId_fkey`
  FOREIGN KEY (`replacedByTokenId`) REFERENCES `RefreshToken`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
