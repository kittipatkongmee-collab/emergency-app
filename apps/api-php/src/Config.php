<?php

namespace Police\Api;

use RuntimeException;

final class Config
{
    private $values;

    public function __construct($root)
    {
        $this->values = $_ENV;
        $file = getenv('APP_CONFIG_FILE');
        if (!$file) {
            $file = $root . '/.env';
        }
        if (is_file($file)) {
            $this->loadFile($file);
        }
        $this->loadFirebaseServiceAccount($root);
        $this->validate();
        date_default_timezone_set($this->get('APP_TIMEZONE', 'UTC'));
    }

    public function get($key, $default = null)
    {
        $value = getenv($key);
        if ($value !== false) {
            return $value;
        }
        return array_key_exists($key, $this->values) ? $this->values[$key] : $default;
    }

    public function bool($key, $default = false)
    {
        $value = strtolower((string) $this->get($key, $default ? 'true' : 'false'));
        return in_array($value, array('1', 'true', 'yes', 'on'), true);
    }

    public function int($key, $default)
    {
        return (int) $this->get($key, $default);
    }

    private function loadFile($path)
    {
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $trimmed = trim($line);
            if ($trimmed === '' || strpos($trimmed, '#') === 0 || strpos($trimmed, '=') === false) {
                continue;
            }
            list($key, $value) = explode('=', $trimmed, 2);
            $key = trim($key);
            $value = trim($value);
            if (strlen($value) >= 2 && (($value[0] === '"' && substr($value, -1) === '"') || ($value[0] === "'" && substr($value, -1) === "'"))) {
                $value = substr($value, 1, -1);
            }
            if (!array_key_exists($key, $this->values) && getenv($key) === false) {
                $this->values[$key] = str_replace('\\n', "\n", $value);
            }
        }
    }

    private function loadFirebaseServiceAccount($root)
    {
        $path = trim((string) $this->get('FIREBASE_SERVICE_ACCOUNT_FILE', ''));
        if ($path === '') {
            return;
        }
        if ($path[0] !== '/' && $path[0] !== '\\' && !preg_match('/^[A-Za-z]:[\\\\\/]/', $path)) {
            $path = rtrim($root, '/\\') . DIRECTORY_SEPARATOR . $path;
        }
        if (!is_file($path) || !is_readable($path)) {
            throw new RuntimeException('FIREBASE_SERVICE_ACCOUNT_FILE is not readable');
        }
        $account = json_decode(file_get_contents($path), true);
        if (!is_array($account)) {
            throw new RuntimeException('FIREBASE_SERVICE_ACCOUNT_FILE is invalid JSON');
        }
        $mapping = array(
            'FIREBASE_PROJECT_ID' => 'project_id',
            'FIREBASE_CLIENT_EMAIL' => 'client_email',
            'FIREBASE_PRIVATE_KEY' => 'private_key',
        );
        foreach ($mapping as $configKey => $jsonKey) {
            if ((string) $this->get($configKey, '') === '' && isset($account[$jsonKey])) {
                $this->values[$configKey] = $account[$jsonKey];
            }
        }
    }

    private function validate()
    {
        $environment = $this->get('APP_ENV', 'development');
        if (!in_array($environment, array('development', 'test', 'staging', 'production'), true)) {
            throw new RuntimeException('APP_ENV is invalid');
        }
        foreach (array('DB_HOST', 'DB_DATABASE', 'DB_USERNAME', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET') as $key) {
            if ((string) $this->get($key, '') === '') {
                throw new RuntimeException($key . ' is required');
            }
        }
        if (strlen((string) $this->get('JWT_ACCESS_SECRET')) < 32 || strlen((string) $this->get('JWT_REFRESH_SECRET')) < 32) {
            throw new RuntimeException('JWT secrets must contain at least 32 characters');
        }
        if ($environment === 'production' && $this->bool('DEV_AUTH_BYPASS')) {
            throw new RuntimeException('DEV_AUTH_BYPASS must be disabled in production');
        }
        if ($this->bool('LINE_LOGIN_ENABLED') && !preg_match('/^\d+$/', (string) $this->get('LINE_CHANNEL_ID', ''))) {
            throw new RuntimeException('LINE_CHANNEL_ID is required when LINE login is enabled');
        }
        if ($this->bool('FIREBASE_ENABLED') || $this->bool('FCM_ENABLED')) {
            foreach (array('FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY') as $key) {
                if ((string) $this->get($key, '') === '') {
                    throw new RuntimeException($key . ' is required when Firebase is enabled');
                }
            }
        }
        if ($this->bool('FIREBASE_ENABLED') && (string) $this->get('FIREBASE_DATABASE_URL', '') === '') {
            throw new RuntimeException('FIREBASE_DATABASE_URL is required when Firebase is enabled');
        }
    }
}
