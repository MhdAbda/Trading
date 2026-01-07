import { createTheme } from '@mui/material/styles';

export const getTheme = (mode) =>
  createTheme({
    palette: {
      mode,
      ...(mode === 'dark'
        ? {
            primary: { main: '#FFD700' },
            secondary: { main: '#90caf9' },
            background: {
              default: '#1a1625',
              paper: '#2a2335',
            },
            success: { main: '#4caf50' },
            error: { main: '#f44336' },
            warning: { main: '#ff9800' },
          }
        : {
            primary: { main: '#1976d2' },
            secondary: { main: '#9c27b0' },
            background: {
              default: '#f5f5f5',
              paper: '#ffffff',
            },
          }),
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h4: { fontWeight: 700 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
    },
  });
