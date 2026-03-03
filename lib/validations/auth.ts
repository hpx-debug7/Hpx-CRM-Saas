/**
 * Shared Zod Validation Schemas for Authentication
 *
 * Used by both API routes (/api/auth/login, /api/auth/signup)
 * and the server action (loginAction).
 */

import { z } from 'zod';

// ============================================================================
// LOGIN SCHEMA
// ============================================================================

export const loginSchema = z.object({
    email: z
        .string({ required_error: 'Email is required' })
        .min(1, 'Email is required')
        .email('Invalid email format')
        .max(255, 'Email must not exceed 255 characters'),
    password: z
        .string({ required_error: 'Password is required' })
        .min(1, 'Password is required')
        .max(128, 'Password must not exceed 128 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ============================================================================
// SIGNUP SCHEMA
// ============================================================================

export const signupSchema = z.object({
    email: z
        .string({ required_error: 'Email is required' })
        .min(1, 'Email is required')
        .email('Invalid email format')
        .max(255, 'Email must not exceed 255 characters'),
    username: z
        .string({ required_error: 'Username is required' })
        .min(3, 'Username must be at least 3 characters')
        .max(50, 'Username must not exceed 50 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, underscores, and hyphens'),
    password: z
        .string({ required_error: 'Password is required' })
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must not exceed 128 characters'),
    name: z
        .string({ required_error: 'Name is required' })
        .min(1, 'Name is required')
        .max(100, 'Name must not exceed 100 characters'),
    companyId: z
        .string({ required_error: 'Company ID is required' })
        .min(1, 'Company ID is required'),
});

export type SignupInput = z.infer<typeof signupSchema>;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract a safe, human-readable error message from Zod validation issues.
 * Never leaks internal Zod structure to the client.
 */
export function formatValidationError(error: z.ZodError): string {
    return error.issues.map((issue) => issue.message).join('; ');
}
