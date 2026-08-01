const { exec, spawn } = require('child_process');
const path = require('path');
const fetch = require('node-fetch');

const SIDECAR_URL = 'http://127.0.0.1:3002';

// ─── Helper: Call Python Sidecar ──────────────────────────────────────────────
async function sidecar(endpoint, body = {}) {
  try {
    const res = await fetch(`${SIDECAR_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeout: 8000
    });
    return await res.json();
  } catch (e) {
    console.error(`[SIDECAR] ${endpoint} failed:`, e.message);
    return { success: false, error: e.message };
  }
}

// ─── Websites ─────────────────────────────────────────────────────────────────
/**
 * Open multiple website URLs with a staggered delay.
 */
async function openWebsites(urls) {
    if (!Array.isArray(urls)) urls = [urls];
    
    for (let url of urls) {
        try {
            // Sanitize LLM-provided URLs that might miss the protocol
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                // If it looks like a domain, prepend https://
                if (url.includes('.')) {
                    url = 'https://' + url;
                } else {
                    url = 'https://www.' + url + '.com';
                }
            }
            console.log(`[SYSTEM] Opening website via PowerShell: ${url}`);
            
            // Execute start command for Windows using PowerShell
            await new Promise((resolve, reject) => {
                const psCommand = `Start-Process -FilePath "${url}"`;
                exec(`powershell -Command "${psCommand}"`, (error) => {
                    if (error) {
                        console.error(`[SYSTEM] PowerShell open failed for ${url}:`, error);
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });

            await new Promise(resolve => setTimeout(resolve, 800));
        } catch (err) {
            console.error(`[SYSTEM] Failed to open ${url}:`, err);
        }
    }
    return { success: true, message: `Attempted to open ${urls.length} site(s).` };
}

// ─── Apps ─────────────────────────────────────────────────────────────────────
/**
 * Open a Windows application by name via PowerShell.
 */
function openApp(appName) {
    return new Promise((resolve) => {
        console.log(`[SYSTEM] Searching for app: ${appName}`);
        const psCommand = `Get-StartApps | Where-Object { $_.Name -match '${appName}' } | Select-Object -First 1 -ExpandProperty AppID`;
        
        exec(`powershell -Command "${psCommand}"`, (err, stdout, stderr) => {
            if (err || !stdout.trim()) {
                console.error(`[SYSTEM] App not found or error: ${appName}`, stderr);
                return resolve({ success: false, error: "App not found in Start Menu" });
            }

            const appID = stdout.trim().split('\n')[0].trim();
            console.log(`[SYSTEM] Launching app with ID: ${appID}`);
            exec(`explorer "shell:AppsFolder\\${appID}"`);
            resolve({ success: true, message: `Launched ${appName}` });
        });
    });
}

// ─── Chrome Tab Control ───────────────────────────────────────────────────────
/**
 * Close Chrome tabs using the PowerShell controller script.
 */
function closeChromeTabs(count = 1, targetTitle = "") {
    return new Promise((resolve) => {
        console.log(`[SYSTEM] Closing ${count} Chrome tab(s). Target: ${targetTitle || 'Active Tab'}`);
        
        const scriptPath = path.join(__dirname, 'chrome_tab_controller.ps1');
        const targetArg = targetTitle ? `-TargetTitle "${targetTitle}"` : "";
        const psCommand = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -Count ${count} ${targetArg}`;

        exec(psCommand, (err, stdout, stderr) => {
            if (err) {
                console.error(`[SYSTEM] Tab Close Error:`, stderr || err.message);
                const errorMsg = stderr?.includes("Target not found")
                    ? `Could not find a tab matching "${targetTitle}".`
                    : "ZAIRE encountered an issue while trying to access your browser tabs.";
                return resolve({ success: false, error: errorMsg });
            }
            console.log(`[SYSTEM] Controller Output:`, stdout);
            resolve({ success: true, message: `Closed ${targetTitle || count + ' tab(s)'}` });
        });
    });
}

// ─── Desktop Info ─────────────────────────────────────────────────────────────
function countDesktopFolders() {
    return new Promise((resolve) => {
        const psCommand = `Get-ChildItem -Path "$HOME\\Desktop" | Where-Object { $_.PSIsContainer } | Measure-Object | Select-Object -ExpandProperty Count`;
        exec(`powershell -Command "${psCommand}"`, (err, stdout) => {
            if (err) return resolve({ success: false, error: err.message });
            const count = stdout.trim() || "0";
            resolve({ success: true, count: parseInt(count), message: `Found ${count} folders on desktop` });
        });
    });
}

// ─── Mouse Control ────────────────────────────────────────────────────────────
/**
 * Move the mouse to absolute screen coordinates.
 */
async function moveMouse(x, y, duration = 0.4) {
    console.log(`[SYSTEM] Moving mouse to (${x}, ${y})`);
    return await sidecar('/mouse/move', { x, y, duration });
}

/**
 * Click the mouse at optional coordinates.
 */
async function clickMouse(x = null, y = null, button = 'left', double = false) {
    console.log(`[SYSTEM] ${double ? 'Double c' : 'C'}licking at (${x}, ${y})`);
    return await sidecar('/mouse/click', { x, y, button, double });
}

/**
 * Scroll the mouse wheel.
 */
