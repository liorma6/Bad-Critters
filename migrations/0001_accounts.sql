CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  email_cipher TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL
);
CREATE TABLE auth_challenges (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  email_cipher TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at INTEGER,
  sent INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX auth_challenge_expiry ON auth_challenges(expires_at);
CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  expires_at INTEGER NOT NULL
);
CREATE INDEX auth_session_expiry ON auth_sessions(expires_at);
CREATE TABLE auth_limits (
  id TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL
);
CREATE TABLE purchase_orders (
  purchase_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id),
  credential_cipher TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX purchase_order_account ON purchase_orders(account_id, created_at);
CREATE TABLE purchase_entitlements (
  purchase_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  credential_cipher TEXT NOT NULL,
  checked_at INTEGER NOT NULL,
  active INTEGER NOT NULL
);
CREATE INDEX purchase_entitlement_account ON purchase_entitlements(account_id, active);
