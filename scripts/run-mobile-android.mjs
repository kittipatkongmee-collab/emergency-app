import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const isWindows = process.platform === "win32";
const flutterCommand = "flutter";
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobileDirectory = join(workspaceRoot, "apps", "mobile");

function runFlutter(args, options = {}) {
  const spawnOptions = {
    cwd: workspaceRoot,
    encoding: "utf8",
    ...options,
  };
  return isWindows
    ? spawnSync(
        process.env.ComSpec ?? "cmd.exe",
        ["/d", "/c", [flutterCommand, ...args].join(" ")],
        spawnOptions,
      )
    : spawnSync(flutterCommand, args, spawnOptions);
}

function spawnFlutter(args) {
  const spawnOptions = { cwd: mobileDirectory, stdio: "inherit" };
  return isWindows
    ? spawn(
        process.env.ComSpec ?? "cmd.exe",
        ["/d", "/c", [flutterCommand, ...args].join(" ")],
        spawnOptions,
      )
    : spawn(flutterCommand, args, spawnOptions);
}

export function parseAndroidDevices(output) {
  try {
    const devices = JSON.parse(output);
    if (!Array.isArray(devices)) return [];
    return devices.filter(
      (device) =>
        typeof device?.id === "string" &&
        typeof device?.targetPlatform === "string" &&
        device.targetPlatform.startsWith("android") &&
        device.isSupported !== false,
    );
  } catch {
    return [];
  }
}

export function parseAndroidEmulatorIds(output) {
  return output
    .split(/\r?\n/)
    .map(
      (line) => line.match(/^\s*([A-Za-z0-9_.-]+)\s+•.*•\s+android\s*$/i)?.[1],
    )
    .filter((id) => typeof id === "string");
}

function findAdb() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA
      ? join(process.env.LOCALAPPDATA, "Android", "Sdk")
      : undefined,
  ];
  for (const sdkDirectory of candidates) {
    if (!sdkDirectory) continue;
    const adbPath = join(
      sdkDirectory,
      "platform-tools",
      isWindows ? "adb.exe" : "adb",
    );
    if (existsSync(adbPath)) return adbPath;
  }
  return null;
}

function getAndroidDevices() {
  const result = runFlutter(["devices", "--machine"]);
  if (result.error) throw result.error;
  return parseAndroidDevices(result.stdout ?? "");
}

function wait(milliseconds) {
  return new Promise((resolvePromise) =>
    setTimeout(resolvePromise, milliseconds),
  );
}

async function waitForAndroidDevice(timeoutMilliseconds = 120_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMilliseconds) {
    const devices = getAndroidDevices();
    if (devices.length) return devices[0];
    await wait(2_000);
  }
  throw new Error(
    "รออุปกรณ์ Android เกิน 2 นาที กรุณาเปิด emulator แล้วลองใหม่",
  );
}

async function resolveAndroidDevice() {
  const requestedDeviceId = process.env.MOBILE_DEVICE_ID?.trim();
  const connectedDevices = getAndroidDevices();
  if (requestedDeviceId) {
    const requestedDevice = connectedDevices.find(
      (device) => device.id === requestedDeviceId,
    );
    if (!requestedDevice) {
      throw new Error(`ไม่พบอุปกรณ์ Android ที่กำหนดไว้: ${requestedDeviceId}`);
    }
    return requestedDevice;
  }
  if (connectedDevices.length) return connectedDevices[0];

  const emulatorResult = runFlutter(["emulators"]);
  if (emulatorResult.error) throw emulatorResult.error;
  const emulatorIds = parseAndroidEmulatorIds(emulatorResult.stdout ?? "");
  const emulatorId = process.env.ANDROID_EMULATOR_ID?.trim() || emulatorIds[0];
  if (!emulatorId || !/^[A-Za-z0-9_.-]+$/.test(emulatorId)) {
    throw new Error(
      "ไม่พบ Android emulator กรุณาสร้าง emulator ใน Android Studio ก่อน",
    );
  }
  console.log(
    `[แอป Android] ไม่พบอุปกรณ์ที่เปิดอยู่ กำลังเปิด emulator: ${emulatorId}`,
  );
  const launchResult = runFlutter(["emulators", "--launch", emulatorId], {
    stdio: "inherit",
  });
  if (launchResult.status !== 0) {
    throw new Error(`ไม่สามารถเปิด emulator ${emulatorId} ได้`);
  }
  return waitForAndroidDevice();
}

function configureAdbReverse(deviceId) {
  const adbPath = findAdb();
  if (!adbPath) return false;
  const result = spawnSync(
    adbPath,
    ["-s", deviceId, "reverse", "tcp:3000", "tcp:3000"],
    {
      stdio: "ignore",
    },
  );
  return result.status === 0;
}

export async function main() {
  const device = await resolveAndroidDevice();
  if (!/^[A-Za-z0-9_.:-]+$/.test(device.id)) {
    throw new Error("รหัสอุปกรณ์ Android มีรูปแบบที่ไม่รองรับ");
  }
  const reversed = configureAdbReverse(device.id);
  const apiHost = reversed ? "127.0.0.1" : device.emulator ? "10.0.2.2" : null;
  if (!apiHost) {
    throw new Error(
      "เชื่อมต่อ API กับอุปกรณ์จริงไม่ได้ กรุณาตรวจสอบ adb หรือกำหนด MOBILE_DEVICE_ID ใหม่",
    );
  }
  console.log(`[แอป Android] กำลังเปิดบน ${device.name} (${device.id})`);
  const devAuthBypass = process.env.DEV_AUTH_BYPASS === "true";
  const lineLoginEnabled = process.env.LINE_LOGIN_ENABLED === "true";
  const lineChannelId = process.env.LINE_CHANNEL_ID?.trim() ?? "";
  const lineEmailScopeEnabled = process.env.LINE_EMAIL_SCOPE_ENABLED === "true";
  const mapsEnabled = Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());
  if (lineLoginEnabled && !/^\d+$/.test(lineChannelId)) {
    throw new Error(
      "เปิด LINE Login แล้ว แต่ LINE_CHANNEL_ID ไม่ถูกต้อง กรุณาตรวจไฟล์ .env",
    );
  }
  if (!mapsEnabled) {
    console.warn(
      "[แอป Android] ยังไม่ได้กำหนด GOOGLE_MAPS_API_KEY จะแสดงแผนที่จำลองแทน Google Maps",
    );
  }
  const child = spawnFlutter([
    "run",
    "-d",
    device.id,
    "--dart-define=APP_ENV=development",
    `--dart-define=DEV_AUTH_BYPASS=${devAuthBypass}`,
    `--dart-define=LINE_LOGIN_ENABLED=${lineLoginEnabled}`,
    `--dart-define=LINE_CHANNEL_ID=${lineChannelId}`,
    `--dart-define=LINE_EMAIL_SCOPE_ENABLED=${lineEmailScopeEnabled}`,
    `--dart-define=MAPS_ENABLED=${mapsEnabled}`,
    `--dart-define=API_BASE_URL=http://${apiHost}:3000/api/v1`,
    `--dart-define=SOCKET_URL=http://${apiHost}:3000`,
  ]);
  child.once("error", (error) => {
    console.error("[แอป Android] เปิด Flutter ไม่สำเร็จ:", error.message);
    process.exitCode = 1;
  });
  child.once("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}

const isMainModule =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((error) => {
    console.error(
      "[แอป Android]",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  });
}
