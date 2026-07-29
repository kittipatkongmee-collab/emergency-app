import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';

type Envelope<T> = { success: true; data: T };

async function json<T>(response: Response): Promise<T> {
  const body = (await response.json()) as
    Envelope<T> | { success: false; error: { message: string } };
  if (!response.ok || !body.success) {
    throw new Error(
      'error' in body ? body.error.message : `HTTP ${response.status}`,
    );
  }
  return body.data;
}

async function main() {
  process.env.NODE_ENV = 'development';
  process.env.PORT = '3001';
  process.env.DATABASE_URL ??=
    'postgresql://police:local_development_only@127.0.0.1:5433/police_incidents?schema=public';
  process.env.DEV_AUTH_BYPASS = 'true';
  process.env.CORS_ORIGINS = 'http://localhost:4200';
  process.env.STORAGE_LOCAL_PATH = 'uploads';
  if (
    !process.env.JWT_ACCESS_SECRET ||
    !process.env.JWT_REFRESH_SECRET ||
    !process.env.ADMIN_SEED_PASSWORD
  ) {
    throw new Error(
      'JWT_ACCESS_SECRET, JWT_REFRESH_SECRET and ADMIN_SEED_PASSWORD are required for the smoke test',
    );
  }

  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(3001, '127.0.0.1');
  await app
    .get(AuthService)
    .citizenFacebook(`dev-preflight-${Date.now()}`, 'ผู้ทดสอบระบบ');

  const base = 'http://127.0.0.1:3001/api/v1';
  try {
    const citizenTokens = await json<{ accessToken: string }>(
      await fetch(`${base}/auth/facebook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accessToken: `dev-e2e-${Date.now()}`,
          fullName: 'ผู้ทดสอบระบบ',
        }),
      }),
    );
    const incident = await json<{ id: string; caseCode: string }>(
      await fetch(`${base}/incidents`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${citizenTokens.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          reporterName: 'ผู้ทดสอบระบบ',
          reporterPhone: '0812345678',
          type: 'OBSTRUCTION',
          description: 'ทดสอบเหตุสิ่งกีดขวางบนถนนจากระบบ end-to-end',
          latitude: '13.9126000',
          longitude: '100.6068000',
          address: 'ถนนวิภาวดีรังสิต เขตดอนเมือง กรุงเทพมหานคร',
          province: 'กรุงเทพมหานคร',
        }),
      }),
    );
    const form = new FormData();
    const image = await readFile(
      resolve(
        process.cwd(),
        '../../docs/ui-reference/17e7b542-8932-44d6-b8f8-f10efebc11a7.png',
      ),
    );
    form.append(
      'files',
      new Blob([image], { type: 'image/png' }),
      'evidence.png',
    );
    const uploads = await json<unknown[]>(
      await fetch(`${base}/incidents/${incident.id}/images`, {
        method: 'POST',
        headers: { authorization: `Bearer ${citizenTokens.accessToken}` },
        body: form,
      }),
    );
    const adminTokens = await json<{ accessToken: string }>(
      await fetch(`${base}/admin/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: process.env.ADMIN_SEED_PASSWORD,
        }),
      }),
    );
    const updated = await json<{ status: string }>(
      await fetch(`${base}/admin/incidents/${incident.id}/status`, {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${adminTokens.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          status: 'FORWARDED',
          note: 'มอบหมายศูนย์ประสานงานแล้ว',
        }),
      }),
    );
    const timeline = await json<{ statusHistory: unknown[] }>(
      await fetch(`${base}/incidents/${incident.id}`, {
        headers: { authorization: `Bearer ${citizenTokens.accessToken}` },
      }),
    );
    console.log({
      caseCode: incident.caseCode,
      uploadedImages: uploads.length,
      adminStatus: updated.status,
      timelineEntries: timeline.statusHistory.length,
    });
  } finally {
    await app.close();
  }
}

void main();
