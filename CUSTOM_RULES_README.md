# Custom Trading Rules Module

## Overview

The Custom Trading Rules module allows users to define and manage their own trading rules based on technical indicator behavior. Rules are evaluated automatically as new data arrives, with triggered signals displayed in real-time.

## Architecture

### Core Components

#### 1. **Rules Engine** (`utils/rulesEngine.js`)
Pure JavaScript logic for evaluating trading rules. No dependencies on React or UI.

**Key Features:**
- Generic operator system supporting 13+ operators
- Multi-condition logic (AND/OR)
- Trend analysis (increasing, decreasing, flat)
- Crossover detection (value and indicator-to-indicator)
- Lookback period support
- Rule validation

**Supported Operators:**
- `>`, `<`, `>=`, `<=`, `=` - Basic comparisons
- `BETWEEN` - Range checks
- `CROSSES_ABOVE`, `CROSSES_BELOW` - Value crossovers
- `CROSSES_ABOVE_IND`, `CROSSES_BELOW_IND` - Indicator crossovers (e.g., MACD crosses Signal)
- `INCREASING`, `DECREASING`, `FLAT` - Trend detection

#### 2. **Indicator Registry** (`utils/indicatorRegistry.js`)
Data-driven configuration for all available indicators.

**Current Indicators:**
- Price (Gold XAU/USD)
- RSI
- MACD (Line, Signal, Histogram)
- Stochastic (%K, %D)

**Adding New Indicators:**
Simply add to `INDICATOR_REGISTRY` object:
```javascript
NEW_INDICATOR: {
  key: 'NEW_INDICATOR',
  label: 'Display Name',
  dataKey: 'dataFieldName',
  unit: '$',
  description: 'Indicator description'
}
```

#### 3. **Rule Evaluator Hook** (`hooks/useRuleEvaluator.js`)
React hook that:
- Watches for indicator data changes
- Evaluates all active rules automatically
- Maintains triggered signal history
- Provides real-time and historical signal data

#### 4. **UI Components** (`components/rules/`)

**RulesManager.jsx**
- List view of all rules
- Enable/disable toggle per rule
- Edit and delete actions
- Create new rule button

**RuleBuilder.jsx**
- Form for creating/editing rules
- Rule name, action (BUY/SELL/NEUTRAL)
- Multi-condition support with AND/OR logic
- Real-time validation

**RuleConditionEditor.jsx**
- Sub-component for editing individual conditions
- Dynamic form fields based on selected operator
- Indicator selection
- Value/range inputs

**CustomSignalsPanel.jsx**
- Displays currently triggered signals
- Signal history with expandable accordion
- Shows matched conditions per signal
- Clear history button

## Rule Structure

```javascript
{
  id: "rule_1234567890_abc",
  name: "RSI Oversold with MACD Bullish",
  enabled: true,
  action: "BUY", // or "SELL", "NEUTRAL"
  logic: "AND", // or "OR"
  conditions: [
    {
      id: "cond_1234567890_xyz",
      indicatorKey: "RSI",
      operator: "LT",
      value: 30,
      lookback: 1
    },
    {
      id: "cond_1234567890_def",
      indicatorKey: "MACD_HISTOGRAM",
      operator: "CROSSES_ABOVE",
      value: 0,
      lookback: 1
    }
  ]
}
```

## Usage Examples

### Example 1: RSI Oversold Signal
**Rule:** Trigger BUY when RSI drops below 30

- Indicator: RSI
- Operator: <
- Value: 30
- Action: BUY

### Example 2: MACD Bullish Crossover
**Rule:** Trigger BUY when MACD crosses above Signal line

- Indicator: MACD
- Operator: Crosses Above (Indicator)
- Compare To: MACD Signal
- Action: BUY

### Example 3: Combined Conditions
**Rule:** Trigger BUY when:
- RSI < 30 AND
- Stochastic %K < 20 AND
- MACD Histogram crosses above 0

Logic: AND (all conditions must be true)

### Example 4: Exit Signal
**Rule:** Trigger SELL when RSI is overbought OR Stochastic is overbought

- Condition 1: RSI > 70
- Condition 2: Stochastic %K > 80
- Logic: OR
- Action: SELL

