const db = require('../utils/db');
const logger = require('../utils/logger');

class RulesService {
  /**
   * Get all enabled rules across all users (for background evaluators)
   * @returns {Promise<Array>} Array of rules with user_id, username, and conditions
   */
  async getAllEnabledRules() {
    try {
      const rulesResult = await db.query(
        `SELECT tr.id, tr.user_id, u.username, tr.name, tr.enabled, tr.action, tr.logic, tr.updated_at
         FROM trading_rules tr
         JOIN users u ON u.id = tr.user_id
         WHERE tr.enabled = true
         ORDER BY tr.updated_at DESC`
      );

      const rules = rulesResult.rows;

      // Fetch conditions for each rule
      const rulesWithConditions = await Promise.all(
        rules.map(async (rule) => {
          const conditionsResult = await db.query(
            `SELECT id, indicator_key, operator, value, value_from, value_to, compare_to_indicator, lookback, condition_order
             FROM rule_conditions
             WHERE rule_id = $1
             ORDER BY condition_order ASC`,
            [rule.id]
          );

          return {
            ...rule,
            conditions: conditionsResult.rows
          };
        })
      );

      return rulesWithConditions;
    } catch (error) {
      logger.error(`[RulesService] getAllEnabledRules error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all rules for a user
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Array of rules with conditions
   */
  async getUserRules(userId) {
    try {
      const query = `
        SELECT tr.id, tr.name, tr.enabled, tr.action, tr.logic, tr.created_at, tr.updated_at
        FROM trading_rules tr
        WHERE tr.user_id = $1
        ORDER BY tr.updated_at DESC
      `;
      const result = await db.query(query, [userId]);
      
      // For each rule, fetch its conditions
      const rulesWithConditions = await Promise.all(
        result.rows.map(async (rule) => {
          const conditionsResult = await db.query(
            `SELECT id, indicator_key, operator, value, value_from, value_to, compare_to_indicator, lookback, condition_order
             FROM rule_conditions
             WHERE rule_id = $1
             ORDER BY condition_order ASC`,
            [rule.id]
          );
          return {
            ...rule,
            conditions: conditionsResult.rows
          };
        })
      );
      
      return rulesWithConditions;
    } catch (error) {
      logger.error(`[RulesService] getUserRules error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new rule with conditions
   * @param {number} userId - User ID
   * @param {Object} rule - Rule object {id, name, enabled, action, logic, conditions}
   * @returns {Promise<Object>} Created rule
   */
  async createRule(userId, rule) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      
      // Insert rule
      const ruleQuery = `
        INSERT INTO trading_rules (id, user_id, name, enabled, action, logic)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, enabled, action, logic, created_at, updated_at
      `;
      const ruleResult = await client.query(ruleQuery, [
        rule.id,
        userId,
        rule.name,
        rule.enabled !== undefined ? rule.enabled : true,
        rule.action,
        rule.logic
      ]);
      
      const createdRule = ruleResult.rows[0];
      
      // Insert conditions
      if (rule.conditions && rule.conditions.length > 0) {
        for (let i = 0; i < rule.conditions.length; i++) {
          const cond = rule.conditions[i];
          const condQuery = `
            INSERT INTO rule_conditions (id, rule_id, indicator_key, operator, value, value_from, value_to, compare_to_indicator, lookback, condition_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `;
          await client.query(condQuery, [
            cond.id,
            rule.id,
            cond.indicatorKey,
            cond.operator,
            cond.value || null,
            cond.valueFrom || null,
            cond.valueTo || null,
            cond.compareToIndicator || null,
            cond.lookback || 1,
            i
          ]);
        }
      }
      
      await client.query('COMMIT');
      
      logger.info(`[RulesService] Rule created: ${rule.id} for user ${userId}`);
      
      return {
        ...createdRule,
        conditions: rule.conditions || []
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`[RulesService] createRule error: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update an existing rule with conditions
   * @param {number} userId - User ID
   * @param {string} ruleId - Rule ID
   * @param {Object} rule - Updated rule object
   * @returns {Promise<Object>} Updated rule
   */
  async updateRule(userId, ruleId, rule) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      
      // Verify rule belongs to user
      const ownerCheck = await client.query(
        'SELECT id FROM trading_rules WHERE id = $1 AND user_id = $2',
        [ruleId, userId]
      );
      
      if (ownerCheck.rows.length === 0) {
        throw new Error('Rule not found or unauthorized');
      }
      
      // Update rule
      const ruleQuery = `
        UPDATE trading_rules
        SET name = $1, enabled = $2, action = $3, logic = $4, updated_at = NOW()
        WHERE id = $5
        RETURNING id, name, enabled, action, logic, created_at, updated_at
      `;
      const ruleResult = await client.query(ruleQuery, [
        rule.name,
        rule.enabled !== undefined ? rule.enabled : true,
        rule.action,
        rule.logic,
        ruleId
      ]);
      
      const updatedRule = ruleResult.rows[0];
      
      // Delete old conditions
      await client.query('DELETE FROM rule_conditions WHERE rule_id = $1', [ruleId]);
      
      // Insert new conditions
      if (rule.conditions && rule.conditions.length > 0) {
        for (let i = 0; i < rule.conditions.length; i++) {
          const cond = rule.conditions[i];
          const condQuery = `
            INSERT INTO rule_conditions (id, rule_id, indicator_key, operator, value, value_from, value_to, compare_to_indicator, lookback, condition_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `;
          await client.query(condQuery, [
            cond.id,
            ruleId,
            cond.indicatorKey,
            cond.operator,
            cond.value || null,
            cond.valueFrom || null,
            cond.valueTo || null,
            cond.compareToIndicator || null,
            cond.lookback || 1,
            i
          ]);
        }
      }
      
      await client.query('COMMIT');
      
      logger.info(`[RulesService] Rule updated: ${ruleId} for user ${userId}`);
      
      return {
        ...updatedRule,
        conditions: rule.conditions || []
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`[RulesService] updateRule error: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a rule and its conditions
   * @param {number} userId - User ID
   * @param {string} ruleId - Rule ID
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteRule(userId, ruleId) {
    try {
      // Verify rule belongs to user and delete (cascade will delete conditions)
      const result = await db.query(
        'DELETE FROM trading_rules WHERE id = $1 AND user_id = $2',
        [ruleId, userId]
      );
      
      if (result.rowCount === 0) {
        throw new Error('Rule not found or unauthorized');
      }
      
      logger.info(`[RulesService] Rule deleted: ${ruleId} for user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`[RulesService] deleteRule error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new RulesService();
