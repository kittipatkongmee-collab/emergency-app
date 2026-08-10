<?php

require dirname(__DIR__) . '/vendor/autoload.php';

use Police\Api\ApiException;
use Police\Api\AuthService;
use Police\Api\Config;
use Police\Api\Database;
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

fwrite(STDOUT, "Integration authentication and persistence checks passed.\n");
