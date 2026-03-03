# Delivery Checklist

## Pre-Build Checklist

- [ ] Verify build/icon.ico exists and is multi-resolution (16-256px)
- [ ] Verify build/installerIcon.ico exists and is multi-resolution (16-256px)
- [ ] Test icons display correctly in Windows Explorer
- [ ] Confirm icon file sizes are reasonable (50-200 KB each)

### Manual ICO Multi-Resolution Verification Steps

**For each icon file (build/icon.ico and build/installerIcon.ico):**

1. **Windows Explorer Method:**
   - Right-click the ICO file in Windows Explorer
   - Select "Properties" from the context menu
   - In the Properties dialog, look for multiple icon sizes listed
   - Verify the following sizes are present: 16x16, 32x32, 48x48, 64x64, 128x128, 256x256 pixels

2. **File Size Indicators:**
   - Multi-resolution ICO files typically range from 50-200 KB
   - Files smaller than 10 KB may be single-resolution only
   - Files larger than 1 MB may have unnecessary data or corruption

3. **Visual Quality Check:**
   - Open the ICO file in an image viewer
   - Verify the icon appears crisp and clear
   - Check that transparency (if present) renders correctly
   - Ensure the design is professional and appropriate for enterprise software

4. **Build Script Validation:**
   - Run `node scripts/package-for-client.js` to execute automated validation
   - Check console output for any warnings about file size or format
   - Ensure all validation checks pass before proceeding with build

## Build Checklist

- [ ] Clean previous builds (`npm run clean:win`)
- [ ] Verify all build resources exist:
  - [ ] build/icon.ico
  - [ ] build/installerIcon.ico
  - [ ] build/installerHeaderIcon.ico
  - [ ] build/license.txt
  - [ ] build/installer.nsh
- [ ] Verify all documentation files exist:
  - [ ] CLIENT_INSTALLATION_GUIDE.md
  - [ ] LAUNCH_INSTRUCTIONS.md
  - [ ] PERFORMANCE_OPTIMIZATION.md
  - [ ] README.txt
- [ ] Run complete build: `npm run package:client`
- [ ] Monitor build output for errors or warnings
- [ ] Verify build completed without errors
- [ ] Check that delivery/ folder was created
- [ ] Run post-build verification: `npm run verify:build`
- [ ] Review VERIFICATION_REPORT.txt in delivery/ folder
- [ ] Check installer file size (should be 100-200MB)
- [ ] Verify PACKAGE_CONTENTS.txt was generated
- [ ] Verify BUILD_INFO.txt was generated
- [ ] Review build-log.txt for any issues

## Automated Build Validation

The `package-for-client.js` script automatically validates:
- ✅ All icon files exist and are properly formatted
- ✅ All documentation files exist and are not empty
- ✅ All NSIS resources exist (license, installer script, header icon)
- ✅ Required directories exist (electron/, app/, scripts/)
- ✅ Dependencies are installed (node_modules/)
- ✅ Next.js build completes successfully
- ✅ Electron Builder creates installer
- ✅ Delivery package is assembled correctly

The `verify-build.js` script automatically verifies:
- ✅ Installer exists and is within expected size range
- ✅ Installer integrity (SHA256 checksum)
- ✅ All delivery package files are present
- ✅ Package manifest matches actual files
- ✅ Build configuration is correct

If any validation fails, the scripts provide actionable recovery suggestions.

## Testing Checklist

- [ ] Verify installer .exe shows correct icon in Windows Explorer
- [ ] Verify installed application shows correct icon in taskbar
- [ ] Verify application icon appears in Start Menu
- [ ] Verify icon appears correctly in Alt+Tab switcher
- [ ] Check icon quality at different sizes (16px, 32px, 48px, 256px)
