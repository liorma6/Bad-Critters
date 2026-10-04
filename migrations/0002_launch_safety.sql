-- Additive migration. Existing accounts, purchases and recordings are preserved.
CREATE TABLE IF NOT EXISTS purchase_attempts (
 account_id TEXT PRIMARY KEY REFERENCES accounts(id),
 reference TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL CHECK(status IN ('creating','unknown','ready')),
 created_at INTEGER NOT NULL,
 purchase_id TEXT
);
CREATE TABLE IF NOT EXISTS auth_requests (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL,
 challenge_id TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 sent INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS auth_metrics (
 day TEXT NOT NULL,
 event TEXT NOT NULL,
 count INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(day,event)
);
CREATE TABLE IF NOT EXISTS purchase_history (
 purchase_id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES accounts(id),
 credential_cipher TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 closed_status TEXT NOT NULL
);
