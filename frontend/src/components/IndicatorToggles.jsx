import React from 'react';
import { FormGroup, FormControlLabel, Checkbox, Box, Typography } from '@mui/material';

const INDICATORS = [
  { key: 'rsi', label: 'RSI' },
  { key: 'macd', label: 'MACD' },
  { key: 'stochastic', label: 'Stochastic' },
  { key: 'bollinger_bands', label: 'Bollinger Bands' },
];

export default function IndicatorToggles({ visibleIndicators, onChange }) {
  const handleToggle = (key) => {
    const newVisible = { ...visibleIndicators, [key]: !visibleIndicators[key] };
    onChange(newVisible);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
        Indicators:
      </Typography>
      <FormGroup row>
        {INDICATORS.map((ind) => (
          <FormControlLabel
            key={ind.key}
            control={
              <Checkbox
                checked={visibleIndicators[ind.key]}
                onChange={() => handleToggle(ind.key)}
                size="small"
              />
            }
            label={ind.label}
            sx={{ mr: 2 }}
          />
        ))}
      </FormGroup>
    </Box>
  );
}
