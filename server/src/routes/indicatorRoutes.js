/**
 * Indicator API Routes
 * 
 * Express routes for accessing technical indicators (RSI, MACD, Stochastic)
 * Provides both REST endpoints for current values and SSE streams for real-time updates
 */

const express = require('express');
const router = express.Router();
const indicatorsService = require('../services/indicatorsService');
const config = require('../config/env');
const twelveDataStream = require('../services/twelveDataStream');

/**
 * GET /api/market/gold/indicators/rsi
 * Get current RSI value
 * Query params: period (default: 14)
 */
router.get('/rsi', (req, res) => {
  const period = parseInt(req.query.period || '14', 10);
  
  if (period <= 0 || isNaN(period)) {
    return res.status(400).json({
      error: 'Invalid parameter',
      message: 'period must be a positive number'
    });
  }

  let rsi = indicatorsService.getRSI(period);
  
  // If no cached value, try to calculate from current price series
  if (!rsi) {
    const series = twelveDataStream.getSeries();
    
    if (series && series.length >= period + 1) {
      const prices = series.map(p => p.price);
      rsi = indicatorsService.calculateRSI(prices, period);
      if (rsi) {
        const lastTime = series[series.length - 1].time;
        rsi = { rsi, time: lastTime, timestamp: new Date(lastTime).toISOString() };
      }
    }
  }
  
  if (!rsi) {
    return res.status(503).json({
      error: 'Insufficient data',
      message: `Not enough price data to calculate RSI with period ${period}. Need at least ${period + 1} price points.`
    });
  }

  res.json({
    indicator: 'RSI',
    period,
    ...rsi
  });
});

/**
 * GET /api/market/gold/indicators/macd
 * Get current MACD values
 * Query params: fast (default: 12), slow (default: 26), signal (default: 9)
 */
router.get('/macd', (req, res) => {
  const fast = parseInt(req.query.fast || '12', 10);
  const slow = parseInt(req.query.slow || '26', 10);
  const signal = parseInt(req.query.signal || '9', 10);

  if (fast <= 0 || slow <= 0 || signal <= 0 || isNaN(fast) || isNaN(slow) || isNaN(signal)) {
    return res.status(400).json({
      error: 'Invalid parameter',
      message: 'fast, slow, and signal must be positive numbers'
    });
  }

  if (fast >= slow) {
    return res.status(400).json({
      error: 'Invalid parameter',
      message: 'fast period must be less than slow period'
    });
  }

  let macd = indicatorsService.getMACD(fast, slow, signal);
  
  // If no cached value, try to calculate from current price series
  if (!macd) {
    const series = twelveDataStream.getSeries();
    if (series && series.length >= slow + signal) {
      const prices = series.map(p => p.price);
      macd = indicatorsService.calculateMACD(prices, fast, slow, signal);
      if (macd) {
        const lastTime = series[series.length - 1].time;
        macd = { ...macd, time: lastTime, timestamp: new Date(lastTime).toISOString() };
      }
    }
  }
  
  if (!macd) {
    return res.status(503).json({
      error: 'Insufficient data',
      message: `Not enough price data to calculate MACD with fast=${fast}, slow=${slow}, signal=${signal}. Need at least ${slow + signal} price points.`
    });
  }

  res.json({
    indicator: 'MACD',
    fast,
    slow,
    signal,
    ...macd
  });
});

/**
 * GET /api/market/gold/indicators/stochastic
 * Get current Stochastic values
 * Query params: kPeriod (default: 14), dPeriod (default: 3), smoothing (default: 3)
 */
