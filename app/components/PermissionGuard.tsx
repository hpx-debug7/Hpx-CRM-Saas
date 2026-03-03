'use client';

import React, { ReactNode } from 'react';
import { PermissionKey } from '../utils/permissions';
import { usePermission } from '../hooks/usePermission';

// ============================================================================
// PERMISSION GUARD COMPONENT
// ============================================================================

interface PermissionGuardProps {
    permission: PermissionKey;
    children: ReactNode;
    fallback?: ReactNode;
}

/**
 * Declarative permission guard that renders children only if the current user
 * has the specified permission. Mirrors RoleGuard's structure.
 */
export default function PermissionGuard({ permission, children, fallback = null }: PermissionGuardProps) {
    const allowed = usePermission(permission);

    if (!allowed) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

/**
 * Programmatic permission check hook (re-exported for convenience).
 */
export function usePermissionCheck(key: PermissionKey): boolean {
    return usePermission(key);
}
