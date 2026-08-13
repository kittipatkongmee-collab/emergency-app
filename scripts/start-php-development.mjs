import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import {
  ensureDockerReady,
  stopRunningWorkspaceWeb,
} from "./start-development.mjs";

const children = new Set();
let shuttingDown = false;

export function phpComposeArguments() {
  return [
    "compose",
    "-f",
    "docker-compose.php.yml",
    "up",
    "-d",
    "--build",
    "--force-recreate",
    "api-php",
  ];
}

function run(command, args, options = {}) {
  const spawnOptions = {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    ...options,
  };
  return process.platform === "win32"
    ? spawn(
        process.env.ComSpec ?? "cmd.exe",
        ["/d", "/c", [command, ...args].join(" ")],
        spawnOptions,
      )
    : spawn(command, args, spawnOptions);
}

function runAndWait(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = run(command, args, options);
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} จบการทำงานด้วยรหัส ${code ?? 1}`,
        ),
      );
    });
  });
}

async function waitForPhpApiReady(timeoutMilliseconds = 60_000) {
  const timeoutAt = Date.now() + timeoutMilliseconds;
  while (Date.now() < timeoutAt) {
    try {
      const response = await fetch("http://localhost:8085/api/v1/ready", {
        signal: AbortSignal.timeout(3_000),
      });
      if (response.ok) return;
    } catch {
      // The container can take a few seconds to finish Apache startup.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000));
  }
  throw new Error("PHP API ยังไม่พร้อมใช้งานที่พอร์ต 8085 ภายใน 1 นาที");
}

function stopChild(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  child.kill("SIGTERM");
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) stopChild(child);
  process.exitCode = exitCode;
}

function startService(name, args, environment = process.env) {
  const child = run("pnpm", args, { env: environment });
  children.add(child);
  child.once("error", (error) => {
    console.error(`[${name}] เปิดไม่สำเร็จ:`, error.message);
    shutdown(1);
  });
  child.once("exit", (code) => {
    children.delete(child);
    if (!shuttingDown) {
      console.log(`\n[${name}] หยุดทำงานแล้ว กำลังปิดส่วนที่เหลือ...`);
      shutdown(code ?? 1);
    }
  });
}

export async function main() {
  await ensureDockerReady();
  stopRunningWorkspaceWeb();

  console.log("\n[เริ่มระบบ PHP] กำลังเตรียม dependency ของ API...");
  await runAndWait("composer", [
    "install",
    "--working-dir=apps/api-php",
    "--no-interaction",
    "--prefer-dist",
  ]);

  console.log("[เริ่มระบบ PHP] กำลัง build และเปิด PHP API กับ MariaDB...");
  await runAndWait("docker", phpComposeArguments());
  await waitForPhpApiReady();

  console.log(
    "[เริ่มระบบ PHP] API พร้อมแล้ว กำลังเปิดเว็บหลังบ้านและแอป Android...\n",
  );
  startService("เว็บหลังบ้าน", ["dev:web:open"]);
  startService("แอป Android", ["mobile:run:android"], {
    ...process.env,
    MOBILE_API_PORT: "8085",
  });
}

const isMainModule =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));
  main().catch((error) => {
    console.error(
      "\nไม่สามารถเปิดระบบ PHP ได้:",
      error instanceof Error ? error.message : error,
    );
    shutdown(1);
  });
}
