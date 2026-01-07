const fetch = require('node-fetch');
const logger = require('../utils/logger');
const config = require('../config/env');

/**
 * Send a Telegram message using the configured bot token.
 * @param {object} params
 * @param {string} params.message - Text to send.
 * @returns {Promise<{ok: boolean, chatId: string, messageId?: number}>}
 */
async function sendMessage({ message }) {
  if (!config.telegram.botToken) {
    const err = new Error('Telegram bot token not configured');
    err.status = 503;
    throw err;
  }

  const targetChatId = config.telegram.defaultChatId;
  if (!targetChatId) {
    const err = new Error('TELEGRAM_CHAT_ID is required (no default configured)');
    err.status = 400;
    throw err;
  }

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    const err = new Error('message is required');
    err.status = 400;
    throw err;
  }

  const trimmed = message.trim();

  try {
    const url = `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: trimmed,
        parse_mode: 'HTML'
      })
    });

    const json = await response.json();

    if (!response.ok || !json.ok) {
      const err = new Error(json.description || 'Telegram API error');
      err.status = response.status || 502;
      throw err;
    }

    const preview = trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
    logger.info(`[Telegram] Message sent to chat ${targetChatId} (message_id=${json.result?.message_id || 'n/a'}): ${preview}`);

    return {
      ok: true,
      chatId: String(targetChatId),
      messageId: json.result?.message_id
    };
  } catch (error) {
    logger.error(`[Telegram] sendMessage failed: ${error.message}`);
    throw error;
  }
}

module.exports = {
  sendMessage
};
