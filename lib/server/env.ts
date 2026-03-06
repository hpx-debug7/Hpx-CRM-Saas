/**
 * Centralized Environment Validation (Zod) — Lazy, Cached
 *
 * All server-side code MUST import secrets/config from this module.
 * Validates on first call to getEnv() and caches the result.
 * Throws if any required variable is missing or fails validation.
 * No fallbacks for secrets.
 *
 * Usage:
 *   import { getEnv } from '@/lib/server/env';
 *   const env = getEnv();
 *   const secret = env.JWT_SECRET;
 */

import 'server-only';
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

    /** Key for AES-256-GCM email encryption — min 32 characters */
    EMAIL_ENCRYPTION_KEY: z
        .string()
        .min(32, 'EMAIL_ENCRYPTION_KEY must be at least 32 characters.'),

    /** Upstash Redis REST URL (optional in development) */
    UPSTASH_REDIS_REST_URL: z.string().url('UPSTASH_REDIS_REST_URL must be a valid URL.').optional(),

    /** Upstash Redis REST Token (optional in development) */
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

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
// Lazy, cached validation
// ---------------------------------------------------------------------------

let _cached: z.infer<typeof envSchema> | null = null;

export function getEnv(): z.infer<typeof envSchema> {
    if (_cached) return _cached;

    const parsed = envSchema.safeParse(process.env);

    if (!parsed.success) {
        const formatted = parsed.error.issues
            .map((issue) => `  ✗ ${issue.path.join('.')}: ${issue.message}`)
            .join('\n');

        throw new Error(
            `\nFATAL: Environment validation failed. The application cannot start.\n\n${formatted}\n`
        );
    }

    _cached = Object.freeze(parsed.data);
    return _cached;
}

export type Env = ReturnType<typeof getEnv>;
