import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAndroidDevices,
  parseAndroidEmulatorIds,
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
