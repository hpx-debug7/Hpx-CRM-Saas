'use client';

import React, { useState, useEffect } from 'react';
import { useOfflineStatus } from '@/app/context/OfflineContext';
import { CloudOff, Clock, AlertCircle, Loader, CheckCircle } from 'lucide-react';

/**
 * Offline Status Bar Component
 * Shows online status, sync progress, pending items, and mode toggle
 */
export function OfflineStatusBar() {
  const {
    isOnline,
    offlineMode,
    syncStatus,
    pendingCount,
    lastSyncTime,
    toggleOfflineMode,
    startSync,
  } = useOfflineStatus();

  const [showSyncDetails, setShowSyncDetails] = useState(false);
  const [isTogglingMode, setIsTogglingMode] = useState(false);

  // Format last sync time
  const formatSyncTime = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  if (!isOnline && offlineMode === 'READ_ONLY') {
    // Read-only offline mode - show compact bar
    return (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-amber-700">
            <CloudOff size={16} className="flex-shrink-0" />
            <span>Offline (Read-Only Mode)</span>
          </div>
          <button
            onClick={() => setIsTogglingMode(true)}
            className="text-xs px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 transition"
          >
            Enable Editing
          </button>
        </div>

        {/* Mode Toggle Modal */}
        {isTogglingMode && (
          <ModeToggleModal
            onConfirm={async () => {
              await toggleOfflineMode('FULL_OFFLINE');
              setIsTogglingMode(false);
            }}
            onCancel={() => setIsTogglingMode(false)}
          />
        )}
      </div>
    );
  }

  if (!isOnline && offlineMode === 'FULL_OFFLINE') {
    // Full offline mode - show sync queue and mode toggle
    return (
      <div className="bg-orange-50 border-b border-orange-200 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CloudOff size={16} className="flex-shrink-0 text-orange-600" />
            <span className="text-sm font-medium text-orange-700">
              Offline Mode - Changes will sync when online
            </span>
          </div>
          <button
            onClick={() => setShowSyncDetails(!showSyncDetails)}
            className="text-xs px-2 py-1 rounded bg-orange-100 hover:bg-orange-200 text-orange-800 transition"
          >
            {showSyncDetails ? 'Hide' : 'Show'} Details
          </button>
        </div>

        {/* Pending items indicator */}
        {pendingCount > 0 && (
          <div className="text-xs text-orange-600 mb-2">
            {pendingCount} pending change{pendingCount !== 1 ? 's' : ''}
          </div>
        )}

        {showSyncDetails && (
          <div className="bg-white rounded p-3 text-xs space-y-2 border border-orange-100 mt-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Last sync:</span>
              <span className="font-medium">{formatSyncTime(lastSyncTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Sync status:</span>
              <span
                className={`font-medium ${
                  syncStatus === 'IDLE'
                    ? 'text-green-600'
                    : syncStatus === 'SYNCING'
                    ? 'text-blue-600'
                    : 'text-red-600'
                }`}
              >
                {syncStatus.toUpperCase()}
              </span>
            </div>
            <button
              onClick={() => toggleOfflineMode('READ_ONLY')}
              className="text-xs px-2 py-1 rounded bg-orange-100 hover:bg-orange-200 text-orange-800 transition mt-2 w-full"
            >
              Switch to Read-Only
            </button>
          </div>
        )}
      </div>
    );
  }

  // Online mode - show sync status
  return (
    <div className="bg-green-50 border-b border-green-200 px-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          {/* Online indicator */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-700 font-medium">Online</span>
          </div>

          {/* Sync status */}
          <div className="flex items-center gap-2">
            {syncStatus === 'SYNCING' && (
              <>
                <Loader size={14} className="animate-spin text-blue-500" />
                <span className="text-gray-600">Syncing...</span>
              </>
            )}
            {syncStatus === 'IDLE' && (
              <>
                <CheckCircle size={14} className="text-green-500" />
                <span className="text-gray-600">
                  Synced {formatSyncTime(lastSyncTime)}
                </span>
              </>
            )}
            {syncStatus === 'ERROR' && (
              <>
                <AlertCircle size={14} className="text-red-500" />
                <span className="text-red-600">Sync error</span>
              </>
            )}
          </div>

          {/* Pending count */}
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-2 py-1 bg-yellow-100 rounded text-yellow-700 text-xs">
              <AlertCircle size={12} />
              {pendingCount} pending
            </div>
          )}
        </div>

        <button
          onClick={() => startSync()}
          disabled={syncStatus === 'SYNCING'}
          className="text-xs px-3 py-1 rounded bg-green-100 hover:bg-green-200 text-green-800 transition disabled:opacity-50"
        >
          Sync Now
        </button>
      </div>
    </div>
  );
}

/**
 * Mode Toggle Confirmation Modal
 */
function ModeToggleModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-lg">
        <h3 className="text-lg font-bold mb-2">Enable Offline Editing?</h3>
        <p className="text-gray-600 text-sm mb-4">
          You will be able to create and edit leads offline. Changes will be queued
          and synced automatically when you go online.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-orange-500 text-white hover:bg-orange-600 transition text-sm font-medium"
          >
            Enable
          </button>
        </div>
      </div>
    </div>
  );
}
