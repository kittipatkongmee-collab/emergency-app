<?php

namespace Police\Api;

final class ApiController
{
    private $db;
    private $config;
    private $auth;
    private $firebase;
    private $storage;

    public function __construct(Database $db, Config $config, AuthService $auth, FirebaseAdapter $firebase, ImageStorage $storage)
    {
        $this->db = $db;
        $this->config = $config;
        $this->auth = $auth;
        $this->firebase = $firebase;
        $this->storage = $storage;
    }

    public function handle($action, Request $request)
    {
        if (!method_exists($this, $action)) {
            throw new ApiException(500, 'HANDLER_NOT_FOUND', 'ยังไม่ได้ติดตั้งส่วนประมวลผลนี้');
        }
        return $this->$action($request);
    }

    private function health(Request $request)
    {
        return array('status' => 'ok', 'timestamp' => gmdate('c'));
    }

    private function ready(Request $request)
    {
        $this->db->fetchOne('SELECT 1 AS ready');
        return array('status' => 'ready');
    }

    private function citizenDevelopmentLogin(Request $request)
    {
        return $this->auth->developmentLogin($this->requiredString($request->body, 'profileId', 3, 100));
    }

    private function citizenFacebookLogin(Request $request)
    {
        return $this->auth->facebookLogin($this->requiredString($request->body, 'accessToken', 3, 5000));
    }

    private function citizenLineLogin(Request $request)
    {
        return $this->auth->lineLogin($this->requiredString($request->body, 'idToken', 20, 10000), $this->requiredString($request->body, 'nonce', 16, 255));
    }

    private function adminLogin(Request $request)
    {
        return $this->auth->adminLogin($this->requiredString($request->body, 'username', 1, 100), $this->requiredString($request->body, 'password', 8, 128));
    }

    private function refresh(Request $request)
    {
        return $this->auth->refresh($this->requiredString($request->body, 'refreshToken', 20, 10000));
    }

    private function logout(Request $request)
    {
        return $this->auth->logout($this->requiredString($request->body, 'refreshToken', 20, 10000));
    }

    private function citizenMe(Request $request)
    {
        $user = $this->db->fetchOne('SELECT * FROM CitizenUser WHERE id = ?', array($request->principal['sub']));
        if (!$user) {
            throw new ApiException(404, 'USER_NOT_FOUND', 'ไม่พบบัญชีผู้ใช้');
        }
        return $this->booleans($user, array());
    }

    private function adminMe(Request $request)
    {
        return $this->adminUserRecord($request->principal['sub']);
    }

    private function changePassword(Request $request)
    {
        return $this->auth->changePassword($request->principal['sub'], $this->requiredString($request->body, 'currentPassword', 1, 128), $this->requiredString($request->body, 'newPassword', 12, 128));
    }

    private function realtimeToken(Request $request)
    {
        return $this->firebase->customToken($request->principal);
    }

    private function createIncident(Request $request)
    {
        $body = $request->body;
        $reporterName = $this->requiredString($body, 'reporterName', 2, 120);
        $phone = $this->requiredString($body, 'reporterPhone', 9, 10);
        if (!preg_match('/^0\d{8,9}$/', $phone)) {
            throw new ApiException(400, 'VALIDATION_ERROR', 'หมายเลขโทรศัพท์ต้องขึ้นต้นด้วย 0 และมี 9-10 หลัก');
        }
        $type = $this->enumValue($body, 'type', array('AIRCRAFT_ACCIDENT', 'DISASTER_RELIEF'));
        $description = $this->requiredString($body, 'description', 10, 3000);
        $address = $this->requiredString($body, 'address', 3, 500);
        $latitude = $this->coordinate($body, 'latitude', -90, 90);
        $longitude = $this->coordinate($body, 'longitude', -180, 180);
        $priority = isset($body['priority']) ? $this->enumValue($body, 'priority', array('LOW', 'NORMAL', 'HIGH', 'CRITICAL')) : 'NORMAL';
        if (isset($body['images']) && !is_array($body['images'])) {
            throw new ApiException(400, 'INVALID_UPLOAD', 'ข้อมูลรูปภาพไม่ถูกต้อง');
        }
        $encodedImages = isset($body['images']) ? $body['images'] : array();
        if (count($encodedImages) > 5) {
            throw new ApiException(400, 'FILE_LIMIT_EXCEEDED', 'แนบรูปภาพได้ไม่เกิน 5 รูปต่อเหตุการณ์');
        }
        $idempotency = trim((string) $request->header('idempotency-key', ''));
        if ($idempotency !== '' && (strlen($idempotency) > 100 || !preg_match('/^[A-Za-z0-9_.-]+$/', $idempotency))) {
            throw new ApiException(400, 'VALIDATION_ERROR', 'Idempotency-Key ไม่ถูกต้อง');
        }
        $clientRequestId = $idempotency === '' ? null : $request->principal['sub'] . ':' . $idempotency;
        if ($clientRequestId) {
            $existing = $this->db->fetchOne('SELECT id FROM Incident WHERE clientRequestId = ?', array($clientRequestId));
            if ($existing) {
                return $this->incidentDetail($existing['id'], 'citizen', $request->principal['sub']);
            }
        }
        $stored = $this->storeEncodedImages($encodedImages);
        $self = $this;
        try {
            $incidentId = $this->db->transaction(function (Database $db) use ($request, $reporterName, $phone, $type, $description, $latitude, $longitude, $address, $priority, $clientRequestId, $body, $stored, $self) {
                $year = (int) gmdate('Y');
                $db->execute('INSERT INTO CaseCounter (id, year, lastNumber, createdAt, updatedAt) VALUES (?, ?, 0, UTC_TIMESTAMP(), UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE year = VALUES(year)', array(Uuid::v4(), $year));
                $counter = $db->fetchOne('SELECT lastNumber FROM CaseCounter WHERE year = ? FOR UPDATE', array($year));
                $lastNumber = (int) $counter['lastNumber'] + 1;
                $db->execute('UPDATE CaseCounter SET lastNumber = ?, updatedAt = UTC_TIMESTAMP() WHERE year = ?', array($lastNumber, $year));
                $id = Uuid::v4();
                $caseCode = 'CASE-' . $year . '-' . str_pad((string) $lastNumber, 5, '0', STR_PAD_LEFT);
                $db->execute('INSERT INTO Incident (id, caseCode, clientRequestId, citizenUserId, reporterName, reporterPhone, type, description, latitude, longitude, address, subdistrict, district, province, postalCode, status, priority, reportedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'RECEIVED\', ?, UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP())', array($id, $caseCode, $clientRequestId, $request->principal['sub'], $reporterName, $phone, $type, $description, $latitude, $longitude, $address, $self->optionalString($body, 'subdistrict', 191), $self->optionalString($body, 'district', 191), $self->optionalString($body, 'province', 191), $self->optionalString($body, 'postalCode', 16), $priority));
                $self->insertIncidentImages($db, $id, $stored);
                $db->execute('INSERT INTO IncidentStatusHistory (id, incidentId, fromStatus, toStatus, note, changedAt) VALUES (?, ?, NULL, \'RECEIVED\', ?, UTC_TIMESTAMP())', array(Uuid::v4(), $id, 'ระบบได้รับรายการและรอดำเนินการ'));
                $db->execute('INSERT INTO Notification (id, citizenUserId, incidentId, title, message, type, isRead, createdAt) VALUES (?, ?, ?, ?, ?, \'INCIDENT_CREATED\', 0, UTC_TIMESTAMP())', array(Uuid::v4(), $request->principal['sub'], $id, 'รอดำเนินการ', 'ระบบได้รับรายการเลขที่ ' . $caseCode . ' และกำลังรอเจ้าหน้าที่รับแจ้งเหตุ'));
                $admins = $db->fetchAll("SELECT id FROM AdminUser WHERE status = 'ACTIVE' AND role IN ('SUPER_ADMIN', 'SUPERVISOR')");
                foreach ($admins as $admin) {
                    $db->execute('INSERT INTO Notification (id, adminUserId, incidentId, title, message, type, isRead, createdAt) VALUES (?, ?, ?, ?, ?, \'INCIDENT_CREATED\', 0, UTC_TIMESTAMP())', array(Uuid::v4(), $admin['id'], $id, 'มีเหตุการณ์ใหม่', $caseCode . ': ' . $description));
                    $self->firebase->queue($db, 'channels/users/admin:' . $admin['id'], 'notification.created', $id);
                }
                $self->firebase->queue($db, 'channels/admin', 'incident.created', $id);
                $self->firebase->queue($db, 'channels/users/citizen:' . $request->principal['sub'], 'notification.created', $id);
                return $id;
            });
        } catch (\Exception $error) {
            $this->removeStoredImages($stored);
            throw $error;
        }
        $this->publishBestEffort();
        return $this->incidentDetail($incidentId, 'citizen', $request->principal['sub']);
    }

