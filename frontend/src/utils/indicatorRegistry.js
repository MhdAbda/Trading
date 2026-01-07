/**
 * Indicator Registry
 * 
 * Data-driven configuration for all available indicators.
 * Adding new indicators requires only updating this file.
 */

export const INDICATOR_REGISTRY = {
  // Price indicators
  PRICE: {
    key: 'PRICE',
    label: 'Gold Price',
    dataKey: 'price',
    unit: '$',
    description: 'Current gold price (XAU/USD)'
  },
  
  // RSI
  RSI: {
    key: 'RSI',
    label: 'RSI',
    dataKey: 'rsi',
    unit: '',
    min: 0,
    max: 100,
    description: 'Relative Strength Index'
  },
  
  // MACD components
  MACD: {
    key: 'MACD',
    label: 'MACD Line',
    dataKey: 'macd',
    unit: '',
    description: 'MACD line value'
  },
  MACD_SIGNAL: {
    key: 'MACD_SIGNAL',
    label: 'MACD Signal',
    dataKey: 'signal',
    unit: '',
    description: 'MACD signal line value'
  },
  MACD_HISTOGRAM: {
    key: 'MACD_HISTOGRAM',
    label: 'MACD Histogram',
    dataKey: 'histogram',
    unit: '',
    description: 'MACD histogram value'
  },
  
  // Stochastic components
  STOCH_K: {
    key: 'STOCH_K',
    label: 'Stochastic %K',
    dataKey: 'k',
    unit: '%',
    min: 0,
    max: 100,
    description: 'Stochastic %K line'
  },
  STOCH_D: {
    key: 'STOCH_D',
    label: 'Stochastic %D',
    dataKey: 'd',
    unit: '%',
    min: 0,
    max: 100,
    description: 'Stochastic %D line'
  },
  
  // Bollinger Bands components
  BB_UPPER: {
    key: 'BB_UPPER',
    label: 'Bollinger Upper Band',
    dataKey: 'upper',
    unit: '$',
    description: 'Bollinger Bands upper band (SMA + 2 * StdDev)'
  },
  BB_MIDDLE: {
    key: 'BB_MIDDLE',
    label: 'Bollinger Middle Band',
    dataKey: 'middle',
    unit: '$',
    description: 'Bollinger Bands middle band (20-period SMA)'
  },
  BB_LOWER: {
    key: 'BB_LOWER',
    label: 'Bollinger Lower Band',
    dataKey: 'lower',
    unit: '$',
    description: 'Bollinger Bands lower band (SMA - 2 * StdDev)'
  }
};

// Align all series to 1-minute buckets to ensure timestamps match across sources
const BUCKET_MS = 60 * 1000;
const bucketTs = (ts) => Math.floor(ts / BUCKET_MS) * BUCKET_MS;

/**
 * Get indicator value from data point
 * @param {Object} dataPoint - Data point with indicator values
 * @param {string} indicatorKey - Indicator key from registry
 * @returns {number|null} Indicator value or null if not available
 */
export function getIndicatorValue(dataPoint, indicatorKey) {
  if (!dataPoint) return null;
  
  const indicator = INDICATOR_REGISTRY[indicatorKey];
  if (!indicator) return null;
  
  const value = dataPoint[indicator.dataKey];
  return typeof value === 'number' ? value : null;
}

/**
 * Get list of all available indicators
 * @returns {Array} Array of indicator objects
 */
export function getAvailableIndicators() {
  return Object.values(INDICATOR_REGISTRY);
}

/**
 * Get indicator by key
 * @param {string} key - Indicator key
 * @returns {Object|null} Indicator object or null
 */
export function getIndicator(key) {
  return INDICATOR_REGISTRY[key] || null;
}

/**
 * Map indicator data from different sources
 * Combines price, RSI, MACD, Stochastic, and Bollinger Bands data into unified format
 * @param {Object} sources - Object containing different data sources
 * @returns {Array} Array of unified data points
 */
export function mapIndicatorData({ priceData, rsiData, macdData, stochasticData, bollingerBandsData }) {
  const dataMap = new Map();
  
  // Add price data
  if (priceData) {
    priceData.forEach(point => {
      const ts = bucketTs(point.ts);
      if (!dataMap.has(ts)) {
        dataMap.set(ts, { ts, price: point.price });
      } else {
        dataMap.get(ts).price = point.price;
      }
    });
  }
  
  // Add RSI data
  if (rsiData) {
    rsiData.forEach(point => {
      const ts = bucketTs(point.ts);
      if (!dataMap.has(ts)) {
        dataMap.set(ts, { ts, rsi: point.rsi });
      } else {
        dataMap.get(ts).rsi = point.rsi;
      }
    });
  }
  
  // Add MACD data
  if (macdData) {
    macdData.forEach(point => {
      const ts = bucketTs(point.ts);
      if (!dataMap.has(ts)) {
        dataMap.set(ts, { ts, macd: point.macd, signal: point.signal, histogram: point.histogram });
      } else {
        const existing = dataMap.get(ts);
        existing.macd = point.macd;
        existing.signal = point.signal;
        existing.histogram = point.histogram;
      }
    });
  }
  
  // Add Stochastic data
  if (stochasticData) {
    stochasticData.forEach(point => {
      const ts = bucketTs(point.ts);
      if (!dataMap.has(ts)) {
        dataMap.set(ts, { ts, k: point.k, d: point.d });
      } else {
        const existing = dataMap.get(ts);
        existing.k = point.k;
        existing.d = point.d;
      }
    });
  }
  
  // Add Bollinger Bands data
  if (bollingerBandsData) {
    bollingerBandsData.forEach(point => {
      const ts = bucketTs(point.ts);
      if (!dataMap.has(ts)) {
        dataMap.set(ts, { ts, upper: point.upper, middle: point.middle, lower: point.lower });
      } else {
        const existing = dataMap.get(ts);
        existing.upper = point.upper;
        existing.middle = point.middle;
        existing.lower = point.lower;
      }
    });
  }
  
  // Convert to sorted array
  return Array.from(dataMap.values()).sort((a, b) => a.ts - b.ts);
}
