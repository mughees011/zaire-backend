const express = require('express');
const { readSystemConfig } = require('../services/system_config_service');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const cfg = readSystemConfig();
    res.json({ success: true, data: cfg });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { mergeAndSaveSystemConfig } = require('../services/system_config_service');
    const result = mergeAndSaveSystemConfig(req.body);
    if (!result.ok) throw new Error('Failed to save config');
    res.json({ success: true, data: result.next });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
