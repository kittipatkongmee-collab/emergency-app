import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAndroidDevices,
  parseAndroidEmulatorIds,
  resolveMobileApiPort,
} from "./run-mobile-android.mjs";

test("เลือกเฉพาะอุปกรณ์ Android ที่ Flutter รองรับ", () => {
  const devices = parseAndroidDevices(
    JSON.stringify([
      { id: "windows", targetPlatform: "windows-x64", isSupported: true },
      {
        id: "emulator-5556",
        name: "Pixel 9",
        targetPlatform: "android-x64",
        isSupported: true,
        emulator: true,
      },
    ]),
  );
  assert.deepEqual(
    devices.map((device) => device.id),
    ["emulator-5556"],
  );
});

test("อ่านรหัส Android emulator จากผลลัพธ์ Flutter", () => {
  const output = `
2 available emulators:

Id        • Name      • Manufacturer • Platform
Pixel_9   • Pixel 9   • Google       • android
SATI_Test • SATI Test • Google       • android
`;
  assert.deepEqual(parseAndroidEmulatorIds(output), ["Pixel_9", "SATI_Test"]);
});

test("ใช้พอร์ต PHP API ที่ launcher กำหนดให้แอป Android", () => {
  assert.equal(resolveMobileApiPort({ MOBILE_API_PORT: "8085" }), 8085);
  assert.equal(resolveMobileApiPort({}), 3000);
  assert.throws(
    () => resolveMobileApiPort({ MOBILE_API_PORT: "invalid" }),
    /พอร์ต API สำหรับแอปไม่ถูกต้อง/,
  );
});
