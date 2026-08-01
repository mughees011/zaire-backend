# ====================================================================
# ZAIRE Sovereign Intelligence Platform - Hardened Distribution Builder
# ====================================================================
# Produces runtime-safe distributables by:
# - staging only explicit runtime files
# - bundling Node runtime + node_modules for packaged startup
# - shipping compiled Python launch artifacts instead of raw .py source
# - excluding secrets, tests, scratch files, and internal notes
# - refusing to emit broken platform zips without native runtime assets
# ====================================================================

$ErrorActionPreference = "Stop"

$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) {
    $ScriptDir = (Get-Location).Path
}
if ((Split-Path -Leaf $ScriptDir) -eq 'scripts') {
    $BackendDir = Split-Path -Parent $ScriptDir
} else {
    $BackendDir = $ScriptDir
}

$FrontendDir = Join-Path (Split-Path -Parent $BackendDir) "frontend-temp"
$DistDir = Join-Path $BackendDir "dist2"
$RuntimeAssetRoot = Join-Path $BackendDir "release_runtime"
$NsisStageDir = Join-Path $DistDir "staging"

Write-Host "Initializing hardened ZAIRE packaging pipeline..." -ForegroundColor Cyan
Write-Host "Backend directory: $BackendDir" -ForegroundColor Gray
Write-Host "Output directory: $DistDir" -ForegroundColor Gray

