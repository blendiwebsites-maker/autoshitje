-- Ekzekutoje në Cloudflare D1 Console PARA ngarkimit. Nuk prek të dhënat ekzistuese.
CREATE TABLE IF NOT EXISTS as_admin_promotions (
 type TEXT NOT NULL CHECK(type IN ('car','dealer')),
 target_id TEXT NOT NULL,
 position INTEGER NOT NULL DEFAULT 1,
 starts_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ends_at TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(type,target_id)
);
CREATE INDEX IF NOT EXISTS idx_as_admin_promotions_active ON as_admin_promotions(enabled,ends_at,position);
CREATE TABLE IF NOT EXISTS as_admin_banners (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 image_url TEXT NOT NULL,
 link_url TEXT NOT NULL,
 position INTEGER NOT NULL DEFAULT 1,
 enabled INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
