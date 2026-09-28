-- netflick-db (Cloudflare D1) — replaces the Notion "Players" data source, 28 Sep 2026
CREATE TABLE IF NOT EXISTS players (
  id         TEXT PRIMARY KEY,   -- UUID (imported rows keep their Notion page id)
  name       TEXT NOT NULL,
  gender     TEXT,               -- Male | Female
  level      TEXT,               -- A | B | C
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_players_active_name ON players(active, name);
