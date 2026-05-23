const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'security',
    status: 'mounted',
    message: 'Security route layer online'
  });
});

router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'security',
    status: 'online',
    uptime: process.uptime()
  });
});

module.exports = router;
