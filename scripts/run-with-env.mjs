import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

const envPath = resolve(process.cwd(), '.env');
if (!existsSync(envPath)) {
  throw new Error('ไม่พบไฟล์ .env กรุณารัน pnpm env:configure ก่อน');
}

Object.assign(process.env, parseEnv(readFileSync(envPath, 'utf8')));

const [command, ...args] = process.argv.slice(2);
if (!command) {
  throw new Error('ต้องระบุคำสั่งที่ต้องการรัน');
}

const globalPnpmCli = process.env.APPDATA
  ? resolve(process.env.APPDATA, 'npm/node_modules/pnpm/bin/pnpm.mjs')
  : undefined;
const pnpmCli =
  command === 'pnpm'
    ? process.env.npm_execpath ||
      (globalPnpmCli && existsSync(globalPnpmCli) ? globalPnpmCli : undefined)
    : undefined;
const executable = pnpmCli ? process.execPath : command;
const executableArgs = pnpmCli ? [pnpmCli, ...args] : args;

const child = spawn(executable, executableArgs, {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});

child.on('error', (error) => {
  console.error(`ไม่สามารถเริ่มคำสั่ง ${command}: ${error.message}`);
  process.exitCode = 1;
});
