-- Ekzekuto ne Cloudflare D1 Console PARA publikimit. Nuk fshin asnje te dhene.
CREATE TABLE IF NOT EXISTS as_admin_suspensions (user_id TEXT PRIMARY KEY REFERENCES as_users(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS as_admin_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT NOT NULL, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL, details TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_as_admin_audit_created ON as_admin_audit(created_at DESC);
