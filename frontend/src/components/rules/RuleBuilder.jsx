/**
 * RuleBuilder Component
 * 
 * UI for creating and editing custom trading rules.
 * Allows adding multiple conditions with AND/OR logic.
 */

import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Typography,
  Alert,
  Paper,
  Divider,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import RuleConditionEditor from './RuleConditionEditor';
import { createEmptyCondition, validateRule } from '../../utils/rulesEngine';

export default function RuleBuilder({ rule, onSave, onCancel }) {
  const [editedRule, setEditedRule] = useState(rule);
  const [validationErrors, setValidationErrors] = useState([]);

  const handleRuleChange = (field, value) => {
    setEditedRule(prev => ({ ...prev, [field]: value }));
    setValidationErrors([]); // Clear errors on change
  };

  const handleConditionChange = (index, updatedCondition) => {
    const updatedConditions = [...editedRule.conditions];
    updatedConditions[index] = updatedCondition;
    setEditedRule(prev => ({ ...prev, conditions: updatedConditions }));
  };

  const handleAddCondition = () => {
    setEditedRule(prev => ({
      ...prev,
      conditions: [...prev.conditions, createEmptyCondition()]
    }));
  };

  const handleDeleteCondition = (index) => {
    setEditedRule(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index)
    }));
  };

  const handleSave = () => {
    const validation = validateRule(editedRule);
    
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    onSave(editedRule);
  };

  return (
    <Paper sx={{ p: 3, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        {rule.name ? 'Edit Rule' : 'New Rule'}
      </Typography>

      {validationErrors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight="bold">Validation Errors:</Typography>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {validationErrors.map((error, idx) => (
              <li key={idx}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Rule Name */}
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          label="Rule Name"
          value={editedRule.name}
          onChange={(e) => handleRuleChange('name', e.target.value)}
          placeholder="e.g., RSI Oversold with MACD Bullish"
        />
      </Box>

      {/* Enabled Toggle */}
      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={editedRule.enabled}
              onChange={(e) => handleRuleChange('enabled', e.target.checked)}
            />
          }
          label="Rule Enabled"
        />
      </Box>

      {/* Action Selection */}
      <Box sx={{ mb: 2 }}>
        <FormControl fullWidth>
          <InputLabel>Action</InputLabel>
          <Select
            value={editedRule.action}
            label="Action"
            onChange={(e) => handleRuleChange('action', e.target.value)}
          >
            <MenuItem value="BUY">BUY</MenuItem>
            <MenuItem value="SELL">SELL</MenuItem>
            <MenuItem value="NEUTRAL">NEUTRAL</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Logic Selection (AND/OR) */}
      {editedRule.conditions.length > 1 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Condition Logic
          </Typography>
          <ToggleButtonGroup
            value={editedRule.logic}
            exclusive
            onChange={(e, value) => value && handleRuleChange('logic', value)}
            size="small"
          >
            <ToggleButton value="AND">AND (All must match)</ToggleButton>
            <ToggleButton value="OR">OR (Any must match)</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Conditions */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Conditions
        </Typography>
        
        {editedRule.conditions.length === 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Add at least one condition to define when this rule should trigger.
          </Alert>
        )}

        {editedRule.conditions.map((condition, index) => (
          <RuleConditionEditor
            key={condition.id}
            condition={condition}
            index={index}
            onChange={(updated) => handleConditionChange(index, updated)}
            onDelete={() => handleDeleteCondition(index)}
          />
        ))}

        <Button
          startIcon={<AddIcon />}
          onClick={handleAddCondition}
          variant="outlined"
          fullWidth
        >
          Add Condition
        </Button>
      </Box>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          startIcon={<CancelIcon />}
          onClick={onCancel}
          variant="outlined"
        >
          Cancel
        </Button>
        <Button
          startIcon={<SaveIcon />}
          onClick={handleSave}
          variant="contained"
          color="primary"
        >
          Save Rule
        </Button>
      </Box>
    </Paper>
  );
}
