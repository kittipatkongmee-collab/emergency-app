<?php

require dirname(__DIR__) . '/vendor/autoload.php';

$app = new Police\Api\App(dirname(__DIR__));
$app->run();
