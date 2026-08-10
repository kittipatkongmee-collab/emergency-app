<?php

require dirname(__DIR__) . '/vendor/autoload.php';

use Police\Api\ApiException;
use Police\Api\AuthService;
use Police\Api\Config;
use Police\Api\JwtCodec;
use Police\Api\Uuid;

$passed = 0;
$failed = 0;

function testCase($name, $callback)
{
    global $passed, $failed;
    try {
        call_user_func($callback);
        $passed++;
        fwrite(STDOUT, "PASS " . $name . PHP_EOL);
    } catch (Exception $error) {
        $failed++;
        fwrite(STDERR, "FAIL " . $name . ': ' . $error->getMessage() . PHP_EOL);
    }
}

function assertTrue($condition, $message)
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function expectApiCode($code, $callback)
{
    try {
        call_user_func($callback);
    } catch (ApiException $error) {
        assertTrue($error->apiCode === $code, 'Expected ' . $code . ', received ' . $error->apiCode);
        return;
    }
    throw new RuntimeException('Expected ApiException ' . $code);
}

function preserveEnvironment(array $keys)
{
    $values = array();
    foreach ($keys as $key) {
        $values[$key] = getenv($key);
    }
    return $values;
}

function restoreEnvironment(array $values)
{
    foreach ($values as $key => $value) {
        putenv($value === false ? $key : $key . '=' . $value);
    }
}

testCase('UUID v4 format and uniqueness', function () {
    $first = Uuid::v4();
    $second = Uuid::v4();
    assertTrue($first !== $second, 'UUID values collided');
    assertTrue((bool) preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $first), 'UUID format is invalid');
});

testCase('HS256 JWT round trip', function () {
    $secret = 'unit-test-secret-with-at-least-32-characters';
    $token = JwtCodec::encodeHs256(array('sub' => 'user-1', 'tokenType' => 'access', 'exp' => time() + 60), $secret);
    $payload = JwtCodec::decodeHs256($token, $secret);
    assertTrue($payload['sub'] === 'user-1', 'JWT subject changed');
});

testCase('HS256 JWT rejects tampering and expiry', function () {
    $secret = 'unit-test-secret-with-at-least-32-characters';
    $token = JwtCodec::encodeHs256(array('sub' => 'user-1', 'exp' => time() + 60), $secret);
    expectApiCode('INVALID_TOKEN', function () use ($token, $secret) {
        JwtCodec::decodeHs256(substr($token, 0, -1) . ($token[strlen($token) - 1] === 'a' ? 'b' : 'a'), $secret);
    });
    expectApiCode('TOKEN_EXPIRED', function () use ($secret) {
        JwtCodec::decodeHs256(JwtCodec::encodeHs256(array('sub' => 'user-1', 'exp' => time() - 30), $secret), $secret);
    });
});

testCase('RBAC rejects role escalation', function () {
    $reflection = new ReflectionClass(AuthService::class);
    $auth = $reflection->newInstanceWithoutConstructor();
    expectApiCode('FORBIDDEN', function () use ($auth) {
        $auth->authorize(array('kind' => 'admin', 'role' => 'VIEWER'), array('admin'), array('SUPER_ADMIN'));
    });
});

testCase('Production development bypass fails closed', function () {
    $path = tempnam(sys_get_temp_dir(), 'police-config-');
    file_put_contents($path, implode(PHP_EOL, array(
        'APP_ENV=production',
        'DEV_AUTH_BYPASS=true',
        'DB_HOST=localhost',
        'DB_DATABASE=police_incident',
        'DB_USERNAME=police',
        'JWT_ACCESS_SECRET=access-secret-with-at-least-32-characters',
        'JWT_REFRESH_SECRET=refresh-secret-with-at-least-32-characters',
    )));
    $environment = preserveEnvironment(array('APP_CONFIG_FILE', 'APP_ENV', 'DEV_AUTH_BYPASS'));
    putenv('APP_CONFIG_FILE=' . $path);
    putenv('APP_ENV=production');
    putenv('DEV_AUTH_BYPASS=true');
    $message = '';
    try {
        new Config(dirname(__DIR__));
    } catch (RuntimeException $error) {
        $message = $error->getMessage();
    }
    restoreEnvironment($environment);
    unlink($path);
    assertTrue(strpos($message, 'DEV_AUTH_BYPASS') !== false, $message === '' ? 'Production bypass was accepted' : 'Unexpected config error: ' . $message);
});

