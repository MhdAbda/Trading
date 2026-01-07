/**
 * Technical Indicators Service
 * 
 * Calculates and maintains technical indicators (RSI, MACD, Stochastic)
 * Updates in real-time as price data arrives from the price stream.
 */

const logger = require('../utils/logger');
const { MACD, BollingerBands } = require('technicalindicators');
// Lazy import to avoid circular dependency - import when needed

class IndicatorsService {
  constructor() {
    // Store indicator values by parameter combination
    // Structure: { 'rsi_14': [{time, rsi}], 'macd_12_26_9': [{time, macd, signal, histogram}], ... }
    this.indicatorBuffers = {};
    this.maxHistoryPoints = 2000; // Similar to price series max points
    
    // Callbacks for indicator updates
    this.updateCallbacks = [];
  }

  /**
   * Calculate Simple Moving Average (SMA)
   * @param {Array<number>} values - Array of numeric values
   * @param {number} period - Period for SMA
   * @returns {number|null} SMA value or null if insufficient data
   */
  calculateSMA(values, period) {
    if (values.length < period) {
      return null;
    }
    const slice = values.slice(-period);
    return slice.reduce((sum, val) => sum + val, 0) / period;
  }

  /**
   * Calculate Exponential Moving Average (EMA)
   * @param {Array<number>} values - Array of numeric values
   * @param {number} period - Period for EMA
   * @returns {Array<number>} Array of EMA values
   */
  calculateEMA(values, period) {
    if (values.length < period) {
      return [];
    }
    
    const multiplier = 2 / (period + 1);
    const ema = [];
    
    // Start with SMA for first EMA value
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += values[i];
    }
    ema.push(sum / period);
    
