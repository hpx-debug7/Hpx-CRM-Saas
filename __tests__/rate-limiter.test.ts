import { describe, test, expect, vi, beforeEach } from 'vitest';
import { loginRateLimiter, RedisRateLimiter } from '@/lib/server/rateLimiter';
import { Redis } from '@upstash/redis';

// Note: Testing environment variables for UPSTASH_REDIS_REST_URL/TOKEN
// are supplied via .env.test.

// Mock the Upstash Redis client
vi.mock('@upstash/redis', () => {
    return {
        Redis: vi.fn(),
    };
});

describe('Distributed Redis Rate Limiter', () => {
    let mockIncr: any;
    let mockExpire: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockIncr = vi.fn();
        mockExpire = vi.fn();

        // Stub the Redis class implementation returned by the mock
        (Redis as any).mockImplementation(() => {
            return {
                incr: mockIncr,
                expire: mockExpire,
            };
        });
    });

    test('allows 5 consecutive requests and enforces EXPIRE on first request', async () => {
        const limiter = new RedisRateLimiter(5, 600);

        // First attempt -> sets expire
        mockIncr.mockResolvedValueOnce(1);
        const result1 = await limiter.enforce('login:rate:192.168.1.1');
        expect(result1).toBe(true);
        expect(mockExpire).toHaveBeenCalledWith('login:rate:192.168.1.1', 600);
        expect(mockExpire).toHaveBeenCalledTimes(1);

        // Next 4 attempts
        for (let i = 2; i <= 5; i++) {
            mockIncr.mockResolvedValueOnce(i);
            const r = await limiter.enforce('login:rate:192.168.1.1');
            expect(r).toBe(true);
        }

        expect(mockIncr).toHaveBeenCalledTimes(5);
        expect(mockExpire).toHaveBeenCalledTimes(1); // Only called when count === 1
    });

    test('blocks the 6th consecutive request', async () => {
        const limiter = new RedisRateLimiter(5, 600);

        // Sixth attempt
        mockIncr.mockResolvedValue(6);
        const result = await limiter.enforce('login:rate:192.168.1.2');

        expect(result).toBe(false); // Blocks request
        expect(mockExpire).not.toHaveBeenCalled(); // count is 6, does not trigger expire
    });

    test('isolates limits across different IPs (keys)', async () => {
        const limiter = new RedisRateLimiter(5, 600);

        // IP 1 exceeded
        mockIncr.mockImplementation((key: string) => {
            if (key === 'login:rate:ip1') return Promise.resolve(6);
            if (key === 'login:rate:ip2') return Promise.resolve(1);
            return Promise.resolve(0);
        });

        const r1 = await limiter.enforce('login:rate:ip1');
        const r2 = await limiter.enforce('login:rate:ip2');

        expect(r1).toBe(false); // blocked
        expect(r2).toBe(true);  // allowed
    });

    test('resets after TTL window mimics expiry', async () => {
        const limiter = new RedisRateLimiter(5, 600);

        // Simulating expiry means the next request will yield count === 1 again
        mockIncr.mockResolvedValueOnce(1);

        const result = await limiter.enforce('login:rate:192.168.1.5');
        expect(result).toBe(true);
        expect(mockExpire).toHaveBeenCalledWith('login:rate:192.168.1.5', 600);
    });

    test('FAILS OPEN gracefully if Redis throws an error', async () => {
        // Capture stderr to keep test output clean and assert it was called
        const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((() => true) as any);

        const limiter = new RedisRateLimiter(5, 600);

        // Simulate Redis network error
        mockIncr.mockRejectedValue(new Error('Redis connection timeout'));

        // Should NOT throw back to caller, should return robust `true`
        const result = await limiter.enforce('login:rate:192.168.1.99');

        expect(result).toBe(true);
        expect(stderrSpy).toHaveBeenCalled();
        expect(typeof stderrSpy.mock.calls[0][0] === 'string' && stderrSpy.mock.calls[0][0]).toContain('Execution error enforcing rate limit');

        stderrSpy.mockRestore();
    });
});
