# V4U All Rounder - Windows Installer Build Script
# Builds the production-ready .exe installer

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "V4U All Rounder - Installer Builder" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: package.json not found. Please run this script from the project root." -ForegroundColor Red
    exit 1
}

Write-Host "Step 1: Cleaning previous builds..." -ForegroundColor Yellow
Remove-Item -Path ".\.next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".\out" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".\dist_v2_1_0" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "✓ Previous builds cleaned" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2: Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Dependencies installed" -ForegroundColor Green
Write-Host ""

Write-Host "Step 3: Building Next.js app..." -ForegroundColor Yellow
npm run build:prod
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Next.js build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Next.js app built successfully" -ForegroundColor Green
Write-Host ""

Write-Host "Step 4: Creating Windows installer..." -ForegroundColor Yellow
npm run build-electron:win
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Electron build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Electron app packaged" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✓ Build Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Find and display the installer file
$installerFiles = Get-ChildItem -Path ".\dist_v2_1_0" -Filter "*.exe" -Recurse
if ($installerFiles.Count -gt 0) {
    Write-Host "Installers created:" -ForegroundColor Yellow
    foreach ($file in $installerFiles) {
        Write-Host "  - $($file.Name)" -ForegroundColor Green
        Write-Host "    Path: $($file.FullName)" -ForegroundColor Green
        Write-Host "    Size: $([Math]::Round($file.Length / 1MB, 2)) MB" -ForegroundColor Green
    }
} else {
    Write-Host "⚠ No installer files found. Check the dist_v2_1_0 directory." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Copy the .exe installer to your deployment location" -ForegroundColor Cyan
Write-Host "2. Share with users to click and install" -ForegroundColor Cyan
Write-Host "3. Run 'npm run electron-dev' to test locally first" -ForegroundColor Cyan
Write-Host ""
