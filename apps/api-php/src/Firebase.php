<?php

namespace Police\Api;

interface FirebaseAdapter
{
    public function customToken(array $principal);
    public function queue(Database $database, $channel, $eventType, $entityId);
    public function queueFcm(Database $database, $token, $title, $message, array $data);
    public function publishPending($limit);
    public function sendFcm($token, $title, $message, array $data);
}

final class FirebaseService implements FirebaseAdapter
{
    private $db;
    private $config;
    private $oauthToken;
    private $oauthExpiresAt = 0;

    public function __construct(Database $db, Config $config)
    {
        $this->db = $db;
        $this->config = $config;
    }

    public function customToken(array $principal)
    {
        if (!$this->config->bool('FIREBASE_ENABLED')) {
            throw new ApiException(503, 'FIREBASE_NOT_CONFIGURED', 'ยังไม่ได้ตั้งค่า Firebase');
        }
        $now = time();
        $uid = $principal['kind'] . ':' . $principal['sub'];
        $payload = array(
            'iss' => $this->config->get('FIREBASE_CLIENT_EMAIL'),
            'sub' => $this->config->get('FIREBASE_CLIENT_EMAIL'),
            'aud' => 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
            'iat' => $now,
            'exp' => $now + 3600,
            'uid' => $uid,
            'claims' => array('kind' => $principal['kind'], 'userId' => $principal['sub'], 'role' => isset($principal['role']) ? $principal['role'] : null),
        );
        return array('customToken' => JwtCodec::encodeRs256($payload, $this->privateKey()), 'expiresIn' => 3600);
    }

    public function queue(Database $database, $channel, $eventType, $entityId)
    {
        $event = array(
            'version' => (int) floor(microtime(true) * 1000),
            'eventId' => Uuid::v4(),
            'type' => $eventType,
            'entityId' => $entityId,
            'occurredAt' => gmdate('c'),
        );
        $database->execute(
            "INSERT INTO RealtimeOutbox (id, deliveryType, channelPath, eventType, entityId, payload, attempts, availableAt, createdAt) VALUES (?, 'RTDB', ?, ?, ?, ?, 0, UTC_TIMESTAMP(), UTC_TIMESTAMP())",
            array($event['eventId'], $channel, $eventType, $entityId, json_encode($event, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES))
        );
        return $event;
    }

    public function queueFcm(Database $database, $token, $title, $message, array $data)
    {
        if (!$this->config->bool('FCM_ENABLED')) {
            return null;
        }
        $id = Uuid::v4();
        $payload = array('token' => $token, 'title' => $title, 'message' => $message, 'data' => $data);
        $database->execute(
            "INSERT INTO RealtimeOutbox (id, deliveryType, channelPath, eventType, entityId, payload, attempts, availableAt, createdAt) VALUES (?, 'FCM', 'fcm', 'notification.push', ?, ?, 0, UTC_TIMESTAMP(), UTC_TIMESTAMP())",
            array($id, isset($data['incidentId']) ? $data['incidentId'] : null, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES))
        );
        return $id;
    }

    public function publishPending($limit)
    {
        if (!$this->config->bool('FIREBASE_ENABLED')) {
            return array('published' => 0, 'failed' => 0);
        }
        $rows = $this->db->fetchAll('SELECT * FROM RealtimeOutbox WHERE publishedAt IS NULL AND availableAt <= UTC_TIMESTAMP() ORDER BY createdAt ASC LIMIT ' . max(1, min(100, (int) $limit)));
        $published = 0;
        $failed = 0;
        foreach ($rows as $row) {
            try {
                $payload = json_decode($row['payload'], true);
                if (isset($row['deliveryType']) && $row['deliveryType'] === 'FCM') {
                    $this->sendFcm($payload['token'], $payload['title'], $payload['message'], $payload['data']);
                } else {
                    $this->putRtdb($row['channelPath'], $payload);
                }
                $this->db->execute('UPDATE RealtimeOutbox SET publishedAt = UTC_TIMESTAMP(), lastError = NULL WHERE id = ?', array($row['id']));
                $published++;
            } catch (\Exception $error) {
                $attempts = (int) $row['attempts'] + 1;
                $delay = min(3600, pow(2, min($attempts, 10)));
                $this->db->execute('UPDATE RealtimeOutbox SET attempts = ?, availableAt = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ' . (int) $delay . ' SECOND), lastError = ? WHERE id = ?', array($attempts, substr($error->getMessage(), 0, 1000), $row['id']));
                $failed++;
            }
        }
        return array('published' => $published, 'failed' => $failed);
    }

    public function sendFcm($token, $title, $message, array $data)
    {
        if (!$this->config->bool('FCM_ENABLED')) {
            return false;
        }
        $url = 'https://fcm.googleapis.com/v1/projects/' . rawurlencode($this->config->get('FIREBASE_PROJECT_ID')) . '/messages:send';
        $payload = array('message' => array('token' => $token, 'notification' => array('title' => $title, 'body' => $message), 'data' => $data));
        $this->request('POST', $url, json_encode($payload), array('Authorization: Bearer ' . $this->oauthToken(), 'Content-Type: application/json'));
        return true;
    }

    private function putRtdb($path, array $payload)
    {
        $base = rtrim($this->config->get('FIREBASE_DATABASE_URL'), '/');
        $url = $base . '/' . implode('/', array_map('rawurlencode', explode('/', trim($path, '/')))) . '.json';
        $this->request('PUT', $url, json_encode($payload), array('Authorization: Bearer ' . $this->oauthToken(), 'Content-Type: application/json'));
    }

    private function oauthToken()
    {
        if ($this->oauthToken && $this->oauthExpiresAt > time() + 60) {
            return $this->oauthToken;
        }
        $now = time();
        $assertion = JwtCodec::encodeRs256(array(
            'iss' => $this->config->get('FIREBASE_CLIENT_EMAIL'),
            'scope' => 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/userinfo.email',
            'aud' => 'https://oauth2.googleapis.com/token',
            'iat' => $now,
            'exp' => $now + 3600,
        ), $this->privateKey());
        $body = http_build_query(array('grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion' => $assertion));
        $response = $this->request('POST', 'https://oauth2.googleapis.com/token', $body, array('Content-Type: application/x-www-form-urlencoded'));
        $decoded = json_decode($response, true);
        if (!is_array($decoded) || !isset($decoded['access_token'])) {
            throw new ApiException(503, 'FIREBASE_AUTH_FAILED', 'ไม่สามารถยืนยันตัวตนกับ Firebase ได้');
        }
        $this->oauthToken = $decoded['access_token'];
        $this->oauthExpiresAt = $now + (isset($decoded['expires_in']) ? (int) $decoded['expires_in'] : 3600);
        return $this->oauthToken;
    }

    private function privateKey()
    {
        return str_replace('\\n', "\n", $this->config->get('FIREBASE_PRIVATE_KEY'));
    }

    private function request($method, $url, $body, array $headers)
    {
        $curl = curl_init($url);
        curl_setopt_array($curl, array(CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_SSL_VERIFYPEER => true, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_POSTFIELDS => $body, CURLOPT_HTTPHEADER => $headers));
        $response = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $error = curl_error($curl);
        curl_close($curl);
        if ($response === false || $status < 200 || $status >= 300) {
            throw new ApiException(503, 'FIREBASE_DELIVERY_FAILED', $error ? $error : 'Firebase request failed with status ' . $status);
        }
        return $response;
    }
}
