import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  Line,
} from 'recharts';
import { Paper, Typography, Box } from '@mui/material';
import {
  calculateTickInterval,
  generateTicks,
  formatAxisTime,
  formatTooltipTime,
} from '../../utils/time';

const OHLCChart = ({ data, height = 400 }) => {
  const containerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(800);

  // Track container width for tick calculation
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setChartWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Calculate time range and ticks with FIXED 24-hour domain
  const { ticks, domain, showDate, tickIntervalMs } = useMemo(() => {
    // Always use a fixed 24-hour domain from 00:00 to end of day
    // Data points are positioned at their exact timestamps within this fixed range
    
    if (!data || data.length === 0) {
      // Empty data case - still show full day
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
      const tickIntervalMs = calculateTickInterval(24 * 60 * 60 * 1000, chartWidth, 90);
      const ticks = generateTicks(startOfDay, endOfDay, tickIntervalMs);
      return { ticks, domain: [startOfDay, endOfDay], showDate: false, tickIntervalMs };
    }

    const startTs = data[0].ts;
    
    // Get the day from the first data point and create full day boundaries
    const firstDate = new Date(startTs);
    const startOfDay = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate(), 0, 0, 0, 0).getTime();
    const endOfDay = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate(), 23, 59, 59, 999).getTime();

    // Calculate ticks for the full 24-hour period
    const tickIntervalMs = calculateTickInterval(24 * 60 * 60 * 1000, chartWidth, 90);
    const ticks = generateTicks(startOfDay, endOfDay, tickIntervalMs);

    return {
      ticks,
      domain: [startOfDay, endOfDay],
      showDate: false,
      tickIntervalMs,
    };
  }, [data, chartWidth]);

  // Transform data for Recharts
  const chartData = data.map(item => ({
    time: item.ts,
    open: item.open,
    high: item.high,
    low: item.low,
    close: item.close,
    // Calculate body for candlestick visualization
    bodyHigh: Math.max(item.open, item.close),
    bodyLow: Math.min(item.open, item.close),
    color: item.close > item.open ? '#26a69a' : '#ef5350',
  }));

  const CustomCandlestick = (props) => {
    const { payload, x, y, width, height } = props;
    if (!payload) return null;

    const { bodyHigh, bodyLow, high, low, color } = payload;
    const centerX = x + width / 2;

    // Wick (high-low line)
    const wickY1 = y;
    const wickY2 = y + height;

    // Body (open-close rectangle)
    const bodyY = y + (height * (high - bodyHigh)) / (high - low);
    const bodyHeight = (height * (bodyHigh - bodyLow)) / (high - low);

    return (
      <g>
        {/* Wick */}
        <line
          x1={centerX}
          y1={wickY1}
          x2={centerX}
          y2={wickY2}
          stroke={color}
          strokeWidth={1}
        />
        {/* Body */}
        <rect
          x={x + width * 0.2}
          y={bodyY}
          width={width * 0.6}
          height={Math.max(bodyHeight, 1)}
          fill={color}
          stroke={color}
        />
      </g>
    );
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          backgroundColor: '#1e1e1e',
          border: '1px solid #333',
          borderRadius: '4px',
          padding: '10px',
          color: '#fff'
        }}>
          <p>{`Time: ${formatTooltipTime(label)}`}</p>
          <p>{`Open: ${data.open?.toFixed(2)}`}</p>
          <p>{`High: ${data.high?.toFixed(2)}`}</p>
          <p>{`Low: ${data.low?.toFixed(2)}`}</p>
          <p>{`Close: ${data.close?.toFixed(2)}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        OHLC Candlestick Chart
      </Typography>
      <Box ref={containerRef} sx={{ width: '100%', height: height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={domain}
              ticks={ticks}
              tickFormatter={(ts) => formatAxisTime(ts, showDate)}
              stroke="#d1d4dc"
              interval={0}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              domain={['dataMin - 1', 'dataMax + 1']}
              stroke="#d1d4dc"
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              labelFormatter={(ts) => formatTooltipTime(ts)}
              content={<CustomTooltip />}
            />
            <Bar
              dataKey="high"
              fill="transparent"
              shape={<CustomCandlestick />}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};

export default OHLCChart;