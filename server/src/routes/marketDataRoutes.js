/**
 * Market Data API Routes
 * 
 * Express routes for accessing market data from the Twelve Data stream
 */

const express = require('express');
const router = express.Router();
const twelveDataStream = require('../services/twelveDataStream');
const twelveDataHistorical = require('../services/twelveDataHistorical');
const config = require('../config/env');

// Cache for historical data to prevent re-fetching on reconnection
let historicalDataCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache

/**
 * GET /api/market/health
 * Health check endpoint with WebSocket connection status
 */
router.get('/health', (req, res) => {
  const status = twelveDataStream.getStatus();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    websocket: {
      connected: status.isConnected,
      connecting: status.isConnecting,
      reconnectAttempts: status.reconnectAttempts
    },
    data: {
      seriesLength: status.seriesLength,
      lastQuoteTime: status.lastQuoteTime
    }
  });
});

/**
 * GET /api/market/gold/last-quote
 * Returns the latest quote from the Twelve Data stream
 */
router.get('/gold/last-quote', (req, res) => {
  const lastQuote = twelveDataStream.getLastQuote();
  
  if (!lastQuote) {
    return res.status(503).json({
      error: 'No data available',
      message: 'WebSocket connection may not be established or no data received yet'
    });
  }

  res.json(lastQuote);
});

// Simple in-memory cache for day-range historical fetches
const intradayDayCache = new Map(); // key: `${start}_${end}_${interval}` -> { data, fetchedAt }

/**
 * GET /api/market/gold/intraday
 * Returns intraday data for a 2-day window around the requested day
 * Query params:
 * - day (YYYY-MM-DD) -> day the user is viewing; start = day-1, end = day+1
 */
router.get('/gold/intraday', async (req, res) => {
  try {
    const dayParam = req.query.day;
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const baseDay = dayParam ? new Date(dayParam) : new Date();

    if (Number.isNaN(baseDay.getTime())) {
      return res.status(400).json({ error: 'Invalid day parameter. Use YYYY-MM-DD.' });
    }

    // Build start/end (selected day to day + 1) in YYYY-MM-DD
    const start = new Date(baseDay);
    const end = new Date(baseDay);
    end.setDate(end.getDate() + 1);

    const fmt = (d) => d.toISOString().split('T')[0];
    const start_date = fmt(start);
    const end_date = fmt(end);
    const interval = config.interval || '1min';
    const cacheKey = `${start_date}_${end_date}_${interval}`;

    // Serve from cache if available
    if (intradayDayCache.has(cacheKey)) {
      const cached = intradayDayCache.get(cacheKey);
      return res.json({
        symbol: config.symbol,
        interval,
        count: cached.data.length,
        cached: true,
        start_date,
        end_date,
        data: cached.data
      });
    }

    // Fetch from Twelve Data REST if not cached
    const historical = await twelveDataHistorical.getHistoricalData({
      symbol: config.symbol,
      interval,
      start_date,
      end_date,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });

    intradayDayCache.set(cacheKey, { data: historical, fetchedAt: Date.now() });

    res.json({
      symbol: config.symbol,
      interval,
      count: historical.length,
      cached: false,
      start_date,
      end_date,
      data: historical
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch intraday data' });
  }
});

/**
 * GET /api/market/gold/stream
 * Server-Sent Events (SSE) endpoint for streaming real-time price updates
 * 
 * Clients can connect to this endpoint to receive real-time price updates
 * as they arrive from the Twelve Data WebSocket stream.
 */
router.get('/gold/stream', (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ 
    event: 'connected', 
    message: 'Streaming started',
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Register callback to send new ticks to this client
  const tickCallback = (quote) => {
    try {
      res.write(`data: ${JSON.stringify(quote)}\n\n`);
    } catch (error) {
      // Remove callback if write fails (client likely disconnected)
      twelveDataStream.offTick(tickCallback);
    }
  };

  // Register the callback
  twelveDataStream.onTick(tickCallback);

  // Send current last quote if available
  const lastQuote = twelveDataStream.getLastQuote();
  if (lastQuote) {
    res.write(`data: ${JSON.stringify(lastQuote)}\n\n`);
  }

  // Handle client disconnect
  req.on('close', () => {
    twelveDataStream.offTick(tickCallback);
    res.end();
  });

  // Keep connection alive with periodic heartbeat
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch (error) {
      clearInterval(heartbeatInterval);
      twelveDataStream.offTick(tickCallback);
    }
  }, 30000); // Every 30 seconds

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    twelveDataStream.offTick(tickCallback);
  });
});

