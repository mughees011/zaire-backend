const express = require('express');
const { getAllMemories, forgetMemory, searchMemories } = require('../memory_service');
const { buildMemoryDashboard, clearMemoryDomain } = require('../services/memory_dashboard_service');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(getAllMemories(20));
});

router.post('/', async (req, res) => {
  try {
    const { text, category, importance } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: 'Text is required for memory.' });
    }

    const userId = req.body.userId || 'local-user';
    const pool = require('../db');
    
    await pool.query(
      `INSERT INTO memories (user_id, content, type, context_tags) VALUES ($1, $2, $3, $4)`,
      [userId, text, category || 'general', JSON.stringify([])]
    );

    res.json({ success: true });
  } catch(err) {
    console.error('[MEMORY DB ERR]', err.message);
    res.status(500).json({ success: false, error: 'Failed to save memory.' });
  }
});

router.get('/search', (req, res) => {
  const query = req.query.q || '';
  res.json(searchMemories(query));
});

router.get('/dashboard', (req, res) => {
  res.json({ success: true, ...buildMemoryDashboard() });
});

router.post('/clear', (req, res) => {
  const domain = String(req.body?.domain || '').toLowerCase();
  if (!['study', 'trade', 'full'].includes(domain)) {
    return res.status(400).json({ success: false, error: 'Unsupported memory clear domain' });
  }

  const success = clearMemoryDomain(domain);
  if (!success) {
    return res.status(500).json({ success: false, error: 'Failed to clear requested memory domain' });
  }

  return res.json({
    success: true,
    domain,
    dashboard: buildMemoryDashboard()
  });
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  res.json(forgetMemory(id));
});

module.exports = router;
