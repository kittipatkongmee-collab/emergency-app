<?php

namespace Police\Api;

final class RateLimiter
{
    private $db;

    public function __construct(Database $db)
    {
        $this->db = $db;
    }

    public function hit($key, $limit, $windowSeconds)
    {
        $bucket = floor(time() / $windowSeconds) * $windowSeconds;
        $affected = $this->db->execute(
            'INSERT INTO RateLimitBucket (`key`, bucketStartedAt, hitCount, expiresAt) VALUES (?, FROM_UNIXTIME(?), 1, FROM_UNIXTIME(?)) '
            . 'ON DUPLICATE KEY UPDATE hitCount = hitCount + 1',
            array(hash('sha256', $key), $bucket, $bucket + ($windowSeconds * 2))
        );
        $row = $this->db->fetchOne('SELECT hitCount FROM RateLimitBucket WHERE `key` = ? AND bucketStartedAt = FROM_UNIXTIME(?)', array(hash('sha256', $key), $bucket));
        if ($row && (int) $row['hitCount'] > $limit) {
            throw new ApiException(429, 'RATE_LIMITED', 'ส่งคำขอบ่อยเกินไป กรุณารอสักครู่');
        }
    }
}

final class AuthService
{
    private $db;
    private $config;

    public function __construct(Database $db, Config $config)
    {
        $this->db = $db;
        $this->config = $config;
    }

