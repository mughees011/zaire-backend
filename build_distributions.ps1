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

$BackendDir = $PSScriptRoot
if (-not $BackendDir) {
    $BackendDir = Get-Location
}

$FrontendDir = Join-Path (Split-Path -Parent $BackendDir) "frontend-temp"
$DistDir = Join-Path $BackendDir "dist"
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

This package contains only runtime assets required to launch ZAIRE.

How to launch
-------------
$LaunchCommand

What is included
----------------
- Bundled ZAIRE launcher binary
- Bundled ZAIRE daemon router binary
- Bundled Node runtime and Node dependencies
- Runtime backend routes, middleware, and services

What is intentionally excluded
------------------------------
- Raw Python source
- Scratch and test files
- Local logs
- Secret files such as .env and OAuth client secrets

Support note
------------
This package assumes your production license endpoint is configured in the launcher before release.
"@

    $readmePath = Join-Path $StageDir "README.txt"
    $content | Out-File -FilePath $readmePath -Encoding ASCII
}

function Get-RuntimeRootJsFiles {
    param([string]$SourceDir)

    Get-ChildItem -LiteralPath $SourceDir -File -Filter *.js |
        Where-Object {
            $_.Name -notmatch '\.test\.js$' -and
            $_.Name -notmatch '^test_.*\.js$' -and
            $_.Name -notin @(
                'build_distributions.ps1',
                'subscription_service2.js'
            )
        }
}

function Copy-BackendRuntimePayload {
    param([string]$StageDir)

    $rootFiles = @(
        'index.js',
        'package.json',
        'package-lock.json',
        'LICENSE.txt',
        'master_face.jpg'
    )

    foreach ($file in $rootFiles) {
        Copy-FileSafe -Source (Join-Path $BackendDir $file) -Destination (Join-Path $StageDir $file)
    }

    foreach ($file in (Get-RuntimeRootJsFiles -SourceDir $BackendDir)) {
        Copy-FileSafe -Source $file.FullName -Destination (Join-Path $StageDir $file.Name)
    }

    foreach ($dirName in @('routes', 'middleware', 'services')) {
        Copy-DirectorySafe -Source (Join-Path $BackendDir $dirName) -Destination (Join-Path $StageDir $dirName)
    }

    Ensure-Directory -Path (Join-Path $StageDir 'memory')
    Ensure-Directory -Path (Join-Path $StageDir 'uploads')

    if (-not (Test-Path (Join-Path $BackendDir 'node_modules'))) {
        throw "node_modules is missing in backend. Run npm install before packaging."
    }

    Write-Host "Bundling Node runtime dependencies..." -ForegroundColor Gray
    Copy-DirectorySafe -Source (Join-Path $BackendDir 'node_modules') -Destination (Join-Path $StageDir 'node_modules')
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
  echo [ZAIRE] Bundled Node runtime missing.
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