testCase('Firebase rules deny writes and scope reads', function () {
    $rules = json_decode(file_get_contents(dirname(__DIR__) . '/firebase/database.rules.json'), true);
    assertTrue(is_array($rules), 'Rules JSON is invalid');
    assertTrue($rules['rules']['.write'] === false, 'Root writes are not denied');
    assertTrue(strpos($rules['rules']['channels']['users']['$uid']['.read'], 'auth.uid === $uid') !== false, 'User channel is not owner-scoped');
});

testCase('Firebase service account file hydrates credentials', function () {
    $directory = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'police-config-' . uniqid('', true);
    mkdir($directory, 0700, true);
    file_put_contents($directory . DIRECTORY_SEPARATOR . 'service-account.json', json_encode(array(
        'project_id' => 'firebase-test-project',
        'client_email' => 'firebase-admin@example.test',
        'private_key' => "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
    )));
    file_put_contents($directory . DIRECTORY_SEPARATOR . '.env', implode(PHP_EOL, array(
        'APP_ENV=test',
        'DB_HOST=localhost',
        'DB_DATABASE=police_incident_test',
        'DB_USERNAME=police',
        'JWT_ACCESS_SECRET=access-secret-with-at-least-32-characters',
        'JWT_REFRESH_SECRET=refresh-secret-with-at-least-32-characters',
        'FIREBASE_SERVICE_ACCOUNT_FILE=service-account.json',
    )));
    $keys = array('APP_CONFIG_FILE', 'APP_ENV', 'DEV_AUTH_BYPASS', 'FIREBASE_SERVICE_ACCOUNT_FILE', 'FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY');
    $environment = preserveEnvironment($keys);
    foreach ($keys as $key) {
        putenv($key);
    }
    putenv('APP_CONFIG_FILE=' . $directory . DIRECTORY_SEPARATOR . '.env');
    putenv('APP_ENV=test');
    putenv('DEV_AUTH_BYPASS=false');
    $config = new Config($directory);
    assertTrue($config->get('FIREBASE_PROJECT_ID') === 'firebase-test-project', 'Project ID was not loaded: ' . $config->get('FIREBASE_PROJECT_ID', '<missing>'));
    assertTrue($config->get('FIREBASE_CLIENT_EMAIL') === 'firebase-admin@example.test', 'Client email was not loaded');
    assertTrue(strpos($config->get('FIREBASE_PRIVATE_KEY'), 'BEGIN PRIVATE KEY') !== false, 'Private key was not loaded');
    unlink($directory . DIRECTORY_SEPARATOR . '.env');
    unlink($directory . DIRECTORY_SEPARATOR . 'service-account.json');
    rmdir($directory);
    restoreEnvironment($environment);
});

testCase('MariaDB schema contains required safety tables', function () {
    $schema = file_get_contents(dirname(__DIR__) . '/database/schema.sql');
    foreach (array('RealtimeOutbox', "ENUM('RTDB','FCM')", 'RateLimitBucket', 'CaseCounter', 'utf8mb4_unicode_ci', 'CHAR(36)') as $required) {
        assertTrue(strpos($schema, $required) !== false, 'Schema is missing ' . $required);
    }
});

fwrite(STDOUT, PHP_EOL . $passed . ' passed, ' . $failed . ' failed' . PHP_EOL);
exit($failed === 0 ? 0 : 1);
