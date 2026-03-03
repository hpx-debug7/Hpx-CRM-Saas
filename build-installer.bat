@echo off
REM V4U All Rounder - Windows Installer Build Script
REM Builds the production-ready .exe installer

setlocal enabledelayedexpansion

echo.
echo ========================================
echo V4U All Rounder - Installer Builder
echo ========================================
echo.

REM Check if package.json exists
if not exist package.json (
    echo ERROR: package.json not found.
    echo Please run this script from the project root.
    pause
    exit /b 1
)

REM Step 1: Clean previous builds
echo Step 1: Cleaning previous builds...
if exist .next rmdir /s /q .next
if exist out rmdir /s /q out
if exist dist_v2_1_0 rmdir /s /q dist_v2_1_0
echo ✓ Previous builds cleaned
echo.

REM Step 2: Install dependencies
echo Step 2: Installing dependencies...
call npm install
if errorlevel 1 (
    echo ✗ Failed to install dependencies
    pause
    exit /b 1
)
echo ✓ Dependencies installed
echo.

REM Step 3: Build Next.js app
echo Step 3: Building Next.js app...
call npm run build:prod
if errorlevel 1 (
    echo ✗ Next.js build failed
    pause
    exit /b 1
)
echo ✓ Next.js app built successfully
echo.

REM Step 4: Create Windows installer
echo Step 4: Creating Windows installer...
call npm run build-electron:win
if errorlevel 1 (
    echo ✗ Electron build failed
    pause
    exit /b 1
)
echo ✓ Electron app packaged
echo.

REM Display results
echo ========================================
echo ✓ Build Complete!
echo ========================================
echo.

echo Installers created in: dist_v2_1_0\
echo.
echo Look for files named:
echo   - V4U All Rounder Setup 2.1.0.exe
echo.
echo Next steps:
echo 1. Test the installer on your system
echo 2. Share the .exe file with users
echo 3. Users can double-click to install
echo.

pause
