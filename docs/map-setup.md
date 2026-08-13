# Map setup

Flutter ใช้ `flutter_map` แสดงแผนที่ OpenStreetMap และใช้
`DeviceLocationAdapter` แยกการอ่าน GPS ออกจาก UI พิกัดถูกบันทึกเป็นทศนิยม
7 ตำแหน่งโดยไม่ต้องใช้ Google Maps API key

ค่า tile server กำหนดได้ตอน build ผ่าน `MAP_TILE_URL` และมีค่าเริ่มต้นเป็น:

```text
https://tile.openstreetmap.org/{z}/{x}/{y}.png
```

URL ต้องเป็น HTTPS และมี `{z}`, `{x}` และ `{y}` แอปส่ง package name เป็น
User-Agent และแสดง attribution ของ OpenStreetMap บนแผนที่ ห้ามเพิ่มการดาวน์โหลด
tile ล่วงหน้าหรือโหมด offline เมื่อใช้ tile server สาธารณะของ OpenStreetMap

หากปริมาณการใช้งาน production เพิ่มขึ้น ให้เปลี่ยน `MAP_TILE_URL` ไปยังผู้ให้บริการ
OSM tile ที่มี SLA หรือระบบที่หน่วยงานดูแลเอง โดยไม่ต้องแก้ source code

ระบบยังไม่ทำ reverse geocoding ผู้ใช้จึงตรวจสอบและแก้ไขที่อยู่หรือจุดสังเกตเองก่อนส่งเหตุ
