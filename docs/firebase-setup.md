# Firebase RTDB and FCM setup

สร้าง Firebase project แยก development, staging และ production เปิด Authentication,
Realtime Database และ Cloud Messaging โดยไม่ใช้ Firebase เป็นฐานข้อมูลหลัก

project ที่เชื่อมอยู่ใน branch นี้คือ `sar-police-emc` โดยใช้ Realtime Database ที่
Singapore (`asia-southeast1`) และลงทะเบียน Backoffice, Android และ iOS แล้ว

## Backend

ตั้ง `FIREBASE_ENABLED=true`, project ID และ database URL ใน `.env` นอก `public_html`
แล้วกำหนด `FIREBASE_SERVICE_ACCOUNT_FILE` เป็น path ของ JSON key ที่อยู่นอก `public_html`
(หรือกำหนด client email/private key ผ่าน environment โดยตรง) PHP ออก Custom Token ผ่าน
`POST /api/v1/realtime/token` และใช้ service-account OAuth ส่ง RTDB/FCM ห้าม commit JSON key
หรือค่า private key

นำ Rules จาก `apps/api-php/firebase/database.rules.json` ขึ้นแต่ละ project Rules ปิด
client writes ทั้งหมด, admin อ่าน `/channels/admin` ได้ และผู้ใช้แต่ละรายอ่านได้
เฉพาะ `/channels/users/{kind}:{userId}` ของตน

## Clients

- Angular ตั้งค่า public Firebase web config ใน environment แล้วเปิด `enabled`
- Flutter วาง `google-services.json`/`GoogleService-Info.plist` ผ่าน secure build flow
  และ build ด้วย `FIREBASE_REALTIME_ENABLED=true`; ใช้ `FCM_ENABLED=true` เมื่อต้องการ push
- เมื่อ event, reconnect, focus หรือ app resume client ต้องโหลดข้อมูลจริงจาก API

ก่อน production ให้ทดสอบ Custom Token, Rules isolation, reconnect, outbox retry,
FCM foreground/background/terminated และการ rotate device token ใน staging project
