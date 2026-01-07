/**
 * Environment configuration loader
 * Loads and validates environment variables with defaults
 */

require('dotenv').config();

const config = {
  port: process.env.PORT || 4000,
  twelveDataApiKey: process.env.TWELVE_DATA_API_KEY,
  twelveDataWsUrl: `wss://ws.twelvedata.com/v1/quotes/price?apikey=${process.env.TWELVE_DATA_API_KEY}`,
  symbol: process.env.SYMBOL || 'XAU/USD',
  interval: process.env.INTERVAL || '1min',
  maxPoints: parseInt(process.env.MAX_POINTS || '2000', 10),
  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgre',
    password: process.env.DB_PASSWORD || 'password',
    name: process.env.DB_NAME || 'trading_bot_db'
  },
  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  // Indicator default parameters (optional, can be overridden via API query params)
  indicators: {
    rsi: {
      period: parseInt(process.env.RSI_PERIOD || '14', 10)
    },
    macd: {
      fast: parseInt(process.env.MACD_FAST || '12', 10),
      slow: parseInt(process.env.MACD_SLOW || '26', 10),
      signal: parseInt(process.env.MACD_SIGNAL || '9', 10)
    },
    stochastic: {
      kPeriod: parseInt(process.env.STOCHASTIC_K || '14', 10),
      dPeriod: parseInt(process.env.STOCHASTIC_D || '3', 10),
      smoothing: parseInt(process.env.STOCHASTIC_SMOOTHING || '3', 10)
    }
  },
  // Telegram configuration
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    defaultChatId: process.env.TELEGRAM_CHAT_ID
  }
};

// Validate required environment variables
if (!config.twelveDataApiKey) {
  console.error('ERROR: TWELVE_DATA_API_KEY is required but not set in environment variables');
  process.exit(1);
}

// Warn if Telegram is not configured (endpoint will validate per request)
if (!config.telegram.botToken) {
  console.warn('WARNING: TELEGRAM_BOT_TOKEN is not set; Telegram notifications will be disabled');
}

module.exports = config;

