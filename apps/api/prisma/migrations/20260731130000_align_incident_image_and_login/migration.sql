ALTER TABLE `CitizenUser`
  MODIFY `lastLoginAt` DATETIME(3) NULL;

ALTER TABLE `IncidentImage`
  RENAME COLUMN `storageProvider` TO `storageDriver`;

CREATE INDEX `DeviceToken_citizenUserId_isActive_idx`
  ON `DeviceToken`(`citizenUserId`, `isActive`);
