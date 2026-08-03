# Firebase / FCM setup

Backend มี `PushNotificationAdapter` และ Firebase implementation แล้ว หากไม่มี credentials ระบบยังบันทึก notification ใน MySQL และส่ง Socket.IO แต่จะไม่อ้างว่าส่ง push สำเร็จ

งานที่รอ credentials:

1. สร้าง Android/iOS apps ใน Firebase project
2. จัดเก็บ `google-services.json` และ `GoogleService-Info.plist` ตาม secure build workflow
3. ตั้ง `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` ใน secret manager
4. build Flutter ด้วย `--dart-define=FCM_ENABLED=true`
5. ทดสอบ permission, foreground/background/terminated delivery และ deep link ไป incident
6. ตรวจ token rotation และเรียก `/api/v1/devices/register`; logout/invalid token ต้องปิด device token

ห้าม commit service-account private key หรือไฟล์ credentials ลง Git
