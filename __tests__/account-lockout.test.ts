/**
 * ACCOUNT LOCKOUT TESTS
 *
 * Validates deterministic lockout behaviour:
 *   1. Account locks after MAX_FAILED_ATTEMPTS failures
 *   2. Locked account cannot log in
 *   3. Lock expires after LOCKOUT_DURATION_MINUTES
 *   4. Successful login resets counter and lockedUntil
 *
 * Run with: npx vitest run __tests__/account-lockout.test.ts
 */

import { describe, test, expect, beforeAll, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import {
    hashPassword,
    isAccountLocked,
    recordFailedLoginAttempt,
    resetFailedLoginAttempts,
    MAX_FAILED_ATTEMPTS,
    LOCKOUT_DURATION_MINUTES,
} from '@/lib/auth';

describe('Account Lockout', () => {
    let testCompany: any;
    let testUser: any;
    const TEST_PASSWORD = 'LockoutTest1!';

    beforeAll(async () => {
        testCompany = await prisma.company.create({
            data: {
                name: 'Lockout Test Co ' + Date.now(),
                slug: 'lockout-test-' + Date.now(),
            },
        });
    });

    /**
     * Fresh user for every test to avoid cross-contamination.
     */
    beforeEach(async () => {
        const ts = Date.now();
        const hashed = await hashPassword(TEST_PASSWORD);
        testUser = await prisma.user.create({
            data: {
                companyId: testCompany.id,
                email: `lockout-${ts}@test.com`,
                username: `lockout-${ts}`,
                name: 'Lockout Test User',
                password: hashed,
                role: 'SALES_EXECUTIVE',
                failedLoginAttempts: 0,
                lockedUntil: null,
            },
        });
    });

    // ── 1. Lock after MAX_FAILED_ATTEMPTS failures ──────────────────────

    test(`locks account after ${MAX_FAILED_ATTEMPTS} consecutive failures`, async () => {
        for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
            await recordFailedLoginAttempt(testUser.id);
        }

        const user = await prisma.user.findUnique({
            where: { id: testUser.id },
            select: { failedLoginAttempts: true, lockedUntil: true },
        });

        expect(user!.failedLoginAttempts).toBe(MAX_FAILED_ATTEMPTS);
        expect(user!.lockedUntil).not.toBeNull();
        expect(user!.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    });

    // ── 2. Locked user cannot log in ────────────────────────────────────

    test('isAccountLocked returns true when lockedUntil is in the future', async () => {
        // Manually lock the user with a future timestamp
        await prisma.user.update({
            where: { id: testUser.id },
            data: {
                failedLoginAttempts: MAX_FAILED_ATTEMPTS,
                lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000),
            },
        });

        const locked = await isAccountLocked(testUser.id);
        expect(locked).toBe(true);
    });

    // ── 3. Lock expires correctly ───────────────────────────────────────

    test('isAccountLocked returns false and resets counters after lockout expires', async () => {
        // Set lockedUntil to 1 second in the past (expired)
        await prisma.user.update({
            where: { id: testUser.id },
            data: {
                failedLoginAttempts: MAX_FAILED_ATTEMPTS,
                lockedUntil: new Date(Date.now() - 1000),
            },
        });

        const locked = await isAccountLocked(testUser.id);
        expect(locked).toBe(false);

        // Verify counters were reset
        const user = await prisma.user.findUnique({
            where: { id: testUser.id },
            select: { failedLoginAttempts: true, lockedUntil: true },
        });

        expect(user!.failedLoginAttempts).toBe(0);
        expect(user!.lockedUntil).toBeNull();
    });

    // ── 4. Successful login resets counter ──────────────────────────────

    test('resetFailedLoginAttempts clears failedLoginAttempts and lockedUntil', async () => {
        // Simulate a locked state
        await prisma.user.update({
            where: { id: testUser.id },
            data: {
                failedLoginAttempts: MAX_FAILED_ATTEMPTS,
                lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000),
            },
        });

        await resetFailedLoginAttempts(testUser.id);

        const user = await prisma.user.findUnique({
            where: { id: testUser.id },
            select: { failedLoginAttempts: true, lockedUntil: true, lastLoginAt: true },
        });

        expect(user!.failedLoginAttempts).toBe(0);
        expect(user!.lockedUntil).toBeNull();
        expect(user!.lastLoginAt).not.toBeNull();
    });

    // ── 5. Fewer than MAX_FAILED_ATTEMPTS does NOT lock ─────────────────

    test('does not lock account before reaching threshold', async () => {
        for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) {
            await recordFailedLoginAttempt(testUser.id);
        }

        const user = await prisma.user.findUnique({
            where: { id: testUser.id },
            select: { failedLoginAttempts: true, lockedUntil: true },
        });

        expect(user!.failedLoginAttempts).toBe(MAX_FAILED_ATTEMPTS - 1);
        expect(user!.lockedUntil).toBeNull();
    });

    // ── 6. Non-existent user does not throw ─────────────────────────────

    test('isAccountLocked returns false for non-existent user', async () => {
        const locked = await isAccountLocked('non-existent-id');
        expect(locked).toBe(false);
    });
});
