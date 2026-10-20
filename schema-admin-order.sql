-- Ekzekuto VETEM NJE HERE ne Cloudflare D1 Console para deploy-it.
-- Nuk fshin ose ndryshon rekordet ekzistuese.
CREATE TABLE IF NOT EXISTS as_dealer_order (
 user_id TEXT PRIMARY KEY REFERENCES as_users(id) ON DELETE CASCADE,
 position INTEGER NOT NULL CHECK(position >= 1)
);
CREATE INDEX IF NOT EXISTS idx_as_dealer_order_position ON as_dealer_order(position);