    private function citizenIncidents(Request $request)
    {
        return $this->incidentList($request, true);
    }

    private function citizenIncident(Request $request)
    {
        return $this->incidentDetail($request->params['id'], 'citizen', $request->principal['sub']);
    }

    private function citizenIncidentByCode(Request $request)
    {
        $row = $this->db->fetchOne('SELECT id FROM Incident WHERE caseCode = ? AND citizenUserId = ?', array($request->params['caseCode'], $request->principal['sub']));
        if (!$row) {
            throw new ApiException(404, 'INCIDENT_NOT_FOUND', 'ไม่พบข้อมูลเหตุการณ์');
        }
        return $this->incidentDetail($row['id'], 'citizen', $request->principal['sub']);
    }

    private function adminIncidents(Request $request)
    {
        return $this->incidentList($request, false);
    }

    private function mapPoints(Request $request)
    {
        $params = array();
        $where = " WHERE status <> 'COMPLETED'";
        if ($request->principal['role'] === 'OFFICER') {
            $where .= ' AND assignedAdminUserId = ?';
            $params[] = $request->principal['sub'];
        }
        return $this->db->fetchAll('SELECT id, caseCode, latitude, longitude, address, status FROM Incident' . $where . ' ORDER BY reportedAt DESC', $params);
    }

    private function adminIncident(Request $request)
    {
        return $this->incidentDetail($request->params['id'], 'admin', null, $request->principal);
    }

    private function deleteIncident(Request $request)
    {
        $id = $request->params['id'];
        $self = $this;
        $deleted = $this->db->transaction(function (Database $db) use ($request, $id, $self) {
            $incident = $db->fetchOne('SELECT * FROM Incident WHERE id = ? FOR UPDATE', array($id));
            if (!$incident) {
                throw new ApiException(404, 'INCIDENT_NOT_FOUND', 'ไม่พบข้อมูลเหตุการณ์');
            }
            $images = $db->fetchAll('SELECT storageKey FROM IncidentImage WHERE incidentId = ?', array($id));
            $notifications = $db->fetchAll('SELECT citizenUserId, adminUserId FROM Notification WHERE incidentId = ?', array($id));
            $adminRecipients = array();
            $citizenRecipients = array($incident['citizenUserId'] => true);
            foreach ($notifications as $notification) {
                if ($notification['adminUserId']) {
                    $adminRecipients[$notification['adminUserId']] = true;
                }
                if ($notification['citizenUserId']) {
                    $citizenRecipients[$notification['citizenUserId']] = true;
                }
            }

            $db->execute('DELETE FROM RealtimeOutbox WHERE entityId = ? AND publishedAt IS NULL', array($id));
            $db->execute('DELETE FROM Notification WHERE incidentId = ?', array($id));
            $db->execute('DELETE FROM Incident WHERE id = ?', array($id));
            $self->audit($db, $request->principal['sub'], 'INCIDENT_DELETED', 'Incident', $id, array(
                'caseCode' => $incident['caseCode'],
                'type' => $incident['type'],
                'status' => $incident['status'],
                'imageCount' => count($images),
            ), null);
            $self->firebase->queue($db, 'channels/admin', 'incident.deleted', $id);
            foreach (array_keys($adminRecipients) as $adminId) {
                $self->firebase->queue($db, 'channels/users/admin:' . $adminId, 'notification.deleted', $id);
            }
            foreach (array_keys($citizenRecipients) as $citizenId) {
                $self->firebase->queue($db, 'channels/users/citizen:' . $citizenId, 'incident.deleted', $id);
                $self->firebase->queue($db, 'channels/users/citizen:' . $citizenId, 'notification.deleted', $id);
            }
            return array('caseCode' => $incident['caseCode'], 'images' => $images);
        });

        foreach ($deleted['images'] as $image) {
            if (!$this->storage->remove($image['storageKey'])) {
                error_log('Unable to remove incident image after deletion: ' . $image['storageKey']);
            }
        }
        $this->publishBestEffort();
        return array('deleted' => true, 'id' => $id, 'caseCode' => $deleted['caseCode']);
    }

    private function acceptIncident(Request $request)
    {
        $self = $this;
        $id = $request->params['id'];
        $this->db->transaction(function (Database $db) use ($request, $id, $self) {
            $incident = $db->fetchOne('SELECT * FROM Incident WHERE id = ? FOR UPDATE', array($id));
            if (!$incident) {
                throw new ApiException(404, 'INCIDENT_NOT_FOUND', 'ไม่พบข้อมูลเหตุการณ์');
            }
            if ($incident['status'] !== 'RECEIVED') {
                throw new ApiException(400, 'INCIDENT_CANNOT_BE_ACCEPTED', 'เหตุการณ์นี้ถูกรับแจ้งหรือสิ้นสุดการดำเนินการแล้ว');
            }
            $admin = $db->fetchOne("SELECT id, fullName FROM AdminUser WHERE id = ? AND status = 'ACTIVE'", array($request->principal['sub']));
            if (!$admin) {
                throw new ApiException(403, 'ADMIN_ACCOUNT_INACTIVE', 'บัญชีเจ้าหน้าที่ไม่พร้อมใช้งาน');
            }
            $db->execute("UPDATE IncidentAssignment SET unassignedAt = UTC_TIMESTAMP() WHERE incidentId = ? AND unassignedAt IS NULL", array($id));
            $db->execute('INSERT INTO IncidentAssignment (id, incidentId, assignedToAdminUserId, assignedByAdminUserId, assignedAt) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())', array(Uuid::v4(), $id, $admin['id'], $admin['id']));
            $db->execute("UPDATE Incident SET assignedAdminUserId = ?, status = 'IN_PROGRESS', completedAt = NULL, updatedAt = UTC_TIMESTAMP() WHERE id = ?", array($admin['id'], $id));
            $db->execute("INSERT INTO IncidentStatusHistory (id, incidentId, fromStatus, toStatus, note, changedByAdminUserId, changedAt) VALUES (?, ?, 'RECEIVED', 'IN_PROGRESS', ?, ?, UTC_TIMESTAMP())", array(Uuid::v4(), $id, 'รับแจ้งเหตุโดย ' . $admin['fullName'], $admin['id']));
            $self->audit($db, $admin['id'], 'INCIDENT_ACCEPTED', 'Incident', $id, array('status' => 'RECEIVED'), array('status' => 'IN_PROGRESS', 'assignedAdminUserId' => $admin['id']));
            $notificationId = Uuid::v4();
            $db->execute("INSERT INTO Notification (id, citizenUserId, incidentId, title, message, type, isRead, createdAt) VALUES (?, ?, ?, ?, ?, 'INCIDENT_STATUS_CHANGED', 0, UTC_TIMESTAMP())", array($notificationId, $incident['citizenUserId'], $id, 'เจ้าหน้าที่รับแจ้งเหตุแล้ว', $admin['fullName'] . ' กำลังดำเนินการเหตุ ' . $incident['caseCode']));
            $self->queueWorkflow($db, $incident['citizenUserId'], $id);
            $self->queueStatusPush($db, $incident['citizenUserId'], $id, $incident['caseCode'], 'IN_PROGRESS');
        });
        $this->publishBestEffort();
        return $this->incidentDetail($id, 'admin', null, $request->principal);
    }

