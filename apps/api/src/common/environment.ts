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
    S3_ENDPOINT: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
    S3_REGION: z.string().default('auto'),
    S3_PUBLIC_BASE_URL: z.string().optional(),
    SWAGGER_ENABLED: z.string().default('true'),
    DEV_AUTH_BYPASS: z.string().default('false'),
    FACEBOOK_LOGIN_ENABLED: z.string().default('false'),
    FACEBOOK_APP_ID: z.string().optional(),
    FACEBOOK_APP_SECRET: z.string().optional(),
    FCM_ENABLED: z.string().default('false'),
    FCM_PROJECT_ID: z.string().optional(),
    FCM_CLIENT_EMAIL: z.string().optional(),
    FCM_PRIVATE_KEY: z.string().optional(),
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
    if (
      env.FACEBOOK_LOGIN_ENABLED === 'true' &&
      (!env.FACEBOOK_APP_ID || !env.FACEBOOK_APP_SECRET)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['FACEBOOK_LOGIN_ENABLED'],
        message: 'เปิด Facebook Login ได้เมื่อกำหนด App ID และ App Secret แล้ว',
      });
    }
    if (
      env.FCM_ENABLED === 'true' &&
      (!env.FCM_PROJECT_ID || !env.FCM_CLIENT_EMAIL || !env.FCM_PRIVATE_KEY)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['FCM_ENABLED'],
        message: 'เปิด FCM ได้เมื่อกำหนด service-account credentials ครบแล้ว',
      });
    }
    if (
      env.STORAGE_DRIVER === 's3' &&
      (!env.S3_ENDPOINT ||
        !env.S3_BUCKET ||
        !env.S3_ACCESS_KEY ||
        !env.S3_SECRET_KEY ||
        !env.S3_PUBLIC_BASE_URL)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['STORAGE_DRIVER'],
        message: 'S3 storage ต้องกำหนด endpoint, bucket, keys และ public URL',
      });
    }
    if (env.NODE_ENV === 'production' && env.STORAGE_DRIVER === 'local') {
      ctx.addIssue({
        code: 'custom',
        path: ['STORAGE_DRIVER'],
        message: 'Production ต้องใช้ durable S3-compatible storage',
      });
    }
  });

export function validateEnvironment(value: Record<string, unknown>) {
  return schema.parse(value);
}
