'use server';

import { prisma } from './db';

/**
 * MULTI-TENANT QUERY SCOPE HELPER
 *
 * Enforces strict tenant isolation at the query level.
 * Always scope all Prisma queries using companyId to prevent data leakage.
 *
 * Usage:
 *   const lead = await tenantScope.lead(companyId).findUnique({
 *     where: { id: 'lead-123' },
 *   });
 *
 * This replaces:
 *   const lead = await prisma.lead.findUnique({
 *     where: { id: 'lead-123', companyId }, // MANUAL, ERROR-PRONE
 *   });
 */

/**
 * Create a tenant-scoped query helper for a specific entity.
 * This ensures companyId is ALWAYS included in the where clause.
 */
function createTenantScope<T extends keyof typeof prisma>(model: T, companyId: string) {
    const baseModel = prisma[model] as any;

    return {
        /**
         * findUnique - scoped to tenant
         */
        findUnique: (args: any) => {
            return baseModel.findUnique({
                ...args,
                where: {
                    ...args.where,
                    companyId, // ALWAYS include companyId
                },
            });
        },

        /**
         * findUniqueOrThrow - scoped to tenant
         */
        findUniqueOrThrow: (args: any) => {
            return baseModel.findUniqueOrThrow({
                ...args,
                where: {
                    ...args.where,
                    companyId,
                },
            });
        },

        /**
         * findFirst - scoped to tenant
         */
        findFirst: (args: any) => {
            return baseModel.findFirst({
                ...args,
                where: {
                    ...(args.where || {}),
                    companyId,
                },
            });
        },

        /**
         * findMany - scoped to tenant
         */
        findMany: (args: any) => {
            return baseModel.findMany({
                ...args,
                where: {
                    ...(args.where || {}),
                    companyId,
                },
            });
        },

        /**
         * count - scoped to tenant
         */
        count: (args: any) => {
            return baseModel.count({
                ...args,
                where: {
                    ...(args.where || {}),
                    companyId,
                },
            });
        },

        /**
         * create - enforces companyId on creation
         */
        create: (args: any) => {
            return baseModel.create({
                ...args,
                data: {
                    ...args.data,
                    companyId, // ALWAYS enforce companyId on create
                },
            });
        },

        /**
         * update - scoped to tenant
         */
        update: (args: any) => {
            return baseModel.update({
                ...args,
                where: {
                    ...args.where,
                    companyId,
                },
            });
        },

        /**
         * upsert - scoped to tenant
         * ✅ FIXED: Now prevents companyId changes on updates
         */
        upsert: (args: any) => {
            return baseModel.upsert({
                ...args,
                where: {
                    ...args.where,
                    companyId,  // Ensure where clause includes companyId
                },
                create: {
                    ...args.create,
                    companyId,  // Ensure create always sets companyId
                },
                update: {
                    ...args.update,
                    // ✅ NEW: Prevent companyId from being changed on update
                    // This is a critical security safeguard - once a record is assigned
                    // to a company, it should never be moved to another company
                    // If user tries to pass companyId in update, our companyId wins
                    companyId: companyId,  // Always keep same companyId
                },
            });
        },

        /**
         * delete - scoped to tenant
         */
        delete: (args: any) => {
            return baseModel.delete({
                ...args,
                where: {
                    ...args.where,
                    companyId,
                },
            });
        },

        /**
         * deleteMany - scoped to tenant
         */
        deleteMany: (args: any) => {
            return baseModel.deleteMany({
                ...args,
                where: {
                    ...(args.where || {}),
                    companyId,
                },
            });
        },
    };
}

/**
 * Main tenant scope factory
 * Usage: const scoped = tenantScope(companyId);
 *        scoped.lead.findUnique(...);
 *
 * ✅ FIXED: Now validates companyId before scoping
 */
export function tenantScope(companyId: string) {
    // ✅ NEW: Validate companyId immediately to prevent scoping with undefined/null
    if (!companyId) {
        throw new Error(
            `Invalid companyId: received "${companyId}" (${typeof companyId}). ` +
            `Must be a non-empty string.`
        );
    }

    if (typeof companyId !== 'string') {
        throw new Error(
            `Invalid companyId: expected string, got ${typeof companyId}`
        );
    }

    if (companyId.trim() === '') {
        throw new Error(
            'Invalid companyId: empty string is not allowed. Must be non-empty.'
        );
    }

    return {
        user: createTenantScope('user', companyId),
        session: createTenantScope('session', companyId),
        lead: createTenantScope('lead', companyId),
        auditLog: createTenantScope('auditLog', companyId),
        savedView: createTenantScope('savedView', companyId),
        rolePreset: createTenantScope('rolePreset', companyId),
        emailAccount: createTenantScope('emailAccount', companyId),
        emailThread: createTenantScope('emailThread', companyId),
        emailMessage: createTenantScope('emailMessage', companyId),
        emailAttachment: createTenantScope('emailAttachment', companyId),
        emailWebhookState: createTenantScope('emailWebhookState', companyId),
        emailSendAudit: createTenantScope('emailSendAudit', companyId),
        emailThreadLead: createTenantScope('emailThreadLead', companyId),
        syncQueue: createTenantScope('syncQueue', companyId),
        emailQueue: createTenantScope('emailQueue', companyId),
        conflictLog: createTenantScope('conflictLog', companyId),
        syncCheckpoint: createTenantScope('syncCheckpoint', companyId),
    };
}

/**
 * ALTERNATIVE: Direct tenant-aware query helper
 *
 * Usage:
 *   const lead = await tenantQuery(companyId, 'lead', 'findUnique', {
 *     where: { id: 'lead-123' }
 *   });
 */
export async function tenantQuery<ModelName extends keyof typeof prisma>(
    companyId: string,
    model: ModelName,
    operation: string,
    args: any,
) {
    const scoped = createTenantScope(model, companyId);
    return (scoped as any)[operation](args);
}
