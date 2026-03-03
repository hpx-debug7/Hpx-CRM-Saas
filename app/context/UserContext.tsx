'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { User, UserRole } from '../types/processTypes';
import { loginAction, logoutAction, getCurrentUser, changeOwnPasswordAction } from '../actions/auth';
import { getUsers, createUserAction, updateUserAction, deleteUserAction, resetUserPasswordAction } from '../actions/user';
import {
    PermissionKey,
    RolePreset,
    resolvePermissions,
    hasPermission as hasPermissionUtil,
    BASE_ROLE_DEFAULTS,
} from '../utils/permissions';
import {
    getPresets as getPresetsAction,
    getPresetById,
    createPresetAction,
    updatePresetAction,
    deletePresetAction,
    duplicatePresetAction,
} from '../actions/presets';

// ============================================================================
// TYPES
// ============================================================================

export interface UserSession {
    userId: string;
    username: string;
    name: string;
    email: string;
    role: UserRole;
    stickyLeadTableHeader?: boolean;
    rolePresetId?: string | null;
    customPermissions?: string | null;
    loginAt?: string;
}

export interface UserContextType {
    currentUser: UserSession | null;
    users: User[];
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<{ success: boolean; message: string }>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    refreshUsers: () => Promise<void>;

    // User management (for admin)
    createUser: (userData: Omit<User, 'userId' | 'createdAt'>) => Promise<{ success: boolean; message: string }>;
    updateUser: (userId: string, updates: Partial<User>) => Promise<{ success: boolean; message: string }>;
    deleteUser: (userId: string) => Promise<{ success: boolean; message: string }>;
    resetUserPassword: (userId: string) => Promise<{ success: boolean; message: string; newPassword?: string }>;
    changeOwnPassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;

    // Impersonation support
    overrideCurrentUser: (user: UserSession) => void;

    // Permission checks (legacy — delegated to hasPermission)
    hasRole: (roles: UserRole[]) => boolean;
    canManageLeads: () => boolean;
    canConvertToCase: () => boolean;
    canManageCases: () => boolean;
    canViewAllCases: () => boolean;
    canManageUsers: () => boolean;
    canViewReports: () => boolean;
    canViewAllLeads: () => boolean;
    canAssignLeads: () => boolean;
    canReassignLeads: () => boolean;
    canAccessSalesDashboard: () => boolean;
    canAccessProcessDashboard: () => boolean;
    canDeleteLeads: () => boolean;
    canAssignBenefitTypes: () => boolean;
    getUserById: (userId: string) => User | undefined;
    getUsersByRole: (role: UserRole) => User[];

    // New permission system
    resolvedPermissions: Record<PermissionKey, boolean>;
    hasPermission: (key: PermissionKey) => boolean;

    // Preset management
    getPresets: () => Promise<RolePreset[]>;
    createPreset: (data: { name: string; description?: string; permissions: string }) => Promise<{ success: boolean; message: string }>;
    updatePreset: (id: string, data: { name?: string; description?: string; permissions?: string }) => Promise<{ success: boolean; message: string }>;
    deletePreset: (id: string) => Promise<{ success: boolean; message: string }>;
    duplicatePreset: (id: string) => Promise<{ success: boolean; message: string }>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
    const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [resolvedPermissions, setResolvedPermissions] = useState<Record<PermissionKey, boolean>>(
        BASE_ROLE_DEFAULTS['SALES_EXECUTIVE']
    );
    const [currentPreset, setCurrentPreset] = useState<RolePreset | null>(null);

