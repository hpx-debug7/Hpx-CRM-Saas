import { ROLE_PERMISSIONS, Role } from "./rolePermissions";
import { Permission } from "./permissions";
import { ApiError } from "@/lib/errors";

export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] ?? [];
  return permissions.includes(permission);
}

export function requirePermission(role: Role, permission: Permission) {
  if (!hasPermission(role, permission)) {
    throw new ApiError("Forbidden", 403, "FORBIDDEN");
  }
}
