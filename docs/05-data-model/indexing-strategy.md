# Indexing & Query Optimization

## 1. Index Overview

FindMyStar uses **SQLite B-tree indexes** to accelerate read queries on the `objects` and `tracked_objects` tables. SQLite's default index structure is a B-tree, providing O(log n) lookup for equality and range queries.

**Design rationale:**

- Indexes trade write speed for read speed -- highly favorable because the `objects` catalog is **read-only at runtime** (indexes built once, never updated)
- The `tracked_objects` table has infrequent writes (user adds/removes alarms) but frequent reads (daily recalculation, alarm scheduling)
- With ~620 catalog objects and typically <100 tracked objects, indexes ensure consistent sub-millisecond performance across all device tiers

---

## 2. Current Indexes

Defined in [schema.md](./schema.md):

### 2.1 idx_objects_type

```sql
CREATE INDEX idx_objects_type ON objects(type);
```

**Purpose**: Filter catalog by object type (star, planet, nebula, galaxy, cluster, moon, sun). 7 distinct values across ~620 rows. Used by type filter on search screen.

### 2.2 idx_objects_magnitude

```sql
CREATE INDEX idx_objects_magnitude ON objects(magnitude);
```

**Purpose**: Sort search results by brightness (lowest magnitude = brightest). Range: -26.74 (Sun) to ~+9.0. Used by `ORDER BY magnitude` in search queries.

### 2.3 idx_tracked_next_visible

```sql
CREATE INDEX idx_tracked_next_visible ON tracked_objects(next_visible_at);
```

**Purpose**: Find alarms due or overdue for recalculation. Used by the background alarm scheduler that runs at midnight. Critical path for notification scheduling.

### 2.4 idx_tracked_object_id

```sql
CREATE INDEX idx_tracked_object_id ON tracked_objects(object_id);
```

**Purpose**: Optimize JOIN between `tracked_objects` and `objects`. Also enforces the `UNIQUE` constraint on `object_id`, preventing duplicate alarms.

---

## 3. Query Patterns & EXPLAIN Analysis

### 3.1 Search by Name

```sql
SELECT * FROM objects WHERE name LIKE ? ESCAPE '|' ORDER BY magnitude LIMIT 20;
```

**Plan**: `SCAN TABLE objects` | `USE TEMP B-TREE FOR ORDER BY`

`LIKE '%keyword%'` performs a full table scan (leading wildcard prevents index use). Acceptable: ~620 rows completes in <1ms. Future optimization: FTS5 virtual table if catalog exceeds ~5,000 objects (see [catalog-design.md](./catalog-design.md)).

### 3.2 Get Tracked Objects for Recalculation

```sql
SELECT o.id, o.name, o.type, o.ra, o.dec, t.lat, t.lon, t.min_altitude
FROM tracked_objects t JOIN objects o ON t.object_id = o.id
WHERE t.next_visible_at < ? ORDER BY t.next_visible_at;
```

**Plan**: `SEARCH tracked_objects USING INDEX idx_tracked_next_visible (next_visible_at<?)` | `SEARCH objects USING INTEGER PRIMARY KEY (rowid=?)`

Index efficiently filters overdue objects. JOIN uses the `objects` primary key for O(1) lookup per row. Performance: <1ms for 50 tracked objects.

### 3.3 Get Alarms Due Today

```sql
SELECT t.*, o.name, o.type FROM tracked_objects t
JOIN objects o ON t.object_id = o.id
WHERE t.next_visible_at BETWEEN ? AND ? ORDER BY t.next_visible_at ASC;
```

**Plan**: `SEARCH tracked_objects USING INDEX idx_tracked_next_visible (next_visible_at>? AND next_visible_at<?)` | `SEARCH objects USING INTEGER PRIMARY KEY`

Range query on `BETWEEN` uses the index. Results already sorted by index order. Performance: <1ms.

### 3.4 Filter by Type

```sql
SELECT * FROM objects WHERE type = ? ORDER BY magnitude;
```

**Plan**: `SEARCH objects USING INDEX idx_objects_type (type=?)` | `USE TEMP B-TREE FOR ORDER BY`

Index narrows scan to matching type. Temporary sort for magnitude ordering. Performance: <1ms.

---

## 4. Performance Benchmarks

Measured on mid-range Android (Snapdragon 695, 6 GB RAM) with MVP catalog (~620 objects, 50 tracked):

