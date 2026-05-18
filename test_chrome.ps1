$wshell = New-Object -ComObject WScript.Shell
$activated = $wshell.AppActivate('Google Chrome')
if ($activated) {
    Start-Sleep -Milliseconds 500
    $wshell.SendKeys('^{TAB}')  # Test: Switch one tab
    "Success"
} else {
    "Failed"
}
