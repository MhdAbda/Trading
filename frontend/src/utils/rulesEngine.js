/**
 * Rules Engine
 * 
 * Generic, extensible trading rules evaluation engine.
 * Supports multiple operators, trend analysis, crossovers, and multi-condition logic.
 * 
 * Rule Structure:
 * {
 *   id: string,
 *   name: string,
 *   enabled: boolean,
 *   action: 'BUY' | 'SELL' | 'NEUTRAL',
 *   logic: 'AND' | 'OR',
 *   conditions: [
 *     {
 *       indicatorKey: string,
 *       operator: string,
 *       value: number,
 *       valueFrom: number,
 *       valueTo: number,
 *       compareToIndicator: string,
 *       lookback: number
 *     }
 *   ]
 * }
 */

import { getIndicatorValue } from './indicatorRegistry';

// Supported operators
export const OPERATORS = {
  GREATER_THAN: { key: 'GT', label: '>', requiresValue: true },
  LESS_THAN: { key: 'LT', label: '<', requiresValue: true },
  GREATER_OR_EQUAL: { key: 'GTE', label: '>=', requiresValue: true },
  LESS_OR_EQUAL: { key: 'LTE', label: '<=', requiresValue: true },
  EQUALS: { key: 'EQ', label: '=', requiresValue: true },
  BETWEEN: { key: 'BETWEEN', label: 'Between', requiresRange: true },
  CROSSES_ABOVE: { key: 'CROSSES_ABOVE', label: 'Crosses Above', requiresValue: true, requiresHistory: true },
  CROSSES_BELOW: { key: 'CROSSES_BELOW', label: 'Crosses Below', requiresValue: true, requiresHistory: true },
  CROSSES_ABOVE_INDICATOR: { key: 'CROSSES_ABOVE_IND', label: 'Crosses Above (Indicator)', requiresIndicator: true, requiresHistory: true },
  CROSSES_BELOW_INDICATOR: { key: 'CROSSES_BELOW_IND', label: 'Crosses Below (Indicator)', requiresIndicator: true, requiresHistory: true },
  INCREASING: { key: 'INCREASING', label: 'Increasing', requiresHistory: true },
  DECREASING: { key: 'DECREASING', label: 'Decreasing', requiresHistory: true },
  FLAT: { key: 'FLAT', label: 'Flat', requiresHistory: true }
};

/**
 * Evaluate a single condition
 * @param {Object} condition - Condition object
 * @param {Array} data - Historical data array (sorted by timestamp)
 * @param {number} currentIndex - Index of current data point
 * @returns {boolean} True if condition is met
 */
export function evaluateCondition(condition, data, currentIndex) {
  if (!condition || !data || currentIndex < 0 || currentIndex >= data.length) {
    return false;
  }

  const currentPoint = data[currentIndex];
  const currentValue = getIndicatorValue(currentPoint, condition.indicatorKey);

  if (currentValue === null || currentValue === undefined) {
    return false;
  }

  const operator = condition.operator;
  const lookback = condition.lookback || 1;

  switch (operator) {
    case 'GT':
      return currentValue > condition.value;

    case 'LT':
      return currentValue < condition.value;

    case 'GTE':
      return currentValue >= condition.value;

    case 'LTE':
      return currentValue <= condition.value;

    case 'EQ':
      return Math.abs(currentValue - condition.value) < 0.0001;

    case 'BETWEEN':
      return currentValue >= condition.valueFrom && currentValue <= condition.valueTo;

    case 'CROSSES_ABOVE': {
      if (currentIndex < 1) return false;
      const previousPoint = data[currentIndex - 1];
      const previousValue = getIndicatorValue(previousPoint, condition.indicatorKey);
      if (previousValue === null) return false;
      return previousValue <= condition.value && currentValue > condition.value;
    }

    case 'CROSSES_BELOW': {
      if (currentIndex < 1) return false;
      const previousPoint = data[currentIndex - 1];
      const previousValue = getIndicatorValue(previousPoint, condition.indicatorKey);
      if (previousValue === null) return false;
      return previousValue >= condition.value && currentValue < condition.value;
    }

    case 'CROSSES_ABOVE_IND': {
      if (currentIndex < 1 || !condition.compareToIndicator) return false;
      const currentCompareValue = getIndicatorValue(currentPoint, condition.compareToIndicator);
      const previousPoint = data[currentIndex - 1];
      const previousValue = getIndicatorValue(previousPoint, condition.indicatorKey);
      const previousCompareValue = getIndicatorValue(previousPoint, condition.compareToIndicator);
      if (previousValue === null || previousCompareValue === null || currentCompareValue === null) return false;
      return previousValue <= previousCompareValue && currentValue > currentCompareValue;
    }

    case 'CROSSES_BELOW_IND': {
      if (currentIndex < 1 || !condition.compareToIndicator) return false;
      const currentCompareValue = getIndicatorValue(currentPoint, condition.compareToIndicator);
      const previousPoint = data[currentIndex - 1];
      const previousValue = getIndicatorValue(previousPoint, condition.indicatorKey);
      const previousCompareValue = getIndicatorValue(previousPoint, condition.compareToIndicator);
      if (previousValue === null || previousCompareValue === null || currentCompareValue === null) return false;
      return previousValue >= previousCompareValue && currentValue < currentCompareValue;
    }

    case 'INCREASING': {
      if (currentIndex < lookback) return false;
      const previousPoint = data[currentIndex - lookback];
      const previousValue = getIndicatorValue(previousPoint, condition.indicatorKey);
      if (previousValue === null) return false;
      return currentValue > previousValue;
    }

    case 'DECREASING': {
      if (currentIndex < lookback) return false;
      const previousPoint = data[currentIndex - lookback];
      const previousValue = getIndicatorValue(previousPoint, condition.indicatorKey);
      if (previousValue === null) return false;
      return currentValue < previousValue;
    }

    case 'FLAT': {
      if (currentIndex < lookback) return false;
      const previousPoint = data[currentIndex - lookback];
      const previousValue = getIndicatorValue(previousPoint, condition.indicatorKey);
      if (previousValue === null) return false;
      const threshold = Math.abs(currentValue * 0.01); // 1% threshold
      return Math.abs(currentValue - previousValue) < threshold;
    }

    default:
      console.warn(`Unknown operator: ${operator}`);
      return false;
  }
}

