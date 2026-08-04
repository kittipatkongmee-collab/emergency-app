import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const packageManager = "pnpm";
const children = new Set();
let shuttingDown = false;

export function selectWorkspaceApiTargets(processes) {
  const validProcesses = processes.filter(
    (process) => Number.isInteger(process.processId) && process.processId > 0,
  );
  const nestWatchers = validProcesses.filter((process) =>
    /[\\/]@nestjs[\\/]cli[\\/]bin[\\/]nest\.js\s+start/i.test(
      process.commandLine ?? "",
    ),
  );
  if (nestWatchers.length > 0) return nestWatchers;

  const processIds = new Set(
    validProcesses.map((process) => process.processId),
  );
  return validProcesses.filter(
    (process) => !processIds.has(process.parentProcessId),
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

function stopRunningWorkspaceApi() {
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

function stopRunningWorkspaceWeb() {
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
  stopRunningWorkspaceApi();
  stopRunningWorkspaceWeb();
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
