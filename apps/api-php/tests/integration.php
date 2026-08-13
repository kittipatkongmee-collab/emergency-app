<?php

require dirname(__DIR__) . '/vendor/autoload.php';

use Police\Api\ApiException;
use Police\Api\ApiController;
use Police\Api\AuthService;
use Police\Api\Config;
use Police\Api\Database;
use Police\Api\FirebaseService;
use Police\Api\ImageStorage;
use Police\Api\Request;
use Police\Api\Uuid;

$config = new Config(dirname(__DIR__));
$db = new Database($config);
$db->assertTestDatabase();

$username = 'integration-admin';
$password = 'Integration-Password-123';
$existingAdmin = $db->fetchOne('SELECT id FROM AdminUser WHERE username = ?', array($username));
$adminId = $existingAdmin ? $existingAdmin['id'] : Uuid::v4();
$db->execute('DELETE FROM RefreshToken WHERE ownerId = ?', array($adminId));
if ($existingAdmin) {
    $db->execute("UPDATE AdminUser SET passwordHash = ?, fullName = ?, role = 'SUPER_ADMIN', status = 'ACTIVE', updatedAt = UTC_TIMESTAMP() WHERE id = ?", array(password_hash($password, PASSWORD_BCRYPT, array('cost' => 12)), 'Integration Admin', $adminId));
} else {
    $db->execute("INSERT INTO AdminUser (id, username, passwordHash, fullName, role, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, 'SUPER_ADMIN', 'ACTIVE', UTC_TIMESTAMP(), UTC_TIMESTAMP())", array($adminId, $username, password_hash($password, PASSWORD_BCRYPT, array('cost' => 12)), 'Integration Admin'));
}

$auth = new AuthService($db, $config);
$tokens = $auth->adminLogin($username, $password);
if (!isset($tokens['accessToken'], $tokens['refreshToken']) || $tokens['expiresIn'] !== '900') {
    throw new RuntimeException('Admin login contract failed');
}

$rotated = $auth->refresh($tokens['refreshToken']);
if ($rotated['refreshToken'] === $tokens['refreshToken']) {
    throw new RuntimeException('Refresh token was not rotated');
}

try {
    $auth->refresh($tokens['refreshToken']);
    throw new RuntimeException('Refresh token replay was accepted');
} catch (ApiException $error) {
    if ($error->apiCode !== 'REFRESH_TOKEN_REUSED') {
        throw $error;
    }
}

try {
    $auth->adminLogin("' OR 1=1 --", 'anything-at-all');
    throw new RuntimeException('SQL injection login was accepted');
} catch (ApiException $error) {
    if ($error->apiCode !== 'INVALID_CREDENTIALS') {
        throw $error;
    }
}

$staleIncidents = $db->fetchAll("SELECT id FROM Incident WHERE caseCode LIKE 'DELETE-%'");
foreach ($staleIncidents as $staleIncident) {
    $db->execute('DELETE FROM Notification WHERE incidentId = ?', array($staleIncident['id']));
    $db->execute('DELETE FROM RealtimeOutbox WHERE entityId = ?', array($staleIncident['id']));
    $db->execute('DELETE FROM AuditLog WHERE entityId = ?', array($staleIncident['id']));
    $db->execute('DELETE FROM Incident WHERE id = ?', array($staleIncident['id']));
}
$db->execute("DELETE FROM CitizenUser WHERE fullName = 'Deletion Test Citizen' AND id NOT IN (SELECT citizenUserId FROM Incident)");

