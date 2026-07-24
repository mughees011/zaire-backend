; ZAIRE Sovereign Intelligence Platform - Professional Installer Script
; Requires NSIS (Nullsoft Scriptable Install System) to compile
; Compile this file by right-clicking it and selecting "Compile NSIS Script"

!define APPNAME "ZAIRE Sovereign Intelligence"
!define APPCOMPANY "ZAIRE"
!define APPVERSION "1.0.0"
!define APPEXECUTABLE "launch_zaire.bat"

; Registry keys for Add/Remove Programs
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
!define REG_KEY "Software\${APPCOMPANY}\${APPNAME}"

Name "${APPNAME} ${APPVERSION}"
OutFile "ZAIRE_Setup_v${APPVERSION}.exe"
InstallDir "$PROGRAMFILES64\ZAIRE"
InstallDirRegKey HKLM "${REG_KEY}" "InstallDir"

RequestExecutionLevel admin

; Use Modern UI
!include "MUI2.nsh"

; Interface Settings
!define MUI_ABORTWARNING
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install-blue-full.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall-blue-full.ico"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Header\win.bmp"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\LICENSE.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Languages
!insertmacro MUI_LANGUAGE "English"

Section "Install"
    SetOutPath "$INSTDIR"

    ; Check for existing installation (Version Update / Repair)
    ReadRegStr $0 HKLM "${UNINST_KEY}" "UninstallString"
    ${If} $0 != ""
        DetailPrint "Existing installation found. Updating/Repairing..."
    ${EndIf}

    ; Include the staging files
    File /r "staging\*"

    ; Write registry keys for the uninstaller
    WriteRegStr HKLM "${REG_KEY}" "InstallDir" "$INSTDIR"
    WriteRegStr HKLM "${UNINST_KEY}" "DisplayName" "${APPNAME}"
    WriteRegStr HKLM "${UNINST_KEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
    WriteRegStr HKLM "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${APPEXECUTABLE}"
    WriteRegStr HKLM "${UNINST_KEY}" "Publisher" "${APPCOMPANY}"
    WriteRegStr HKLM "${UNINST_KEY}" "DisplayVersion" "${APPVERSION}"
    
    ; Create uninstaller
    WriteUninstaller "$INSTDIR\uninstall.exe"

    ; Create Start Menu Shortcuts
    CreateDirectory "$SMPROGRAMS\${APPCOMPANY}"
    CreateShortcut "$SMPROGRAMS\${APPCOMPANY}\${APPNAME}.lnk" "$INSTDIR\${APPEXECUTABLE}" "" "$INSTDIR\${APPEXECUTABLE}" 0
    CreateShortcut "$SMPROGRAMS\${APPCOMPANY}\Uninstall ${APPNAME}.lnk" "$INSTDIR\uninstall.exe"

    ; Create Desktop Shortcut
    CreateShortcut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${APPEXECUTABLE}" "" "$INSTDIR\${APPEXECUTABLE}" 0

SectionEnd

Section "Uninstall"
    ; Clean uninstall: Remove installation directory
    RMDir /r "$INSTDIR"

    ; Remove Start Menu Shortcuts
    RMDir /r "$SMPROGRAMS\${APPCOMPANY}"

    ; Remove Desktop Shortcut
    Delete "$DESKTOP\${APPNAME}.lnk"

    ; Remove Registry Keys
    DeleteRegKey HKLM "${UNINST_KEY}"
    DeleteRegKey HKLM "${REG_KEY}"
SectionEnd
