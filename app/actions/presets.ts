'use server';


import { logger } from '@/lib/server/logger';
import { prisma } from '@/lib/server/db';
import { requireRole } from './auth';
import { addServerAuditLog } from './audit';
import { resolvePermissions, hasPermission as hasPermissionUtil, PermissionKey } from '../utils/permissions';
import { UserRole } from '../types/processTypes';
import { getSession } from '@/lib/server/auth';

// ============================================================================
// PRESET CRUD SERVER ACTIONS
// ============================================================================

export interface PresetData {
    id: string;
    name: string;
    description: string | null;
    permissions: string;
    isSystem: boolean;
    createdAt: string;
    updatedAt: string;
    createdById: string | null;
    userCount: number;
}

/**
 * Get all presets with user counts (Admin only).
 */
export async function getPresets(): Promise<PresetData[]> {
    await requireRole(['ADMIN']);

    const presets = await prisma.rolePreset.findMany({
        orderBy: { createdAt: 'asc' },
    });

    // Count users per preset
    const presetsWithCounts: PresetData[] = await Promise.all(
        presets.map(async (preset) => {
            const userCount = await prisma.user.count({
                where: { rolePresetId: preset.id },
            });
            return {
                ...preset,
                createdAt: preset.createdAt.toISOString(),
                updatedAt: preset.updatedAt.toISOString(),
                userCount
            };
        })
    );

    return presetsWithCounts;
}

/**
 * Get a single preset by ID (used by UserContext to resolve permissions).
 */
export async function getPresetById(id: string): Promise<{ id: string; name: string; permissions: string; isSystem: boolean } | null> {
    const preset = await prisma.rolePreset.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            permissions: true,
            isSystem: true,
        },
    });

    return preset;
}

/**
 * Create a new preset (Admin only).
 */
export async function createPresetAction(data: {
    name: string;
    description?: string;
    permissions: string;
}): Promise<{ success: boolean; message: string }> {
    try {
        const session = await requireRole(['ADMIN']);

        const preset = await prisma.rolePreset.create({
            data: {
                companyId: session.companyId,
                name: data.name,
                description: data.description || null,
                permissions: data.permissions,
                isSystem: false,
                createdById: session.userId,
            },
        });

        await addServerAuditLog({
            actionType: 'ROLE_PRESET_CREATED',
            entityType: 'role_preset',
            entityId: preset.id,
            performedById: session.userId,
            description: `Role preset "${preset.name}" created`,
            metadata: { presetName: preset.name },
        });

        return { success: true, message: 'Preset created successfully' };
    } catch (error) {
        logger.error('Create preset error:', error);
        return { success: false, message: 'Failed to create preset' };
    }
}

/**
 * Update an existing preset (Admin only). System presets cannot be updated.
 */
export async function updatePresetAction(
    id: string,
    data: { name?: string; description?: string; permissions?: string }
): Promise<{ success: boolean; message: string }> {
    try {
        const session = await requireRole(['ADMIN']);

        const existing = await prisma.rolePreset.findUnique({ where: { id } });
        if (!existing) {
            return { success: false, message: 'Preset not found' };
        }
        if (existing.isSystem) {
            return { success: false, message: 'System presets cannot be modified' };
        }

        const updateData: Record<string, unknown> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.permissions !== undefined) updateData.permissions = data.permissions;

        await prisma.rolePreset.update({
            where: { id },
            data: updateData,
        });

        await addServerAuditLog({
            actionType: 'ROLE_PRESET_UPDATED',
            entityType: 'role_preset',
            entityId: id,
            performedById: session.userId,
            description: `Role preset "${existing.name}" updated`,
            metadata: { updates: Object.keys(data) },
        });

        return { success: true, message: 'Preset updated successfully' };
    } catch (error) {
        logger.error('Update preset error:', error);
        return { success: false, message: 'Failed to update preset' };
    }
}

/**
 * Delete a preset (Admin only). System presets cannot be deleted.
 */
export async function deletePresetAction(id: string): Promise<{ success: boolean; message: string }> {
    try {
        const session = await requireRole(['ADMIN']);

        const existing = await prisma.rolePreset.findUnique({ where: { id } });
        if (!existing) {
            return { success: false, message: 'Preset not found' };
        }
        if (existing.isSystem) {
            return { success: false, message: 'System presets cannot be deleted' };
        }

        // Clear rolePresetId AND customPermissions for users using this preset
        // so they fall back to base role defaults
        const affectedUsers = await prisma.user.updateMany({
            where: { rolePresetId: id },
            data: { rolePresetId: null, customPermissions: null },
        });

        await prisma.rolePreset.delete({ where: { id } });

        await addServerAuditLog({
            actionType: 'ROLE_PRESET_DELETED',
            entityType: 'role_preset',
            entityId: id,
            performedById: session.userId,
            description: `Role preset "${existing.name}" deleted; ${affectedUsers.count} user(s) had permissions reset to role defaults`,
            metadata: { presetName: existing.name, usersReset: affectedUsers.count },
        });

        return { success: true, message: 'Preset deleted successfully' };
    } catch (error) {
        logger.error('Delete preset error:', error);
        return { success: false, message: 'Failed to delete preset' };
    }
}

/**
 * Duplicate a preset (Admin only).
 */
export async function duplicatePresetAction(id: string): Promise<{ success: boolean; message: string }> {
    try {
        const session = await requireRole(['ADMIN']);

        const source = await prisma.rolePreset.findUnique({ where: { id } });
        if (!source) {
            return { success: false, message: 'Source preset not found' };
        }

        const newPreset = await prisma.rolePreset.create({
            data: {
                companyId: session.companyId,
                name: `Copy of ${source.name}`,
                description: source.description,
                permissions: source.permissions,
                isSystem: false,
                createdById: session.userId,
            },
        });

        await addServerAuditLog({
            actionType: 'ROLE_PRESET_CREATED',
            entityType: 'role_preset',
            entityId: newPreset.id,
            performedById: session.userId,
            description: `Role preset "${newPreset.name}" created (duplicated from "${source.name}")`,
            metadata: { sourcePresetId: id, sourcePresetName: source.name },
        });

        return { success: true, message: 'Preset duplicated successfully' };
    } catch (error) {
        logger.error('Duplicate preset error:', error);
        return { success: false, message: 'Failed to duplicate preset' };
    }
}

// ============================================================================
// REQUIRE PERMISSION (server-side guard)
// ============================================================================

/**
 * Server-side permission check. ADMIN always passes.
 */
export async function requirePermission(key: PermissionKey): Promise<{ userId: string; role: string; sessionId: string }> {
    const session = await getSession();
    if (!session) {
        throw new Error('Unauthorized: You must be logged in to perform this action');
    }

    // ADMIN always passes
    if (session.role === 'ADMIN') {
        return session;
    }

    const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: {
            role: true,
            rolePresetId: true,
            customPermissions: true,
        },
    });

    if (!user) {
        throw new Error('Unauthorized: User not found');
    }

    let preset: { permissions: string } | null = null;
    if (user.rolePresetId) {
        const presetData = await prisma.rolePreset.findUnique({
            where: { id: user.rolePresetId },
            select: { permissions: true },
        });
        preset = presetData;
    }

    const resolved = resolvePermissions(
        { role: user.role as UserRole, customPermissions: user.customPermissions },
        preset
    );

    if (!hasPermissionUtil(resolved, key)) {
        throw new Error('Forbidden: You do not have permission to perform this action');
    }

    return session;
}
