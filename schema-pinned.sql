-- Apply ONCE to existing D1, after schema-real.sql. Back up D1 first.
ALTER TABLE as_cars ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS as_cars_dealer_pinned ON as_cars(user_id,status,pinned);
