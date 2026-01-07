const logger = require('../utils/logger');
const rulesService = require('./rulesService');
const indicatorsService = require('./indicatorsService');
const twelveDataStream = require('./twelveDataStream');
const telegramService = require('./telegramService');

// Operators supported by the frontend rules engine
const OPERATORS = {
  GT: 'GT',
  LT: 'LT',
  GTE: 'GTE',
  LTE: 'LTE',
  EQ: 'EQ',
  BETWEEN: 'BETWEEN',
  CROSSES_ABOVE: 'CROSSES_ABOVE',
  CROSSES_BELOW: 'CROSSES_BELOW',
  CROSSES_ABOVE_IND: 'CROSSES_ABOVE_IND',
  CROSSES_BELOW_IND: 'CROSSES_BELOW_IND',
  INCREASING: 'INCREASING',
  DECREASING: 'DECREASING',
  FLAT: 'FLAT'
};

// Map indicatorKey to the property name used in unified data points
function getIndicatorValue(dataPoint, indicatorKey) {
  if (!dataPoint) return null;

  switch (indicatorKey) {
    case 'PRICE':
      return dataPoint.price;
    case 'RSI':
      return dataPoint.rsi;
    case 'MACD':
      return dataPoint.macd;
    case 'MACD_SIGNAL':
      return dataPoint.signal;
    case 'MACD_HISTOGRAM':
      return dataPoint.histogram;
    case 'STOCH_K':
      return dataPoint.k;
    case 'STOCH_D':
      return dataPoint.d;
    case 'BB_UPPER':
      return dataPoint.upper;
    case 'BB_MIDDLE':
      return dataPoint.middle;
    case 'BB_LOWER':
      return dataPoint.lower;
    default:
      return null;
  }
}

function evaluateCondition(condition, data, currentIndex) {
  if (!condition || !data || currentIndex < 0 || currentIndex >= data.length) {
    return false;
  }

  // Normalize field names (DB returns snake_case)
  const indicatorKey = condition.indicatorKey || condition.indicator_key;
  const compareToIndicator = condition.compareToIndicator || condition.compare_to_indicator;
  const value = condition.value !== undefined ? condition.value : condition.value_from || condition.value_to;
  const valueFrom = condition.valueFrom !== undefined ? condition.valueFrom : condition.value_from;
  const valueTo = condition.valueTo !== undefined ? condition.valueTo : condition.value_to;

  const currentPoint = data[currentIndex];
  const currentValue = getIndicatorValue(currentPoint, indicatorKey);

  if (currentValue === null || currentValue === undefined) {
    return false;
  }

  const operator = condition.operator;
  const lookback = condition.lookback || 1;

  switch (operator) {
    case OPERATORS.GT:
      return currentValue > value;
    case OPERATORS.LT:
      return currentValue < value;
    case OPERATORS.GTE:
      return currentValue >= value;
    case OPERATORS.LTE:
      return currentValue <= value;
    case OPERATORS.EQ:
      return Math.abs(currentValue - value) < 0.0001;
    case OPERATORS.BETWEEN:
      return currentValue >= valueFrom && currentValue <= valueTo;
    case OPERATORS.CROSSES_ABOVE: {
      if (currentIndex < 1) return false;
      const previousPoint = data[currentIndex - 1];
      const previousValue = getIndicatorValue(previousPoint, indicatorKey);
      if (previousValue === null) return false;
      return previousValue <= value && currentValue > value;
    }
    case OPERATORS.CROSSES_BELOW: {
      if (currentIndex < 1) return false;
      const previousPoint = data[currentIndex - 1];
      const previousValue = getIndicatorValue(previousPoint, indicatorKey);
      if (previousValue === null) return false;
      return previousValue >= value && currentValue < value;
    }
    case OPERATORS.CROSSES_ABOVE_IND: {
      if (currentIndex < 1 || !compareToIndicator) return false;
      const currentCompareValue = getIndicatorValue(currentPoint, compareToIndicator);
      const previousPoint = data[currentIndex - 1];
      const previousValue = getIndicatorValue(previousPoint, indicatorKey);
      const previousCompareValue = getIndicatorValue(previousPoint, compareToIndicator);
      if (previousValue === null || previousCompareValue === null || currentCompareValue === null) return false;
      return previousValue <= previousCompareValue && currentValue > currentCompareValue;
    }
    case OPERATORS.CROSSES_BELOW_IND: {
      if (currentIndex < 1 || !compareToIndicator) return false;
      const currentCompareValue = getIndicatorValue(currentPoint, compareToIndicator);
      const previousPoint = data[currentIndex - 1];
      const previousValue = getIndicatorValue(previousPoint, indicatorKey);
      const previousCompareValue = getIndicatorValue(previousPoint, compareToIndicator);
      if (previousValue === null || previousCompareValue === null || currentCompareValue === null) return false;
      return previousValue >= previousCompareValue && currentValue < currentCompareValue;
    }
    case OPERATORS.INCREASING: {
      if (currentIndex < lookback) return false;
      const previousPoint = data[currentIndex - lookback];
      const previousValue = getIndicatorValue(previousPoint, indicatorKey);
      if (previousValue === null) return false;
      return currentValue > previousValue;
    }
    case OPERATORS.DECREASING: {
      if (currentIndex < lookback) return false;
      const previousPoint = data[currentIndex - lookback];
      const previousValue = getIndicatorValue(previousPoint, indicatorKey);
      if (previousValue === null) return false;
      return currentValue < previousValue;
    }
    case OPERATORS.FLAT: {
      if (currentIndex < lookback) return false;
      const previousPoint = data[currentIndex - lookback];
      const previousValue = getIndicatorValue(previousPoint, indicatorKey);
      if (previousValue === null) return false;
      const threshold = Math.abs(currentValue * 0.01); // 1% threshold
      return Math.abs(currentValue - previousValue) < threshold;
    }
    default:
      logger.warn(`[RuleAlerts] Unknown operator: ${operator}`);
      return false;
  }
}

