# Database Schema

## SQLite Schema Definition

```sql
-- Celestial Objects Catalog
CREATE TABLE objects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,  -- 'star', 'planet', 'nebula', 'galaxy', 'moon', 'sun'
  ra REAL,             -- Right Ascension in hours (0-24), NULL for planets
  dec REAL,            -- Declination in degrees (-90 to +90), NULL for planets
  magnitude REAL,      -- Apparent magnitude
  distance_ly REAL,    -- Distance in light-years (NULL for solar system)
  description TEXT,
  created_at INTEGER   -- Unix timestamp
);

CREATE INDEX idx_objects_type ON objects(type);
CREATE INDEX idx_objects_magnitude ON objects(magnitude);

-- Tracked Objects (User Alarms)
CREATE TABLE tracked_objects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_id INTEGER NOT NULL UNIQUE,
  lat REAL NOT NULL,        -- Observer latitude when alarm set
  lon REAL NOT NULL,        -- Observer longitude when alarm set
  min_altitude REAL,        -- Minimum altitude for notification (default 10°)
  next_visible_at INTEGER,  -- Unix timestamp of next rise
  is_recurring INTEGER,     -- Boolean: 0 = one-time, 1 = recurring
  created_at INTEGER,
  last_notified_at INTEGER, -- Timestamp of last notification
  
  FOREIGN KEY(object_id) REFERENCES objects(id)
);

CREATE INDEX idx_tracked_next_visible ON tracked_objects(next_visible_at);
CREATE INDEX idx_tracked_object_id ON tracked_objects(object_id);

-- User Preferences
CREATE TABLE user_preferences (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  notification_enabled INTEGER,  -- Boolean
  min_altitude_default REAL,     -- Default min altitude (degrees)
  auto_calibration INTEGER,      -- Auto-calibrate orientation
  dark_mode INTEGER              -- UI theme
);
```

## Schema Design Notes

### objects Table

**Why split from tracked_objects?**
- Catalog is read-only, pre-loaded from app bundle
- Can be updated independently in future versions
- Normalized design for efficiency

**Fields**:
- `ra`, `dec`: Fixed for stars (precomputed)
- `NULL` for planets (computed at runtime)
- `magnitude`: Critical for filtering search results
- `distance_ly`: For informational display

### tracked_objects Table

**Purpose**: Tracks user-set alarms

**Key Columns**:
- `next_visible_at`: Sorted by this for daily recalculation
- `lat`, `lon`: Stored at alarm creation time (location may change)
- `min_altitude`: Customizable visibility threshold

**Indexes**:
- Fast lookup of alarms to reschedule
- Prevents duplicate alarms for same object

---

## Data Migration Strategy

### Version 1.0 → 1.1
```sql
-- Example: Add new column to tracked_objects
ALTER TABLE tracked_objects ADD COLUMN snooze_until INTEGER DEFAULT NULL;
```

**Migration Philosophy**:
- All schema versions backward compatible
- Old app can run with newer DB schema
- New app handles old DB schema gracefully

---

## Data Validation Rules

### objects Table
| Column | Min | Max | Required |
|--------|-----|-----|----------|
| name | 1 char | 100 chars | ✅ |
| ra | 0 | 24 | For stars only |
| dec | -90 | +90 | For stars only |
| magnitude | -27 | +17 | ✅ |
| distance_ly | 0 | 1e10 | Optional |

### tracked_objects Table
| Column | Min | Max | Required |
|--------|-----|-----|----------|
| lat | -90 | +90 | ✅ |
| lon | -180 | +180 | ✅ |
| min_altitude | -90 | +90 | ✅ (default 10) |
| next_visible_at | now | now+48h | ✅ |

---

## Query Patterns

### Search by Name
```sql
SELECT * FROM objects 
WHERE name LIKE ? ESCAPE '|' 
ORDER BY magnitude 
LIMIT 20;
```

### Get Tracked Objects for Recalculation
```sql
SELECT o.id, o.name, o.type, o.ra, o.dec, t.lat, t.lon
FROM tracked_objects t
JOIN objects o ON t.object_id = o.id
WHERE t.next_visible_at < ?  -- Past due for recalculation
ORDER BY t.next_visible_at DESC;
```

### Get Alarms Due Today
```sql
SELECT * FROM tracked_objects
WHERE next_visible_at BETWEEN ? AND ?  -- Today's date range
ORDER BY next_visible_at ASC;
```

---

## Catalog Statistics

### Object Coverage (MVP)

| Type | Count | Examples |
|------|-------|----------|
| Sun | 1 | Sun |
| Moon | 1 | Moon |
| Planets | 8 | Mercury through Neptune |
| Bright Stars | 100-500 | Hipparcos mag < 5 |
| Messier Objects | ~110 | M1 through M110 |
| **Total** | **~620** | |

### Approximate Storage

| Data | Size |
|------|------|
| Catalog SQL | ~100 KB |
| Indices | ~50 KB |
| User Preferences | <1 KB |
| 50 Tracked Objects | ~10 KB |
| **Total** | **~200 KB** |

---

## Backup & Recovery

### Backup Strategy
```typescript
// On app startup
if (corrupt_catalog_detected()) {
  restore_from_bundled_backup();
  reload_db();
}
```

### Corruption Detection
```sql
-- Verify catalog integrity
PRAGMA integrity_check;
```

---

**Database Design Status**: Complete  
**Version**: 1.0  
**Last Updated**: February 2026
