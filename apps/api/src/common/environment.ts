import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'staging', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
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