async function scrollMouse(amount = 3) {
    console.log(`[SYSTEM] Scrolling ${amount}`);
    return await sidecar('/mouse/scroll', { amount });
}

// ─── Keyboard Control ─────────────────────────────────────────────────────────
/**
 * Type text into the currently focused application.
 */
async function typeText(text, interval = 0.04) {
    console.log(`[SYSTEM] Typing: "${text}"`);
    return await sidecar('/keyboard/type', { text, interval });
}

/**
 * Send a keyboard shortcut. e.g. sendHotkey(['ctrl', 'c'])
 */
async function sendHotkey(keys) {
    if (typeof keys === 'string') keys = keys.split('+');
    console.log(`[SYSTEM] Hotkey: ${keys.join('+')}`);
    return await sidecar('/keyboard/hotkey', { keys });
}

/**
 * Press a single key.
 */
async function pressKey(key) {
    console.log(`[SYSTEM] Key press: ${key}`);
    return await sidecar('/keyboard/press', { key });
}

// ─── Volume Control ───────────────────────────────────────────────────────────
/**
 * Adjust volume using relative keyboard steps.
 * direction: 'up' | 'down'. steps = number of key presses (~2% each).
 */
async function adjustVolume(direction = 'up', steps = 5) {
    console.log(`[SYSTEM] Volume ${direction} by ${steps} steps`);
    return await sidecar('/system/volume_key', { direction, steps });
}

/**
 * Set absolute volume level 0-100 via Windows API.
 */
async function setVolume(level) {
    console.log(`[SYSTEM] Setting volume to ${level}%`);
    return await sidecar('/system/volume', { level });
}

/**
 * Toggle system mute.
 */
async function toggleMute() {
    console.log(`[SYSTEM] Toggling mute`);
    return await sidecar('/system/mute', {});
}

// ─── Brightness Control ───────────────────────────────────────────────────────
/**
 * Set screen brightness 0-100.
 */
async function setBrightness(level) {
    console.log(`[SYSTEM] Setting brightness to ${level}%`);
    return await sidecar('/system/brightness', { level });
}

// ─── Screen Info ──────────────────────────────────────────────────────────────
/**
 * Get screen dimensions and current mouse position.
 */
async function getScreenInfo() {
    try {
        const res = await fetch(`${SIDECAR_URL}/system/screen_info`);
        return await res.json();
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * Capture full screen and save as a file on the desktop.
 */
async function saveScreenshot() {
    console.log(`[SYSTEM] Saving screenshot to desktop`);
    return await sidecar('/screenshot/save', {});
}

// ─── Window Management ────────────────────────────────────────────────────────
/**
 * List all open application windows.
 */
async function listWindows() {
    console.log(`[SYSTEM] Listing windows`);
    return await sidecar('/window/list');
}

/**
 * Bring a specific window to front by title.
 */
async function focusWindow(title) {
    console.log(`[SYSTEM] Focusing window: ${title}`);
    return await sidecar('/window/focus', { title });
}

/**
 * Close a specific window.
 */
async function closeWindow(title) {
    console.log(`[SYSTEM] Closing window: ${title}`);
    return await sidecar('/window/close', { title });
}

// ─── File Management ─────────────────────────────────────────────────────────
/**
 * List files and directories in a given path.
 */
async function listFiles(dirPath) {
    console.log(`[SYSTEM] Listing files in: ${dirPath || 'User Home'}`);
    return await sidecar('/file/list', { path: dirPath });
}

/**
 * Search for files matching a query.
 */
async function searchFiles(query, rootPath) {
    console.log(`[SYSTEM] Searching for "${query}" in: ${rootPath || 'User Home'}`);
    return await sidecar('/file/search', { query, root: rootPath });
}

/**
 * Open a file with the default system application.
 */
async function openFile(filePath) {
    console.log(`[SYSTEM] Opening file: ${filePath}`);
    return await sidecar('/file/open', { path: filePath });
}

// ─── Media Control ───────────────────────────────────────────────────────────
/**
 * Trigger media player keys (playpause, nexttrack, prevtrack).
 */
async function controlMedia(action) {
    console.log(`[SYSTEM] Media Control: ${action}`);
    return await sidecar('/system/media', { action });
}

// ─── Sentinel Helpers ─────────────────────────────────────────────────────────
async function getSystemHealth() {
    return await sidecar('/system/health_sentinel');
}

async function getResourceAudit() {
    return await sidecar('/system/resource_audit');
}

async function getGitStatus() {
    return await sidecar('/git/sentinel_status');
}

module.exports = {
    // Existing
    openWebsites,
    openApp,
    closeChromeTabs,
    countDesktopFolders,
    // Mouse
    moveMouse,
    clickMouse,
    scrollMouse,
    // Keyboard
    typeText,
    sendHotkey,
    pressKey,
    // Volume / Brightness
    adjustVolume,
    setVolume,
    toggleMute,
    setBrightness,
    getScreenInfo,
    // Vision & Snapshots
    saveScreenshot,
    // Window Management
    listWindows,
    focusWindow,
    closeWindow,
    // File Management
    listFiles,
    searchFiles,
    openFile,
    // Media Control
    controlMedia,
    // Sentinel Extras
    getSystemHealth,
    getResourceAudit,
    getGitStatus
};


