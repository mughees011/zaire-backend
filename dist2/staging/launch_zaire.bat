@echo off
setlocal
cd /d "%~dp0"

if not exist "%~dp0runtime\node.exe" (
  echo [ZAIRE] ERROR: Bundled Node runtime missing.
  echo.
  echo Did you run this directly from inside the ZIP file?
  echo Windows cannot run the app from inside the ZIP viewer.
  echo Please EXTRACT the entire folder first, then run launch_zaire.bat.
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0zaire_boot.exe" (
  echo [ZAIRE] Bundled launcher missing.
  pause
  exit /b 1
)

if not exist "%~dp0zaire_core.exe" (
  echo [ZAIRE] Bundled daemon router missing.
  pause
  exit /b 1
)

echo [ZAIRE] Validating license...
"%~dp0zaire_boot.exe"
if errorlevel 1 (
  echo [ZAIRE] Activation failed or was cancelled.
  pause
  exit /b 1
)

echo [ZAIRE] ZAIRE runtime launched.
exit /b 0