    private function completeIncident(Request $request)
    {
        $self = $this;
        $id = $request->params['id'];
        $this->db->transaction(function (Database $db) use ($request, $id, $self) {
            $incident = $db->fetchOne('SELECT * FROM Incident WHERE id = ? FOR UPDATE', array($id));
            if (!$incident) {
                throw new ApiException(404, 'INCIDENT_NOT_FOUND', 'ไม่พบข้อมูลเหตุการณ์');
            }
            if ($incident['status'] !== 'IN_PROGRESS') {
                throw new ApiException(400, 'INCIDENT_CANNOT_BE_COMPLETED', 'เหตุการณ์นี้ยังไม่อยู่ระหว่างดำเนินการหรือเสร็จสิ้นแล้ว');
            }
            if ($incident['assignedAdminUserId'] !== $request->principal['sub']) {
                throw new ApiException(403, 'INCIDENT_NOT_ASSIGNEE', 'เฉพาะเจ้าหน้าที่ผู้รับผิดชอบเท่านั้นที่ยืนยันภารกิจสำเร็จได้');
            }
            $db->execute("UPDATE Incident SET status = 'COMPLETED', completedAt = UTC_TIMESTAMP(), updatedAt = UTC_TIMESTAMP() WHERE id = ?", array($id));
            $db->execute("INSERT INTO IncidentStatusHistory (id, incidentId, fromStatus, toStatus, note, changedByAdminUserId, changedAt) VALUES (?, ?, 'IN_PROGRESS', 'COMPLETED', ?, ?, UTC_TIMESTAMP())", array(Uuid::v4(), $id, 'ยืนยันภารกิจสำเร็จ', $request->principal['sub']));
            $self->audit($db, $request->principal['sub'], 'INCIDENT_COMPLETED', 'Incident', $id, array('status' => 'IN_PROGRESS'), array('status' => 'COMPLETED'));
            $db->execute("INSERT INTO Notification (id, citizenUserId, incidentId, title, message, type, isRead, createdAt) VALUES (?, ?, ?, ?, ?, 'INCIDENT_STATUS_CHANGED', 0, UTC_TIMESTAMP())", array(Uuid::v4(), $incident['citizenUserId'], $id, 'ภารกิจสำเร็จ', 'ดำเนินการเหตุ ' . $incident['caseCode'] . ' เสร็จสิ้นแล้ว'));
            $self->queueWorkflow($db, $incident['citizenUserId'], $id);
            $self->queueStatusPush($db, $incident['citizenUserId'], $id, $incident['caseCode'], 'COMPLETED');
        });
        $this->publishBestEffort();
        return $this->incidentDetail($id, 'admin', null, $request->principal);
    }

    private function addIncidentNote(Request $request)
    {
        $noteText = $this->requiredString($request->body, 'note', 2, 2000);
        $visible = isset($request->body['isVisibleToCitizen']) ? (bool) $request->body['isVisibleToCitizen'] : false;
        $self = $this;
        $id = $request->params['id'];
        $noteId = $this->db->transaction(function (Database $db) use ($request, $id, $noteText, $visible, $self) {
            $incident = $db->fetchOne('SELECT * FROM Incident WHERE id = ? FOR UPDATE', array($id));
            if (!$incident) {
                throw new ApiException(404, 'INCIDENT_NOT_FOUND', 'ไม่พบข้อมูลเหตุการณ์');
            }
            $self->assertOfficerIncident($incident, $request->principal);
            $noteId = Uuid::v4();
            $db->execute('INSERT INTO IncidentNote (id, incidentId, adminUserId, note, isVisibleToCitizen, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())', array($noteId, $id, $request->principal['sub'], $noteText, $visible ? 1 : 0));
            $self->audit($db, $request->principal['sub'], 'INCIDENT_NOTE_CREATED', 'IncidentNote', $noteId, null, array('incidentId' => $id, 'isVisibleToCitizen' => $visible));
            if ($visible) {
                $db->execute("INSERT INTO Notification (id, citizenUserId, incidentId, title, message, type, isRead, createdAt) VALUES (?, ?, ?, ?, ?, 'INCIDENT_STATUS_CHANGED', 0, UTC_TIMESTAMP())", array(Uuid::v4(), $incident['citizenUserId'], $id, 'มีหมายเหตุใหม่', $noteText));
                $self->firebase->queue($db, 'channels/users/citizen:' . $incident['citizenUserId'], 'notification.created', $id);
            }
            $self->firebase->queue($db, 'channels/admin', 'incident.updated', $id);
            return $noteId;
        });
        $this->publishBestEffort();
        return $this->db->fetchOne('SELECT * FROM IncidentNote WHERE id = ?', array($noteId));
    }

    private function uploadImages(Request $request)
    {
        $incident = $this->db->fetchOne('SELECT id FROM Incident WHERE id = ? AND citizenUserId = ?', array($request->params['id'], $request->principal['sub']));
        if (!$incident) {
            throw new ApiException(404, 'INCIDENT_NOT_FOUND', 'ไม่พบข้อมูลเหตุการณ์');
        }
        $files = $this->normalizeFiles(isset($request->files['files']) ? $request->files['files'] : null);
        $encodedImages = isset($request->body['images']) && is_array($request->body['images']) ? $request->body['images'] : array();
        $existing = $this->db->fetchOne('SELECT COUNT(*) AS total FROM IncidentImage WHERE incidentId = ?', array($incident['id']));
        $incomingCount = count($files) + count($encodedImages);
        if ($incomingCount < 1) {
            throw new ApiException(400, 'INVALID_UPLOAD', 'ไม่พบข้อมูลรูปภาพในคำขอ');
        }
        if ((int) $existing['total'] + $incomingCount > 5) {
            throw new ApiException(400, 'FILE_LIMIT_EXCEEDED', 'แนบรูปภาพได้ไม่เกิน 5 รูปต่อเหตุการณ์');
        }
        $stored = array();
        try {
            foreach ($files as $file) {
                $stored[] = $this->storage->save($file);
            }
            $stored = array_merge($stored, $this->storeEncodedImages($encodedImages));
            $self = $this;
            $images = $this->db->transaction(function (Database $db) use ($stored, $incident, $self) {
                $rows = $self->insertIncidentImages($db, $incident['id'], $stored);
                $self->firebase->queue($db, 'channels/admin', 'incident.updated', $incident['id']);
                return $rows;
            });
            $this->publishBestEffort();
            return $images;
        } catch (\Exception $error) {
            $this->removeStoredImages($stored);
            throw $error;
        }
    }

