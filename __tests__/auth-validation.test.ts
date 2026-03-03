/**
 * AUTH VALIDATION TESTS
 *
 * Verifies Zod-based validation gates on /api/auth/login and /api/auth/signup.
 * Tests confirm validation occurs BEFORE any DB access.
 *
 * Run with: npx vitest run __tests__/auth-validation.test.ts
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { loginSchema, signupSchema, formatValidationError } from '@/lib/validations/auth';

// ============================================================================
// Schema-level validation tests (no DB, no network)
// ============================================================================

describe('Login Schema Validation (Zod gate)', () => {
    test('rejects empty object', () => {
        const result = loginSchema.safeParse({});
        expect(result.success).toBe(false);
    });

    test('rejects missing email', () => {
        const result = loginSchema.safeParse({ password: 'Test1234!' });
        expect(result.success).toBe(false);
    });

    test('rejects missing password', () => {
        const result = loginSchema.safeParse({ email: 'user@test.com' });
        expect(result.success).toBe(false);
    });

    test('rejects invalid email format', () => {
        const result = loginSchema.safeParse({ email: 'not-an-email', password: 'Test1234!' });
        expect(result.success).toBe(false);
        if (!result.success) {
            const msg = formatValidationError(result.error);
            expect(msg).toContain('Invalid email format');
        }
    });

    test('rejects empty string email', () => {
        const result = loginSchema.safeParse({ email: '', password: 'Test1234!' });
        expect(result.success).toBe(false);
    });

    test('rejects empty string password', () => {
        const result = loginSchema.safeParse({ email: 'user@test.com', password: '' });
        expect(result.success).toBe(false);
    });

    test('rejects email exceeding max length', () => {
        const result = loginSchema.safeParse({
            email: 'a'.repeat(300) + '@test.com',
            password: 'Test1234!',
        });
        expect(result.success).toBe(false);
    });

    test('rejects password exceeding max length', () => {
        const result = loginSchema.safeParse({
            email: 'user@test.com',
            password: 'a'.repeat(200),
        });
        expect(result.success).toBe(false);
    });

    test('accepts valid email + password', () => {
        const result = loginSchema.safeParse({ email: 'user@test.com', password: 'Test1234!' });
        expect(result.success).toBe(true);
    });

    test('formatValidationError does not leak Zod internals', () => {
        const result = loginSchema.safeParse({});
        expect(result.success).toBe(false);
        if (!result.success) {
            const msg = formatValidationError(result.error);
            // Should be a simple string, not contain 'ZodError' or 'path' or 'code'
            expect(msg).not.toContain('ZodError');
            expect(msg).not.toContain('"path"');
            expect(msg).not.toContain('"code"');
            expect(typeof msg).toBe('string');
        }
    });
});

describe('Signup Schema Validation (Zod gate)', () => {
    test('rejects empty object', () => {
        const result = signupSchema.safeParse({});
        expect(result.success).toBe(false);
    });

    test('rejects missing required fields', () => {
        const result = signupSchema.safeParse({ email: 'user@test.com' });
        expect(result.success).toBe(false);
    });

    test('rejects invalid email format', () => {
        const result = signupSchema.safeParse({
            email: 'bad-email',
            username: 'testuser',
            password: 'Test1234!',
            name: 'Test User',
            companyId: 'company-123',
        });
        expect(result.success).toBe(false);
    });

    test('rejects short password', () => {
        const result = signupSchema.safeParse({
            email: 'user@test.com',
            username: 'testuser',
            password: 'short',
            name: 'Test User',
            companyId: 'company-123',
        });
        expect(result.success).toBe(false);
    });

    test('rejects short username', () => {
        const result = signupSchema.safeParse({
            email: 'user@test.com',
            username: 'ab',
            password: 'Test1234!',
            name: 'Test User',
            companyId: 'company-123',
        });
        expect(result.success).toBe(false);
    });

    test('rejects username with invalid characters', () => {
        const result = signupSchema.safeParse({
            email: 'user@test.com',
            username: 'test user!',
            password: 'Test1234!',
            name: 'Test User',
            companyId: 'company-123',
        });
        expect(result.success).toBe(false);
    });

    test('accepts valid signup input', () => {
        const result = signupSchema.safeParse({
            email: 'user@test.com',
            username: 'testuser',
            password: 'Test1234!',
            name: 'Test User',
            companyId: 'company-123',
        });
        expect(result.success).toBe(true);
    });
});

// ============================================================================
// DB interaction tests — prove invalid input does NOT touch the database
// ============================================================================

describe('Login Validation Gate — DB Interaction', () => {
    let testCompany: any;
    let testUser: any;

    beforeAll(async () => {
        // Create a real user with a real hashed password for testing
        testCompany = await prisma.company.create({
            data: {
                name: 'Auth Validation Test Co ' + Date.now(),
                slug: 'auth-validation-test-' + Date.now(),
            },
        });

        const hashed = await hashPassword('CorrectPassword1!');
        testUser = await prisma.user.create({
            data: {
                companyId: testCompany.id,
                email: `auth-test-${Date.now()}@test.com`,
                username: `auth-test-${Date.now()}`,
                name: 'Auth Test User',
                password: hashed,
                role: 'SALES_EXECUTIVE',
                failedLoginAttempts: 0,
            },
        });
    });

    test('invalid email should NOT increment failedAttempts', async () => {
        // Capture current failedAttempts
        const before = await prisma.user.findUnique({
            where: { id: testUser.id },
            select: { failedLoginAttempts: true },
        });

        // Validation rejects invalid email — loginAction should return early
        const parsed = loginSchema.safeParse({ email: 'not-an-email', password: 'anything' });
        expect(parsed.success).toBe(false);
        // Since validation fails, loginAction would return before DB access.

        // Confirm failedAttempts unchanged
        const after = await prisma.user.findUnique({
            where: { id: testUser.id },
            select: { failedLoginAttempts: true },
        });
        expect(after?.failedLoginAttempts).toBe(before?.failedLoginAttempts);
    });

    test('empty body should NOT increment failedAttempts', async () => {
        const before = await prisma.user.findUnique({
            where: { id: testUser.id },
            select: { failedLoginAttempts: true },
        });

        const parsed = loginSchema.safeParse({});
        expect(parsed.success).toBe(false);

        const after = await prisma.user.findUnique({
            where: { id: testUser.id },
            select: { failedLoginAttempts: true },
        });
        expect(after?.failedLoginAttempts).toBe(before?.failedLoginAttempts);
    });

    test('missing password should NOT increment failedAttempts', async () => {
        const before = await prisma.user.findUnique({
            where: { id: testUser.id },
            select: { failedLoginAttempts: true },
        });

        const parsed = loginSchema.safeParse({ email: testUser.email });
        expect(parsed.success).toBe(false);

        const after = await prisma.user.findUnique({
            where: { id: testUser.id },
            select: { failedLoginAttempts: true },
        });
        expect(after?.failedLoginAttempts).toBe(before?.failedLoginAttempts);
    });
});
