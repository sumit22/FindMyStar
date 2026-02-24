-- FindMyStar Database Schema v1.0
-- SQLite with WAL journal mode

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Celestial Objects Catalog (read-only, pre-loaded from app bundle)
CREATE TABLE IF NOT EXISTS objects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  common_name TEXT,
  type TEXT NOT NULL CHECK (type IN ('star', 'planet', 'nebula', 'galaxy', 'cluster', 'planetary_nebula', 'moon', 'sun')),
  ra REAL CHECK (ra IS NULL OR (ra >= 0 AND ra < 24)),
  dec REAL CHECK (dec IS NULL OR (dec >= -90 AND dec <= 90)),
  magnitude REAL NOT NULL CHECK (magnitude >= -27 AND magnitude <= 17),
  hip_id INTEGER,
  planet_id INTEGER CHECK (planet_id IS NULL OR (planet_id >= 1 AND planet_id <= 8)),
  distance_ly REAL CHECK (distance_ly IS NULL OR distance_ly >= 0),
  description TEXT,
  is_pro INTEGER NOT NULL DEFAULT 0 CHECK (is_pro IN (0, 1)),
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_objects_type ON objects(type);
CREATE INDEX IF NOT EXISTS idx_objects_magnitude ON objects(magnitude);
CREATE INDEX IF NOT EXISTS idx_objects_name ON objects(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_objects_hip_id ON objects(hip_id) WHERE hip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_objects_planet_id ON objects(planet_id) WHERE planet_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_objects_is_pro ON objects(is_pro) WHERE is_pro = 1;

-- Tracked Objects (User Alarms)
CREATE TABLE IF NOT EXISTS tracked_objects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_id INTEGER NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  lat REAL NOT NULL CHECK (lat >= -90 AND lat <= 90),
  lon REAL NOT NULL CHECK (lon >= -180 AND lon <= 180),
  min_altitude REAL NOT NULL DEFAULT 10.0 CHECK (min_altitude >= -90 AND min_altitude <= 90),
  notify_before_minutes INTEGER NOT NULL DEFAULT 15 CHECK (notify_before_minutes >= 0 AND notify_before_minutes <= 120),
  next_rise_ms INTEGER,
  next_set_ms INTEGER,
  is_recurring INTEGER NOT NULL DEFAULT 1 CHECK (is_recurring IN (0, 1)),
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  last_notified_at INTEGER,
  FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tracked_next_rise ON tracked_objects(next_rise_ms);
CREATE INDEX IF NOT EXISTS idx_tracked_object_id ON tracked_objects(object_id);
CREATE INDEX IF NOT EXISTS idx_tracked_enabled ON tracked_objects(enabled) WHERE enabled = 1;

-- User Preferences (key-value store)
CREATE TABLE IF NOT EXISTS user_preferences (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Entitlements (singleton row — device-bound HMAC-signed blob)
CREATE TABLE IF NOT EXISTS entitlements (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload BLOB NOT NULL,
  plan_type INTEGER NOT NULL DEFAULT 0,
  valid_until_ms INTEGER,
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Default preferences
INSERT OR IGNORE INTO user_preferences (key, value) VALUES ('theme', 'dark');
INSERT OR IGNORE INTO user_preferences (key, value) VALUES ('notifications_enabled', '1');
INSERT OR IGNORE INTO user_preferences (key, value) VALUES ('min_altitude_default', '10');
INSERT OR IGNORE INTO user_preferences (key, value) VALUES ('schema_version', '1');
