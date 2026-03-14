/**
 * POST /api/auth/signup
 *
 * Validates request body with Zod BEFORE any database access or
 * user creation.
 */

import { logger } from '@/lib/server/logger';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { hashPassword, validatePasswordStrength } from '@/lib/server/auth';
import { signupSchema, formatValidationError } from '@/lib/shared/validations/auth';
import { withApiLogging } from "@/lib/apiLogger";

export async function POST(request: NextRequest) {
    return withApiLogging(request, async (requestId) => {
        try {
            // ── Step 0: Parse JSON body ─────────────────────────────────────
            let body: unknown;
            try {
                body = await request.json();
            } catch {
                return NextResponse.json(
                    { error: 'Validation failed', message: 'Request body must be valid JSON' },
                    { status: 400 }
                );
            }

            // ── Step 1: Zod validation BEFORE any DB access ─────────────────
            const parsed = signupSchema.safeParse(body);
            if (!parsed.success) {
                return NextResponse.json(
                    {
                        error: 'Validation failed',
                        message: formatValidationError(parsed.error),
                    },
                    { status: 400 }
                );
            }

            const { email, username, password, name, companyId } = parsed.data;

            // ── Step 2: Server-side password strength check ─────────────────
            const strength = validatePasswordStrength(password);
            if (!strength.valid) {
                return NextResponse.json(
                    { error: 'Validation failed', message: strength.message },
                    { status: 400 }
                );
            }

            // ── Step 3: Verify company exists ───────────────────────────────
            const company = await prisma.company.findUnique({
                where: { id: companyId },
            });

            if (!company || !company.isActive) {
                return NextResponse.json(
                    { error: 'Validation failed', message: 'Invalid or inactive company' },
                    { status: 400 }
                );
            }

            // ── Step 4: Check uniqueness within company ─────────────────────
            const existingUser = await prisma.user.findFirst({
                where: {
                    companyId,
                    OR: [
                        { email: email.toLowerCase() },
                        { username: username.toLowerCase() },
                    ],
                },
            });

            if (existingUser) {
                return NextResponse.json(
                    { error: 'Conflict', message: 'A user with this email or username already exists in this company' },
                    { status: 409 }
                );
            }

            // ── Step 5: Create user ─────────────────────────────────────────
            const hashedPassword = await hashPassword(password);
            const user = await prisma.user.create({
                data: {
                    companyId,
                    email: email.toLowerCase(),
                    username: username.toLowerCase(),
                    name,
                    password: hashedPassword,
                    role: 'SALES_EXECUTIVE', // Default role
                },
                select: {
                    id: true,
                    username: true,
                    name: true,
                    email: true,
                    role: true,
                    companyId: true,
                },
            });

            return NextResponse.json(
                {
                    success: true,
                    message: 'User created successfully',
                    user,
                },
                { status: 201 }
            );
        } catch (error) {
            logger.error('Signup route error:', error);
            return NextResponse.json(
                { error: 'Internal server error', message: 'An unexpected error occurred' },
                { status: 500 }
            );
        }

    });
}
