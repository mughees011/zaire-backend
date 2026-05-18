param (
    [int]$Count = 1,
    [string]$TargetTitle = ""
)

# Robust PowerShell script for Chrome automation with ZAIRE-Safety and Tab-Hunting.
# This script searches for specific tabs (like Instagram) and closes them.

try {
    # Define User32 functions for window interaction
    $code = @'
        [DllImport("user32.dll")] 
        public static extern IntPtr GetForegroundWindow(); 
        [DllImport("user32.dll")] 
        public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
'@
    $type = Add-Type -MemberDefinition $code -Name "WindowUtils" -Namespace "Utils" -PassThru -ErrorAction SilentlyContinue
    if (!$type) { $type = [Utils.WindowUtils] }

    $wshell = New-Object -ComObject WScript.Shell
    
    # Try multiple common Chrome titles to ensure activation
    $activated = $false
    foreach ($title in @('Google Chrome', 'New Tab - Google Chrome')) {
        if ($wshell.AppActivate($title)) {
            $activated = $true
            break
        }
    }

    if ($activated) {
        Start-Sleep -Milliseconds 600
        
        # --- TAB HUNTING LOGIC ---
        if (![string]::IsNullOrWhiteSpace($TargetTitle)) {
            Write-Host "Hunting for tab matching: $TargetTitle"
            
            $startHwnd = $type::GetForegroundWindow()
            $found = $false
            
            # Search limit: up to 20 tabs
            for ($j = 0; $j -lt 20; $j++) {
                $hwnd = $type::GetForegroundWindow()
                $titleBuilder = New-Object System.Text.StringBuilder 256
                $type::GetWindowText($hwnd, $titleBuilder, 256) | Out-Null
                $currentTitle = $titleBuilder.ToString()

                Write-Host "Checking: $currentTitle"

                # Match logic: case-insensitive match for the target title
                if ($currentTitle -match $TargetTitle) {
                    Write-Host "Match Found! Closing tab."
                    $wshell.SendKeys('^w') # Ctrl+W
                    $found = $true
                    break
                }

                # Otherwise, move to next tab
                $wshell.SendKeys('^{TAB}') # Ctrl+Tab
                Start-Sleep -Milliseconds 450
                
                # If we've looped back to the start, give up
                if ($j -gt 0 -and $hwnd -eq $startHwnd) {
                    Write-Host "Looped back to start. Target not found."
                    break
                }
            }
            
            if (!$found) {
                Write-Error "Could not find a tab matching '$TargetTitle'."
                exit 1
            }
        } else {
            # --- LEGACY LOGIC: CLOSE N TABS ---
            for ($i = 0; $i -lt $Count; $i++) {
                $hwnd = $type::GetForegroundWindow()
                $titleBuilder = New-Object System.Text.StringBuilder 256
                $type::GetWindowText($hwnd, $titleBuilder, 256) | Out-Null
                $currentTitle = $titleBuilder.ToString()

                # Safety Check: If it's the ZAIRE dashboard (localhost), switch tabs
                if ($currentTitle -match 'React App' -or $currentTitle -match 'localhost' -or $currentTitle -match 'ZAIRE') {
                    $wshell.SendKeys('^{TAB}') 
                    Start-Sleep -Milliseconds 400
                    $hwnd = $type::GetForegroundWindow()
                }

                $wshell.SendKeys('^w') # Ctrl+W
                Start-Sleep -Milliseconds 500
            }
        }
        Write-Host "Operation Complete"
    } else {
        Write-Error "Google Chrome window not found."
        exit 1
    }
} catch {
    Write-Error "Automation Error: $_"
    exit 1
}
