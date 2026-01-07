/**
 * RulesManager Component
 * 
 * Main container for the Custom Trading Rules feature.
 * Manages rule creation, editing, deletion, and display.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardHeader,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Switch,
  Typography,
  Chip,
  Alert,
  Divider,
  CircularProgress
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RuleBuilder from './RuleBuilder';
import { createEmptyRule } from '../../utils/rulesEngine';

const API_URL = '/api';

export default function RulesManager({ rules, onRulesChange }) {
  const [editingRule, setEditingRule] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const getAuthToken = () => {
    return localStorage.getItem('auth_token');
  };

  const handleCreateNew = () => {
    setEditingRule(createEmptyRule());
    setIsCreating(true);
  };

  const handleEdit = (rule) => {
    setEditingRule({ ...rule });
    setIsCreating(false);
  };

  const handleSave = async (savedRule) => {
    setIsSaving(true);
    setError(null);
    
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Not authenticated. Please login.');
      }

      const url = isCreating ? `${API_URL}/rules` : `${API_URL}/rules/${savedRule.id}`;
      const method = isCreating ? 'POST' : 'PUT';

      // Transform condition field names for backend
      const backendRule = {
        ...savedRule,
        conditions: (savedRule.conditions || []).map(c => ({
          ...c,
          indicatorKey: c.indicatorKey || c.indicator_key,
          valueFrom: c.valueFrom || c.value_from,
          valueTo: c.valueTo || c.value_to,
          compareToIndicator: c.compareToIndicator || c.compare_to_indicator
        }))
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(backendRule)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `Failed to ${isCreating ? 'create' : 'update'} rule`);
      }

      const data = await res.json();
      // silent

      if (isCreating) {
        // Add new rule
        onRulesChange([...rules, data.data]);
      } else {
        // Update existing rule
        onRulesChange(rules.map(r => r.id === data.data.id ? data.data : r));
      }
      
      setEditingRule(null);
      setIsCreating(false);
    } catch (err) {
      // silent
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingRule(null);
    setIsCreating(false);
    setError(null);
  };

  const handleDelete = async (ruleId) => {
    if (!confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    setIsSaving(true);
    setError(null);
    
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Not authenticated. Please login.');
      }

      const res = await fetch(`${API_URL}/rules/${ruleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to delete rule');
      }

      // silent
      onRulesChange(rules.filter(r => r.id !== ruleId));
    } catch (err) {
      // silent
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async (ruleId) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    setIsSaving(true);
    setError(null);
    
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Not authenticated. Please login.');
      }

      const updatedRule = { ...rule, enabled: !rule.enabled };
      
      const res = await fetch(`${API_URL}/rules/${ruleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedRule)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to toggle rule');
      }

      const data = await res.json();
      // silent
      onRulesChange(rules.map(r => r.id === ruleId ? data.data : r));
    } catch (err) {
      // silent
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'BUY': return 'success';
      case 'SELL': return 'error';
      default: return 'default';
    }
  };

  // Show builder if creating or editing
  if (editingRule) {
    return (
      <RuleBuilder
        rule={editingRule}
        onSave={handleSave}
        onCancel={handleCancel}
        isSaving={isSaving}
      />
    );
  }

  return (
    <Card>
      <CardHeader
        title="Custom Trading Rules"
        titleTypographyProps={{ variant: 'h6' }}
        action={
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={handleCreateNew}
            size="small"
            disabled={isSaving}
          >
            New Rule
          </Button>
        }
      />
      <CardContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {isSaving && <CircularProgress size={24} sx={{ mr: 1 }} />}
        {rules.length === 0 ? (
          <Alert severity="info">
            No custom rules defined yet. Click "New Rule" to create your first trading rule.
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {rules.filter(r => r.enabled).length} of {rules.length} rules active
            </Typography>
            
            <List>
              {rules.map((rule, index) => (
                <React.Fragment key={rule.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    sx={{
                      opacity: rule.enabled ? 1 : 0.5,
                      '&:hover': {
                        backgroundColor: 'action.hover'
                      }
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1">
                            {rule.name}
                          </Typography>
                          <Chip
                            label={rule.action}
                            color={getActionColor(rule.action)}
                            size="small"
                          />
                          {rule.conditions.length > 1 && (
                            <Chip
                              label={rule.logic}
                              variant="outlined"
                              size="small"
                            />
                          )}
                        </Box>
                      }
                      secondary={`${rule.conditions.length} condition${rule.conditions.length !== 1 ? 's' : ''}`}
                    />
                    <ListItemSecondaryAction>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Switch
                          checked={rule.enabled}
                          onChange={() => handleToggleEnabled(rule.id)}
                          size="small"
                          disabled={isSaving}
                        />
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(rule)}
                          title="Edit"
                          disabled={isSaving}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(rule.id)}
                          color="error"
                          title="Delete"
                          disabled={isSaving}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          </>
        )}
      </CardContent>
    </Card>
  );
}
