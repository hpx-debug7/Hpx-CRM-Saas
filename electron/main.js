const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const { initializeIPCHandlers, startOnlineStatusMonitoring } = require('./ipcHandlers');

// Global variables
let mainWindow;
let serverProcess;
let port = 3000;
let serverReady = false;

// Find an available port
function findPort(startPort) {
  return new Promise((resolve) => {
    const server = require('net').createServer();
    server.listen(startPort, () => {
      const foundPort = server.address().port;
      server.close(() => resolve(foundPort));
    });
    server.on('error', () => {
      resolve(findPort(startPort + 1));
    });
  });
}

// Copy database if needed
function ensureDatabase() {
  const dbDir = path.join(app.getPath('userData'), 'database');
  const dbPath = path.join(dbDir, 'app.db');

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Copy seed database if no database exists yet
  if (!fs.existsSync(dbPath)) {
    const seedDb = path.join(process.resourcesPath, 'app', 'dev.db');
    if (fs.existsSync(seedDb)) {
      fs.copyFileSync(seedDb, dbPath);
      console.log('Copied seed database to:', dbPath);
    }
  }

  return dbPath;
}

// Start Next.js server in production mode
function createServer() {
  return new Promise(async (resolve, reject) => {
    // Find available port
    port = await findPort(port);
    console.log(`Using port: ${port}`);

    // Path to the standalone server
    const serverPath = path.join(process.resourcesPath, 'app', '.next', 'standalone');
    const serverScript = path.join(serverPath, 'server.js');
    const useStandalone = fs.existsSync(serverScript);

    console.log(`Server path: ${serverPath}`);
    console.log(`Server script: ${serverScript}`);
    console.log(`Standalone exists: ${useStandalone}`);

    // List directory for debugging
    if (fs.existsSync(path.join(process.resourcesPath, 'app'))) {
      console.log('App resources:', fs.readdirSync(path.join(process.resourcesPath, 'app')));
    }
    if (fs.existsSync(serverPath)) {
      console.log('Standalone dir:', fs.readdirSync(serverPath));
    }

    // Setup database
    const dbPath = ensureDatabase();

    // Environment for the server
    const env = {
      ...process.env,
      PORT: port.toString(),
      NODE_ENV: 'production',
      DATABASE_PATH: dbPath,
      DATABASE_URL: `file:${dbPath}`,
      // CRITICAL: This makes Electron's bundled Node.js act as regular Node
      ELECTRON_RUN_AS_NODE: '1',
    };

    if (useStandalone) {
      console.log('Starting standalone server with Electron Node.js...');
      // Use process.execPath (Electron binary) with ELECTRON_RUN_AS_NODE=1
      // This makes Electron act as a regular Node.js runtime
      serverProcess = spawn(process.execPath, [serverScript], {
        cwd: serverPath,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } else {
      console.log('WARNING: Standalone build not found!');
      // Show error to user
      if (mainWindow) {
        mainWindow.webContents.loadURL(`data:text/html,<html><body style="background:#1a1a2e;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><div><h1>Server Error</h1><p>Standalone build not found at: ${serverPath}</p></div></body></html>`);
      }
      reject(new Error('Standalone build not found'));
      return;
    }

    let resolved = false;

    // Handle server stdout
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('[Next.js]', output);

      // Check if server is ready
      if (!resolved && (
        output.includes('Ready') || 
        output.includes(`localhost:${port}`) || 
        output.includes('started') ||
        output.includes('Listening')
      )) {
        resolved = true;
        serverReady = true;
        resolve();
      }
    });

    // Handle server stderr
    serverProcess.stderr.on('data', (data) => {
      console.error('[Next.js Error]', data.toString());
    });

    // Handle server exit
    serverProcess.on('error', (err) => {
      console.error('Failed to start server:', err);
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    serverProcess.on('exit', (code) => {
      console.log(`Server process exited with code ${code}`);
      if (!resolved) {
        resolved = true;
        if (code !== 0) {
          reject(new Error(`Server exited with code ${code}`));
        }
      }
    });

    // Timeout fallback - try polling the server
    setTimeout(async () => {
      if (!resolved) {
        console.log('Timeout reached, polling server...');
        const isReady = await waitForServer(30, 500);
        if (!resolved) {
          resolved = true;
          if (isReady) {
            serverReady = true;
            resolve();
          } else {
            // Last resort: resolve anyway and try to load
            resolve();
          }
        }
      }
    }, 5000);
  });
}

// Wait for server to be ready by polling
async function waitForServer(maxAttempts = 30, delay = 500) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}/`, (res) => {
          if (res.statusCode === 200 || res.statusCode === 302 || res.statusCode === 301) {
            resolve();
          } else {
            reject(new Error(`Status ${res.statusCode}`));
          }
          res.resume(); // Consume response data
        });
        req.on('error', reject);
        req.setTimeout(2000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      console.log(`Server ready after ${attempt + 1} attempts`);
      return true;
    } catch (err) {
      console.log(`Poll attempt ${attempt + 1}/${maxAttempts}: ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.warn('Server health check failed after all attempts');
  return false;
}

