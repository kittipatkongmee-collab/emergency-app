import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const packageManager = "pnpm";
const children = new Set();
let shuttingDown = false;

export function findDockerDesktopExecutable(
  environment = process.env,
  fileExists = existsSync,
) {
  const candidates = [
    environment.ProgramFiles
      ? path.join(
          environment.ProgramFiles,
          "Docker",
          "Docker",
          "Docker Desktop.exe",
        )
      : undefined,
    environment.LOCALAPPDATA
      ? path.join(environment.LOCALAPPDATA, "Docker", "Docker Desktop.exe")
      : undefined,
  ].filter(Boolean);
  return candidates.find((candidate) => fileExists(candidate));
}

export function selectWorkspaceApiTargets(processes) {
  return processes.filter(
    (process) => Number.isInteger(process.processId) && process.processId > 0,
  );
}

export function selectWorkspaceWebTargets(processes) {
  return processes.filter(
    (process) =>
      Number.isInteger(process.processId) &&
      process.processId > 0 &&
      /[\\/]@angular[\\/]cli[\\/]bin[\\/]ng\.js["']?\s+serve/i.test(
        process.commandLine ?? "",
      ),
  );
}

function findRunningWorkspaceApiProcesses() {
  if (process.platform !== "win32") return [];
  const apiPath = path
    .resolve(process.cwd(), "apps", "api")
    .toLowerCase()
    .replaceAll("'", "''");
  const script = [
    `$apiPath = '${apiPath}'`,
    "$matches = @(Get-CimInstance Win32_Process | Where-Object {",
    "  $_.Name -eq 'node.exe' -and $_.CommandLine -and",
    "  $_.CommandLine.ToLowerInvariant().Contains($apiPath)",
    "} | Select-Object ProcessId, ParentProcessId, CommandLine)",
    "ConvertTo-Json -InputObject $matches -Compress",
  ].join("\n");
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0) {
    console.warn(
      "[เริ่มระบบ] ไม่สามารถตรวจโปรเซส API เดิมได้ จะดำเนินการต่อ...",
    );
    return [];
  }
  const output = result.stdout.trim();
  if (!output) return [];
  const parsed = JSON.parse(output);
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  return entries.map((entry) => ({
    processId: Number(entry.ProcessId),
    parentProcessId: Number(entry.ParentProcessId),
    commandLine: String(entry.CommandLine ?? ""),
  }));
}

function wait(milliseconds) {
  return new Promise((resolvePromise) =>
    setTimeout(resolvePromise, milliseconds),
  );
}

export function parseDockerDesktopStatus(output) {
  try {
    const parsed = JSON.parse(output);
    return typeof parsed.Status === "string"
      ? parsed.Status.toLowerCase()
      : undefined;
  } catch {
    return undefined;
  }
}

function getDockerDesktopStatus() {
  if (process.platform !== "win32") return undefined;
  const result = spawnSync(
    "docker",
    ["desktop", "status", "--format", "json"],
    {
      encoding: "utf8",
      windowsHide: true,
    },
  );
  if (result.status !== 0) return undefined;
  return parseDockerDesktopStatus(result.stdout);
}

function dockerEngineIsReady() {
  const desktopStatus = getDockerDesktopStatus();
  if (desktopStatus && desktopStatus !== "running") return false;
  const result = spawnSync(
    "docker",
    ["info", "--format", "{{.ServerVersion}}"],
    {
      encoding: "utf8",
      stdio: "ignore",
      windowsHide: true,
    },
  );
  return result.status === 0;
}

