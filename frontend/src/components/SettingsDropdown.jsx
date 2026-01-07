import React, { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import MACDSettings from './MACDSettings';

export default function SettingsDropdown({ macdSettings, onMacdSettingsChange }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [macdDialogOpen, setMacdDialogOpen] = useState(false);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMacdSettingsClick = () => {
    setMacdDialogOpen(true);
    handleClose();
  };

  const handleMacdDialogClose = () => {
    setMacdDialogOpen(false);
  };

  return (
    <>
      <IconButton
        onClick={handleClick}
        sx={{ ml: 1 }}
        aria-label="settings"
        aria-controls={open ? 'settings-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
      >
        <SettingsIcon />
      </IconButton>

      <Menu
        id="settings-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'settings-button',
        }}
      >
        <MenuItem onClick={handleMacdSettingsClick}>
          <ListItemIcon>
            <ShowChartIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>MACD Settings</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog 
        open={macdDialogOpen} 
        onClose={handleMacdDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>MACD Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <MACDSettings 
              settings={macdSettings} 
              onChange={onMacdSettingsChange} 
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleMacdDialogClose} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
