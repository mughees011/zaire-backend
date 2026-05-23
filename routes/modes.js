const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'modes',
    status: 'mounted',
    message: 'Mode route layer online'
  });
});

router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'modes',
    status: 'online',
    uptime: process.uptime()
  });
});

module.exports = router;