    // Calculate subsequent EMA values
    for (let i = period; i < values.length; i++) {
      const currentEMA = (values[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
      ema.push(currentEMA);
    }
    
    return ema;
  }

  /**
   * Calculate Relative Strength Index (RSI)
   * @param {Array<number>} prices - Array of price values
   * @param {number} period - RSI period (default: 14)
   * @returns {number|null} RSI value (0-100) or null if insufficient data
   */
  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) {
      return null;
    }

    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    // Calculate initial average gain and loss
    let avgGain = 0;
    let avgLoss = 0;
    
    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) {
        avgGain += changes[i];
      } else {
        avgLoss += Math.abs(changes[i]);
      }
    }
    
    avgGain /= period;
    avgLoss /= period;

    // Use Wilder's smoothing method for subsequent values
    for (let i = period; i < changes.length; i++) {
      const change = changes[i];
      if (change > 0) {
        avgGain = (avgGain * (period - 1) + change) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
      }
    }

    if (avgLoss === 0) {
      return 100; // All gains, no losses
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return Math.round(rsi * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence) - OLD CUSTOM IMPLEMENTATION
   * @param {Array<number>} prices - Array of price values
   * @param {number} fast - Fast EMA period (default: 12)
   * @param {number} slow - Slow EMA period (default: 26)
   * @param {number} signal - Signal line EMA period (default: 9)
   * @returns {Object|null} {macd, signal, histogram} or null if insufficient data
   */
  calculateMACDOld(prices, fast = 12, slow = 26, signal = 9) {
    if (prices.length < slow + signal) {
      return null;
    }

    const fastEMA = this.calculateEMA(prices, fast);
    const slowEMA = this.calculateEMA(prices, slow);

    if (fastEMA.length === 0 || slowEMA.length === 0) {
      return null;
    }

    // Align EMAs (slow EMA will be shorter)
    const offset = slowEMA.length - fastEMA.length;
    const macdLine = [];
    
    for (let i = 0; i < fastEMA.length; i++) {
      macdLine.push(fastEMA[i] - slowEMA[i + offset]);
    }

    if (macdLine.length < signal) {
      return null;
    }

    // Calculate signal line (EMA of MACD line)
    const signalEMA = this.calculateEMA(macdLine, signal);
    
    if (signalEMA.length === 0) {
      return null;
    }

    const signalOffset = macdLine.length - signalEMA.length;
    const macd = macdLine[macdLine.length - 1];
    const signalValue = signalEMA[signalEMA.length - 1];
    const histogram = macd - signalValue;

    return {
      macd: Math.round(macd * 100) / 100,
      signal: Math.round(signalValue * 100) / 100,
      histogram: Math.round(histogram * 100) / 100
    };
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence) using technicalindicators library
   * @param {Array<number>} prices - Array of price values
   * @param {number} fast - Fast EMA period (default: 12)
   * @param {number} slow - Slow EMA period (default: 26)
   * @param {number} signal - Signal line EMA period (default: 9)
   * @returns {Object|null} {macd, signal, histogram} or null if insufficient data
   */
  calculateMACD(prices, fast = 12, slow = 26, signal = 9) {
    if (prices.length < slow + signal) {
      return null;
    }

    try {
      const macdResult = MACD.calculate({
        values: prices,
        fastPeriod: fast,
        slowPeriod: slow,
        signalPeriod: signal,
        SimpleMAOscillator: false,
        SimpleMASignal: false
      });

      if (!macdResult || macdResult.length === 0) {
        return null;
      }

      // Get the latest MACD values
      const latest = macdResult[macdResult.length - 1];

      return {
        macd: Math.round(latest.MACD * 100) / 100,
        signal: Math.round(latest.signal * 100) / 100,
        histogram: Math.round(latest.histogram * 100) / 100
      };
    } catch (error) {
      // Fallback to old implementation if library fails
      return this.calculateMACDOld(prices, fast, slow, signal);
    }
  }

  /**
   * Calculate Stochastic Oscillator
   * @param {Array<number>} prices - Array of price values (used as close)
   * @param {number} kPeriod - %K period (default: 14)
   * @param {number} dPeriod - %D period (default: 3)
   * @param {number} smoothing - Smoothing factor (default: 3)
   * @returns {Object|null} {k, d} or null if insufficient data
   */
  calculateStochastic(prices, kPeriod = 14, dPeriod = 3, smoothing = 3) {
    if (prices.length < kPeriod) {
      return null;
    }

    // For simplicity, use price as close and derive high/low from price window
    // In real trading, you'd have separate high/low/close values
    const kValues = [];
    
    for (let i = kPeriod - 1; i < prices.length; i++) {
      const window = prices.slice(i - kPeriod + 1, i + 1);
      const highest = Math.max(...window);
      const lowest = Math.min(...window);
      const close = prices[i];

      if (highest === lowest) {
        kValues.push(50); // Neutral if no range
      } else {
        const k = ((close - lowest) / (highest - lowest)) * 100;
        kValues.push(k);
      }
    }

    if (kValues.length < smoothing) {
      return null;
    }

    // Apply smoothing to %K
    const smoothedK = [];
    for (let i = smoothing - 1; i < kValues.length; i++) {
      const sum = kValues.slice(i - smoothing + 1, i + 1).reduce((a, b) => a + b, 0);
      smoothedK.push(sum / smoothing);
    }

    if (smoothedK.length < dPeriod) {
      return null;
    }

    // Calculate %D (SMA of smoothed %K)
    const d = this.calculateSMA(smoothedK, dPeriod);

    if (d === null) {
      return null;
    }

    const k = smoothedK[smoothedK.length - 1];

    return {
      k: Math.round(k * 100) / 100,
      d: Math.round(d * 100) / 100
    };
  }

  /**
   * Calculate Bollinger Bands using technicalindicators library
   * @param {Array<number>} prices - Array of price values
   * @param {number} period - SMA period (default: 20)
   * @param {number} stdDev - Standard deviation multiplier (default: 2)
   * @returns {Object|null} {upper, middle, lower} or null if insufficient data
   */
  calculateBollingerBands(prices, period = 20, stdDev = 2) {
    if (prices.length < period) {
      return null;
    }

    try {
      const bbResult = BollingerBands.calculate({
        values: prices,
        period: period,
        stdDev: stdDev
      });

      if (!bbResult || bbResult.length === 0) {
        return null;
      }

      // Get the latest Bollinger Bands values
      const latest = bbResult[bbResult.length - 1];

      return {
        upper: Math.round(latest.upper * 100) / 100,
        middle: Math.round(latest.middle * 100) / 100,
        lower: Math.round(latest.lower * 100) / 100
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Update indicators when new price data arrives
   * @param {Object} priceData - {time, price} object
   * @param {Array} series - Optional price series array. If not provided, fetches from stream.
   */
  updateIndicators(priceData, series = null) {
    // Get series if not provided (lazy import to avoid circular dependency)
    if (!series) {
      const twelveDataStream = require('./twelveDataStream');
      series = twelveDataStream.getSeries();
    }
    
    if (series.length === 0) {
      return;
    }

    const prices = series.map(point => point.price);
    const currentTime = priceData.time || new Date().toISOString();

    // Calculate RSI with default period
    const rsi = this.calculateRSI(prices, 14);
    if (rsi !== null) {
      this.addIndicatorValue('rsi', { time: currentTime, rsi }, { period: 14 });
    }

    // Calculate MACD with default parameters
    const macd = this.calculateMACD(prices, 12, 26, 9);
    if (macd !== null) {
      this.addIndicatorValue('macd', { time: currentTime, ...macd }, { fast: 12, slow: 26, signal: 9 });
    }

    // Calculate Stochastic with default parameters
    const stochastic = this.calculateStochastic(prices, 14, 3, 3);
    if (stochastic !== null) {
      this.addIndicatorValue('stochastic', { time: currentTime, ...stochastic }, { kPeriod: 14, dPeriod: 3, smoothing: 3 });
    }

    // Calculate Bollinger Bands with default parameters
    const bollingerBands = this.calculateBollingerBands(prices, 20, 2);
    if (bollingerBands !== null) {
      this.addIndicatorValue('bollingerBands', { time: currentTime, ...bollingerBands }, { period: 20, stdDev: 2 });
    }

    // Notify callbacks
    this.notifyCallbacks();
  }

  /**
   * Add indicator value to buffer
   * @param {string} indicator - Indicator name ('rsi', 'macd', 'stochastic')
   * @param {Object} value - Indicator value object
   * @param {Object} params - Parameters used for calculation
   */
  addIndicatorValue(indicator, value, params) {
    const key = this.getIndicatorKey(indicator, params);
    
    if (!this.indicatorBuffers[key]) {
      this.indicatorBuffers[key] = [];
    }

    this.indicatorBuffers[key].push(value);

    // Maintain max history points
    if (this.indicatorBuffers[key].length > this.maxHistoryPoints) {
      this.indicatorBuffers[key].shift();
    }
  }

  /**
   * Generate key for indicator buffer based on indicator name and parameters
   * @param {string} indicator - Indicator name
   * @param {Object} params - Parameters object
   * @returns {string} Key string
   */
  getIndicatorKey(indicator, params) {
    if (indicator === 'rsi') {
      return `rsi_${params.period || 14}`;
    } else if (indicator === 'macd') {
      return `macd_${params.fast || 12}_${params.slow || 26}_${params.signal || 9}`;
    } else if (indicator === 'stochastic') {
      return `stochastic_${params.kPeriod || 14}_${params.dPeriod || 3}_${params.smoothing || 3}`;
    } else if (indicator === 'bollingerBands') {
      return `bollinger_${params.period || 20}_${params.stdDev || 2}`;
    }
    return `${indicator}_default`;
  }

  /**
   * Get current RSI value
   * @param {number} period - RSI period (default: 14)
   * @returns {Object|null} {time, rsi} or null
   */
  getRSI(period = 14) {
    const key = `rsi_${period}`;
    const buffer = this.indicatorBuffers[key];
    
    if (!buffer || buffer.length === 0) {
      // Try to calculate on the fly
      const twelveDataStream = require('./twelveDataStream');
      const series = twelveDataStream.getSeries();
      if (series.length >= period + 1) {
        const prices = series.map(p => p.price);
        const rsi = this.calculateRSI(prices, period);
        if (rsi !== null) {
          const lastPrice = series[series.length - 1];
          return { time: lastPrice.time, rsi };
        }
      }
      return null;
    }

    return buffer[buffer.length - 1];
  }

  /**
   * Get current MACD values
   * @param {number} fast - Fast EMA period (default: 12)
   * @param {number} slow - Slow EMA period (default: 26)
   * @param {number} signal - Signal line period (default: 9)
   * @returns {Object|null} {time, macd, signal, histogram} or null
   */
  getMACD(fast = 12, slow = 26, signal = 9) {
    const key = `macd_${fast}_${slow}_${signal}`;
    const buffer = this.indicatorBuffers[key];
    
    if (!buffer || buffer.length === 0) {
      // Try to calculate on the fly
      const twelveDataStream = require('./twelveDataStream');
      const series = twelveDataStream.getSeries();
      if (series.length >= slow + signal) {
        const prices = series.map(p => p.price);
        const macd = this.calculateMACD(prices, fast, slow, signal);
        if (macd !== null) {
          const lastPrice = series[series.length - 1];
          return { time: lastPrice.time, ...macd };
        }
      }
      return null;
    }

    return buffer[buffer.length - 1];
  }

  /**
   * Get current Stochastic values
   * @param {number} kPeriod - %K period (default: 14)
   * @param {number} dPeriod - %D period (default: 3)
   * @param {number} smoothing - Smoothing factor (default: 3)
   * @returns {Object|null} {time, k, d} or null
   */
  getStochastic(kPeriod = 14, dPeriod = 3, smoothing = 3) {
    const key = `stochastic_${kPeriod}_${dPeriod}_${smoothing}`;
    const buffer = this.indicatorBuffers[key];
    
    if (!buffer || buffer.length === 0) {
      // Try to calculate on the fly
      const twelveDataStream = require('./twelveDataStream');
      const series = twelveDataStream.getSeries();
      if (series.length >= kPeriod) {
        const prices = series.map(p => p.price);
        const stochastic = this.calculateStochastic(prices, kPeriod, dPeriod, smoothing);
        if (stochastic !== null) {
          const lastPrice = series[series.length - 1];
          return { time: lastPrice.time, ...stochastic };
        }
      }
      return null; 
    }

    return buffer[buffer.length - 1];
  }

  /**
   * Get current Bollinger Bands values
   * @param {number} period - Period (default: 20)
   * @param {number} stdDev - Standard Deviation (default: 2)
   * @returns {Object|null} {time, upper, middle, lower} or null
   */
  getBollingerBands(period = 20, stdDev = 2) {
    const key = `bollinger_${period}_${stdDev}`;
    const buffer = this.indicatorBuffers[key];
    
    if (!buffer || buffer.length === 0) {
      // Try to calculate on the fly
      const twelveDataStream = require('./twelveDataStream');
      const series = twelveDataStream.getSeries();
      if (series.length >= period) {
        const prices = series.map(p => p.price);
        const bollingerBands = this.calculateBollingerBands(prices, period, stdDev);
        if (bollingerBands !== null) {
          const lastPrice = series[series.length - 1];
          return { time: lastPrice.time, ...bollingerBands };
        }
      }
      return null;
    }

    return buffer[buffer.length - 1];
  }

  /**
   * Get indicator history
   * @param {string} indicator - Indicator name
   * @param {Object} params - Parameters object
   * @returns {Array} Array of indicator values
   */
  getIndicatorHistory(indicator, params) {
    const key = this.getIndicatorKey(indicator, params);
    const buffer = this.indicatorBuffers[key];
    return buffer ? [...buffer] : [];
  }

  /**
   * Register callback for indicator updates
   * @param {Function} callback - Function to call when indicators update
   */
  onIndicatorUpdate(callback) {
    if (typeof callback === 'function') {
      this.updateCallbacks.push(callback);
    }
  }

  /**
   * Remove indicator update callback
   * @param {Function} callback - Callback function to remove
   */
  offIndicatorUpdate(callback) {
    const index = this.updateCallbacks.indexOf(callback);
    if (index > -1) {
      this.updateCallbacks.splice(index, 1);
    }
  }

  /**
   * Notify all registered callbacks
   * @private
   */
  notifyCallbacks() {
    const indicators = {
      rsi: this.getRSI(14),
      macd: this.getMACD(12, 26, 9),
      stochastic: this.getStochastic(14, 3, 3),
      bollingerBands: this.getBollingerBands(20, 2)
    };

    this.updateCallbacks.forEach(callback => {
      try {
        callback(indicators);
      } catch (error) {
        // Silent error
      }
    });
  }

  /**
   * Calculate historical indicator series from price history
   * @param {Array} prices - Array of {price, time} objects
   * @param {number} rsiPeriod - RSI period
   * @param {number} macdFast - MACD fast period
   * @param {number} macdSlow - MACD slow period
   * @param {number} macdSignal - MACD signal period
   * @param {number} stochK - Stochastic K period
   * @param {number} stochD - Stochastic D period
   * @param {number} stochSmoothing - Stochastic smoothing
   * @param {number} bbPeriod - Bollinger Bands period
   * @param {number} bbStdDev - Bollinger Bands std dev
   * @returns {Object} {rsi: [], macd: [], stochastic: [], bollingerBands: []}
   */
  calculateHistoricalIndicators(
    prices,
    rsiPeriod = 14,
    macdFast = 12,
    macdSlow = 26,
    macdSignal = 9,
    stochK = 14,
    stochD = 3,
    stochSmoothing = 3,
    bbPeriod = 20,
    bbStdDev = 2
  ) {
    if (!prices || prices.length === 0) {
      return { rsi: [], macd: [], stochastic: [], bollingerBands: [] };
    }

    const priceValues = prices.map(p => p.price);
    const result = {
      rsi: [],
      macd: [],
      stochastic: [],
      bollingerBands: []
    };

    try {
      // Calculate RSI series
      if (priceValues.length >= rsiPeriod + 1) {
        const changes = [];
        for (let i = 1; i < priceValues.length; i++) {
          changes.push(priceValues[i] - priceValues[i - 1]);
        }

        let avgGain = 0, avgLoss = 0;
        for (let i = 0; i < rsiPeriod; i++) {
          if (changes[i] > 0) avgGain += changes[i];
          else avgLoss += Math.abs(changes[i]);
        }
        avgGain /= rsiPeriod;
        avgLoss /= rsiPeriod;

        for (let i = rsiPeriod; i < changes.length; i++) {
          const change = changes[i];
          if (change > 0) {
            avgGain = (avgGain * (rsiPeriod - 1) + change) / rsiPeriod;
            avgLoss = (avgLoss * (rsiPeriod - 1)) / rsiPeriod;
          } else {
            avgGain = (avgGain * (rsiPeriod - 1)) / rsiPeriod;
            avgLoss = (avgLoss * (rsiPeriod - 1) + Math.abs(change)) / rsiPeriod;
          }
          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
          const rsi = 100 - (100 / (1 + rs));
          const idx = i + 1;
          if (idx < prices.length) {
            result.rsi.push({
              ts: prices[idx].time || prices[idx].ts,
              rsi: Math.round(rsi * 100) / 100
            });
          }
        }
      }

      // Calculate MACD series
      if (priceValues.length >= macdSlow + macdSignal) {
        try {
          const macdResult = MACD.calculate({
            values: priceValues,
            fastPeriod: macdFast,
            slowPeriod: macdSlow,
            signalPeriod: macdSignal,
            SimpleMAOscillator: false,
            SimpleMASignal: false
          });

          if (macdResult && macdResult.length > 0) {
            const offset = priceValues.length - macdResult.length;
            macdResult.forEach((point, idx) => {
              const priceIdx = offset + idx;
              if (priceIdx >= 0 && priceIdx < prices.length) {
                result.macd.push({
                  ts: prices[priceIdx].time || prices[priceIdx].ts,
                  macd: Math.round(point.MACD * 100) / 100,
                  signal: Math.round(point.signal * 100) / 100,
                  histogram: Math.round(point.histogram * 100) / 100
                });
              }
            });
          }
        } catch (err) {
          // Silent error
        }
      }

      // Calculate Stochastic series
      if (priceValues.length >= stochK) {
        const kValues = [];
        for (let i = stochK - 1; i < priceValues.length; i++) {
          const window = priceValues.slice(i - stochK + 1, i + 1);
          const highest = Math.max(...window);
          const lowest = Math.min(...window);
          const k = highest === lowest ? 50 : ((priceValues[i] - lowest) / (highest - lowest)) * 100;
          kValues.push(k);
        }

        if (kValues.length >= stochSmoothing) {
          const smoothedK = [];
          for (let i = stochSmoothing - 1; i < kValues.length; i++) {
            const sum = kValues.slice(i - stochSmoothing + 1, i + 1).reduce((a, b) => a + b, 0);
            smoothedK.push(sum / stochSmoothing);
          }

          if (smoothedK.length >= stochD) {
            const stochStartIdx = stochK - 1 + stochSmoothing - 1;
            for (let i = stochD - 1; i < smoothedK.length; i++) {
              const dSum = smoothedK.slice(i - stochD + 1, i + 1).reduce((a, b) => a + b, 0);
              const priceIdx = stochStartIdx + i;
              if (priceIdx >= 0 && priceIdx < prices.length && prices[priceIdx]) {
                result.stochastic.push({
                  ts: prices[priceIdx].time || prices[priceIdx].ts,
                  k: Math.round(smoothedK[i] * 100) / 100,
                  d: Math.round((dSum / stochD) * 100) / 100
                });
              }
            }
          }
        }
      }

      // Calculate Bollinger Bands series
      if (priceValues.length >= bbPeriod) {
        try {
          const bbResult = BollingerBands.calculate({
            values: priceValues,
            period: bbPeriod,
            stdDev: bbStdDev
          });

          if (bbResult && bbResult.length > 0) {
            const offset = priceValues.length - bbResult.length;
            bbResult.forEach((point, idx) => {
              const priceIdx = offset + idx;
              if (priceIdx >= 0 && priceIdx < prices.length) {
                result.bollingerBands.push({
                  ts: prices[priceIdx].time || prices[priceIdx].ts,
                  upper: Math.round(point.upper * 100) / 100,
                  middle: Math.round(point.middle * 100) / 100,
                  lower: Math.round(point.lower * 100) / 100
                });
              }
            });
          }
        } catch (err) {
          // Silent error
        }
      }

      return result;
    } catch (error) {
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new IndicatorsService();