router.get('/stochastic', (req, res) => {
  const kPeriod = parseInt(req.query.kPeriod || '14', 10);
  const dPeriod = parseInt(req.query.dPeriod || '3', 10);
  const smoothing = parseInt(req.query.smoothing || '3', 10);

  if (kPeriod <= 0 || dPeriod <= 0 || smoothing <= 0 || 
      isNaN(kPeriod) || isNaN(dPeriod) || isNaN(smoothing)) {
    return res.status(400).json({
      error: 'Invalid parameter',
      message: 'kPeriod, dPeriod, and smoothing must be positive numbers'
    });
  }

  let stochastic = indicatorsService.getStochastic(kPeriod, dPeriod, smoothing);
  
  // If no cached value, try to calculate from current price series
  if (!stochastic) {
    const series = twelveDataStream.getSeries();
    if (series && series.length >= kPeriod) {
      const prices = series.map(p => p.price);
      stochastic = indicatorsService.calculateStochastic(prices, kPeriod, dPeriod, smoothing);
      if (stochastic) {
        const lastTime = series[series.length - 1].time;
        stochastic = { ...stochastic, time: lastTime, timestamp: new Date(lastTime).toISOString() };
      }
    }
  }
  
  if (!stochastic) {
    return res.status(503).json({
      error: 'Insufficient data',
      message: `Not enough price data to calculate Stochastic with kPeriod=${kPeriod}, dPeriod=${dPeriod}, smoothing=${smoothing}. Need at least ${kPeriod} price points.`
    });
  }

  res.json({
    indicator: 'Stochastic',
    kPeriod,
    dPeriod,
    smoothing,
    ...stochastic
  });
});

/**
 * GET /api/market/gold/indicators/bollinger-bands
 * Get current Bollinger Bands values
 * Query params: period (default: 20), stdDev (default: 2)
 */
router.get('/bollinger-bands', (req, res) => {
  const period = parseInt(req.query.period || '20', 10);
  const stdDev = parseFloat(req.query.stdDev || '2');
  
  if (period <= 0 || isNaN(period) || stdDev <= 0 || isNaN(stdDev)) {
    return res.status(400).json({
      error: 'Invalid parameter',
      message: 'period and stdDev must be positive numbers'
    });
  }

  let bollingerBands = indicatorsService.getBollingerBands(period, stdDev);
  
  // If no cached value, try to calculate from current price series
  if (!bollingerBands) {
    const series = twelveDataStream.getSeries();
    if (series && series.length >= period) {
      const prices = series.map(p => p.price);
      bollingerBands = indicatorsService.calculateBollingerBands(prices, period, stdDev);
      if (bollingerBands) {
        const lastTime = series[series.length - 1].time;
        bollingerBands = { ...bollingerBands, time: lastTime, timestamp: new Date(lastTime).toISOString() };
      }
    }
  }
  
  if (!bollingerBands) {
    return res.status(503).json({
      error: 'Insufficient data',
      message: `Not enough price data to calculate Bollinger Bands with period=${period}. Need at least ${period} price points.`
    });
  }

  res.json({
    indicator: 'BollingerBands',
    period,
    stdDev,
    ...bollingerBands
  });
});

/**
 * GET /api/market/gold/indicators
 * Get all current indicator values (combined)
 */
router.get('/', (req, res) => {
  const rsi = indicatorsService.getRSI(14);
  const macd = indicatorsService.getMACD(12, 26, 9);
  const stochastic = indicatorsService.getStochastic(14, 3, 3);
  const bollingerBands = indicatorsService.getBollingerBands(20, 2);

  res.json({
    timestamp: new Date().toISOString(),
    rsi: rsi || null,
    macd: macd || null,
    stochastic: stochastic || null,
    bollingerBands: bollingerBands || null
  });
});

/**
 * GET /api/market/gold/indicators/rsi/stream
 * SSE stream for real-time RSI updates
 */
router.get('/rsi/stream', (req, res) => {
  const period = parseInt(req.query.period || '14', 10);
  
  if (period <= 0 || isNaN(period)) {
    return res.status(400).json({
      error: 'Invalid parameter',
      message: 'period must be a positive number'
    });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ 
    event: 'connected', 
    indicator: 'RSI',
    period,
    message: 'Streaming started',
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Register callback to send RSI updates
  const indicatorCallback = (indicators) => {
    try {
      // Recalculate RSI with requested period
      const rsi = indicatorsService.getRSI(period);
      if (rsi) {
        res.write(`data: ${JSON.stringify({
          indicator: 'RSI',
          period,
          ...rsi
        })}\n\n`);
      }
    } catch (error) {
      indicatorsService.offIndicatorUpdate(indicatorCallback);
    }
  };

  // Register the callback
  indicatorsService.onIndicatorUpdate(indicatorCallback);

  // Send current RSI if available
  const currentRSI = indicatorsService.getRSI(period);
  if (currentRSI) {
    res.write(`data: ${JSON.stringify({
      indicator: 'RSI',
      period,
      ...currentRSI
    })}\n\n`);
  }

  // Handle client disconnect
  req.on('close', () => {
    indicatorsService.offIndicatorUpdate(indicatorCallback);
    res.end();
  });

  // Keep connection alive with periodic heartbeat
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch (error) {
      clearInterval(heartbeatInterval);
      indicatorsService.offIndicatorUpdate(indicatorCallback);
    }
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeatInterval);
    indicatorsService.offIndicatorUpdate(indicatorCallback);
  });
});