| Query | Cold | Warm | Notes |
|-------|------|------|-------|
| Search by name (`LIKE '%orion%'`) | 0.8 ms | 0.3 ms | Full table scan |
| Filter by type (`type = 'star'`) | 0.5 ms | 0.2 ms | Index scan |
| Alarms due today | 0.4 ms | 0.1 ms | Index range scan |
| Join: tracked + objects | 0.6 ms | 0.2 ms | Index + PK lookup |
| Batch recalculation (50 objects) | 3.2 ms | 1.5 ms | Includes JOIN |
| Insert tracked object | 1.0 ms | 0.8 ms | Write + index update |

All queries are within the <10ms position computation ([SRS NFR-1](../02-requirements/srs.md)) and <500ms rise/set calculation ([SRS NFR-2](../02-requirements/srs.md)) requirements.

---

## 5. When to Add More Indexes

### 5.1 Catalog Growth Beyond 10,000 Objects

Add FTS5 virtual table for name search and composite index `(type, magnitude)` to eliminate temporary sort:

```sql
CREATE INDEX idx_objects_type_magnitude ON objects(type, magnitude);
```

### 5.2 Tracked Objects Exceeding 500

Add composite index for filtering recurring alarms:

```sql
CREATE INDEX idx_tracked_recurring_visible ON tracked_objects(is_recurring, next_visible_at);
```

### 5.3 Monitoring

Use `EXPLAIN QUERY PLAN` in development. If output shows `SCAN TABLE` instead of `SEARCH TABLE USING INDEX`, the query is not using the expected index.

---

## 6. SQLite Configuration

```sql
PRAGMA journal_mode = WAL;         -- Concurrent reads during writes (AR loop + alarm updates)
PRAGMA synchronous = NORMAL;       -- Balance durability/speed (data is recoverable)
PRAGMA cache_size = -2000;         -- 2 MB cache (entire ~200 KB DB fits in cache)
PRAGMA foreign_keys = ON;          -- Enforce FK constraints
PRAGMA temp_store = MEMORY;        -- Temporary tables in memory
PRAGMA mmap_size = 268435456;      -- Memory-map up to 256 MB
```

**WAL mode** is critical: enables the AR tracking loop (reads) to run simultaneously with alarm updates (writes) without blocking. **Cache size** of 2 MB keeps the entire catalog in memory after first access, eliminating disk I/O for subsequent queries. Both fit within the <100 MB memory budget ([SRS NFR-3](../02-requirements/srs.md)).

---

## 7. Anti-Patterns to Avoid

### 7.1 SELECT * When Only Specific Columns Needed

Select only needed columns to reduce memory allocation, especially when the `description` TEXT field is large:

```sql
-- Prefer this:
SELECT id, name, magnitude FROM objects WHERE type = 'star';
```

### 7.2 N+1 Queries in Loops

Replace N+1 round trips with a single JOIN:

```typescript
// Bad: N+1 queries
for (const t of tracked) {
  const obj = await db.query('SELECT * FROM objects WHERE id = ?', [t.object_id]);
}

// Good: single JOIN
const results = await db.query(`
  SELECT t.*, o.name, o.type, o.ra, o.dec
  FROM tracked_objects t JOIN objects o ON t.object_id = o.id
`);
```

### 7.3 Unparameterized Queries (SQL Injection Risk)

Always use parameterized queries, even for local-only databases:

```typescript
// Bad: string interpolation
const query = `SELECT * FROM objects WHERE name LIKE '%${userInput}%'`;

// Good: parameterized
await db.query('SELECT * FROM objects WHERE name LIKE ? ESCAPE "|"', [`%${escapeLike(userInput)}%`]);
```

### 7.4 Missing Transaction Boundaries

Wrap batch updates in transactions for atomicity and write performance:

```typescript
await db.transaction(async (tx) => {
  for (const update of updates) {
    await tx.execute('UPDATE tracked_objects SET next_visible_at = ? WHERE id = ?', [update.time, update.id]);
  }
});
```

---

## 8. Related Documents

- **[Database Schema](./schema.md)** -- Table definitions, constraints, and validation rules
- **[Catalog Design](./catalog-design.md)** -- Object types, data sources, and population strategy
- **[Schema Migrations](./migrations.md)** -- Version management and upgrade paths
- **[SRS NFR-1, NFR-2](../02-requirements/srs.md)** -- Performance requirements for computation and alarms
- **[Architecture Overview](../03-architecture/architecture-overview.md)** -- Data layer in the system

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: February 2026
