# Schema Migration Strategy

## 1. Migration Philosophy

FindMyStar follows a **backward-compatible, additive-only** migration strategy:

- **All migrations are backward compatible**: A newer schema works with an older app version
- **Old app runs with newer schema**: Additional columns/tables are ignored by older app versions
- **New app handles old schema gracefully**: Checks version on startup, runs pending migrations
- **Never delete columns, only add**: Deprecated columns left in place, ignored by new code
- **Never rename columns**: Add a new column instead, read from it with fallback to old column

These principles ensure the database is always usable regardless of which app version created it.

---

## 2. Version Tracking

### 2.1 PRAGMA user_version

SQLite's built-in `user_version` integer field tracks the current schema version:

```sql
PRAGMA user_version;          -- Read current version
PRAGMA user_version = 2;      -- Set version (after migration completes)
```

- Persists across connections (stored in file header)
- Atomic when set within a migration transaction
- Default `0` for fresh databases; FindMyStar's initial release sets `user_version = 1`

### 2.2 Version Check on Startup

1. Open SQLite database connection
2. Read `PRAGMA user_version`
3. Compare against app's expected schema version
4. If database version is lower, run pending migrations sequentially
5. If database version is higher (user downgraded), proceed without changes (backward compatibility)

---

## 3. Migration Framework

### 3.1 Migration Interface

```typescript
interface Migration {
  version: number;        // Schema version this migration upgrades TO
  description: string;    // Human-readable description
  up(): string[];         // SQL statements to execute
}
```

### 3.2 Migration Registry

Migrations are registered in a central ordered array. Version 1 creates the initial schema (all tables and indexes from [schema.md](./schema.md)). Each subsequent entry adds only the delta.

```typescript
const MIGRATIONS: Migration[] = [
  { version: 1, description: 'Initial schema', up() { return [/* CREATE TABLE/INDEX statements */]; } },
  // Future migrations appended here...
];

function pendingMigrations(currentVersion: number): Migration[] {
  return MIGRATIONS.filter((m) => m.version > currentVersion).sort((a, b) => a.version - b.version);
}
```

---

## 4. Migration Examples

### 4.1 Version 1 to 2: Snooze and Theme Support

```typescript
{
  version: 2,
  description: 'Add snooze support for alarms and theme preference',
  up() {
    return [
      `ALTER TABLE tracked_objects ADD COLUMN snooze_until INTEGER DEFAULT NULL`,
      `ALTER TABLE user_preferences ADD COLUMN theme TEXT DEFAULT 'auto'`,
    ];
  },
}
```

The old `dark_mode` column is **not removed** -- older app versions continue to read it. New versions read `theme` and ignore `dark_mode`.

### 4.2 Version 2 to 3: Observation Log (Phase 2)

```typescript
{
  version: 3,
  description: 'Add observation log for tracking viewing history',
  up() {
    return [
      `CREATE TABLE observation_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        object_id INTEGER NOT NULL, observed_at INTEGER NOT NULL,
        lat REAL NOT NULL, lon REAL NOT NULL, altitude_deg REAL,
        conditions TEXT, notes TEXT,
        FOREIGN KEY(object_id) REFERENCES objects(id)
      )`,
      `CREATE INDEX idx_observation_object ON observation_log(object_id)`,
      `CREATE INDEX idx_observation_date ON observation_log(observed_at)`,
    ];
  },
}
```

Adds an entirely new table -- fully backward compatible. Supports Phase 2 features in the [roadmap](../01-product/roadmap.md).

---

## 5. Migration Execution

### 5.1 Core Runner

```typescript
async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const currentVersion = await db.pragma('user_version') as number;
  const pending = pendingMigrations(currentVersion);
  if (pending.length === 0) return;

  for (const migration of pending) {
    await db.transaction(async (tx) => {
      for (const sql of migration.up()) {
        await tx.execute(sql);
      }
      await tx.execute(`PRAGMA user_version = ${migration.version}`);
    });
  }
}
```

Each migration runs inside a **single transaction**: if any statement fails, the entire migration rolls back and `user_version` remains unchanged. This prevents half-migrated states.

### 5.2 Startup Integration

```typescript
async function initializeDatabase(): Promise<SQLiteDatabase> {
  const db = await openDatabase('findmystar.db');
  await db.execute('PRAGMA journal_mode = WAL');
  await db.execute('PRAGMA foreign_keys = ON');
  await runMigrations(db);
  return db;
}
```

---

## 6. Testing Migrations

### 6.1 Upgrade Path Testing

Every supported upgrade path must be tested:

| From Version | To Version | Test Description |
|-------------|------------|------------------|
| 0 (fresh) | latest | Clean install runs all migrations |
| 1 | latest | Original users upgrading |
| N-1 | latest | Single-step upgrade |

### 6.2 Data Preservation

Each migration test verifies existing data survives: create a database at version N with test data, run migration to N+1, assert all prior rows are intact and new columns have expected defaults (e.g., `snooze_until` is `NULL`).

### 6.3 Failure Rollback

Test that a migration containing invalid SQL throws an error, does not advance `user_version`, and rolls back any partial DDL changes within the transaction.

---

## 7. Catalog Updates

Catalog updates (changing data in `objects`) are handled **separately from schema migrations** which change table structure. See [catalog-design.md Section 7](./catalog-design.md) for versioning details.

### 7.1 Merge Strategy

```sql
INSERT OR REPLACE INTO objects (name, type, ra, dec, magnitude, distance_ly, description, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?);
```

### 7.2 Preserving Tracked Objects

Because `INSERT OR REPLACE` can change object `id` values, tracked objects must be re-linked:

1. Before update: map existing tracked object names to their alarm rows
2. Upsert all catalog objects
3. After update: re-link `tracked_objects.object_id` to new IDs by matching on `objects.name`
4. Catalog updates never remove objects to prevent dangling foreign keys

---

## 8. Backup Before Migration

### 8.1 Pre-Migration Backup

```typescript
async function backupDatabase(dbPath: string): Promise<string> {
  const backupPath = `${dbPath}.backup-${Date.now()}`;
  await FileSystem.copyFile(dbPath, backupPath);
  return backupPath;
}
```

### 8.2 Restore on Failure

```typescript
async function safeRunMigrations(db: SQLiteDatabase, dbPath: string): Promise<void> {
  const backupPath = await backupDatabase(dbPath);
  try {
    await runMigrations(db);
    await FileSystem.deleteFile(backupPath);  // Success: remove backup
  } catch (error) {
    await db.close();
    await FileSystem.copyFile(backupPath, dbPath);  // Restore from backup
    throw new MigrationError('Migration failed. Database restored to previous state.', error);
  }
}
```

### 8.3 User Notification on Failure

If migration fails and backup is restored, the app displays: "The app could not update its database. Please update to the latest version. Your data has been preserved." The app continues functioning with the old schema, degrading gracefully for features that depend on new columns.

---

## 9. Related Documents

- **[Database Schema](./schema.md)** -- Full SQL schema definition and validation rules
- **[Catalog Design](./catalog-design.md)** -- Object types, data sources, and catalog versioning
- **[Indexing Strategy](./indexing-strategy.md)** -- Query optimization and performance benchmarks
- **[Contributing Guide](../CONTRIBUTING.md)** -- Development workflow and testing requirements
- **[Architecture Overview](../03-architecture/architecture-overview.md)** -- Data layer in the system
- **[Roadmap](../01-product/roadmap.md)** -- Phase 2 features driving future migrations

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: February 2026
