-- Apply once to the existing Cloudflare D1 database before enabling the follow API.
CREATE TABLE IF NOT EXISTS as_dealer_follows (
 user_id TEXT NOT NULL REFERENCES as_users(id) ON DELETE CASCADE,
 dealer_id TEXT NOT NULL REFERENCES as_users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (user_id,dealer_id)
);
CREATE INDEX IF NOT EXISTS as_dealer_follows_feed ON as_dealer_follows(dealer_id,created_at);