/**
 * Evaluate a complete rule
 * @param {Object} rule - Rule object with conditions
 * @param {Array} data - Historical data array
 * @param {number} currentIndex - Index of current data point
 * @returns {Object} Evaluation result { triggered: boolean, matchedConditions: Array }
 */
export function evaluateRule(rule, data, currentIndex) {
  if (!rule || !rule.enabled || !rule.conditions || rule.conditions.length === 0) {
    return { triggered: false, matchedConditions: [] };
  }

  const logic = rule.logic || 'AND';
  const matchedConditions = [];
  let triggered = false;

  if (logic === 'AND') {
    // All conditions must be true
    triggered = rule.conditions.every(condition => {
      const result = evaluateCondition(condition, data, currentIndex);
      if (result) {
        matchedConditions.push(condition);
      }
      return result;
    });
    
    // If not all matched, clear matched conditions
    if (!triggered) {
      matchedConditions.length = 0;
    }
  } else if (logic === 'OR') {
    // At least one condition must be true
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

/**
 * Evaluate all rules against current data point only (latest)
 * @param {Array} rules - Array of rule objects
 * @param {Array} data - Historical data array
 * @returns {Array} Array of triggered rules with details
 */
export function evaluateAllRules(rules, data) {
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

/**
 * Evaluate all rules against ALL data points in history
 * Returns signals for every data point that triggered a rule
 * @param {Array} rules - Array of rule objects
 * @param {Array} data - Historical data array
 * @returns {Array} Array of triggered signals with all matching points
 */
export function evaluateAllRulesForAllPoints(rules, data) {
  if (!rules || rules.length === 0 || !data || data.length === 0) {
    return [];
  }

  const allSignals = [];

  // Evaluate each data point
  for (let currentIndex = 0; currentIndex < data.length; currentIndex++) {
    for (const rule of rules) {
      if (!rule.enabled) continue;

      const evaluation = evaluateRule(rule, data, currentIndex);
      if (evaluation.triggered) {
        allSignals.push({
          rule,
          timestamp: data[currentIndex].ts,
          dataPointIndex: currentIndex,
          matchedConditions: evaluation.matchedConditions,
          action: rule.action
        });
      }
    }
  }

  return allSignals;
}

/**
 * Validate a rule structure
 * @param {Object} rule - Rule to validate
 * @returns {Object} { valid: boolean, errors: Array }
 */
export function validateRule(rule) {
  const errors = [];

  if (!rule.name || rule.name.trim() === '') {
    errors.push('Rule name is required');
  }

  if (!rule.action || !['BUY', 'SELL', 'NEUTRAL'].includes(rule.action)) {
    errors.push('Valid action (BUY/SELL/NEUTRAL) is required');
  }

  if (!rule.conditions || rule.conditions.length === 0) {
    errors.push('At least one condition is required');
  } else {
    rule.conditions.forEach((condition, index) => {
      if (!condition.indicatorKey) {
        errors.push(`Condition ${index + 1}: Indicator is required`);
      }
      if (!condition.operator) {
        errors.push(`Condition ${index + 1}: Operator is required`);
      }
      
      const op = Object.values(OPERATORS).find(o => o.key === condition.operator);
      if (op) {
        if (op.requiresValue && (condition.value === null || condition.value === undefined)) {
          errors.push(`Condition ${index + 1}: Value is required`);
        }
        if (op.requiresRange && (condition.valueFrom === null || condition.valueTo === null)) {
          errors.push(`Condition ${index + 1}: Value range is required`);
        }
        if (op.requiresIndicator && !condition.compareToIndicator) {
          errors.push(`Condition ${index + 1}: Comparison indicator is required`);
        }
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create a new empty rule template
 * @returns {Object} Empty rule object
 */
export function createEmptyRule() {
  return {
    id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: '',
    enabled: true,
    action: 'BUY',
    logic: 'AND',
    conditions: []
  };
}

/**
 * Create a new empty condition template
 * @returns {Object} Empty condition object
 */
export function createEmptyCondition() {
  return {
    id: `cond_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    indicatorKey: '',
    operator: 'GT',
    value: 0,
    valueFrom: 0,
    valueTo: 0,
    compareToIndicator: '',
    lookback: 1
  };
}

export default {
  OPERATORS,
  evaluateCondition,
  evaluateRule,
  evaluateAllRules,
  evaluateAllRulesForAllPoints,
  validateRule,
  createEmptyRule,
  createEmptyCondition
};
