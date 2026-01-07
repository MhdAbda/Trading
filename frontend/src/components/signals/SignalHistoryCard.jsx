import React from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemText,
  Stack,
  Box,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

/**
 * SignalHistoryCard - Displays the last 10 trading signals
 * Shows time, type (BUY/SELL), and reason for each signal
 */
export default function SignalHistoryCard({ signals }) {
  const getSignalIcon = (type) => {
    if (type === 'BUY') {
      return <TrendingUpIcon sx={{ color: 'success.main', fontSize: 18 }} />;
    }
    return <TrendingDownIcon sx={{ color: 'error.main', fontSize: 18 }} />;
  };

  const getSignalChip = (type) => {
    return (
      <Chip
        label={type}
        color={type === 'BUY' ? 'success' : 'error'}
        size="small"
        sx={{ fontWeight: 600, minWidth: 50 }}
      />
    );
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        title="Signal History"
        titleTypographyProps={{ variant: 'h6' }}
        subheader={`Last ${signals.length} signals`}
        subheaderTypographyProps={{ variant: 'caption' }}
      />
      <CardContent sx={{ pt: 0 }}>
        {signals.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            No signals detected yet
          </Typography>
        ) : (
          <List 
            dense 
            disablePadding 
            sx={{ 
              maxHeight: 300, 
              overflow: 'auto',
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '4px',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                },
              },
              '&::-webkit-scrollbar-thumb:horizontal': {
                height: '8px',
              },
            }}
          >
            {signals.map((signal, index) => (
              <ListItem
                key={`${signal.ts}-${index}`}
                sx={{
                  py: 1,
                  px: 1,
                  borderRadius: 1,
                  mb: 0.5,
                  backgroundColor: signal.type === 'BUY' 
                    ? 'rgba(76, 175, 80, 0.08)' 
                    : 'rgba(244, 67, 54, 0.08)',
                  '&:hover': {
                    backgroundColor: signal.type === 'BUY' 
                      ? 'rgba(76, 175, 80, 0.15)' 
                      : 'rgba(244, 67, 54, 0.15)',
                  },
                }}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      {getSignalIcon(signal.type)}
                      {getSignalChip(signal.type)}
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {signal.time}
                      </Typography>
                    </Stack>
                  }
                  secondary={
                    <Typography 
                      variant="caption" 
                      color="text.secondary" 
                      sx={{ display: 'block', mt: 0.5, pl: 3.5 }}
                    >
                      {signal.reason}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
