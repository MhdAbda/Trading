import React, { useMemo } from 'react';
import { Grid, Box, Typography } from '@mui/material';
import LatestSignalsCard from './LatestSignalsCard';
import SignalHistoryCard from './SignalHistoryCard';
import {
  analyzeLatestSignals,
  buildSignalHistory,
  getLastSignalTime,
} from '../../utils/signals';

/**
 * SignalsPanel - Main panel component for trading signals
 * Displays latest signals and signal history based on Stochastic and RSI data
 * 
 * @param {Object} props
 * @param {Array} props.stochasticData - Array of {ts, k, d} objects
 * @param {Array} props.rsiData - Array of {ts, rsi} objects
 */
export default function SignalsPanel({ stochasticData, rsiData }) {
  // Analyze latest signals from the most recent data points
  const latestSignals = useMemo(() => {
    return analyzeLatestSignals(stochasticData, rsiData);
  }, [stochasticData, rsiData]);

  // Build signal history by scanning through all data points
  const signalHistory = useMemo(() => {
    return buildSignalHistory(stochasticData, rsiData, 10);
  }, [stochasticData, rsiData]);

  // Get the time of the last signal
  const lastSignalTime = useMemo(() => {
    return getLastSignalTime(signalHistory);
  }, [signalHistory]);

  // Don't render if no data available
  if (!stochasticData || stochasticData.length < 2) {
    return (
      <Box sx={{ py: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          Waiting for indicator data to analyze signals...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        Trading Signals
      </Typography>
      <Grid container spacing={3}>
        {/* Latest Signals Card */}
        <Grid item xs={12} md={6}>
          <LatestSignalsCard
            stochasticSignal={latestSignals.stochasticSignal}
            stochasticReason={latestSignals.stochasticReason}
            confirmationSignal={latestSignals.confirmationSignal}
            confirmationReason={latestSignals.confirmationReason}
            lastSignalTime={lastSignalTime}
            currentK={latestSignals.currentK}
            currentD={latestSignals.currentD}
            currentRSI={latestSignals.currentRSI}
          />
        </Grid>

        {/* Signal History Card */}
        <Grid item xs={12} md={6}>
          <SignalHistoryCard signals={signalHistory} />
        </Grid>
      </Grid>
    </Box>
  );
}
