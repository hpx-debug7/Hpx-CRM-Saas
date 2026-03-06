import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { Redis } from '@upstash/redis';
import { getEnv } from '@/lib/server/env';

/**
 * PRODUCTION HEALTH MONITORING ENDPOINT
 * 
 * Verifies core infrastructure connectivity:
 * 1. PostgreSQL (Prisma) - Required for operation (503 if down)
 * 2. Upstash Redis - Optional/Partial degradation (200 if down)
 */
export async function GET() {
    const env = getEnv();
    const timestamp = new Date().toISOString();

    let databaseStatus: 'connected' | 'disconnected' = 'disconnected';
    let redisStatus: 'connected' | 'disconnected' | 'unknown' = 'unknown';
    let isHealthy = true;

    // 1. Database Check (Critical)
    try {
        await prisma.$queryRaw`SELECT 1`;
        databaseStatus = 'connected';
    } catch (error) {
        databaseStatus = 'disconnected';
        isHealthy = false;
        // Internal logging could go here, but do not expose to response
    }

    // 2. Redis Check (Optional/Non-critical)
    if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
        try {
            const redis = new Redis({
                url: env.UPSTASH_REDIS_REST_URL,
                token: env.UPSTASH_REDIS_REST_TOKEN,
            });
            await redis.ping();
            redisStatus = 'connected';
        } catch (error) {
            redisStatus = 'disconnected';
            // Redis failure does not trigger 503 per requirements
        }
    }

    const report = {
        status: isHealthy ? 'ok' : 'error',
        database: databaseStatus,
        redis: redisStatus,
        timestamp,
    };

    return NextResponse.json(report, {
        status: isHealthy ? 200 : 503,
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Surrogate-Control': 'no-store',
        },
    });
}

// Force dynamic behavior to ensure we aren't returning a cached static version
export const dynamic = 'force-dynamic';
export const revalidate = 0;