function evaluateRule(rule, data, currentIndex) {
  if (!rule || !rule.enabled || !rule.conditions || rule.conditions.length === 0) {
    return { triggered: false, matchedConditions: [] };
  }

  const logic = rule.logic || 'AND';
  const matchedConditions = [];
  let triggered = false;

  if (logic === 'AND') {
    triggered = rule.conditions.every(condition => {
      const result = evaluateCondition(condition, data, currentIndex);
      if (result) {
        matchedConditions.push(condition);
      }
      return result;
    });

    if (!triggered) {
      matchedConditions.length = 0;
    }
  } else if (logic === 'OR') {
    for (const condition of rule.conditions) {
      const result = evaluateCondition(condition, data, currentIndex);
      if (result) {
        matchedConditions.push(condition);
        triggered = true;
      }
    }
  }

  return { triggered, matchedConditions };
}

function evaluateAllRules(rules, data) {
  if (!rules || rules.length === 0 || !data || data.length === 0) {
    return [];
  }

  const currentIndex = data.length - 1;
  const triggeredRules = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const evaluation = evaluateRule(rule, data, currentIndex);
    if (evaluation.triggered) {
      triggeredRules.push({
        rule,
        timestamp: data[currentIndex].ts,
        matchedConditions: evaluation.matchedConditions,
        action: rule.action
      });
    }
  }

  return triggeredRules;
}

class RuleAlertService {
  constructor() {
    this.started = false;
    this.rulesCache = [];
    this.cacheUpdatedAt = 0;
    this.cacheTtlMs = 60 * 1000; // refresh rules every minute
    this.refreshTimer = null;
    this.lastEvaluatedTimestamp = null; // Only evaluate new ticks, not historical data
    this.sentAlerts = new Map(); // Track sent alerts by "${ruleId}:${timestamp}" to prevent duplicates for same rule
    this.tickHandler = this.handleTick.bind(this);
  }

  async start() {
    if (this.started) {
      return;
    }

    this.started = true;
    await this.refreshRules(true);

    // Register for price ticks
    twelveDataStream.onTick(this.tickHandler);

    // Periodically refresh rules
    this.refreshTimer = setInterval(() => {
      this.refreshRules().catch((err) => {
        logger.error(`[RuleAlerts] Failed to refresh rules: ${err.message}`);
      });
    }, this.cacheTtlMs);

    logger.info(`[RuleAlerts] ========================================`);
    logger.info(`[RuleAlerts] Rule alert service STARTED`);
    logger.info(`[RuleAlerts] Monitoring ${this.rulesCache.length} enabled rules`);
    logger.info(`[RuleAlerts] Telegram configured: ${require('../config/env').telegram.botToken ? 'YES' : 'NO'}`);
    logger.info(`[RuleAlerts] ========================================`);
  }

  stop() {
    if (!this.started) return;
    twelveDataStream.offTick(this.tickHandler);
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.started = false;
  }

