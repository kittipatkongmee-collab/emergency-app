# การตั้งค่า LINE Login สำหรับแอป

ระบบใช้ LINE SDK ใน Flutter และส่ง ID token พร้อม nonce ไปให้ API ตรวจสอบกับ LINE โดยตรงก่อนสร้างหรืออัปเดตบัญชีประชาชน ชื่อ รูปโปรไฟล์ และอีเมลที่ผู้ใช้อนุญาตจะถูกบันทึกในบัญชี ส่วนหมายเลขโทรศัพท์ไม่ได้อยู่ในข้อมูลของ LINE Login และระบบจะไม่ขอในขั้นตอนนี้

## 1. สร้าง LINE Login channel

1. เข้า [LINE Developers Console](https://developers.line.biz/console/) และสร้าง Provider ของหน่วยงาน
2. สร้าง channel ประเภท **LINE Login**
3. ในแท็บ **LINE Login > App settings** เปิด **Mobile app**
4. กำหนด Android package name เป็น `th.go.police.tpad.police_incident_mobile`
5. เพิ่ม Android package signature ของ debug/release certificate ที่ใช้จริง
6. เปิดสิทธิ์ `profile` และ `openid` สำหรับการเข้าสู่ระบบ
7. หากต้องการอีเมล ให้ยื่นขอสิทธิ์อีเมลกับ LINE ก่อน แล้วจึงเปิด `LINE_EMAIL_SCOPE_ENABLED`

หา SHA-1 ของ debug certificate บน Windows ได้ด้วยคำสั่งด้านล่าง หาก `keytool` ไม่ได้อยู่ใน `PATH` ให้เรียกจาก Android Studio โดยตรง:

```powershell
& "$env:ProgramFiles\Android\Android Studio\jbr\bin\keytool.exe" `
  -list -v `
  -alias androiddebugkey `
  -keystore "$env:USERPROFILE\.android\debug.keystore" `
  -storepass android `
  -keypass android
```

เมื่อนำขึ้น Google Play ให้เพิ่ม SHA-1 จาก **Play Console > Setup > App signing** ด้วย

## 2. ตั้งค่า environment

แก้ไฟล์ `.env` ที่ root ของโปรเจกต์:

```dotenv
DEV_AUTH_BYPASS=false
LINE_LOGIN_ENABLED=true
LINE_CHANNEL_ID=ใส่_channel_id_จาก_LINE_Developers_Console
LINE_EMAIL_SCOPE_ENABLED=false
```

`LINE_CHANNEL_ID` เป็นข้อมูลสาธารณะที่แอปจำเป็นต้องใช้ แต่ห้ามนำ Channel secret หรือข้อมูลลับอื่นใส่ใน Flutter หรือ commit ลง Git

## 3. Build PHP API และรันระบบ

```powershell
pnpm start
```

คำสั่ง `pnpm start` จะ build PHP API container ใหม่ เปิด MariaDB, เว็บหลังบ้าน และแอป Android พร้อมส่ง `LINE_LOGIN_ENABLED` และ `LINE_CHANNEL_ID` จาก `.env` เข้า Flutter และ PHP API โดยไม่ฝัง Channel ID ลงในซอร์สโค้ด

## 4. ตรวจสอบผล

1. ลบ token เดิมหรือกดออกจากระบบ
2. เปิดแอปและกด **เชื่อมต่อและเข้าสู่ระบบด้วย LINE**
3. ยินยอมสิทธิ์ใน LINE
4. ตรวจว่าหน้าแรกและหน้าโปรไฟล์แสดงชื่อกับรูป LINE
5. ปิดหรือระงับ LINE Login channel ชั่วคราวเพื่อตรวจว่าระบบปฏิเสธการเข้าสู่ระบบอย่างปลอดภัย

สำหรับ production ต้องใช้ package name และลายเซ็น release จริง ปิด `DEV_AUTH_BYPASS` และเผยแพร่ Privacy Policy/Terms ที่ผ่านการอนุมัติของหน่วยงานก่อนเปิดให้ประชาชนใช้
