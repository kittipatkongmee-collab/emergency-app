# Map setup

Flutter ใช้ `DeviceLocationAdapter` เพื่อแยกการอ่าน GPS ออกจาก UI และบันทึกพิกัดแบบ Decimal 7 ตำแหน่ง ผู้ใช้แก้ที่อยู่/จุดสังเกตได้เอง หากยังไม่ตั้ง key จะแสดง development map placeholder โดยไม่สร้างข้อมูลตำแหน่งปลอมใหม่

งานที่รอ credentials:

1. สร้าง Google Maps keys แยก Android, iOS และ Web
2. จำกัด key ด้วย package name/SHA, bundle ID และ allowed domains
3. เปิดเฉพาะ Maps SDK และ Geocoding APIs ที่ใช้จริง
4. ใส่ key ผ่าน platform build configuration ไม่ฝังใน Dart
5. build Flutter ด้วย `--dart-define=MAPS_ENABLED=true`
6. เพิ่ม reverse-geocoding adapter เมื่อเลือกผู้ให้บริการแล้ว; หาก provider ล้มเหลวต้องยังกรอกที่อยู่เองได้

Angular ใช้ configurable OpenStreetMap embed URL ใน development การนำขึ้น production ต้องยืนยันผู้ให้บริการและเงื่อนไขใช้งานก่อน
