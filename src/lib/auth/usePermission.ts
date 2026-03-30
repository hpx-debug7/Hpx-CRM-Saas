import { useUsers } from "@/app/context/UserContext";
import { hasPermission } from "@/src/lib/auth/permissionChecker";
import { Permission } from "@/src/lib/auth/permissions";
import { Role } from "@/src/lib/auth/rolePermissions";

/**
 * Frontend permission checks are ONLY for UI/UX rendering logic.
 * They are NON-authoritative.
 * 
 * All true security enforcement MUST happen on the backend via secureHandler.
 */
export function usePermission(permission: Permission): boolean {
  const { currentUser } = useUsers();

  if (!currentUser?.role) return false;

  return hasPermission(currentUser.role as Role, permission);
}
