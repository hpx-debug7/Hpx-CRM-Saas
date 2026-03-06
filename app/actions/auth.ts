'use server';


import { logger } from '@/lib/server/logger';
import { prisma } from '@/lib/server/db';
import {
    hashPassword,
    verifyPassword,
    createSession,
    invalidateSession,
    getSession,
    isAccountLocked,
    recordFailedLoginAttempt,
    resetFailedLoginAttempts,
    validatePasswordStrength,
} from '@/lib/server/auth';
import { addServerAuditLog } from './audit';
import { headers } from 'next/headers';
import { loginSchema, formatValidationError } from '@/lib/shared/validations/auth';

// ============================================================================
// AUTH SERVER ACTIONS
// ============================================================================

export interface AuthResult {
    success: boolean;
    message: string;
    user?: {
        userId: string;
        username: string;
        name: string;
        email: string;
        role: string;
        stickyLeadTableHeader: boolean;
        rolePresetId: string | null;
        customPermissions: string | null;
    };
}

/**
 * Server action to log in a user.
 */
export async function loginAction(identifier: string, password: string): Promise<AuthResult> {
    try {
        // ✅ Zod validation BEFORE any DB access, password check, or failedAttempts
        const parsed = loginSchema.safeParse({ identifier, password });
        if (!parsed.success) {
            return {
                success: false,
                message: formatValidationError(parsed.error),
            };
        }

        const headersList = await headers();
        const userAgent = headersList.get('user-agent') || undefined;
        const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || undefined;

        // ✅ FIXED: Find user by email or username (globally unique across company)
        let user;
        try {
            const lowerIdentifier = identifier.toLowerCase();
            user = await prisma.user.findFirstOrThrow({
                where: {
                    OR: [
                        { email: lowerIdentifier },
                        { username: { equals: lowerIdentifier, mode: 'insensitive' } }
                    ],
                    isActive: true,
                },
                include: { company: true },
            });
        } catch {
            // User not found or inactive
            user = null;
        }

        if (!user) {
            await addServerAuditLog({
                actionType: 'USER_LOGIN_FAILED',
                entityType: 'user',
                description: `Failed login attempt for identifier "${identifier}" - User not found or account inactive`,
                ipAddress,
                userAgent,
                metadata: { reason: 'user_not_found', attemptedIdentifier: identifier },
            });
            return { success: false, message: 'Invalid identifier or password' };
        }

        // Check if account is locked
        if (await isAccountLocked(user.id)) {
            await addServerAuditLog({
                actionType: 'USER_LOGIN_FAILED',
                entityType: 'user',
                entityId: user.id,
                performedById: user.id,
                performedByName: user.name,
                description: `Failed login attempt for "${user.name}" - Account locked`,
                ipAddress,
                userAgent,
                metadata: { reason: 'account_locked' },
            });
            return { success: false, message: 'Account is locked due to too many failed attempts. Please try again later.' };
        }

        // Verify password
        const isValid = await verifyPassword(password, user.password);
        if (!isValid) {
            await recordFailedLoginAttempt(user.id);
            await addServerAuditLog({
                actionType: 'USER_LOGIN_FAILED',
                entityType: 'user',
                entityId: user.id,
                performedById: user.id,
                performedByName: user.name,
                description: `Failed login attempt for "${user.name}" - Invalid password`,
                ipAddress,
                userAgent,
                metadata: { reason: 'invalid_password' },
            });
            return { success: false, message: 'Invalid email or password' };
        }

        // ✅ FIXED: Now we know the company! Create session with companyId
        await resetFailedLoginAttempts(user.id);
        await createSession(user.id, user.role, user.companyId, userAgent, ipAddress);

        // Log successful login
        await addServerAuditLog({
            actionType: 'USER_LOGIN',
            entityType: 'user',
            entityId: user.id,
            performedById: user.id,
            performedByName: user.name,
            description: `User "${user.name}" logged in successfully`,
            ipAddress,
            userAgent,
            metadata: { role: user.role, loginMethod: 'password', companyId: user.companyId },
        });

        return {
            success: true,
            message: 'Login successful',
            user: {
                userId: user.id,
                username: user.username,
                name: user.name,
                email: user.email,
                role: user.role,
                stickyLeadTableHeader: user.stickyLeadTableHeader,
                rolePresetId: user.rolePresetId,
                customPermissions: user.customPermissions,
            },
        };
    } catch (error) {
        logger.error('Login error:', error);
        return { success: false, message: 'An error occurred during login' };
    }
}

