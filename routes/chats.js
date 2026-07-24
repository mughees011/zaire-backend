const express = require('express');
const chatHistoryService = require('../services/chat_history_service');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ success: true, sessions: chatHistoryService.getSessions() });
});

router.get('/:id', (req, res) => {
  const session = chatHistoryService.getSession(req.params.id);
  if (session) {
    return res.json({ success: true, session });
  }
  return res.status(404).json({ success: false, message: 'Session not found' });
});

router.delete('/:id', (req, res) => {
  const success = chatHistoryService.deleteSession(req.params.id);
  res.json({ success });
});

router.put('/:id', (req, res) => {
  const { title } = req.body;
  const success = chatHistoryService.renameSession(req.params.id, title);
  res.json({ success });
});

module.exports = router;
