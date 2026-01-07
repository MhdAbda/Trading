import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';

export default function MACDSettings({ settings, onChange }) {
  const handleNumberChange = (key) => (event) => {
    const next = Number(event.target.value);
    if (Number.isNaN(next) || next <= 0) return;
    onChange({ ...settings, [key]: next });
  };

  const handleSelectChange = (key) => (event) => {
    onChange({ ...settings, [key]: event.target.value });
  };

  return (
    <Card variant="outlined" sx={{ minWidth: 280 }}>
      <CardContent sx={{ pt: 1.5, pb: 1.5 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          MACD Settings
        </Typography>
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={4}>
            <TextField
              label="Fast"
              type="number"
              size="small"
              value={settings.fastLength}
              onChange={handleNumberChange('fastLength')}
              inputProps={{ min: 1 }}
              fullWidth
            />
          </Grid>
          <Grid item xs={4}>
            <TextField
              label="Slow"
              type="number"
              size="small"
              value={settings.slowLength}
              onChange={handleNumberChange('slowLength')}
              inputProps={{ min: 2 }}
              fullWidth
            />
          </Grid>
          <Grid item xs={4}>
            <TextField
              label="Signal"
              type="number"
              size="small"
              value={settings.signalLength}
              onChange={handleNumberChange('signalLength')}
              inputProps={{ min: 1 }}
              fullWidth
            />
          </Grid>
          <Grid item xs={6}>
            <FormControl size="small" fullWidth>
              <InputLabel id="macd-oscillator-type-label">Oscillator MA</InputLabel>
              <Select
                labelId="macd-oscillator-type-label"
                value={settings.oscillatorMAType}
                label="Oscillator MA"
                onChange={handleSelectChange('oscillatorMAType')}
              >
                <MenuItem value="EMA">EMA</MenuItem>
                <MenuItem value="SMA">SMA</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <FormControl size="small" fullWidth>
              <InputLabel id="macd-signal-type-label">Signal MA</InputLabel>
              <Select
                labelId="macd-signal-type-label"
                value={settings.signalMAType}
                label="Signal MA"
                onChange={handleSelectChange('signalMAType')}
              >
                <MenuItem value="EMA">EMA</MenuItem>
                <MenuItem value="SMA">SMA</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
