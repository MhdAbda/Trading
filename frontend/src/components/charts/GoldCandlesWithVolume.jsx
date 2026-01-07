import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, Box, ToggleButton, ToggleButtonGroup, Alert, useTheme } from '@mui/material';
import { createChart, ColorType } from 'lightweight-charts';

export default function GoldCandlesWithVolume({ data, syncId, timeRange, selectedDay }) {
  const theme = useTheme();
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const [chartType, setChartType] = useState('line');
  const [hasOHLC, setHasOHLC] = useState(false);
  const [hasVolume, setHasVolume] = useState(false);

  // Check if data has OHLC and volume
  useEffect(() => {
    if (data && data.length > 0) {
      const samplePoint = data.find(d => d.open !== undefined && d.high !== undefined && d.low !== undefined && d.close !== undefined);
      setHasOHLC(!!samplePoint);

      const volumePoint = data.find(d => d.volume !== undefined && d.volume !== null);
      setHasVolume(!!volumePoint);
    }
  }, [data]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: theme.palette.background.paper },
        textColor: theme.palette.text.primary,
      },
      grid: {
        vertLines: { color: theme.palette.divider },
        horzLines: { color: theme.palette.divider },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: theme.palette.divider,
      },
    });

    chartRef.current = chart;

    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      // Create candlestick series
      let candlestickSeries = null;
      if (typeof chart.addCandlestickSeries === 'function') {
        try {
          candlestickSeries = chart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
          });
        } catch (error) {
          console.error('Error creating candlestick series:', error);
        }
      } else {
        console.error('addCandlestickSeries method not available on chart object');
        // Fallback to line series
        if (typeof chart.addLineSeries === 'function') {
          try {
            candlestickSeries = chart.addLineSeries({
              color: '#FFD700',
              lineWidth: 2,
            });
          } catch (error) {
            console.error('Error creating line series:', error);
          }
        }
      }
      candlestickSeriesRef.current = candlestickSeries;

      // Create volume series (histogram) if volume is available
      if (hasVolume && typeof chart.addHistogramSeries === 'function') {
        try {
          const volumeSeries = chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: {
              type: 'volume',
            },
            priceScaleId: '', // Use separate price scale
          });
          volumeSeriesRef.current = volumeSeries;

          // Position volume at bottom
          volumeSeries.priceScale().applyOptions({
            scaleMargins: {
              top: 0.7,
              bottom: 0,
            },
          });
        } catch (error) {
          console.error('Error creating volume series:', error);
        }
      }
    });

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [theme, hasVolume]);

  // Update chart data
  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

    // Convert data to chart format
    const chartData = data.map(point => {
      const timestamp = Math.floor(point.ts / 1000); // Convert to seconds for lightweight-charts

      if (chartType === 'candles' && hasOHLC) {
        return {
          time: timestamp,
          open: point.open || point.price,
          high: point.high || point.price,
          low: point.low || point.price,
          close: point.close || point.price,
        };
      } else {
        // Line chart or fallback
        return {
          time: timestamp,
          value: point.price,
        };
      }
    });

    // Update candlestick series
    if (candlestickSeriesRef.current) {
      if (chartType === 'candles' && hasOHLC) {
        candlestickSeriesRef.current.setData(chartData);
      } else {
        // For line chart, we could add a line series, but for now just hide candlesticks
        candlestickSeriesRef.current.setData([]);
      }
    }

    // Update volume series
    if (volumeSeriesRef.current && hasVolume) {
      const volumeData = data.map(point => ({
        time: Math.floor(point.ts / 1000),
        value: point.volume || 0,
        color: point.close && point.open ? (point.close >= point.open ? '#26a69a' : '#ef5350') : '#26a69a',
      }));
      volumeSeriesRef.current.setData(volumeData);
    }

    // Fit content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data, chartType, hasOHLC, hasVolume]);

  const handleChartTypeChange = (event, newType) => {
    if (newType !== null) {
      setChartType(newType);
    }
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        title="Gold Price (XAU/USD)"
        titleTypographyProps={{ variant: 'h6' }}
        action={
          <ToggleButtonGroup
            value={chartType}
            exclusive
            onChange={handleChartTypeChange}
            size="small"
          >
            <ToggleButton value="line">Line</ToggleButton>
            <ToggleButton value="candles" disabled={!hasOHLC}>Candles</ToggleButton>
          </ToggleButtonGroup>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        {!hasOHLC && (
          <Alert severity="info" sx={{ mb: 2 }}>
            OHLC data not available yet. Showing line chart.
          </Alert>
        )}
        {!hasVolume && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Volume data not available for XAU/USD.
          </Alert>
        )}
        <Box
          ref={chartContainerRef}
          sx={{
            width: '100%',
            height: 400,
            '& canvas': {
              borderRadius: 1,
            },
          }}
        />
      </CardContent>
    </Card>
  );
}