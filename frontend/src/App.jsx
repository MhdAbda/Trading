import React, { useState, useMemo, useEffect } from 'react';
import {
  ThemeProvider,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  IconButton,
  Paper,
  Grid,
  Divider,
  Button,
  Menu,
  MenuItem,
  Avatar,
  Chip
} from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';

import { getTheme } from './theme';
import { useDataFeed } from './hooks/useDataFeed';
import { getTimeRangeMs } from './utils/time';

import TimeRangeSelector from './components/TimeRangeSelector';
import IndicatorToggles from './components/IndicatorToggles';
import SummaryCards from './components/SummaryCards';
import ConnectionStatus from './components/ConnectionStatus';
import PriceChart from './components/charts/PriceChart';
import RSIChart from './components/charts/RSIChart';
import MACDChart from './components/charts/MACDChart';
import StochasticChart from './components/charts/StochasticChart';
import BollingerBandsChart from './components/charts/BollingerBandsChart';
import OHLCChart from './components/charts/OHLCChart';
import SignalsPanel from './components/signals/SignalsPanel';
import RulesManager from './components/rules/RulesManager';
import CustomSignalsPanel from './components/rules/CustomSignalsPanel';
import { useRuleEvaluator } from './hooks/useRuleEvaluator';
import SettingsDropdown from './components/SettingsDropdown';
import LoginDialog from './components/LoginDialog';

