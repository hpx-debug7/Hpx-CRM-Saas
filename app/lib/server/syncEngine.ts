import { logger } from '@/lib/server/logger';
import { prisma } from '@/lib/server/db';
import { SyncQueueService } from './syncQueue';

export interface SyncCheckpoint {
  entityType: string;
  lastSyncVersion: number;
  lastSyncTime: Date | null;
}

export interface SyncConflict {
  id: string;
  entityType: string;
  entityId: string;
  localVersion: number;
  serverVersion: number;
  serverData: Record<string, any>;
  serverTimestamp: Date;
}

export interface SyncStats {
  pulled: number;
  pushed: number;
  conflicts: number;
  errors: number;
  duration: number;
}

const MAX_BATCH_SIZE = 50;
const SERVER_BASE_URL = process.env.SYNC_SERVER_URL || '';
const DEVICE_ID = process.env.DEVICE_ID || 'default';
const COMPANY_ID = process.env.COMPANY_ID || 'SYSTEM';
const API_VERSION = 'v2';

/**
 * Sync Engine
 * Handles bidirectional synchronization between local SQLite and remote server
 * Includes conflict resolution and version management
 */
export class SyncEngine {
  private static isSyncing = false;
  private static lastSyncTime: Map<string, Date> = new Map();
  private static retryCount: Map<string, number> = new Map();
  private static maxRetries = 10;
  private static retryDelays = [1000, 5000, 30000, 120000, 300000]; // 1s, 5s, 30s, 2min, 5min

  /**
   * Get retry delay based on attempt count
   */
  private static getRetryDelay(attempt: number): number {
    if (attempt >= this.retryDelays.length) {
      return this.retryDelays[this.retryDelays.length - 1];
    }
    return this.retryDelays[attempt] || 60000;
  }

  /**
   * Get sync checkpoint for entity type
   */
  static async getSyncCheckpoint(entityType: string): Promise<SyncCheckpoint> {
    const checkpoint = await prisma.syncCheckpoint.findUnique({
      where: {
        companyId_entityType_deviceId: {
          companyId: COMPANY_ID,
          entityType,
          deviceId: DEVICE_ID,
        },
      },
    });

    return {
      entityType,
      lastSyncVersion: checkpoint?.lastSyncVersion || 0,
      lastSyncTime: checkpoint?.lastSyncTime || null,
    };
  }

  /**
   * Update sync checkpoint
   */
  private static async updateSyncCheckpoint(
    entityType: string,
    lastSyncVersion: number
  ): Promise<void> {
    await prisma.syncCheckpoint.upsert({
      where: {
        companyId_entityType_deviceId: {
          companyId: COMPANY_ID,
          entityType,
          deviceId: DEVICE_ID,
        },
      },
      create: {
        companyId: COMPANY_ID,
        entityType,
        deviceId: DEVICE_ID,
        lastSyncVersion,
        lastSyncTime: new Date(),
      },
      update: {
        lastSyncVersion,
        lastSyncTime: new Date(),
      },
    });
  }

  /**
   * Start full sync cycle (pull + push)
   */
  static async startSync(): Promise<SyncStats> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    const startTime = performance.now();
    const stats: SyncStats = { pulled: 0, pushed: 0, conflicts: 0, errors: 0, duration: 0 };

