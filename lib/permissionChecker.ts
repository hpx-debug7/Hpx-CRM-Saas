import { ROLE_PERMISSIONS } from "./rolePermissions";
import { Permission } from "./permissions";

export function hasPermission(
  role: string,
  permission: Permission
): boolean {
  if (role === "OWNER") return true;

  const permissions = ROLE_PERMISSIONS[role];

  if (!permissions) return false;

  return permissions.includes(permission);
}
