; V4U All Rounder - Windows NSIS Installer Script
; Professional CRM and Lead Management System
;
; This script customizes the installer using electron-builder NSIS macros

!macro customInstall
  ; Create application entry in registry
  WriteRegStr HKCU "Software\V4U All Rounder" "InstallPath" "$INSTDIR"
  WriteRegStr HKCU "Software\V4U All Rounder" "Version" "2.1.0"
  WriteRegStr HKCU "Software\V4U All Rounder" "Publisher" "V4U Biz Solutions"
  
  ; Create Data directory for database
  CreateDirectory "$INSTDIR\data"
!macroend

!macro customUnInstall
  ; Clean up registry
  DeleteRegKey HKCU "Software\V4U All Rounder"
!macroend
