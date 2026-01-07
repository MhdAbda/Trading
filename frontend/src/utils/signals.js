/**
 * Signal detection utilities for trading indicators
 * 
 * Implements crossover detection and confirmation signals based on:
 * - Stochastic Oscillator (%K and %D crossovers)
 * - RSI confirmation
 */

import dayjs from 'dayjs';

// Zone thresholds
const STOCH_OVERSOLD = 20;
const STOCH_OVERBOUGHT = 80;
const RSI_OVERSOLD = 30;
const RSI_OVERBOUGHT = 70;

/**
 * Detect if a bullish crossover occurred (K crosses up through D)
 * @param {number} prevK - Previous %K value
 * @param {number} prevD - Previous %D value
 * @param {number} curK - Current %K value
 * @param {number} curD - Current %D value
 * @returns {boolean}
 */
export function isBullishCrossover(prevK, prevD, curK, curD) {
  return prevK <= prevD && curK > curD;
}

/**
 * Detect if a bearish crossover occurred (K crosses down through D)
 * @param {number} prevK - Previous %K value
 * @param {number} prevD - Previous %D value
 * @param {number} curK - Current %K value
 * @param {number} curD - Current %D value
 * @returns {boolean}
 */
export function isBearishCrossover(prevK, prevD, curK, curD) {
  return prevK >= prevD && curK < curD;
}

/**
 * Check if stochastic is in oversold zone (strict: both K and D < 20)
 * @param {number} k - %K value
 * @param {number} d - %D value
 * @returns {boolean}
 */
export function isOversoldStrict(k, d) {
  return k < STOCH_OVERSOLD && d < STOCH_OVERSOLD;
}

/**
 * Check if stochastic is in overbought zone (strict: both K and D > 80)
 * @param {number} k - %K value
 * @param {number} d - %D value
 * @returns {boolean}
 */
export function isOverboughtStrict(k, d) {
  return k > STOCH_OVERBOUGHT && d > STOCH_OVERBOUGHT;
}

/**
 * Detect stochastic BUY signal (bullish crossover in oversold zone)
 * @param {Object} prev - Previous data point {k, d}
 * @param {Object} cur - Current data point {k, d}
 * @returns {boolean}
 */
export function detectStochasticBuy(prev, cur) {
  if (!prev || !cur) return false;
  const bullishCross = isBullishCrossover(prev.k, prev.d, cur.k, cur.d);
  const oversold = isOversoldStrict(cur.k, cur.d);
  return bullishCross && oversold;
}

/**
 * Detect stochastic SELL signal (bearish crossover in overbought zone)
 * @param {Object} prev - Previous data point {k, d}
 * @param {Object} cur - Current data point {k, d}
 * @returns {boolean}
 */
export function detectStochasticSell(prev, cur) {
  if (!prev || !cur) return false;
  const bearishCross = isBearishCrossover(prev.k, prev.d, cur.k, cur.d);
  const overbought = isOverboughtStrict(cur.k, cur.d);
  return bearishCross && overbought;
}

/**
 * Detect RSI + Stochastic confirmation for BUY (oversold confirmation)
 * Uses strict zone: both K and D < 20, AND RSI < 30
 * @param {number} k - Current %K
 * @param {number} d - Current %D
 * @param {number} rsi - Current RSI
 * @returns {boolean}
 */
export function detectConfirmBuy(k, d, rsi) {
  if (k === undefined || d === undefined || rsi === undefined) return false;
  const stochOversold = k < STOCH_OVERSOLD || d < STOCH_OVERSOLD;
  const rsiOversold = rsi < RSI_OVERSOLD;
  return stochOversold && rsiOversold;
}

/**
 * Detect RSI + Stochastic confirmation for SELL (overbought confirmation)
 * Uses strict zone: both K and D > 80, AND RSI > 70
 * @param {number} k - Current %K
 * @param {number} d - Current %D
 * @param {number} rsi - Current RSI
 * @returns {boolean}
 */
export function detectConfirmSell(k, d, rsi) {
  if (k === undefined || d === undefined || rsi === undefined) return false;
  const stochOverbought = k > STOCH_OVERBOUGHT || d > STOCH_OVERBOUGHT;
  const rsiOverbought = rsi > RSI_OVERBOUGHT;
  return stochOverbought && rsiOverbought;
}

/**
 * Analyze the latest two data points to determine current signal status
 * @param {Array} stochasticData - Array of {ts, k, d} objects
 * @param {Array} rsiData - Array of {ts, rsi} objects
 * @returns {Object} Signal status object
 */
