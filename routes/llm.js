const express = require('express');
const {
  readSystemConfig,
  sanitizeApiSlots,
  persistAiVaultSlots,
  writeSystemConfig,
  hydrateRuntimeProviders
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

module.exports = router;
