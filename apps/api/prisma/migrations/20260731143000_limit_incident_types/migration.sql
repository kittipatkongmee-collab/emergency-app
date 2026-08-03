-- Preserve existing development and production records while replacing the
-- legacy generic categories with the two operational disaster categories.
ALTER TABLE `Incident`
  MODIFY `type` ENUM(
    'ACCIDENT',
    'FIRE',
    'MISSING_PERSON',
    'OBSTRUCTION',
    'SUSPICIOUS',
    'OTHER',
    'AIRCRAFT_ACCIDENT',
    'DISASTER_RELIEF'
  ) NOT NULL;

UPDATE `Incident`
SET `type` = 'AIRCRAFT_ACCIDENT'
WHERE `type` = 'ACCIDENT';

UPDATE `Incident`
SET `type` = 'DISASTER_RELIEF'
WHERE `type` IN ('FIRE', 'MISSING_PERSON', 'OBSTRUCTION', 'SUSPICIOUS', 'OTHER');

ALTER TABLE `Incident`
  MODIFY `type` ENUM('AIRCRAFT_ACCIDENT', 'DISASTER_RELIEF') NOT NULL;
