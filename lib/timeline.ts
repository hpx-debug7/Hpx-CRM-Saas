import type { AuditLog } from "@prisma/client";

export type TimelineLog = Pick<
  AuditLog,
  "id" | "actionType" | "entityType" | "entityId" | "description" | "performedByName" | "createdAt"
>;

export interface TimelineEvent {
  id: string;
  actionType: string;
  entityType?: string;
  entityId?: string;
  description: string;
  performedBy: string | null;
  timestamp: Date;
}

/**
 * Generates a human-readable fallback description if one isn't provided in the log.
 */
function generateDescriptionFallback(actionType: string, entityType?: string | null): string {
  // Normalize strings like 'USER_CREATED' to 'user created'
  const action = actionType.toLowerCase().replace(/_/g, " ");
  const entity = entityType ? entityType.toLowerCase().replace(/_/g, " ") : "record";
  
  // Basic heuristics for determining the action description
  if (action.includes("create")) return `Created new ${entity}`;
  if (action.includes("update") || action.includes("edit")) return `Updated ${entity}`;
  if (action.includes("delete") || action.includes("remove")) return `Deleted ${entity}`;
  
  return `Performed ${action} on ${entity}`;
}

/**
 * Converts a raw TimelineLog into a user-friendly timeline event.
 */
export function formatTimelineEvent(log: TimelineLog): TimelineEvent {
  return {
    id: log.id,
    actionType: log.actionType,
    entityType: log.entityType || undefined,
    entityId: log.entityId || undefined,
    description: log.description || generateDescriptionFallback(log.actionType, log.entityType),
    performedBy: log.performedByName || null,
    timestamp: log.createdAt,
  };
}

/**
 * Converts an array of TimelineLogs into sorted TimelineEvents (latest first).
 */
export function formatTimeline(logs: TimelineLog[]): TimelineEvent[] {
  return logs
    .map(formatTimelineEvent)
    // Sort so the newest events appear first
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}
