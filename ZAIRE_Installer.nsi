; ==========================================
; ZAIRE Sovereign Terminal NSIS Setup Builder
; Compile with: makensis ZAIRE_Installer.nsi
; ==========================================

!define APP_NAME "ZAIRE Sovereign Intelligence"
!define APP_VERSION "1.0"
!define APP_PUBLISHER "ZAIRE Sovereign Sphere"
!define APP_EXE "zaire_boot.py"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\ZAIRE"

Name "${APP_NAME}"
OutFile "ZAIRE_Setup.exe"
InstallDir "$PROGRAMFILES64\ZAIRE"
RequestExecutionLevel admin

; Modern UI Configurations
!include "MUI2.nsh"

!define MUI_ABORTWARNING

; Installer Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Uninstaller Pages
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Languages
!insertmacro MUI_LANGUAGE "English"

Section "ZAIRE Core Service" SecCore
  SetOutPath "$INSTDIR"
  
  ; Write application core files (Excluding local developer secrets, db cache, and logs)
  File /r /x "*.env" /x "memory\*.json" /x "*.log" "*.*"
  
  ; Create Desktop Shortcut pointing directly to Python loader
  CreateShortcut "$DESKTOP\ZAIRE.lnk" "python.exe" '"$INSTDIR\zaire_boot.py"' "" "" "" "" "Launch ZAIRE Sovereign Sphere Terminal"
  
  ; Create Start Menu Shortcuts
  CreateDirectory "$SMPROGRAMS\ZAIRE"
  CreateShortcut "$SMPROGRAMS\ZAIRE\ZAIRE.lnk" "python.exe" '"$INSTDIR\zaire_boot.py"'
  CreateShortcut "$SMPROGRAMS\ZAIRE\Uninstall ZAIRE.lnk" "$INSTDIR\Uninstall.exe"
  
  ; -------------------------------------------
  ; Python System Verification
  ; -------------------------------------------
  DetailPrint "Auditing Python client framework..."
  nsExec::ExecToStack 'python --version'
  Pop $0 ; Exit Code
  Pop $1 ; Version String
  
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "Python 3.10+ is required to launch ZAIRE local neural cores. Please install Python and ensure you check the 'Add Python to PATH' option."
    ExecShell "open" "https://www.python.org/downloads/"
    Abort
  ${EndIf}

  DetailPrint "System check complete: Python $1 detected."

  ; -------------------------------------------
  ; Dependency silent installation
  ; -------------------------------------------
  DetailPrint "Deploying neural specialist requirements..."
  nsExec::ExecToLog 'pip install requests tk cryptography pyyaml psutil --quiet'
  Pop $0
  
  ; Write Registry strings for Windows Add/Remove programs list
  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "QuietUninstallString" "$INSTDIR\Uninstall.exe /S"
  WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoRepair" 1

  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  ; Remove Desktop and Start Menu Shortcuts
  Delete "$DESKTOP\ZAIRE.lnk"
  Delete "$SMPROGRAMS\ZAIRE\ZAIRE.lnk"
  Delete "$SMPROGRAMS\ZAIRE\Uninstall ZAIRE.lnk"
  RMDir "$SMPROGRAMS\ZAIRE"
  
  ; Clean up registry records
  DeleteRegKey HKLM "${UNINSTALL_KEY}"
  
  ; Wipe installation root files cleanly
  RMDir /r "$INSTDIR"
SectionEnd