    // Fetch current user from server on mount
    const refreshUser = useCallback(async () => {
        try {
            const user = await getCurrentUser();
            if (user) {
                setCurrentUser({
                    userId: user.userId,
                    username: user.username,
                    name: user.name,
                    email: user.email,
                    role: user.role as UserRole,
                    stickyLeadTableHeader: user.stickyLeadTableHeader,
                    rolePresetId: user.rolePresetId,
                    customPermissions: user.customPermissions,
                });

                // Resolve permissions
                let preset: { permissions: string } | null = null;
                if (user.rolePresetId) {
                    const fetchedPreset = await getPresetById(user.rolePresetId);
                    if (fetchedPreset) {
                        preset = fetchedPreset;
                        setCurrentPreset(fetchedPreset as RolePreset);
                    }
                }
                const resolved = resolvePermissions(
                    { role: user.role as UserRole, customPermissions: user.customPermissions },
                    preset
                );
                setResolvedPermissions(resolved);
            } else {
                setCurrentUser(null);
            }
        } catch (error) {
            console.error('Failed to fetch current user:', error);
            setCurrentUser(null);
        }
    }, []);

    // Fetch all users (for admin)
    const refreshUsers = useCallback(async () => {
        try {
            const fetchedUsers = await getUsers();
            // Map server data to client User type
            setUsers(fetchedUsers.map(u => ({
                userId: u.id,
                username: u.username,
                name: u.name,
                email: u.email,
                role: u.role as UserRole,
                password: '', // Not returned from server for security
                isActive: u.isActive,
                rolePresetId: u.rolePresetId,
                customPermissions: u.customPermissions,
                createdAt: u.createdAt.toISOString(),
                lastLoginAt: u.lastLoginAt?.toISOString(),
            })));
        } catch (error) {
            // User may not be admin, that's fine
            console.debug('Could not fetch users (may not be admin):', error);
            setUsers([]);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            await refreshUser();
            await refreshUsers();
            setIsLoading(false);
        };
        init();
    }, [refreshUser, refreshUsers]);

    // ============================================================================
    // AUTH OPERATIONS
    // ============================================================================

