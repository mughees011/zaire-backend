const fs = require('fs');
const os = require('os');
const path = require('path');

const subscriptionService = require('../services/subscription_service');

const SESSION_FILE = path.join(
  process.env.LOCALAPPDATA || process.env.APPDATA || os.homedir(),
  process.env.LOCALAPPDATA || process.env.APPDATA ? 'ZAIRE' : '.zaire',
  'session.json'
);

function readCachedSession() {
  try {
    if (!fs.existsSync(SESSION_FILE)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
  } catch (err) {
    console.warn('[LICENSE ENFORCEMENT] Failed to read cached session:', err.message);
    return null;
  }
}

function resolveLicenseContext(req) {
  const headerLicenseKey = req.headers['x-zaire-license'] || req.headers['x-zaire-license-key'];
  const headerMachineId = req.headers['x-zaire-machine-id'] || req.headers['x-zaire-machine'];

  if (headerLicenseKey && headerMachineId) {
    return {
      licenseKey: headerLicenseKey,
      machineId: headerMachineId,
      source: 'headers'
    };
  }

  const cachedSession = readCachedSession();
  if (cachedSession && cachedSession.license_key && cachedSession.machine_id) {
    return {
      licenseKey: cachedSession.license_key,
      machineId: cachedSession.machine_id,
      source: 'cached_session'
    };
  }

  return {
    licenseKey: headerLicenseKey,
    machineId: headerMachineId,
    source: 'missing'
  };
}

async function requirePremiumLicense(req, res, next) {
  const { licenseKey, machineId } = resolveLicenseContext(req);

  if (!licenseKey || !machineId) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED: Missing ZAIRE License Key or Machine ID headers. Every premium action requires backend validation.'
    });
  }

  try {
    const sub = await subscriptionService.getSubscriptionByLicenseKey(licenseKey);

    if (!sub) {
      return res.status(403).json({ success: false, error: 'INVALID_LICENSE' });
    }

    const status = (sub.status || '').toLowerCase();
    if (status !== 'active' && status !== 'subscription_active' && status !== 'pro') {
      return res.status(403).json({ success: false, error: 'SUBSCRIPTION_INACTIVE' });
    }

    if (sub.current_period_end && new Date() > new Date(sub.current_period_end)) {
      return res.status(403).json({ success: false, error: 'SUBSCRIPTION_EXPIRED' });
    }

    const activeMachines = (sub.machines || []).filter((machine) => machine.is_active);
    const machine = activeMachines.find((entry) => entry.machine_id === machineId);

    if (!machine) {
      return res.status(403).json({ success: false, error: 'UNAUTHORIZED_DEVICE: This machine is not registered to the license.' });
    }

    const planLower = (sub.plan || '').toLowerCase();
    const requestLimit = sub.request_limit ?? 50;

    if (planLower !== 'initiate' && requestLimit !== -1) {
      if ((sub.monthly_requests || 0) >= requestLimit) {
        return res.status(429).json({
          success: false,
          error: 'QUOTA_EXCEEDED: You have exhausted your monthly API requests. Please upgrade your plan.'
        });
      }

      await subscriptionService.incrementRequest(sub.user_id);
      await subscriptionService.incrementTokens(sub.user_id, 250);
    }

    req.zaireLicense = sub;
    req.zaireMachine = machine;

    next();
  } catch (err) {
    console.error('[LICENSE ENFORCEMENT ERROR]', err);
    return res.status(500).json({ success: false, error: 'LICENSE_VALIDATION_ERROR' });
  }
}

module.exports = { requirePremiumLicense };
