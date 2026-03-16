import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { getEnv } from './env';
import { logger } from './logger';

// Initialize Redis client gracefully
let redis: Redis | null = null;
try {
  const env = getEnv();
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch (error) {
  logger.warn('Failed to initialize Upstash Redis client for rate limiting', {
    service: 'rateLimiter',
    error: error instanceof Error ? error.message : String(error),
  });
}

const WINDOW_IN_SECONDS = 60;

/**
 * Checks the global API rate limit for a given IP and route.
 * 
 * Behavior:
 * - Limit: 100 requests per minute per IP for general APIs
 * - Limit: 10 requests per minute for /api/auth/*
 * - Limit: 5 requests per minute for /api/auth/login
 * 
 * If Redis is unavailable, it fails open (returns null to allow request).
 * 
 * @param ip - The client's IP address
 * @param route - The API route path
 * @returns NextResponse with 429 status if limit exceeded, else null
 */
export async function checkRateLimit(ip: string, route: string): Promise<NextResponse | null> {
  // Determine limit based on the route
  let limit = 100;
  
  if (route === '/api/auth/login') {
    limit = 5;
  } else if (route.startsWith('/api/auth/')) {
    limit = 10;
  }

  // Fail open if Redis is unavailable
  if (!redis) {
    logger.warn('Redis is unavailable, failing open for rate limit check', {
      service: 'rateLimiter',
      ip,
      route,
    });
    return null;
  }

  // Key format: rate:{ip}:{route}
  const key = `rate:${ip}:${route}`;

  try {
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, WINDOW_IN_SECONDS);
    }

    const remaining = Math.max(0, limit - count);

    // If the limit is exceeded
    if (count > limit) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'Retry-After': WINDOW_IN_SECONDS.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
          },
        }
      );
    }

    return null;
  } catch (error) {
    // Fail open if an error occurs interacting with Redis
    logger.error('Redis error during rate limit check, failing open', {
      service: 'rateLimiter',
      ip,
      route,
      error: error instanceof Error ? error.message : String(error),
    });
    
    return null;
  }
}
