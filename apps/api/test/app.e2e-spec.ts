import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Response } from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

type TokenResponse = { accessToken: string; refreshToken: string };
type Envelope<T> = { success: true; data: T };

function data<T>(response: Response): T {
  return (JSON.parse(response.text) as unknown as Envelope<T>).data;
}

describe('Police incident workflow (e2e)', () => {
  let app: INestApplication<App>;
  let citizen: TokenResponse;
  let otherCitizen: TokenResponse;
  let admin: TokenResponse;
  let viewer: TokenResponse;
  let adminUserId: string;
  let incidentId: string;
  let caseCode: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  it('logs in development citizens and seeded admins', async () => {
    citizen = data<TokenResponse>(
      await request(app.getHttpServer())
        .post('/api/v1/auth/development-login')
        .send({ profileId: 'test1' })
        .expect(201),
    );
    otherCitizen = data<TokenResponse>(
      await request(app.getHttpServer())
        .post('/api/v1/auth/development-login')
        .send({ profileId: 'test2' })
        .expect(201),
    );
    admin = data<TokenResponse>(
      await request(app.getHttpServer())
        .post('/api/v1/admin/auth/login')
        .send({
          username: process.env.ADMIN_SEED_USERNAME ?? 'admin',
          password: process.env.ADMIN_SEED_PASSWORD,
        })
        .expect(201),
    );
    viewer = data<TokenResponse>(
      await request(app.getHttpServer())
        .post('/api/v1/admin/auth/login')
        .send({
          username: 'viewer1',
          password: process.env.ADMIN_SEED_PASSWORD,
        })
        .expect(201),
    );
    adminUserId = data<{ id: string }>(
      await request(app.getHttpServer())
        .get('/api/v1/admin/auth/me')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200),
    ).id;
    expect(citizen.accessToken).toBeTruthy();
    expect(admin.refreshToken).toBeTruthy();
  });

  it('creates an idempotent incident and stores image metadata', async () => {
    const payload = {
      reporterName: 'ประชาชนทดสอบ 1',
      reporterPhone: '0812345678',
      type: 'DISASTER_RELIEF',
      description: 'พบกลุ่มควันและเปลวไฟบริเวณอาคารเก็บอุปกรณ์',
      latitude: '13.9126000',
      longitude: '100.6068000',
      address: 'ถนนวิภาวดีรังสิต เขตดอนเมือง กรุงเทพมหานคร',
      province: 'กรุงเทพมหานคร',
      priority: 'HIGH',
    };
    await request(app.getHttpServer())
      .post('/api/v1/incidents')
      .set('Authorization', `Bearer ${citizen.accessToken}`)
      .send({ ...payload, type: 'FIRE' })
      .expect(400);
    const first = await request(app.getHttpServer())
      .post('/api/v1/incidents')
      .set('Authorization', `Bearer ${citizen.accessToken}`)
      .set('Idempotency-Key', 'e2e-create-incident')
      .send(payload)
      .expect(201);
    const repeated = await request(app.getHttpServer())
      .post('/api/v1/incidents')
      .set('Authorization', `Bearer ${citizen.accessToken}`)
      .set('Idempotency-Key', 'e2e-create-incident')
      .send(payload)
      .expect(201);
    const created = data<{ id: string; caseCode: string }>(first);
    incidentId = created.id;
    caseCode = created.caseCode;
    expect(data<{ id: string }>(repeated).id).toBe(incidentId);
    expect(caseCode).toMatch(/^CASE-\d{4}-\d{5}$/);

    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);
    const upload = await request(app.getHttpServer())
      .post(`/api/v1/incidents/${incidentId}/images`)
      .set('Authorization', `Bearer ${citizen.accessToken}`)
      .attach('files', png, {
        filename: 'evidence.png',
        contentType: 'image/png',
      })
      .expect(201);
    const images = data<Array<{ storageKey: string }>>(upload);
    expect(images).toHaveLength(1);
    expect(images[0].storageKey).toMatch(/\.png$/);
  });

  it('enforces citizen ownership', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/incidents/${incidentId}`)
      .set('Authorization', `Bearer ${otherCitizen.accessToken}`)
      .expect(404);
  });

  it('accepts and completes the incident as the responsible admin', async () => {
    const acceptedResponse = await request(app.getHttpServer())
      .patch(`/api/v1/admin/incidents/${incidentId}/accept`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({})
      .expect(200);
    const accepted = data<{
      status: string;
      assignedAdminUser: { id: string };
    }>(acceptedResponse);
    expect(accepted.status).toBe('IN_PROGRESS');
    expect(accepted.assignedAdminUser.id).toBe(adminUserId);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/incidents/${incidentId}/accept`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/incidents/${incidentId}/complete`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({})
      .expect(200);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/incidents/${incidentId}`)
      .set('Authorization', `Bearer ${citizen.accessToken}`)
      .expect(200);
    const incident = data<{
      status: string;
      statusHistory: unknown[];
      images: unknown[];
    }>(detail);
    expect(incident.status).toBe('COMPLETED');
    expect(incident.statusHistory.length).toBeGreaterThanOrEqual(3);
    expect(incident.images).toHaveLength(1);

    const notifications = await request(app.getHttpServer())
      .get('/api/v1/notifications?limit=100')
      .set('Authorization', `Bearer ${citizen.accessToken}`)
      .expect(200);
    const titles = data<{ items: Array<{ title: string }> }>(
      notifications,
    ).items.map((notification) => notification.title);
    expect(titles).toContain('เจ้าหน้าที่รับแจ้งเหตุแล้ว');
    expect(titles).toContain('ภารกิจสำเร็จ');

    const audits = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs?limit=100')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(
      data<{ items: Array<{ entityId?: string }> }>(audits).items.some(
        (entry) => entry.entityId === incidentId,
      ),
    ).toBe(true);
  });

  it('prevents viewers from mutating incidents', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/incidents/${incidentId}/complete`)
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({})
      .expect(403);
  });

  it('rotates and revokes refresh tokens', async () => {
    const rotated = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: citizen.refreshToken })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: citizen.refreshToken })
      .expect(401);
    const nextRefresh = data<TokenResponse>(rotated).refreshToken;
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: nextRefresh })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: nextRefresh })
      .expect(401);
  });

  afterAll(async () => {
    await app.close();
  });
});
