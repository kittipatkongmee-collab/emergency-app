<?php

namespace Police\Api;

use Exception;

final class Uuid
{
    public static function v4()
    {
        $bytes = openssl_random_pseudo_bytes(16, $strong);
        if ($bytes === false || !$strong) {
            throw new Exception('Unable to generate secure random bytes');
        }
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        $hex = bin2hex($bytes);
        return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
    }
}

final class JwtCodec
{
    public static function encodeHs256(array $payload, $secret)
    {
        return self::encode($payload, 'HS256', function ($input) use ($secret) {
            return hash_hmac('sha256', $input, $secret, true);
        });
    }

    public static function encodeRs256(array $payload, $privateKey)
    {
        return self::encode($payload, 'RS256', function ($input) use ($privateKey) {
            $key = openssl_pkey_get_private($privateKey);
            if ($key === false) {
                throw new ApiException(500, 'INVALID_FIREBASE_KEY', 'Firebase private key is invalid');
            }
            $signature = '';
            $success = openssl_sign($input, $signature, $key, OPENSSL_ALGO_SHA256);
            openssl_free_key($key);
            if (!$success) {
                throw new ApiException(500, 'JWT_SIGNING_FAILED', 'Unable to sign token');
            }
            return $signature;
        });
    }

    public static function decodeHs256($token, $secret)
    {
        $parts = explode('.', (string) $token);
        if (count($parts) !== 3) {
            throw new ApiException(401, 'INVALID_TOKEN', 'Token format is invalid');
        }
        $header = json_decode(self::decodeSegment($parts[0]), true);
        $payload = json_decode(self::decodeSegment($parts[1]), true);
        $signature = self::decodeSegment($parts[2]);
        if (!is_array($header) || !is_array($payload) || !isset($header['alg']) || $header['alg'] !== 'HS256' || !isset($header['typ']) || $header['typ'] !== 'JWT') {
            throw new ApiException(401, 'INVALID_TOKEN', 'Token algorithm is invalid');
        }
        $expected = hash_hmac('sha256', $parts[0] . '.' . $parts[1], $secret, true);
        if (!hash_equals($expected, $signature)) {
            throw new ApiException(401, 'INVALID_TOKEN', 'Token signature is invalid');
        }
        $now = time();
        if (isset($payload['nbf']) && (int) $payload['nbf'] > $now + 10 || isset($payload['exp']) && (int) $payload['exp'] < $now - 10) {
            throw new ApiException(401, 'TOKEN_EXPIRED', 'Token has expired');
        }
        return $payload;
    }

    private static function encode(array $payload, $algorithm, $signer)
    {
        $header = self::encodeSegment(json_encode(array('typ' => 'JWT', 'alg' => $algorithm)));
        $body = self::encodeSegment(json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        $input = $header . '.' . $body;
        return $input . '.' . self::encodeSegment(call_user_func($signer, $input));
    }

    private static function encodeSegment($value)
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private static function decodeSegment($value)
    {
        if (!preg_match('/^[A-Za-z0-9_-]*$/', $value)) {
            throw new ApiException(401, 'INVALID_TOKEN', 'Token encoding is invalid');
        }
        $padding = strlen($value) % 4;
        if ($padding) {
            $value .= str_repeat('=', 4 - $padding);
        }
        $decoded = base64_decode(strtr($value, '-_', '+/'), true);
        if ($decoded === false) {
            throw new ApiException(401, 'INVALID_TOKEN', 'Token encoding is invalid');
        }
        return $decoded;
    }
}

final class ApiException extends Exception
{
    public $status;
    public $apiCode;
    public $details;

    public function __construct($status, $apiCode, $message, $details = array())
    {
        parent::__construct($message);
        $this->status = $status;
        $this->apiCode = $apiCode;
        $this->details = $details;
    }
}

final class Request
{
    public $method;
    public $path;
    public $headers;
    public $query;
    public $body;
    public $files;
    public $params = array();
    public $principal;
    public $requestId;
    public $ip;

    public static function capture()
    {
        $request = new self();
        $request->method = strtoupper(isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET');
        $uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/';
        $request->path = parse_url($uri, PHP_URL_PATH);
        $scriptName = isset($_SERVER['SCRIPT_NAME']) ? rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') : '';
        if ($scriptName && strpos($request->path, $scriptName) === 0) {
            $request->path = substr($request->path, strlen($scriptName));
        }
        if (strpos($request->path, '/api/v1') === 0) {
            $request->path = substr($request->path, 7);
        }
        $request->path = $request->path === '' ? '/' : $request->path;
        $request->headers = self::headers();
        $request->query = $_GET;
        $request->files = $_FILES;
        $raw = file_get_contents('php://input');
        $contentType = isset($request->headers['content-type']) ? $request->headers['content-type'] : '';
        if (strpos($contentType, 'application/json') !== false && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (!is_array($decoded) || json_last_error() !== JSON_ERROR_NONE) {
                throw new ApiException(400, 'VALIDATION_ERROR', 'ข้อมูล JSON ไม่ถูกต้อง');
            }
            $request->body = $decoded;
        } else {
            $request->body = $_POST;
        }
        $request->requestId = isset($request->headers['x-request-id']) && preg_match('/^[A-Za-z0-9._-]{1,100}$/', $request->headers['x-request-id'])
            ? $request->headers['x-request-id'] : Uuid::v4();
        $request->ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
        return $request;
    }

    public function header($name, $default = null)
    {
        $key = strtolower($name);
        return isset($this->headers[$key]) ? $this->headers[$key] : $default;
    }

    private static function headers()
    {
        $headers = array();
        if (function_exists('getallheaders')) {
            foreach (getallheaders() as $name => $value) {
                $headers[strtolower($name)] = $value;
            }
        }
        foreach ($_SERVER as $key => $value) {
            if (strpos($key, 'HTTP_') === 0) {
                $name = strtolower(str_replace('_', '-', substr($key, 5)));
                $headers[$name] = $value;
            }
        }
        if (isset($_SERVER['CONTENT_TYPE'])) {
            $headers['content-type'] = $_SERVER['CONTENT_TYPE'];
        }
        if (!isset($headers['authorization']) && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $headers['authorization'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }
        return $headers;
    }
}

final class Response
{
    public static function success($data, $status = 200, $meta = array())
    {
        self::json(array('success' => true, 'data' => $data, 'meta' => (object) $meta), $status);
    }

    public static function error(ApiException $error, $requestId)
    {
        self::json(array(
            'success' => false,
            'error' => array('code' => $error->apiCode, 'message' => $error->getMessage(), 'details' => $error->details),
            'requestId' => $requestId,
        ), $error->status);
    }

    public static function json($payload, $status)
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}