    private function storeEncodedImages(array $encodedImages)
    {
        $stored = array();
        try {
            foreach ($encodedImages as $image) {
                if (!is_array($image) || !isset($image['fileName'], $image['contentBase64']) || !is_string($image['fileName']) || !is_string($image['contentBase64'])) {
                    throw new ApiException(400, 'INVALID_UPLOAD', 'ข้อมูลรูปภาพไม่ถูกต้อง');
                }
                $stored[] = $this->storage->saveEncoded($image['fileName'], $image['contentBase64']);
            }
            return $stored;
        } catch (\Exception $error) {
            $this->removeStoredImages($stored);
            throw $error;
        }
    }

    private function insertIncidentImages(Database $db, $incidentId, array $stored)
    {
        $rows = array();
        foreach ($stored as $item) {
            $id = Uuid::v4();
            $db->execute('INSERT INTO IncidentImage (id, incidentId, fileName, originalName, mimeType, fileSize, storageDriver, storageKey, imageUrl, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())', array($id, $incidentId, $item['fileName'], $item['originalName'], $item['mimeType'], $item['fileSize'], $item['storageDriver'], $item['storageKey'], $item['imageUrl']));
            $rows[] = $db->fetchOne('SELECT * FROM IncidentImage WHERE id = ?', array($id));
        }
        return $rows;
    }

    private function removeStoredImages(array $stored)
    {
        foreach ($stored as $item) {
            $this->storage->remove($item['storageKey']);
        }
    }

    private function dashboardSummary(Request $request)
    {
        list($dateSql, $dateParams) = $this->dashboardDateWhere($request->query);
        $row = $this->db->fetchOne("SELECT COUNT(*) total, SUM(status = 'RECEIVED') waiting, SUM(status IN ('FORWARDED','INSPECTING','IN_PROGRESS')) inProgress, SUM(status = 'COMPLETED') completed, SUM(status IN ('CANCELLED','REJECTED')) cancelled FROM Incident" . $dateSql, $dateParams);
        $counts = $this->db->fetchOne("SELECT SUM(reportedAt >= UTC_DATE()) todayCount, SUM(reportedAt >= DATE_SUB(UTC_DATE(), INTERVAL 6 DAY)) thisWeek, SUM(reportedAt >= DATE_SUB(UTC_DATE(), INTERVAL 13 DAY) AND reportedAt < DATE_SUB(UTC_DATE(), INTERVAL 6 DAY)) previousWeek FROM Incident");
        $week = (int) $counts['thisWeek'];
        $previous = (int) $counts['previousWeek'];
        $percentage = $previous === 0 ? ($week === 0 ? 0 : 100) : round((($week - $previous) / $previous) * 100, 1);
        return array('total' => (int) $row['total'], 'waiting' => (int) $row['waiting'], 'inProgress' => (int) $row['inProgress'], 'completed' => (int) $row['completed'], 'cancelled' => (int) $row['cancelled'], 'today' => (int) $counts['todayCount'], 'thisWeek' => $week, 'percentageChange' => $percentage);
    }

    private function dashboardRecent(Request $request)
    {
        list($where, $params) = $this->incidentWhere($request, false, true);
        $rows = $this->db->fetchAll('SELECT Incident.* FROM Incident' . $where . ' ORDER BY reportedAt DESC LIMIT 5', $params);
        return $this->hydrateIncidentList($rows, 'admin');
    }

    private function dashboardByStatus(Request $request)
    {
        return $this->groupCount('status');
    }

    private function dashboardByType(Request $request)
    {
        return $this->groupCount('type');
    }

    private function dashboardByDate(Request $request)
    {
        $days = isset($request->query['days']) ? max(1, min(90, (int) $request->query['days'])) : 30;
        $rows = $this->db->fetchAll('SELECT DATE(reportedAt) AS date, COUNT(*) AS total FROM Incident WHERE reportedAt >= DATE_SUB(UTC_DATE(), INTERVAL ' . (int) ($days - 1) . ' DAY) GROUP BY DATE(reportedAt) ORDER BY date ASC');
        foreach ($rows as &$row) {
            $row['total'] = (int) $row['total'];
        }
        return $rows;
    }

    private function adminUsers(Request $request)
    {
        list($page, $limit, $offset) = $this->pagination($request->query);
        $params = array();
        $where = '';
        if (isset($request->query['keyword']) && trim($request->query['keyword']) !== '') {
            $like = '%' . trim($request->query['keyword']) . '%';
            $where = ' WHERE a.username LIKE ? OR a.fullName LIKE ? OR a.email LIKE ?';
            $params = array($like, $like, $like);
        }
        $total = $this->db->fetchOne('SELECT COUNT(*) total FROM AdminUser a' . $where, $params);
        $rows = $this->db->fetchAll('SELECT a.id, a.username, a.email, a.fullName, a.phone, a.role, a.positionId, a.status, a.lastLoginAt, a.createdAt, a.updatedAt, p.name positionName, p.createdAt positionCreatedAt, p.updatedAt positionUpdatedAt FROM AdminUser a LEFT JOIN StaffPosition p ON p.id = a.positionId' . $where . ' ORDER BY a.fullName ASC LIMIT ' . $limit . ' OFFSET ' . $offset, $params);
        foreach ($rows as &$row) {
            $row = $this->mapAdminRow($row);
        }
        return $this->page($rows, $page, $limit, (int) $total['total']);
    }

    private function staffPositions(Request $request)
    {
        return $this->db->fetchAll('SELECT * FROM StaffPosition ORDER BY name ASC');
    }

    private function createStaffPosition(Request $request)
    {
        $name = $this->requiredString($request->body, 'name', 2, 100);
        if ($this->db->fetchOne('SELECT id FROM StaffPosition WHERE name = ?', array($name))) {
            throw new ApiException(409, 'CONFLICT', 'มีชื่อตำแหน่งนี้อยู่แล้ว');
        }
        $id = Uuid::v4();
        $this->db->transaction(function (Database $db) use ($request, $name, $id) {
            $db->execute('INSERT INTO StaffPosition (id, name, createdAt, updatedAt) VALUES (?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())', array($id, $name));
            $this->audit($db, $request->principal['sub'], 'STAFF_POSITION_CREATED', 'StaffPosition', $id, null, array('name' => $name));
        });
        return $this->db->fetchOne('SELECT * FROM StaffPosition WHERE id = ?', array($id));
    }

    private function createAdminUser(Request $request)
    {
        $username = $this->requiredString($request->body, 'username', 3, 100);
        $fullName = $this->requiredString($request->body, 'fullName', 2, 191);
        $password = $this->requiredString($request->body, 'password', 12, 128);
        $positionId = $this->requiredUuid($request->body, 'positionId');
        $role = isset($request->body['role']) ? $this->enumValue($request->body, 'role', array('SUPER_ADMIN', 'SUPERVISOR', 'OFFICER', 'VIEWER')) : 'OFFICER';
        $this->assertManageableRole($request->principal, $role, false);
        $this->assertPosition($positionId);
        if ($this->db->fetchOne('SELECT id FROM AdminUser WHERE username = ?', array($username))) {
            throw new ApiException(409, 'CONFLICT', 'ชื่อผู้ใช้นี้มีอยู่แล้ว');
        }
        $id = Uuid::v4();
        $self = $this;
        $this->db->transaction(function (Database $db) use ($request, $id, $username, $fullName, $password, $positionId, $role, $self) {
            $db->execute("INSERT INTO AdminUser (id, username, email, passwordHash, fullName, phone, role, positionId, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', UTC_TIMESTAMP(), UTC_TIMESTAMP())", array($id, $username, $self->optionalString($request->body, 'email', 320), password_hash($password, PASSWORD_BCRYPT, array('cost' => 12)), $fullName, $self->optionalString($request->body, 'phone', 32), $role, $positionId));
            $self->audit($db, $request->principal['sub'], 'ADMIN_CREATED', 'AdminUser', $id, null, array('username' => $username, 'role' => $role, 'positionId' => $positionId));
        });
        return $this->adminUserRecord($id);
    }