### Example 5: Trend Following
**Rule:** Trigger BUY when price is increasing over last 5 periods

- Indicator: Gold Price
- Operator: Increasing
- Lookback: 5
- Action: BUY

## Data Flow

```
Indicator Data (Price, RSI, MACD, Stochastic)
    ↓
mapIndicatorData() - Combines into unified format
    ↓
useRuleEvaluator() - Evaluates all enabled rules
    ↓
evaluateAllRules() - For each rule:
    ↓
evaluateRule() - Check conditions with logic (AND/OR)
    ↓
evaluateCondition() - Apply operator to indicator values
    ↓
Triggered Signals + History
    ↓
CustomSignalsPanel (UI Display)
```

## Storage

Rules are persisted to browser `localStorage`:
- Key: `trading_bot_custom_rules`
- Format: JSON array of rule objects
- Automatic save on any rule change
- Loaded on app initialization

## Extensibility

### Adding a New Operator

1. Add to `OPERATORS` in `rulesEngine.js`:
```javascript
NEW_OPERATOR: {
  key: 'NEW_OP',
  label: 'Display Label',
  requiresValue: true // or requiresRange, requiresIndicator, requiresHistory
}
```

2. Add case in `evaluateCondition()`:
```javascript
case 'NEW_OP':
  // Your evaluation logic
  return result;
```

### Adding a New Indicator

1. Add to `INDICATOR_REGISTRY` in `indicatorRegistry.js`
2. Ensure backend provides the data
3. Add to data feed hook if needed
4. No changes required to rules engine or UI

### Adding Multi-Timeframe Support

The architecture supports this by:
1. Adding timeframe field to conditions
2. Passing multiple datasets to evaluator
3. Selecting appropriate dataset in `evaluateCondition()`

## Performance Considerations

- Rules are only evaluated when new data arrives
- Timestamp comparison prevents duplicate evaluations
- Signal history is capped at 100 entries
- LocalStorage is async-saved (non-blocking)

## Testing

### Manual Testing Checklist

- [ ] Create a simple rule (e.g., RSI > 70)
- [ ] Enable/disable rule toggle works
- [ ] Edit rule modifies correctly
- [ ] Delete rule removes it
- [ ] Multiple conditions with AND logic
- [ ] Multiple conditions with OR logic
- [ ] All operators function correctly
- [ ] Crossover detection works
- [ ] Signal appears when conditions are met
- [ ] Signal history accumulates
- [ ] Clear history button works
- [ ] Rules persist after page reload

## Known Limitations

1. **No Backtesting:** Rules are evaluated in real-time only
2. **No Alert System:** Signals are displayed but not pushed via notifications
3. **No Trade Execution:** This is a signal generator, not an auto-trader
4. **Client-Side Only:** Rules run in browser; no server-side evaluation

## Future Enhancements

- [ ] Export/import rules as JSON
- [ ] Rule templates library
- [ ] Backtesting against historical data
- [ ] Performance metrics per rule
- [ ] Browser notifications for signals
- [ ] WebSocket alerts to external services
- [ ] Multi-timeframe condition support
- [ ] Advanced operators (rate of change, divergence detection)
- [ ] Rule groups/categories
- [ ] Rule scheduling (only evaluate during market hours)

## Integration with Existing Code

The module is **fully isolated** and does not modify existing functionality:

- ✅ All existing charts continue to work
- ✅ Existing signal panels are unchanged
- ✅ No modifications to backend
- ✅ No breaking changes to data flow
- ✅ Can be completely removed without side effects

## Files Created

```
frontend/src/
├── utils/
│   ├── indicatorRegistry.js    # Indicator configuration
│   └── rulesEngine.js           # Core evaluation logic
├── hooks/
│   └── useRuleEvaluator.js      # React hook for evaluation
└── components/rules/
    ├── RulesManager.jsx         # Main rules list/management
    ├── RuleBuilder.jsx          # Rule creation/editing form
    ├── RuleConditionEditor.jsx  # Condition sub-component
    └── CustomSignalsPanel.jsx   # Signal display
```

**Modified Files:**
- `frontend/src/App.jsx` (added imports, state, and UI sections)

## License

Same as parent project.
