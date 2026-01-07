/**
 * CustomSignalsPanel Component
 * 
 * Displays triggered custom trading rule signals.
 * Shows currently active signals and historical signal log.
 */

import React from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Box,
  Typography,
  Chip,
  Divider,
  Alert,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import RemoveIcon from '@mui/icons-material/Remove';
import { getIndicator } from '../../utils/indicatorRegistry';
import { OPERATORS } from '../../utils/rulesEngine';

function SignalItem({ signal, showDetails = true }) {
  const getActionColor = (action) => {
    switch (action) {
      case 'BUY': return 'success';
      case 'SELL': return 'error';
      default: return 'default';
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'BUY': return <TrendingUpIcon fontSize="small" />;
      case 'SELL': return <TrendingDownIcon fontSize="small" />;
      default: return <RemoveIcon fontSize="small" />;
    }
  };

  const formatTimestamp = (ts) => {
    return new Date(ts).toLocaleTimeString();
  };

  const formatCondition = (condition) => {
    const indicator = getIndicator(condition.indicatorKey);
    const operator = Object.values(OPERATORS).find(op => op.key === condition.operator);
    
    let valueStr = '';
    if (operator?.requiresRange) {
      valueStr = `${condition.valueFrom} - ${condition.valueTo}`;
    } else if (operator?.requiresIndicator) {
      const compareInd = getIndicator(condition.compareToIndicator);
      valueStr = compareInd?.label || condition.compareToIndicator;
    } else if (operator?.requiresValue) {
      valueStr = condition.value;
    }

    return `${indicator?.label || condition.indicatorKey} ${operator?.label || condition.operator} ${valueStr}`;
  };

  return (
    <Box
      sx={{
        p: 2,
        mb: 1,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        borderLeft: '4px solid',
        borderLeftColor: getActionColor(signal.action) + '.main'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle2" fontWeight="bold">
            {signal.rule.name}
          </Typography>
          <Chip
            icon={getActionIcon(signal.action)}
            label={signal.action}
            color={getActionColor(signal.action)}
            size="small"
          />
        </Box>
        <Typography variant="caption" color="text.secondary">
          {formatTimestamp(signal.timestamp)}
        </Typography>
      </Box>

      {showDetails && signal.matchedConditions && signal.matchedConditions.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
            Matched Conditions:
          </Typography>
          {signal.matchedConditions.map((condition, idx) => (
            <Typography key={idx} variant="caption" display="block" sx={{ pl: 1 }}>
              • {formatCondition(condition)}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}

export default function CustomSignalsPanel({ triggeredSignals, signalHistory, onClearHistory }) {
  return (
    <Card>
      <CardHeader
        title="Custom Trading Signals"
        titleTypographyProps={{ variant: 'h6' }}
      />
      <CardContent>
        {/* Currently Active Signals */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Active Signals
          </Typography>
          {triggeredSignals.length === 0 ? (
            <Alert severity="info">
              No active signals. Rules will be evaluated as new data arrives.
            </Alert>
          ) : (
            triggeredSignals.map((signal, idx) => (
              <SignalItem key={idx} signal={signal} showDetails={true} />
            ))
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Signal History */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Signal History ({signalHistory.length})
            </Typography>
            {signalHistory.length > 0 && (
              <IconButton size="small" onClick={onClearHistory} title="Clear History">
                <ClearIcon fontSize="small" />
              </IconButton>
            )}
          </Box>

          {signalHistory.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No signal history yet.
            </Typography>
          ) : (
            <Accordion defaultExpanded={false}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="body2">
                  View All Signals
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
                  {signalHistory.map((signal) => (
                    <SignalItem key={signal.id} signal={signal} showDetails={false} />
                  ))}
                </Box>
              </AccordionDetails>
            </Accordion>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