  async refreshRules(initial = false) {
    const rules = await rulesService.getAllEnabledRules();
    this.rulesCache = rules;
    this.cacheUpdatedAt = Date.now();
    logger.info(`[RuleAlerts] ======== RULES REFRESH${initial ? ' (INITIAL)' : ''} ========`);
    logger.info(`[RuleAlerts] Loaded ${rules.length} enabled rules`);
    if (rules.length > 0) {
      rules.forEach(rule => {
        logger.info(`[RuleAlerts]   - Rule: ${rule.name} (ID: ${rule.id})`);
        logger.info(`[RuleAlerts]     User: ${rule.username || rule.user_id}`);
        logger.info(`[RuleAlerts]     Action: ${rule.action}, Logic: ${rule.logic}`);
        logger.info(`[RuleAlerts]     Conditions: ${rule.conditions.length}`);
        rule.conditions.forEach((cond, idx) => {
          const indicatorLabel = cond.indicator_key || cond.indicatorKey;
          const op = cond.operator;
          const val = cond.value !== undefined && cond.value !== null ? ` ${cond.value}` : '';
          logger.info(`[RuleAlerts]       ${idx + 1}. ${indicatorLabel} ${op}${val}`);
        });
      });
    }
    logger.info(`[RuleAlerts] ====================================`);
  }

  buildUnifiedData() {
    const series = twelveDataStream.getSeries();
    if (!series || series.length === 0) {
      return [];
    }

    const dataMap = new Map();

    const addValue = (ts, updater) => {
      if (!Number.isFinite(ts)) return;
      if (!dataMap.has(ts)) {
        dataMap.set(ts, { ts });
      }
      updater(dataMap.get(ts));
    };

    // Price series
    series.forEach(pt => {
      const ts = Date.parse(pt.time);
      addValue(ts, (obj) => { obj.price = pt.price; });
    });

    // Indicator histories (defaults match frontend)
    const rsiHistory = indicatorsService.getIndicatorHistory('rsi', { period: 14 });
    rsiHistory.forEach(pt => {
      const ts = Date.parse(pt.time || pt.ts);
      addValue(ts, (obj) => { obj.rsi = pt.rsi; });
    });

    const macdHistory = indicatorsService.getIndicatorHistory('macd', { fast: 12, slow: 26, signal: 9 });
    macdHistory.forEach(pt => {
      const ts = Date.parse(pt.time || pt.ts);
      addValue(ts, (obj) => {
        obj.macd = pt.macd;
        obj.signal = pt.signal;
        obj.histogram = pt.histogram;
      });
    });

    const stochasticHistory = indicatorsService.getIndicatorHistory('stochastic', { kPeriod: 14, dPeriod: 3, smoothing: 3 });
    stochasticHistory.forEach(pt => {
      const ts = Date.parse(pt.time || pt.ts);
      addValue(ts, (obj) => {
        obj.k = pt.k;
        obj.d = pt.d;
      });
    });

    const bbHistory = indicatorsService.getIndicatorHistory('bollingerBands', { period: 20, stdDev: 2 });
    bbHistory.forEach(pt => {
      const ts = Date.parse(pt.time || pt.ts);
      addValue(ts, (obj) => {
        obj.upper = pt.upper;
        obj.middle = pt.middle;
        obj.lower = pt.lower;
      });
    });

    // Return sorted array
    return Array.from(dataMap.values()).filter(p => Number.isFinite(p.ts)).sort((a, b) => a.ts - b.ts);
  }

