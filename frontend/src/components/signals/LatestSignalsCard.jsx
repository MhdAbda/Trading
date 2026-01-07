import React from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Chip,
  Stack,
  Divider,
  Box,
  Alert,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import RemoveIcon from '@mui/icons-material/Remove';

/**
 * LatestSignalsCard - Displays the current signal status
 * Shows stochastic crossover signals and RSI+Stochastic confirmation
 */
export default function LatestSignalsCard({
  stochasticSignal,
  stochasticReason,
  confirmationSignal,
  confirmationReason,
  lastSignalTime,
  currentK,
  currentD,
  currentRSI,
}) {
  const getSignalChip = (signal) => {
    if (signal === 'BUY') {
      return (
        <Chip
          icon={<TrendingUpIcon />}
          label="BUY"
          color="success"
          size="small"
          sx={{ fontWeight: 700 }}
        />
      );
    }
    if (signal === 'SELL') {
      return (
        <Chip
          icon={<TrendingDownIcon />}
          label="SELL"
          color="error"
          size="small"
          sx={{ fontWeight: 700 }}
        />
      );
    }
    return (
      <Chip
        icon={<RemoveIcon />}
        label="NEUTRAL"
        color="default"
        size="small"
        variant="outlined"
      />
    );
  };

  const getAlertSeverity = (signal) => {
    if (signal === 'BUY') return 'success';
    if (signal === 'SELL') return 'error';
    return 'info';
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        title="Latest Signals"
        titleTypographyProps={{ variant: 'h6' }}
        subheader={lastSignalTime ? `Last signal: ${lastSignalTime}` : 'No recent signals'}
        subheaderTypographyProps={{ variant: 'caption' }}
      />
      <CardContent sx={{ pt: 0 }}>
        <Stack spacing={2}>
          {/* Current Indicator Values */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              %K: <strong>{currentK !== null ? currentK.toFixed(2) : '—'}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              %D: <strong>{currentD !== null ? currentD.toFixed(2) : '—'}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              RSI: <strong>{currentRSI !== null ? currentRSI.toFixed(2) : '—'}</strong>
            </Typography>
          </Box>

          <Divider />

          {/* Stochastic Crossover Signal */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Stochastic Crossover:
              </Typography>
              {getSignalChip(stochasticSignal)}
            </Stack>
            <Alert 
              severity={getAlertSeverity(stochasticSignal)} 
              variant="outlined"
              sx={{ py: 0.5 }}
            >
              <Typography variant="body2">{stochasticReason}</Typography>
            </Alert>
          </Box>

          <Divider />

          {/* RSI + Stochastic Confirmation */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                RSI + Stochastic Confirmation:
              </Typography>
              {getSignalChip(confirmationSignal)}
            </Stack>
            <Alert 
              severity={getAlertSeverity(confirmationSignal)} 
              variant="outlined"
              sx={{ py: 0.5 }}
            >
              <Typography variant="body2">{confirmationReason}</Typography>
            </Alert>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
