

import { logger } from '@/lib/server/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getValidatedSession } from './auth';
import { prisma, scopedPrisma } from '@/lib/server/db';
import { ApiError } from '@/lib/errors';
import { Permission as LegacyPermission } from '@/src/lib/auth/permissions';
import { hasPermission as legacyHasPermission } from '@/src/lib/auth/permissionChecker';
import { Role } from '@/src/lib/auth/rolePermissions';
import { hasPermission } from '@/lib/permissionChecker';
import { Permission } from '@/lib/permissions';

/**
 * SECURE HANDLER WRAPPER
 *
 * Enforces runtime multi-tenant isolation and strict RBAC for all API routes.
 * This wrapper automatically:
 * 1. Validates user session 
 * 2. Fetches company membership from the DB (Source of Truth)
 * 3. Enforces tenant validation
 * 4. Checks required permissions against the DB-enforced role
 * 5. Injects user context (with DB-resolved role) to the handler
 * 
 * SECURITY NOTE:
 * - DO NOT use session.role for authorization
 * - ALWAYS use membership.role fetched from database
 * - All queries must use scopedPrisma for tenant isolation
 */

export interface SecureHandlerContext {
    userId: string;
    role: string;
    companyId: string;
    sessionId: string;
}

export interface SecureHandlerOptions {
    requiredRoles?: string[];
    permission?: LegacyPermission;
    requiredPermission?: Permission;
    allowWithoutPermission?: boolean;
    methods?: string[];
}

/**
 * Higher-order function that wraps API route handlers with security enforcement.
 */
export function secureHandler<T extends NextRequest>(
    handler: (
        req: T,
        context: SecureHandlerContext & { params?: any },
    ) => Promise<NextResponse | Response>,
    options?: SecureHandlerOptions,
) {
    return async (req: T, nextContext?: { params?: any }): Promise<NextResponse | Response> => {
        try {
            // Validate HTTP method if specified
            if (options?.methods && !options.methods.includes(req.method)) {
                return NextResponse.json(
                    { error: 'Method not allowed' },
                    { status: 405 },
                );
            }

            // Get session
            let session: SecureHandlerContext;
            try {
                session = await getValidatedSession();
            } catch (error) {
                logger.warn(`[SECURITY] Session validation failed`);
                throw new ApiError("Forbidden", 403, "FORBIDDEN");
            }

            // 1) Validate tenant context
            if (!session.companyId) {
                logger.warn(`[SECURITY] Missing companyId in session for user ${session.userId}`);
                throw new ApiError("Forbidden", 403, "FORBIDDEN");
            }

            // 2) Fetch membership from DB using scopedPrisma (SOURCE OF TRUTH)
            const db = scopedPrisma(session.companyId);
            const membership = await db.companyMembership.findUnique({
                where: {
                    userId_companyId: {
                        userId: session.userId,
                        companyId: session.companyId,
                    },
                },
            });

            // 3) Handle missing membership (No membership = no access)
            if (!membership) {
                logger.warn(`[SECURITY] No membership found for user ${session.userId} in company ${session.companyId}`);
                throw new ApiError("Forbidden", 403, "FORBIDDEN");
            }

            // 4) Use DB role (NOT JWT)
            const dbRole = membership.role as Role;

            // Optional: fallback requiredRoles check for legacy routes
            if (options?.requiredRoles && !options.requiredRoles.includes(dbRole)) {
                logger.warn(
                    `[SECURITY] User "${session.userId}" attempted to access endpoint requiring roles [${options.requiredRoles.join(', ')}]`,
                );
                throw new ApiError("Forbidden", 403, "FORBIDDEN");
            }

            // 5) Check permission BEFORE handler
            if (
                !options?.requiredPermission &&
                !options?.permission &&
                !options?.requiredRoles &&
                !options?.allowWithoutPermission
            ) {
                throw new ApiError(
                    "Permission not defined for protected route",
                    500,
                    "MISSING_PERMISSION_CONFIG"
                );
            }

            if (options?.permission) {
                if (!legacyHasPermission(dbRole, options.permission)) {
                    logger.warn(`[SECURITY] User "${session.userId}" missing permission "${options.permission}"`);
                    throw new ApiError("Forbidden", 403, "FORBIDDEN");
                }
            }

            if (options?.requiredPermission) {
                const allowed = hasPermission(
                    membership.role,
                    options.requiredPermission
                );

                if (!allowed) {
                    throw new ApiError("Forbidden", 403, "FORBIDDEN");
                }
            }

            // 6) Pass resolved role forward
            return await handler(req, {
                ...session,
                role: membership.role,
                ...(nextContext?.params ? { params: nextContext.params } : {})
            });

        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            logger.error('[SECURITY] Secure handler error:', error);
            return NextResponse.json(
                { error: 'Internal server error' },
                { status: 500 },
            );
        }
    };
}

export function secureHandlerTyped<Req extends NextRequest = NextRequest>(
    handler: (req: Req, context: SecureHandlerContext & { params?: any }, nextContext?: any) => Promise<NextResponse | Response>,
    options?: SecureHandlerOptions,
) {
    return secureHandler(handler as any, options);
}

