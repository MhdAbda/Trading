const express = require('express');
const router = express.Router();
const telegramService = require('../services/telegramService');

/**
 * POST /api/notify/telegram
 * Body: { message: string }
 * Uses TELEGRAM_CHAT_ID from environment; request cannot override.
 */
router.post('/telegram', async (req, res) => {
  try {
    const { message } = req.body || {};

    const result = await telegramService.sendMessage({ message });

    res.json({
      ok: true,
      chatId: result.chatId,
      messageId: result.messageId
    });
  } catch (error) {
    const status = error.status && Number.isInteger(error.status) ? error.status : 500;
    res.status(status).json({
      error: 'telegram_send_failed',
      message: error.message || 'Failed to send Telegram message'
    });
  }
});

module.exports = router;
