import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, Box, useTheme } from '@mui/material';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  calculateTickInterval,
  generateTicks,
  formatAxisTime,
  formatTooltipTime,
  isMultiDay,
} from '../../utils/time';

export default function MACDChart({ data, syncId, timeRange, settings }) {
  const theme = useTheme();
  const containerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(800);

  const fastLength = settings?.fastLength ?? 12;
  const slowLength = settings?.slowLength ?? 26;
  const signalLength = settings?.signalLength ?? 9;
  const oscillatorMAType = (settings?.oscillatorMAType || 'EMA').toUpperCase();
  const signalMAType = (settings?.signalMAType || 'EMA').toUpperCase();

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
  const effectiveChartWidth = isAllTime ? Math.max(chartWidth * 12, 8000) : chartWidth;

  const { ticks, domain, showDate } = useMemo(() => {
    // Always use a fixed 24-hour domain from 00:00 to end of day
    // Data points are positioned at their exact timestamps within this fixed range
    
    if (!data || data.length === 0) {
      // Empty data case - still show full day
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
      const tickIntervalMs = calculateTickInterval(24 * 60 * 60 * 1000, effectiveChartWidth, 90);
      const ticks = generateTicks(startOfDay, endOfDay, tickIntervalMs);
      return { ticks, domain: [startOfDay, endOfDay], showDate: false };
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
      };
    }

    // For multi-day views, calculate based on actual data range
    const tickIntervalMs = calculateTickInterval(rangeMs, effectiveChartWidth, 90);
    const ticks = generateTicks(startTs, endTs, tickIntervalMs);
    return {
      ticks,
      domain: [startTs, endTs],
      showDate: true,
    };
  }, [data, effectiveChartWidth]);

  // Calculate Y-axis domain
  const yDomain = useMemo(() => {
    if (!data || data.length === 0) return ['auto', 'auto'];
    const values = data.flatMap((d) => [d.macd, d.signal, d.histogram]).filter((v) => !isNaN(v));
    if (values.length === 0) return ['auto', 'auto'];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.1, 0.01);
    return [min - padding, max + padding];
  }, [data]);

  const gridColor = theme.palette.mode === 'dark' ? '#333' : '#e0e0e0';
  const textColor = theme.palette.text.secondary;

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        title="MACD"
        titleTypographyProps={{ variant: 'h6' }}
        subheader={`Fast ${fastLength} (${oscillatorMAType}), Slow ${slowLength} (${oscillatorMAType}), Signal ${signalLength} (${signalMAType})`}
        subheaderTypographyProps={{ variant: 'caption' }}
      />
      <CardContent sx={{ pt: 0 }}>
        <Box 
          ref={containerRef} 
          sx={{ 
            width: '100%', 
            height: 250, 
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
            <ComposedChart data={data} syncId={syncId} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="ts"
                type="number"
                domain={domain}
                ticks={ticks}
                tickFormatter={(ts) => formatAxisTime(ts, showDate)}
                stroke={textColor}
                tick={{ fontSize: 11 }}
                tickLine={{ stroke: textColor }}
              />
              <YAxis
                domain={yDomain}
                tickFormatter={(val) => val.toFixed(2)}
                stroke={textColor}
                tick={{ fontSize: 11 }}
                tickLine={{ stroke: textColor }}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 8,
                }}
                labelFormatter={(ts) => formatTooltipTime(ts)}
                formatter={(value, name) => [value.toFixed(4), name.toUpperCase()]}
              />
              <ReferenceLine y={0} stroke={textColor} strokeDasharray="3 3" />
              {/* Histogram bars */}
              <Bar
                dataKey="histogram"
                fill={(entry) => (entry && entry.histogram >= 0 ? '#4caf50' : '#f44336')}
                isAnimationActive={false}
              />
              {/* MACD Line */}
              <Line
                type="monotone"
                dataKey="macd"
                stroke="#2196f3"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                name="MACD"
              />
              {/* Signal Line */}
              <Line
                type="monotone"
                dataKey="signal"
                stroke="#ff9800"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                name="Signal"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
}
