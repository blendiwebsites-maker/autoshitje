-- Ekzekuto pasi të jenë aplikuar schema-real.sql, schema-admin.sql, schema-features.sql.
-- CREATE TABLE / INDEX janë të sigurta për përsëritje; ALTER TABLE nga schema-features.sql vetëm një herë.
CREATE TABLE IF NOT EXISTS as_dealer_profiles (user_id TEXT PRIMARY KEY REFERENCES as_users(id) ON DELETE CASCADE,slug TEXT UNIQUE,address TEXT NOT NULL DEFAULT '',city TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',whatsapp TEXT NOT NULL DEFAULT '',hours TEXT NOT NULL DEFAULT '',instagram TEXT NOT NULL DEFAULT '',facebook TEXT NOT NULL DEFAULT '',logo_url TEXT NOT NULL DEFAULT '',cover_url TEXT NOT NULL DEFAULT '',featured INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS as_favorites (user_id TEXT NOT NULL REFERENCES as_users(id) ON DELETE CASCADE,car_id TEXT NOT NULL REFERENCES as_cars(id) ON DELETE CASCADE,PRIMARY KEY(user_id,car_id));
CREATE TABLE IF NOT EXISTS as_deletion_requests (user_id TEXT PRIMARY KEY REFERENCES as_users(id) ON DELETE CASCADE,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS as_dealers_featured ON as_dealer_profiles(featured);