    private function adminUser(Request $request)
    {
        $user = $this->adminUserRecord($request->params['id']);
        $this->assertManageableRole($request->principal, $user['role'], true);
        return $user;
    }

    private function updateAdminUser(Request $request)
    {
        $current = $this->adminUserRecord($request->params['id']);
        $this->assertManageableRole($request->principal, $current['role'], false);
        $fields = array();
        $params = array();
        foreach (array('fullName' => 191, 'email' => 320, 'phone' => 32) as $field => $max) {
            if (array_key_exists($field, $request->body)) {
                $fields[] = $field . ' = ?';
                $params[] = $this->optionalString($request->body, $field, $max);
            }
        }
        if (isset($request->body['role'])) {
            $role = $this->enumValue($request->body, 'role', array('SUPER_ADMIN', 'SUPERVISOR', 'OFFICER', 'VIEWER'));
            $this->assertManageableRole($request->principal, $role, false);
            $fields[] = 'role = ?';
            $params[] = $role;
        }
        if (isset($request->body['positionId'])) {
            $position = $this->requiredUuid($request->body, 'positionId');
            $this->assertPosition($position);
            $fields[] = 'positionId = ?';
            $params[] = $position;
        }
        if (!$fields) {
            throw new ApiException(400, 'VALIDATION_ERROR', 'ไม่มีข้อมูลที่ต้องแก้ไข');
        }
        $params[] = $current['id'];
        $this->db->transaction(function (Database $db) use ($request, $fields, $params, $current) {
            $db->execute('UPDATE AdminUser SET ' . implode(', ', $fields) . ', updatedAt = UTC_TIMESTAMP() WHERE id = ?', $params);
            $this->audit($db, $request->principal['sub'], 'ADMIN_UPDATED', 'AdminUser', $current['id'], array('role' => $current['role'], 'status' => $current['status'], 'positionId' => $current['positionId']), $request->body);
        });
        return $this->adminUserRecord($current['id']);
    }

    private function updateAdminStatus(Request $request)
    {
        $current = $this->adminUserRecord($request->params['id']);
        $status = $this->enumValue($request->body, 'status', array('ACTIVE', 'INACTIVE', 'SUSPENDED'));
        if ($current['id'] === $request->principal['sub'] && $status !== 'ACTIVE') {
            throw new ApiException(400, 'VALIDATION_ERROR', 'ไม่สามารถปิดใช้งานบัญชีของตนเอง');
        }
        $this->assertManageableRole($request->principal, $current['role'], false);
        $this->db->transaction(function (Database $db) use ($request, $current, $status) {
            $db->execute('UPDATE AdminUser SET status = ?, updatedAt = UTC_TIMESTAMP() WHERE id = ?', array($status, $current['id']));
            if ($status !== 'ACTIVE') {
                $db->execute("UPDATE RefreshToken SET revokedAt = UTC_TIMESTAMP() WHERE ownerType = 'ADMIN' AND ownerId = ? AND revokedAt IS NULL", array($current['id']));
            }
            $this->audit($db, $request->principal['sub'], 'ADMIN_STATUS_CHANGED', 'AdminUser', $current['id'], array('status' => $current['status']), array('status' => $status));
        });
        return $this->adminUserRecord($current['id']);
    }

    private function deleteAdminUser(Request $request)
    {
        $current = $this->adminUserRecord($request->params['id']);
        if ($current['id'] === $request->principal['sub']) {
            throw new ApiException(400, 'VALIDATION_ERROR', 'ไม่สามารถลบบัญชีของตนเอง');
        }
        $this->assertManageableRole($request->principal, $current['role'], false);
        $references = $this->db->fetchOne('SELECT (SELECT COUNT(*) FROM Incident WHERE assignedAdminUserId = ?) + (SELECT COUNT(*) FROM IncidentNote WHERE adminUserId = ?) + (SELECT COUNT(*) FROM AuditLog WHERE adminUserId = ?) AS total', array($current['id'], $current['id'], $current['id']));
        if ((int) $references['total'] > 0) {
            throw new ApiException(400, 'ADMIN_USER_IN_USE', 'บัญชีนี้มีประวัติการใช้งาน กรุณาปิดใช้งานแทนการลบ');
        }
        $this->db->transaction(function (Database $db) use ($request, $current) {
            $db->execute("DELETE FROM RefreshToken WHERE ownerType = 'ADMIN' AND ownerId = ?", array($current['id']));
            $db->execute('DELETE FROM AdminUser WHERE id = ?', array($current['id']));
            $this->audit($db, $request->principal['sub'], 'ADMIN_DELETED', 'AdminUser', $current['id'], array('username' => $current['username']), null);
        });
        return array('deleted' => true);
    }

    private function resetAdminPassword(Request $request)
    {
        $current = $this->adminUserRecord($request->params['id']);
        $this->assertManageableRole($request->principal, $current['role'], false);
        $password = $this->requiredString($request->body, 'newPassword', 12, 128);
        $this->db->transaction(function (Database $db) use ($request, $current, $password) {
            $db->execute('UPDATE AdminUser SET passwordHash = ?, updatedAt = UTC_TIMESTAMP() WHERE id = ?', array(password_hash($password, PASSWORD_BCRYPT, array('cost' => 12)), $current['id']));
            $db->execute("UPDATE RefreshToken SET revokedAt = UTC_TIMESTAMP() WHERE ownerType = 'ADMIN' AND ownerId = ? AND revokedAt IS NULL", array($current['id']));
            $this->audit($db, $request->principal['sub'], 'ADMIN_PASSWORD_RESET', 'AdminUser', $current['id']);
        });
        return array('reset' => true);
    }

    private function auditLogs(Request $request)
    {
        list($page, $limit, $offset) = $this->pagination($request->query);
        $params = array();
        $where = '';
        if (isset($request->query['keyword']) && trim($request->query['keyword']) !== '') {
            $like = '%' . trim($request->query['keyword']) . '%';
            $where = ' WHERE l.action LIKE ? OR l.entityType LIKE ? OR l.entityId LIKE ? OR a.fullName LIKE ?';
            $params = array($like, $like, $like, $like);
        }
        $total = $this->db->fetchOne('SELECT COUNT(*) total FROM AuditLog l LEFT JOIN AdminUser a ON a.id = l.adminUserId' . $where, $params);
        $items = $this->db->fetchAll('SELECT l.*, a.fullName adminFullName FROM AuditLog l LEFT JOIN AdminUser a ON a.id = l.adminUserId' . $where . ' ORDER BY l.createdAt DESC LIMIT ' . $limit . ' OFFSET ' . $offset, $params);
        foreach ($items as &$item) {
            $item['oldValue'] = $item['oldValue'] === null ? null : json_decode($item['oldValue'], true);
            $item['newValue'] = $item['newValue'] === null ? null : json_decode($item['newValue'], true);
            $item['adminUser'] = $item['adminFullName'] ? array('fullName' => $item['adminFullName']) : null;
            unset($item['adminFullName']);
        }
        return $this->page($items, $page, $limit, (int) $total['total']);
    }

