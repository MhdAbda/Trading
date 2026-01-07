/**
 * useRuleEvaluator Hook
 * 
 * React hook that evaluates custom trading rules against all historical data points.
 * Accumulates signal history throughout the day as new data arrives.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { evaluateAllRulesForAllPoints, evaluateAllRules } from '../utils/rulesEngine';
import { mapIndicatorData } from '../utils/indicatorRegistry';

const MAX_SIGNAL_HISTORY = 500;

/**
 * Custom hook for evaluating trading rules
 * @param {Array} rules - Array of rule objects
 * @param {Object} indicatorData - Object with priceData, rsiData, macdData, stochasticData, bollingerBandsData
 * @returns {Object} { triggeredSignals, signalHistory, clearHistory }
 */
export function useRuleEvaluator(rules, indicatorData) {
  const [signalHistory, setSignalHistory] = useState([]);
  const [lastDataLength, setLastDataLength] = useState(0);

  // Map all indicator data into unified format
  const unifiedData = useMemo(() => {
    return mapIndicatorData(indicatorData);
  }, [
    indicatorData.priceData,
    indicatorData.rsiData,
    indicatorData.macdData,
    indicatorData.stochasticData,
    indicatorData.bollingerBandsData
  ]);

  // On initial load or when rules change, evaluate ALL historical data points
  useEffect(() => {
    if (!rules || rules.length === 0 || unifiedData.length === 0) {
      setSignalHistory([]);
      setLastDataLength(0);
      return;
    }

    // If data length hasn't changed, don't re-evaluate everything
    if (unifiedData.length === lastDataLength && lastDataLength > 0) {
      return;
    }

    // Evaluate all rules against all historical data points
    const activeRules = rules.filter(r => r.enabled);
    const allSignals = evaluateAllRulesForAllPoints(activeRules, unifiedData);

    // Transform to include IDs and sort by timestamp
    const transformedSignals = allSignals
      .map((signal, idx) => ({
        ...signal,
        id: `signal_${signal.rule.id}_${signal.dataPointIndex}`,
        evaluatedAt: new Date().toISOString()
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    // Update history
    setSignalHistory(transformedSignals.slice(-MAX_SIGNAL_HISTORY));
    setLastDataLength(unifiedData.length);
  }, [rules, unifiedData, lastDataLength]);

  // When new data arrives, evaluate only the latest point and add new signals
  useEffect(() => {
    if (!rules || rules.length === 0 || unifiedData.length === 0) {
      return;
    }

    // If this is the first load (history empty but data exists), skip
    // because full history was already built above
    if (signalHistory.length === 0 && unifiedData.length > 0) {
      return;
    }

    // If new data point added since last evaluation
    if (unifiedData.length > lastDataLength) {
      const activeRules = rules.filter(r => r.enabled);
      const newSignals = evaluateAllRules(activeRules, unifiedData);

      if (newSignals.length > 0) {
        const transformedNewSignals = newSignals.map(signal => ({
          ...signal,
          id: `signal_${signal.rule.id}_${unifiedData.length - 1}_${Date.now()}`,
          evaluatedAt: new Date().toISOString()
        }));

        setSignalHistory(prev => {
          const updated = [...prev, ...transformedNewSignals];
          if (updated.length > MAX_SIGNAL_HISTORY) {
            return updated.slice(-MAX_SIGNAL_HISTORY);
          }
          return updated;
        });
      }
    }
  }, [unifiedData, lastDataLength, rules, signalHistory.length]);

  // Get currently triggered signals (latest data point only)
  const triggeredSignals = useMemo(() => {
    if (!rules || rules.length === 0 || unifiedData.length === 0) {
      return [];
    }

    const activeRules = rules.filter(r => r.enabled);
    return evaluateAllRules(activeRules, unifiedData);
  }, [rules, unifiedData]);

  // Clear signal history
  const clearHistory = useCallback(() => {
    setSignalHistory([]);
    setLastDataLength(0);
  }, []);

  return {
    triggeredSignals,      // Currently active signals (latest point)
    signalHistory,          // All signals from the day
    clearHistory,
    unifiedData             // Expose for debugging
  };
}

export default useRuleEvaluator;
