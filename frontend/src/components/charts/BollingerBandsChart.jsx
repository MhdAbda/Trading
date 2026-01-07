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

export default function BollingerBandsChart({ data, syncId, timeRange }) {
  const theme = useTheme();
  const containerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(800);

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
    if (!data || data.length === 0) {
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
    const values = data.flatMap((d) => [d.upper, d.middle, d.lower]).filter((v) => !isNaN(v));
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
        title="Bollinger Bands (20, 2)" 
        sx={{ 
          paddingBottom: 1,
          '& .MuiCardHeader-title': {
            fontSize: '1rem',
          }
        }}
      />
      <CardContent sx={{ 
        paddingTop: 0, 
        paddingBottom: 2, 
        height: 'calc(100% - 60px)', 
        overflow: 'auto',
        '&::-webkit-scrollbar': {
          height: '8px',
          width: '8px',
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
      }}>
        <Box ref={containerRef} sx={{ width: '100%', height: 400 }}>
          {data && data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                syncId={syncId}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                width={effectiveChartWidth}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={domain}
                  ticks={ticks}
                  tickFormatter={(ts) => formatAxisTime(ts, showDate)}
                  tick={{ fill: textColor, fontSize: 11 }}
                  tickLine={{ stroke: textColor }}
                  minTickGap={90}
                />
                <YAxis
                  yAxisId="left"
                  domain={yDomain}
                  tick={{ fill: textColor, fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                  }}
                  labelFormatter={(ts) => formatTooltipTime(ts)}
                  formatter={(value) => {
                    if (typeof value === 'number') {
                      return value.toFixed(2);
                    }
                    return value;
                  }}
                />
                {/* Upper Band */}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="upper"
                  stroke={theme.palette.error.main}
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                  name="Upper Band"
                />
                {/* Middle Band (SMA) */}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="middle"
                  stroke={theme.palette.info.main}
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                  name="Middle Band (SMA)"
                />
                {/* Lower Band */}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="lower"
                  stroke={theme.palette.success.main}
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                  name="Lower Band"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <span style={{ color: textColor }}>No data available</span>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