function New-CleanDirectory {
    param([string]$Path)

    if (Test-Path $Path) {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
}

function Ensure-Directory {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Copy-FileSafe {
    param(
        [string]$Source,
        [string]$Destination
    )

    if (-not (Test-Path $Source)) {
        throw "Required file not found: $Source"
    }

    $parent = Split-Path -Parent $Destination
    Ensure-Directory -Path $parent
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
}

function Copy-DirectorySafe {
    param(
        [string]$Source,
        [string]$Destination
    )

    if (-not (Test-Path $Source)) {
        throw "Required directory not found: $Source"
    }

    Ensure-Directory -Path (Split-Path -Parent $Destination)
    Ensure-Directory -Path $Destination

    $null = robocopy $Source $Destination /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP
    if ($LASTEXITCODE -ge 8) {
        throw "robocopy failed while copying $Source to $Destination (exit code $LASTEXITCODE)"
    }
}

function Write-ReleaseReadme {
    param(
        [string]$Platform,
        [string]$StageDir,
        [string]$LaunchCommand
    )

    $content = @"
ZAIRE Runtime Package ($Platform)
================================

This package contains only compiled runtime assets required to launch ZAIRE.

How to launch
-------------
$LaunchCommand

What is included
----------------
- Bundled ZAIRE launcher binary (zaire_boot.exe)
- Bundled ZAIRE daemon router binary (zaire_core.exe)
- Bundled Node runtime (runtime/node.exe)
- Compiled, minified backend bundle (bundle.js)
- Runtime static frontend assets

What is intentionally excluded
------------------------------
- Raw backend JavaScript source files
- Route, middleware, and service source files
- Raw Python source
- Scratch and test files
- Local logs
- Secret files such as .env and OAuth client secrets
- Development node_modules (devDependencies stripped)

Support note
------------
This package assumes your production license endpoint is configured in the launcher before release.
"@

    $readmePath = Join-Path $StageDir "README.txt"
    $content | Out-File -FilePath $readmePath -Encoding ASCII
}

function Assert-StagingIntegrity {
    param([string]$StageDir)

    # Guard 1: No biometric / face-recognition assets
    $facePatterns = @('master_face.jpg', 'face*.jpg', '*_face.*', '*.face', 'biometric_*', 'enrollment_*.jpg', 'enrollment_*.png')
    foreach ($pattern in $facePatterns) {
        $hits = Get-ChildItem -LiteralPath $StageDir -Recurse -Filter $pattern -ErrorAction SilentlyContinue
        if ($hits) {
            throw "PACKAGING GUARD [biometric]: Found prohibited file(s) matching '$pattern' in staging output: $($hits.FullName -join ', '). Aborting."
        }
    }

    # Guard 2: No plaintext sensitive source files in the staging root or its immediate subdirs
    $sensitiveFiles = @(
        'auth_middleware.js', 'crypto_utils.js', 'billing_service.js',
        'db_init.js', 'db.js', 'subscription_service.js', 'vault_service.js',
        'memory_service.js', 'proactive_service.js', 'vision_service.js',
        'visual_echo_daemon.js', 'system_tools.js', 'chat_history_service.js'
    )
    foreach ($f in $sensitiveFiles) {
        if (Test-Path (Join-Path $StageDir $f)) {
            throw "PACKAGING GUARD [source]: Sensitive source file '$f' found in staging root. Bundle step may have been skipped. Aborting."
        }
    }
    # Also confirm no middleware/routes/services source dirs shipped
    foreach ($dir in @('routes', 'middleware', 'services')) {
        if (Test-Path (Join-Path $StageDir $dir)) {
            throw "PACKAGING GUARD [source]: Directory '$dir' (raw source) found in staging output. Aborting."
        }
    }

    # Guard 3: No secret files
    foreach ($secret in @('.env', 'client_secret.json', 'client_secret')) {
        if (Test-Path (Join-Path $StageDir $secret)) {
            throw "PACKAGING GUARD [secrets]: Secret file '$secret' found in staging output. Aborting."
        }
    }

    # Guard 4: Confirm bundle.js exists
    if (-not (Test-Path (Join-Path $StageDir 'bundle.js'))) {
        throw "PACKAGING GUARD [bundle]: bundle.js not found in staging output. esbuild step may have failed. Aborting."
    }

    Write-Host "Staging integrity checks passed." -ForegroundColor Green
}

function Bundle-BackendSource {
    param([string]$StageDir)

    # Resolve esbuild — prefer local devDependency, fall back to global
    $esbuildLocal = Join-Path $BackendDir 'node_modules\.bin\esbuild.cmd'
    $esbuildCmd   = if (Test-Path $esbuildLocal) { $esbuildLocal } else { 'esbuild' }

    $entryPoint = Join-Path $BackendDir 'index.js'
    $outFile    = Join-Path $StageDir 'bundle.js'

    if (-not (Test-Path $entryPoint)) {
        throw "Backend entry point not found: $entryPoint"
    }

    Write-Host "Bundling backend source with esbuild (minified)..." -ForegroundColor Cyan

    # Packages that use native addons, dynamic require, or are too large to inline:
    # ship these via the production node_modules alongside bundle.js.
    $externals = @(
        'pg', 'pg-native', 'bufferutil', 'utf-8-validate',
        'socket.io', 'socket.io-client', 'engine.io',
        'multer', 'busboy',
        'googleapis', 'google-auth-library',
        'msedge-tts', 'node-edge-tts',
        'fsevents', 'cpu-features', 'ssh2',
        'yahoo-finance2'
    )
    $externalFlags = ($externals | ForEach-Object { "--external:$_" }) -join ' '

    $esbuildArgs = @(
        $entryPoint,
        '--bundle',
        '--minify',
        '--platform=node',
        '--format=cjs',
        "--outfile=$outFile"
    ) + ($externals | ForEach-Object { "--external:$_" })

    & $esbuildCmd @esbuildArgs
    if ($LASTEXITCODE -ne 0) {
        throw "esbuild failed with exit code $LASTEXITCODE. Ensure esbuild is installed (npm install --save-dev esbuild)."
    }

    if (-not (Test-Path $outFile)) {
        throw "esbuild completed but bundle.js was not created at $outFile"
    }

    $bundleSize = (Get-Item $outFile).Length
    Write-Host "bundle.js created ($([math]::Round($bundleSize / 1KB, 0)) KB)" -ForegroundColor Gray
}

function Copy-BackendRuntimePayload {
    param([string]$StageDir)

    # Copy only non-sensitive, non-source static files
    $rootFiles = @(
        'package.json',
        'package-lock.json',
        'LICENSE'
    )

    foreach ($file in $rootFiles) {
        Copy-FileSafe -Source (Join-Path $BackendDir $file) -Destination (Join-Path $StageDir $file)
    }

    # Patch the staged package.json so node resolves bundle.js as the entry point
    $stagedPkgPath = Join-Path $StageDir 'package.json'
    $pkg = Get-Content $stagedPkgPath -Raw | ConvertFrom-Json
    $pkg.main = 'bundle.js'
    $pkg | ConvertTo-Json -Depth 10 | Out-File -FilePath $stagedPkgPath -Encoding UTF8

    # Runtime scaffold directories (contents populated at runtime, not shipped as source)
    Ensure-Directory -Path (Join-Path $StageDir 'memory')
    Ensure-Directory -Path (Join-Path $StageDir 'uploads')

    # Bundle sensitive source into a single minified file instead of copying raw .js
    Bundle-BackendSource -StageDir $StageDir

    # Install production-only node_modules into staging (clean, no devDeps, no duplicates)
    Write-Host "Installing production node_modules (npm ci --omit=dev)..." -ForegroundColor Cyan
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        throw "Node.js is required to install production node_modules."
    }
    $npmCmd = Join-Path (Split-Path $nodeCmd.Source) 'npm.cmd'
    if (-not (Test-Path $npmCmd)) {
        $npmCmd = 'npm'
    }

    # Copy only package manifests to a temp dir, run ci there, then move result
    $tempNmDir = Join-Path $env:TEMP 'zaire_nm_clean'
    if (Test-Path $tempNmDir) { Remove-Item -LiteralPath $tempNmDir -Recurse -Force }
    New-Item -ItemType Directory -Path $tempNmDir -Force | Out-Null
    Copy-Item (Join-Path $BackendDir 'package.json')       (Join-Path $tempNmDir 'package.json')
    Copy-Item (Join-Path $BackendDir 'package-lock.json')  (Join-Path $tempNmDir 'package-lock.json')

    Push-Location $tempNmDir
    try {
        $oldError = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        & $npmCmd ci --omit=dev --prefer-offline 2>&1 | Write-Host
        $ErrorActionPreference = $oldError
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci --omit=dev failed with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }

    $cleanNmSrc  = Join-Path $tempNmDir 'node_modules'
    $cleanNmDest = Join-Path $StageDir  'node_modules'
    Write-Host "Copying clean production node_modules to staging..." -ForegroundColor Gray
    Copy-DirectorySafe -Source $cleanNmSrc -Destination $cleanNmDest

    # Clean up temp dir
    Remove-Item -LiteralPath $tempNmDir -Recurse -Force -ErrorAction SilentlyContinue
}

function Copy-FrontendRuntimePayload {
    param([string]$StageDir)

    $frontendBuildDir = Join-Path $FrontendDir 'build'
    if (-not (Test-Path $frontendBuildDir)) {
        throw "Frontend build is missing at $frontendBuildDir. Run npm run build in frontend-temp before packaging."
    }

    Write-Host "Bundling packaged frontend..." -ForegroundColor Gray
    Copy-DirectorySafe -Source $frontendBuildDir -Destination (Join-Path $StageDir 'frontend')
}

function Ensure-PythonModule {
    param(
        [string]$PythonExe,
        [string]$ImportName,
        [string]$PackageName = $ImportName
    )

    & $PythonExe -c "import $ImportName" > $null 2>&1
    if ($LASTEXITCODE -eq 0) {
        return
    }

    Write-Host "[WARNING] Python module '$ImportName' is missing. Installing package '$PackageName'..." -ForegroundColor Yellow
    & $PythonExe -m pip install $PackageName --quiet
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to install required Python package '$PackageName' for import '$ImportName'."
    }

    & $PythonExe -c "import $ImportName" > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Python package '$PackageName' installed, but import '$ImportName' still fails."
    }
}