export async function ensureDockerReady() {
  if (dockerEngineIsReady()) return;
  if (process.platform !== "win32") {
    throw new Error(
      "ยังเชื่อมต่อ Docker ไม่ได้ กรุณาเปิด Docker daemon แล้วลองใหม่",
    );
  }

  const executable = findDockerDesktopExecutable();
  if (!executable) {
    throw new Error(
      "ไม่พบ Docker Desktop กรุณาติดตั้งหรือเปิด Docker Desktop แล้วลองใหม่",
    );
  }

  if (getDockerDesktopStatus() !== "starting") {
    console.log(
      "[เริ่มระบบ] Docker Desktop ยังไม่ทำงาน กำลังเปิดให้อัตโนมัติ...",
    );
    const dockerDesktop = spawn(executable, ["--minimized"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    dockerDesktop.unref();
  } else {
    console.log("[เริ่มระบบ] Docker Desktop กำลังเริ่มทำงาน รอสักครู่...");
  }

  const timeoutAt = Date.now() + 180_000;
  let nextProgressAt = Date.now() + 10_000;
  while (Date.now() < timeoutAt) {
    await wait(2_000);
    if (dockerEngineIsReady()) {
      console.log("[เริ่มระบบ] Docker Desktop พร้อมใช้งานแล้ว");
      return;
    }
    if (Date.now() >= nextProgressAt) {
      console.log("[เริ่มระบบ] กำลังรอ Docker Desktop เตรียมระบบ...");
      nextProgressAt = Date.now() + 10_000;
    }
  }

  throw new Error(
    "Docker Desktop ยังไม่พร้อมภายใน 3 นาที กรุณาตรวจสอบหน้าต่าง Docker Desktop แล้วลอง pnpm start อีกครั้ง",
  );
}

async function stopRunningWorkspaceApi() {
  const targets = selectWorkspaceApiTargets(findRunningWorkspaceApiProcesses());
  if (targets.length === 0) return;
  console.log(
    "[เริ่มระบบ] พบ API เดิมของโปรเจกต์ กำลังปิดก่อนเริ่มระบบใหม่...",
  );
  for (const target of targets) {
    spawnSync("taskkill", ["/pid", String(target.processId), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  }

  const timeoutAt = Date.now() + 10_000;
  while (Date.now() < timeoutAt) {
    if (findRunningWorkspaceApiProcesses().length === 0) return;
    await wait(200);
  }
  throw new Error(
    "ปิด API เดิมไม่สำเร็จ กรุณาปิดหน้าต่างที่กำลังรัน API แล้วลองใหม่",
  );
}

function findRunningWorkspaceWebProcesses() {
  if (process.platform !== "win32") return [];
  const webPath = path
    .resolve(process.cwd(), "apps", "admin-web")
    .toLowerCase()
    .replaceAll("'", "''");
  const script = [
    `$webPath = '${webPath}'`,
    "$matches = @(Get-CimInstance Win32_Process | Where-Object {",
    "  $_.Name -eq 'node.exe' -and $_.CommandLine -and",
    "  $_.CommandLine.ToLowerInvariant().Contains($webPath)",
    "} | Select-Object ProcessId, ParentProcessId, CommandLine)",
    "ConvertTo-Json -InputObject $matches -Compress",
  ].join("\n");
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0) {
    console.warn(
      "[เริ่มระบบ] ไม่สามารถตรวจโปรเซสเว็บเดิมได้ จะดำเนินการต่อ...",
    );
    return [];
  }
  const output = result.stdout.trim();
  if (!output) return [];
  const parsed = JSON.parse(output);
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  return entries.map((entry) => ({
    processId: Number(entry.ProcessId),
    parentProcessId: Number(entry.ParentProcessId),
    commandLine: String(entry.CommandLine ?? ""),
  }));
}

export function stopRunningWorkspaceWeb() {
  const targets = selectWorkspaceWebTargets(findRunningWorkspaceWebProcesses());
  if (targets.length === 0) return;
  console.log(
    "[เริ่มระบบ] พบเว็บหลังบ้านเดิมของโปรเจกต์ กำลังปิดก่อนเริ่มระบบใหม่...",
  );
  for (const target of targets) {
    spawnSync("taskkill", ["/pid", String(target.processId), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  }
}

function run(command, args, options = {}) {
  const spawnOptions = {
    cwd: process.cwd(),
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

function runAndWait(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = run(command, args);
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolvePromise();
      else
        reject(
          new Error(
            `${command} ${args.join(" ")} จบการทำงานด้วยรหัส ${code ?? 1}`,
          ),
        );
    });
  });
}

function stopChild(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  } else {
    child.kill("SIGTERM");
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) stopChild(child);
  process.exitCode = exitCode;
}

async function main() {
  await stopRunningWorkspaceApi();
  stopRunningWorkspaceWeb();
  await ensureDockerReady();
  console.log("\n[เริ่มระบบ] กำลังเปิดฐานข้อมูล MySQL...");
  await runAndWait(packageManager, ["db:start"]);
  console.log("[เริ่มระบบ] กำลังตรวจและอัปเดตโครงสร้างฐานข้อมูล...");
  await runAndWait(packageManager, ["db:migrate:deploy"]);
  console.log("[เริ่มระบบ] กำลังสร้าง Prisma client...");
  await runAndWait(packageManager, ["db:generate"]);
  console.log("[เริ่มระบบ] กำลังเปิด API, เว็บหลังบ้าน และแอป Android...\n");

  const services = [
    ["API", ["dev:api"]],
    ["เว็บหลังบ้าน", ["dev:web:open"]],
    ["แอป Android", ["mobile:run:android"]],
  ];
  for (const [name, args] of services) {
    const child = run(packageManager, args);
    children.add(child);
    child.once("error", (error) => {
      console.error(`[${name}] เปิดไม่สำเร็จ:`, error.message);
      shutdown(1);
    });
    child.once("exit", (code) => {
      children.delete(child);
      if (!shuttingDown) {
        console.log(`\n[${name}] หยุดทำงานแล้ว กำลังปิดบริการที่เหลือ...`);
        shutdown(code ?? 1);
      }
    });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));

  main().catch((error) => {
    console.error(
      "\nไม่สามารถเปิดระบบได้:",
      error instanceof Error ? error.message : error,
    );
    shutdown(1);
  });
}
