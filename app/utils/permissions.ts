/**
 * Permission Registry Utility
 * 
 * Central authority for all permission keys, role defaults, and resolution logic.
 */

import { logger } from '@/lib/client/logger';
import { UserRole } from '../types/processTypes';

// ============================================================================
// PERMISSION KEY TYPE
// ============================================================================

export type PermissionKey =
    // Page Access
    | 'pages.salesDashboard'
    | 'pages.processDashboard'
    | 'pages.addLead'
    | 'pages.allLeads'
    | 'pages.reports'
    | 'pages.email'
    // Lead Actions
    | 'leads.create'
    | 'leads.edit'
    | 'leads.delete'
    | 'leads.viewAll'
    | 'leads.assign'
    | 'leads.convertToCase'
    // Case Actions
    | 'cases.viewAll'
    | 'cases.edit'
    | 'cases.assign'
    | 'cases.updateStatus'
    | 'cases.uploadDocuments'
    | 'cases.verifyDocuments'
    // User & Admin
    | 'users.manage'
    | 'users.resetPasswords'
    | 'users.impersonate'
    | 'users.viewAuditLogs';

// ============================================================================
// ALL PERMISSION KEYS (for iteration)
// ============================================================================

export const ALL_PERMISSION_KEYS: PermissionKey[] = [
    'pages.salesDashboard',
    'pages.processDashboard',
    'pages.addLead',
    'pages.allLeads',
    'pages.reports',
    'pages.email',
    'leads.create',
    'leads.edit',
    'leads.delete',
    'leads.viewAll',
    'leads.assign',
    'leads.convertToCase',
    'cases.viewAll',
    'cases.edit',
    'cases.assign',
    'cases.updateStatus',
    'cases.uploadDocuments',
    'cases.verifyDocuments',
    'users.manage',
    'users.resetPasswords',
    'users.impersonate',
    'users.viewAuditLogs',
];

// ============================================================================
// PERMISSION CATEGORIES (for UI grouping)
// ============================================================================

export const PERMISSION_CATEGORIES: { label: string; keys: PermissionKey[] }[] = [
    {
        label: 'Page Access',
        keys: ['pages.salesDashboard', 'pages.processDashboard', 'pages.addLead', 'pages.allLeads', 'pages.reports', 'pages.email'],
    },
    {
        label: 'Lead Actions',
        keys: ['leads.create', 'leads.edit', 'leads.delete', 'leads.viewAll', 'leads.assign', 'leads.convertToCase'],
    },
    {
        label: 'Case Actions',
        keys: ['cases.viewAll', 'cases.edit', 'cases.assign', 'cases.updateStatus', 'cases.uploadDocuments', 'cases.verifyDocuments'],
    },
    {
        label: 'User & Admin',
        keys: ['users.manage', 'users.resetPasswords', 'users.impersonate', 'users.viewAuditLogs'],
    },
];

// ============================================================================
// PERMISSION LABELS (human-readable names for UI)
// ============================================================================

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
    'pages.salesDashboard': 'Sales Dashboard',
    'pages.processDashboard': 'Process Dashboard',
    'pages.addLead': 'Add Lead Page',
    'pages.allLeads': 'All Leads Page',
    'pages.reports': 'Reports Page',
    'pages.email': 'Email Page',
    'leads.create': 'Create Leads',
    'leads.edit': 'Edit Leads',
    'leads.delete': 'Delete Leads',
    'leads.viewAll': 'View All Leads',
    'leads.assign': 'Assign Leads',
    'leads.convertToCase': 'Convert to Case',
    'cases.viewAll': 'View All Cases',
    'cases.edit': 'Edit Cases',
    'cases.assign': 'Assign Cases',
    'cases.updateStatus': 'Update Case Status',
    'cases.uploadDocuments': 'Upload Documents',
    'cases.verifyDocuments': 'Verify Documents',
    'users.manage': 'Manage Users',
    'users.resetPasswords': 'Reset Passwords',
    'users.impersonate': 'Impersonate Users',
    'users.viewAuditLogs': 'View Audit Logs',
};

// ============================================================================
// BASE ROLE DEFAULTS
// ============================================================================

const T = true;
const F = false;

