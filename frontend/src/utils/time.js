import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

/**
 * Preferred tick intervals in minutes (must be multiples of 1 minute)
 * These create "nice" axis labels
 */
const PREFERRED_INTERVALS_MINUTES = [1, 2, 5, 10, 15, 30, 60, 120, 240, 360, 720, 1440];

/**
 * Calculate the optimal tick interval for the X-axis based on visible time range and chart width
 * @param {number} rangeMs - Visible time range in milliseconds
 * @param {number} chartWidthPx - Approximate chart width in pixels
 * @param {number} minLabelSpacingPx - Minimum spacing between labels (default: 90px)
 * @param {number} forceIntervalMinutes - Force a specific interval in minutes (optional)
 * @returns {number} Tick interval in milliseconds
 */
export function calculateTickInterval(rangeMs, chartWidthPx = 800, minLabelSpacingPx = 90, forceIntervalMinutes = null) {
  // If forcing a specific interval, use it
  if (forceIntervalMinutes && PREFERRED_INTERVALS_MINUTES.includes(forceIntervalMinutes)) {
    return forceIntervalMinutes * 60000;
  }

  if (!rangeMs || rangeMs <= 0) return 60000; // Default to 1 minute

  // Calculate how many ticks can fit
  const maxTicks = Math.floor(chartWidthPx / minLabelSpacingPx);
  if (maxTicks <= 1) return rangeMs;

  // Calculate ideal tick interval
  const idealIntervalMs = rangeMs / maxTicks;
  const idealIntervalMinutes = idealIntervalMs / 60000;

  // Find the smallest preferred interval that is >= ideal interval
  for (const interval of PREFERRED_INTERVALS_MINUTES) {
    if (interval >= idealIntervalMinutes) {
      return interval * 60000;
    }
  }

  // If none found, use the largest preferred interval
  return PREFERRED_INTERVALS_MINUTES[PREFERRED_INTERVALS_MINUTES.length - 1] * 60000;
}

/**
 * Generate tick positions for the X-axis
 * @param {number} startTs - Start timestamp in ms
 * @param {number} endTs - End timestamp in ms
 * @param {number} tickIntervalMs - Tick interval in ms
 * @returns {number[]} Array of tick positions (timestamps)
 */
export function generateTicks(startTs, endTs, tickIntervalMs) {
  if (!startTs || !endTs || startTs >= endTs) return [];

  const ticks = [];
  // Round start to the nearest tick interval
  const firstTick = Math.ceil(startTs / tickIntervalMs) * tickIntervalMs;

  for (let tick = firstTick; tick <= endTs; tick += tickIntervalMs) {
    ticks.push(tick);
  }

  // Ensure the end timestamp has a nearby tick (within 50% of interval)
  if (ticks.length > 0) {
    const lastTick = ticks[ticks.length - 1];
    const distanceToEnd = endTs - lastTick;
    if (distanceToEnd > tickIntervalMs * 0.5 && endTs - startTs > tickIntervalMs) {
      // Add the end timestamp as a tick if it's not too close to the last tick
      ticks.push(endTs);
    }
  }

  return ticks;
}

/**
 * Format timestamp for X-axis display
 * Shows HH:mm for same-day, adds date for multi-day ranges
 * @param {number} timestamp - Unix timestamp in ms (already in local timezone)
 * @param {boolean} showDate - Whether to show date (for multi-day ranges)
 * @returns {string} Formatted time string
 */
export function formatAxisTime(timestamp, showDate = false) {
  const d = dayjs(timestamp); // Use local time, not UTC
  if (showDate) {
    return d.format('MM/DD HH:mm');
  }
  return d.format('HH:mm');
}

/**
 * Format timestamp for tooltip display (full precision)
 * @param {number} timestamp - Unix timestamp in ms (already in local timezone)
 * @returns {string} Formatted time string
 */
export function formatTooltipTime(timestamp) {
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss'); // Use local time, not UTC
}

/**
 * Get time range in milliseconds from range key
 * @param {string} rangeKey - Range key like '30m', '1h', '6h', '24h', or 'all'
 * @returns {number} Range in milliseconds, or -1 for 'all'
 */
export function getTimeRangeMs(rangeKey) {
  if (rangeKey === 'all') {
    return -1; // Special value indicating "all time"
  }

  const ranges = {
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '3h': 3 * 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
  };
  return ranges[rangeKey] || ranges['24h'];
}

/**
 * Calculate number of data points needed for a time range (1 point per minute)
 * @param {string} rangeKey - Range key
 * @returns {number} Number of points
 */
export function getPointsForRange(rangeKey) {
  const rangeMs = getTimeRangeMs(rangeKey);
  return Math.ceil(rangeMs / 60000) + 1;
}

/**
 * Check if time range spans multiple days
 * @param {number} startTs - Start timestamp
 * @param {number} endTs - End timestamp
 * @returns {boolean}
 */
export function isMultiDay(startTs, endTs) {
  const startDay = dayjs(startTs).startOf('day');
  const endDay = dayjs(endTs).startOf('day');
  return !startDay.isSame(endDay);
}
