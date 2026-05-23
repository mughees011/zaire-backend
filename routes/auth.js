const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'auth',
    status: 'mounted',
    message: 'Auth route layer online'
  });
});

router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'auth',
    status: 'online',
    uptime: process.uptime()
  });
});

module.exports = router;
