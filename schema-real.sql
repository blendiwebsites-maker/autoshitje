-- Run ONCE in Cloudflare D1 Console for autoshitje-db. Existing demo tables are untouched.
CREATE TABLE IF NOT EXISTS as_users (id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,salt TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'privat',is_admin INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS as_sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES as_users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS as_sessions_user ON as_sessions(user_id);
CREATE TABLE IF NOT EXISTS as_cars (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES as_users(id),brand TEXT NOT NULL,model TEXT NOT NULL,year INTEGER NOT NULL,km INTEGER NOT NULL,price REAL NOT NULL,city TEXT NOT NULL,fuel TEXT,gear TEXT,phone TEXT NOT NULL,description TEXT,photo_key TEXT,status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS as_cars_status_date ON as_cars(status,created_at DESC);
CREATE INDEX IF NOT EXISTS as_cars_owner ON as_cars(user_id);
