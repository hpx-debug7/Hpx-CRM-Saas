'use server';

import { NextRequest, NextResponse } from 'next/server';
import { getValidatedSession } from './auth';

/**
 * SECURE HANDLER WRAPPER
 *
 * Enforces runtime multi-tenant isolation for all API routes.
 * This wrapper automatically:
 * 1. Validates user session with strict verification
 * 2. Injects userId, role, and companyId into handler context
 * 3. Rejects unauthorized requests with proper error codes
 * 4. Prevents tenant data leakage
 *
 * Usage:
 *   export const POST = secureHandler(
 *     async (req, { userId, role, companyId }) => {
 *       // Your route handler code
 *       // companyId is guaranteed to be the user's company
 *     },
 *     { requiredRoles: ['ADMIN'] } // optional
 *   );
 */

export interface SecureHandlerContext {
    userId: string;
    role: string;
    companyId: string;
    sessionId: string;
}

export interface SecureHandlerOptions {
    requiredRoles?: string[];
    methods?: string[];
}

/**
 * Higher-order function that wraps API route handlers with security enforcement.
 * Automatically validates session and tenant isolation.
 */
export function secureHandler<T extends NextRequest>(
    handler: (
        req: T,
        context: SecureHandlerContext,
    ) => Promise<NextResponse | Response>,
    options?: SecureHandlerOptions,
) {
    return async (req: T): Promise<NextResponse | Response> => {
        try {
            // Validate HTTP method if specified
            if (options?.methods && !options.methods.includes(req.method)) {
                return NextResponse.json(
                    { error: 'Method not allowed' },
                    { status: 405 },
                );
            }

            // Get and validate session with strict multi-tenant verification
            let session: SecureHandlerContext;
            try {
                session = await getValidatedSession();
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unauthorized';
                console.warn(`[SECURITY] Session validation failed: ${message}`);
                return NextResponse.json(
                    { error: message },
                    { status: 401 },
                );
            }

            // Check required roles if specified
            if (options?.requiredRoles && !options.requiredRoles.includes(session.role)) {
                console.warn(
                    `[SECURITY] User "${session.userId}" attempted to access endpoint requiring roles [${options.requiredRoles.join(', ')}]`,
                );
                return NextResponse.json(
                    { error: 'Forbidden: Insufficient permissions' },
                    { status: 403 },
                );
            }

            // Call handler with validated context
            // Handler MUST use session.companyId to scope all queries
            return await handler(req, session);
        } catch (error) {
            console.error('[SECURITY] Secure handler error:', error);
            return NextResponse.json(
                { error: 'Internal server error' },
                { status: 500 },
            );
        }
    };
}

/**
 * TYPE-SAFE VARIANT: Use this for typed endpoint handlers
 *
 * Example:
 *   type MyRequest = NextRequest & { custom?: string };
 *   export const GET = secureHandlerTyped<MyRequest>(
 *     async (req, { userId, companyId }) => {
 *       // Your code here
 *     }
 *   );
 */
export function secureHandlerTyped<Req extends NextRequest = NextRequest>(
    handler: (req: Req, context: SecureHandlerContext) => Promise<NextResponse | Response>,
    options?: SecureHandlerOptions,
) {
    return secureHandler(handler as any, options);
}
