import { z } from 'zod';

/**
 * Production-grade environment variables schema.
 * Using Zod to ensure type safety and runtime validation.
 * Centralized for all server-side environment access.
 */
const envSchema = z.object({
    // ── System ──────────────────────────────────────────────────────────────
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    // ── Database ────────────────────────────────────────────────────────────
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),

    // ── Authentication ──────────────────────────────────────────────────────
    NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET is required'),
    NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters.'),

    // ── Redis (Upstash) ─────────────────────────────────────────────────────
    REDIS_URL: z.string().url('REDIS_URL must be a valid connection string').optional(),
    UPSTASH_REDIS_REST_URL: z.string().url('UPSTASH_REDIS_REST_URL must be a valid URL.').optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

    // ── Email & Encryption ──────────────────────────────────────────────────
    EMAIL_ENCRYPTION_KEY: z.string().min(32, 'EMAIL_ENCRYPTION_KEY must be at least 32 characters.'),

    // ── OAuth ───────────────────────────────────────────────────────────────
    BASE_URL: z.string().optional().default(''),
    GOOGLE_CLIENT_ID: z.string().optional().default(''),
    GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
    GOOGLE_REDIRECT_URI: z.string().optional().default(''),
    MICROSOFT_CLIENT_ID: z.string().optional().default(''),
    MICROSOFT_CLIENT_SECRET: z.string().optional().default(''),

    // ── Monitoring ──────────────────────────────────────────────────────────
    SENTRY_DSN: z.string().url('SENTRY_DSN must be a valid URL').optional(),

    // ── Sync & WebSocket ────────────────────────────────────────────────────
    SYNC_SERVER_URL: z.string().optional().default('http://localhost:3000'),
    SYNC_API_KEY: z.string().optional().default(''),
    DEVICE_ID: z.string().optional().default('desktop-client-1'),
    WS_PUBLISH_URL: z.string().optional().default('https://ws.hpxeigen.com/publish'),
    WS_PUBLISH_SECRET: z.string().optional().default(''),
    COMPANY_ID: z.string().optional().default('SYSTEM'),
});

/**
 * Inferred type for the environment configuration.
 */
export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/**
 * Returns the validated environment configuration.
 * Performs lazy validation on the first call and caches the result.
 * 
 * @throws Error if environment validation fails.
 */
export function getEnv(): Env {
    if (cachedEnv) {
        return cachedEnv;
    }

    const isTest = process.env.NODE_ENV === 'test';

    // Provide safe defaults exclusively for test environment to bypass CI failures
    // while maintaining strict validation for development and production.
    const envData = isTest
        ? {
              DATABASE_URL: 'postgresql://test:test@localhost:5432/testdb',
              JWT_SECRET: 'test-secret-key-32-characters-long-minimum',
              NEXTAUTH_SECRET: 'test-secret',
              NEXTAUTH_URL: 'http://localhost:3000',
              REDIS_URL: 'redis://localhost:6379',
              EMAIL_ENCRYPTION_KEY: 'test-encryption-key-32-characters-long',
              ...process.env,
          }
        : process.env;

    const result = envSchema.safeParse(envData);

    if (!result.success) {
        console.error('\x1b[31m%s\x1b[0m', '❌ Invalid environment configuration');

        result.error.issues.forEach((issue) => {
            const path = issue.path.join('.');
            console.error('\x1b[33m%s\x1b[0m', `${path} → ${issue.message}`);
        });

        throw new Error('Environment validation failed. Please check your .env file.');
    }

    cachedEnv = Object.freeze(result.data);
    return cachedEnv;
}
