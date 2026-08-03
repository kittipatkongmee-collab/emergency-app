# Facebook integration pending

สถานะ: **BLOCKED: Waiting for Facebook credentials**

ระบบมี `CitizenAuthProvider` และ `FacebookAuthProvider` แล้ว Endpoint `/api/v1/auth/facebook` ตรวจ access token กับ Facebook Graph API และสร้าง/อัปเดต `CitizenUser` กับ `ExternalIdentity` เมื่อ credentials ถูกต้อง หากยังไม่เปิดใช้งานจะตอบ `FACEBOOK_LOGIN_NOT_CONFIGURED` และไม่ fallback เป็น development account

ก่อนเปิดใช้งาน:

1. สร้าง Facebook App และเปิด Facebook Login
2. กำหนด Android package name/key hash และ iOS bundle/URL scheme
3. ใส่ `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_GRAPH_API_VERSION`
4. ตั้ง `FACEBOOK_LOGIN_ENABLED=true` ใน backend
5. ส่ง `--dart-define=FACEBOOK_LOGIN_ENABLED=true` ตอน build Flutter
6. ทดสอบ token validation, account disabled, token หมดอายุ และ privacy/data deletion flow
7. จำกัด redirect URI และเก็บ secret ใน secret manager

ห้ามเปิด `DEV_AUTH_BYPASS` ใน production; environment validation จะปฏิเสธ startup หากฝ่าฝืน
