export const createUsersTableSQL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
`;

export const createUpdatedAtTriggerSQL = `
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
`;

export const createTradingRulesTableSQL = `
CREATE TABLE IF NOT EXISTS trading_rules (
  id VARCHAR(255) PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  action VARCHAR(20) NOT NULL CHECK (action IN ('BUY', 'SELL', 'NEUTRAL')),
  logic VARCHAR(10) NOT NULL CHECK (logic IN ('AND', 'OR')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trading_rules_user_id ON trading_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_rules_enabled ON trading_rules(enabled);

DROP TRIGGER IF EXISTS update_trading_rules_updated_at ON trading_rules;

CREATE TRIGGER update_trading_rules_updated_at
BEFORE UPDATE ON trading_rules
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
`;

export const createRuleConditionsTableSQL = `
CREATE TABLE IF NOT EXISTS rule_conditions (
  id VARCHAR(255) PRIMARY KEY,
  rule_id VARCHAR(255) NOT NULL REFERENCES trading_rules(id) ON DELETE CASCADE,
  indicator_key VARCHAR(50) NOT NULL,
  operator VARCHAR(50) NOT NULL,
  value DECIMAL(18, 8),
  value_from DECIMAL(18, 8),
  value_to DECIMAL(18, 8),
  compare_to_indicator VARCHAR(50),
  lookback INTEGER DEFAULT 1,
  condition_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rule_conditions_rule_id ON rule_conditions(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_conditions_indicator ON rule_conditions(indicator_key);
`;

export const createTriggeredSignalsTableSQL = `
CREATE TABLE IF NOT EXISTS triggered_signals (
  id SERIAL PRIMARY KEY,
  rule_id VARCHAR(255) NOT NULL REFERENCES trading_rules(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  rule_name VARCHAR(255) NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('BUY', 'SELL', 'NEUTRAL')),
  price DECIMAL(18, 8),
  timestamp BIGINT NOT NULL,
  matched_conditions JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_triggered_signals_rule_id ON triggered_signals(rule_id);
CREATE INDEX IF NOT EXISTS idx_triggered_signals_user_id ON triggered_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_triggered_signals_timestamp ON triggered_signals(timestamp);
CREATE INDEX IF NOT EXISTS idx_triggered_signals_action ON triggered_signals(action);
CREATE INDEX IF NOT EXISTS idx_triggered_signals_created_at ON triggered_signals(created_at);
`;

export const allSchemas = [
  createUsersTableSQL,
  createUpdatedAtTriggerSQL,
  createTradingRulesTableSQL,
  createRuleConditionsTableSQL,
  createTriggeredSignalsTableSQL
];
