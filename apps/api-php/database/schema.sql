SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS SchemaMigration (
  version VARCHAR(100) PRIMARY KEY,
  appliedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE CitizenUser (
  id CHAR(36) PRIMARY KEY,
  facebookId VARCHAR(191) NULL UNIQUE,
  fullName VARCHAR(191) NOT NULL,
  email VARCHAR(320) NULL,
  profileImageUrl VARCHAR(2048) NULL,
  phone VARCHAR(32) NULL,
  status ENUM('ACTIVE','INACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  lastLoginAt DATETIME(3) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE StaffPosition (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE AdminUser (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(320) NULL UNIQUE,
  passwordHash VARCHAR(255) NOT NULL,
  fullName VARCHAR(191) NOT NULL,
  phone VARCHAR(32) NULL,
  role ENUM('SUPER_ADMIN','SUPERVISOR','OFFICER','VIEWER') NOT NULL,
  positionId CHAR(36) NULL,
  status ENUM('ACTIVE','INACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  lastLoginAt DATETIME(3) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX AdminUser_positionId_idx (positionId),
  CONSTRAINT AdminUser_positionId_fkey FOREIGN KEY (positionId) REFERENCES StaffPosition(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ExternalIdentity (
  id CHAR(36) PRIMARY KEY,
  citizenUserId CHAR(36) NOT NULL,
  provider ENUM('DEVELOPMENT','FACEBOOK','LINE') NOT NULL,
  providerUserId VARCHAR(191) NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY ExternalIdentity_provider_providerUserId_key (provider, providerUserId),
  INDEX ExternalIdentity_citizenUserId_idx (citizenUserId),
  CONSTRAINT ExternalIdentity_citizenUserId_fkey FOREIGN KEY (citizenUserId) REFERENCES CitizenUser(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE Incident (
  id CHAR(36) PRIMARY KEY,
  caseCode VARCHAR(32) NOT NULL UNIQUE,
  clientRequestId VARCHAR(191) NULL UNIQUE,
  citizenUserId CHAR(36) NOT NULL,
  reporterName VARCHAR(191) NOT NULL,
  reporterPhone VARCHAR(32) NOT NULL,
  type ENUM('AIRCRAFT_ACCIDENT','DISASTER_RELIEF') NOT NULL,
  description TEXT NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(11,7) NOT NULL,
  address TEXT NOT NULL,
  subdistrict VARCHAR(191) NULL,
  district VARCHAR(191) NULL,
  province VARCHAR(191) NULL,
  postalCode VARCHAR(16) NULL,
  status ENUM('RECEIVED','FORWARDED','INSPECTING','IN_PROGRESS','COMPLETED','CANCELLED','REJECTED') NOT NULL DEFAULT 'RECEIVED',
  priority ENUM('LOW','NORMAL','HIGH','CRITICAL') NOT NULL DEFAULT 'NORMAL',
  assignedAdminUserId CHAR(36) NULL,
  reportedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completedAt DATETIME(3) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX Incident_status_idx (status),
  INDEX Incident_type_idx (type),
  INDEX Incident_reportedAt_idx (reportedAt),
  INDEX Incident_citizenUserId_idx (citizenUserId),
  INDEX Incident_assignedAdminUserId_idx (assignedAdminUserId),
  INDEX Incident_province_idx (province),
  INDEX Incident_priority_idx (priority),
  INDEX Incident_status_reportedAt_idx (status, reportedAt),
  CONSTRAINT Incident_citizenUserId_fkey FOREIGN KEY (citizenUserId) REFERENCES CitizenUser(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT Incident_assignedAdminUserId_fkey FOREIGN KEY (assignedAdminUserId) REFERENCES AdminUser(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IncidentImage (
  id CHAR(36) PRIMARY KEY,
  incidentId CHAR(36) NOT NULL,
  fileName VARCHAR(255) NOT NULL,
  originalName VARCHAR(255) NOT NULL,
  mimeType VARCHAR(100) NOT NULL,
  fileSize INT UNSIGNED NOT NULL,
  storageDriver VARCHAR(50) NOT NULL,
  storageKey VARCHAR(1024) NOT NULL,
  imageUrl VARCHAR(2048) NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX IncidentImage_incidentId_idx (incidentId),
  CONSTRAINT IncidentImage_incidentId_fkey FOREIGN KEY (incidentId) REFERENCES Incident(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IncidentStatusHistory (
  id CHAR(36) PRIMARY KEY,
  incidentId CHAR(36) NOT NULL,
  fromStatus ENUM('RECEIVED','FORWARDED','INSPECTING','IN_PROGRESS','COMPLETED','CANCELLED','REJECTED') NULL,
  toStatus ENUM('RECEIVED','FORWARDED','INSPECTING','IN_PROGRESS','COMPLETED','CANCELLED','REJECTED') NOT NULL,
  note TEXT NULL,
  changedByAdminUserId CHAR(36) NULL,
  changedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX IncidentStatusHistory_incidentId_changedAt_idx (incidentId, changedAt),
  CONSTRAINT IncidentStatusHistory_incidentId_fkey FOREIGN KEY (incidentId) REFERENCES Incident(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT IncidentStatusHistory_changedByAdminUserId_fkey FOREIGN KEY (changedByAdminUserId) REFERENCES AdminUser(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IncidentNote (
  id CHAR(36) PRIMARY KEY,
  incidentId CHAR(36) NOT NULL,
  adminUserId CHAR(36) NOT NULL,
  note TEXT NOT NULL,
  isVisibleToCitizen BOOLEAN NOT NULL DEFAULT FALSE,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX IncidentNote_incidentId_idx (incidentId),
  INDEX IncidentNote_adminUserId_idx (adminUserId),
  CONSTRAINT IncidentNote_incidentId_fkey FOREIGN KEY (incidentId) REFERENCES Incident(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT IncidentNote_adminUserId_fkey FOREIGN KEY (adminUserId) REFERENCES AdminUser(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IncidentAssignment (
  id CHAR(36) PRIMARY KEY,
  incidentId CHAR(36) NOT NULL,
  assignedToAdminUserId CHAR(36) NOT NULL,
  assignedByAdminUserId CHAR(36) NOT NULL,
  assignedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  unassignedAt DATETIME(3) NULL,
  INDEX IncidentAssignment_incidentId_assignedAt_idx (incidentId, assignedAt),
  INDEX IncidentAssignment_assignedTo_unassigned_idx (assignedToAdminUserId, unassignedAt),
  CONSTRAINT IncidentAssignment_incidentId_fkey FOREIGN KEY (incidentId) REFERENCES Incident(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT IncidentAssignment_assignedTo_fkey FOREIGN KEY (assignedToAdminUserId) REFERENCES AdminUser(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT IncidentAssignment_assignedBy_fkey FOREIGN KEY (assignedByAdminUserId) REFERENCES AdminUser(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE Notification (
  id CHAR(36) PRIMARY KEY,
  citizenUserId CHAR(36) NULL,
  adminUserId CHAR(36) NULL,
  incidentId CHAR(36) NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('INCIDENT_CREATED','INCIDENT_ASSIGNED','INCIDENT_STATUS_CHANGED','SYSTEM') NOT NULL,
  isRead BOOLEAN NOT NULL DEFAULT FALSE,
  readAt DATETIME(3) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX Notification_citizen_created_idx (citizenUserId, createdAt),
  INDEX Notification_admin_created_idx (adminUserId, createdAt),
  INDEX Notification_citizen_read_idx (citizenUserId, isRead),
  INDEX Notification_admin_read_idx (adminUserId, isRead),
  CONSTRAINT Notification_citizenUserId_fkey FOREIGN KEY (citizenUserId) REFERENCES CitizenUser(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT Notification_adminUserId_fkey FOREIGN KEY (adminUserId) REFERENCES AdminUser(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT Notification_incidentId_fkey FOREIGN KEY (incidentId) REFERENCES Incident(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE DeviceToken (
  id CHAR(36) PRIMARY KEY,
  citizenUserId CHAR(36) NOT NULL,
  token VARCHAR(512) NOT NULL UNIQUE,
  platform ENUM('IOS','ANDROID','WEB') NOT NULL,
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX DeviceToken_citizen_active_idx (citizenUserId, isActive),
  CONSTRAINT DeviceToken_citizenUserId_fkey FOREIGN KEY (citizenUserId) REFERENCES CitizenUser(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE RefreshToken (
  id CHAR(36) PRIMARY KEY,
  ownerType ENUM('CITIZEN','ADMIN') NOT NULL,
  ownerId CHAR(36) NOT NULL,
  tokenHash VARCHAR(255) NOT NULL,
  expiresAt DATETIME(3) NOT NULL,
  revokedAt DATETIME(3) NULL,
  replacedByTokenId CHAR(36) NULL UNIQUE,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX RefreshToken_owner_idx (ownerType, ownerId),
  INDEX RefreshToken_expiresAt_idx (expiresAt),
  INDEX RefreshToken_revokedAt_idx (revokedAt),
  CONSTRAINT RefreshToken_replacedBy_fkey FOREIGN KEY (replacedByTokenId) REFERENCES RefreshToken(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE AuditLog (
  id CHAR(36) PRIMARY KEY,
  adminUserId CHAR(36) NULL,
  action VARCHAR(100) NOT NULL,
  entityType VARCHAR(100) NOT NULL,
  entityId VARCHAR(191) NULL,
  oldValue JSON NULL,
  newValue JSON NULL,
  ipAddress VARCHAR(45) NULL,
  userAgent TEXT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX AuditLog_createdAt_idx (createdAt),
  INDEX AuditLog_entity_idx (entityType, entityId),
  INDEX AuditLog_admin_idx (adminUserId),
  CONSTRAINT AuditLog_adminUserId_fkey FOREIGN KEY (adminUserId) REFERENCES AdminUser(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE SystemSetting (
  id CHAR(36) PRIMARY KEY,
  `key` VARCHAR(191) NOT NULL UNIQUE,
  value JSON NOT NULL,
  updatedByAdminUserId CHAR(36) NULL,
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT SystemSetting_updatedBy_fkey FOREIGN KEY (updatedByAdminUserId) REFERENCES AdminUser(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE CaseCounter (
  id CHAR(36) PRIMARY KEY,
  year INT NOT NULL UNIQUE,
  lastNumber INT NOT NULL DEFAULT 0,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE RealtimeOutbox (
  id CHAR(36) PRIMARY KEY,
  deliveryType ENUM('RTDB','FCM') NOT NULL DEFAULT 'RTDB',
  channelPath VARCHAR(512) NOT NULL,
  eventType VARCHAR(100) NOT NULL,
  entityId VARCHAR(191) NULL,
  payload JSON NOT NULL,
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  availableAt DATETIME(3) NOT NULL,
  publishedAt DATETIME(3) NULL,
  lastError TEXT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX RealtimeOutbox_pending_idx (publishedAt, availableAt, createdAt),
  INDEX RealtimeOutbox_deliveryType_idx (deliveryType)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE RateLimitBucket (
  `key` CHAR(64) NOT NULL,
  bucketStartedAt DATETIME NOT NULL,
  hitCount INT UNSIGNED NOT NULL DEFAULT 0,
  expiresAt DATETIME NOT NULL,
  PRIMARY KEY (`key`, bucketStartedAt),
  INDEX RateLimitBucket_expiresAt_idx (expiresAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO SchemaMigration (version) VALUES ('20260809_php56_baseline');
