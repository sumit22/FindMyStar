import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

// ============================================================================
// Types
// ============================================================================

export interface CelestialObject {
  id: number;
  name: string;
  commonName: string | null;
  type: string;
  ra: number | null;
  dec: number | null;
  magnitude: number;
  hipId: number | null;
  planetId: number | null;
  distanceLy: number | null;
  description: string | null;
  isPro: boolean;
}

export interface TrackedObject {
  id: number;
  objectId: number;
  enabled: boolean;
  lat: number;
  lon: number;
  minAltitude: number;
  notifyBeforeMinutes: number;
  nextRiseMs: number | null;
  nextSetMs: number | null;
  isRecurring: boolean;
  lastNotifiedAt: number | null;
}

export interface AlarmConfig {
  lat: number;
  lon: number;
  minAltitude?: number;
  notifyBeforeMinutes?: number;
  isRecurring?: boolean;
}

// ============================================================================
// LRU Cache
// ============================================================================

class LRUCache<K, V> {
  private map = new Map<K, V>();
  constructor(private capacity: number) {}

  get(key: K): V | undefined {
    const val = this.map.get(key);
    if (val !== undefined) {
      // Move to end (most recent)
      this.map.delete(key);
      this.map.set(key, val);
    }
    return val;
  }

  set(key: K, val: V): void {
    this.map.delete(key);
    this.map.set(key, val);
    if (this.map.size > this.capacity) {
      const first = this.map.keys().next().value;
      if (first !== undefined) {
        this.map.delete(first);
      }
    }
  }

  clear(): void {
    this.map.clear();
  }
}

// ============================================================================
// Repository
// ============================================================================

let dbPromise: Promise<SQLiteDatabase> | null = null;
const objectCache = new LRUCache<number, CelestialObject>(100);

function mapRow(row: Record<string, unknown>): CelestialObject {
  return {
    id: row.id as number,
    name: row.name as string,
    commonName: (row.common_name as string) ?? null,
    type: row.type as string,
    ra: (row.ra as number) ?? null,
    dec: (row.dec as number) ?? null,
    magnitude: row.magnitude as number,
    hipId: (row.hip_id as number) ?? null,
    planetId: (row.planet_id as number) ?? null,
    distanceLy: (row.distance_ly as number) ?? null,
    description: (row.description as string) ?? null,
    isPro: (row.is_pro as number) === 1,
  };
}

function mapTrackedRow(row: Record<string, unknown>): TrackedObject {
  return {
    id: row.id as number,
    objectId: row.object_id as number,
    enabled: (row.enabled as number) === 1,
    lat: row.lat as number,
    lon: row.lon as number,
    minAltitude: row.min_altitude as number,
    notifyBeforeMinutes: row.notify_before_minutes as number,
    nextRiseMs: (row.next_rise_ms as number) ?? null,
    nextSetMs: (row.next_set_ms as number) ?? null,
    isRecurring: (row.is_recurring as number) === 1,
    lastNotifiedAt: (row.last_notified_at as number) ?? null,
  };
}

function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabase({
      name: 'findmystar.db',
      location: 'default',
      createFromLocation: '~findmystar.db',
    });
  }
  return dbPromise;
}

async function query<T>(
  sql: string,
  params: (string | number | null)[],
  mapper: (row: Record<string, unknown>) => T,
): Promise<T[]> {
  const conn = await getDb();
  const [results] = await conn.executeSql(sql, params);
  const rows: T[] = [];
  for (let i = 0; i < results.rows.length; i++) {
    rows.push(mapper(results.rows.item(i)));
  }
  return rows;
}

async function execute(sql: string, params: (string | number | null)[]): Promise<number> {
  const conn = await getDb();
  const [result] = await conn.executeSql(sql, params);
  return result.insertId ?? 0;
}

// ============================================================================
// Public API
// ============================================================================

export async function search(
  queryStr: string,
  limit = 50,
  includePro = true,
): Promise<CelestialObject[]> {
  const pattern = `%${queryStr}%`;
  const proFilter = includePro ? '' : ' AND is_pro = 0';
  return query(
    `SELECT * FROM objects WHERE (name LIKE ? OR common_name LIKE ?)${proFilter} ORDER BY magnitude ASC LIMIT ?`,
    [pattern, pattern, limit],
    mapRow,
  );
}

