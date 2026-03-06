import { prisma } from '@/lib/server/db';

export interface SyncQueueItem {
  id: string;
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, any>;
  createdAt: Date;
  syncedAt: Date | null;
  retryCount: number;
  lastError: string | null;
  priority: number;
}

export interface SyncQueueStats {
  pendingCount: number;
  totalQueued: number;
  highPriorityCount: number;
  failedCount: number;
  averageRetries: number;
}

/**
 * Sync Queue Service
 * Manages queuing of local changes for synchronization with server
 */
export class SyncQueueService {
  /**
   * Add an operation to the sync queue
   */
  static async enqueue(
    companyId: string,
    entityType: string,
    entityId: string,
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    payload: Record<string, any>,
    priority: number = 0
  ): Promise<SyncQueueItem> {
    const queueItem = await prisma.syncQueue.create({
      data: {
        companyId,
        entityType,
        entityId,
        operation,
        payload: JSON.stringify(payload),
        priority,
      },
    });

    return this.mapQueueItem(queueItem);
  }

  /**
   * Get all pending operations (not yet synced)
   */
  static async getPending(limit: number = 50): Promise<SyncQueueItem[]> {
    const items = await prisma.syncQueue.findMany({
      where: {
        syncedAt: null,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: limit,
    });

    return items.map((item) => this.mapQueueItem(item));
  }

  /**
   * Get pending items by entity type
   */
  static async getPendingByType(
    entityType: string,
    limit: number = 50
  ): Promise<SyncQueueItem[]> {
    const items = await prisma.syncQueue.findMany({
      where: {
        syncedAt: null,
        entityType,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: limit,
    });

    return items.map((item) => this.mapQueueItem(item));
  }

  /**
   * Get all items (synced and pending)
   */
  static async getAll(limit: number = 100): Promise<SyncQueueItem[]> {
    const items = await prisma.syncQueue.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return items.map((item) => this.mapQueueItem(item));
  }

  /**
   * Mark items as successfully synced
   */
  static async markSynced(queueIds: string[]): Promise<number> {
    const result = await prisma.syncQueue.updateMany({
      where: {
        id: { in: queueIds },
      },
      data: {
        syncedAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Mark a single item as synced
   */
  static async markSyncedSingle(queueId: string): Promise<void> {
    await prisma.syncQueue.update({
      where: { id: queueId },
      data: {
        syncedAt: new Date(),
      },
    });
  }

  /**
   * Mark item as failed with error message
   */
  static async markFailed(
    queueId: string,
    error: string,
    incrementRetry: boolean = true
  ): Promise<void> {
    await prisma.syncQueue.update({
      where: { id: queueId },
      data: {
        lastError: error,
        retryCount: incrementRetry
          ? { increment: 1 }
          : { decrement: 0 },
      },
    });
  }

  /**
   * Mark multiple items as failed
   */
  static async markFailedBatch(
    queueIds: string[],
    error: string
  ): Promise<void> {
    await prisma.syncQueue.updateMany({
      where: {
        id: { in: queueIds },
      },
      data: {
        lastError: error,
        retryCount: { increment: 1 },
      },
    });
  }

  /**
   * Retry a failed item (increment retry count and clear error)
   */
  static async retry(queueId: string): Promise<void> {
    await prisma.syncQueue.update({
      where: { id: queueId },
      data: {
        lastError: null,
        retryCount: 0,
      },
    });
  }

  /**
   * Delete an item from queue
   */
  static async delete(queueId: string): Promise<void> {
    await prisma.syncQueue.delete({
      where: { id: queueId },
    });
  }

  /**
   * Delete items from queue
   */
  static async deleteBatch(queueIds: string[]): Promise<number> {
    const result = await prisma.syncQueue.deleteMany({
      where: {
        id: { in: queueIds },
      },
    });

    return result.count;
  }

  /**
   * Clear old synced items (older than specified days)
   */
  static async clearOldSynced(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await prisma.syncQueue.deleteMany({
      where: {
        syncedAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  /**
   * Get queue statistics
   */
  static async getStats(): Promise<SyncQueueStats> {
    const [pending, total, highPriority, failed, allItems] = await Promise.all(
      [
        prisma.syncQueue.count({ where: { syncedAt: null } }),
        prisma.syncQueue.count(),
        prisma.syncQueue.count({
          where: { syncedAt: null, priority: { gt: 0 } },
        }),
        prisma.syncQueue.count({
          where: { syncedAt: null, lastError: { not: null } },
        }),
        prisma.syncQueue.findMany(),
      ]
    );

    const averageRetries =
      allItems.length > 0
        ? allItems.reduce((sum, item) => sum + item.retryCount, 0) /
        allItems.length
        : 0;

    return {
      pendingCount: pending,
      totalQueued: total,
      highPriorityCount: highPriority,
      failedCount: failed,
      averageRetries: Math.round(averageRetries * 100) / 100,
    };
  }

  /**
   * Check if entity has pending changes
   */
  static async hasPendingChanges(
    entityType: string,
    entityId: string
  ): Promise<boolean> {
    const item = await prisma.syncQueue.findFirst({
      where: {
        entityType,
        entityId,
        syncedAt: null,
      },
    });

    return item !== null;
  }

  /**
   * Get latest pending operation for entity
   */
  static async getLatestPending(
    entityType: string,
    entityId: string
  ): Promise<SyncQueueItem | null> {
    const item = await prisma.syncQueue.findFirst({
      where: {
        entityType,
        entityId,
        syncedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    return item ? this.mapQueueItem(item) : null;
  }

  /**
   * Clear all pending items (useful for manual sync reset)
   */
  static async clearAll(): Promise<number> {
    const result = await prisma.syncQueue.deleteMany();
    return result.count;
  }

  /**
   * Clear pending items that failed more than maxRetries
   */
  static async clearExhaustedRetries(maxRetries: number = 10): Promise<number> {
    const result = await prisma.syncQueue.deleteMany({
      where: {
        syncedAt: null,
        retryCount: { gte: maxRetries },
      },
    });

    return result.count;
  }

  /**
   * Map database model to interface
   */
  private static mapQueueItem(item: any): SyncQueueItem {
    return {
      id: item.id,
      entityType: item.entityType,
      entityId: item.entityId,
      operation: item.operation,
      payload: JSON.parse(item.payload || '{}'),
      createdAt: item.createdAt,
      syncedAt: item.syncedAt,
      retryCount: item.retryCount,
      lastError: item.lastError,
      priority: item.priority,
    };
  }
}
