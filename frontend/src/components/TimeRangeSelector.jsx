import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

export default function TimeRangeSelector({ value, onChange, selectedDay, onDayChange }) {

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
        Day:
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton size="small" onClick={handlePreviousDay}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="body2" sx={{ minWidth: 120, textAlign: 'center' }}>
          {formatDay(selectedDay)}
        </Typography>
        <IconButton size="small" onClick={handleNextDay}>
          <ChevronRightIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