    private function settings(Request $request)
    {
        $rows = $this->db->fetchAll('SELECT * FROM SystemSetting ORDER BY `key` ASC');
        foreach ($rows as &$row) {
            $row['value'] = json_decode($row['value'], true);
        }
        return $rows;
    }

    private function updateSettings(Request $request)
    {
        $allowed = array('emergencyContact', 'announcement', 'retentionDays');
        if (!$request->body) {
            throw new ApiException(400, 'VALIDATION_ERROR', 'ไม่มีการตั้งค่าที่ต้องแก้ไข');
        }
        foreach ($request->body as $key => $value) {
            if (!in_array($key, $allowed, true) || strlen(json_encode($value)) > 10000) {
                throw new ApiException(400, 'VALIDATION_ERROR', 'มีการตั้งค่าที่ไม่อนุญาต');
            }
        }
        $self = $this;
        $this->db->transaction(function (Database $db) use ($request, $self) {
            foreach ($request->body as $key => $value) {
                $id = Uuid::v4();
                $db->execute('INSERT INTO SystemSetting (id, `key`, value, updatedByAdminUserId, updatedAt) VALUES (?, ?, ?, ?, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE value = VALUES(value), updatedByAdminUserId = VALUES(updatedByAdminUserId), updatedAt = UTC_TIMESTAMP()', array($id, $key, json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $request->principal['sub']));
            }
            $self->audit($db, $request->principal['sub'], 'SETTINGS_UPDATED', 'SystemSetting', null, null, array('keys' => array_keys($request->body)));
        });
        return $this->settings($request);
    }

    private function notifications(Request $request)
    {
        list($page, $limit, $offset) = $this->pagination($request->query);
        list($ownerSql, $ownerParams) = $this->notificationOwner($request);
        $total = $this->db->fetchOne('SELECT COUNT(*) total FROM Notification WHERE ' . $ownerSql, $ownerParams);
        $items = $this->db->fetchAll('SELECT * FROM Notification WHERE ' . $ownerSql . ' ORDER BY createdAt DESC LIMIT ' . $limit . ' OFFSET ' . $offset, $ownerParams);
        foreach ($items as &$item) {
            $item = $this->booleans($item, array('isRead'));
        }
        return $this->page($items, $page, $limit, (int) $total['total']);
    }

    private function unreadCount(Request $request)
    {
        list($ownerSql, $params) = $this->notificationOwner($request);
        $row = $this->db->fetchOne('SELECT COUNT(*) count FROM Notification WHERE ' . $ownerSql . ' AND isRead = 0', $params);
        return array('count' => (int) $row['count']);
    }

    private function readNotification(Request $request)
    {
        list($ownerSql, $params) = $this->notificationOwner($request);
        array_unshift($params, $request->params['id']);
        $statement = $this->db->execute('UPDATE Notification SET isRead = 1, readAt = UTC_TIMESTAMP() WHERE id = ? AND ' . $ownerSql, $params);
        if ($statement->rowCount() === 0) {
            throw new ApiException(404, 'NOT_FOUND', 'ไม่พบการแจ้งเตือน');
        }
        $this->queueUserEvent($request, 'notification.read', $request->params['id']);
        return array('read' => true);
    }

    private function readAllNotifications(Request $request)
    {
        list($ownerSql, $params) = $this->notificationOwner($request);
        $statement = $this->db->execute('UPDATE Notification SET isRead = 1, readAt = UTC_TIMESTAMP() WHERE ' . $ownerSql . ' AND isRead = 0', $params);
        $this->queueUserEvent($request, 'notification.read', 'all');
        return array('updated' => $statement->rowCount());
    }

    private function deleteNotification(Request $request)
    {
        list($ownerSql, $params) = $this->notificationOwner($request);
        array_unshift($params, $request->params['id']);
        $statement = $this->db->execute('DELETE FROM Notification WHERE id = ? AND ' . $ownerSql, $params);
        if ($statement->rowCount() === 0) {
            throw new ApiException(404, 'NOT_FOUND', 'ไม่พบการแจ้งเตือน');
        }
        $this->queueUserEvent($request, 'notification.deleted', $request->params['id']);
        return array('deleted' => true);
    }

    private function registerDevice(Request $request)
    {
        $token = $this->requiredString($request->body, 'token', 20, 512);
        $platform = $this->enumValue($request->body, 'platform', array('IOS', 'ANDROID', 'WEB'));
        $existing = $this->db->fetchOne('SELECT id FROM DeviceToken WHERE token = ?', array($token));
        $id = $existing ? $existing['id'] : Uuid::v4();
        $this->db->execute('INSERT INTO DeviceToken (id, citizenUserId, token, platform, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE citizenUserId = VALUES(citizenUserId), platform = VALUES(platform), isActive = 1, updatedAt = UTC_TIMESTAMP()', array($id, $request->principal['sub'], $token, $platform));
        return $this->db->fetchOne('SELECT * FROM DeviceToken WHERE id = ?', array($id));
    }

    private function deleteDevice(Request $request)
    {
        $statement = $this->db->execute('DELETE FROM DeviceToken WHERE id = ? AND citizenUserId = ?', array($request->params['id'], $request->principal['sub']));
        if ($statement->rowCount() === 0) {
            throw new ApiException(404, 'NOT_FOUND', 'ไม่พบอุปกรณ์');
        }
        return array('deleted' => true);
    }

    private function incidentList(Request $request, $citizen)
    {
        list($page, $limit, $offset) = $this->pagination($request->query);
        list($where, $params) = $this->incidentWhere($request, $citizen, false);
        $total = $this->db->fetchOne('SELECT COUNT(*) total FROM Incident' . $where, $params);
        $sortMap = array('reportedAt' => 'reportedAt', 'createdAt' => 'createdAt', 'updatedAt' => 'updatedAt', 'caseCode' => 'caseCode', 'priority' => 'priority', 'status' => 'status');
        $sort = isset($request->query['sortBy'], $sortMap[$request->query['sortBy']]) ? $sortMap[$request->query['sortBy']] : 'reportedAt';
        $direction = isset($request->query['sortOrder']) && strtolower($request->query['sortOrder']) === 'asc' ? 'ASC' : 'DESC';
        $rows = $this->db->fetchAll('SELECT * FROM Incident' . $where . ' ORDER BY ' . $sort . ' ' . $direction . ' LIMIT ' . $limit . ' OFFSET ' . $offset, $params);
        return $this->page($this->hydrateIncidentList($rows, $citizen ? 'citizen' : 'admin'), $page, $limit, (int) $total['total']);
    }