  async handleTick(lastQuote) {
    try {
      // Refresh rules if cache stale (lazy check in case interval missed)
      if (Date.now() - this.cacheUpdatedAt > this.cacheTtlMs * 2) {
        await this.refreshRules();
      }

      if (!this.rulesCache || this.rulesCache.length === 0) {
        return;
      }

      const unifiedData = this.buildUnifiedData();
      if (unifiedData.length === 0) {
        return;
      }

      const latestDataTimestamp = unifiedData[unifiedData.length - 1].ts;
      
      // Skip if we've already evaluated this unified data timestamp (no new data point in unified data)
      if (this.lastEvaluatedTimestamp === latestDataTimestamp) {
        logger.info(`[RuleAlerts] -------- TICK SKIPPED --------`);
        logger.info(`[RuleAlerts] No new data point in unified data (timestamp: ${latestDataTimestamp})`);
        logger.info(`[RuleAlerts] ------------------------------------`);
        return;
      }

      this.lastEvaluatedTimestamp = latestDataTimestamp;

      logger.info(`[RuleAlerts] -------- TICK EVALUATION --------`);
      logger.info(`[RuleAlerts] Price: ${lastQuote.price}, Time: ${lastQuote.time}`);
      logger.info(`[RuleAlerts] Latest data timestamp: ${latestDataTimestamp}`);
      logger.info(`[RuleAlerts] Unified data points: ${unifiedData.length}`);
      logger.info(`[RuleAlerts] Evaluating ${this.rulesCache.length} rules...`);

      const triggered = evaluateAllRules(this.rulesCache, unifiedData);
      
      logger.info(`[RuleAlerts] Evaluation result: ${triggered.length} rules triggered`);
      
      if (triggered.length === 0) {
        logger.info(`[RuleAlerts] No rules triggered`);
        logger.info(`[RuleAlerts] ------------------------------------`);
        return;
      }

      logger.info(`[RuleAlerts] Processing ${triggered.length} triggered rules...`);

      const latest = unifiedData[unifiedData.length - 1];
      logger.info(`[RuleAlerts] Latest data point:`);
      logger.info(`[RuleAlerts]   Price: ${latest.price}`);
      logger.info(`[RuleAlerts]   RSI: ${latest.rsi || 'N/A'}`);
      logger.info(`[RuleAlerts]   MACD: ${latest.macd || 'N/A'}`);
      logger.info(`[RuleAlerts]   Stoch K: ${latest.k || 'N/A'}`);

      for (const signal of triggered) {
        const alertKey = `${signal.rule.id}:${signal.timestamp}`;
        
        logger.info(`[RuleAlerts] ---> RULE TRIGGERED: ${signal.rule.name}`);
        logger.info(`[RuleAlerts]      Rule ID: ${signal.rule.id}`);
        logger.info(`[RuleAlerts]      User: ${signal.rule.username || signal.rule.user_id}`);
        logger.info(`[RuleAlerts]      Action: ${signal.rule.action}`);
        logger.info(`[RuleAlerts]      Matched: ${signal.matchedConditions.length} conditions`);
        logger.info(`[RuleAlerts]      Timestamp: ${signal.timestamp}`);

        // Check if we've already sent an alert for this rule and timestamp
        if (this.sentAlerts.has(alertKey)) {
          logger.info(`[RuleAlerts]      SKIPPED: Alert already sent for this rule at this timestamp`);
          continue;
        }

        // Mark this alert as sent
        this.sentAlerts.set(alertKey, Date.now());

        const conditionsText = signal.matchedConditions
          .map((c, idx) => {
            const indicatorLabel = c.indicator_key || c.indicatorKey;
            const op = c.operator;
            if (op === OPERATORS.BETWEEN) {
              return `${idx + 1}. ${indicatorLabel} ${op} ${c.value_from ?? c.valueFrom} to ${c.value_to ?? c.valueTo}`;
            }
            if (op === OPERATORS.CROSSES_ABOVE_IND || op === OPERATORS.CROSSES_BELOW_IND) {
              const cmp = c.compare_to_indicator || c.compareToIndicator;
              return `${idx + 1}. ${indicatorLabel} ${op} ${cmp}`;
            }
            const val = c.value !== undefined && c.value !== null ? ` ${c.value}` : '';
            return `${idx + 1}. ${indicatorLabel} ${op}${val}`;
          })
          .join('\n');

        const message = [
          '🚨 Trading Rule Triggered',
          `Rule: ${signal.rule.name}`,
          `Action: ${signal.rule.action}`,
          `User: ${signal.rule.username || signal.rule.user_id || 'n/a'}`,
          `Price: ${latest.price}`,
          `Time: ${new Date(signal.timestamp).toISOString()}`,
          signal.matchedConditions.length ? 'Matched Conditions:\n' + conditionsText : 'Matched Conditions: (not provided)'
        ].join('\n');

        try {
          logger.info(`[RuleAlerts]      Attempting to send Telegram notification...`);
          logger.info(`[RuleAlerts]      Message preview: ${message.substring(0, 100)}...`);
          const result = await telegramService.sendMessage({ message });
          logger.info(`[RuleAlerts]      ✅ SUCCESS! Telegram notification sent`);
          logger.info(`[RuleAlerts]         Chat ID: ${result.chatId}`);
          logger.info(`[RuleAlerts]         Message ID: ${result.messageId}`);
        } catch (err) {
          logger.error(`[RuleAlerts]      ❌ FAILED to send Telegram notification`);
          logger.error(`[RuleAlerts]         Error: ${err.message}`);
          logger.error(`[RuleAlerts]         Status: ${err.status || 'unknown'}`);
          if (err.stack) {
            logger.error(`[RuleAlerts]         Stack: ${err.stack}`);
          }
        }
      }
      logger.info(`[RuleAlerts] ------------------------------------`);
    } catch (error) {
      logger.error(`[RuleAlerts] Tick handling error: ${error.message}`);
      logger.error(`[RuleAlerts] Stack: ${error.stack}`);
    }
  }
}

module.exports = new RuleAlertService();
