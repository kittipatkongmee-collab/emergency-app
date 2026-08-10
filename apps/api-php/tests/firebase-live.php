<?php

require dirname(__DIR__) . '/vendor/autoload.php';

use Police\Api\Config;
use Police\Api\Database;
use Police\Api\ApiException;
use Police\Api\FirebaseService;
use Police\Api\Uuid;

function firebaseRequest($method, $url, $body, array $headers = array('Content-Type: application/json'))
{
    $curl = curl_init($url);
    curl_setopt_array($curl, array(
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => $headers,
    ));
    $response = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $error = curl_error($curl);
    curl_close($curl);
    if ($response === false) {
        throw new RuntimeException($error ?: 'Firebase request failed');
    }
    return array($status, $response);
}

$apiKey = getenv('FIREBASE_WEB_API_KEY');
if (!$apiKey) {
    fwrite(STDERR, "FIREBASE_WEB_API_KEY is required\n");
    exit(1);
}

$config = new Config(dirname(__DIR__));
$databaseReflection = new ReflectionClass(Database::class);
$database = $databaseReflection->newInstanceWithoutConstructor();
$firebase = new FirebaseService($database, $config);
$principal = array('kind' => 'admin', 'sub' => Uuid::v4(), 'role' => 'SUPER_ADMIN');
$customToken = $firebase->customToken($principal);
$identityUrl = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' . rawurlencode($apiKey);
list($status, $body) = firebaseRequest('POST', $identityUrl, json_encode(array(
    'token' => $customToken['customToken'],
    'returnSecureToken' => true,
)));
$identity = json_decode($body, true);
if ($status !== 200 || !isset($identity['idToken'])) {
    throw new RuntimeException('Firebase rejected the custom token with status ' . $status);
}

$idToken = $identity['idToken'];
$databaseUrl = rtrim($config->get('FIREBASE_DATABASE_URL'), '/');
$authQuery = '?auth=' . rawurlencode($idToken);
$userPath = '/channels/users/admin:' . $principal['sub'] . '/live-test';
try {
    list($adminReadStatus) = firebaseRequest('GET', $databaseUrl . '/channels/admin.json' . $authQuery, '');
    if ($adminReadStatus !== 200) {
        throw new RuntimeException('Admin channel read returned status ' . $adminReadStatus);
    }
    list($otherReadStatus) = firebaseRequest('GET', $databaseUrl . '/channels/users/admin:other.json' . $authQuery, '');
    if (!in_array($otherReadStatus, array(401, 403), true)) {
        throw new RuntimeException('Another user channel was readable');
    }
    list($writeStatus) = firebaseRequest('PUT', $databaseUrl . '/channels/admin/live-test.json' . $authQuery, json_encode(array('blocked' => false)));
    if (!in_array($writeStatus, array(401, 403), true)) {
        throw new RuntimeException('Client write was accepted');
    }

    $putMethod = new ReflectionMethod(FirebaseService::class, 'putRtdb');
    $putMethod->setAccessible(true);
    $putMethod->invoke($firebase, ltrim($userPath, '/'), array('type' => 'firebase.live.test'));
    list($ownReadStatus, $ownReadBody) = firebaseRequest('GET', $databaseUrl . $userPath . '.json' . $authQuery, '');
    $ownEvent = json_decode($ownReadBody, true);
    if ($ownReadStatus !== 200 || !is_array($ownEvent) || $ownEvent['type'] !== 'firebase.live.test') {
        throw new RuntimeException('Service account RTDB delivery could not be read by its owner');
    }

    try {
        $firebase->sendFcm('firebase-live-invalid-device-token', 'Live test', 'No message is delivered', array('test' => 'true'));
        throw new RuntimeException('FCM accepted an invalid device token');
    } catch (ApiException $error) {
        if ($error->apiCode !== 'FIREBASE_DELIVERY_FAILED' || preg_match('/status (401|403)/', $error->getMessage())) {
            throw new RuntimeException('FCM service-account authorization failed');
        }
    }
} finally {
    $oauthMethod = new ReflectionMethod(FirebaseService::class, 'oauthToken');
    $oauthMethod->setAccessible(true);
    $oauthToken = $oauthMethod->invoke($firebase);
    firebaseRequest('DELETE', $databaseUrl . $userPath . '.json', '', array(
        'Authorization: Bearer ' . $oauthToken,
        'Content-Type: application/json',
    ));
    firebaseRequest(
        'POST',
        'https://identitytoolkit.googleapis.com/v1/accounts:delete?key=' . rawurlencode($apiKey),
        json_encode(array('idToken' => $idToken))
    );
}

fwrite(STDOUT, "PASS Firebase live custom token and RTDB rules\n");
