import React from 'react';
import { Chip } from '@mui/material';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import SyncIcon from '@mui/icons-material/Sync';

export default function ConnectionStatus({ status }) {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          label: 'Connected',
          color: 'success',
          icon: <WifiIcon />,
        };
      case 'reconnecting':
        return {
          label: 'Reconnecting...',
          color: 'warning',
          icon: <SyncIcon sx={{ animation: 'spin 1s linear infinite' }} />,
        };
      case 'disconnected':
      default:
        return {
          label: 'Disconnected',
          color: 'error',
          icon: <WifiOffIcon />,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Chip
      icon={config.icon}
      label={config.label}
      color={config.color}
      size="small"
      variant="outlined"
      sx={{
        '@keyframes spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      }}
    />
  );
}
