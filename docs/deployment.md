# Deployment

## Production checklist

1. ใช้ managed MySQL 8 ที่ `utf8mb4`, `utf8mb4_unicode_ci`, UTC และเปิด TLS
2. ใช้ JWT/database/S3 secrets ที่สุ่มใหม่จาก secret manager
3. ตั้ง `NODE_ENV=production`, `DEV_AUTH_BYPASS=false` และ CORS เฉพาะ origin จริง
4. ใช้ S3-compatible durable storage เมื่อมี API มากกว่าหนึ่ง replica
5. build immutable API/Admin images
6. สำรองข้อมูล แล้วรัน `prisma migrate deploy` ก่อนสลับ traffic
7. expose เฉพาะ TLS reverse proxy; ไม่ expose MySQL
8. monitor `/api/v1/health`, `/api/v1/ready`, logs, DB pool, disk/object storage
9. ทดสอบ rollback, database restore และ secret rotation

## Docker production preview

```powershell
pnpm env:configure
pnpm start:docker
```

เปิด `http://localhost:8080` โดย Compose จะใช้ durable named volumes `mysql_data` และ `uploads` ข้อมูลยังอยู่เมื่อ restart container แต่ `docker compose down -v` จะลบ volume และข้อมูล

## Release workflow

Task branches merge เข้า `develop` ก่อน หลัง staging verification และได้รับคำสั่ง production release จึง merge `develop` เข้า `main` ห้ามรัน development reset script กับ production