    public function authenticate(Request $request)
    {
        $header = (string) $request->header('authorization', '');
        if (strpos($header, 'Bearer ') !== 0) {
            throw new ApiException(401, 'UNAUTHORIZED', 'กรุณาเข้าสู่ระบบ');
        }
        try {
            $payload = JwtCodec::decodeHs256(substr($header, 7), $this->config->get('JWT_ACCESS_SECRET'));
        } catch (\Exception $error) {
            throw new ApiException(401, 'UNAUTHORIZED', 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
        }
        if (!isset($payload['sub'], $payload['kind'], $payload['tokenType']) || $payload['tokenType'] !== 'access') {
            throw new ApiException(401, 'UNAUTHORIZED', 'ประเภทโทเคนไม่ถูกต้อง');
        }
        if (!in_array($payload['kind'], array('admin', 'citizen'), true)) {
            throw new ApiException(401, 'UNAUTHORIZED', 'ข้อมูลผู้ใช้ไม่ถูกต้อง');
        }
        return $payload;
    }

    public function authorize(array $principal, array $kinds, array $roles)
    {
        if ($kinds && !in_array($principal['kind'], $kinds, true)) {
            throw new ApiException(403, 'FORBIDDEN', 'บัญชีนี้ไม่มีสิทธิ์ดำเนินการ');
        }
        if ($roles && (!isset($principal['role']) || !in_array($principal['role'], $roles, true))) {
            throw new ApiException(403, 'FORBIDDEN', 'คุณไม่มีสิทธิ์ดำเนินการ');
        }
    }

    public function adminLogin($username, $password)
    {
        $user = $this->db->fetchOne('SELECT * FROM AdminUser WHERE username = ? LIMIT 1', array($username));
        if (!$user || $user['status'] !== 'ACTIVE' || !password_verify($password, $user['passwordHash'])) {
            throw new ApiException(401, 'INVALID_CREDENTIALS', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        }
        $this->db->execute('UPDATE AdminUser SET lastLoginAt = UTC_TIMESTAMP(), updatedAt = UTC_TIMESTAMP() WHERE id = ?', array($user['id']));
        return $this->issueTokens($user['id'], 'admin', $user['role'], $user['username']);
    }

    public function developmentLogin($profileId)
    {
        if (!in_array($this->config->get('APP_ENV', 'development'), array('development', 'test'), true) || !$this->config->bool('DEV_AUTH_BYPASS')) {
            throw new ApiException(403, 'PERMISSION_DENIED', 'ไม่ได้เปิดใช้งานการเข้าสู่ระบบสำหรับการพัฒนา');
        }
        if (!in_array($profileId, array('test1', 'test2'), true)) {
            throw new ApiException(401, 'INVALID_CREDENTIALS', 'ไม่พบบัญชีสำหรับเข้าสู่ระบบ');
        }
        return $this->upsertCitizen('DEVELOPMENT', $profileId, $profileId, null, null);
    }

    public function facebookLogin($accessToken)
    {
        if (!$this->config->bool('FACEBOOK_LOGIN_ENABLED')) {
            throw new ApiException(503, 'FACEBOOK_LOGIN_NOT_CONFIGURED', 'ยังไม่ได้ตั้งค่าการเข้าสู่ระบบด้วย Facebook');
        }
        $version = rawurlencode($this->config->get('FACEBOOK_GRAPH_API_VERSION', 'v23.0'));
        $url = 'https://graph.facebook.com/' . $version . '/me?fields=id,name,email,picture&access_token=' . rawurlencode($accessToken);
        $profile = $this->httpJson('GET', $url, null, array());
        if (!isset($profile['id'], $profile['name'])) {
            throw new ApiException(401, 'FACEBOOK_TOKEN_INVALID', 'ข้อมูลบัญชี Facebook ไม่ถูกต้อง');
        }
        $picture = isset($profile['picture']['data']['url']) ? $profile['picture']['data']['url'] : null;
        return $this->upsertCitizen('FACEBOOK', $profile['id'], $profile['name'], isset($profile['email']) ? $profile['email'] : null, $picture);
    }

    public function lineLogin($idToken, $nonce)
    {
        if (!$this->config->bool('LINE_LOGIN_ENABLED')) {
            throw new ApiException(503, 'LINE_LOGIN_NOT_CONFIGURED', 'ยังไม่ได้ตั้งค่าการเข้าสู่ระบบด้วย LINE');
        }
        $body = http_build_query(array('id_token' => $idToken, 'client_id' => $this->config->get('LINE_CHANNEL_ID'), 'nonce' => $nonce));
        $profile = $this->httpJson('POST', 'https://api.line.me/oauth2/v2.1/verify', $body, array('Content-Type: application/x-www-form-urlencoded'));
        if (!isset($profile['sub'], $profile['name']) || !isset($profile['nonce']) || !hash_equals((string) $nonce, (string) $profile['nonce'])) {
            throw new ApiException(401, 'LINE_TOKEN_INVALID', 'ข้อมูลเข้าสู่ระบบ LINE ไม่ถูกต้องหรือหมดอายุ');
        }
        return $this->upsertCitizen('LINE', $profile['sub'], $profile['name'], isset($profile['email']) ? $profile['email'] : null, isset($profile['picture']) ? $profile['picture'] : null);
    }

    public function refresh($rawToken)
    {
        try {
            $payload = JwtCodec::decodeHs256($rawToken, $this->config->get('JWT_REFRESH_SECRET'));
        } catch (\Exception $error) {
            throw new ApiException(401, 'INVALID_REFRESH_TOKEN', 'โทเคนสำหรับต่ออายุไม่ถูกต้อง');
        }
        if (!isset($payload['jti'], $payload['sub'], $payload['kind'], $payload['tokenType']) || $payload['tokenType'] !== 'refresh') {
            throw new ApiException(401, 'INVALID_REFRESH_TOKEN', 'โทเคนสำหรับต่ออายุไม่ถูกต้อง');
        }
        $self = $this;
        return $this->db->transaction(function (Database $db) use ($payload, $rawToken, $self) {
            $record = $db->fetchOne('SELECT * FROM RefreshToken WHERE id = ? FOR UPDATE', array($payload['jti']));
            if (!$record || $record['revokedAt'] !== null || strtotime($record['expiresAt']) <= time() || !hash_equals($record['tokenHash'], hash('sha256', $rawToken))) {
                if ($record) {
                    $db->execute('UPDATE RefreshToken SET revokedAt = UTC_TIMESTAMP() WHERE ownerType = ? AND ownerId = ? AND revokedAt IS NULL', array($record['ownerType'], $record['ownerId']));
                }
                throw new ApiException(401, 'REFRESH_TOKEN_REUSED', 'เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่');
            }
            $db->execute('UPDATE RefreshToken SET revokedAt = UTC_TIMESTAMP() WHERE id = ?', array($record['id']));
            return $self->issueTokens($payload['sub'], $payload['kind'], isset($payload['role']) ? $payload['role'] : null, isset($payload['username']) ? $payload['username'] : null, $record['id'], $db);
        });
    }

    public function logout($rawToken)
    {
        try {
            $payload = JwtCodec::decodeHs256($rawToken, $this->config->get('JWT_REFRESH_SECRET'));
            if (isset($payload['jti'])) {
                $this->db->execute('UPDATE RefreshToken SET revokedAt = COALESCE(revokedAt, UTC_TIMESTAMP()) WHERE id = ?', array($payload['jti']));
            }
        } catch (\Exception $ignored) {
        }
        return array('loggedOut' => true);
    }

    public function changePassword($adminId, $current, $next)
    {
        if (strlen($next) < 12) {
            throw new ApiException(400, 'VALIDATION_ERROR', 'รหัสผ่านใหม่ต้องมีอย่างน้อย 12 ตัวอักษร');
        }
        $user = $this->db->fetchOne('SELECT passwordHash FROM AdminUser WHERE id = ?', array($adminId));
        if (!$user || !password_verify($current, $user['passwordHash'])) {
            throw new ApiException(401, 'INVALID_CREDENTIALS', 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
        }
        $this->db->transaction(function (Database $db) use ($adminId, $next) {
            $db->execute('UPDATE AdminUser SET passwordHash = ?, updatedAt = UTC_TIMESTAMP() WHERE id = ?', array(password_hash($next, PASSWORD_BCRYPT, array('cost' => 12)), $adminId));
            $db->execute("UPDATE RefreshToken SET revokedAt = UTC_TIMESTAMP() WHERE ownerType = 'ADMIN' AND ownerId = ? AND revokedAt IS NULL", array($adminId));
        });
        return array('changed' => true);
    }

    private function upsertCitizen($provider, $providerId, $name, $email, $picture)
    {
        $self = $this;
        $citizen = $this->db->transaction(function (Database $db) use ($provider, $providerId, $name, $email, $picture, $self) {
            $identity = $db->fetchOne('SELECT citizenUserId FROM ExternalIdentity WHERE provider = ? AND providerUserId = ? FOR UPDATE', array($provider, $providerId));
            if ($identity) {
                $db->execute('UPDATE CitizenUser SET fullName = ?, email = ?, profileImageUrl = ?, lastLoginAt = UTC_TIMESTAMP(), updatedAt = UTC_TIMESTAMP() WHERE id = ?', array($name, $email, $picture, $identity['citizenUserId']));
                return $db->fetchOne('SELECT * FROM CitizenUser WHERE id = ?', array($identity['citizenUserId']));
            }
            $id = Uuid::v4();
            $db->execute('INSERT INTO CitizenUser (id, fullName, email, profileImageUrl, status, lastLoginAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, \'ACTIVE\', UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP())', array($id, $name, $email, $picture));
            $db->execute('INSERT INTO ExternalIdentity (id, citizenUserId, provider, providerUserId, createdAt, updatedAt) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())', array(Uuid::v4(), $id, $provider, $providerId));
            return $db->fetchOne('SELECT * FROM CitizenUser WHERE id = ?', array($id));
        });
        if ($citizen['status'] !== 'ACTIVE') {
            throw new ApiException(403, 'ACCOUNT_INACTIVE', 'บัญชีนี้ไม่สามารถใช้งานได้');
        }
        return $this->issueTokens($citizen['id'], 'citizen', null, null);
    }

    private function issueTokens($sub, $kind, $role, $username, $replaces = null, Database $database = null)
    {
        $db = $database ? $database : $this->db;
        $now = time();
        $accessTtl = $this->config->int('JWT_ACCESS_TTL', 900);
        $refreshTtl = $this->config->int('JWT_REFRESH_TTL', 2592000);
        $base = array('sub' => $sub, 'kind' => $kind, 'iat' => $now);
        if ($role !== null) {
            $base['role'] = $role;
        }
        if ($username !== null) {
            $base['username'] = $username;
        }
        $access = $base;
        $access['tokenType'] = 'access';
        $access['exp'] = $now + $accessTtl;
        $jti = Uuid::v4();
        $refresh = $base;
        $refresh['tokenType'] = 'refresh';
        $refresh['jti'] = $jti;
        $refresh['exp'] = $now + $refreshTtl;
        $accessToken = JwtCodec::encodeHs256($access, $this->config->get('JWT_ACCESS_SECRET'));
        $refreshToken = JwtCodec::encodeHs256($refresh, $this->config->get('JWT_REFRESH_SECRET'));
        $db->execute('INSERT INTO RefreshToken (id, ownerType, ownerId, tokenHash, expiresAt, replacedByTokenId, createdAt) VALUES (?, ?, ?, ?, FROM_UNIXTIME(?), NULL, UTC_TIMESTAMP())', array($jti, strtoupper($kind), $sub, hash('sha256', $refreshToken), $now + $refreshTtl));
        if ($replaces !== null) {
            $db->execute('UPDATE RefreshToken SET replacedByTokenId = ? WHERE id = ?', array($jti, $replaces));
        }
        return array('accessToken' => $accessToken, 'refreshToken' => $refreshToken, 'expiresIn' => (string) $accessTtl);
    }

    private function httpJson($method, $url, $body, array $headers)
    {
        $curl = curl_init($url);
        curl_setopt_array($curl, array(CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_SSL_VERIFYPEER => true, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers));
        if ($body !== null) {
            curl_setopt($curl, CURLOPT_POSTFIELDS, $body);
        }
        $response = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $error = curl_error($curl);
        curl_close($curl);
        if ($response === false || $status < 200 || $status >= 300) {
            throw new ApiException($status === 401 ? 401 : 503, 'EXTERNAL_AUTH_FAILED', $error ? $error : 'ไม่สามารถตรวจสอบบัญชีภายนอกได้');
        }
        $decoded = json_decode($response, true);
        if (!is_array($decoded)) {
            throw new ApiException(503, 'EXTERNAL_AUTH_FAILED', 'บริการยืนยันตัวตนส่งข้อมูลไม่ถูกต้อง');
        }
        return $decoded;
    }
}