$citizenId = Uuid::v4();
$incidentId = Uuid::v4();
$imageId = Uuid::v4();
$caseCode = 'DELETE-' . substr(str_replace('-', '', $incidentId), 0, 12);
$storageKey = '2026/08/' . Uuid::v4() . '.jpg';
$db->execute("INSERT INTO CitizenUser (id, fullName, status, createdAt, updatedAt) VALUES (?, 'Deletion Test Citizen', 'ACTIVE', UTC_TIMESTAMP(), UTC_TIMESTAMP())", array($citizenId));
$db->execute("INSERT INTO Incident (id, caseCode, citizenUserId, reporterName, reporterPhone, type, description, latitude, longitude, address, status, priority, reportedAt, createdAt, updatedAt) VALUES (?, ?, ?, 'Deletion Test Citizen', '0800000000', 'AIRCRAFT_ACCIDENT', 'Integration incident deletion fixture', 13.7563, 100.5018, 'Bangkok', 'RECEIVED', 'NORMAL', UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP())", array($incidentId, $caseCode, $citizenId));
$db->execute("INSERT INTO IncidentImage (id, incidentId, fileName, originalName, mimeType, fileSize, storageDriver, storageKey, imageUrl, createdAt) VALUES (?, ?, 'fixture.jpg', 'fixture.jpg', 'image/jpeg', 100, 'test', ?, '/image_emer/fixture.jpg', UTC_TIMESTAMP())", array($imageId, $incidentId, $storageKey));
$db->execute("INSERT INTO IncidentStatusHistory (id, incidentId, toStatus, note, changedAt) VALUES (?, ?, 'RECEIVED', 'fixture', UTC_TIMESTAMP())", array(Uuid::v4(), $incidentId));
$db->execute("INSERT INTO Notification (id, citizenUserId, incidentId, title, message, type, isRead, createdAt) VALUES (?, ?, ?, 'fixture', 'fixture', 'INCIDENT_CREATED', 0, UTC_TIMESTAMP())", array(Uuid::v4(), $citizenId, $incidentId));
$db->execute("INSERT INTO RealtimeOutbox (id, deliveryType, channelPath, eventType, entityId, payload, attempts, availableAt, createdAt) VALUES (?, 'RTDB', 'channels/admin', 'incident.created', ?, '{}', 0, UTC_TIMESTAMP(), UTC_TIMESTAMP())", array(Uuid::v4(), $incidentId));

$controller = new ApiController($db, $config, $auth, new FirebaseService($db, $config), new ImageStorage($db, $config));
$request = new Request();
$request->params = array('id' => $incidentId);
$request->principal = array('kind' => 'admin', 'sub' => $adminId, 'role' => 'SUPER_ADMIN');
$result = $controller->handle('deleteIncident', $request);
if (!$result['deleted'] || $result['caseCode'] !== $caseCode) {
    throw new RuntimeException('Incident deletion response contract failed');
}
if ($db->fetchOne('SELECT id FROM Incident WHERE id = ?', array($incidentId))) {
    throw new RuntimeException('Incident row was not deleted');
}
if ($db->fetchOne('SELECT id FROM IncidentImage WHERE incidentId = ?', array($incidentId))) {
    throw new RuntimeException('Incident image rows were not cascaded');
}
if ($db->fetchOne('SELECT id FROM Notification WHERE incidentId = ?', array($incidentId))) {
    throw new RuntimeException('Incident notifications were not deleted');
}
$audit = $db->fetchOne("SELECT id FROM AuditLog WHERE action = 'INCIDENT_DELETED' AND entityId = ?", array($incidentId));
if (!$audit) {
    throw new RuntimeException('Incident deletion audit was not retained');
}
$event = $db->fetchOne("SELECT id FROM RealtimeOutbox WHERE eventType = 'incident.deleted' AND entityId = ?", array($incidentId));
if (!$event) {
    throw new RuntimeException('Incident deletion realtime event was not queued');
}
$db->execute('DELETE FROM RealtimeOutbox WHERE entityId = ?', array($incidentId));
$db->execute("DELETE FROM AuditLog WHERE action = 'INCIDENT_DELETED' AND entityId = ?", array($incidentId));
$db->execute('DELETE FROM CitizenUser WHERE id = ?', array($citizenId));

fwrite(STDOUT, "Integration authentication, persistence, and incident deletion checks passed.\n");
