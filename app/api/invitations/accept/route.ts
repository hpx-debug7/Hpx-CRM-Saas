import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@/lib/server/db';
import { hashPassword } from '@/lib/server/auth';
import { withApiLogging } from '@/lib/apiLogger';
import { safeAuditLog } from '@/src/lib/auditLogger';
import { ValidationError, NotFoundError, ApiError } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Zod schema ─────────────────────────────────────────────────────────────────
const acceptInviteSchema = z.object({
    token: z.string().length(64, { message: 'Token must be exactly 64 characters' }).regex(/^[0-9a-f]{64}$/, { message: 'Invalid token format' }),
    password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
    name: z.string().trim().min(1, { message: 'Name is required' }),
});

// ── POST /api/invitations/accept ─────────────────────────────────────────────

async function acceptHandler(request: NextRequest) {
    // ── Step 1: Parse & Validate Body ─────────────────────────────────────
    let rawBody: unknown;
    try {
        rawBody = await request.json();
    } catch {
        throw new ValidationError('Request body must be valid JSON');
    }

    const parsed = acceptInviteSchema.safeParse(rawBody);
    if (!parsed.success) {
        const message = parsed.error.issues.map((e) => e.message).join('; ');
        throw new ValidationError(message);
    }

    const { token, password, name } = parsed.data;

    // ── Step 2: Fetch Invitation (Pre-transaction) ─────────────────────────
    const invitation = await prisma.invitation.findFirst({
        where: {
            token,
            status: 'PENDING',
        },
    });

    if (!invitation) {
        throw new NotFoundError('Invitation not found or already accepted');
    }

    // ── Step 3: Expiry Check ────────────────────────────────────────────────
    if (invitation.expiresAt < new Date()) {
        return NextResponse.json(
            {
                error: 'Bad Request',
                message: 'Invitation has expired',
            },
            { status: 400 },
        );
    }

    const normalizedEmail = invitation.email.toLowerCase().trim();

    // ── Step 4: Execute Interactive Transaction ───────────────────────────
    try {
        let finalUserId: string;

        await prisma.$transaction(async (tx) => {
            // A. Find or Create User
            let user = await tx.user.findFirst({
                where: { email: normalizedEmail },
            });

            if (user) {
                // Verify email consistency
                if (user.email.toLowerCase() !== normalizedEmail) {
                    throw new ApiError('Security violation: Email mismatch', 400, 'BAD_REQUEST');
                }

                // Password logic: do NOT overwrite if it exists
                // Note: The User model has a password field which is required in schema, 
                // but we check if we should "set" it if it's somehow empty or if we want to support passwordless users transitioning.
                // However, since schema says password is required, we check if we should update it.
                // For now, following the instruction: "If user already has a password → DO NOT overwrite"
                // Usually this means if it's a new system user who hasn't set one yet.
                if (!user.password) {
                    const hashedPassword = await hashPassword(password);
                    await tx.user.update({
                        where: { id: user.id },
                        data: { password: hashedPassword },
                    });
                }
                finalUserId = user.id;
            } else {
                // Create New User
                const hashedPassword = await hashPassword(password);
                const usernamePrefix = normalizedEmail.split('@')[0];
                const randomHex = crypto.randomBytes(2).toString('hex');
                const username = `${usernamePrefix}_${randomHex}`;

                const newUser = await tx.user.create({
                    data: {
                        email: normalizedEmail,
                        name: name,
                        username: username,
                        password: hashedPassword,
                        companyId: invitation.companyId, // Primary company
                        isActive: true,
                        role: 'SALES_EXECUTIVE', // Default app role, membership will define company role
                    },
                });
                finalUserId = newUser.id;
            }

            // B. Check & Create Membership
            const existingMembership = await tx.companyMembership.findUnique({
                where: {
                    userId_companyId: {
                        userId: finalUserId,
                        companyId: invitation.companyId,
                    },
                },
            });

            if (existingMembership) {
                throw new ApiError('User is already a member of this company', 409, 'CONFLICT');
            }

            await tx.companyMembership.create({
                data: {
                    userId: finalUserId,
                    companyId: invitation.companyId,
                    role: invitation.role,
                },
            });

            // C. Final Step: Finalize Invitation (Race-condition safe)
            const result = await tx.invitation.updateMany({
                where: {
                    id: invitation.id,
                    status: 'PENDING',
                },
                data: {
                    status: 'ACCEPTED',
                    acceptedAt: new Date(),
                },
            });

            if (result.count === 0) {
                throw new Error('Invitation already accepted or invalid');
            }
        });

        // ── Step 5: Audit Log (Outside Transaction) ─────────────────────────
        safeAuditLog({
            companyId: invitation.companyId,
            actionType: 'USER_JOINED_COMPANY',
            entityType: 'User',
            entityId: finalUserId!,
            description: 'User accepted invitation and joined company',
            metadata: {
                invitationId: invitation.id,
                email: normalizedEmail,
                role: invitation.role,
            },
        });

        return NextResponse.json(
            {
                success: true,
            },
            { status: 200 },
        );
    } catch (error: any) {
        if (error instanceof ApiError) throw error;
        
        // Handle the "Invitation already accepted or invalid" error from updateMany
        if (error.message === 'Invitation already accepted or invalid') {
            return NextResponse.json(
                {
                    error: 'Bad Request',
                    message: error.message,
                },
                { status: 400 },
            );
        }

        console.error('[INVITATION_ACCEPT_ERROR]', error);
        throw new Error('An unexpected error occurred during invitation acceptance');
    }
}

export async function POST(req: NextRequest): Promise<Response> {
    return withApiLogging(req, async () => acceptHandler(req));
}
