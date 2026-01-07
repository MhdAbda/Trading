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
  const [lastDataSignature, setLastDataSignature] = useState(null);

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
      setLastDataSignature(null);
      // eslint-disable-next-line no-console
      console.log('[RULES] Skipping evaluation: rules or data missing', {
        rules: rules ? rules.length : 0,
        data: unifiedData ? unifiedData.length : 0
      });
      return;
    }

    // Build a signature of the dataset to detect day/range and coverage changes
    const firstTs = unifiedData[0]?.ts ?? 0;
    const lastTs = unifiedData[unifiedData.length - 1]?.ts ?? 0;
    const coverage = unifiedData.reduce((acc, p) => {
      if (typeof p.price === 'number') acc.price++;
      if (typeof p.rsi === 'number') acc.rsi++;
      if (typeof p.macd === 'number' && typeof p.signal === 'number') acc.macd++;
      if (typeof p.k === 'number' && typeof p.d === 'number') acc.stochastic++;
      if (typeof p.upper === 'number' && typeof p.middle === 'number' && typeof p.lower === 'number') acc.bb++;
      return acc;
    }, { price: 0, rsi: 0, macd: 0, stochastic: 0, bb: 0 });
    const coverageSignature = `${coverage.price}|${coverage.rsi}|${coverage.macd}|${coverage.stochastic}|${coverage.bb}`;
    const signature = `${unifiedData.length}|${firstTs}|${lastTs}|${coverageSignature}`;

    // If nothing material changed (same size and bounds), skip full rebuild
    if (signature === lastDataSignature && lastDataLength > 0) {
      // eslint-disable-next-line no-console
      console.log('[RULES] No evaluation: signature unchanged', { signature });
      return;
    }

    // eslint-disable-next-line no-console
    console.log('[RULES] Re-evaluating due to signature change', {
      previousSignature: lastDataSignature,
      nextSignature: signature,
      reevalRange: { startIndex: 0, endIndex: unifiedData.length - 1, points: unifiedData.length },
      timeBounds: { first: new Date(firstTs).toISOString(), last: new Date(lastTs).toISOString() }
    });

    // eslint-disable-next-line no-console
    console.log('[RULES] Evaluating history', {
      signature,
      points: unifiedData.length,
      first: new Date(firstTs).toISOString(),
      last: new Date(lastTs).toISOString(),
      coverage
    });

    // Evaluate all rules against all historical data points
    const activeRules = rules.filter(r => r.enabled);
    // eslint-disable-next-line no-console
    console.log('[RULES] Active rules', { count: activeRules.length, ids: activeRules.map(r => r.id) });
    // eslint-disable-next-line no-console
    console.log('[RULES] Evaluation workload', { evaluations: activeRules.length * unifiedData.length });
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
    setLastDataSignature(signature);
    // eslint-disable-next-line no-console
    console.log('[RULES] Evaluation complete', (() => {
      const perRule = new Map();
      transformedSignals.forEach(s => {
        const key = s.rule.id;
        perRule.set(key, (perRule.get(key) || 0) + 1);
      });
      const summary = Array.from(perRule.entries()).map(([ruleId, count]) => ({ ruleId, count }));
      const sample = transformedSignals.slice(0, 5).map(s => ({
        ruleId: s.rule.id,
        name: s.rule.name,
        action: s.action,
        at: new Date(s.timestamp).toLocaleString(),
        index: s.dataPointIndex
      }));
      return {
        signals: transformedSignals.length,
        uniqueRules: perRule.size,
        perRule: summary,
        sample
      };
    })());
  }, [rules, unifiedData, lastDataLength, lastDataSignature]);

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
        // eslint-disable-next-line no-console
        console.log('[RULES] Appended incremental signals', { count: transformedNewSignals.length });
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