/**
 * GET /api/market/gold/indicators/macd/stream
 * SSE stream for real-time MACD updates
 */
router.get('/macd/stream', (req, res) => {
  const fast = parseInt(req.query.fast || '12', 10);
  const slow = parseInt(req.query.slow || '26', 10);
  const signal = parseInt(req.query.signal || '9', 10);

  if (fast <= 0 || slow <= 0 || signal <= 0 || isNaN(fast) || isNaN(slow) || isNaN(signal)) {
    return res.status(400).json({
      error: 'Invalid parameter',
      message: 'fast, slow, and signal must be positive numbers'
    });
  }

  if (fast >= slow) {
    return res.status(400).json({
      error: 'Invalid parameter',
      message: 'fast period must be less than slow period'
    });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ 
    event: 'connected', 
    indicator: 'MACD',
    fast,
    slow,
    signal,
    message: 'Streaming started',
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Register callback to send MACD updates
  const indicatorCallback = (indicators) => {
    try {
      const macd = indicatorsService.getMACD(fast, slow, signal);
      if (macd) {
        res.write(`data: ${JSON.stringify({
          indicator: 'MACD',
          fast,
          slow,
          signal,
          ...macd
        })}\n\n`);
      }
    } catch (error) {
      indicatorsService.offIndicatorUpdate(indicatorCallback);
    }
  };

  // Register the callback
  indicatorsService.onIndicatorUpdate(indicatorCallback);

  // Send current MACD if available
  const currentMACD = indicatorsService.getMACD(fast, slow, signal);
  if (currentMACD) {
    res.write(`data: ${JSON.stringify({
      indicator: 'MACD',
      fast,
      slow,
      signal,
      ...currentMACD
    })}\n\n`);
  }

  // Handle client disconnect
  req.on('close', () => {
    indicatorsService.offIndicatorUpdate(indicatorCallback);
    res.end();
  });

  // Keep connection alive with periodic heartbeat
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch (error) {
      clearInterval(heartbeatInterval);
      indicatorsService.offIndicatorUpdate(indicatorCallback);
    }
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeatInterval);
    indicatorsService.offIndicatorUpdate(indicatorCallback);
  });
});

/**
 * GET /api/market/gold/indicators/stochastic/stream
 * SSE stream for real-time Stochastic updates
 */
router.get('/stochastic/stream', (req, res) => {
  const kPeriod = parseInt(req.query.kPeriod || '14', 10);
  const dPeriod = parseInt(req.query.dPeriod || '3', 10);
  const smoothing = parseInt(req.query.smoothing || '3', 10);

  if (kPeriod <= 0 || dPeriod <= 0 || smoothing <= 0 || 
      isNaN(kPeriod) || isNaN(dPeriod) || isNaN(smoothing)) {
    return res.status(400).json({
      error: 'Invalid parameter',
      message: 'kPeriod, dPeriod, and smoothing must be positive numbers'
    });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ 
    event: 'connected', 
    indicator: 'Stochastic',
    kPeriod,
    dPeriod,
    smoothing,
    message: 'Streaming started',
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Register callback to send Stochastic updates
  const indicatorCallback = (indicators) => {
    try {
      const stochastic = indicatorsService.getStochastic(kPeriod, dPeriod, smoothing);
      if (stochastic) {
        res.write(`data: ${JSON.stringify({
          indicator: 'Stochastic',
          kPeriod,
          dPeriod,
          smoothing,
          ...stochastic
        })}\n\n`);
      }
    } catch (error) {
      indicatorsService.offIndicatorUpdate(indicatorCallback);
    }
  };

  // Register the callback
  indicatorsService.onIndicatorUpdate(indicatorCallback);

  // Send current Stochastic if available
  const currentStochastic = indicatorsService.getStochastic(kPeriod, dPeriod, smoothing);
  if (currentStochastic) {
    res.write(`data: ${JSON.stringify({
      indicator: 'Stochastic',
      kPeriod,
      dPeriod,
      smoothing,
      ...currentStochastic
    })}\n\n`);
  }

  // Handle client disconnect
  req.on('close', () => {
    indicatorsService.offIndicatorUpdate(indicatorCallback);
    res.end();
  });

  // Keep connection alive with periodic heartbeat
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch (error) {
      clearInterval(heartbeatInterval);
      indicatorsService.offIndicatorUpdate(indicatorCallback);
    }
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeatInterval);
    indicatorsService.offIndicatorUpdate(indicatorCallback);
  });
});

