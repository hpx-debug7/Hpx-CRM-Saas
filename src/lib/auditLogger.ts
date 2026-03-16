import { prisma } from '@/lib/server/db';
import { Prisma, AuditLog } from '@prisma/client';
import { AuditEventType } from './auditEvents';
import crypto from 'crypto';

const AUDIT_SCHEMA_VERSION = 1;

export interface AuditLogEventParams {
  companyId: string;
  actionType: AuditEventType | (string & Record<never, never>);
  description: string;
  entityType?: string;
  entityId?: string;
  performedById?: string;
  performedByName?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  beforeValue?: unknown;
  afterValue?: unknown;
  changesSummary?: string;
  metadata?: Record<string, unknown>;
  context?: {
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  };
}

function serializeValue(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (value === null) return "null";
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function generateHash(previousHash: string | null, dataContent: string): string {
  const contentToHash = (previousHash || 'null') + dataContent;
  return crypto.createHash('sha256').update(contentToHash).digest('hex');
}

export async function logAuditEvent(
  params: AuditLogEventParams
): Promise<AuditLog> {
  if (!params.companyId) {
    throw new Error('companyId is required');
  }
  if (!params.actionType) {
    throw new Error('actionType is required');
  }
  if (!params.description) {
    throw new Error('description is required');
  }

  const data: Prisma.AuditLogCreateInput = {
    company: { connect: { id: params.companyId } },
    actionType: params.actionType,
    description: params.description,
  };

  if (params.entityType !== undefined) {
    data.entityType = params.entityType;
  }
  if (params.entityId !== undefined) {
    data.entityId = params.entityId;
  }
  if (params.performedById !== undefined) {
    data.performedBy = { connect: { id: params.performedById } };
  }
  if (params.performedByName !== undefined) {
    data.performedByName = params.performedByName;
  }

  const resolvedIpAddress = params.context?.ipAddress ?? params.ipAddress;
  if (resolvedIpAddress !== undefined) {
    data.ipAddress = resolvedIpAddress;
  }

  const resolvedUserAgent = params.context?.userAgent ?? params.userAgent;
  if (resolvedUserAgent !== undefined) {
    data.userAgent = resolvedUserAgent;
  }

  const resolvedSessionId = params.context?.sessionId ?? params.sessionId;
  if (resolvedSessionId !== undefined) {
    data.sessionId = resolvedSessionId;
  }

  const serializedBefore = serializeValue(params.beforeValue);
  if (serializedBefore !== undefined) {
    data.beforeValue = serializedBefore;
  }

  const serializedAfter = serializeValue(params.afterValue);
  if (serializedAfter !== undefined) {
    data.afterValue = serializedAfter;
  }

  if (params.changesSummary !== undefined) {
    data.changesSummary = params.changesSummary;
  }

  let metadataToStore = params.metadata;
  if (params.context?.requestId) {
    metadataToStore = {
      ...metadataToStore,
      requestId: params.context.requestId,
    };
  }

  let finalMetadata: string | undefined;
  if (metadataToStore !== undefined) {
    finalMetadata = JSON.stringify(metadataToStore);
    if (finalMetadata.length > 10000) {
      throw new Error('Audit metadata too large');
    }
    data.metadata = finalMetadata;
  }

  return prisma.$transaction(async (tx) => {
    // Fetch the company's lastAuditHash inside transaction
    const company = await tx.company.findUnique({
      where: { id: params.companyId },
      select: { lastAuditHash: true },
    });

    const previousHash = company?.lastAuditHash ?? null;
    data.previousHash = previousHash;
    
    const hashPayload = {
      schemaVersion: AUDIT_SCHEMA_VERSION,
      companyId: params.companyId,
      actionType: params.actionType,
      entityType: params.entityType,
      entityId: params.entityId,
      performedById: params.performedById,
      performedByName: params.performedByName,
      beforeValue: serializedBefore,
      afterValue: serializedAfter,
      description: params.description,
      metadata: finalMetadata,
    };

    const newHash = generateHash(previousHash, JSON.stringify(hashPayload));
    data.hash = newHash;

    const auditLog = await tx.auditLog.create({ data });

    await tx.company.update({
      where: { id: params.companyId },
      data: { lastAuditHash: newHash },
    });

    return auditLog;
  });
}

export function safeAuditLog(params: AuditLogEventParams): void {
  logAuditEvent(params).catch(error => {
    console.error("Audit log failure", error);
  });
}

export async function logAuditEvents(events: AuditLogEventParams[]): Promise<void> {
  if (!events.length) return;

  const eventsByCompany = new Map<string, AuditLogEventParams[]>();
  for (const e of events) {
    if (!e.companyId) throw new Error('companyId is required');
    if (!eventsByCompany.has(e.companyId)) eventsByCompany.set(e.companyId, []);
    eventsByCompany.get(e.companyId)!.push(e);
  }

  for (const [companyId, companyEvents] of eventsByCompany.entries()) {
    await prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { lastAuditHash: true },
      });

      let currentHash = company?.lastAuditHash ?? null;
      const createManyData: Prisma.AuditLogCreateManyInput[] = [];

      for (const params of companyEvents) {
        if (!params.actionType) throw new Error('actionType is required');
        if (!params.description) throw new Error('description is required');

        const mappedData: Prisma.AuditLogCreateManyInput = {
          companyId: params.companyId,
          actionType: params.actionType,
          description: params.description,
        };

        if (params.entityType !== undefined) mappedData.entityType = params.entityType;
        if (params.entityId !== undefined) mappedData.entityId = params.entityId;
        if (params.performedById !== undefined) mappedData.performedById = params.performedById;
        if (params.performedByName !== undefined) mappedData.performedByName = params.performedByName;

        const resolvedIpAddress = params.context?.ipAddress ?? params.ipAddress;
        if (resolvedIpAddress !== undefined) mappedData.ipAddress = resolvedIpAddress;

        const resolvedUserAgent = params.context?.userAgent ?? params.userAgent;
        if (resolvedUserAgent !== undefined) mappedData.userAgent = resolvedUserAgent;

        const resolvedSessionId = params.context?.sessionId ?? params.sessionId;
        if (resolvedSessionId !== undefined) mappedData.sessionId = resolvedSessionId;

        const serializedBefore = serializeValue(params.beforeValue);
        if (serializedBefore !== undefined) mappedData.beforeValue = serializedBefore;

        const serializedAfter = serializeValue(params.afterValue);
        if (serializedAfter !== undefined) mappedData.afterValue = serializedAfter;

        if (params.changesSummary !== undefined) mappedData.changesSummary = params.changesSummary;

        let metadataToStore = params.metadata;
        if (params.context?.requestId) {
          metadataToStore = {
            ...metadataToStore,
            requestId: params.context.requestId,
          };
        }
        
        let finalMetadata: string | undefined;
        if (metadataToStore !== undefined) {
          finalMetadata = JSON.stringify(metadataToStore);
          if (finalMetadata.length > 10000) {
            throw new Error('Audit metadata too large');
          }
          mappedData.metadata = finalMetadata;
        }

        const hashPayload = {
          schemaVersion: AUDIT_SCHEMA_VERSION,
          companyId: params.companyId,
          actionType: params.actionType,
          entityType: params.entityType,
          entityId: params.entityId,
          performedById: params.performedById,
          performedByName: params.performedByName,
          beforeValue: serializedBefore,
          afterValue: serializedAfter,
          description: params.description,
          metadata: finalMetadata,
        };

        mappedData.previousHash = currentHash;
        currentHash = generateHash(currentHash, JSON.stringify(hashPayload));
        mappedData.hash = currentHash;

        createManyData.push(mappedData);
      }

      if (createManyData.length > 0) {
        await tx.auditLog.createMany({ data: createManyData });
        await tx.company.update({
          where: { id: companyId },
          data: { lastAuditHash: currentHash },
        });
      }
    });
  }
}
