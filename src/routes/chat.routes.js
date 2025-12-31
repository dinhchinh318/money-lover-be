// routes/chat.routes.js
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.use(verifyToken);
/**
 * Chat endpoints
 */

// Gửi tin nhắn
router.post('/message', chatController.sendMessage);

// Quick query (không cần session)
router.post('/quick-query', chatController.quickQuery);

// Sessions
router.get('/sessions', chatController.getSessions);
router.post('/session/new', chatController.createNewSession);
router.get('/session/:sessionId', chatController.getSessionDetail);
router.put('/session/:sessionId', chatController.updateSession);
router.delete('/session/:sessionId', chatController.deleteSession);

// Chat history
router.get('/history/:sessionId', chatController.getChatHistory);

module.exports = router;