/**
 * GET /api/market/gold/historical
 * Server-Sent Events (SSE) endpoint for streaming historical + real-time price updates
 *
 * Initially sends historical data, then continues streaming real-time updates
 * like gold/stream but with historical context.
 *
 * Query Parameters:
 * - interval: Time interval (1min, 5min, 15min, 30min, 1h, 1day) - default: 1min
 * - days: Number of days back to fetch - default: 7 for intraday, 365 for daily
 * - start_date: Specific start date (YYYY-MM-DD) - overrides days parameter
 * - end_date: Specific end date (YYYY-MM-DD) - default: today * - timezone: Timezone for the data (e.g., 'America/New_York', 'UTC') - default: current system timezone */
router.get('/gold/historical', async (req, res) => {
  try {
    const {
      interval = '1min',
      days,
      start_date,
      end_date,
      timezone
    } = req.query;

    // Determine default days based on interval
    let defaultDays;
    switch (interval) {
      case '1min':
        defaultDays = 30; // 30 days for 1-minute data
        break;
      case '5min':
        defaultDays = 60; // ~2 months
        break;
      case '15min':
        defaultDays = 180; // ~6 months
        break;
      case '30min':
        defaultDays = 365; // ~1 year
        break;
      case '1h':
        defaultDays = 730; // ~2 years
        break;
      case '1day':
        defaultDays = 3650; // ~10 years
        break;
      default:
        defaultDays = 30;
    }

    const daysToFetch = days ? parseInt(days) : defaultDays;
    const actualStartDate = start_date || twelveDataHistorical.calculateStartDate(interval, daysToFetch);


    // Check cache validity
    const now = Date.now();
    let historicalData;
    if (!historicalDataCache || !cacheTimestamp || (now - cacheTimestamp) > CACHE_DURATION) {
      // Fetch historical data
      historicalData = await twelveDataHistorical.getHistoricalData({
        symbol: config.symbol,
        interval,
        start_date: actualStartDate,
        end_date,
        timezone // Pass timezone if provided
      });

      // Cache the data
      historicalDataCache = historicalData;
      cacheTimestamp = now;
    } else {
      historicalData = historicalDataCache;
    }


    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering


    // Send initial historical data
    res.write(`data: ${JSON.stringify({
      event: 'historical',
      symbol: config.symbol,
      interval,
      startDate: actualStartDate,
      endDate: end_date || new Date().toISOString().split('T')[0],
      count: historicalData.length,
      data: historicalData,
      metadata: {
        availableRanges: twelveDataHistorical.getAvailableRanges(),
        requestedDays: daysToFetch,
        actualStartDate
      }
    })}\n\n`);


    // Send connection message
    res.write(`data: ${JSON.stringify({
      event: 'connected',
      message: 'Historical data sent, now streaming real-time updates',
      timestamp: new Date().toISOString()
    })}\n\n`);

    // Register callback to send new ticks to this client
    const tickCallback = (quote) => {
      try {
        res.write(`data: ${JSON.stringify({
          event: 'realtime',
          ...quote
        })}\n\n`);
      } catch (error) {
        // Remove callback if write fails (client likely disconnected)
        twelveDataStream.offTick(tickCallback);
      }
    };

    // Register the callback
    twelveDataStream.onTick(tickCallback);

    // Send current last quote if available
    const lastQuote = twelveDataStream.getLastQuote();
    if (lastQuote) {
      res.write(`data: ${JSON.stringify({
        event: 'realtime',
        ...lastQuote
      })}\n\n`);
    }

    // Handle client disconnect
    req.on('close', () => {
      twelveDataStream.offTick(tickCallback);
      res.end();
    });

    // Keep connection alive with periodic heartbeat
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch (error) {
        clearInterval(heartbeatInterval);
        twelveDataStream.offTick(tickCallback);
      }
    }, 30000); // Every 30 seconds

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      twelveDataStream.offTick(tickCallback);
    });

  } catch (error) {
    // If we can't fetch historical data, still try to stream real-time
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to fetch historical data',
        message: error.message,
        symbol: config.symbol
      });
    }
  }
});

module.exports = router;

