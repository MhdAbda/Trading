const express = require('express');
const router = express.Router();
const rulesService = require('../services/rulesService');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/rules
 * Get all rules for the authenticated user
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    logger.info(`[RULES] GET /rules for user ${userId}`);
    
    const rules = await rulesService.getUserRules(userId);
    
    logger.info(`[RULES] Retrieved ${rules.length} rules for user ${userId}`);
    res.json({
      ok: true,
      data: rules
    });
  } catch (error) {
    logger.error(`[RULES] GET /rules error: ${error.message}`);
    res.status(500).json({
      error: 'Failed to fetch rules',
      message: error.message
    });
  }
});

/**
 * POST /api/rules
 * Create a new rule
 * Body: {id, name, enabled, action, logic, conditions}
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, name, enabled, action, logic, conditions } = req.body;
    
    logger.info(`[RULES] POST /rules: Creating rule ${id} for user ${userId}`);
    
    if (!id || !name || !action || !logic) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'id, name, action, and logic are required'
      });
    }
    
    if (!['BUY', 'SELL', 'NEUTRAL'].includes(action)) {
      return res.status(400).json({
        error: 'Invalid action',
        message: "action must be 'BUY', 'SELL', or 'NEUTRAL'"
      });
    }
    
    if (!['AND', 'OR'].includes(logic)) {
      return res.status(400).json({
        error: 'Invalid logic',
        message: "logic must be 'AND' or 'OR'"
      });
    }
    
    const rule = await rulesService.createRule(userId, {
      id,
      name,
      enabled: enabled !== undefined ? enabled : true,
      action,
      logic,
      conditions: conditions || []
    });
    
    logger.info(`[RULES] Rule created: ${id}`);
    res.status(201).json({
      ok: true,
      data: rule
    });
  } catch (error) {
    logger.error(`[RULES] POST /rules error: ${error.message}`);
    res.status(500).json({
      error: 'Failed to create rule',
      message: error.message
    });
  }
});

/**
 * PUT /api/rules/:ruleId
 * Update an existing rule
 */
router.put('/:ruleId', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { ruleId } = req.params;
    const { name, enabled, action, logic, conditions } = req.body;
    
    logger.info(`[RULES] PUT /rules/${ruleId}: Updating rule for user ${userId}`);
    
    if (!name || !action || !logic) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'name, action, and logic are required'
      });
    }
    
    if (!['BUY', 'SELL', 'NEUTRAL'].includes(action)) {
      return res.status(400).json({
        error: 'Invalid action',
        message: "action must be 'BUY', 'SELL', or 'NEUTRAL'"
      });
    }
    
    if (!['AND', 'OR'].includes(logic)) {
      return res.status(400).json({
        error: 'Invalid logic',
        message: "logic must be 'AND' or 'OR'"
      });
    }
    
    const rule = await rulesService.updateRule(userId, ruleId, {
      name,
      enabled: enabled !== undefined ? enabled : true,
      action,
      logic,
      conditions: conditions || []
    });
    
    logger.info(`[RULES] Rule updated: ${ruleId}`);
    res.json({
      ok: true,
      data: rule
    });
  } catch (error) {
    if (error.message === 'Rule not found or unauthorized') {
      logger.warn(`[RULES] PUT /rules/${req.params.ruleId}: Unauthorized for user ${req.user.id}`);
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'Rule not found or you do not have permission to update it'
      });
    }
    logger.error(`[RULES] PUT /rules/${req.params.ruleId} error: ${error.message}`);
    res.status(500).json({
      error: 'Failed to update rule',
      message: error.message
    });
  }
});

/**
 * DELETE /api/rules/:ruleId
 * Delete a rule
 */
router.delete('/:ruleId', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { ruleId } = req.params;
    
    logger.info(`[RULES] DELETE /rules/${ruleId}: Deleting rule for user ${userId}`);
    
    await rulesService.deleteRule(userId, ruleId);
    
    logger.info(`[RULES] Rule deleted: ${ruleId}`);
    res.json({
      ok: true,
      message: 'Rule deleted successfully'
    });
  } catch (error) {
    if (error.message === 'Rule not found or unauthorized') {
      logger.warn(`[RULES] DELETE /rules/${req.params.ruleId}: Unauthorized for user ${req.user.id}`);
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'Rule not found or you do not have permission to delete it'
      });
    }
    logger.error(`[RULES] DELETE /rules/${req.params.ruleId} error: ${error.message}`);
    res.status(500).json({
      error: 'Failed to delete rule',
      message: error.message
    });
  }
});

module.exports = router;
