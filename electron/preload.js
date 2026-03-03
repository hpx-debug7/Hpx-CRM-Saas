const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // ============================================================================
  // FILE SYSTEM OPERATIONS (Existing)
  // ============================================================================
  saveFile: (path, content) => ipcRenderer.invoke('save-file', path, content),
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  createDirectory: (path) => ipcRenderer.invoke('create-directory', path),
  exists: (path) => ipcRenderer.invoke('file-exists', path),
  joinPath: (...args) => ipcRenderer.invoke('join-path', ...args),
  getDocumentsPath: () => ipcRenderer.invoke('get-documents-path'),
  platform: process.platform,

  // ============================================================================
  // DATABASE OPERATIONS (NEW)
  // ============================================================================
  db: {
    leads: {
      get: (filters) => ipcRenderer.invoke('db:leads:get', filters),
      create: (data) => ipcRenderer.invoke('db:leads:create', data),
      update: (id, data) => ipcRenderer.invoke('db:leads:update', id, data),
      delete: (id) => ipcRenderer.invoke('db:leads:delete', id),
    },
  },

  // ============================================================================
  // SYNC OPERATIONS (NEW)
  // ============================================================================
  sync: {
    getStatus: () => ipcRenderer.invoke('sync:getStatus'),
    start: () => ipcRenderer.invoke('sync:start'),
    pause: () => ipcRenderer.invoke('sync:pause'),
    queue: {
      getPending: () => ipcRenderer.invoke('sync:queue:getPending'),
    },
    onComplete: (callback) =>
      ipcRenderer.on('sync:complete', (event, data) => callback(data)),
    offComplete: (callback) =>
      ipcRenderer.removeListener('sync:complete', callback),
  },

  // ============================================================================
  // OFFLINE MODE (NEW)
  // ============================================================================
  offline: {
    getStatus: () => ipcRenderer.invoke('app:getOfflineStatus'),
    toggleMode: (mode) => ipcRenderer.invoke('app:toggleOfflineMode', mode),
    onStatusChanged: (callback) =>
      ipcRenderer.on('app:offlineStatusChanged', (event, data) => callback(data)),
    offStatusChanged: (callback) =>
      ipcRenderer.removeListener('app:offlineStatusChanged', callback),
    onOnlineStatusChanged: (callback) =>
      ipcRenderer.on('app:onlineStatusChanged', (event, data) => callback(data)),
    offOnlineStatusChanged: (callback) =>
      ipcRenderer.removeListener('app:onlineStatusChanged', callback),
  },

  // ============================================================================
  // EMAIL QUEUE OPERATIONS (NEW)
  // ============================================================================
  email: {
    queue: {
      draft: (emailData) =>
        ipcRenderer.invoke('email:queue:draft', emailData),
      getPending: () => ipcRenderer.invoke('email:queue:getPending'),
      send: (emailId) => ipcRenderer.invoke('email:queue:send', emailId),
      delete: (emailId) => ipcRenderer.invoke('email:queue:delete', emailId),
      onQueueChanged: (callback) =>
        ipcRenderer.on('email:queueChanged', (event, data) => callback(data)),
      offQueueChanged: (callback) =>
        ipcRenderer.removeListener('email:queueChanged', callback),
    },
  },
});