/**
 * GET /api/market/gold/indicators/bollinger-bands/stream
 * SSE stream for real-time Bollinger Bands updates
 */
router.get('/bollinger-bands/stream', (req, res) => {
  const period = parseInt(req.query.period || '20', 10);
  const stdDev = parseFloat(req.query.stdDev || '2');

  if (period <= 0 || stdDev <= 0 || isNaN(period) || isNaN(stdDev)) {
    return res.status(400).json({
      error: 'Invalid parameter',
      message: 'period must be a positive integer and stdDev must be a positive number'
    });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ 
    event: 'connected', 
    indicator: 'BollingerBands',
    period,
    stdDev,
    message: 'Streaming started',
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Register callback to send Bollinger Bands updates
  const indicatorCallback = (indicators) => {
    try {
      const bollingerBands = indicatorsService.getBollingerBands(period, stdDev);
      if (bollingerBands) {
        res.write(`data: ${JSON.stringify({
          indicator: 'BollingerBands',
          period,
          stdDev,
          ...bollingerBands
        })}\n\n`);
      }
    } catch (error) {
      indicatorsService.offIndicatorUpdate(indicatorCallback);
    }
  };

  // Register the callback
  indicatorsService.onIndicatorUpdate(indicatorCallback);

  // Send current Bollinger Bands if available
  const currentBollingerBands = indicatorsService.getBollingerBands(period, stdDev);
  if (currentBollingerBands) {
    res.write(`data: ${JSON.stringify({
      indicator: 'BollingerBands',
      period,
      stdDev,
      ...currentBollingerBands
    })}\n\n`);
  }

  // Handle client disconnect
  req.on('close', () => {
    indicatorsService.offIndicatorUpdate(indicatorCallback);
    res.end();
  });

  // Keep connection alive with periodic heartbeat
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch (error) {
      clearInterval(heartbeatInterval);
      indicatorsService.offIndicatorUpdate(indicatorCallback);
    }
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeatInterval);
    indicatorsService.offIndicatorUpdate(indicatorCallback);
  });
});

/**
 * GET /api/market/gold/indicators/historical
 * Get historical indicator data for a date range
 * Query params:
 * - day (YYYY-MM-DD) - Day to fetch indicators for
 * - rsiPeriod (default: 14)
 * - macdFast (default: 12)
 * - macdSlow (default: 26)
 * - macdSignal (default: 9)
 * - stochK (default: 14)
 * - stochD (default: 3)
 * - stochSmoothing (default: 3)
 * - bbPeriod (default: 20)
 * - bbStdDev (default: 2)
 */
