const express = require('express');
const { readSystemConfig, mergeAndSaveSystemConfig } = require('../services/system_config_service');
const { requirePremiumLicense } = require('../middleware/license_enforcement');

const router = express.Router();

router.get('/', requirePremiumLicense, (req, res) => {
  try {
    const cfg = readSystemConfig();
    const settings = {
      theme: cfg.theme || {},
      voice: cfg.voice || {},
      agent: cfg.agent || {}
    };
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requirePremiumLicense, (req, res) => {
  try {
    const result = mergeAndSaveSystemConfig(req.body);
    if (!result.ok) throw new Error('Failed to save settings');
    res.json({ success: true, settings: result.next });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