// Show a loading screen while server starts
function getLoadingHTML() {
  return `data:text/html;charset=utf-8,${encodeURIComponent(`
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      overflow: hidden;
    }
    .container {
      text-align: center;
      animation: fadeIn 0.5s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .logo {
      font-size: 48px;
      font-weight: 700;
      background: linear-gradient(to right, #667eea, #764ba2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 16px;
    }
    .subtitle {
      font-size: 18px;
      color: #a0aec0;
      margin-bottom: 40px;
    }
    .spinner {
      width: 50px;
      height: 50px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top: 3px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 24px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .status {
      font-size: 14px;
      color: #718096;
    }
    .dots::after {
      content: '';
      animation: dots 1.5s steps(4, end) infinite;
    }
    @keyframes dots {
      0% { content: ''; }
      25% { content: '.'; }
      50% { content: '..'; }
      75% { content: '...'; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">V4U All Rounder</div>
    <div class="subtitle">Enterprise Lead Management System</div>
    <div class="spinner"></div>
    <div class="status">Starting application<span class="dots"></span></div>
  </div>
</body>
</html>
  `)}`;
}

// Create the main window
function createWindow() {
  const windowOptions = {
    width: 1280,
    height: 800,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Enterprise Lead & Process Management System',
    show: false,
    backgroundColor: '#0f0c29',
  };

  // Only set icon in development mode
  if (!app.isPackaged) {
    windowOptions.icon = path.join(__dirname, '../build/icon.ico');
  }

  mainWindow = new BrowserWindow(windowOptions);

  // Load the app
  if (app.isPackaged) {
    // Show loading screen immediately
    mainWindow.loadURL(getLoadingHTML());
    mainWindow.show();

    // Start Next.js server, then load the app
    createServer().then(async () => {
      console.log('Server started, waiting for it to be fully ready...');
      // Poll until server actually responds
      await waitForServer(60, 500);
      console.log('Server confirmed ready, loading app...');
      mainWindow.loadURL(`http://localhost:${port}`);
    }).catch((err) => {
      console.error('Failed to start server:', err);
      mainWindow.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
        <html><body style="background:#1a1a2e;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
          <div style="text-align:center;max-width:600px;">
            <h1 style="color:#e53e3e;">Server Failed to Start</h1>
            <p style="color:#a0aec0;margin:16px 0;">${err.message}</p>
            <p style="color:#718096;font-size:14px;">Please try restarting the application. If the problem persists, contact support.</p>
            <button onclick="window.location.reload()" style="margin-top:20px;padding:10px 20px;background:#667eea;color:white;border:none;border-radius:8px;cursor:pointer;font-size:16px;">Retry</button>
          </div>
        </body></html>
      `)}`);
    });
  } else {
    // Development: Load from Next.js dev server
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.show();
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle window ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { type: 'separator' },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Toggle Fullscreen', accelerator: 'F11', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Toggle Developer Tools', accelerator: 'F12', role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About V4U All Rounder',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About',
              message: 'V4U All Rounder',
              detail: 'Version 2.1.0\nEnterprise Lead & Process Management System\n\n© 2026 V4U Biz Solutions'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App event handlers
app.whenReady().then(() => {
  createWindow();
  createMenu();

  // Initialize IPC handlers for sync, offline, and database operations
  initializeIPCHandlers();

  // Start monitoring online/offline status
  startOnlineStatusMonitoring();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle app quit - kill server process
app.on('before-quit', () => {
  if (serverProcess) {
    try {
      // On Windows, we need to kill the process tree
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', serverProcess.pid.toString(), '/f', '/t']);
      } else {
        serverProcess.kill('SIGTERM');
      }
    } catch (e) {
      console.error('Error killing server process:', e);
    }
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});
