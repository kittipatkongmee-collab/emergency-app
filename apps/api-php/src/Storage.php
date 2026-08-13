<?php

namespace Police\Api;

final class ImageStorage
{
    const IMAGE_TYPE_WEBP = 18;

    private $db;
    private $config;

    public function __construct(Database $db, Config $config)
    {
        $this->db = $db;
        $this->config = $config;
    }

    public function save(array $file)
    {
        if (!isset($file['error']) || $file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
            throw new ApiException(400, 'INVALID_UPLOAD', 'อัปโหลดรูปภาพไม่สำเร็จ');
        }
        return $this->saveFromPath($file['tmp_name'], $file['name'], (int) $file['size']);
    }

    public function saveEncoded($fileName, $contentBase64)
    {
        if (!is_string($fileName) || $fileName === '' || strlen($fileName) > 255 || !is_string($contentBase64) || $contentBase64 === '' || strlen($contentBase64) > 14 * 1024 * 1024) {
            throw new ApiException(400, 'INVALID_UPLOAD', 'ข้อมูลรูปภาพไม่ถูกต้อง');
        }
        $binary = base64_decode($contentBase64, true);
        if ($binary === false) {
            throw new ApiException(400, 'INVALID_UPLOAD', 'ข้อมูลรูปภาพไม่ถูกต้อง');
        }
        $temporary = tempnam(sys_get_temp_dir(), 'incident-image-');
        if ($temporary === false || file_put_contents($temporary, $binary, LOCK_EX) !== strlen($binary)) {
            if ($temporary !== false && is_file($temporary)) {
                @unlink($temporary);
            }
            throw new ApiException(500, 'STORAGE_WRITE_FAILED', 'ไม่สามารถเตรียมรูปภาพเพื่อบันทึกได้');
        }
        unset($binary);
        try {
            return $this->saveFromPath($temporary, $fileName, filesize($temporary));
        } finally {
            @unlink($temporary);
        }
    }

    private function saveFromPath($source, $originalName, $size)
    {
        if ((int) $size <= 0 || (int) $size > 10 * 1024 * 1024) {
            throw new ApiException(400, 'FILE_TOO_LARGE', 'รูปภาพต้องมีขนาดไม่เกิน 10 MB');
        }
        $info = @getimagesize($source);
        $allowed = array(IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', self::IMAGE_TYPE_WEBP => 'webp');
        if (!$info || !isset($allowed[$info[2]])) {
            throw new ApiException(400, 'INVALID_FILE_TYPE', 'รองรับเฉพาะ JPG, PNG และ WEBP');
        }
        $extension = strtolower(pathinfo((string) $originalName, PATHINFO_EXTENSION));
        $validExtensions = $info[2] === IMAGETYPE_JPEG ? array('jpg', 'jpeg') : array($allowed[$info[2]]);
        if (!in_array($extension, $validExtensions, true)) {
            throw new ApiException(400, 'FILE_EXTENSION_MISMATCH', 'นามสกุลไฟล์ไม่ตรงกับข้อมูลรูปภาพ');
        }
        if (isset($info['mime']) && strpos($info['mime'], 'image/') !== 0) {
            throw new ApiException(400, 'INVALID_FILE_TYPE', 'ชนิดไฟล์รูปภาพไม่ถูกต้อง');
        }
        $this->assertCapacity((int) $size);
        $year = gmdate('Y');
        $month = gmdate('m');
        $relative = $year . '/' . $month;
        $root = rtrim($this->config->get('IMAGE_STORAGE_PATH'), '/\\');
        $directory = $root . DIRECTORY_SEPARATOR . $year . DIRECTORY_SEPARATOR . $month;
        if (!is_dir($directory) && !mkdir($directory, 0755, true)) {
            throw new ApiException(500, 'STORAGE_UNAVAILABLE', 'ไม่สามารถสร้างพื้นที่เก็บรูปภาพได้');
        }
        $id = Uuid::v4();
        $extension = $allowed[$info[2]];
        $name = $id . '.' . $extension;
        $target = $directory . DIRECTORY_SEPARATOR . $name;
        if (!$this->normalize($source, $target, $info[2], $info[0], $info[1])) {
            throw new ApiException(500, 'STORAGE_WRITE_FAILED', 'ไม่สามารถบันทึกรูปภาพได้');
        }
        chmod($target, 0644);
        return array(
            'id' => $id,
            'fileName' => $name,
            'originalName' => substr(basename((string) $originalName), 0, 255),
            'mimeType' => $extension === 'jpg' ? 'image/jpeg' : 'image/' . $extension,
            'fileSize' => filesize($target),
            'storageDriver' => 'directadmin-public',
            'storageKey' => $relative . '/' . $name,
            'imageUrl' => rtrim($this->config->get('IMAGE_PUBLIC_URL', '/image_emer'), '/') . '/' . $relative . '/' . $name,
        );
    }

    public function remove($storageKey)
    {
        if (!preg_match('#^\d{4}/\d{2}/[0-9a-f-]{36}\.(jpg|png|webp)$#', $storageKey)) {
            return false;
        }
        $path = rtrim($this->config->get('IMAGE_STORAGE_PATH'), '/\\') . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $storageKey);
        if (!is_file($path)) {
            return true;
        }
        return @unlink($path);
    }

    private function normalize($source, $target, $type, $width, $height)
    {
        if (!extension_loaded('gd')) {
            return false;
        }
        if ($type === IMAGETYPE_JPEG) {
            $image = @imagecreatefromjpeg($source);
        } elseif ($type === IMAGETYPE_PNG) {
            $image = @imagecreatefrompng($source);
        } else {
            $image = function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($source) : null;
        }
        if (!$image) {
            return false;
        }
        $scale = min(1, 2048 / max($width, $height));
        $newWidth = max(1, (int) round($width * $scale));
        $newHeight = max(1, (int) round($height * $scale));
        $canvas = imagecreatetruecolor($newWidth, $newHeight);
        if ($type === IMAGETYPE_PNG || $type === self::IMAGE_TYPE_WEBP) {
            imagealphablending($canvas, false);
            imagesavealpha($canvas, true);
        }
        imagecopyresampled($canvas, $image, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
        if ($type === IMAGETYPE_JPEG) {
            $saved = imagejpeg($canvas, $target, 85);
        } elseif ($type === IMAGETYPE_PNG) {
            $saved = imagepng($canvas, $target, 7);
        } else {
            $saved = function_exists('imagewebp') ? imagewebp($canvas, $target, 82) : false;
        }
        imagedestroy($canvas);
        imagedestroy($image);
        return $saved;
    }

    private function assertCapacity($incoming)
    {
        $quota = $this->config->int('IMAGE_STORAGE_QUOTA_BYTES', 4294967296);
        $stop = $this->config->int('IMAGE_STORAGE_STOP_PERCENT', 95);
        $row = $this->db->fetchOne('SELECT COALESCE(SUM(fileSize), 0) AS usedBytes FROM IncidentImage');
        $projected = (int) $row['usedBytes'] + $incoming;
        $warning = $this->config->int('IMAGE_STORAGE_WARN_PERCENT', 80);
        if ($projected >= ($quota * $warning / 100)) {
            error_log('Image storage usage reached at least ' . $warning . ' percent');
        }
        if ($projected >= ($quota * $stop / 100)) {
            throw new ApiException(507, 'STORAGE_CAPACITY_LOW', 'พื้นที่จัดเก็บรูปภาพใกล้เต็ม กรุณาติดต่อผู้ดูแลระบบ');
        }
    }
}
