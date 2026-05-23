const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'agents',
    status: 'mounted',
    message: 'Agent route layer online'
  });
});

router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'agents',
    status: 'online',
    uptime: process.uptime()
  });
});

module.exports = router;
