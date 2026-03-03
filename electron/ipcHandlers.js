/**
 * IPC Handlers for Electron Main Process
 * Exposes database, sync, offline, and email queue operations to renderer
 */

const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let offlineMode = 'READ_ONLY'; // READ_ONLY or FULL_OFFLINE
let isOnline = true;
let syncInProgress = false;

// Import services (will be available after Node.js process initialization)
let SyncQueueService;
let EmailQueueService;
let SyncEngine;

/**
 * Initialize IPC handlers - call this after services are loaded
 */
async function initializeIPCHandlers() {
  // Lazy-load services from Next.js process via HTTP calls to avoid node_modules issues

  // ============================================================================
  // DATABASE OPERATIONS
  // ============================================================================

  ipcMain.handle('db:leads:get', async (event, filters = {}) => {
    try {
      const response = await fetch('http://localhost:3000/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', filters }),
      });
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('DB leads:get error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db:leads:create', async (event, leadData) => {
    try {
      const response = await fetch('http://localhost:3000/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          data: leadData,
        }),
      });
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('DB leads:create error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db:leads:update', async (event, leadId, leadData) => {
    try {
      const response = await fetch('http://localhost:3000/api/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: leadId,
          data: leadData,
        }),
      });
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('DB leads:update error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db:leads:delete', async (event, leadId) => {
    try {
      const response = await fetch(`http://localhost:3000/api/leads/${leadId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('DB leads:delete error:', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // SYNC OPERATIONS
  // ============================================================================

  ipcMain.handle('sync:getStatus', async (event) => {
    try {
      return {
        isOnline,
        offlineMode,
        syncInProgress,
        lastSyncTime: new Date(), // TODO: track actual last sync time
      };
    } catch (error) {
      console.error('sync:getStatus error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('sync:start', async (event) => {
    if (syncInProgress) {
      return { success: false, error: 'Sync already in progress' };
    }

    try {
      syncInProgress = true;

      // Trigger sync via API
      const response = await fetch('http://localhost:3000/api/v2/sync/start', {
        method: 'POST',
      });

      const result = await response.json();
      syncInProgress = false;

      // Broadcast sync complete event
      if (event.sender) {
        event.sender.send('sync:complete', result);
      }

      return { success: true, data: result };
    } catch (error) {
      console.error('sync:start error:', error);
      syncInProgress = false;
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('sync:pause', async (event) => {
    syncInProgress = false;
    return { success: true };
  });

  ipcMain.handle('sync:queue:getPending', async (event) => {
    try {
      const response = await fetch('http://localhost:3000/api/v2/sync/queue/pending');
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('sync:queue:getPending error:', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // OFFLINE MODE
  // ============================================================================

  ipcMain.handle('app:getOfflineStatus', async (event) => {
    return {
      isOnline,
      offlineMode,
      syncStatus: syncInProgress ? 'SYNCING' : 'IDLE',
    };
  });

  ipcMain.handle('app:toggleOfflineMode', async (event, mode) => {
    if (mode !== 'READ_ONLY' && mode !== 'FULL_OFFLINE') {
      return { success: false, error: 'Invalid offline mode' };
    }

    offlineMode = mode;

    // Broadcast to all windows
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('app:offlineStatusChanged', {
        isOnline,
        offlineMode,
      });
    });

    return { success: true, offlineMode };
  });

  // ============================================================================
  // EMAIL QUEUE OPERATIONS
  // ============================================================================

  ipcMain.handle('email:queue:draft', async (event, emailData) => {
    try {
      const response = await fetch('http://localhost:3000/api/v2/email/queue/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData),
      });
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('email:queue:draft error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('email:queue:getPending', async (event) => {
    try {
      const response = await fetch('http://localhost:3000/api/v2/email/queue/pending');
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('email:queue:getPending error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('email:queue:send', async (event, emailId) => {
    try {
      const response = await fetch('http://localhost:3000/api/v2/email/queue/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId }),
      });
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('email:queue:send error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('email:queue:delete', async (event, emailId) => {
    try {
      const response = await fetch(`http://localhost:3000/api/v2/email/queue/${emailId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('email:queue:delete error:', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================================================
  // EXISTING FILE SYSTEM OPERATIONS (Keep as is)
  // ============================================================================

  ipcMain.handle('get-documents-path', async () => {
    const { app } = require('electron');
    return app.getPath('userData');
  });

  ipcMain.handle('join-path', async (event, ...args) => {
    return path.join(...args);
  });

  ipcMain.handle('create-directory', async (event, dirPath) => {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return { success: true };
    } catch (error) {
      console.error('Error creating directory:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('save-file', async (event, filePath, content) => {
    try {
      if (typeof content === 'string' && content.includes('base64,')) {
        const base64Data = content.split('base64,')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        await fs.writeFile(filePath, buffer);
      } else {
        await fs.writeFile(filePath, content);
      }
      return { success: true };
    } catch (error) {
      console.error('Error saving file:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('read-file', async (event, filePath) => {
    try {
      const buffer = await fs.readFile(filePath);
      return { success: true, data: buffer.toString('base64') };
    } catch (error) {
      console.error('Error reading file:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('file-exists', async (event, filePath) => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  });

  console.log('✓ IPC Handlers initialized successfully');
}

/**
 * Monitor online/offline status
 */
function startOnlineStatusMonitoring() {
  const { BrowserWindow } = require('electron');
  const http = require('http');

  // Check every 5 seconds
  setInterval(() => {
    const req = http.get('http://localhost:3000/health', (res) => {
      const wasOffline = !isOnline;
      isOnline = res.statusCode === 200;

      // If came back online and has pending items, suggest sync
      if (wasOffline && isOnline) {
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send('app:onlineStatusChanged', {
            isOnline: true,
            suggestion: 'Sync your changes',
          });
        });
      } else if (isOnline && !wasOffline) {
        // Just update status
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send('app:onlineStatusChanged', {
            isOnline: false,
          });
        });
      }

      req.destroy();
    });

    req.on('error', () => {
      const wasOnline = isOnline;
      isOnline = false;

      // If went offline, notify
      if (wasOnline) {
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send('app:onlineStatusChanged', {
            isOnline: false,
          });
        });
      }

      req.destroy();
    });

    req.setTimeout(2000, () => req.destroy());
  }, 5000);
}

module.exports = {
  initializeIPCHandlers,
  startOnlineStatusMonitoring,
  getOfflineMode: () => offlineMode,
  setOfflineMode: (mode) => { offlineMode = mode; },
  isOnlineStatus: () => isOnline,
  setOnlineStatus: (status) => { isOnline = status; },
};
