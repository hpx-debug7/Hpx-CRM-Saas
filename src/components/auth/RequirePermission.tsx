"use client";

import React from "react";
import { usePermission } from "@/src/lib/auth/usePermission";
import { Permission } from "@/src/lib/auth/permissions";

interface RequirePermissionProps {
  permission: Permission;
  children: React.ReactNode;
}

/**
 * UI-only guard for conditional rendering.
 * Does NOT provide security. Real security is handled by backend.
 */
export function RequirePermission({ permission, children }: RequirePermissionProps) {
  const allowed = usePermission(permission);

  if (!allowed) return null;

  return <>{children}</>;
}
