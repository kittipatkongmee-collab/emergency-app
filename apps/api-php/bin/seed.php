<?php

require dirname(__DIR__) . '/vendor/autoload.php';

use Police\Api\Config;
use Police\Api\Database;
use Police\Api\Uuid;

$root = dirname(__DIR__);
$config = new Config($root);
$db = new Database($config);
$username = trim((string) $config->get('ADMIN_SEED_USERNAME', 'admin'));
$password = (string) $config->get('ADMIN_SEED_PASSWORD', '');
$fullName = trim((string) $config->get('ADMIN_SEED_FULL_NAME', 'ผู้ดูแลระบบ'));
if (strlen($password) < 12) {
    fwrite(STDERR, "ADMIN_SEED_PASSWORD must contain at least 12 characters.\n");
    exit(1);
}
if ($db->fetchOne('SELECT id FROM AdminUser WHERE username = ?', array($username))) {
    fwrite(STDOUT, "Admin already exists; no changes made.\n");
    exit(0);
}
$position = $db->fetchOne('SELECT id FROM StaffPosition ORDER BY createdAt ASC LIMIT 1');
if (!$position) {
    $position = array('id' => Uuid::v4());
    $db->execute('INSERT INTO StaffPosition (id, name, createdAt, updatedAt) VALUES (?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())', array($position['id'], 'ผู้ดูแลระบบ'));
}
$db->execute("INSERT INTO AdminUser (id, username, passwordHash, fullName, role, positionId, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, 'SUPER_ADMIN', ?, 'ACTIVE', UTC_TIMESTAMP(), UTC_TIMESTAMP())", array(Uuid::v4(), $username, password_hash($password, PASSWORD_BCRYPT, array('cost' => 12)), $fullName, $position['id']));
fwrite(STDOUT, "Initial administrator created.\n");

