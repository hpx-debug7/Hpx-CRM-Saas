'use client';


import { logger } from '@/lib/client/logger';
import React, { useState, useEffect } from 'react';
import { useOfflineStatus } from '@/app/context/OfflineContext';
import {
  AlertCircle,
  CheckCircle,
  Loader,
  Trash2,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';

export interface PendingItem {
  id: string;
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  createdAt: Date;
  syncedAt: Date | null;
  retryCount: number;
  lastError: string | null;
}

/**
 * Sync Queue Dashboard Component
 * Shows pending operations to be synced to server
 */
export function SyncQueueDashboard() {
  const { getPendingQueue } = useOfflineStatus();
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Load pending items
  const loadPendingItems = async () => {
    setIsLoading(true);
    try {
      const items = await getPendingQueue();
      setPendingItems(items as PendingItem[]);
    } catch (error) {
      logger.error('Failed to load pending items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-load pending items on mount and every 10 seconds
  useEffect(() => {
    loadPendingItems();
    const interval = setInterval(loadPendingItems, 10000);
    return () => clearInterval(interval);
  }, []);

  // Get operation color
  const getOperationColor = (operation: string) => {
    switch (operation) {
      case 'CREATE':
        return 'bg-green-100 text-green-700';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-700';
      case 'DELETE':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Get status indicator
  const getStatusIcon = (item: PendingItem) => {
    if (item.syncedAt) {
      return <CheckCircle size={16} className="text-green-500" />;
    }
    if (item.lastError) {
      return <AlertCircle size={16} className="text-red-500" />;
    }
    return <Loader size={16} className="text-gray-400" />;
  };

  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleTimeString();
  };

  if (!pendingItems.length) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <CheckCircle size={32} className="text-green-500 mx-auto mb-3" />
        <h3 className="font-medium text-gray-900 mb-1">All changes synced</h3>
        <p className="text-sm text-gray-500">No pending operations</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">Sync Queue</h3>
          <p className="text-xs text-gray-500 mt-1">
            {pendingItems.length} pending change
            {pendingItems.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={loadPendingItems}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 transition text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Items List */}
      <div className="divide-y divide-gray-200">
        {pendingItems.map((item) => (
          <div key={item.id}>
            {/* Item Row */}
            <div className="px-6 py-4 hover:bg-gray-50 transition">
              <div className="flex items-start gap-4">
                {/* Status Icon */}
                <div className="flex-shrink-0 mt-1">
                  {getStatusIcon(item)}
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${getOperationColor(
                        item.operation
                      )}`}
                    >
                      {item.operation}
                    </span>
                    <span className="text-sm text-gray-600">
                      {item.entityType}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDate(new Date(item.createdAt))}
                    </span>
                  </div>

                  <p className="text-sm text-gray-500 truncate">
                    ID: {item.entityId}
                  </p>

                  {/* Retry info */}
                  {item.retryCount > 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      Retried {item.retryCount} time
                      {item.retryCount !== 1 ? 's' : ''}
                    </p>
                  )}

                  {/* Error message */}
                  {item.lastError && (
                    <p className="text-xs text-red-600 mt-1">
                      Error: {item.lastError.substring(0, 100)}
                      {item.lastError.length > 100 ? '...' : ''}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex gap-2">
                  <button
                    onClick={() => {
                      setExpandedItems((prev) => {
                        const next = new Set(prev);
                        next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                        return next;
                      });
                    }}
                    className="p-1 hover:bg-gray-200 rounded transition"
                    title="Show details"
                  >
                    <ChevronDown
                      size={16}
                      className={`text-gray-600 transition transform ${
                        expandedItems.has(item.id) ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <button
                    className="p-1 hover:bg-red-100 rounded transition text-red-600"
                    title="Delete from queue"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedItems.has(item.id) && (
                <div className="mt-4 pt-4 border-t border-gray-200 text-xs space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-500 font-medium">Entity Type</p>
                      <p className="text-gray-900">{item.entityType}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium">Entity ID</p>
                      <p className="text-gray-900 break-all">{item.entityId}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium">Operation</p>
                      <p className="text-gray-900">{item.operation}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium">Status</p>
                      <p className="text-gray-900">
                        {item.syncedAt ? 'Synced' : item.lastError ? 'Failed' : 'Pending'}
                      </p>
                    </div>
                  </div>

                  {item.lastError && (
                    <div>
                      <p className="text-gray-500 font-medium">Last Error</p>
                      <p className="text-red-600 break-all">{item.lastError}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 text-xs text-gray-500">
        <p>
          {pendingItems.filter((i) => i.syncedAt).length} of {pendingItems.length}{' '}
          items synced
        </p>
      </div>
    </div>
  );
}
