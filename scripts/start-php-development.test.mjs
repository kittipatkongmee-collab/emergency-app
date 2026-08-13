import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { phpComposeArguments } from "./start-php-development.mjs";

test("สร้าง PHP API image ใหม่ก่อนเปิดเว็บและแอป", () => {
  assert.deepEqual(phpComposeArguments(), [
    "compose",
    "-f",
    "docker-compose.php.yml",
    "up",
    "-d",
    "--build",
    "--force-recreate",
    "api-php",
  ]);
});

test("ส่งการตั้งค่า LINE จากไฟล์ environment เข้า PHP API container", () => {
  const compose = readFileSync("docker-compose.php.yml", "utf8");
  assert.match(
    compose,
    /LINE_LOGIN_ENABLED:\s*"\$\{LINE_LOGIN_ENABLED:-false\}"/,
  );
  assert.match(compose, /LINE_CHANNEL_ID:\s*"\$\{LINE_CHANNEL_ID:-\}"/);
  assert.match(
    compose,
    /DEV_AUTH_BYPASS:\s*"\$\{DEV_AUTH_BYPASS:-false\}"/,
  );
});