export function analyzeLatestSignals(stochasticData, rsiData) {
  const result = {
    stochasticSignal: null, // 'BUY' | 'SELL' | null
    stochasticReason: 'No stochastic crossover signal',
    confirmationSignal: null, // 'BUY' | 'SELL' | null
    confirmationReason: 'No strong confirmation',
    currentK: null,
    currentD: null,
    currentRSI: null,
  };

  // Need at least 2 stochastic points to detect crossover
  if (!stochasticData || stochasticData.length < 2) {
    return result;
  }

  const prev = stochasticData[stochasticData.length - 2];
  const cur = stochasticData[stochasticData.length - 1];

  result.currentK = cur.k;
  result.currentD = cur.d;

  // Detect stochastic crossover signals
  if (detectStochasticBuy(prev, cur)) {
    result.stochasticSignal = 'BUY';
    result.stochasticReason = 'Stochastic: Bullish crossover in oversold → BUY';
  } else if (detectStochasticSell(prev, cur)) {
    result.stochasticSignal = 'SELL';
    result.stochasticReason = 'Stochastic: Bearish crossover in overbought → SELL';
  }

  // Get latest RSI for confirmation
  if (rsiData && rsiData.length > 0) {
    const latestRsi = rsiData[rsiData.length - 1];
    result.currentRSI = latestRsi.rsi;

    // Detect confirmation signals
    if (detectConfirmBuy(cur.k, cur.d, latestRsi.rsi)) {
      result.confirmationSignal = 'BUY';
      result.confirmationReason = 'RSI + Stochastic confirm OVERSOLD → Potential bullish reversal';
    } else if (detectConfirmSell(cur.k, cur.d, latestRsi.rsi)) {
      result.confirmationSignal = 'SELL';
      result.confirmationReason = 'RSI + Stochastic confirm OVERBOUGHT → Potential bearish correction';
    }
  }

  return result;
}

/**
 * Build signal history by scanning through data points
 * @param {Array} stochasticData - Array of {ts, k, d} objects
 * @param {Array} rsiData - Array of {ts, rsi} objects
 * @param {number} maxSignals - Maximum number of signals to return (default: 10)
 * @returns {Array} Array of signal objects {type, time, reason, ts}
 */
export function buildSignalHistory(stochasticData, rsiData, maxSignals = 10) {
  const signals = [];

  if (!stochasticData || stochasticData.length < 2) {
    return signals;
  }

  // Create a map of RSI values by timestamp for quick lookup
  const rsiMap = new Map();
  if (rsiData) {
    rsiData.forEach((point) => {
      rsiMap.set(point.ts, point.rsi);
    });
  }

  // Find closest RSI value for a given timestamp
  const findClosestRSI = (ts) => {
    if (rsiMap.has(ts)) return rsiMap.get(ts);
    
    // Find closest RSI within 2 minutes
    let closest = null;
    let minDiff = Infinity;
    for (const [rsiTs, rsi] of rsiMap) {
      const diff = Math.abs(rsiTs - ts);
      if (diff < minDiff && diff < 120000) { // 2 minutes tolerance
        minDiff = diff;
        closest = rsi;
      }
    }
    return closest;
  };

  // Scan through stochastic data starting at index 1
  for (let i = 1; i < stochasticData.length; i++) {
    const prev = stochasticData[i - 1];
    const cur = stochasticData[i];

    // Check for stochastic BUY signal
    if (detectStochasticBuy(prev, cur)) {
      signals.push({
        type: 'BUY',
        ts: cur.ts,
        time: formatSignalTime(cur.ts),
        reason: `%K↑%D under ${STOCH_OVERSOLD}`,
      });
    }

    // Check for stochastic SELL signal
    if (detectStochasticSell(prev, cur)) {
      signals.push({
        type: 'SELL',
        ts: cur.ts,
        time: formatSignalTime(cur.ts),
        reason: `%K↓%D over ${STOCH_OVERBOUGHT}`,
      });
    }

    // Check for confirmation signals (without crossover requirement)
    const rsi = findClosestRSI(cur.ts);
    if (rsi !== null) {
      // Only add confirmation if there wasn't already a crossover signal at this point
      const lastSignal = signals[signals.length - 1];
      const alreadyHasSignalAtTime = lastSignal && lastSignal.ts === cur.ts;

      if (!alreadyHasSignalAtTime) {
        if (detectConfirmBuy(cur.k, cur.d, rsi)) {
          signals.push({
            type: 'BUY',
            ts: cur.ts,
            time: formatSignalTime(cur.ts),
            reason: `Confirm: RSI<${RSI_OVERSOLD} + Stoch<${STOCH_OVERSOLD}`,
          });
        } else if (detectConfirmSell(cur.k, cur.d, rsi)) {
          signals.push({
            type: 'SELL',
            ts: cur.ts,
            time: formatSignalTime(cur.ts),
            reason: `Confirm: RSI>${RSI_OVERBOUGHT} + Stoch>${STOCH_OVERBOUGHT}`,
          });
        }
      }
    }
  }

  // Return last N signals, most recent first
  return signals.reverse();
}

/**
 * Format timestamp for display
 * @param {number} ts - Timestamp in milliseconds
 * @returns {string} Formatted time string
 */
export function formatSignalTime(ts) {
  const d = dayjs(ts);
  const now = dayjs();
  
  // If same day, show only time
  if (d.isSame(now, 'day')) {
    return d.format('HH:mm');
  }
  // Otherwise show date and time
  return d.format('MM/DD HH:mm');
}

/**
 * Get the timestamp of the last signal
 * @param {Array} signalHistory - Array of signal objects
 * @returns {string|null} Formatted time of last signal or null
 */
export function getLastSignalTime(signalHistory) {
  if (!signalHistory || signalHistory.length === 0) {
    return null;
  }
  return signalHistory[0].time; // First item is most recent (reversed)
}
