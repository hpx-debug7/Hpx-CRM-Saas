/**
 * POST /api/auth/login
 *
 * Validates request body with Zod BEFORE any database access,
 * password comparison, or failedAttempts increment.
 */

import { logger } from '@/lib/server/logger';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import {
    verifyPassword,
    createSession,
    isAccountLocked,
    recordFailedLoginAttempt,
    resetFailedLoginAttempts,
} from '@/lib/server/auth';
import { loginSchema, formatValidationError } from '@/lib/shared/validations/auth';
import { loginRateLimiter } from '@/lib/server/rateLimiter';

export async function POST(request: NextRequest) {
    try {
        // ── Step 0: Rate Limiting (Distributed) ─────────────────────────
        const ipAddress =
            request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'unknown';

        const isAllowed = await loginRateLimiter.enforce(`login:rate:${ipAddress}`);

        if (!isAllowed) {
            return NextResponse.json(
                { error: 'Too many requests', message: 'Too many login attempts. Please try again later.' },
                { status: 429 }
            );
        }

        // ── Step 1: Parse JSON body ─────────────────────────────────────
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: 'Validation failed', message: 'Request body must be valid JSON' },
                { status: 400 }
            );
        }

        // ── Step 1: Zod validation BEFORE any DB/password/lockout logic ─
        const parsed = loginSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Validation failed',
                    message: formatValidationError(parsed.error),
                },
                { status: 400 }
            );
        }

        const { identifier, password } = parsed.data;

        // ── Step 2: Database lookup ─────────────────────────────────────
        let user;
        try {
            const lowerIdentifier = identifier.toLowerCase();
            user = await prisma.user.findFirstOrThrow({
                where: {
                    OR: [
                        { email: lowerIdentifier },
                        { username: lowerIdentifier },
                    ],
                    isActive: true,
                },
                include: { company: true },
            });
        } catch {
            user = null;
        }

        if (!user) {
            return NextResponse.json(
                { error: 'Authentication failed', message: 'Invalid identifier or password' },
                { status: 401 }
            );
        }

        // ── Step 3: Account lockout check ───────────────────────────────
        if (await isAccountLocked(user.id)) {
            return NextResponse.json(
                {
                    error: 'Account locked',
                    message: 'Account is locked due to too many failed attempts. Please try again later.',
                },
                { status: 403 }
            );
        }

        // ── Step 4: Password verification ───────────────────────────────
        const isValid = await verifyPassword(password, user.password);
        if (!isValid) {
            await recordFailedLoginAttempt(user.id);
            return NextResponse.json(
                { error: 'Authentication failed', message: 'Invalid identifier or password' },
                { status: 401 }
            );
        }

        // ── Step 6: Success — create session ────────────────────────────
        await resetFailedLoginAttempts(user.id);

        const userAgent = request.headers.get('user-agent') || undefined;

        await createSession(user.id, user.role, user.companyId, userAgent, ipAddress);

        return NextResponse.json(
            {
                success: true,
                message: 'Login successful',
                user: {
                    userId: user.id,
                    username: user.username,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
            },
            { status: 200 }
        );
    } catch (error) {
        logger.error('Login route error:', error);
        return NextResponse.json(
            { error: 'Internal server error', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}

// Force dynamic behavior to ensure we aren't returning a cached static version
export const dynamic = 'force-dynamic';
export const revalidate = 0;
