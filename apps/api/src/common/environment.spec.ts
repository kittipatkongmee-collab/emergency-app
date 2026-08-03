import { validateEnvironment } from './environment';

const validEnvironment = {
  NODE_ENV: 'development',
  DATABASE_URL:
    'mysql://police_app:development-password@localhost:3306/police_incident_system',
  SHADOW_DATABASE_URL:
    'mysql://police_app:development-password@localhost:3306/police_incident_shadow',
  TEST_DATABASE_URL:
    'mysql://police_test:test-password@localhost:3306/police_incident_test',
  JWT_ACCESS_SECRET: 'access-secret-with-at-least-32-characters',
  JWT_REFRESH_SECRET: 'refresh-secret-with-at-least-32-characters',
};

describe('validateEnvironment', () => {
  it('accepts MySQL development and test database URLs', () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      DATABASE_URL: validEnvironment.DATABASE_URL,
      TEST_DATABASE_URL: validEnvironment.TEST_DATABASE_URL,
    });
  });

  it.each(['postgresql://localhost/database', 'postgres://localhost/database'])(
    'rejects a PostgreSQL URL using %s',
    (databaseUrl) => {
      expect(() =>
        validateEnvironment({
          ...validEnvironment,
          DATABASE_URL: databaseUrl,
        }),
      ).toThrow('DATABASE_URL ต้องใช้ mysql:// เท่านั้น');
    },
  );

  it('rejects development authentication bypass in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        DEV_AUTH_BYPASS: 'true',
      }),
    ).toThrow('ห้ามเปิด Development Auth Bypass ใน Production');
  });

  it('rejects FCM when service-account credentials are incomplete', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        FCM_ENABLED: 'true',
      }),
    ).toThrow('เปิด FCM ได้เมื่อกำหนด service-account credentials ครบแล้ว');
  });

  it('rejects local file storage in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        DEV_AUTH_BYPASS: 'false',
        STORAGE_DRIVER: 'local',
      }),
    ).toThrow('Production ต้องใช้ durable S3-compatible storage');
  });
});
