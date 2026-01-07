/**
 * Trading Info Backend Server
 * 
 * Node.js/Express server that connects to Twelve Data WebSocket API,
 * maintains an in-memory buffer of market data, and exposes HTTP endpoints
 * for accessing real-time and historical intraday data.
 * 
 * SETUP:
 * 1. Copy .env.example to .env
 * 2. Add your TWELVE_DATA_API_KEY to .env
 * 3. Optionally configure PORT, SYMBOL, INTERVAL, etc.
 * 4. Run: npm install
 * 5. Run: npm start (or npm run dev for development)
 * 
 * API ENDPOINTS:
 * - GET /api/market/health - Health check with connection status
 * - GET /api/market/gold/last-quote - Latest price quote
 * - GET /api/market/gold/intraday - Full intraday data buffer
 * - GET /api/market/gold/stream - SSE stream of real-time updates
 * 
 * EXAMPLE CURL COMMANDS:
 * 
 * # Health check
 * curl http://localhost:4000/api/market/health
 * 
 * # Get latest quote
 * curl http://localhost:4000/api/market/gold/last-quote
 * 
 * # Get intraday data
 * curl http://localhost:4000/api/market/gold/intraday
 * 
 * # Stream real-time updates (SSE)
 * curl -N http://localhost:4000/api/market/gold/stream
 */

const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const logger = require('./utils/logger');
const db = require('./utils/db');
const twelveDataStream = require('./services/twelveDataStream');
const marketDataRoutes = require('./routes/marketDataRoutes');
const indicatorRoutes = require('./routes/indicatorRoutes');
const authRoutes = require('./routes/authRoutes');
const notifyRoutes = require('./routes/notifyRoutes');
const rulesRoutes = require('./routes/rulesRoutes');
const ruleAlertService = require('./services/ruleAlertService');

// Create Express app
const app = express();

// Middleware
app.use(cors()); // Enable CORS for frontend access
app.use(express.json()); // Parse JSON request bodies

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/market', marketDataRoutes);
app.use('/api/market/gold/indicators', indicatorRoutes);
app.use('/api/notify', notifyRoutes);
app.use('/api/rules', rulesRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Trading Info Backend API',
    version: '1.0.0',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        profile: 'GET /api/auth/profile (requires auth)',
        updateProfile: 'PUT /api/auth/profile (requires auth)',
        changePassword: 'POST /api/auth/change-password (requires auth)',
        verify: 'POST /api/auth/verify',
        me: 'GET /api/auth/me (requires auth)'
      },
      market: {
        health: '/api/market/health',
        lastQuote: '/api/market/gold/last-quote',
        intraday: '/api/market/gold/intraday',
        stream: '/api/market/gold/stream'
      },
      indicators: {
        all: '/api/market/gold/indicators',
        rsi: '/api/market/gold/indicators/rsi?period=14',
        macd: '/api/market/gold/indicators/macd?fast=12&slow=26&signal=9',
        stochastic: '/api/market/gold/indicators/stochastic?kPeriod=14&dPeriod=3&smoothing=3',
        streams: {
          all: '/api/market/gold/indicators/stream',
          rsi: '/api/market/gold/indicators/rsi/stream?period=14',
          macd: '/api/market/gold/indicators/macd/stream?fast=12&slow=26&signal=9',
          stochastic: '/api/market/gold/indicators/stochastic/stream?kPeriod=14&dPeriod=3&smoothing=3'
        }
      }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
const server = app.listen(config.port, async () => {
  logger.info(`========================================`);
  logger.info(`Server started on port ${config.port}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Symbol: ${config.symbol}, Interval: ${config.interval}`);
  logger.info(`========================================`);
  
  // Test database connection (silent)
  await db.testConnection();
  
  // Start Twelve Data WebSocket stream (silent)
  twelveDataStream.start();

  // Start background rule alert service (evaluates rules on each tick)
  try {
    await ruleAlertService.start();
  } catch (err) {
    logger.error(`[RuleAlerts] Failed to start rule alert service: ${err.message}`);
  }
});

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  // Stop accepting new connections
  server.close(async () => {
    // Stop WebSocket connection
    twelveDataStream.stop();
    
    // Close database connections
    try {
      await db.closePool();
    } catch (error) {
      // Silent error
    }
    
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    process.exit(1);
  }, 10000);
};

// Handle process signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('[CRITICAL] Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('[CRITICAL] Unhandled rejection:', reason);
});

