async function forwardSpecialistAction({ sidecarUrl, mode, action, payload, emitLog }) {
  console.log(`[ACTION] specialist=${mode} action=${action}`, payload);
  try {
    await fetch(`${sidecarUrl}/agent/specialist_action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, action, payload })
    });
    emitLog(`System: Action ${action} executed by ${mode} specialist.`);
  } catch (err) {
    console.error('[ACTION] Failed to notify sidecar:', err.message);
  }
}

async function runQuickAction({ action, execFn, emitLog }) {
  console.log(`[QUICK] Triggered action: ${action}`);
  try {
    switch (action) {
      case 'capture':
        emitLog('System: Capturing ZAIRE vision snapshot...');
        execFn('powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'{PRTSC}\')"');
        break;
      case 'browser':
        emitLog('System: Tactical Uplink established (Browser).');
        execFn('start https://www.google.com');
        break;
      case 'files':
        emitLog('System: Mounting local file systems...');
        execFn('explorer .');
        break;
      default:
        console.log(`[QUICK] Unknown action: ${action}`);
    }
  } catch (err) {
    console.error(`[QUICK ERR] Action ${action} failed:`, err.message);
  }
}

module.exports = {
  forwardSpecialistAction,
  runQuickAction
};
