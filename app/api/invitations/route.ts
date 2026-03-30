import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@/lib/server/db';
import { secureHandler } from '@/lib/server/secureHandler';
import { withApiLogging } from '@/lib/apiLogger';
import { safeAuditLog } from '@/src/lib/auditLogger';
import { ValidationError, ForbiddenError } from '@/lib/errors';
import { PERMISSIONS } from '@/lib/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Zod schema ─────────────────────────────────────────────────────────────────
// Role is intentionally limited to ADMIN | MEMBER — owners cannot be invited,
// they are created directly during company onboarding.

const inviteBodySchema = z.object({
    email: z.string().email({ message: 'A valid email address is required' }),
    role: z.enum(['ADMIN', 'MEMBER'], {
        message: 'role must be one of: ADMIN, MEMBER',
    }),
});

// ── POST /api/invitations ────────────────────────────────────────────────────

const inviteHandler = secureHandler(
    async (request: NextRequest, { userId, companyId, role, sessionId }) => {


        // ── Step 1: Parse JSON body ─────────────────────────────────────────
        let rawBody: unknown;
        try {
            rawBody = await request.json();
        } catch {
            throw new ValidationError('Request body must be valid JSON');
        }

        // ── Step 2: Zod validation ──────────────────────────────────────────
        const parsed = inviteBodySchema.safeParse(rawBody);
        if (!parsed.success) {
            const message = parsed.error.issues.map((e) => e.message).join('; ');
            throw new ValidationError(message);
        }

        const { email, role: inviteRole } = parsed.data;
        const normalizedEmail = email.toLowerCase().trim();

        // ── Step 3: Duplicate active-invite guard ───────────────────────────
        const existingInvite = await prisma.invitation.findFirst({
            where: {
                email: normalizedEmail,
                companyId,
                status: 'PENDING',
            },
            select: { id: true },
        });

        if (existingInvite) {
            return NextResponse.json(
                {
                    error: 'Conflict',
                    message: 'An active invitation for this email already exists',
                },
                { status: 409 },
            );
        }

        // ── Step 4: Generate secure token (32 bytes → 64 hex chars) ────────
        const token = crypto.randomBytes(32).toString('hex');

        // ── Step 5: Set 48-hour expiry ──────────────────────────────────────
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

        // ── Step 6: Persist invitation ──────────────────────────────────────
        const invitation = await prisma.invitation.create({
            data: {
                email: normalizedEmail,
                token,
                companyId,          // sourced from verified session — never from body
                role: inviteRole,
                invitedById: userId,
                status: 'PENDING',
                expiresAt,
            },
            select: { id: true, expiresAt: true },
        });

        // ── Step 7: Audit log (fire-and-forget, non-blocking) ───────────────
        safeAuditLog({
            companyId,
            actionType: 'USER_INVITED',
            entityType: 'Invitation',
            entityId: invitation.id,
            description: 'User invited via email',
            performedById: userId,
            sessionId,
            afterValue: {
                invitationId: invitation.id,
                email: normalizedEmail,
                role: inviteRole,
            },
        });

        // ── Step 8: Respond ─────────────────────────────────────────────────
        return NextResponse.json(
            {
                success: true,
                invitationId: invitation.id,
                expiresAt: invitation.expiresAt.toISOString(),
            },
            { status: 201 },
        );
    },
    { requiredPermission: PERMISSIONS.INVITE_USER }
);


export async function POST(req: NextRequest): Promise<Response> {
    return withApiLogging(req, async () => inviteHandler(req));
}
