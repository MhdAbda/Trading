/**
 * Twelve Data Historical Data Service
 *
 * Fetches historical price data from Twelve Data REST API
 * Supports various time ranges and intervals
 */

const https = require('https');
const config = require('../config/env');

class TwelveDataHistorical {
  constructor() {
    this.baseUrl = 'api.twelvedata.com';
    this.apiKey = config.twelveDataApiKey;
    // Use current system timezone for API requests
    this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  /**
   * Make HTTPS GET request
   * @param {string} url - Full URL to request
   * @returns {Promise<Object>} Parsed JSON response
   */
  _makeRequest(url) {
    return new Promise((resolve, reject) => {
      
      https.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (err) {
            reject(new Error(`Failed to parse JSON: ${err.message}`));
          }
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Fetch historical time series data
   * @param {Object} params - Parameters for the request
   * @param {string} params.symbol - Symbol (e.g., 'XAU/USD')
   * @param {string} params.interval - Interval (1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 1day, etc.)
   * @param {string} params.start_date - Start date (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
   * @param {string} params.end_date - End date (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
   * @param {number} params.outputsize - Number of data points to return (max depends on plan)
   * @returns {Promise<Array>} Array of historical data points
   */
  async getHistoricalData({
    symbol = config.symbol,
    interval = '1min',
    start_date,
    end_date,
    outputsize,
    timezone = this.timezone // Default to current timezone
  }) {
    try {
      // Build query parameters
      const params = new URLSearchParams({
        symbol,
        interval,
        apikey: this.apiKey,
        format: 'JSON',
        timezone // Add timezone parameter
      });

      // Add date range if provided
      if (start_date) params.append('start_date', start_date);
      if (end_date) params.append('end_date', end_date);
      if (outputsize) params.append('outputsize', outputsize.toString());

      const url = `https://${this.baseUrl}/time_series?${params.toString()}`;

      const response = await this._makeRequest(url);

      if (response.status === 'error') {
        throw new Error(`Twelve Data API error: ${response.message}`);
      }

      if (!response.values || !Array.isArray(response.values)) {
        return [];
      }

      if (response.values.length > 0) {
      }

      // Transform the data to match our internal format
      const transformedData = response.values.map(item => ({
        time: item.datetime,
        price: parseFloat(item.close),
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        volume: parseInt(item.volume) || 0
      })).reverse(); // Twelve Data returns newest first, we want oldest first


      return transformedData;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get available time ranges for different intervals
   * Based on Twelve Data's data availability
   */
  getAvailableRanges() {
    const now = new Date();

    return {
      '1min': {
        maxDays: 30, // Typically 30 days for 1-minute data
        description: '30 days of 1-minute bars'
      },
      '5min': {
        maxDays: 60, // About 2 months
        description: '60 days of 5-minute bars'
      },
      '15min': {
        maxDays: 180, // About 6 months
        description: '180 days of 15-minute bars'
      },
      '30min': {
        maxDays: 365, // About 1 year
        description: '365 days of 30-minute bars'
      },
      '1h': {
        maxDays: 730, // About 2 years
        description: '2 years of 1-hour bars'
      },
      '1day': {
        maxDays: 3650, // About 10 years
        description: '10+ years of daily bars'
      }
    };
  }

  /**
   * Calculate start date based on interval and desired days
   * @param {string} interval - Time interval
   * @param {number} days - Number of days back
   * @returns {string} Start date in YYYY-MM-DD format
   */
  calculateStartDate(interval, days) {
    const now = new Date();
    // Go back further to account for potential data gaps
    const extraDays = Math.max(2, Math.floor(days * 0.2)); // Add 20% extra days, minimum 2
    const totalDays = days + extraDays;
    const startDate = new Date(now.getTime() - (totalDays * 24 * 60 * 60 * 1000));

    // For intraday data, we want the exact date
    // For daily data, we might want to adjust to start of day
    return startDate.toISOString().split('T')[0];
  }
}

module.exports = new TwelveDataHistorical();
