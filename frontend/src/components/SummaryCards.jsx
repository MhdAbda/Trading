import React from 'react';
import { Grid, Card, CardContent, Typography, Box, Skeleton } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import EqualizerIcon from '@mui/icons-material/Equalizer';

function StatCard({ title, value, subtitle, icon, color, isLoading }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            {isLoading ? (
              <Skeleton width={80} height={32} />
            ) : (
              <Typography variant="h5" sx={{ fontWeight: 700, color }}>
                {value}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              backgroundColor: color ? `${color}20` : 'action.hover',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function SummaryCards({ latestPrice, latestRSI, latestMACD, latestStochastic, isLoading }) {
  // Determine RSI color and interpretation
  const getRSIColor = (rsi) => {
    if (!rsi) return 'text.primary';
    if (rsi > 70) return '#f44336'; // Overbought
    if (rsi < 30) return '#4caf50'; // Oversold
    return '#ff9800'; // Neutral
  };

  const getRSILabel = (rsi) => {
    if (!rsi) return '';
    if (rsi > 70) return 'Overbought';
    if (rsi < 30) return 'Oversold';
    return 'Neutral';
  };

  // Determine MACD trend
  const getMACDColor = (macd) => {
    if (!macd) return 'text.primary';
    return macd.histogram > 0 ? '#4caf50' : '#f44336';
  };

  const getMACDLabel = (macd) => {
    if (!macd) return '';
    return macd.histogram > 0 ? 'Bullish' : 'Bearish';
  };

  // Stochastic interpretation
  const getStochColor = (stoch) => {
    if (!stoch) return 'text.primary';
    if (stoch.k > 80) return '#f44336';
    if (stoch.k < 20) return '#4caf50';
    return '#ff9800';
  };

  const getStochLabel = (stoch) => {
    if (!stoch) return '';
    if (stoch.k > 80) return 'Overbought';
    if (stoch.k < 20) return 'Oversold';
    return 'Neutral';
  };

  return (
    <Grid container spacing={2}>
      {/* Price Card */}
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Gold Price (XAU/USD)"
          value={latestPrice ? `$${latestPrice.toFixed(2)}` : '—'}
          icon={<ShowChartIcon sx={{ color: '#FFD700' }} />}
          color="#FFD700"
          isLoading={isLoading}
        />
      </Grid>

      {/* RSI Card */}
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="RSI (14)"
          value={latestRSI ? latestRSI.toFixed(2) : '—'}
          subtitle={getRSILabel(latestRSI)}
          icon={
            latestRSI > 50 ? (
              <TrendingUpIcon sx={{ color: getRSIColor(latestRSI) }} />
            ) : (
              <TrendingDownIcon sx={{ color: getRSIColor(latestRSI) }} />
            )
          }
          color={getRSIColor(latestRSI)}
          isLoading={isLoading}
        />
      </Grid>

      {/* MACD Card */}
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="MACD"
          value={latestMACD ? latestMACD.macd.toFixed(4) : '—'}
          subtitle={getMACDLabel(latestMACD)}
          icon={<EqualizerIcon sx={{ color: getMACDColor(latestMACD) }} />}
          color={getMACDColor(latestMACD)}
          isLoading={isLoading}
        />
      </Grid>

      {/* Stochastic Card */}
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Stochastic %K"
          value={latestStochastic ? latestStochastic.k.toFixed(2) : '—'}
          subtitle={getStochLabel(latestStochastic)}
          icon={
            latestStochastic && latestStochastic.k > 50 ? (
              <TrendingUpIcon sx={{ color: getStochColor(latestStochastic) }} />
            ) : (
              <TrendingDownIcon sx={{ color: getStochColor(latestStochastic) }} />
            )
          }
          color={getStochColor(latestStochastic)}
          isLoading={isLoading}
        />
      </Grid>
    </Grid>
  );
}
