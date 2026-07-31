import { z } from 'zod';

const mysqlUrl = z
  .string()
  .min(1)
  .superRefine((value, ctx) => {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'mysql:') {
        ctx.addIssue({
          code: 'custom',
          message: 'DATABASE_URL ต้องใช้ mysql:// เท่านั้น',
        });
      }
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'DATABASE_URL ไม่ใช่ URL ที่ถูกต้อง',
      });
    }
  });

const schema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'staging', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: mysqlUrl,
    SHADOW_DATABASE_URL: mysqlUrl,
    TEST_DATABASE_URL: mysqlUrl.optional(),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
    CORS_ORIGINS: z.string().default('http://localhost:4200'),
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_PATH: z.string().default('uploads'),
    SWAGGER_ENABLED: z.string().default('true'),
    DEV_AUTH_BYPASS: z.string().default('false'),
  })
  .passthrough()
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.DEV_AUTH_BYPASS === 'true') {
      ctx.addIssue({
        code: 'custom',
        path: ['DEV_AUTH_BYPASS'],
        message: 'ห้ามเปิด Development Auth Bypass ใน Production',
      });
    }
  });

export function validateEnvironment(value: Record<string, unknown>) {
  return schema.parse(value);
}
