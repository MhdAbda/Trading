/**
 * Twelve Data WebSocket Stream Service
 * 
 * Manages WebSocket connection to Twelve Data API, subscribes to market data,
 * maintains in-memory buffer of recent intraday data, and provides methods
 * to access current data and register callbacks for new ticks.
 */

const WebSocket = require('ws');
const logger = require('../utils/logger');
const config = require('../config/env');
const indicatorsService = require('./indicatorsService');

class TwelveDataStream {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 3000; // 3 seconds initial delay
    this.reconnectTimer = null;
    
    // Data storage
    this.lastQuote = null;
    this.series = []; // Array of { time, price } objects
    this.maxPoints = config.maxPoints;
    
    // Callbacks for tick events (for future features like Telegram alerts)
    this.tickCallbacks = [];
  }

  /**
   * Start the WebSocket connection and subscribe to market data
   */
  start() {
    if (this.isConnecting || this.isConnected) {
      logger.warn('[Twelve Data WebSocket] Connection already active');
      return;
    }

    logger.info('[Twelve Data WebSocket] Starting WebSocket connection');
    this.connect();
  }

  /**
   * Establish WebSocket connection to Twelve Data
   */
  connect() {
    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    logger.info(`[Twelve Data WebSocket] Connecting to: ${config.twelveDataWsUrl}`);

    try {
      // Create WebSocket connection
      this.ws = new WebSocket(config.twelveDataWsUrl);

      // Handle connection open
      this.ws.on('open', () => {
        this.isConnecting = false;
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Subscribe to the configured symbol
        this.subscribe();
      });

      // Handle incoming messages
      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          // Silent error
        }
      });

      // Handle connection errors
      this.ws.on('error', (error) => {
        this.isConnected = false;
        this.isConnecting = false;
      });

      // Handle connection close
      this.ws.on('close', (code, reason) => {
        this.isConnected = false;
        this.isConnecting = false;
        
        // Attempt to reconnect if not intentionally closed
        if (code !== 1000) { // 1000 = normal closure
          this.scheduleReconnect();
        }
      });

    } catch (error) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Subscribe to market data for the configured symbol
   */
  subscribe() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Twelve Data subscription message format
    // Note: WebSocket API may not support interval parameter, or may use different format
    const subscribeMessage = {
      action: 'subscribe',
      params: {
        apikey: config.twelveDataApiKey,
        symbols: config.symbol
        // Note: Some WebSocket APIs don't support interval parameter
        // interval: config.interval
      }
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    
    // Load historical data to pre-populate the series
    this.loadHistoricalData();
  }

  /**
   * Load historical data to pre-populate the series buffer
   * This ensures indicators can be calculated immediately without waiting for WebSocket ticks
   */
  async loadHistoricalData() {
    try {
      const twelveDataHistorical = require('./twelveDataHistorical');
      
      const historicalData = await twelveDataHistorical.getHistoricalData({
        symbol: config.symbol,
        interval: config.interval,
        outputsize: config.maxPoints || 2000
      });

      if (historicalData && historicalData.length > 0) {
        // Add each historical data point to the series
        historicalData.forEach(point => {
          const time = point.datetime || point.time || new Date(point.timestamp * 1000).toISOString();
          const price = parseFloat(point.close || point.price);
          
          if (!isNaN(price)) {
            this.addToSeries(time, price);
          }
        });
        
        // Initialize indicators with historical data
        if (this.series.length > 0) {
          const prices = this.series.map(p => p.price);
          indicatorsService.updateIndicators(this.lastQuote || this.series[this.series.length - 1], this.series);
        }
      }
    } catch (error) {
      // Continue anyway - WebSocket ticks will populate the series
    }
  }

  /**
   * Handle incoming WebSocket messages
   * Parses price data and updates internal state
   */
  handleMessage(message) {
    // Twelve Data message format may vary - adjust based on actual API response
    // Common formats: { event: 'price', symbol: 'XAU/USD', price: 2000.50, timestamp: ... }
    
    if (message.event === 'price' || message.price !== undefined) {
      const price = parseFloat(message.price);
      let time = message.timestamp || message.time;
      
      // If no timestamp provided, use current time in local timezone
      if (!time) {
        time = new Date().toLocaleString('sv-SE', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }).replace(' ', 'T');
      } else {
        // Convert UTC timestamp to local timezone if it's an ISO string
        if (typeof time === 'string' && time.includes('T')) {
          const utcDate = new Date(time);
          time = utcDate.toLocaleString('sv-SE', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }).replace(' ', 'T');
        }
      }
      
      if (isNaN(price)) {
        return;
      }
      
      // Update last quote
      this.lastQuote = {
        price,
        time,
        symbol: message.symbol || config.symbol,
        interval: message.interval || config.interval
      };

      // Add to series buffer
      this.addToSeries(time, price);

      // Update indicators with new price data (pass series to avoid circular dependency)
      indicatorsService.updateIndicators(this.lastQuote, this.series);

      // Notify registered callbacks
      this.notifyTickCallbacks(this.lastQuote);
    }
  }

  /**
   * Add a data point to the series buffer
   * Maintains only the last N points (MAX_POINTS)
   */
  addToSeries(time, price) {
    const dataPoint = { time, price };
    
    this.series.push(dataPoint);
    
    // Keep only the last maxPoints entries
    if (this.series.length > this.maxPoints) {
      this.series.shift(); // Remove oldest entry
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached. Stopping reconnection attempts.');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts);
    this.reconnectAttempts++;

    logger.info(`Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${Math.round(delay / 1000)}s`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Stop the WebSocket connection
   */
  stop() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      logger.info('[Twelve Data WebSocket] Closing connection');
      this.ws.close(1000, 'Intentional shutdown');
      this.ws = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  /**
   * Get the current intraday time series
   * @returns {Array} Array of { time, price } objects
   */
  getSeries() {
    return [...this.series]; // Return a copy to prevent external mutation
  }

  /**
   * Fetch the latest OHLC candle from Twelve Data historical API
   * @returns {Promise<Object>} OHLC data { open, high, low, close, volume }
   */
  async fetchLatestCandle() {
    try {
      logger.info(`[Twelve Data WebSocket] Fetching latest candle for ${config.symbol} with interval ${config.interval}`);
      
      // Get the most recent candle (last 2 candles to ensure we get complete data)
      const historicalData = await twelveDataHistorical.getHistoricalData({
        symbol: config.symbol,
        interval: config.interval,
        outputsize: 2
      });

      if (historicalData && historicalData.length > 0) {
        // Return the most recent candle
        const latestCandle = historicalData[historicalData.length - 1];
        const candleData = {
          open: parseFloat(latestCandle.open),
          high: parseFloat(latestCandle.high),
          low: parseFloat(latestCandle.low),
          close: parseFloat(latestCandle.close),
          volume: parseInt(latestCandle.volume) || 0
        };
        
        logger.info(`[Twelve Data WebSocket] Latest candle retrieved: ${JSON.stringify(candleData)}`);
        return candleData;
      }

      logger.warn('[Twelve Data WebSocket] No historical data available for latest candle');
      throw new Error('No historical data available');
    } catch (error) {
      logger.error(`[Twelve Data WebSocket] Error fetching latest candle: ${error.message}`);
      throw error;
    }
  }

  /**
   * Register a callback to be called on each new tick
   * Useful for future features like Telegram alerts
   * @param {Function} callback - Function that receives (quote) as argument
   */
  onTick(callback) {
    if (typeof callback === 'function') {
      this.tickCallbacks.push(callback);
      logger.debug('Registered new tick callback');
    }
  }

  /**
   * Remove a tick callback
   * @param {Function} callback - The callback function to remove
   */
  offTick(callback) {
    const index = this.tickCallbacks.indexOf(callback);
    if (index > -1) {
      this.tickCallbacks.splice(index, 1);
      logger.debug('Removed tick callback');
    }
  }

  /**
   * Notify all registered tick callbacks
   * @private
   */
  notifyTickCallbacks(quote) {
    this.tickCallbacks.forEach(callback => {
      try {
        callback(quote);
      } catch (error) {
        logger.error('Error in tick callback:', error.message);
      }
    });
  }

  /**
   * Get connection status
   * @returns {Object} Status object with isConnected, isConnecting, reconnectAttempts
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      seriesLength: this.series.length,
      lastQuoteTime: this.lastQuote ? this.lastQuote.time : null
    };
  }

  /**
   * Get the last quote received
   * @returns {Object|null} Last quote object or null if no data received yet
   */
  getLastQuote() {
    return this.lastQuote;
  }
}

// Export singleton instance
module.exports = new TwelveDataStream();

