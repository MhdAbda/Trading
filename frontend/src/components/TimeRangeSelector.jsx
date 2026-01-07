import React from 'react';
import { ToggleButton, ToggleButtonGroup, Box, Typography, IconButton } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const TIME_RANGES = [
  { value: '30m', label: '30m' },
  { value: '1h', label: '1h' },
  { value: '3h', label: '3h' },
  { value: '6h', label: '6h' },
  { value: '12h', label: '12h' },
  { value: '24h', label: '24h' },
  { value: 'all', label: 'All time' },
];

export default function TimeRangeSelector({ value, onChange, selectedDay, onDayChange }) {
  const isAllTime = value === 'all';

  const handlePreviousDay = () => {
    if (onDayChange && selectedDay) {
      const prevDay = new Date(selectedDay);
      prevDay.setDate(prevDay.getDate() - 1); // Use local timezone instead of UTC
      onDayChange(prevDay.getTime());
    }
  };

  const handleNextDay = () => {
    if (onDayChange && selectedDay) {
      const nextDay = new Date(selectedDay);
      nextDay.setDate(nextDay.getDate() + 1); // Use local timezone instead of UTC
      // Don't allow navigating to future days
      if (nextDay.getTime() <= Date.now()) {
        onDayChange(nextDay.getTime());
      }
    }
  };

  const formatDay = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
        Time Range:
      </Typography>
      <ToggleButtonGroup
        value={value}
        exclusive
        onChange={(e, newValue) => {
          if (newValue !== null) onChange(newValue);
        }}
        size="small"
        sx={{
          '& .MuiToggleButton-root': {
            px: 2,
            py: 0.5,
            textTransform: 'none',
            fontWeight: 500,
          },
        }}
      >
        {TIME_RANGES.map((range) => (
          <ToggleButton key={range.value} value={range.value}>
            {range.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {isAllTime && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={handlePreviousDay}>
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="body2" sx={{ minWidth: 100, textAlign: 'center' }}>
            {formatDay(selectedDay)}
          </Typography>
          <IconButton size="small" onClick={handleNextDay}>
            <ChevronRightIcon />
          </IconButton>
        </Box>
      )}
    </Box>
  );
}
