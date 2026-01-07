/**
 * Client-side technical indicator calculations
 * Used to generate indicator history from price history
 */

/**
 * Calculate RSI for a series of prices
 * @param {Array} prices - Array of {ts, price} objects
 * @param {number} period - RSI period (default: 14)
 * @returns {Array} Array of {ts, rsi} objects
 */
export function calculateRSISeries(prices, period = 14) {
  if (prices.length < period + 1) return [];

  const result = [];
  
  // Calculate price changes
  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i].price - prices[i - 1].price);
  }

  // Calculate initial average gain/loss
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

  // Calculate RSI for each point
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    result.push({
      ts: prices[i + 1].ts,
      rsi: Math.round(rsi * 100) / 100,
    });
  }

  return result;
}

// Calculate EMA
function calculateEMA(values, period) {
  if (values.length < period) return [];

  const multiplier = 2 / (period + 1);
  const ema = [];

  // Seed with SMA for the first period
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  ema.push(sum / period);

  for (let i = period; i < values.length; i++) {
    ema.push((values[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]);
  }

  return ema;
}

// Calculate SMA (sliding window)
function calculateSMA(values, period) {
  if (values.length < period) return [];

  const sma = [];
  let sum = 0;

  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  sma.push(sum / period);

  for (let i = period; i < values.length; i++) {
    sum += values[i] - values[i - period];
    sma.push(sum / period);
  }

  return sma;
}

// Generic moving average helper
function calculateMA(values, period, type = 'EMA') {
  const mode = type ? type.toUpperCase() : 'EMA';
  if (mode === 'SMA') {
    return calculateSMA(values, period);
  }
  return calculateEMA(values, period);
}

/**
 * Calculate MACD for a series of prices
 * @param {Array} prices - Array of {ts, price} objects
 * @param {number} fast - Fast EMA period (default: 12)
 * @param {number} slow - Slow EMA period (default: 26)
 * @param {number} signal - Signal period (default: 9)
 * @param {Object} options
 * @param {string} [options.oscillatorMAType='EMA'] - MA type for the fast/slow lines (EMA/SMA)
 * @param {string} [options.signalMAType='EMA'] - MA type for the signal line (EMA/SMA)
 * @param {string} [options.source='price'] - Price field to use (price/close)
 * @returns {Array} Array of {ts, macd, signal, histogram} objects
 */
export function calculateMACDSeries(
  prices,
  fast = 12,
  slow = 26,
  signal = 9,
  options = {}
) {
  // Need at least slow + signal + 1 prices for valid MACD calculation
  if (prices.length < slow + signal + 1) return [];

  const {
    oscillatorMAType = 'EMA',
    signalMAType = 'EMA',
    source = 'price',
  } = options;

  const priceValues = prices.map((p) => {
    if (source === 'close' && typeof p.close === 'number') return p.close;
    return p.price;
  });

  // Calculate both EMAs on the entire price series
  const fastEMAValues = [];
  const slowEMAValues = [];
  
  // Calculate fast EMA
  const fastMultiplier = 2 / (fast + 1);
  let fastSum = 0;
  for (let i = 0; i < fast; i++) {
    fastSum += priceValues[i];
  }
  let fastEMA = fastSum / fast;
  fastEMAValues.push(fastEMA);
  
  for (let i = fast; i < priceValues.length; i++) {
    fastEMA = (priceValues[i] - fastEMA) * fastMultiplier + fastEMA;
    fastEMAValues.push(fastEMA);
  }

  // Calculate slow EMA
  const slowMultiplier = 2 / (slow + 1);
  let slowSum = 0;
  for (let i = 0; i < slow; i++) {
    slowSum += priceValues[i];
  }
  let slowEMA = slowSum / slow;
  slowEMAValues.push(slowEMA);
  
  for (let i = slow; i < priceValues.length; i++) {
    slowEMA = (priceValues[i] - slowEMA) * slowMultiplier + slowEMA;
    slowEMAValues.push(slowEMA);
  }

  // MACD line starts from the slow EMA start point (index slow-1)
  const macdLine = [];
  for (let i = slow - 1; i < priceValues.length; i++) {
    const fastIdx = i - (slow - fast);
    const slowIdx = i - (slow - 1);
    const macdVal = fastEMAValues[fastIdx] - slowEMAValues[slowIdx];
    macdLine.push(macdVal);
  }

  // Calculate signal line as EMA of MACD line
  if (macdLine.length < signal) return [];
  
  const signalEMAValues = [];
  const signalMultiplier = 2 / (signal + 1);
  let signalSum = 0;
  for (let i = 0; i < signal; i++) {
    signalSum += macdLine[i];
  }
  let signalEMA = signalSum / signal;
  signalEMAValues.push(signalEMA);
  
  for (let i = signal; i < macdLine.length; i++) {
    signalEMA = (macdLine[i] - signalEMA) * signalMultiplier + signalEMA;
    signalEMAValues.push(signalEMA);
  }

  // Build result starting from where signal line is available
  const result = [];
  const priceStartIdx = slow - 1 + signal - 1;
  
  for (let i = 0; i < signalEMAValues.length; i++) {
    const macd = macdLine[i + signal - 1];
    const sig = signalEMAValues[i];
    
    result.push({
      ts: prices[priceStartIdx + i].ts,
      macd: Math.round(macd * 100) / 100,
      signal: Math.round(sig * 100) / 100,
      histogram: Math.round((macd - sig) * 100) / 100,
    });
  }

  return result;
}

/**
 * Calculate Stochastic for a series of prices
 * @param {Array} prices - Array of {ts, price} objects
 * @param {number} kPeriod - %K period (default: 14)
 * @param {number} dPeriod - %D period (default: 3)
 * @param {number} smoothing - Smoothing (default: 3)
 * @returns {Array} Array of {ts, k, d} objects
 */
export function calculateStochasticSeries(prices, kPeriod = 14, dPeriod = 3, smoothing = 3) {
  if (prices.length < kPeriod + smoothing + dPeriod - 2) return [];

  const priceValues = prices.map(p => p.price);
  
  // Calculate raw %K
  const kValues = [];
  for (let i = kPeriod - 1; i < priceValues.length; i++) {
    const window = priceValues.slice(i - kPeriod + 1, i + 1);
    const highest = Math.max(...window);
    const lowest = Math.min(...window);
    const close = priceValues[i];

    if (highest === lowest) {
      kValues.push(50);
    } else {
      kValues.push(((close - lowest) / (highest - lowest)) * 100);
    }
  }

  // Apply smoothing to %K
  const smoothedK = [];
  for (let i = smoothing - 1; i < kValues.length; i++) {
    const sum = kValues.slice(i - smoothing + 1, i + 1).reduce((a, b) => a + b, 0);
    smoothedK.push(sum / smoothing);
  }

  if (smoothedK.length < dPeriod) return [];

  // Calculate %D (SMA of smoothed %K)
  const result = [];
  const priceOffset = prices.length - smoothedK.length + dPeriod - 1;

  for (let i = dPeriod - 1; i < smoothedK.length; i++) {
    const dSum = smoothedK.slice(i - dPeriod + 1, i + 1).reduce((a, b) => a + b, 0);
    const d = dSum / dPeriod;
    const k = smoothedK[i];

    result.push({
      ts: prices[priceOffset + i - dPeriod + 1].ts,
      k: Math.round(k * 100) / 100,
      d: Math.round(d * 100) / 100,
    });
  }

  return result;
}
/**
 * Calculate Bollinger Bands for a series of prices
 * @param {Array} prices - Array of {ts, price} objects
 * @param {number} period - BB period (default: 20)
 * @param {number} stdDev - Standard deviation multiplier (default: 2)
 * @returns {Array} Array of {ts, upper, middle, lower} objects
 */
export function calculateBollingerBandsSeries(prices, period = 20, stdDev = 2) {
  if (prices.length < period) return [];

  const result = [];

  for (let i = period - 1; i < prices.length; i++) {
    const window = prices.slice(i - period + 1, i + 1);
    const values = window.map(p => p.price);

    // Calculate moving average (middle band)
    const sum = values.reduce((a, b) => a + b, 0);
    const middle = sum / period;

    // Calculate standard deviation
    const squaredDiffs = values.map(v => Math.pow(v - middle, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(variance);

    // Calculate upper and lower bands
    const upper = middle + (std * stdDev);
    const lower = middle - (std * stdDev);

    result.push({
      ts: prices[i].ts,
      upper: Math.round(upper * 100) / 100,
      middle: Math.round(middle * 100) / 100,
      lower: Math.round(lower * 100) / 100,
    });
  }

  return result;
}