export const BASE_ROLE_DEFAULTS: Record<UserRole, Record<PermissionKey, boolean>> = {
    ADMIN: {
        'pages.salesDashboard': T, 'pages.processDashboard': T, 'pages.addLead': T, 'pages.allLeads': T, 'pages.reports': T, 'pages.email': T,
        'leads.create': T, 'leads.edit': T, 'leads.delete': T, 'leads.viewAll': T, 'leads.assign': T, 'leads.convertToCase': T,
        'cases.viewAll': T, 'cases.edit': T, 'cases.assign': T, 'cases.updateStatus': T, 'cases.uploadDocuments': T, 'cases.verifyDocuments': T,
        'users.manage': T, 'users.resetPasswords': T, 'users.impersonate': T, 'users.viewAuditLogs': T,
    },
    SALES_MANAGER: {
        'pages.salesDashboard': T, 'pages.processDashboard': F, 'pages.addLead': T, 'pages.allLeads': T, 'pages.reports': F, 'pages.email': T,
        'leads.create': T, 'leads.edit': T, 'leads.delete': F, 'leads.viewAll': T, 'leads.assign': T, 'leads.convertToCase': T,
        'cases.viewAll': F, 'cases.edit': F, 'cases.assign': F, 'cases.updateStatus': F, 'cases.uploadDocuments': F, 'cases.verifyDocuments': F,
        'users.manage': F, 'users.resetPasswords': F, 'users.impersonate': F, 'users.viewAuditLogs': F,
    },
    SALES_EXECUTIVE: {
        'pages.salesDashboard': T, 'pages.processDashboard': F, 'pages.addLead': T, 'pages.allLeads': T, 'pages.reports': F, 'pages.email': T,
        'leads.create': T, 'leads.edit': T, 'leads.delete': F, 'leads.viewAll': F, 'leads.assign': F, 'leads.convertToCase': T,
        'cases.viewAll': F, 'cases.edit': F, 'cases.assign': F, 'cases.updateStatus': F, 'cases.uploadDocuments': F, 'cases.verifyDocuments': F,
        'users.manage': F, 'users.resetPasswords': F, 'users.impersonate': F, 'users.viewAuditLogs': F,
    },
    PROCESS_MANAGER: {
        'pages.salesDashboard': F, 'pages.processDashboard': T, 'pages.addLead': F, 'pages.allLeads': F, 'pages.reports': T, 'pages.email': T,
        'leads.create': F, 'leads.edit': F, 'leads.delete': F, 'leads.viewAll': F, 'leads.assign': F, 'leads.convertToCase': F,
        'cases.viewAll': T, 'cases.edit': T, 'cases.assign': T, 'cases.updateStatus': T, 'cases.uploadDocuments': T, 'cases.verifyDocuments': T,
        'users.manage': F, 'users.resetPasswords': F, 'users.impersonate': F, 'users.viewAuditLogs': F,
    },
    PROCESS_EXECUTIVE: {
        'pages.salesDashboard': F, 'pages.processDashboard': T, 'pages.addLead': F, 'pages.allLeads': F, 'pages.reports': F, 'pages.email': T,
        'leads.create': F, 'leads.edit': F, 'leads.delete': F, 'leads.viewAll': F, 'leads.assign': F, 'leads.convertToCase': F,
        'cases.viewAll': F, 'cases.edit': T, 'cases.assign': F, 'cases.updateStatus': T, 'cases.uploadDocuments': T, 'cases.verifyDocuments': F,
        'users.manage': F, 'users.resetPasswords': F, 'users.impersonate': F, 'users.viewAuditLogs': F,
    },
};

// ============================================================================
// ROLE PRESET INTERFACE (client-side mirror of Prisma model)
// ============================================================================

export interface RolePreset {
    id: string;
    name: string;
    description?: string | null;
    permissions: string; // JSON string
    isSystem: boolean;
    createdAt?: string;
    updatedAt?: string;
    createdById?: string | null;
    userCount?: number;
}

// ============================================================================
// PERMISSION RESOLUTION
// ============================================================================

/**
 * Three-layer merge:
 * 1. Start with BASE_ROLE_DEFAULTS[user.role]
 * 2. If preset provided, parse preset.permissions JSON and merge (overrides defaults)
 * 3. If user.customPermissions set, parse JSON and merge (overrides preset)
 */
export function resolvePermissions(
    user: { role: UserRole; customPermissions?: string | null },
    preset?: { permissions: string } | null
): Record<PermissionKey, boolean> {
    // Layer 1: Base role defaults
    const result = { ...BASE_ROLE_DEFAULTS[user.role] };

    // Layer 2: Preset overrides
    if (preset?.permissions) {
        try {
            const presetPerms = JSON.parse(preset.permissions) as Partial<Record<PermissionKey, boolean>>;
            for (const key of ALL_PERMISSION_KEYS) {
                if (key in presetPerms && presetPerms[key] !== undefined) {
                    result[key] = presetPerms[key]!;
                }
            }
        } catch {
            logger.warn('Failed to parse preset permissions JSON');
        }
    }

    // Layer 3: User custom overrides
    if (user.customPermissions) {
        try {
            const customPerms = JSON.parse(user.customPermissions) as Partial<Record<PermissionKey, boolean>>;
            for (const key of ALL_PERMISSION_KEYS) {
                if (key in customPerms && customPerms[key] !== undefined) {
                    result[key] = customPerms[key]!;
                }
            }
        } catch {
            logger.warn('Failed to parse user custom permissions JSON');
        }
    }

    return result;
}

/**
 * Simple lookup with fallback to false.
 */
export function hasPermission(resolved: Record<PermissionKey, boolean>, key: PermissionKey): boolean {
    return resolved[key] ?? false;
}
