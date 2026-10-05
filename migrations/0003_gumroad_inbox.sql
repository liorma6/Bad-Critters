-- Keep untrusted notifications encrypted until the provider confirms the purchase.
CREATE TABLE gumroad_inbox (
 id TEXT PRIMARY KEY,
 email_hint TEXT NOT NULL,
 credential_cipher TEXT NOT NULL,
 event_token TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX gumroad_inbox_email ON gumroad_inbox(email_hint,created_at);