/**
 * Server action to log out the current user.
 */
export async function logoutAction(): Promise<{ success: boolean }> {
    try {
        const session = await getSession();

        if (session) {
            const user = await prisma.user.findUnique({ where: { id: session.userId } });
            const headersList = await headers();

            await addServerAuditLog({
                actionType: 'USER_LOGOUT',
                entityType: 'user',
                entityId: session.userId,
                performedById: session.userId,
                performedByName: user?.name || 'Unknown',
                description: `User "${user?.name || 'Unknown'}" logged out`,
                sessionId: session.sessionId,
                ipAddress: headersList.get('x-forwarded-for') || undefined,
                userAgent: headersList.get('user-agent') || undefined,
            });
        }

        await invalidateSession();
        return { success: true };
    } catch (error) {
        logger.error('Logout error:', error);
        return { success: false };
    }
}

/**
 * Server action to get the current authenticated user.
 */
export async function getCurrentUser(): Promise<AuthResult['user'] | null> {
    try {
        const session = await getSession();
        if (!session) {
            return null;
        }

        const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: {
                id: true,
                username: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                stickyLeadTableHeader: true,
                rolePresetId: true,
                customPermissions: true,
            },
        });

        if (!user || !user.isActive) {
            return null;
        }

        return {
            userId: user.id,
            username: user.username,
            name: user.name,
            email: user.email,
            role: user.role,
            stickyLeadTableHeader: user.stickyLeadTableHeader,
            rolePresetId: user.rolePresetId,
            customPermissions: user.customPermissions,
        };
    } catch (error) {
        logger.error('Get current user error:', error);
        return null;
    }
}

/**
 * Check if the current user has any of the specified roles.
 */
export async function checkRole(allowedRoles: string[]): Promise<boolean> {
    const session = await getSession();
    if (!session) {
        return false;
    }
    return allowedRoles.includes(session.role);
}

/**
 * Require authentication - throws if not authenticated.
 */
export async function requireAuth(): Promise<{ userId: string; role: string; companyId: string; sessionId: string }> {
    const session = await getSession();
    if (!session) {
        throw new Error('Unauthorized: You must be logged in to perform this action');
    }
    return session;
}

/**
 * Require specific role - throws if not authorized.
 */
export async function requireRole(allowedRoles: string[]): Promise<{ userId: string; role: string; companyId: string; sessionId: string }> {
    const session = await requireAuth();
    if (!allowedRoles.includes(session.role)) {
        throw new Error('Forbidden: You do not have permission to perform this action');
    }
    return session;
}

// ============================================================================
// PASSWORD CHANGE (SELF-SERVICE)
// ============================================================================

export async function changeOwnPasswordAction(
    currentPassword: string,
    newPassword: string
): Promise<{ success: boolean; message: string }> {
    try {
        const session = await requireAuth();

        const user = await prisma.user.findUnique({ where: { id: session.userId } });
        if (!user) {
            return { success: false, message: 'User not found' };
        }

        const isValid = await verifyPassword(currentPassword, user.password);
        if (!isValid) {
            return { success: false, message: 'Current password is incorrect' };
        }

        const strength = validatePasswordStrength(newPassword);
        if (!strength.valid) {
            return { success: false, message: strength.message };
        }

        const hashedPassword = await hashPassword(newPassword);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                passwordLastChangedAt: new Date(),
                failedLoginAttempts: 0,
                lockedUntil: null,
            },
        });

        await addServerAuditLog({
            actionType: 'USER_PASSWORD_CHANGED',
            entityType: 'user',
            entityId: user.id,
            performedById: user.id,
            performedByName: user.name,
            description: `User "${user.name}" changed their password`,
        });

        return { success: true, message: 'Password changed successfully' };
    } catch (error) {
        logger.error('Change password error:', error);
        return { success: false, message: 'Failed to change password' };
    }
}
