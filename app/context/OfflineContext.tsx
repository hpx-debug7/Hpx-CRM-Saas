'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export interface OfflineStatus {
  isOnline: boolean;
  offlineMode: 'READ_ONLY' | 'FULL_OFFLINE';
  syncStatus: 'IDLE' | 'SYNCING' | 'ERROR';
}

export interface OfflineContextType {
  // Status
  isOnline: boolean;
  offlineMode: 'READ_ONLY' | 'FULL_OFFLINE';
  syncStatus: 'IDLE' | 'SYNCING' | 'ERROR';
  pendingCount: number;
  lastSyncTime: Date | null;
  conflictCount: number;

  // Actions
  toggleOfflineMode: (mode: 'READ_ONLY' | 'FULL_OFFLINE') => Promise<void>;
  startSync: () => Promise<void>;
  pauseSync: () => Promise<void>;
  getPendingQueue: () => Promise<any[]>;

  // Helpers
  isOfflineReadOnly: () => boolean;
  isFullOffline: () => boolean;
  canCreateContent: () => boolean;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  // Status state
  const [isOnline, setIsOnline] = useState(true);
  const [offlineMode, setOfflineModeSt] = useState<'READ_ONLY' | 'FULL_OFFLINE'>('READ_ONLY');
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SYNCING' | 'ERROR'>('IDLE');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [conflictCount, setConflictCount] = useState(0);

  // Initialize from Electron if available
  useEffect(() => {
    const initializeOfflineStatus = async () => {
      if (typeof window !== 'undefined' && (window as any).electron?.offline) {
        try {
          const status = await (window as any).electron.offline.getStatus();
          setIsOnline(status.isOnline);
          setOfflineModeSt(status.offlineMode);
          setSyncStatus(status.syncStatus);

          // Get pending count
          if ((window as any).electron.sync?.queue?.getPending) {
            const pending = await (window as any).electron.sync.queue.getPending();
            setPendingCount(pending?.length || 0);
          }
        } catch (error) {
          console.error('Failed to initialize offline status:', error);
        }
      }
    };

    initializeOfflineStatus();
  }, []);

  // Listen for offline status changes
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electron?.offline) {
      const handleStatusChange = (data: any) => {
        setIsOnline(data.isOnline);
        setOfflineModeSt(data.offlineMode);
      };

      const handleOnlineChange = (data: any) => {
        setIsOnline(data.isOnline);
        if (data.isOnline) {
          // Suggest sync when going online
          console.log('🔄 Device is online - consider syncing your changes');
        }
      };

      (window as any).electron.offline.onStatusChanged(handleStatusChange);
      (window as any).electron.offline.onOnlineStatusChanged(handleOnlineChange);

      return () => {
        (window as any).electron.offline.offStatusChanged(handleStatusChange);
        (window as any).electron.offline.offOnlineStatusChanged(handleOnlineChange);
      };
    }
  }, []);

  // Listen for sync status changes
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electron?.sync) {
      const handleSyncComplete = (data: any) => {
        setSyncStatus('IDLE');
        setLastSyncTime(new Date());
        setPendingCount(0);
        console.log('✓ Sync completed successfully');
      };

      (window as any).electron.sync.onComplete(handleSyncComplete);

      return () => {
        (window as any).electron.sync.offComplete(handleSyncComplete);
      };
    }
  }, []);

  // Actions
  const toggleOfflineMode = useCallback(
    async (mode: 'READ_ONLY' | 'FULL_OFFLINE') => {
      if (typeof window !== 'undefined' && (window as any).electron?.offline?.toggleMode) {
        try {
          const result = await (window as any).electron.offline.toggleMode(mode);
          if (result.success) {
            setOfflineModeSt(mode);
            console.log(`📱 Offline mode changed to: ${mode}`);
          }
        } catch (error) {
          console.error('Failed to toggle offline mode:', error);
          throw error;
        }
      }
    },
    []
  );

  const startSync = useCallback(async () => {
    if (typeof window !== 'undefined' && (window as any).electron?.sync?.start) {
      try {
        setSyncStatus('SYNCING');
        const result = await (window as any).electron.sync.start();
        if (result.success) {
          console.log('🔄 Sync started');
        }
      } catch (error) {
        setSyncStatus('ERROR');
        console.error('Failed to start sync:', error);
        throw error;
      }
    }
  }, []);

  const pauseSync = useCallback(async () => {
    if (typeof window !== 'undefined' && (window as any).electron?.sync?.pause) {
      try {
        const result = await (window as any).electron.sync.pause();
        setSyncStatus('IDLE');
        console.log('⏸ Sync paused');
      } catch (error) {
        console.error('Failed to pause sync:', error);
        throw error;
      }
    }
  }, []);

  const getPendingQueue = useCallback(async () => {
    if (
      typeof window !== 'undefined' &&
      (window as any).electron?.sync?.queue?.getPending
    ) {
      try {
        const result = await (window as any).electron.sync.queue.getPending();
        return result?.data || [];
      } catch (error) {
        console.error('Failed to get pending queue:', error);
        return [];
      }
    }
    return [];
  }, []);

  // Helper functions
  const isOfflineReadOnly = useCallback(
    () => !isOnline && offlineMode === 'READ_ONLY',
    [isOnline, offlineMode]
  );

  const isFullOffline = useCallback(
    () => !isOnline && offlineMode === 'FULL_OFFLINE',
    [isOnline, offlineMode]
  );

  const canCreateContent = useCallback(
    () => isOnline || (offlineMode === 'FULL_OFFLINE' && !isOnline),
    [isOnline, offlineMode]
  );

  const value: OfflineContextType = {
    isOnline,
    offlineMode,
    syncStatus,
    pendingCount,
    lastSyncTime,
    conflictCount,
    toggleOfflineMode,
    startSync,
    pauseSync,
    getPendingQueue,
    isOfflineReadOnly,
    isFullOffline,
    canCreateContent,
  };

  return (
    <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>
  );
}

/**
 * Hook to use offline context
 */
export function useOfflineStatus() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOfflineStatus must be used within OfflineProvider');
  }
  return context;
}
