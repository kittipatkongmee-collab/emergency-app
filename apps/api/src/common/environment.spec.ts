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
});
