-- Ekzekuto në D1 Console përpara publikimit. Nuk fshin të dhëna.
CREATE TABLE IF NOT EXISTS as_password_resets (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES as_users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS as_password_resets_user ON as_password_resets(user_id);
-- PAS regjistrimit të llogarisë personale, aktivizo adminin duke zëvendësuar emailin:
-- UPDATE as_users SET is_admin=1 WHERE email='EMAILI_YT';
