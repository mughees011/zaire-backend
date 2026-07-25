const express = require('express');
const chatHistoryService = require('../services/chat_history_service');
const { requireAuth } = require('../middleware/auth_middleware');

const router = express.Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  res.json({ success: true, sessions: chatHistoryService.getSessions(req.user.id) });
});

router.get('/:id', (req, res) => {
  const session = chatHistoryService.getSession(req.params.id);
  if (session && session.userId === req.user.id) {
    return res.json({ success: true, session });
  }
  return res.status(404).json({ success: false, message: 'Session not found' });
});

router.delete('/:id', (req, res) => {
  const session = chatHistoryService.getSession(req.params.id);
  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  const success = chatHistoryService.deleteSession(req.params.id);
  res.json({ success });
});

router.put('/:id', (req, res) => {
  const session = chatHistoryService.getSession(req.params.id);
  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  const { title } = req.body;
  const success = chatHistoryService.renameSession(req.params.id, title);
  res.json({ success });
});

module.exports = router;