    const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
        try {
            const result = await loginAction(username, password);

            if (result.success && result.user) {
                setCurrentUser({
                    userId: result.user.userId,
                    username: result.user.username,
                    name: result.user.name,
                    email: result.user.email,
                    role: result.user.role as UserRole,
                    stickyLeadTableHeader: result.user.stickyLeadTableHeader,
                    rolePresetId: result.user.rolePresetId,
                    customPermissions: result.user.customPermissions,
                    loginAt: new Date().toISOString(),
                });

                // Resolve permissions after login
                let preset: { permissions: string } | null = null;
                if (result.user.rolePresetId) {
                    const fetchedPreset = await getPresetById(result.user.rolePresetId);
                    if (fetchedPreset) {
                        preset = fetchedPreset;
                        setCurrentPreset(fetchedPreset as RolePreset);
                    }
                }
                const resolved = resolvePermissions(
                    { role: result.user.role as UserRole, customPermissions: result.user.customPermissions },
                    preset
                );
                setResolvedPermissions(resolved);

                // Refresh users list after login (if admin)
                await refreshUsers();
            }

            return { success: result.success, message: result.message };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Login failed. Please try again.' };
        }
    }, [refreshUsers]);

    const logout = useCallback(async () => {
        try {
            await logoutAction();
            setCurrentUser(null);
            setUsers([]);
            setCurrentPreset(null);
            setResolvedPermissions(BASE_ROLE_DEFAULTS['SALES_EXECUTIVE']);
        } catch (error) {
            console.error('Logout error:', error);
            setCurrentUser(null);
        }
    }, []);

    // ============================================================================
    // USER MANAGEMENT OPERATIONS
    // ============================================================================

    const createUser = useCallback(async (userData: Omit<User, 'userId' | 'createdAt'>): Promise<{ success: boolean; message: string }> => {
        try {
            const result = await createUserAction({
                username: userData.username,
                name: userData.name,
                email: userData.email,
                password: userData.password,
                role: userData.role,
                rolePresetId: userData.rolePresetId,
                customPermissions: userData.customPermissions,
            });

            if (result.success) {
                await refreshUsers();
            }

            return { success: result.success, message: result.message };
        } catch (error) {
            console.error('Create user error:', error);
            return { success: false, message: 'Failed to create user' };
        }
    }, [refreshUsers]);

    const updateUser = useCallback(async (userId: string, updates: Partial<User>): Promise<{ success: boolean; message: string }> => {
        try {
            const result = await updateUserAction(userId, {
                name: updates.name,
                email: updates.email,
                role: updates.role,
                isActive: updates.isActive,
                password: updates.password,
                rolePresetId: updates.rolePresetId,
                customPermissions: updates.customPermissions,
            });

            if (result.success) {
                await refreshUsers();
            }

            return { success: result.success, message: result.message };
        } catch (error) {
            console.error('Update user error:', error);
            return { success: false, message: 'Failed to update user' };
        }
    }, [refreshUsers]);

    const deleteUser = useCallback(async (userId: string): Promise<{ success: boolean; message: string }> => {
        try {
            const result = await deleteUserAction(userId);

            if (result.success) {
                await refreshUsers();
            }

            return { success: result.success, message: result.message };
        } catch (error) {
            console.error('Delete user error:', error);
            return { success: false, message: 'Failed to delete user' };
        }
    }, [refreshUsers]);

    const resetUserPassword = useCallback(async (userId: string): Promise<{ success: boolean; message: string; newPassword?: string }> => {
        try {
            const result = await resetUserPasswordAction(userId);

            if (result.success) {
                await refreshUsers();
            }

            return result;
        } catch (error) {
            console.error('Reset password error:', error);
            return { success: false, message: 'Failed to reset password' };
        }
    }, [refreshUsers]);

    const changeOwnPassword = useCallback(async (currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
        try {
            return await changeOwnPasswordAction(currentPassword, newPassword);
        } catch (error) {
            console.error('Change own password error:', error);
            return { success: false, message: 'Failed to change password' };
        }
    }, []);

    // Override current user (used for impersonation)
    const overrideCurrentUser = useCallback((user: UserSession) => {
        setCurrentUser(user);
    }, []);

    // ============================================================================
    // PERMISSION CHECKS
    // ============================================================================

    const hasRole = useCallback((roles: UserRole[]): boolean => {
        if (!currentUser) return false;
        return roles.includes(currentUser.role);
    }, [currentUser]);

    const hasPermission = useCallback((key: PermissionKey): boolean => {
        // ADMIN always has all permissions
        if (currentUser?.role === 'ADMIN') return true;
        return hasPermissionUtil(resolvedPermissions, key);
    }, [currentUser, resolvedPermissions]);

    // Legacy can*() methods — now delegate to hasPermission
    const canManageLeads = useCallback((): boolean => {
        return hasPermission('leads.create');
    }, [hasPermission]);

    const canConvertToCase = useCallback((): boolean => {
        return hasPermission('leads.convertToCase');
    }, [hasPermission]);

    const canManageCases = useCallback((): boolean => {
        return hasPermission('cases.edit');
    }, [hasPermission]);

    const canViewAllCases = useCallback((): boolean => {
        return hasPermission('cases.viewAll');
    }, [hasPermission]);

    const canManageUsers = useCallback((): boolean => {
        return hasPermission('users.manage');
    }, [hasPermission]);

    const canViewReports = useCallback((): boolean => {
        return hasPermission('pages.reports');
    }, [hasPermission]);

    const canViewAllLeads = useCallback((): boolean => {
        return hasPermission('leads.viewAll');
    }, [hasPermission]);

    const canAssignLeads = useCallback((): boolean => {
        return hasPermission('leads.assign');
    }, [hasPermission]);

    const canReassignLeads = useCallback((): boolean => {
        return hasPermission('leads.assign');
    }, [hasPermission]);

    const canAccessSalesDashboard = useCallback((): boolean => {
        return hasPermission('pages.salesDashboard');
    }, [hasPermission]);

    const canAccessProcessDashboard = useCallback((): boolean => {
        return hasPermission('pages.processDashboard');
    }, [hasPermission]);

    const canDeleteLeads = useCallback((): boolean => {
        return hasPermission('leads.delete');
    }, [hasPermission]);

    const canAssignBenefitTypes = useCallback((): boolean => {
        return hasPermission('cases.assign');
    }, [hasPermission]);

    const getUserById = useCallback((userId: string): User | undefined => {
        return users.find(u => u.userId === userId);
    }, [users]);

    const getUsersByRole = useCallback((role: UserRole): User[] => {
        return users.filter(u => u.role === role);
    }, [users]);

    // ============================================================================
    // PRESET MANAGEMENT (wiring to server actions)
    // ============================================================================

    const getPresets = useCallback(async (): Promise<RolePreset[]> => {
        try {
            const presets = await getPresetsAction();
            return presets.map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                permissions: p.permissions,
                isSystem: p.isSystem,
                createdAt: p.createdAt.toISOString(),
                updatedAt: p.updatedAt.toISOString(),
                createdById: p.createdById,
                userCount: p.userCount,
            }));
        } catch (error) {
            console.error('Get presets error:', error);
            return [];
        }
    }, []);

    const createPreset = useCallback(async (data: { name: string; description?: string; permissions: string }): Promise<{ success: boolean; message: string }> => {
        try {
            return await createPresetAction(data);
        } catch (error) {
            console.error('Create preset error:', error);
            return { success: false, message: 'Failed to create preset' };
        }
    }, []);

    const updatePreset = useCallback(async (id: string, data: { name?: string; description?: string; permissions?: string }): Promise<{ success: boolean; message: string }> => {
        try {
            return await updatePresetAction(id, data);
        } catch (error) {
            console.error('Update preset error:', error);
            return { success: false, message: 'Failed to update preset' };
        }
    }, []);

    const deletePreset = useCallback(async (id: string): Promise<{ success: boolean; message: string }> => {
        try {
            return await deletePresetAction(id);
        } catch (error) {
            console.error('Delete preset error:', error);
            return { success: false, message: 'Failed to delete preset' };
        }
    }, []);

    const duplicatePreset = useCallback(async (id: string): Promise<{ success: boolean; message: string }> => {
        try {
            return await duplicatePresetAction(id);
        } catch (error) {
            console.error('Duplicate preset error:', error);
            return { success: false, message: 'Failed to duplicate preset' };
        }
    }, []);

    // ============================================================================
    // CONTEXT VALUE
    // ============================================================================

    const contextValue: UserContextType = useMemo(() => ({
        currentUser,
        users,
        isAuthenticated: currentUser !== null,
        isLoading,
        login,
        logout,
        refreshUser,
        refreshUsers,
        createUser,
        updateUser,
        deleteUser,
        resetUserPassword,
        changeOwnPassword,
        overrideCurrentUser,
        hasRole,
        canManageLeads,
        canConvertToCase,
        canManageCases,
        canViewAllCases,
        canManageUsers,
        canViewReports,
        canViewAllLeads,
        canAssignLeads,
        canReassignLeads,
        canAccessSalesDashboard,
        canAccessProcessDashboard,
        canDeleteLeads,
        canAssignBenefitTypes,
        getUserById,
        getUsersByRole,
        resolvedPermissions,
        hasPermission,
        getPresets,
        createPreset,
        updatePreset,
        deletePreset,
        duplicatePreset,
    }), [
        currentUser,
        users,
        isLoading,
        login,
        logout,
        refreshUser,
        refreshUsers,
        createUser,
        updateUser,
        deleteUser,
        resetUserPassword,
        changeOwnPassword,
        overrideCurrentUser,
        hasRole,
        canManageLeads,
        canConvertToCase,
        canManageCases,
        canViewAllCases,
        canManageUsers,
        canViewReports,
        canViewAllLeads,
        canAssignLeads,
        canReassignLeads,
        canAccessSalesDashboard,
        canAccessProcessDashboard,
        canDeleteLeads,
        canAssignBenefitTypes,
        getUserById,
        getUsersByRole,
        resolvedPermissions,
        hasPermission,
        getPresets,
        createPreset,
        updatePreset,
        deletePreset,
        duplicatePreset,
    ]);

    // Show loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    return (
        <UserContext.Provider value={contextValue}>
            {children}
        </UserContext.Provider>
    );
}

export function useUsers(): UserContextType {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUsers must be used within a UserProvider');
    }
    return context;
}

export default UserContext;
