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

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// ==========================================
// ENGINEER MODE: FS & Git Access
// ==========================================

router.post('/engineer/fs/read', async (req, res) => {
  try {
    const { targetPath } = req.body;
    if (!fs.existsSync(targetPath)) return res.status(404).json({ error: 'File not found' });
    const content = fs.readFileSync(targetPath, 'utf8');
    res.json({ success: true, content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/engineer/fs/write', async (req, res) => {
  try {
    const { targetPath, content } = req.body;
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(targetPath, content, 'utf8');
    res.json({ success: true, message: 'File written successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/engineer/git/status', async (req, res) => {
  try {
    const { repoPath } = req.body;
    const { stdout } = await execPromise('git status --short', { cwd: repoPath });
    res.json({ success: true, status: stdout });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// PROFESSOR MODE: Curriculum & Flashcards
// ==========================================

router.post('/professor/curriculum/create', (req, res) => {
  const { topic, difficulty } = req.body;
  // Stub for LLM generation or structured output
  const curriculum = {
    topic,
    difficulty,
    modules: [
      { title: 'Foundations', lessons: ['Core Concepts', 'Historical Context'] },
      { title: 'Advanced Applications', lessons: ['Modern Techniques', 'Case Studies'] }
    ]
  };
  res.json({ success: true, curriculum });
});

router.post('/professor/flashcards/generate', (req, res) => {
  const { sourceText } = req.body;
  // Stub for generating flashcards from text
  const flashcards = [
    { front: 'What is the core principle?', back: 'Extracted key concept from source.' },
    { front: 'Define the main subject.', back: 'The primary focus of the text.' }
  ];
  res.json({ success: true, flashcards });
});

// ==========================================
// TRADER MODE: Market Data & Portfolio
// ==========================================

router.get('/trader/market/data', (req, res) => {
  const { symbol } = req.query;
  // Mock market data endpoint
  res.json({
    success: true,
    symbol: symbol || 'BTC',
    price: 64230.50 + (Math.random() * 100 - 50),
    volume24h: 1250000000,
    change24h: 2.45
  });
});

router.get('/trader/signals', (req, res) => {
  const { symbol } = req.query;
  res.json({
    success: true,
    symbol: symbol || 'BTC',
    signals: {
      rsi: 65,
      macd: 'bullish_cross',
      trend: 'UP',
      confidence: 85
    }
  });
});

router.post('/trader/portfolio', (req, res) => {
  // Mock portfolio state
  res.json({
    success: true,
    portfolio: {
      totalValue: 125430.00,
      pnl: 4500.50,
      assets: [
        { symbol: 'BTC', allocation: 40, value: 50172.00 },
        { symbol: 'ETH', allocation: 30, value: 37629.00 }
      ]
    }
  });
});

module.exports = router;