router.get('/historical', async (req, res) => {
  try {
    const dayParam = req.query.day;
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const baseDay = dayParam ? new Date(dayParam) : new Date();

    if (Number.isNaN(baseDay.getTime())) {
      return res.status(400).json({ error: 'Invalid day parameter. Use YYYY-MM-DD.' });
    }

    // Get indicator parameters from query
    const rsiPeriod = parseInt(req.query.rsiPeriod || '14', 10);
    const macdFast = parseInt(req.query.macdFast || '12', 10);
    const macdSlow = parseInt(req.query.macdSlow || '26', 10);
    const macdSignal = parseInt(req.query.macdSignal || '9', 10);
    const stochK = parseInt(req.query.stochK || '14', 10);
    const stochD = parseInt(req.query.stochD || '3', 10);
    const stochSmoothing = parseInt(req.query.stochSmoothing || '3', 10);
    const bbPeriod = parseInt(req.query.bbPeriod || '20', 10);
    const bbStdDev = parseFloat(req.query.bbStdDev || '2');

    // Validate parameters
    if (rsiPeriod <= 0 || macdFast <= 0 || macdSlow <= 0 || macdSignal <= 0 ||
        stochK <= 0 || stochD <= 0 || stochSmoothing <= 0 || bbPeriod <= 0 || bbStdDev <= 0) {
      return res.status(400).json({ error: 'All parameters must be positive numbers' });
    }

    // Fetch historical prices for the day
    const start = new Date(baseDay);
    const end = new Date(baseDay);
    end.setDate(end.getDate() + 1);

    const fmt = (d) => d.toISOString().split('T')[0];
    const start_date = fmt(start);
    const end_date = fmt(end);

    // Use twelveDataHistorical to get prices
    const twelveDataHistorical = require('../services/twelveDataHistorical');
    const historicalPrices = await twelveDataHistorical.getHistoricalData({
      symbol: config.symbol,
      interval: config.interval,
      start_date,
      end_date
    });

    if (!historicalPrices || historicalPrices.length === 0) {
      return res.json({
        day: dayParam,
        rsi: [],
        macd: [],
        stochastic: [],
        bollingerBands: []
      });
    }

    // Calculate indicators from historical prices
    const indicators = indicatorsService.calculateHistoricalIndicators(
      historicalPrices,
      rsiPeriod,
      macdFast,
      macdSlow,
      macdSignal,
      stochK,
      stochD,
      stochSmoothing,
      bbPeriod,
      bbStdDev
    );


    res.json({
      day: dayParam,
      parameters: {
        rsiPeriod,
        macd: { fast: macdFast, slow: macdSlow, signal: macdSignal },
        stochastic: { k: stochK, d: stochD, smoothing: stochSmoothing },
        bollinger: { period: bbPeriod, stdDev: bbStdDev }
      },
      ...indicators
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch historical indicators',
      message: error.message
    });
  }
});

/**
 * GET /api/market/gold/indicators/stream
 * Server-Sent Events (SSE) endpoint for streaming real-time indicator updates
 * 
 * Streams RSI, MACD, Stochastic, and Bollinger Bands updates as they are calculated
 */
router.get('/stream', (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Send initial connection message
  res.write(`data: ${JSON.stringify({
    event: 'connected',
    message: 'Indicator stream started',
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Register callback to send new indicator updates
  const updateCallback = (indicators) => {
    try {
      res.write(`data: ${JSON.stringify({
        rsi: indicators.rsi,
        macd: indicators.macd,
        stochastic: indicators.stochastic,
        bollingerBands: indicators.bollingerBands,
        timestamp: new Date().toISOString()
      })}\n\n`);
    } catch (error) {
      indicatorsService.offIndicatorUpdate(updateCallback);
    }
  };

  // Register the callback
  indicatorsService.onIndicatorUpdate(updateCallback);

  // Send current indicators if available (just like price stream sends last quote)
  const currentIndicators = {
    rsi: indicatorsService.getRSI(14),
    macd: indicatorsService.getMACD(12, 26, 9),
    stochastic: indicatorsService.getStochastic(14, 3, 3),
    bollingerBands: indicatorsService.getBollingerBands(20, 2)
  };
  
  if (currentIndicators.rsi || currentIndicators.macd || currentIndicators.stochastic || currentIndicators.bollingerBands) {
    res.write(`data: ${JSON.stringify({
      rsi: currentIndicators.rsi,
      macd: currentIndicators.macd,
      stochastic: currentIndicators.stochastic,
      bollingerBands: currentIndicators.bollingerBands,
      timestamp: new Date().toISOString()
    })}\n\n`);
  }

  // Handle client disconnect
  req.on('close', () => {
    indicatorsService.offIndicatorUpdate(updateCallback);
    res.end();
  });

  // Keep connection alive with periodic heartbeat
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch (error) {
      clearInterval(heartbeatInterval);
      indicatorsService.offIndicatorUpdate(updateCallback);
    }
  }, 30000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    indicatorsService.offIndicatorUpdate(updateCallback);
  });
});

module.exports = router;