    private function incidentWhere(Request $request, $citizen, $dashboard)
    {
        $where = array();
        $params = array();
        if ($citizen) {
            $where[] = 'citizenUserId = ?';
            $params[] = $request->principal['sub'];
        } elseif (!$dashboard && $request->principal['role'] === 'OFFICER') {
            $where[] = 'assignedAdminUserId = ?';
            $params[] = $request->principal['sub'];
        } elseif (!$dashboard && isset($request->query['assignedAdminUserId']) && $request->query['assignedAdminUserId'] !== '') {
            $where[] = 'assignedAdminUserId = ?';
            $params[] = $request->query['assignedAdminUserId'];
        }
        foreach (array('status' => array('RECEIVED','FORWARDED','INSPECTING','IN_PROGRESS','COMPLETED','CANCELLED','REJECTED'), 'type' => array('AIRCRAFT_ACCIDENT','DISASTER_RELIEF'), 'priority' => array('LOW','NORMAL','HIGH','CRITICAL')) as $key => $allowed) {
            if (isset($request->query[$key]) && $request->query[$key] !== '') {
                if (!in_array($request->query[$key], $allowed, true)) {
                    throw new ApiException(400, 'VALIDATION_ERROR', 'ตัวกรองไม่ถูกต้อง');
                }
                $where[] = $key . ' = ?';
                $params[] = $request->query[$key];
            }
        }
        if (isset($request->query['province']) && trim($request->query['province']) !== '') {
            $where[] = 'province = ?';
            $params[] = trim($request->query['province']);
        }
        if (isset($request->query['dateFrom']) && $request->query['dateFrom'] !== '') {
            $where[] = 'reportedAt >= ?';
            $params[] = $request->query['dateFrom'];
        }
        if (isset($request->query['dateTo']) && $request->query['dateTo'] !== '') {
            $where[] = 'reportedAt <= ?';
            $params[] = $request->query['dateTo'];
        }
        if (isset($request->query['keyword']) && trim($request->query['keyword']) !== '') {
            $like = '%' . trim($request->query['keyword']) . '%';
            $where[] = '(caseCode LIKE ? OR reporterName LIKE ? OR reporterPhone LIKE ? OR description LIKE ? OR address LIKE ? OR province LIKE ?)';
            for ($i = 0; $i < 6; $i++) {
                $params[] = $like;
            }
        }
        if ($dashboard) {
            list($dateSql, $dateParams) = $this->dashboardDateWhere($request->query);
            if ($dateSql) {
                $where[] = substr($dateSql, 7);
                $params = array_merge($params, $dateParams);
            }
        }
        return array($where ? ' WHERE ' . implode(' AND ', $where) : '', $params);
    }

    private function incidentDetail($id, $mode, $citizenId = null, array $principal = null)
    {
        $params = array($id);
        $where = 'id = ?';
        if ($mode === 'citizen') {
            $where .= ' AND citizenUserId = ?';
            $params[] = $citizenId;
        }
        $incident = $this->db->fetchOne('SELECT * FROM Incident WHERE ' . $where, $params);
        if (!$incident) {
            throw new ApiException(404, 'INCIDENT_NOT_FOUND', 'ไม่พบข้อมูลเหตุการณ์');
        }
        if ($mode === 'admin' && $principal) {
            $this->assertOfficerIncident($incident, $principal);
        }
        $incident['images'] = $this->db->fetchAll('SELECT * FROM IncidentImage WHERE incidentId = ? ORDER BY createdAt ASC', array($id));
        $history = $this->db->fetchAll('SELECT h.*, a.id changedAdminId, a.fullName changedAdminName FROM IncidentStatusHistory h LEFT JOIN AdminUser a ON a.id = h.changedByAdminUserId WHERE h.incidentId = ? ORDER BY h.changedAt ASC', array($id));
        foreach ($history as &$item) {
            $item['changedByAdminUser'] = $item['changedAdminId'] ? array('id' => $item['changedAdminId'], 'fullName' => $item['changedAdminName']) : null;
            unset($item['changedAdminId'], $item['changedAdminName']);
        }
        $incident['statusHistory'] = $history;
        $incident['assignedAdminUser'] = $incident['assignedAdminUserId'] ? $this->db->fetchOne('SELECT id, fullName, role, status FROM AdminUser WHERE id = ?', array($incident['assignedAdminUserId'])) : null;
        $noteWhere = $mode === 'citizen' ? ' AND n.isVisibleToCitizen = 1' : '';
        $notes = $this->db->fetchAll('SELECT n.*, a.id adminId, a.fullName adminName FROM IncidentNote n LEFT JOIN AdminUser a ON a.id = n.adminUserId WHERE n.incidentId = ?' . $noteWhere . ' ORDER BY n.createdAt ' . ($mode === 'citizen' ? 'ASC' : 'DESC'), array($id));
        foreach ($notes as &$note) {
            $note['isVisibleToCitizen'] = (bool) $note['isVisibleToCitizen'];
            if ($mode === 'admin') {
                $note['adminUser'] = array('id' => $note['adminId'], 'fullName' => $note['adminName']);
            }
            unset($note['adminId'], $note['adminName']);
        }
        $incident['notes'] = $notes;
        if ($mode === 'admin') {
            $incident['citizenUser'] = $this->db->fetchOne('SELECT id, fullName, email, phone, profileImageUrl FROM CitizenUser WHERE id = ?', array($incident['citizenUserId']));
            $assignments = $this->db->fetchAll('SELECT x.*, t.fullName assignedToName, b.fullName assignedByName FROM IncidentAssignment x JOIN AdminUser t ON t.id = x.assignedToAdminUserId JOIN AdminUser b ON b.id = x.assignedByAdminUserId WHERE x.incidentId = ? ORDER BY x.assignedAt DESC', array($id));
            foreach ($assignments as &$assignment) {
                $assignment['assignedToAdminUser'] = array('id' => $assignment['assignedToAdminUserId'], 'fullName' => $assignment['assignedToName']);
                $assignment['assignedByAdminUser'] = array('id' => $assignment['assignedByAdminUserId'], 'fullName' => $assignment['assignedByName']);
                unset($assignment['assignedToName'], $assignment['assignedByName']);
            }
            $incident['assignments'] = $assignments;
        }
        return $incident;
    }

    private function hydrateIncidentList(array $rows, $mode)
    {
        foreach ($rows as &$row) {
            $row['images'] = $this->db->fetchAll('SELECT * FROM IncidentImage WHERE incidentId = ? ORDER BY createdAt ASC', array($row['id']));
            $row['assignedAdminUser'] = $row['assignedAdminUserId'] ? $this->db->fetchOne('SELECT id, fullName, role, status FROM AdminUser WHERE id = ?', array($row['assignedAdminUserId'])) : null;
            if ($mode === 'admin') {
                $row['statusHistory'] = $this->db->fetchAll('SELECT id, fromStatus, toStatus, note, changedByAdminUserId, changedAt FROM IncidentStatusHistory WHERE incidentId = ? ORDER BY changedAt ASC', array($row['id']));
            }
        }
        return $rows;
    }

    private function queueWorkflow(Database $db, $citizenId, $incidentId)
    {
        $this->firebase->queue($db, 'channels/users/citizen:' . $citizenId, 'incident.status.changed', $incidentId);
        $this->firebase->queue($db, 'channels/admin', 'incident.updated', $incidentId);
    }

    private function queueUserEvent(Request $request, $type, $entityId)
    {
        $channel = 'channels/users/' . $request->principal['kind'] . ':' . $request->principal['sub'];
        $this->db->transaction(function (Database $db) use ($channel, $type, $entityId) {
            $this->firebase->queue($db, $channel, $type, $entityId);
        });
        $this->publishBestEffort();
    }

    private function publishBestEffort()
    {
        try {
            $this->firebase->publishPending(20);
        } catch (\Exception $error) {
            error_log('Firebase publish deferred: ' . $error->getMessage());
        }
    }

    private function queueStatusPush(Database $db, $citizenId, $incidentId, $caseCode, $status)
    {
        $tokens = $db->fetchAll('SELECT token FROM DeviceToken WHERE citizenUserId = ? AND isActive = 1', array($citizenId));
        foreach ($tokens as $token) {
            $this->firebase->queueFcm($db, $token['token'], 'อัปเดตสถานะเหตุการณ์', $caseCode . ': ' . $status, array('incidentId' => $incidentId, 'status' => $status));
        }
    }

