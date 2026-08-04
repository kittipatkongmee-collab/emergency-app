-- CreateTable
CREATE TABLE `StaffPosition` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StaffPosition_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `AdminUser` ADD COLUMN `positionId` CHAR(36) NULL;

-- Preserve the existing account labels as initial configurable positions.
INSERT INTO `StaffPosition` (`id`, `name`, `updatedAt`) VALUES
    (UUID(), 'ผู้ดูแลระบบสูงสุด', CURRENT_TIMESTAMP(3)),
    (UUID(), 'หัวหน้าศูนย์', CURRENT_TIMESTAMP(3)),
    (UUID(), 'เจ้าหน้าที่ปฏิบัติการ', CURRENT_TIMESTAMP(3)),
    (UUID(), 'ผู้ดูข้อมูล', CURRENT_TIMESTAMP(3));

UPDATE `AdminUser` AS admin
JOIN `StaffPosition` AS position
  ON position.`name` = CASE admin.`role`
    WHEN 'SUPER_ADMIN' THEN 'ผู้ดูแลระบบสูงสุด'
    WHEN 'SUPERVISOR' THEN 'หัวหน้าศูนย์'
    WHEN 'VIEWER' THEN 'ผู้ดูข้อมูล'
    ELSE 'เจ้าหน้าที่ปฏิบัติการ'
  END
SET admin.`positionId` = position.`id`;

-- Correct the wording for incidents that have not yet been accepted by an officer.
UPDATE `IncidentStatusHistory`
SET `note` = 'ระบบได้รับรายการและรอดำเนินการ'
WHERE `toStatus` = 'RECEIVED' AND `note` = 'ระบบรับแจ้งเหตุแล้ว';

UPDATE `Notification`
SET `title` = 'รอดำเนินการ'
WHERE `type` = 'INCIDENT_CREATED' AND `citizenUserId` IS NOT NULL AND `title` = 'รับแจ้งเหตุแล้ว';

-- CreateIndex
CREATE INDEX `AdminUser_positionId_idx` ON `AdminUser`(`positionId`);

-- AddForeignKey
ALTER TABLE `AdminUser`
ADD CONSTRAINT `AdminUser_positionId_fkey`
FOREIGN KEY (`positionId`) REFERENCES `StaffPosition`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;
