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
        .string({ message: 'Email or Username is required' })
        .min(1, { message: 'Email or Username is required' })
        .max(255, { message: 'Input must not exceed 255 characters' }),
    password: z
        .string({ message: 'Password is required' })
        .min(1, { message: 'Password is required' })
        .max(128, { message: 'Password must not exceed 128 characters' }),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ============================================================================
// SIGNUP SCHEMA
// ============================================================================

export const signupSchema = z.object({
    email: z
        .string({ message: 'Email is required' })
        .min(1, { message: 'Email is required' })
        .email({ message: 'Invalid email format' })
        .max(255, { message: 'Email must not exceed 255 characters' }),
    username: z
        .string({ message: 'Username is required' })
        .min(3, { message: 'Username must be at least 3 characters' })
        .max(50, { message: 'Username must not exceed 50 characters' })
        .regex(/^[a-zA-Z0-9_-]+$/, { message: 'Username may only contain letters, numbers, underscores, and hyphens' }),
    password: z
        .string({ message: 'Password is required' })
        .min(8, { message: 'Password must be at least 8 characters' })
        .max(128, { message: 'Password must not exceed 128 characters' }),
    name: z
        .string({ message: 'Name is required' })
        .min(1, { message: 'Name is required' })
        .max(100, { message: 'Name must not exceed 100 characters' }),
    companyId: z
        .string({ message: 'Company ID is required' })
        .min(1, { message: 'Company ID is required' }),
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