    try {
      logger.info('🔄 Starting sync cycle...');

      // Phase 1: Pull server changes
      stats.pulled = await this.pullServerChanges();
      logger.info(`✓ Pulled ${stats.pulled} changes from server`);

      // Phase 2: Push local changes
      const pushResult = await this.pushLocalChanges();
      stats.pushed = pushResult.pushed;
      stats.conflicts = pushResult.conflicts;
      logger.info(`✓ Pushed ${stats.pushed} changes to server`);

      // Phase 3: Resolve conflicts if any
      if (stats.conflicts > 0) {
        logger.info(`⚠ Found ${stats.conflicts} conflicts`);
        const resolved = await this.resolveConflicts();
        logger.info(`✓ Resolved ${resolved} conflicts`);
      }

      stats.duration = performance.now() - startTime;
      logger.info(`✓ Sync completed in ${stats.duration.toFixed(0)}ms`);

      return stats;
    } catch (error) {
      stats.errors = 1;
      logger.error('✗ Sync failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Pull changes from server
   */
  private static async pullServerChanges(): Promise<number> {
    const entityTypes = ['Lead', 'EmailMessage', 'EmailThread'];
    let totalPulled = 0;

    for (const entityType of entityTypes) {
      try {
        const checkpoint = await this.getSyncCheckpoint(entityType);
        let hasMore = true;
        let version = checkpoint.lastSyncVersion;

        while (hasMore) {
          const response = await fetch(
            `${SERVER_BASE_URL}/api/${API_VERSION}/sync/pull`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.SYNC_API_KEY || ''}`,
              },
              body: JSON.stringify({
                type: entityType,
                since: version,
                deviceId: DEVICE_ID,
              }),
            }
          );

          if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
          }

          const data = await response.json();
          const changes = data.changes || [];

          // Apply each change
          for (const change of changes) {
            await this.applyServerChange(entityType, change);
          }

          totalPulled += changes.length;
          version = data.lastVersion || version;
          hasMore = data.hasMore || false;

          if (changes.length > 0) {
            await this.updateSyncCheckpoint(entityType, version);
          }
        }
      } catch (error) {
        logger.error(`Error pulling ${entityType} changes:`, error);
      }
    }

    return totalPulled;
  }

  /**
   * Apply a server change to local database
   */
  private static async applyServerChange(
    entityType: string,
    change: any
  ): Promise<void> {
    const { id, operation, version, data } = change;

    try {
      if (operation === 'CREATE' || operation === 'UPDATE') {
        // Check if local version exists
        let localItem: any = null;

        if (entityType === 'Lead') {
          localItem = await prisma.lead.findUnique({
            where: { id },
          });
        } else if (entityType === 'EmailMessage') {
          localItem = await prisma.emailMessage.findUnique({
            where: { id },
          });
        } else if (entityType === 'EmailThread') {
          localItem = await prisma.emailThread.findUnique({
            where: { id },
          });
        }

        if (!localItem) {
          // Create new item
          const updateData = {
            ...data,
            _version: version,
            _lastSyncedAt: new Date(),
            _isDirty: false,
            _syncStatus: 'SYNCED',
          };

          if (entityType === 'Lead') {
            await prisma.lead.create({ data: updateData });
          } else if (entityType === 'EmailMessage') {
            await prisma.emailMessage.create({ data: updateData });
          } else if (entityType === 'EmailThread') {
            await prisma.emailThread.create({ data: updateData });
          }
        } else if (localItem._isDirty && localItem._version > version) {
          // Local version is newer - mark as conflict
          await prisma.conflictLog.create({
            data: {
              companyId: COMPANY_ID,
              entityType,
              entityId: id,
              localVersion: localItem._version,
              serverVersion: version,
              localData: JSON.stringify(localItem),
              serverData: JSON.stringify(data),
            },
          });
        } else {
          // Update with server version
          const updateData = {
            ...data,
            _version: version,
            _lastSyncedAt: new Date(),
            _isDirty: false,
            _syncStatus: 'SYNCED',
          };

          if (entityType === 'Lead') {
            await prisma.lead.update({
              where: { id },
              data: updateData,
            });
          } else if (entityType === 'EmailMessage') {
            await prisma.emailMessage.update({
              where: { id },
              data: updateData,
            });
          } else if (entityType === 'EmailThread') {
            await prisma.emailThread.update({
              where: { id },
              data: updateData,
            });
          }
        }
      } else if (operation === 'DELETE') {
        // Delete local item
        if (entityType === 'Lead') {
          await prisma.lead.delete({ where: { id } });
        } else if (entityType === 'EmailMessage') {
          await prisma.emailMessage.delete({ where: { id } });
        } else if (entityType === 'EmailThread') {
          await prisma.emailThread.delete({ where: { id } });
        }
      }
    } catch (error) {
      logger.error(
        `Error applying ${entityType} change (${operation}):`,
        error
      );
      throw error;
    }
  }

  /**
   * Push local changes to server
   */
  private static async pushLocalChanges(): Promise<{ pushed: number; conflicts: number }> {
    const pending = await SyncQueueService.getPending(MAX_BATCH_SIZE);

    if (pending.length === 0) {
      return { pushed: 0, conflicts: 0 };
    }

    try {
      const batch = pending.map((item) => ({
        id: item.entityId,
        entityType: item.entityType,
        operation: item.operation,
        version: 0, // Will be set by server
        data: item.payload,
      }));

      const response = await fetch(
        `${SERVER_BASE_URL}/api/${API_VERSION}/sync/push`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.SYNC_API_KEY || ''}`,
          },
          body: JSON.stringify({
            batch,
            deviceId: DEVICE_ID,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const result = await response.json();

      // Mark accepted items as synced
      if (result.accepted && result.accepted.length > 0) {
        const acceptedIds = pending
          .filter((item) =>
            result.accepted.some((r: string) => r === item.id)
          )
          .map((item) => item.id);

        for (const acId of acceptedIds) {
          await SyncQueueService.markSyncedSingle(acId);
        }
      }

      // Handle conflicts
      if (result.conflicts && result.conflicts.length > 0) {
        for (const conflict of result.conflicts) {
          await prisma.conflictLog.create({
            data: {
              companyId: COMPANY_ID,
              entityType: conflict.entityType,
              entityId: conflict.id,
              localVersion: 0,
              serverVersion: conflict.serverVersion,
              localData: JSON.stringify({}),
              serverData: JSON.stringify(conflict.serverData),
            },
          });
        }
      }

      // Retry failed items
      if (result.errors && result.errors.length > 0) {
        for (const error of result.errors) {
          await SyncQueueService.markFailed(
            error.id,
            error.message
          );
        }
      }

      return {
        pushed: result.accepted ? result.accepted.length : 0,
        conflicts: result.conflicts ? result.conflicts.length : 0,
      };
    } catch (error) {
      logger.error('Error pushing changes:', error);

      // Mark all as failed for retry
      await SyncQueueService.markFailedBatch(
        pending.map((item) => item.id),
        'Network error'
      );

      throw error;
    }
  }

  /**
   * Resolve conflicts
   */
  private static async resolveConflicts(): Promise<number> {
    const conflicts = await prisma.conflictLog.findMany({
      where: { resolvedAt: null },
    });

    const resolutions = conflicts.map((conflict) => ({
      id: conflict.entityId,
      entityType: conflict.entityType,
      resolution: 'ACCEPT_LOCAL', // Default: prefer local changes
    }));

    if (resolutions.length === 0) {
      return 0;
    }

    try {
      const response = await fetch(
        `${SERVER_BASE_URL}/api/${API_VERSION}/conflicts/resolve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.SYNC_API_KEY || ''}`,
          },
          body: JSON.stringify({ conflicts: resolutions }),
        }
      );

      if (response.ok) {
        await prisma.conflictLog.updateMany({
          where: {
            id: { in: conflicts.map((c) => c.id) },
          },
          data: {
            resolution: 'ACCEPT_LOCAL',
            resolvedAt: new Date(),
          },
        });

        return conflicts.length;
      }
    } catch (error) {
      logger.error('Error resolving conflicts:', error);
    }

    return 0;
  }

  /**
   * Get current sync status
   */
  static async getStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime.get('global') || null,
      pendingCount: (await SyncQueueService.getPending(1000)).length,
      conflictCount: await prisma.conflictLog.count({
        where: { resolvedAt: null },
      }),
    };
  }
}
