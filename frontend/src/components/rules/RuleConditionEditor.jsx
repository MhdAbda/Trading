/**
 * RuleConditionEditor Component
 * 
 * Sub-component for editing a single rule condition.
 * Used within RuleBuilder for managing individual conditions.
 */

import React from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  IconButton,
  Grid,
  Typography
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { OPERATORS } from '../../utils/rulesEngine';
import { getAvailableIndicators } from '../../utils/indicatorRegistry';

export default function RuleConditionEditor({ condition, onChange, onDelete, index }) {
  const indicators = getAvailableIndicators();
  const operators = Object.values(OPERATORS);
  
  const selectedOperator = operators.find(op => op.key === condition.operator);

  const handleChange = (field, value) => {
    onChange({ ...condition, [field]: value });
  };

  return (
    <Box sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Condition {index + 1}
        </Typography>
        <IconButton size="small" onClick={onDelete} color="error">
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      <Grid container spacing={2}>
        {/* Indicator Selection */}
        <Grid item xs={12} md={4}>
          <FormControl fullWidth size="small">
            <InputLabel>Indicator</InputLabel>
            <Select
              value={condition.indicatorKey}
              label="Indicator"
              onChange={(e) => handleChange('indicatorKey', e.target.value)}
            >
              {indicators.map(ind => (
                <MenuItem key={ind.key} value={ind.key}>
                  {ind.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Operator Selection */}
        <Grid item xs={12} md={4}>
          <FormControl fullWidth size="small">
            <InputLabel>Operator</InputLabel>
            <Select
              value={condition.operator}
              label="Operator"
              onChange={(e) => handleChange('operator', e.target.value)}
            >
              {operators.map(op => (
                <MenuItem key={op.key} value={op.key}>
                  {op.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Value / Range / Indicator Comparison */}
        <Grid item xs={12} md={4}>
          {selectedOperator?.requiresRange ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                label="From"
                type="number"
                value={condition.valueFrom}
                onChange={(e) => handleChange('valueFrom', parseFloat(e.target.value))}
                fullWidth
              />
              <TextField
                size="small"
                label="To"
                type="number"
                value={condition.valueTo}
                onChange={(e) => handleChange('valueTo', parseFloat(e.target.value))}
                fullWidth
              />
            </Box>
          ) : selectedOperator?.requiresIndicator ? (
            <FormControl fullWidth size="small">
              <InputLabel>Compare To</InputLabel>
              <Select
                value={condition.compareToIndicator}
                label="Compare To"
                onChange={(e) => handleChange('compareToIndicator', e.target.value)}
              >
                {indicators
                  .filter(ind => ind.key !== condition.indicatorKey)
                  .map(ind => (
                    <MenuItem key={ind.key} value={ind.key}>
                      {ind.label}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          ) : selectedOperator?.requiresValue ? (
            <TextField
              size="small"
              label="Value"
              type="number"
              value={condition.value}
              onChange={(e) => handleChange('value', parseFloat(e.target.value))}
              fullWidth
            />
          ) : null}
        </Grid>

        {/* Lookback (only for historical operators) */}
        {selectedOperator?.requiresHistory && (
          <Grid item xs={12} md={4}>
            <TextField
              size="small"
              label="Lookback Periods"
              type="number"
              value={condition.lookback || 1}
              onChange={(e) => handleChange('lookback', parseInt(e.target.value))}
              fullWidth
              inputProps={{ min: 1, max: 100 }}
            />
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
