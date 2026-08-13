# Police Incident Mobile

โปรเจกต์ Flutter ใช้ FVM เพื่อแยก SDK ออกจาก Flutter หลักของเครื่อง โดยเวอร์ชันที่กำหนดไว้ใน `.fvmrc` ที่ root ของ repository

## ติดตั้ง SDK สำหรับโปรเจกต์

รันจาก root ของ repository:

```powershell
fvm install
fvm flutter --version
pnpm mobile:get
```

## รันบน Android emulator กับ PHP API

เปิด emulator ก่อน แล้วรันจาก root ของ repository:

```powershell
fvm flutter emulators --launch Pixel_4
cd apps/mobile
fvm flutter run `
  --dart-define=APP_ENV=development `
  --dart-define=API_BASE_URL=http://10.0.2.2:8085/api/v1 `
  --dart-define=DEV_AUTH_BYPASS=true `
  --dart-define=FIREBASE_REALTIME_ENABLED=true `
  --dart-define=FCM_ENABLED=true
```

Android emulator ใช้ `10.0.2.2` เพื่อเชื่อมต่อบริการที่รันบน `localhost` ของเครื่อง Windows

## ตรวจสอบคุณภาพ

```powershell
pnpm mobile:analyze
pnpm mobile:test
```
