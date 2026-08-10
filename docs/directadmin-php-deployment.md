# DirectAdmin deployment: PHP 5.6

เป้าหมายคือ `sar.tpad.police.go.th` โดยไม่แก้ไฟล์หรือ rewrite หลักของเว็บไซต์เดิม
แพ็กเกจนี้ยังไม่มี secret และ phase นี้ไม่อัปโหลดขึ้น hosting จริง

## โครงสร้างไฟล์

```text
/home/sarpa/public_html/api/v1/       public front controller เท่านั้น
/home/sarpa/public_html/backoffice/   Angular static files
/home/sarpa/public_html/image_emer/   รูป public และ .htaccess ปิด script
/home/sarpa/private/police-api/       src, vendor, config, schema, cron
```

สร้าง ZIP ด้วย `pnpm build:directadmin` ผลลัพธ์อยู่ที่
`artifacts/police-incident-directadmin.zip` และไม่มี `.env` หรือ service-account key

## ขั้นตอนติดตั้ง

1. สำรองเว็บไซต์และฐานข้อมูลเดิม แล้วแตก ZIP ตาม path ข้างต้น ห้าม merge
   `.htaccess` เข้ากับ root ของ `public_html`
2. สร้างฐาน MariaDB ใหม่ใน DirectAdmin และ import
   `private/police-api/database/schema.sql` ฐานนี้ต้องว่างและห้ามใช้ฐานเดิม
3. สร้าง `private/police-api/.env` จาก `.env.example`; ตั้ง JWT secret แบบสุ่ม,
   DB credentials, allowed origin และ absolute `IMAGE_STORAGE_PATH`
4. เก็บ Firebase service-account JSON นอก `public_html` permissions `0600` และชี้ path ด้วย
   `FIREBASE_SERVICE_ACCOUNT_FILE`; ห้ามวาง key ในพื้นที่ public หรือ commit เข้า Git
5. รัน `php bin/check-requirements.php` และ `php bin/seed.php` จาก private directory
6. ตั้ง cron ทุกหนึ่งนาที: `php /home/sarpa/private/police-api/bin/cron.php`
7. เปิด `https://sar.tpad.police.go.th/api/v1/ready` และ
   `https://sar.tpad.police.go.th/backoffice/` แล้วทดสอบ login และ workflow
8. ลบไฟล์ ZIP/SQL ที่อัปโหลดชั่วคราว และตรวจว่า directory listing, PHP ใน
   `image_emer` และ development bypass ใช้งานไม่ได้

## สิทธิ์และ rollback

ตั้ง directory `0755`, source `0644`, `.env`/private key `0600` และให้ PHP เขียนได้
เฉพาะ `image_emer` เท่านั้น การ rollback ให้สลับชื่อ directory `api/v1` และ
`backoffice` กลับเป็นชุดก่อนหน้า โดยฐานข้อมูลใหม่แยกจากระบบเดิมอยู่แล้ว

รูปใน `image_emer` เป็น public URL ถาวร ผู้ที่ทราบ URL เปิดได้ จึงไม่ใช่พื้นที่เก็บ
เอกสารลับหรือข้อมูลที่ต้องตรวจสิทธิ์ก่อนอ่าน
