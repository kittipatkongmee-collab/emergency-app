<?php

$privateRoot = getenv('POLICE_API_PRIVATE_PATH');
if (!$privateRoot) {
    $privateRoot = '/home/sarpa/private/police-api';
}

require rtrim($privateRoot, '/\\') . '/vendor/autoload.php';

$app = new Police\Api\App(rtrim($privateRoot, '/\\'));
$app->run();
