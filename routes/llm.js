const express = require('express');
const {
  readSystemConfig,
  sanitizeApiSlots,
  persistAiVaultSlots,
  writeSystemConfig,
  hydrateRuntimeProviders,
  hydrateExternalApiEntries
} = require('../services/system_config_service');

const router = express.Router();

router.get('/providers', (req, res) => {
  try {
    const cfg = readSystemConfig();
    const slots = sanitizeApiSlots(cfg?.aiVault?.slots || []);
    const runtime = hydrateRuntimeProviders();
    const masked = slots.map((slot) => ({
      ...slot,
      apiKey: '',
      hasKey: Boolean(runtime[slot.slot - 1]?.apiKey)
    }));
    res.json({ success: true, slots: masked });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/providers', (req, res) => {
  try {
    const slots = sanitizeApiSlots(req.body?.slots || []);
    const persistedSlots = persistAiVaultSlots(slots);
    const prev = readSystemConfig();
    const next = {
      ...prev,
      aiVault: {
        ...(prev.aiVault || {}),
        slots: persistedSlots,
        updatedAt: new Date().toISOString()
      }
    };
    const ok = writeSystemConfig(next);
    if (!ok) {
      return res.status(500).json({ success: false, error: 'Failed to persist provider slots' });
    }
    return res.json({ success: true, slotsCount: slots.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/runtime-providers', (req, res) => {
  try {
    const slots = hydrateRuntimeProviders();
    res.json({ success: true, slots });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/external-services', (req, res) => {
  try {
    const services = hydrateExternalApiEntries().map((entry) => ({
      ...entry,
      token: '',
      hasToken: Boolean(entry.token),
      mask: entry.token ? (entry.mask || 'Saved Locally') : ''
    }));
    res.json({ success: true, services });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/external-services/verify', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const baseUrl = String(req.body?.baseUrl || '').trim();
  const headerKey = String(req.body?.headerKey || '').trim();
  const token = String(req.body?.token || '').trim();

  if (!name || !baseUrl) {
    return res.status(400).json({ success: false, error: 'Service name and base URL are required.' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const headers = {};
    if (headerKey && token) {
      headers[headerKey] = token;
    }
    const response = await fetch(baseUrl, {
      method: 'GET',
      headers,
      signal: controller.signal
    });
    clearTimeout(timeout);

    const status = response.status;
    const reachable = status < 500;
    return res.json({
      success: reachable,
      reachable,
      status,
      message: reachable
        ? `${name} responded with HTTP ${status}.`
        : `${name} is reachable but returned HTTP ${status}.`
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      reachable: false,
      error: err.message || 'Verification failed.'
    });
  }
});

module.exports = router;