function App() {
  // Theme state
  const [mode, setMode] = useState('dark');
  const theme = useMemo(() => getTheme(mode), [mode]);

  // Auth state
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);

  // UI state
  const [timeRange, setTimeRange] = useState('all');
  const [selectedDay, setSelectedDay] = useState(() => {
    // Default to today at midnight in local timezone
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    return startOfToday.getTime();
  });
  const [visibleIndicators, setVisibleIndicators] = useState({
    rsi: true,
    macd: true,
    stochastic: true,
    bollinger_bands: true,
  });

  const [macdSettings, setMacdSettings] = useState(() => {
    const defaults = {
      fastLength: 12,
      slowLength: 26,
      signalLength: 9,
      oscillatorMAType: 'EMA',
      signalMAType: 'EMA',
      source: 'price',
    };
    try {
      const saved = localStorage.getItem('trading_bot_macd_settings');
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch (err) {
      console.error('Failed to load MACD settings from localStorage:', err);
      return defaults;
    }
  });

  // Custom Trading Rules state
  const [customRules, setCustomRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const apiUrl = '/api';

  // Auth handlers
  const handleLoginSuccess = (userData) => {
    setUser(userData);
    // Reload rules after login
    loadRules();
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setUser(null);
    setCustomRules([]);
    setUserMenuAnchor(null);
    console.log('[Auth] Logged out');
  };

  const handleUserMenuOpen = (event) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  // Load rules from backend
  const loadRules = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.log('[Rules] No auth token, using empty rules');
        setRulesLoading(false);
        return;
      }

      const res = await fetch(`${apiUrl}/rules`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        console.log('[Rules] Loaded from backend:', data.data);
        
        // Transform backend field names (snake_case) to frontend format (camelCase)
        const normalizedRules = (data.data || []).map(rule => ({
          ...rule,
          conditions: (rule.conditions || []).map(c => ({
            ...c,
            indicatorKey: c.indicatorKey || c.indicator_key,
            valueFrom: c.valueFrom || c.value_from,
            valueTo: c.valueTo || c.value_to,
            compareToIndicator: c.compareToIndicator || c.compare_to_indicator
          }))
        }));
        
        setCustomRules(normalizedRules);
      } else if (res.status === 401) {
        console.log('[Rules] Unauthorized, showing login dialog');
        setShowLoginDialog(true);
      } else {
        console.warn('[Rules] Failed to load from backend:', res.status);
      }
    } catch (err) {
      console.error('[Rules] Failed to load from backend:', err.message);
    } finally {
      setRulesLoading(false);
    }
  };

  // Load rules from backend on mount
  useEffect(() => {
    loadRules();
  }, []);

  // Save/sync rules to backend when they change
  useEffect(() => {
    if (rulesLoading) return; // Don't sync while loading

    const syncRules = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;

        // This is a simplified approach - in production, you'd track which rules changed
        // and only sync those. For now, we'll just log that changes were made.
        console.log('[Rules] Rules changed, would sync to backend:', customRules);
      } catch (err) {
        console.error('[Rules] Failed to sync rules:', err.message);
      }
    };

    // Debounce the sync to avoid too many requests
    const timer = setTimeout(syncRules, 1000);
    return () => clearTimeout(timer);
  }, [customRules, rulesLoading]);

  // Persist MACD settings
  useEffect(() => {
    try {
      localStorage.setItem('trading_bot_macd_settings', JSON.stringify(macdSettings));
    } catch (err) {
      console.error('Failed to save MACD settings to localStorage:', err);
    }
  }, [macdSettings]);

  // Data feed
  const {
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
  } = useDataFeed(timeRange, selectedDay, macdSettings);

  // Fetch historical OHLC data on mount
  useEffect(() => {
    fetchHistoricalData({ interval: '1min', days: 7 })
      .catch(err => {
        console.error('[App] Historical OHLC fetch error:', err.message || err);
      });
  }, [fetchHistoricalData]);

  // Filter data by selected time range
  const rangeMs = getTimeRangeMs(timeRange);
  const filteredPriceData = useMemo(() => {
    if (timeRange === 'all') {
      const dayStart = selectedDay;
      const dayEnd = selectedDay + 24 * 60 * 60 * 1000;
      return priceData.filter(d => d.ts >= dayStart && d.ts < dayEnd);
    }
    return getFilteredData(priceData, rangeMs);
  }, [priceData, rangeMs, getFilteredData, timeRange, selectedDay]);
  const filteredRsiData = useMemo(() => {
    if (timeRange === 'all') {
      const dayStart = selectedDay;
      const dayEnd = selectedDay + 24 * 60 * 60 * 1000;
      const filtered = rsiData.filter(d => d.ts >= dayStart && d.ts < dayEnd);
      console.log(`[App] RSI filter: timeRange=${timeRange}, dayStart=${new Date(dayStart).toISOString()}, dayEnd=${new Date(dayEnd).toISOString()}, input=${rsiData.length}, output=${filtered.length}`);
      if (rsiData.length > 0) {
        console.log(`[App] RSI sample timestamps: first=${new Date(rsiData[0].ts).toISOString()}, last=${new Date(rsiData[rsiData.length - 1].ts).toISOString()}`);
      }
      return filtered;
    }
    return getFilteredData(rsiData, rangeMs);
  }, [rsiData, rangeMs, getFilteredData, timeRange, selectedDay]);
  const filteredMacdData = useMemo(() => {
    if (timeRange === 'all') {
      const dayStart = selectedDay;
      const dayEnd = selectedDay + 24 * 60 * 60 * 1000;
      return macdData.filter(d => d.ts >= dayStart && d.ts < dayEnd);
    }
    return getFilteredData(macdData, rangeMs);
  }, [macdData, rangeMs, getFilteredData, timeRange, selectedDay]);
  const filteredStochasticData = useMemo(() => {
    if (timeRange === 'all') {
      const dayStart = selectedDay;
      const dayEnd = selectedDay + 24 * 60 * 60 * 1000;
      return stochasticData.filter(d => d.ts >= dayStart && d.ts < dayEnd);
    }
    return getFilteredData(stochasticData, rangeMs);
  }, [stochasticData, rangeMs, getFilteredData, timeRange, selectedDay]);

  const filteredBollingerBandsData = useMemo(() => {
    if (timeRange === 'all') {
      const dayStart = selectedDay;
      const dayEnd = selectedDay + 24 * 60 * 60 * 1000;
      return bollingerBandsData.filter(d => d.ts >= dayStart && d.ts < dayEnd);
    }
    return getFilteredData(bollingerBandsData, rangeMs);
  }, [bollingerBandsData, rangeMs, getFilteredData, timeRange, selectedDay]);
  const filteredOhlcData = useMemo(() => {
    if (timeRange === 'all') {
      const dayStart = selectedDay;
      const dayEnd = selectedDay + 24 * 60 * 60 * 1000;
      return ohlcData.filter(d => d.ts >= dayStart && d.ts < dayEnd);
    }
    return getFilteredData(ohlcData, rangeMs);
  }, [ohlcData, rangeMs, getFilteredData, timeRange, selectedDay]);

  // Evaluate custom trading rules (after filtered data is computed)
  const { triggeredSignals, signalHistory, clearHistory } = useRuleEvaluator(
    customRules,
    {
      priceData: filteredPriceData,
      rsiData: filteredRsiData,
      macdData: filteredMacdData,
      stochasticData: filteredStochasticData,
      bollingerBandsData: filteredBollingerBandsData
    }
  );

  const toggleTheme = () => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const isLoading = priceData.length === 0;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* App Bar */}
        <AppBar position="static" color="default" elevation={0}>
          <Toolbar>
            <ShowChartIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
              Gold Trading Dashboard
            </Typography>
            <ConnectionStatus status={connectionStatus} />
            <SettingsDropdown 
              macdSettings={macdSettings} 
              onMacdSettingsChange={setMacdSettings} 
            />
            <IconButton onClick={toggleTheme} sx={{ ml: 2 }}>
              {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
            
            {/* Auth Button/Menu */}
            {user ? (
              <>
                <Button
                  onClick={handleUserMenuOpen}
                  startIcon={<AccountCircleIcon />}
                  sx={{ ml: 2 }}
                  color="inherit"
                >
                  {user.username}
                </Button>
                <Menu
                  anchorEl={userMenuAnchor}
                  open={Boolean(userMenuAnchor)}
                  onClose={handleUserMenuClose}
                >
                  <MenuItem disabled>
                    <Typography variant="body2" color="text.secondary">
                      {user.email}
                    </Typography>
                  </MenuItem>
                  <Divider />
                  <MenuItem onClick={handleLogout}>
                    <LogoutIcon sx={{ mr: 1 }} fontSize="small" />
                    Logout
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <Button
                onClick={() => setShowLoginDialog(true)}
                startIcon={<LoginIcon />}
                sx={{ ml: 2 }}
                color="primary"
                variant="contained"
              >
                Login
              </Button>
            )}
          </Toolbar>
        </AppBar>

        {/* Main Content */}
        <Container maxWidth="xl" sx={{ py: 3, flexGrow: 1 }}>
          {/* Controls */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 3,
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <TimeRangeSelector 
                value={timeRange} 
                onChange={setTimeRange}
                selectedDay={selectedDay}
                onDayChange={setSelectedDay}
              />
              <IndicatorToggles
                visibleIndicators={visibleIndicators}
                onChange={setVisibleIndicators}
              />
              {lastUpdate && (
                <Typography variant="caption" color="text.secondary">
                  Last update: {lastUpdate.toLocaleTimeString()}
                </Typography>
              )}
            </Box>
          </Paper>

          {/* Summary Cards */}
          <Box sx={{ mb: 3 }}>
            <SummaryCards
              latestPrice={getLatestPrice()}
              latestRSI={getLatestRSI()}
              latestMACD={getLatestMACD()}
              latestStochastic={getLatestStochastic()}
              isLoading={isLoading}
            />
          </Box>

          {/* Charts */}
          <Grid container spacing={3}>
            {/* Price Chart - Always visible, full width */}
            <Grid item xs={12}>
              <PriceChart data={filteredPriceData} syncId="charts" timeRange={timeRange} />
            </Grid>

            {/* OHLC Chart */}
            <Grid item xs={12}>
              <OHLCChart data={filteredOhlcData} />
            </Grid>

            {/* Indicator Charts - Conditionally visible */}
            {visibleIndicators.rsi && (
              <Grid item xs={12} lg={visibleIndicators.macd || visibleIndicators.stochastic ? 6 : 12}>
                <RSIChart data={filteredRsiData} syncId="charts" timeRange={timeRange} />
              </Grid>
            )}

            {visibleIndicators.macd && (
              <Grid item xs={12} lg={visibleIndicators.rsi || visibleIndicators.stochastic ? 6 : 12}>
                <MACDChart data={filteredMacdData} syncId="charts" timeRange={timeRange} settings={macdSettings} />
              </Grid>
            )}

            {visibleIndicators.stochastic && (
              <Grid item xs={12} lg={visibleIndicators.rsi || visibleIndicators.macd ? 6 : 12}>
                <StochasticChart data={filteredStochasticData} syncId="charts" timeRange={timeRange} />
              </Grid>
            )}

            {visibleIndicators.bollinger_bands && (
              <Grid item xs={12} lg={visibleIndicators.rsi || visibleIndicators.macd ? 6 : 12}>
                <BollingerBandsChart data={filteredBollingerBandsData} syncId="charts" timeRange={timeRange} />
              </Grid>
            )}
          </Grid>

          {/* Trading Signals Panel - Hidden (using Custom Signals instead) */}
          {/* <SignalsPanel
            stochasticData={filteredStochasticData}
            rsiData={filteredRsiData}
          /> */}

          {/* Custom Trading Rules Section */}
          <Box sx={{ mt: 3 }}>
            <Grid container spacing={3}>
              {/* Rules Manager */}
              <Grid item xs={12} lg={6}>
                <RulesManager
                  rules={customRules}
                  onRulesChange={setCustomRules}
                />
              </Grid>

              {/* Custom Signals Panel */}
              <Grid item xs={12} lg={6}>
                <CustomSignalsPanel
                  triggeredSignals={triggeredSignals}
                  signalHistory={signalHistory}
                  onClearHistory={clearHistory}
                />
              </Grid>
            </Grid>
          </Box>
        </Container>

        {/* Footer */}
        <Box
          component="footer"
          sx={{
            py: 2,
            px: 2,
            mt: 'auto',
            backgroundColor: 'background.paper',
          }}
        >
          <Divider sx={{ mb: 2 }} />
          <Typography variant="body2" color="text.secondary" align="center">
            Gold Trading Bot Dashboard • Data updates every minute • {priceData.length} data points in buffer
          </Typography>
        </Box>
      </Box>

      {/* Login Dialog */}
      <LoginDialog
        open={showLoginDialog}
        onClose={() => setShowLoginDialog(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </ThemeProvider>
  );
}

export default App;