function Compile-WindowsPythonBinaries {
    param([string]$OutputDir)

    $python = Get-Command python -ErrorAction SilentlyContinue
    $runtimeDir = Join-Path $RuntimeAssetRoot 'windows'
    $prebuiltBoot = Join-Path $runtimeDir 'zaire_boot.exe'
    $prebuiltCore = Join-Path $runtimeDir 'zaire_core.exe'

    if ((Test-Path $prebuiltBoot) -and (Test-Path $prebuiltCore)) {
        Write-Host "Using prebuilt Windows launcher binaries from release_runtime\\windows..." -ForegroundColor Gray
        Copy-FileSafe -Source $prebuiltBoot -Destination (Join-Path $OutputDir 'zaire_boot.exe')
        Copy-FileSafe -Source $prebuiltCore -Destination (Join-Path $OutputDir 'zaire_core.exe')
        return
    }

    if (-not $python) {
        throw "Python is required to build Windows launcher binaries, or provide prebuilt binaries in release_runtime\\windows."
    }

    Write-Host "Compiling Windows launcher binaries with PyInstaller..." -ForegroundColor Cyan
    & cmd /c "`"$($python.Source)`" -m PyInstaller --version >nul 2>nul"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[WARNING] PyInstaller is not available locally. Attempting installation..." -ForegroundColor Yellow
        & python -m pip install pyinstaller --quiet
    }

    Ensure-PythonModule -PythonExe $python.Source -ImportName 'requests'

    Push-Location $BackendDir
    try {
        & python -m PyInstaller --noconfirm --onefile --windowed --hidden-import requests --distpath $OutputDir zaire_boot.py
        & python -m PyInstaller --noconfirm --onefile --distpath $OutputDir zaire_core.py
    } finally {
        Pop-Location
    }

    foreach ($tempPath in @(
        (Join-Path $BackendDir 'build'),
        (Join-Path $BackendDir 'zaire_boot.spec'),
        (Join-Path $BackendDir 'zaire_core.spec')
    )) {
        if (Test-Path $tempPath) {
            Remove-Item -LiteralPath $tempPath -Recurse -Force
        }
    }

    foreach ($artifact in @('zaire_boot.exe', 'zaire_core.exe')) {
        if (-not (Test-Path (Join-Path $OutputDir $artifact))) {
            throw "Expected PyInstaller artifact missing: $artifact. Install PyInstaller locally or provide prebuilt binaries in release_runtime\\windows."
        }
    }
}

function Copy-WindowsNodeRuntime {
    param([string]$StageDir)

    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCommand) {
        throw "Node.js is required to build a bundled Windows package."
    }

    $nodeSource = $nodeCommand.Source
    $runtimeDir = Join-Path $StageDir 'runtime'
    Ensure-Directory -Path $runtimeDir
    Copy-FileSafe -Source $nodeSource -Destination (Join-Path $runtimeDir 'node.exe')
}

function Write-WindowsLauncher {
    param([string]$StageDir)

    $launchScript = @"
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
"@

    $launchPath = Join-Path $StageDir 'launch_zaire.bat'
    $launchScript | Out-File -FilePath $launchPath -Encoding ASCII
}

function New-ZipFromStage {
    param(
        [string]$StageDir,
        [string]$ZipPath
    )

    if (Test-Path $ZipPath) {
        Remove-Item -LiteralPath $ZipPath -Force
    }

    $parent = Split-Path -Parent $StageDir
    $leaf = Split-Path -Leaf $StageDir
    Push-Location $parent
    try {
        & tar -a -cf $ZipPath $leaf
    } finally {
        Pop-Location
    }

    if (-not (Test-Path $ZipPath)) {
        throw "ZIP was not created: $ZipPath"
    }
}
function Get-PlatformBinaryConfig {
    return @{
        macOS = @{
            ZipName = 'ZAIRE_macOS.zip'
            StageName = 'macos_staging'
            RuntimeDir = Join-Path $RuntimeAssetRoot 'macos'
            BootBinary = 'zaire_boot'
            CoreBinary = 'zaire_core'
            NodeBinary = 'node'
            LaunchScript = 'setup_mac.sh'
            LaunchCommand = './setup_mac.sh'
            ScriptBody = @'
#!/bin/bash
set -e
cd "$(dirname "$0")"

if [ ! -x "./zaire_boot" ]; then
  echo "[ZAIRE] Bundled macOS launcher missing."
  exit 1
fi

if [ ! -x "./runtime/node" ]; then
  echo "[ZAIRE] Bundled macOS Node runtime missing."
  exit 1
fi

echo "[ZAIRE] Validating license..."
./zaire_boot

echo "[ZAIRE] Starting bundled backend runtime..."
./runtime/node ./index.js
'@
        }
        linux = @{
            ZipName = 'ZAIRE_Linux.zip'
            StageName = 'linux_staging'
            RuntimeDir = Join-Path $RuntimeAssetRoot 'linux'
            BootBinary = 'zaire_boot'
            CoreBinary = 'zaire_core'
            NodeBinary = 'node'
            LaunchScript = 'setup_linux.sh'
            LaunchCommand = './setup_linux.sh'
            ScriptBody = @'
#!/bin/bash
set -e
cd "$(dirname "$0")"

if [ ! -x "./zaire_boot" ]; then
  echo "[ZAIRE] Bundled Linux launcher missing."
  exit 1
fi

if [ ! -x "./runtime/node" ]; then
  echo "[ZAIRE] Bundled Linux Node runtime missing."
  exit 1
fi

echo "[ZAIRE] Validating license..."
./zaire_boot

echo "[ZAIRE] Starting bundled backend runtime..."
./runtime/node ./index.js
'@
        }
    }
}

function Build-OptionalUnixPackage {
    param(
        [string]$PlatformName,
        [hashtable]$Config
    )

    $runtimeDir = $Config.RuntimeDir
    $bootSource = Join-Path $runtimeDir $Config.BootBinary
    $coreSource = Join-Path $runtimeDir $Config.CoreBinary
    $nodeSource = Join-Path $runtimeDir $Config.NodeBinary

    if (-not (Test-Path $bootSource) -or -not (Test-Path $coreSource) -or -not (Test-Path $nodeSource)) {
        Write-Host "[WARNING] Skipping $PlatformName package. Missing native runtime assets in $runtimeDir" -ForegroundColor Yellow
        return
    }

    $stageDir = Join-Path $DistDir $Config.StageName
    New-CleanDirectory -Path $stageDir
    Copy-BackendRuntimePayload -StageDir $stageDir
    Copy-FileSafe -Source $bootSource -Destination (Join-Path $stageDir $Config.BootBinary)
    Copy-FileSafe -Source $coreSource -Destination (Join-Path $stageDir $Config.CoreBinary)

    $runtimeStageDir = Join-Path $stageDir 'runtime'
    Ensure-Directory -Path $runtimeStageDir
    Copy-FileSafe -Source $nodeSource -Destination (Join-Path $runtimeStageDir 'node')

    $scriptPath = Join-Path $stageDir $Config.LaunchScript
    $Config.ScriptBody | Out-File -FilePath $scriptPath -Encoding UTF8
    Write-ReleaseReadme -Platform $PlatformName -StageDir $stageDir -LaunchCommand $Config.LaunchCommand

    $zipPath = Join-Path $DistDir $Config.ZipName
    New-ZipFromStage -StageDir $stageDir -ZipPath $zipPath
    Write-Host "$PlatformName package generated: $($Config.ZipName)" -ForegroundColor Green
}

New-CleanDirectory -Path $DistDir

# --------------------------------------------------------------------
# Windows true bundled package
# --------------------------------------------------------------------
$WindowsStageDir = Join-Path $DistDir 'windows_staging'
New-CleanDirectory -Path $WindowsStageDir

Copy-BackendRuntimePayload -StageDir $WindowsStageDir
Copy-FrontendRuntimePayload -StageDir $WindowsStageDir
Compile-WindowsPythonBinaries -OutputDir $WindowsStageDir
Copy-WindowsNodeRuntime -StageDir $WindowsStageDir
Write-WindowsLauncher -StageDir $WindowsStageDir
Write-ReleaseReadme -Platform 'Windows' -StageDir $WindowsStageDir -LaunchCommand 'Double-click launch_zaire.bat'

# Integrity gate — must pass before any zip is created
Assert-StagingIntegrity -StageDir $WindowsStageDir

$WindowsZip = Join-Path $DistDir 'ZAIRE_Setup.zip'
New-ZipFromStage -StageDir $WindowsStageDir -ZipPath $WindowsZip
Write-Host "Windows package generated: ZAIRE_Setup.zip" -ForegroundColor Green

# Prepare NSIS staging only from hardened Windows payload
Copy-DirectorySafe -Source $WindowsStageDir -Destination $NsisStageDir

# --------------------------------------------------------------------
# Optional macOS / Linux packages
# --------------------------------------------------------------------
$platformConfigs = Get-PlatformBinaryConfig
Build-OptionalUnixPackage -PlatformName 'macOS' -Config $platformConfigs.macOS
Build-OptionalUnixPackage -PlatformName 'Linux' -Config $platformConfigs.linux

# --------------------------------------------------------------------
# Optional NSIS installer
# --------------------------------------------------------------------
Write-Host "Checking for NSIS compiler (makensis)..." -ForegroundColor Cyan
$nsisCommand = Get-Command 'makensis' -ErrorAction SilentlyContinue

if ($nsisCommand) {
    Write-Host "NSIS found. Compiling hardened Windows installer..." -ForegroundColor Green
    Push-Location $DistDir
    try {
        Copy-FileSafe -Source (Join-Path $BackendDir 'ZAIRE_Installer.nsi') -Destination (Join-Path $DistDir 'Zaire_Installer.nsi')
        & $nsisCommand.Source 'Zaire_Installer.nsi'
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[WARNING] NSIS not found. Skipping installer compilation." -ForegroundColor Yellow
}

Write-Host "=====================================================" -ForegroundColor Green
Write-Host "Hardened packaging complete. Output saved in: $DistDir" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green


