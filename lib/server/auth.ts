import { logger } from '@/lib/server/logger';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from './db';
import { getEnv } from './env';
const env = getEnv();

// ============================================================================
// CONSTANTS
// ============================================================================

const BCRYPT_SALT_ROUNDS = 12;
const SESSION_COOKIE_NAME = 'session_token';
const SESSION_EXPIRY_DAYS = 7;

// JWT_SECRET validation is enforced by lib/env.ts at import time
const JWT_SECRET = env.JWT_SECRET;

// ============================================================================
// PASSWORD UTILITIES
// ============================================================================

/**
 * Hash a password using bcrypt with a salt.
 */
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

/**
 * Validate password strength.
 */
export function validatePasswordStrength(password: string): { valid: boolean; message: string } {
    if (password.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one number' };
    }
    if (!/[!@#$%^&*]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one special character (!@#$%^&*)' };
    }
    return { valid: true, message: 'Password meets requirements' };
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Generate a secure session token using JWT with multi-tenant support.
 */
export async function generateSessionToken(userId: string, role: string, companyId: string): Promise<string> {
    const secret = new TextEncoder().encode(JWT_SECRET);

    const token = await new SignJWT({ userId, role, companyId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_EXPIRY_DAYS}d`)
        .sign(secret);

    return token;
}

/**
 * Verify and decode a session token.
 * ✅ FIXED: Now validates all claims properly
 */
export async function verifySessionToken(token: string): Promise<{ userId: string; role: string; companyId: string } | null> {
    try {
        const secret = new TextEncoder().encode(JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);

        // ✅ NEW: Validate all required claims are present and correct type
        const userId = payload.userId;
        const role = payload.role;
        const companyId = payload.companyId;

        // Validate userId
        if (!userId || typeof userId !== 'string') {
            return null;  // Invalid userId claim
        }

        // ✅ NEW: Validate role claim (this was missing before!)
        if (!role || typeof role !== 'string') {
            return null;  // Invalid role claim
        }

        // Validate companyId
        if (!companyId || typeof companyId !== 'string') {
            return null;  // Invalid companyId claim
        }

        return {
            userId,
            role,
            companyId,
        };
    } catch {
        return null;
    }
}

/**
 * Create a new session in the database and set the cookie.
 */
export async function createSession(userId: string, role: string, companyId: string, userAgent?: string, ipAddress?: string): Promise<string> {
    const token = await generateSessionToken(userId, role, companyId);
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Store session in database
    await prisma.session.create({
        data: {
            userId,
            companyId,
            token,
            userAgent,
            ipAddress,
            expiresAt,
        },
    });

    // Set HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: expiresAt,
        path: '/',
    });

    return token;
}

/**
 * Get the current session from the cookie and validate it.
 */
export async function getSession(): Promise<{
    userId: string;
    role: string;
    companyId: string;
    sessionId: string;
} | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
        return null;
    }

    // Verify JWT
    const decoded = await verifySessionToken(token);
    if (!decoded) {
        return null;
    }

    // Check if session exists and is valid in database
    const session = await prisma.session.findUnique({
        where: { token },
        include: { user: true },
    });

    if (!session || !session.isValid || session.expiresAt < new Date()) {
        return null;
    }

    // Update last activity
    await prisma.session.update({
        where: { id: session.id },
        data: { lastActivityAt: new Date() },
    });

    return {
        userId: session.userId,
        role: session.user.role,
        companyId: session.companyId,
        sessionId: session.id,
    };
}

/**
 * STRICT MULTI-TENANT VALIDATION: Get validated session with full verification.
 * This function enforces strict tenant isolation:
 * 1. Verifies JWT signature
 * 2. Extracts companyId from JWT
 * 3. Validates session exists in database
 * 4. Verifies session.userId matches JWT
 * 5. Verifies session.companyId matches JWT
 * 6. Checks session.isValid and expiration
 * 7. Verifies user is active and belongs to company
 * 8. ✅ NEW: Verifies user role hasn't changed (privilege escalation prevention)
 *
 * @throws Error if validation fails
 * @returns Validated session with userId, role, companyId
 */
export async function getValidatedSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
        throw new Error('Unauthorized: No session token provided');
    }

    // STEP 1: Verify JWT signature and extract claims
    const decoded = await verifySessionToken(token);
    if (!decoded || !decoded.userId || !decoded.companyId) {
        throw new Error('Unauthorized: Invalid or malformed token');
    }

    const { userId: jwtUserId, role: jwtRole, companyId: jwtCompanyId } = decoded;

    // STEP 2-6: Validate session from database
    const dbSession = await prisma.session.findUnique({
        where: { token },
        include: { user: true },
    });

    if (!dbSession) {
        throw new Error('Unauthorized: Session not found in database');
    }

    if (!dbSession.isValid) {
        throw new Error('Unauthorized: Session has been invalidated');
    }

    if (dbSession.expiresAt < new Date()) {
        throw new Error('Unauthorized: Session has expired');
    }

    // CRITICAL: Verify JWT claims match database session
    if (dbSession.userId !== jwtUserId) {
        throw new Error('Unauthorized: User ID mismatch');
    }

    if (dbSession.companyId !== jwtCompanyId) {
        throw new Error('Unauthorized: Company ID mismatch');
    }

    // STEP 7: Verify user is still active and belongs to correct company
    if (!dbSession.user || !dbSession.user.isActive) {
        throw new Error('Unauthorized: User is inactive');
    }

    if (dbSession.user.companyId !== jwtCompanyId) {
        throw new Error('Unauthorized: User does not belong to this company');
    }

    // ✅ NEW STEP 8: CRITICAL - Verify user role hasn't changed since token was issued
    // This prevents privilege escalation windows where:
    // 1. User logs in with role="USER"
    // 2. Admin upgrades user to role="ADMIN"
    // 3. Old JWT still has role="USER", but we'd return "ADMIN" from database
    // Solution: Verify roles match, if not, invalidate session and reject
    if (dbSession.user.role !== jwtRole) {
        // Role has changed - user must re-authenticate with new role
        logger.warn(
            `[SECURITY] User ${dbSession.userId} role mismatch: JWT has "${jwtRole}" but user now has "${dbSession.user.role}". ` +
            'Invalidating session to prevent privilege escalation.'
        );

        // Invalidate the session immediately
        await prisma.session.update({
            where: { id: dbSession.id },
            data: { isValid: false },
        });

        throw new Error('Unauthorized: User role changed - please log in again');
    }

    // Update last activity
    await prisma.session.update({
        where: { id: dbSession.id },
        data: { lastActivityAt: new Date() },
    });

    return {
        userId: dbSession.userId,
        role: dbSession.user.role,
        companyId: dbSession.companyId,
        sessionId: dbSession.id,
    };
}

/**
 * Invalidate the current session (logout).
 */
export async function invalidateSession(): Promise<void> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
        // Mark session as invalid in database
        await prisma.session.updateMany({
            where: { token },
            data: { isValid: false },
        });

        // Remove cookie
        cookieStore.delete(SESSION_COOKIE_NAME);
    }
}

/**
 * Rotate session token (for security after privilege changes).
 */
export async function rotateSessionToken(userId: string): Promise<void> {
    const cookieStore = await cookies();
    const oldToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (oldToken) {
        // Get user to get role and companyId
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user) {
            // Invalidate old session
            await prisma.session.updateMany({
                where: { token: oldToken },
                data: { isValid: false },
            });

            // Create new session
            await createSession(userId, user.role, user.companyId);
        }
    }
}

// ============================================================================
// ACCOUNT LOCKOUT
// ============================================================================

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MINUTES = 15;

/**
 * Check if a user account is locked.
 */
export async function isAccountLocked(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.lockedUntil) {
        return false;
    }

    if (user.lockedUntil < new Date()) {
        // Lockout expired, reset
        await prisma.user.update({
            where: { id: userId },
            data: { lockedUntil: null, failedLoginAttempts: 0 },
        });
        return false;
    }

    return true;
}

/**
 * Record a failed login attempt.
 */
export async function recordFailedLoginAttempt(userId: string): Promise<void> {
    // Atomic increment to prevent race conditions under concurrent requests
    const updated = await prisma.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: { increment: 1 } },
    });

    if (updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        await prisma.user.update({
            where: { id: userId },
            data: {
                lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000),
            },
        });
    }
}

/**
 * Reset failed login attempts on successful login.
 */
export async function resetFailedLoginAttempts(userId: string): Promise<void> {
    await prisma.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
}
