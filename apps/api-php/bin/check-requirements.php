<?php

require dirname(__DIR__) . '/vendor/autoload.php';

use Police\Api\Config;
use Police\Api\Database;

$checks = array();
$checks['PHP 5.6'] = version_compare(PHP_VERSION, '5.6.0', '>=') && version_compare(PHP_VERSION, '7.0.0', '<');
foreach (array('curl', 'gd', 'json', 'openssl', 'pdo', 'pdo_mysql') as $extension) {
    $checks['extension ' . $extension] = extension_loaded($extension);
}
$checks['fileinfo or getimagesize'] = extension_loaded('fileinfo') || function_exists('getimagesize');
$checks['password bcrypt'] = defined('PASSWORD_BCRYPT');

try {
    $config = new Config(dirname(__DIR__));
    $db = new Database($config);
    $version = $db->pdo()->query('SELECT VERSION()')->fetchColumn();
    $checks['MariaDB 10.6'] = strpos((string) $version, '10.6.') === 0 && stripos((string) $version, 'MariaDB') !== false;
    $checks['database UTC'] = $db->pdo()->query('SELECT TIMEDIFF(NOW(), UTC_TIMESTAMP())')->fetchColumn() === '00:00:00';
} catch (Exception $error) {
    $checks['database connection'] = false;
    fwrite(STDERR, 'Database: ' . $error->getMessage() . PHP_EOL);
}

$failed = false;
foreach ($checks as $name => $passed) {
    fwrite(STDOUT, ($passed ? '[OK]   ' : '[FAIL] ') . $name . PHP_EOL);
    $failed = $failed || !$passed;
}
exit($failed ? 1 : 0);
