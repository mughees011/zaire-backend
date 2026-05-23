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

module.exports = router;
