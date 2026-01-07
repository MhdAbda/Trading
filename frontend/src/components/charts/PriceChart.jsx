import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, Box, useTheme } from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  calculateTickInterval,
  generateTicks,
  formatAxisTime,
  formatTooltipTime,
  isMultiDay,
} from '../../utils/time';

export default function PriceChart({ data, syncId, timeRange }) {
  const theme = useTheme();
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

  // For "all" time range, use a much wider chart to enable horizontal scrolling
  const isAllTime = timeRange === 'all';
  const effectiveChartWidth = isAllTime ? Math.max(chartWidth * 8, 7000) : chartWidth;

  // Calculate time range and ticks with FIXED 24-hour domain
  const { ticks, domain, showDate, tickIntervalMs } = useMemo(() => {
    // Always use a fixed 24-hour domain from 00:00 to end of day for single-day views
    // For multi-day views, calculate domain from actual data
    
    if (!data || data.length === 0) {
      // Empty data case - show full day
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
      const tickIntervalMs = calculateTickInterval(24 * 60 * 60 * 1000, effectiveChartWidth, 90);
      const ticks = generateTicks(startOfDay, endOfDay, tickIntervalMs);
      return { ticks, domain: [startOfDay, endOfDay], showDate: false, tickIntervalMs };
    }

    const startTs = data[0].ts;
    const endTs = data[data.length - 1].ts;
    const rangeMs = endTs - startTs;
    const multiDay = isMultiDay(startTs, endTs);

    // For single-day views, use fixed 24-hour domain
    if (!multiDay && rangeMs < 24 * 60 * 60 * 1000) {
      const firstDate = new Date(startTs);
      const startOfDay = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate(), 0, 0, 0, 0).getTime();
      const endOfDay = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate(), 23, 59, 59, 999).getTime();
      const tickIntervalMs = calculateTickInterval(24 * 60 * 60 * 1000, effectiveChartWidth, 90);
      const ticks = generateTicks(startOfDay, endOfDay, tickIntervalMs);
      return {
        ticks,
        domain: [startOfDay, endOfDay],
        showDate: false,
        tickIntervalMs,
      };
    }

    // For multi-day views, calculate based on actual data range
    const tickIntervalMs = calculateTickInterval(rangeMs, effectiveChartWidth, 90);
    const ticks = generateTicks(startTs, endTs, tickIntervalMs);
    return {
      ticks,
      domain: [startTs, endTs],
      showDate: true,
      tickIntervalMs,
    };
  }, [data, effectiveChartWidth]);

  // Calculate Y-axis domain with padding
  const yDomain = useMemo(() => {
    if (!data || data.length === 0) return ['auto', 'auto'];
    const prices = data.map((d) => d.price).filter((p) => !isNaN(p));
    if (prices.length === 0) return ['auto', 'auto'];
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.1 || 1;
    return [min - padding, max + padding];
  }, [data]);

  const gridColor = theme.palette.mode === 'dark' ? '#333' : '#e0e0e0';
  const textColor = theme.palette.text.secondary;

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        title="Gold Price (XAU/USD)"
        titleTypographyProps={{ variant: 'h6' }}
      />
      <CardContent sx={{ pt: 0 }}>
        <Box 
          ref={containerRef} 
          sx={{ 
            width: '100%', 
            height: 300, 
            overflowX: isAllTime ? 'auto' : 'visible',
            overflowY: 'hidden',
            scrollBehavior: 'smooth',
            '&::-webkit-scrollbar': {
              height: '8px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: theme.palette.mode === 'dark' ? '#333' : '#f1f1f1',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: theme.palette.mode === 'dark' ? '#555' : '#c1c1c1',
              borderRadius: '4px',
              '&:hover': {
                backgroundColor: theme.palette.mode === 'dark' ? '#777' : '#a8a8a8',
              },
            },
          }}
        >
          <ResponsiveContainer width={isAllTime ? effectiveChartWidth : "100%"} height="100%">
            <LineChart data={data} syncId={syncId} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="ts"
                type="number"
                domain={domain}
                ticks={ticks}
                tickFormatter={(ts, index) => {
                  // Remove extra left padding for the first tick
                  if (index === 0 && ticks.length > 1) {
                    return formatAxisTime(ts, showDate);
                  }
                  return formatAxisTime(ts, showDate);
                }}
                stroke={textColor}
                tick={{ fontSize: 11, dx: -8 }} // Reduce gap by shifting ticks left
                tickLine={{ stroke: textColor }}
                axisLine={{ stroke: textColor }}
                interval={0} // Show all ticks
                minTickGap={0} // Remove min gap
                padding={{ left: 0, right: 0 }} // Remove X axis padding
              />
              <YAxis
                domain={yDomain}
                tickFormatter={(val) => `$${val.toFixed(2)}`}
                stroke={textColor}
                tick={{ fontSize: 11 }}
                tickLine={{ stroke: textColor }}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 8,
                }}
                labelFormatter={(ts) => formatTooltipTime(ts)}
                formatter={(value) => [`$${value.toFixed(2)}`, 'Price']}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#FFD700"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
}
