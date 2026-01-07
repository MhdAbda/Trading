import { useState, useEffect, useRef, useCallback } from 'react';
import dayjs from 'dayjs';
// MOVED TO BACKEND: Indicator calculations now fetched from backend /indicators/historical endpoint
// import {
//   calculateRSISeries,
//   calculateMACDSeries,
//   calculateStochasticSeries,
//   calculateBollingerBandsSeries,
// } from '../utils/indicators';

const MAX_BUFFER_SIZE = 2000;
const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;
const AGGREGATION_INTERVAL_MS = 60 * 1000; // 1 minute in milliseconds

/**
 * Custom hook for managing SSE data feed with auto-reconnect
 * Connects to backend SSE endpoints and maintains a bounded buffer of data points
 * Aggregates real-time ticks into 1-minute intervals for smoother charting
 */
export function useDataFeed(timeRange, selectedDay, macdSettings) {
  const [priceData, setPriceData] = useState([]);
  const [rsiData, setRsiData] = useState([]);
  const [macdData, setMacdData] = useState([]);
  const [stochasticData, setStochasticData] = useState([]);
  const [bollingerBandsData, setBollingerBandsData] = useState([]);
  const [ohlcData, setOhlcData] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastUpdate, setLastUpdate] = useState(null);

  // Log when ohlcData changes
  useEffect(() => {
    if (ohlcData.length === 0) {
      console.log('[OHLC] Data cleared');
    }
  }, [ohlcData]);

  const priceSourceRef = useRef(null);
  const indicatorSourceRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);

  // Track if historical data has been loaded to prevent overwriting on reconnection
  const historicalDataLoadedRef = useRef(false);

  // Aggregation state for 1-minute intervals
  const currentMinuteRef = useRef(null);
  const minuteDataRef = useRef([]);

  const API_URL = import.meta.env.VITE_API_URL || '/api';

  const macdConfig = {
    fastLength: macdSettings?.fastLength ?? 12,
    slowLength: macdSettings?.slowLength ?? 26,
    signalLength: macdSettings?.signalLength ?? 9,
    oscillatorMAType: macdSettings?.oscillatorMAType ?? 'EMA',
    signalMAType: macdSettings?.signalMAType ?? 'EMA',
    source: macdSettings?.source ?? 'price',
  };

  // Normalize timestamp to ms - parse datetime strings as local time
  const normalizeTimestamp = useCallback((raw) => {
    if (!raw) return Date.now();
    if (raw instanceof Date) return raw.getTime();
    if (typeof raw === 'number') {
      return raw < 1e12 ? raw * 1000 : raw;
    }
    if (typeof raw === 'string') {
      if (/^\d+$/.test(raw)) {
        const n = parseInt(raw, 10);
        return n < 1e12 ? n * 1000 : n;
      }
      // Parse datetime strings as local time (e.g., "2025-12-23 00:00:00")
      // Extract components and create date in local timezone
      const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?: |T)(\d{2}):(\d{2}):(\d{2})/);
      if (match) {
        const [, year, month, day, hour, minute, second] = match;
        const date = new Date(
          parseInt(year),
          parseInt(month) - 1, // Month is 0-indexed
          parseInt(day),
          parseInt(hour),
          parseInt(minute),
          parseInt(second)
        );
        return date.getTime();
      }
      // Fallback for other formats
      const parsed = new Date(raw);
      return isNaN(parsed.getTime()) ? Date.now() : parsed.getTime();
    }
    return Date.now();
  }, []);

  // Add point to buffer with deduplication and size limit
  const addToBuffer = useCallback((setter, newPoint, keyField = 'ts') => {
    setter((prev) => {
      const newTs = newPoint[keyField];
      
      // Check if a point with the same timestamp already exists
      const existingIndex = prev.findIndex(point => point[keyField] === newTs);
      
      let updated;
      if (existingIndex !== -1) {
        // Replace the existing point with the new one
        updated = [...prev];
        updated[existingIndex] = newPoint;
      } else {
        // Add as new point
        updated = [...prev, newPoint];
        // Keep buffer bounded
        if (updated.length > MAX_BUFFER_SIZE) {
          updated = updated.slice(-MAX_BUFFER_SIZE);
        }
      }
      return updated;
    });
  }, []);

  // Aggregate ticks into 1-minute intervals
  const aggregatePriceData = useCallback((ts, price, open, high, low, close, volume) => {
    // Round timestamp down to the nearest minute so multiple ticks land in the same bucket
    const minuteStart = Math.floor(ts / AGGREGATION_INTERVAL_MS) * AGGREGATION_INTERVAL_MS;

    // Build an aggregated candle for the current bucket
    const summarizeMinute = (points) => {
      if (!points.length) return null;
      const first = points[0];
      const prices = points.map((p) => p.price);
      const highs = points.map((p) => (p.high !== undefined ? p.high : p.price));
      const lows = points.map((p) => (p.low !== undefined ? p.low : p.price));
      return {
        ts: currentMinuteRef.current,
        open: first.open !== undefined ? first.open : first.price,
        high: Math.max(...highs),
        low: Math.min(...lows),
        close: points[points.length - 1].close !== undefined ? points[points.length - 1].close : points[points.length - 1].price,
        volume: points.reduce((sum, p) => sum + (p.volume ? parseInt(p.volume) : 0), 0),
      };
    };

    // If we moved to a new minute, finalize the previous candle
    if (currentMinuteRef.current !== minuteStart) {
      if (currentMinuteRef.current !== null && minuteDataRef.current.length > 0) {
        const finalized = summarizeMinute(minuteDataRef.current);
        if (finalized) {
          addToBuffer(setPriceData, { ...finalized, price: finalized.close });
          setLastUpdate(new Date());
        }
      }

      // Start tracking the new minute bucket
      currentMinuteRef.current = minuteStart;
      minuteDataRef.current = [];
    }

    // Track the tick in the current minute bucket
    minuteDataRef.current.push({ ts, price, open, high, low, close, volume });

    // Update the current minute candle immediately so charts move with each tick
    const currentSummary = summarizeMinute(minuteDataRef.current);
    if (currentSummary) {
      addToBuffer(setPriceData, { ...currentSummary, price: currentSummary.close, ts: minuteStart });
      setLastUpdate(new Date());
    }
  }, [addToBuffer]);

  // Connect to price SSE stream (using stream endpoint for price data)
  const connectPriceStream = useCallback(() => {
    if (priceSourceRef.current) {
      priceSourceRef.current.close();
    }

    const streamUrl = `${API_URL}/market/gold/stream`;
    const eventSource = new EventSource(streamUrl);
    priceSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnectionStatus('connected');
      reconnectAttemptsRef.current = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Skip connection events
        if (data.event === 'connected') {
          return;
        }

        // Handle real-time price updates
        const ts = normalizeTimestamp(data.time || data.timestamp);
        const price = parseFloat(data.price);

        if (!isNaN(price) && ts <= Date.now()) {
          // Aggregate data into 1-minute intervals
          aggregatePriceData(
            ts,
            price,
            data.open ? parseFloat(data.open) : price,
            data.high ? parseFloat(data.high) : price,
            data.low ? parseFloat(data.low) : price,
            data.close ? parseFloat(data.close) : price,
            data.volume ? parseInt(data.volume) : 0
          );
        }
      } catch (err) {
        console.error('[SSE] Price stream parse error:', err.message);
      }
    };

    eventSource.onerror = (error) => {
      setConnectionStatus('error');
      setConnectionStatus('reconnecting');
      eventSource.close();
      scheduleReconnect();
    };
  }, [API_URL, normalizeTimestamp, aggregatePriceData]);

  // Connect to indicators SSE stream
  const connectIndicatorStream = useCallback(() => {
    if (indicatorSourceRef.current) {
      indicatorSourceRef.current.close();
    }

    const eventSource = new EventSource(`${API_URL}/market/gold/indicators/stream`);
    indicatorSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Skip connection events
        if (data.event === 'connected') {
          return;
        }

        // RSI data - use timestamp from indicator itself, just like gold price does
        if (data.rsi && data.rsi.rsi !== undefined) {
          const ts = normalizeTimestamp(data.rsi.time || data.rsi.timestamp || data.timestamp);
          const rsiValue = parseFloat(data.rsi.rsi);
          if (!isNaN(rsiValue) && ts <= Date.now()) {
            addToBuffer(setRsiData, { ts, rsi: rsiValue });
            setLastUpdate(new Date());
          }
        }

        // MACD data - use timestamp from indicator itself
        if (data.macd && data.macd.macd !== undefined) {
          const ts = normalizeTimestamp(data.macd.time || data.macd.timestamp || data.timestamp);
          const macdVal = parseFloat(data.macd.macd);
          const signalVal = parseFloat(data.macd.signal);
          const histogramVal = parseFloat(data.macd.histogram);
          if (!isNaN(macdVal) && ts <= Date.now()) {
            addToBuffer(setMacdData, {
              ts,
              macd: macdVal,
              signal: signalVal,
              histogram: histogramVal
            });
            setLastUpdate(new Date());
          }
        }

        // Stochastic data - use timestamp from indicator itself
        if (data.stochastic && data.stochastic.k !== undefined) {
          const ts = normalizeTimestamp(data.stochastic.time || data.stochastic.timestamp || data.timestamp);
          const kVal = parseFloat(data.stochastic.k);
          const dVal = parseFloat(data.stochastic.d);
          if (!isNaN(kVal) && ts <= Date.now()) {
            addToBuffer(setStochasticData, {
              ts,
              k: kVal,
              d: dVal,
            });
            setLastUpdate(new Date());
          }
        }

        // Bollinger Bands data - use timestamp from indicator itself
        if (data.bollingerBands && data.bollingerBands.upper !== undefined) {
          const ts = normalizeTimestamp(data.bollingerBands.time || data.bollingerBands.timestamp || data.timestamp);
          const upperVal = parseFloat(data.bollingerBands.upper);
          const middleVal = parseFloat(data.bollingerBands.middle);
          const lowerVal = parseFloat(data.bollingerBands.lower);
          if (!isNaN(upperVal) && ts <= Date.now()) {
            addToBuffer(setBollingerBandsData, {
              ts,
              upper: upperVal,
              middle: middleVal,
              lower: lowerVal,
            });
            setLastUpdate(new Date());
          }
        }
      } catch (err) {
        console.error('[Indicators] Stream parse error:', err.message);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };
  }, [API_URL, normalizeTimestamp, addToBuffer]);

  // Schedule reconnect with exponential backoff
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptsRef.current),
      RECONNECT_MAX_DELAY
    );

    reconnectAttemptsRef.current += 1;

    reconnectTimeoutRef.current = setTimeout(() => {
      connectPriceStream();
      connectIndicatorStream();
    }, delay);
  }, [connectPriceStream, connectIndicatorStream]);

  // Load initial historical data
  const loadHistoricalData = useCallback(async () => {
    try {
      // Format as local date (YYYY-MM-DD) to avoid timezone shifts
      const date = new Date(selectedDay);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dayParam = `${year}-${month}-${day}`;
      const apiUrl = `${API_URL}/market/gold/intraday?day=${encodeURIComponent(dayParam)}`;
      
      console.log(`[DATE-SWITCH] Loading data for day: ${dayParam}`);
      console.log(`[DATE-SWITCH] API URL: ${apiUrl}`);
      
      const priceRes = await fetch(apiUrl);
      console.log(`[DATE-SWITCH] API response status: ${priceRes.status}`);
      
      if (!priceRes.ok) {
        console.error(`[DATE-SWITCH] API error (status ${priceRes.status})`);
        return;
      }

      const priceJson = await priceRes.json();
      console.log(`[DATE-SWITCH] Response: cached=${priceJson.cached}, dataPoints=${priceJson.count}, dates=${priceJson.start_date} to ${priceJson.end_date}`);
      
      if (!priceJson.data || !Array.isArray(priceJson.data)) {
        console.error(`[DATE-SWITCH] Invalid response format`);
        return;
      }

      const historicalPrices = priceJson.data
        .map((p) => ({
          ts: normalizeTimestamp(p.time || p.timestamp),
          price: parseFloat(p.price),
        }))
        .filter((p) => !isNaN(p.price) && p.ts <= Date.now())
        .sort((a, b) => a.ts - b.ts);

      const trimmedPrices = historicalPrices.slice(-MAX_BUFFER_SIZE);
      console.log(`[DATE-SWITCH] Data processing: raw=${priceJson.data.length}, filtered=${historicalPrices.length}, trimmed=${trimmedPrices.length}`);
      
      setPriceData(trimmedPrices);

      // Also populate OHLC chart with the same data
      const ohlcData = priceJson.data
        .map((p) => ({
          ts: normalizeTimestamp(p.time || p.timestamp),
          open: parseFloat(p.open),
          high: parseFloat(p.high),
          low: parseFloat(p.low),
          close: parseFloat(p.price),
          volume: parseInt(p.volume) || 0,
        }))
        .filter((p) => !isNaN(p.close) && p.ts <= Date.now())
        .sort((a, b) => a.ts - b.ts);
      
      const trimmedOhlc = ohlcData.slice(-MAX_BUFFER_SIZE);
      console.log(`[DATE-SWITCH] OHLC data: ${trimmedOhlc.length} points`);
      setOhlcData(trimmedOhlc);

      if (trimmedPrices.length > 0) {
        // Fetch historical indicators from backend instead of calculating client-side
        try {
          const indicatorUrl = `${API_URL}/market/gold/indicators/historical?day=${encodeURIComponent(dayParam)}`;
          console.log(`[DATE-SWITCH] Fetching indicators from: ${indicatorUrl}`);
          const indicatorsRes = await fetch(indicatorUrl);
          if (indicatorsRes.ok) {
            const indicatorsJson = await indicatorsRes.json();
            console.log(`[DATE-SWITCH] Indicators response:`, indicatorsJson);
            
            // Convert timestamps to milliseconds for consistent filtering
            const convertTimestamps = (data) => {
              return (data || []).map(point => ({
                ...point,
                ts: normalizeTimestamp(point.ts)
              }));
            };
            
            const rsiConverted = convertTimestamps(indicatorsJson.rsi);
            const macdConverted = convertTimestamps(indicatorsJson.macd);
            const stochConvert = convertTimestamps(indicatorsJson.stochastic);
            const bbConverted = convertTimestamps(indicatorsJson.bollingerBands);
            
            // Log sample timestamps after conversion
            if (rsiConverted.length > 0) {
              console.log(`[DATE-SWITCH] RSI timestamps (converted) - first: ${new Date(rsiConverted[0].ts).toISOString()}, last: ${new Date(rsiConverted[rsiConverted.length - 1].ts).toISOString()}`);
            }
            if (stochConvert.length > 0) {
              console.log(`[DATE-SWITCH] Stochastic timestamps (converted) - first: ${new Date(stochConvert[0].ts).toISOString()}, last: ${new Date(stochConvert[stochConvert.length - 1].ts).toISOString()}`);
            }
            
            console.log(`[DATE-SWITCH] Indicators: rsi=${rsiConverted.length}, macd=${macdConverted.length}, stoch=${stochConvert.length}, bb=${bbConverted.length}`);
            
            setRsiData(rsiConverted);
            setMacdData(macdConverted);
            setStochasticData(stochConvert);
            setBollingerBandsData(bbConverted);
            
            console.log(`[DATE-SWITCH] State updated - RSI data points: ${rsiConverted.length}`);
          } else {
            console.warn(`[DATE-SWITCH] Failed to fetch indicators (status ${indicatorsRes.status})`);
          }
        } catch (err) {
          console.error(`[DATE-SWITCH] Indicators fetch error: ${err.message}`);
        }
      } else {
        console.warn(`[DATE-SWITCH] No data received from API`);
      }
    } catch (err) {
      console.error(`[DATE-SWITCH] Error: ${err.message}`);
    }
  }, [API_URL, normalizeTimestamp, selectedDay]);

  // Check if selected day is today
  const isToday = useCallback(() => {
    const today = new Date();
    const selected = new Date(selectedDay);
    return today.toDateString() === selected.toDateString();
  }, [selectedDay]);

  // Initialize connections
  useEffect(() => {
    const initializeData = async () => {
      const selectedStr = new Date(selectedDay).toDateString();
      const todayStr = new Date().toDateString();
      const isCurrentDay = isToday();
      
      console.log(`[INIT] Selected: ${selectedStr} | Today: ${todayStr} | Current: ${isCurrentDay}`);
      
      await loadHistoricalData();
      
      // Only connect to live streams if viewing today's data
      if (isCurrentDay) {
        console.log('[INIT] Connecting SSE (current day)');
        setTimeout(() => {
          connectPriceStream();
          connectIndicatorStream();
        }, 100);
      } else {
        console.log('[INIT] SSE disabled (viewing past date)');
      }
    };
    
    initializeData();

    return () => {
      if (priceSourceRef.current) priceSourceRef.current.close();
      if (indicatorSourceRef.current) indicatorSourceRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [loadHistoricalData, connectPriceStream, connectIndicatorStream, isToday]);

  // Periodic emission of current minute's aggregated data
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentMinuteRef.current !== null && minuteDataRef.current.length > 0) {
        const lastPrice = minuteDataRef.current[minuteDataRef.current.length - 1].price;
        const aggregatedPoint = {
          ts: currentMinuteRef.current,
          price: lastPrice,
          open: lastPrice,
          high: lastPrice,
          low: lastPrice,
          close: lastPrice,
          volume: 0
        };
        addToBuffer(setPriceData, aggregatedPoint);
        setLastUpdate(new Date());
      }
    }, AGGREGATION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [addToBuffer]);

  // Cleanup aggregation state on unmount
  useEffect(() => {
    return () => {
      // Emit final aggregated point if there's pending data
      if (currentMinuteRef.current !== null && minuteDataRef.current.length > 0) {
        const lastPrice = minuteDataRef.current[minuteDataRef.current.length - 1].price;
        const finalPoint = {
          ts: currentMinuteRef.current,
          price: lastPrice,
          open: lastPrice,
          high: lastPrice,
          low: lastPrice,
          close: lastPrice,
          volume: 0
        };
        setPriceData(prev => {
          const updated = [...prev, finalPoint];
          if (updated.length > MAX_BUFFER_SIZE) {
            return updated.slice(-MAX_BUFFER_SIZE);
          }
          return updated;
        });
      }
    };
  }, []);

  // Filter data by time range
  const getFilteredData = useCallback((data, rangeMs) => {
    if (!data || data.length === 0) return [];
    if (rangeMs === -1) return data; // Return all data for "all" time range
    const now = Date.now();
    const cutoff = now - rangeMs;
    return data.filter((d) => d.ts >= cutoff);
  }, []);

  // Get latest values
  const getLatestPrice = useCallback(() => {
    if (priceData.length === 0) return null;
    return priceData[priceData.length - 1].price;
  }, [priceData]);

  const getLatestRSI = useCallback(() => {
    if (rsiData.length === 0) return null;
    return rsiData[rsiData.length - 1].rsi;
  }, [rsiData]);

  const getLatestMACD = useCallback(() => {
    if (macdData.length === 0) return null;
    const latest = macdData[macdData.length - 1];
    return { macd: latest.macd, signal: latest.signal, histogram: latest.histogram };
  }, [macdData]);

  const getLatestStochastic = useCallback(() => {
    if (stochasticData.length === 0) return null;
    const latest = stochasticData[stochasticData.length - 1];
    return { k: latest.k, d: latest.d };
  }, [stochasticData]);

  // Fetch historical OHLC data via SSE stream
  const fetchHistoricalData = useCallback(async (params = {}) => {
    historicalDataLoadedRef.current = false;
    return new Promise((resolve, reject) => {
      let retryCount = 0;
      const maxRetries = 2;
      
      const attemptFetch = () => {
        const queryParams = new URLSearchParams({
          interval: params.interval || '1min',
          days: params.days || 1,
          ...params,
        });

        const historicalUrl = `${API_URL}/market/gold/historical?${queryParams}`;
        console.log(`[Historical] Fetching OHLC (attempt ${retryCount + 1}): ${historicalUrl}`);
        const eventSource = new EventSource(historicalUrl);

        const timeoutId = setTimeout(() => {
          console.error('[Historical] Fetch timeout after 30s');
          eventSource.close();
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(attemptFetch, 1000);
          } else {
            reject(new Error('Historical data fetch timeout after retries'));
          }
        }, 30000);

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.event === 'historical') {
              clearTimeout(timeoutId);
              console.log(`[Historical] Received ${data.count} OHLC points`);
              if (data.data && Array.isArray(data.data) && !historicalDataLoadedRef.current) {
                historicalDataLoadedRef.current = true;

                const transformedData = data.data
                .map(item => ({
                  ts: normalizeTimestamp(item.time),
                  open: parseFloat(item.open),
                  high: parseFloat(item.high),
                  low: parseFloat(item.low),
                  close: parseFloat(item.price),
                  volume: parseInt(item.volume) || 0,
                }))
                .filter(item => item.ts <= Date.now() && !isNaN(item.close));

                console.log(`[Historical] Transformed ${transformedData.length} OHLC points`);
                if (transformedData.length > 0) {
                  console.log(`[Historical] Date range: ${new Date(transformedData[0].ts).toISOString()} to ${new Date(transformedData[transformedData.length - 1].ts).toISOString()}`);
                  setOhlcData(transformedData);
                  const priceSeries = transformedData
                    .map(c => ({ ts: c.ts, price: c.close }))
                    .sort((a, b) => a.ts - b.ts)
                    .slice(-MAX_BUFFER_SIZE);
                  setPriceData(priceSeries);
                  if (priceSeries.length > 0) {
                    const rsiHistory = calculateRSISeries(priceSeries, 14);
                    const stochHistory = calculateStochasticSeries(priceSeries, 14, 3, 3);
                    setRsiData(rsiHistory);
                    setStochasticData(stochHistory);
                  }
                  resolve(transformedData);
                } else {
                  console.warn('[Historical] No OHLC points after transformation');
                  resolve([]);
                }
              } else if (historicalDataLoadedRef.current) {
                resolve([]);
              }
            } else if (data.event === 'realtime') {
              if (data.price !== undefined) {
                const ts = normalizeTimestamp(data.time || data.timestamp);
                const price = parseFloat(data.price);

                if (!isNaN(price) && ts <= Date.now()) {
                  const ohlcPoint = {
                    ts: ts,
                    open: data.open ? parseFloat(data.open) : price,
                    high: data.high ? parseFloat(data.high) : price,
                    low: data.low ? parseFloat(data.low) : price,
                    close: data.close ? parseFloat(data.close) : price,
                    volume: data.volume ? parseInt(data.volume) : 0,
                  };
                  addToBuffer(setOhlcData, ohlcPoint);
                }
              }
            }
          } catch (err) {
            console.error('[Historical] Parse error:', err.message);
          }
        };

        eventSource.onerror = (error) => {
          clearTimeout(timeoutId);
          console.error('[Historical] SSE connection error:', error.message || error);
          eventSource.close();
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`[Historical] Retrying... (${retryCount}/${maxRetries})`);
            setTimeout(attemptFetch, 1000);
          } else {
            reject(new Error('Historical data fetch failed after retries'));
          }
        };

        if (!priceSourceRef.current) {
          priceSourceRef.current = eventSource;
        }
      };
      
      attemptFetch();
    });
  }, [API_URL, normalizeTimestamp, aggregatePriceData]);

  // MOVED TO BACKEND: MACD is now fetched from /indicators/historical endpoint
  // Recompute MACD whenever price data or MACD settings change
  // useEffect(() => {
  //   if (!priceData || priceData.length === 0) {
  //     setMacdData([]);
  //     return;
  //   }
  //
  //   const macdHistory = calculateMACDSeries(
  //     priceData,
  //     macdConfig.fastLength,
  //     macdConfig.slowLength,
  //     macdConfig.signalLength,
  //     {
  //       oscillatorMAType: macdConfig.oscillatorMAType,
  //       signalMAType: macdConfig.signalMAType,
  //       source: macdConfig.source,
  //     }
  //   );
  //
  //   setMacdData(macdHistory);
  // }, [
  //   priceData,
  //   macdConfig.fastLength,
  //   macdConfig.slowLength,
  //   macdConfig.signalLength,
  //   macdConfig.oscillatorMAType,
  //   macdConfig.signalMAType,
  //   macdConfig.source,
  // ]);

  return {
    priceData,
    rsiData,
    macdData,
    stochasticData,
    bollingerBandsData,
    ohlcData,
    connectionStatus,
    lastUpdate,
    getFilteredData,
    getLatestPrice,
    getLatestRSI,
    getLatestMACD,
    getLatestStochastic,
    fetchHistoricalData,
  };
}
