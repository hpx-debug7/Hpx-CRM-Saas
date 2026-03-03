# V4U All Rounder - Windows Installer Setup Guide

**Application**: V4U All Rounder - Enterprise Lead Management System
**Version**: 2.1.0
**Type**: Offline-First Desktop Application
**Platform**: Windows 10/11 (64-bit)

---

## 🚀 Quick Start for End Users

### Installing the Application

1. **Download** `V4U All Rounder Setup 2.1.0.exe`
2. **Double-click** the installer file
3. **Follow the wizard**:
   - Accept the license agreement
   - Choose installation folder (default: `C:\Program Files\V4U All Rounder`)
   - Select shortcuts options
   - Click "Install"
4. **Launch automatically** or click the desktop shortcut
5. **Login** with your credentials

---

## 💻 Building the Installer (For Developers)

### Prerequisites

- Windows 10/11 (64-bit)
- Node.js 16+ and npm
- Project directory: `h:\Sales-Funnel-2.1 -Bugs Fixing and Process department`

### Build Methods

#### Method 1: Using PowerShell (Recommended)

```powershell
cd "h:\Sales-Funnel-2.1 -Bugs Fixing and Process department"
.\build-installer.ps1
```

#### Method 2: Using npm commands

```bash
cd "h:\Sales-Funnel-2.1 -Bugs Fixing and Process department"

# Full build
npm install
npm run build:prod
npm run build-electron:win
```

#### Method 3: Single command

```bash
npm run dist:win
```

### Build Output

Installer location:
```
dist_v2_1_0/
└── V4U All Rounder Setup 2.1.0.exe (~250 MB)
```

---

## 📦 What Gets Installed

### Directories Created

**Program Files**:
```
C:\Program Files\V4U All Rounder\
├── V4U All Rounder.exe
├── resources\
├── locales\
└── [Electron app files]
```

**User AppData**:
```
%APPDATA%\V4U All Rounder\
├── database\
│   └── app.db (Offline sync queue & local data)
├── logs\
└── preferences.json
```

### System Requirements

| Item | Requirement |
|------|-------------|
| OS | Windows 10/11 (64-bit) |
| RAM | 4 GB minimum |
| Storage | 500 MB free |
| Internet | Optional (works offline) |

---

## ⚙️ Installation Options

During setup wizard:

- **Location**: Choose custom install path
- **Shortcuts**: Desktop and Start Menu
- **Auto-launch**: Start app after installation
- **License**: Review and accept MIT License

### Uninstalling

1. Settings → "Add or remove programs"
2. Search "V4U All Rounder"
3. Click "Uninstall"

Alternative: Run `Uninstall.exe` from installation folder

---

## 🔧 Configuration

### Environment Variables

Edit in: `%APPDATA%\V4U All Rounder\`

```
DEVICE_ID=desktop-client-1
SYNC_API_KEY=your-api-key
SYNC_SERVER_URL=https://your-backend.com
```

### Database

- **Location**: `%APPDATA%\V4U All Rounder\database\app.db`
- **Type**: SQLite3
- **Size**: ~50-100 MB per 1000 leads

---

## ❓ Troubleshooting

### "Windows protected your PC"

**Solution**: Click "More info" → "Run anyway"

This appears because the installer isn't code-signed. To remove this:
1. Get code-signing certificate from trusted CA
2. Configure in `package.json` build section
3. Rebuild installer

### Installer fails to run

**Check**:
1. Close V4U All Rounder if open
2. Ensure Admin rights
3. Check 2 GB free disk space
4. Disable antivirus temporarily

### App won't start

**Check**:
1. Port 3000 not in use: `netstat -ano | findstr :3000`
2. Run as Administrator
3. Check logs: `%APPDATA%\V4U All Rounder\logs\`

---

## 📋 Features Included

✅ **Offline-First Architecture**
- Works seamlessly online & offline
- Automatic data synchronization
- SQLite local database

✅ **Lead Management**
- Create/edit/delete leads
- Lead assignment & tracking
- Custom fields support

✅ **Email Integration**
- Gmail & Outlook support
- Email sync & queue
- Offline email drafting

✅ **Audit & Security**
- User authentication
- Audit logging
- Role-based access

✅ **Sync Features**
- Bidirectional sync
- Conflict resolution
- Version tracking

---

## 📊 File Sizes

| Component | Size |
|-----------|------|
| Installer | ~250 MB |
| Installed App | ~200 MB |
| Database (1k leads) | ~50-100 MB |
| Total after install | ~250 MB |

---

## 🚀 Distribution

### Sharing with Users

1. **Direct Download**: Upload `.exe` to file server
2. **Email**: Send installer as attachment (large file)
3. **USB Drive**: Copy installer to portable drive
4. **Network Share**: `\\server\software\V4U-AllRounder\`
5. **Cloud**: OneDrive, Google Drive, Dropbox

### Silent Installation

For IT deployment:

```batch
"V4U All Rounder Setup 2.1.0.exe" /S /D=C:\Program Files\V4U All Rounder
```

---

## 🔄 Updates

### Checking for Updates

Currently: Manual update required
- Download new installer
- Run installer (will upgrade existing)

Or download `.exe` file and run directly

### Future: Auto-Updates

Configure GitHub releases:
1. Create GitHub repo
2. Set `UPDATE_SERVER_URL` environment variable
3. Use electron-updater

---

## 📞 Support Information

**Company**: V4U Biz Solutions
**Website**: https://www.v4ubiz.com
**App**: V4U All Rounder v2.1.0
**Type**: Offline-First Enterprise CRM
**License**: MIT

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `build-installer.ps1` | PowerShell build script |
| `build/installer.nsh` | NSIS customization |
| `build/license.txt` | License agreement |
| `package.json` | Build configuration |
| `INSTALLER_GUIDE.md` | This file |

---

## ✅ Release Checklist

Before distributing:

- [ ] Build successful locally
- [ ] Installer file created: `V4U All Rounder Setup 2.1.0.exe`
- [ ] Test install on clean Windows VM
- [ ] Verify offline functionality works
- [ ] Test database sync
- [ ] Confirm shortcuts created
- [ ] Test uninstall completely
- [ ] Update documentation
- [ ] Version bumped in package.json

---

**Ready to deploy!** 🎉

Click the `V4U All Rounder Setup 2.1.0.exe` file to begin installation.
