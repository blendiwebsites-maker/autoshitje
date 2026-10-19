-- Run once in Cloudflare D1 Console BEFORE deploying this release. Existing records are retained.
ALTER TABLE as_cars ADD COLUMN category TEXT NOT NULL DEFAULT '';
ALTER TABLE as_cars ADD COLUMN customs TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_as_cars_recent ON as_cars(status,created_at);
CREATE INDEX IF NOT EXISTS idx_as_cars_category ON as_cars(category,status);
