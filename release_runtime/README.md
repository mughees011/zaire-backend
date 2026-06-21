Release Runtime Assets
======================

This folder is used by `build_distributions.ps1` when native bundled binaries
already exist and should be packaged without rebuilding them locally.

Expected structure
------------------

Windows:
- `windows/zaire_boot.exe`
- `windows/zaire_core.exe`

macOS:
- `macos/zaire_boot`
- `macos/zaire_core`
- `macos/node`

Linux:
- `linux/zaire_boot`
- `linux/zaire_core`
- `linux/node`

Notes
-----
- The packaging script will not emit broken macOS/Linux zips anymore.
- If the required native files are missing, that platform package is skipped.
- For Windows, the script will try PyInstaller first. If PyInstaller is not
  available, it will use `release_runtime/windows` if those binaries exist.
