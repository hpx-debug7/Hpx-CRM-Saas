import { PermissionKey } from '../utils/permissions';
import { useUsers } from '../context/UserContext';

/**
 * Hook to check a single permission key against the current user's resolved permissions.
 */
export function usePermission(key: PermissionKey): boolean {
    const context = useUsers();
    return context.hasPermission(key);
}