    private function audit(Database $db, $adminId, $action, $entityType, $entityId = null, $old = null, $new = null)
    {
        $db->execute('INSERT INTO AuditLog (id, adminUserId, action, entityType, entityId, oldValue, newValue, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())', array(Uuid::v4(), $adminId, $action, $entityType, $entityId, $old === null ? null : json_encode($old, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $new === null ? null : json_encode($new, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)));
    }

    private function adminUserRecord($id)
    {
        $row = $this->db->fetchOne('SELECT a.id, a.username, a.email, a.fullName, a.phone, a.role, a.positionId, a.status, a.lastLoginAt, a.createdAt, a.updatedAt, p.name positionName, p.createdAt positionCreatedAt, p.updatedAt positionUpdatedAt FROM AdminUser a LEFT JOIN StaffPosition p ON p.id = a.positionId WHERE a.id = ?', array($id));
        if (!$row) {
            throw new ApiException(404, 'USER_NOT_FOUND', 'ไม่พบบัญชีเจ้าหน้าที่');
        }
        return $this->mapAdminRow($row);
    }

    private function mapAdminRow(array $row)
    {
        $row['position'] = $row['positionId'] ? array('id' => $row['positionId'], 'name' => $row['positionName'], 'createdAt' => $row['positionCreatedAt'], 'updatedAt' => $row['positionUpdatedAt']) : null;
        unset($row['positionName'], $row['positionCreatedAt'], $row['positionUpdatedAt']);
        return $row;
    }

    private function assertPosition($id)
    {
        if (!$this->db->fetchOne('SELECT id FROM StaffPosition WHERE id = ?', array($id))) {
            throw new ApiException(400, 'VALIDATION_ERROR', 'ไม่พบตำแหน่งที่เลือก');
        }
    }

    private function assertManageableRole(array $principal, $role, $readOnly)
    {
        if ($principal['role'] === 'SUPERVISOR' && $role !== 'OFFICER' && !($readOnly && $role === 'VIEWER')) {
            throw new ApiException(403, 'PERMISSION_DENIED', 'หัวหน้าศูนย์จัดการได้เฉพาะบัญชีเจ้าหน้าที่');
        }
    }

    private function assertOfficerIncident(array $incident, array $principal)
    {
        if ($principal['role'] === 'OFFICER' && $incident['assignedAdminUserId'] !== $principal['sub']) {
            throw new ApiException(403, 'INCIDENT_ACCESS_DENIED', 'เหตุการณ์นี้ไม่ได้มอบหมายให้คุณ');
        }
    }

    private function notificationOwner(Request $request)
    {
        return $request->principal['kind'] === 'admin' ? array('adminUserId = ?', array($request->principal['sub'])) : array('citizenUserId = ?', array($request->principal['sub']));
    }

    private function dashboardDateWhere(array $query)
    {
        $where = array();
        $params = array();
        $from = isset($query['dateFrom']) && $query['dateFrom'] !== '' ? $query['dateFrom'] : null;
        $to = isset($query['dateTo']) && $query['dateTo'] !== '' ? $query['dateTo'] : null;
        if (($from && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)) || ($to && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $to))) {
            throw new ApiException(400, 'VALIDATION_ERROR', 'รูปแบบวันที่ไม่ถูกต้อง');
        }
        if ($from && $to && strcmp($from, $to) > 0) {
            throw new ApiException(400, 'INVALID_DASHBOARD_DATE_RANGE', 'วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด');
        }
        if ($from) {
            $where[] = 'reportedAt >= CONVERT_TZ(CONCAT(?, \' 00:00:00\'), \'+07:00\', \'+00:00\')';
            $params[] = $from;
        }
        if ($to) {
            $where[] = 'reportedAt < DATE_ADD(CONVERT_TZ(CONCAT(?, \' 00:00:00\'), \'+07:00\', \'+00:00\'), INTERVAL 1 DAY)';
            $params[] = $to;
        }
        return array($where ? ' WHERE ' . implode(' AND ', $where) : '', $params);
    }

    private function groupCount($column)
    {
        $rows = $this->db->fetchAll('SELECT ' . $column . ', COUNT(*) `_count` FROM Incident GROUP BY ' . $column);
        foreach ($rows as &$row) {
            $row['_count'] = (int) $row['_count'];
        }
        return $rows;
    }

    private function normalizeFiles($value)
    {
        if (!$value || !isset($value['name'])) {
            return array();
        }
        if (!is_array($value['name'])) {
            return array($value);
        }
        $files = array();
        foreach ($value['name'] as $index => $name) {
            $files[] = array('name' => $name, 'type' => $value['type'][$index], 'tmp_name' => $value['tmp_name'][$index], 'error' => $value['error'][$index], 'size' => $value['size'][$index]);
        }
        return $files;
    }

    private function requiredString(array $source, $key, $min, $max)
    {
        if (!isset($source[$key]) || !is_string($source[$key])) {
            throw new ApiException(400, 'VALIDATION_ERROR', 'กรุณาระบุ ' . $key);
        }
        $value = trim($source[$key]);
        if (strlen($value) < $min || strlen($value) > $max) {
            throw new ApiException(400, 'VALIDATION_ERROR', $key . ' มีความยาวไม่ถูกต้อง');
        }
        return $value;
    }

    private function optionalString(array $source, $key, $max)
    {
        if (!isset($source[$key]) || $source[$key] === '') {
            return null;
        }
        if (!is_string($source[$key]) || strlen($source[$key]) > $max) {
            throw new ApiException(400, 'VALIDATION_ERROR', $key . ' ไม่ถูกต้อง');
        }
        return trim($source[$key]);
    }

    private function enumValue(array $source, $key, array $allowed)
    {
        if (!isset($source[$key]) || !in_array($source[$key], $allowed, true)) {
            throw new ApiException(400, 'VALIDATION_ERROR', $key . ' ไม่ถูกต้อง');
        }
        return $source[$key];
    }

    private function coordinate(array $source, $key, $min, $max)
    {
        if (!isset($source[$key]) || !is_numeric($source[$key])) {
            throw new ApiException(400, 'VALIDATION_ERROR', $key . ' ไม่ถูกต้อง');
        }
        $value = (float) $source[$key];
        if ($value < $min || $value > $max) {
            throw new ApiException(400, 'VALIDATION_ERROR', $key . ' อยู่นอกช่วงที่อนุญาต');
        }
        return (string) $source[$key];
    }

    private function requiredUuid(array $source, $key)
    {
        $value = $this->requiredString($source, $key, 36, 36);
        if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $value)) {
            throw new ApiException(400, 'VALIDATION_ERROR', $key . ' ไม่ใช่ UUID');
        }
        return $value;
    }

    private function pagination(array $query)
    {
        $page = isset($query['page']) ? max(1, (int) $query['page']) : 1;
        $limit = isset($query['limit']) ? max(1, min(100, (int) $query['limit'])) : 20;
        return array($page, $limit, ($page - 1) * $limit);
    }

    private function page(array $items, $page, $limit, $total)
    {
        return array('items' => $items, 'pagination' => array('page' => $page, 'limit' => $limit, 'total' => $total, 'totalPages' => (int) ceil($total / $limit)));
    }

    private function booleans(array $row, array $fields)
    {
        foreach ($fields as $field) {
            if (isset($row[$field])) {
                $row[$field] = (bool) $row[$field];
            }
        }
        return $row;
    }
}
