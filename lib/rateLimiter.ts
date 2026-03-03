import { Redis } from '@upstash/redis';
import { env } from './env';

export interface RateLimiter {
    enforce(key: string): Promise<boolean>;
}

export class RedisRateLimiter implements RateLimiter {
    private redis: Redis | null = null;
    private maxRequests: number;
    private windowSeconds: number;

    constructor(maxRequests: number = 5, windowSeconds: number = 600) {
        this.maxRequests = maxRequests;
        this.windowSeconds = windowSeconds;

        try {
            this.redis = new Redis({
                url: env.UPSTASH_REDIS_REST_URL,
                token: env.UPSTASH_REDIS_REST_TOKEN,
            });
        } catch (error) {
            console.error('[RateLimiter] Failed to initialize Upstash Redis. Falling back to fail-open.', error);
            // redis remains null, fail-open policy will apply
        }
    }

    async enforce(key: string): Promise<boolean> {
        // Fail-open policy: If Redis is completely unavailable during init, allow request.
        if (!this.redis) {
            return true;
        }

        try {
            // Atomic INCR operations
            const count = await this.redis.incr(key);

            // If this is the absolute first request in the new window, set its TTL expiration
            if (count === 1) {
                await this.redis.expire(key, this.windowSeconds);
            }

            // Return true if under/equal to limit, false if exceeded limit
            return count <= this.maxRequests;
        } catch (error) {
            // Fail-open policy execution: If a network/Redis error occurs at runtime, securely allow the request and log the error.
            console.error(`[RateLimiter] Execution error enforcing rate limit for key ${key}. Failing open.`, error);
            return true;
        }
    }
}

// Export singleton instance specifically configured for the login route.
export const loginRateLimiter = new RedisRateLimiter(5, 600);
