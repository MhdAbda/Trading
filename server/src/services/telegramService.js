// Telegram sending disabled: no-op service
const config = require('../config/env');

/**
 * Send a Telegram message using the configured bot token.
 * @param {object} params
 * @param {string} params.message - Text to send.
 * @returns {Promise<{ok: boolean, chatId: string, messageId?: number}>}
 */
async function sendMessage({ message }) {
  // Always succeed without sending anything; logs suppressed
  const targetChatId = config.telegram?.defaultChatId || '';
  return { ok: true, chatId: String(targetChatId || ''), messageId: undefined, disabled: true };
}

module.exports = {
  sendMessage
};
