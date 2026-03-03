/**
 * Centralized Environment Validation (Zod)
 *
 * All server-side code MUST import secrets/config from this module.
 * Throws immediately at import time if any required variable is missing
 * or fails validation. No fallbacks for secrets.
 *
 * Usage:
 *   import { env } from '@/lib/env';
 *   const secret = env.JWT_SECRET;
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const envSchema = z.object({
    // Runtime environment
    NODE_ENV: z
        .enum(['development', 'test', 'production'])
        .default('development'),

    // ── Required secrets ────────────────────────────────────────────────────
    /** HMAC key used to sign/verify JWTs — min 32 characters */
    JWT_SECRET: z
        .string()
        .min(32, 'JWT_SECRET must be at least 32 characters.'),

    /** PostgreSQL connection string for Prisma */
    DATABASE_URL: z
        .string()
        .url('DATABASE_URL must be a valid URL.'),

    /** Key for AES-256-GCM email encryption — min 16 characters */
    EMAIL_ENCRYPTION_KEY: z
        .string()
        .min(16, 'EMAIL_ENCRYPTION_KEY must be at least 16 characters.'),

    /** Upstash Redis REST URL */
    UPSTASH_REDIS_REST_URL: z.string().url('UPSTASH_REDIS_REST_URL must be a valid URL.'),

    /** Upstash Redis REST Token */
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1, 'UPSTASH_REDIS_REST_TOKEN is required.'),

    // ── Optional config ─────────────────────────────────────────────────────
    /** Base URL for OAuth redirect callbacks */
    BASE_URL: z.string().optional().default(''),

    /** Google OAuth */
    GOOGLE_CLIENT_ID: z.string().optional().default(''),
    GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
    GOOGLE_REDIRECT_URI: z.string().optional().default(''),

    /** Microsoft OAuth */
    MICROSOFT_CLIENT_ID: z.string().optional().default(''),
    MICROSOFT_CLIENT_SECRET: z.string().optional().default(''),

    /** Sync engine */
    SYNC_SERVER_URL: z.string().optional().default('http://localhost:3000'),
    SYNC_API_KEY: z.string().optional().default(''),
    DEVICE_ID: z.string().optional().default('desktop-client-1'),

    /** WebSocket publisher */
    WS_PUBLISH_URL: z.string().optional().default('https://ws.hpxeigen.com/publish'),
    WS_PUBLISH_SECRET: z.string().optional().default(''),
});

// ---------------------------------------------------------------------------
// Parse & freeze
// ---------------------------------------------------------------------------

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    const formatted = parsed.error.issues
        .map((issue) => `  ✗ ${issue.path.join('.')}: ${issue.message}`)
        .join('\n');

    throw new Error(
        `\nFATAL: Environment validation failed. The application cannot start.\n\n${formatted}\n`
    );
}

export const env = Object.freeze(parsed.data);

export type Env = typeof env;
