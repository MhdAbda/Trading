const express = require('express');
const router = express.Router();
// Telegram notifications disabled; route returns 503

/**
 * POST /api/notify/telegram
 * Body: { message: string }
 * Uses TELEGRAM_CHAT_ID from environment; request cannot override.
 */
router.post('/telegram', async (req, res) => {
  res.status(503).json({ ok: false, error: 'disabled', message: 'Telegram notifications are disabled' });
});

module.exports = router;