export async function getById(id: number): Promise<CelestialObject | null> {
  const cached = objectCache.get(id);
  if (cached) {
    return cached;
  }
  const rows = await query('SELECT * FROM objects WHERE id = ?', [id], mapRow);
  if (rows.length > 0) {
    objectCache.set(id, rows[0]);
    return rows[0];
  }
  return null;
}

export async function getByType(type: string, includePro = true): Promise<CelestialObject[]> {
  const proFilter = includePro ? '' : ' AND is_pro = 0';
  return query(
    `SELECT * FROM objects WHERE type = ?${proFilter} ORDER BY magnitude ASC`,
    [type],
    mapRow,
  );
}

export async function getAllObjects(includePro = true): Promise<CelestialObject[]> {
  const proFilter = includePro ? '' : ' WHERE is_pro = 0';
  return query(`SELECT * FROM objects${proFilter} ORDER BY magnitude ASC`, [], mapRow);
}

export async function getTrackedObjects(): Promise<TrackedObject[]> {
  return query('SELECT * FROM tracked_objects ORDER BY id ASC', [], mapTrackedRow);
}

export async function createTrackedObject(objectId: number, config: AlarmConfig): Promise<number> {
  const id = await execute(
    `INSERT INTO tracked_objects (object_id, lat, lon, min_altitude, notify_before_minutes, is_recurring)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      objectId,
      config.lat,
      config.lon,
      config.minAltitude ?? 10.0,
      config.notifyBeforeMinutes ?? 15,
      config.isRecurring !== false ? 1 : 0,
    ],
  );
  return id;
}

export async function updateTrackedObject(
  id: number,
  config: Partial<AlarmConfig> & {
    enabled?: boolean;
    nextRiseMs?: number | null;
    nextSetMs?: number | null;
  },
): Promise<void> {
  const sets: string[] = [];
  const params: (string | number | null)[] = [];

  if (config.lat !== undefined) {
    sets.push('lat = ?');
    params.push(config.lat);
  }
  if (config.lon !== undefined) {
    sets.push('lon = ?');
    params.push(config.lon);
  }
  if (config.minAltitude !== undefined) {
    sets.push('min_altitude = ?');
    params.push(config.minAltitude);
  }
  if (config.notifyBeforeMinutes !== undefined) {
    sets.push('notify_before_minutes = ?');
    params.push(config.notifyBeforeMinutes);
  }
  if (config.isRecurring !== undefined) {
    sets.push('is_recurring = ?');
    params.push(config.isRecurring ? 1 : 0);
  }
  if (config.enabled !== undefined) {
    sets.push('enabled = ?');
    params.push(config.enabled ? 1 : 0);
  }
  if (config.nextRiseMs !== undefined) {
    sets.push('next_rise_ms = ?');
    params.push(config.nextRiseMs);
  }
  if (config.nextSetMs !== undefined) {
    sets.push('next_set_ms = ?');
    params.push(config.nextSetMs);
  }

  if (sets.length === 0) {
    return;
  }
  params.push(id);
  await execute(`UPDATE tracked_objects SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function deleteTrackedObject(id: number): Promise<void> {
  await execute('DELETE FROM tracked_objects WHERE id = ?', [id]);
}

// ============================================================================
// Entitlement Storage
// ============================================================================

export async function getEntitlementPayload(): Promise<string | null> {
  const conn = await getDb();
  const [results] = await conn.executeSql('SELECT payload FROM entitlements WHERE id = 1', []);
  if (results.rows.length > 0) {
    // payload is stored as a base64 string in TEXT column
    return results.rows.item(0).payload as string;
  }
  return null;
}

export async function saveEntitlementPayload(
  payloadBase64: string,
  planType: number,
  validUntilMs: number | null,
): Promise<void> {
  await execute(
    `INSERT OR REPLACE INTO entitlements (id, payload, plan_type, valid_until_ms, updated_at)
     VALUES (1, ?, ?, ?, strftime('%s', 'now'))`,
    [payloadBase64, planType, validUntilMs],
  );
}

export async function deleteEntitlement(): Promise<void> {
  await execute('DELETE FROM entitlements WHERE id = 1', []);
}

export function clearCache(): void {
  objectCache.clear();
}
