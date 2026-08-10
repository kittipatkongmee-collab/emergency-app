<?php

require dirname(__DIR__) . '/vendor/autoload.php';

use Police\Api\Config;
use Police\Api\Database;
use Police\Api\FirebaseService;

$root = dirname(__DIR__);
$config = new Config($root);
$db = new Database($config);
$firebase = new FirebaseService($db, $config);
$result = $firebase->publishPending(100);
$db->execute('DELETE FROM RateLimitBucket WHERE expiresAt < UTC_TIMESTAMP()');
$db->execute('DELETE FROM RealtimeOutbox WHERE publishedAt < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)');
fwrite(STDOUT, json_encode($result) . PHP_EOL);

