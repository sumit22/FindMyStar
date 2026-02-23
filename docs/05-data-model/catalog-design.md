# Celestial Object Catalog Design

## 1. Catalog Overview

The FindMyStar catalog is a **pre-loaded, offline celestial object database** bundled with the application at build time. It serves as the primary data source for all object searches, AR tracking, and visibility calculations.

- **Total objects**: ~620 (MVP release)
- **Storage format**: Pre-populated SQLite database shipped in app assets
- **Runtime behavior**: Read-only (the catalog is never modified by the user)
- **Update mechanism**: Catalog refreshed only through app updates (see [migrations.md](./migrations.md))

The catalog is intentionally kept small to support the offline-first architecture. All objects are selected for naked-eye or small-binocular visibility, matching the target user base described in [SRS Section 1.2](../02-requirements/srs.md).

---

## 2. Object Types

### 2.1 Sun (1 object)

- **type**: `'sun'` | **ra/dec**: `NULL` | **magnitude**: `-26.74` | **distance_ly**: `NULL`
- Position **computed at runtime** via VSOP87. RA/Dec stored as `NULL` because the Sun moves ~1 degree/day along the ecliptic.

### 2.2 Moon (1 object)

- **type**: `'moon'` | **ra/dec**: `NULL` | **magnitude**: `-12.6` | **distance_ly**: `NULL`
- Position computed at runtime via simplified lunar ephemeris. Magnitude stored as full-moon reference value.

### 2.3 Planets (8 objects)

Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune (Earth excluded -- observer is on Earth).

- **type**: `'planet'` | **ra/dec**: `NULL` (computed at runtime) | **magnitude**: typical opposition value | **distance_ly**: `NULL`
- Positions change daily due to orbital motion. Computed using VSOP87 coefficients bundled separately from SQLite.

### 2.4 Stars (100-500 objects)

Selected from the **Hipparcos catalog**, filtered by apparent magnitude < 5.0 (naked-eye visibility).

- **type**: `'star'` | **ra/dec**: Fixed J2000.0 epoch values | **magnitude**: -1.46 (Sirius) to +5.0 | **distance_ly**: parallax-derived
- J2000.0 coordinates are accurate to within arcseconds for decades, well within the +/-1 degree requirement ([SRS NFR-8](../02-requirements/srs.md)).

### 2.5 Messier Objects (~110 objects)

The complete Messier catalog (M1-M110) with fixed RA/Dec (J2000.0):

| `type` value | Count | Examples |
|-------------|-------|----------|
| `'nebula'` | ~30 | M1 (Crab Nebula), M42 (Orion Nebula), M57 (Ring Nebula) |
| `'galaxy'` | ~40 | M31 (Andromeda), M51 (Whirlpool), M87 (Virgo A) |
| `'cluster'` | ~40 | M13 (Hercules Cluster), M45 (Pleiades), M44 (Beehive) |

Magnitudes range from +1.6 (M45) to ~+9.0. The `distance_ly` field is populated from published measurements.

---

## 3. Data Sources

| Source | Entries | Selection | Reference |
|--------|---------|-----------|-----------|
| **Hipparcos** (ESA) | 118,218 total | ~500 with mag < 5.0 | http://www.cosmos.esa.int/web/hipparcos |
| **Messier** (SEDS) | 110 objects | All (M1-M110) | http://www.messier.seds.org/ |
| **VSOP87** | 8 planets + Sun | Bundled coefficients | Bretagnon & Francou, A&A, 1988 |
| **ELP2000** | Moon | Simplified model | Chapront-Touze & Chapront |

- Hipparcos data exported as CSV from VizieR (CDS, Strasbourg); fields: HIP number, RA, Dec, visual magnitude, parallax
- Messier entries manually curated and verified against multiple sources
- VSOP87 coefficients stored as a separate binary file (~2 MB), not in SQLite
- ELP2000 provides ~10 arcsecond accuracy, sufficient for the app's +/-1 degree requirement

---

## 4. Catalog Schema Design

The catalog uses the `objects` table defined in [schema.md](./schema.md). Key design decisions:

### 4.1 Why RA/Dec Are NULL for Solar System Objects

Solar system objects move too fast for stored coordinates to remain valid:
- **Sun**: ~1 degree/day | **Moon**: ~13 degrees/day | **Planets**: 0.01-0.5 degrees/day
- The application layer detects `NULL` RA/Dec and delegates to the Rust domain engine for real-time computation.

### 4.2 Type Field Values

| Value | RA/Dec Stored | Count | Description |
|-------|---------------|-------|-------------|
| `'sun'` | No (NULL) | 1 | The Sun |
| `'moon'` | No (NULL) | 1 | The Moon |
| `'planet'` | No (NULL) | 8 | Solar system planets |
| `'star'` | Yes (J2000.0) | 100-500 | Fixed stars from Hipparcos |
| `'nebula'` | Yes (J2000.0) | ~30 | Emission/reflection/planetary nebulae |
| `'galaxy'` | Yes (J2000.0) | ~40 | External galaxies |
| `'cluster'` | Yes (J2000.0) | ~40 | Open or globular star clusters |

### 4.3 Magnitude Ranges

Sun (-26.74) through faintest Messier (~+9.0). Solar system magnitudes stored as typical values since they vary with orbital geometry. Stars and deep-sky magnitudes are fixed reference values.

### 4.4 Distance Field

`NULL` for solar system objects (AU distances not meaningful in light-years). Stars use Hipparcos parallax-derived distances. Messier distances from published measurements.

---

## 5. Catalog Population

The catalog is populated at **build time**, not runtime:

1. Source CSV/JSON files stored in the repository under `data/catalog/`
2. Build script (`scripts/build-catalog.ts`) converts source data to SQL INSERT statements
3. Resulting SQLite database bundled into app assets
4. App opens this pre-populated database on first launch

**Example INSERT statements:**

```sql
-- Solar system object (NULL RA/Dec, computed at runtime)
INSERT INTO objects (name, type, ra, dec, magnitude, distance_ly, description, created_at)
VALUES ('Sun', 'sun', NULL, NULL, -26.74, NULL,
        'The star at the center of the Solar System.', strftime('%s', 'now'));

-- Star (fixed J2000.0 coordinates)
INSERT INTO objects (name, type, ra, dec, magnitude, distance_ly, description, created_at)
VALUES ('Sirius', 'star', 6.7525, -16.7161, -1.46, 8.6,
        'Brightest star in the night sky (Alpha Canis Majoris).', strftime('%s', 'now'));

-- Messier object (deep-sky)
INSERT INTO objects (name, type, ra, dec, magnitude, distance_ly, description, created_at)
VALUES ('M31 - Andromeda Galaxy', 'galaxy', 0.7123, 41.2689, 3.4, 2537000,
        'Nearest large spiral galaxy to the Milky Way.', strftime('%s', 'now'));
```

---

## 6. Search Optimization

Primary search query using `LIKE` with escape character:

```sql
SELECT * FROM objects WHERE name LIKE ? ESCAPE '|' ORDER BY magnitude LIMIT 20;
```

- **Substring matching**: `%andromeda%` finds "M31 - Andromeda Galaxy"
- **Case-insensitive**: SQLite `LIKE` is case-insensitive for ASCII by default
- **Result ordering**: Brightest first (lowest magnitude) via `idx_objects_magnitude`
- **Pagination**: `LIMIT 20` for UI performance
- **Performance**: Full table scan <1ms for ~620 rows (see [indexing-strategy.md](./indexing-strategy.md))
- **Future**: FTS5 virtual table for fuzzy matching when catalog grows ([SRS FR-3](../02-requirements/srs.md))

---

## 7. Catalog Versioning

- **Schema version**: Managed via `PRAGMA user_version` (see [migrations.md](./migrations.md))
- **Catalog version**: Stored in `catalog_metadata` table or `user_preferences`
- **Update strategy**: App detects version mismatch on startup, upserts via `INSERT OR REPLACE`
- **Foreign key stability**: Existing `tracked_objects` references preserved across updates
- **Backward compatibility**: Old catalog works with new app; new catalog ignored by old app
- Catalog updates never remove objects to prevent dangling foreign keys in `tracked_objects`

---

## 8. Storage Budget

| Data Component | Count | Estimated Size |
|---------------|-------|----------------|
| Star records | ~500 | ~60 KB |
| Messier records | ~110 | ~15 KB |
| Solar system records | 10 | ~2 KB |
| Object descriptions | ~620 | ~25 KB |
| B-tree indexes | 2 | ~50 KB |
| SQLite overhead | -- | ~10 KB |
| **Catalog subtotal** | **~620** | **~162 KB** |
| User preferences | 1 row | <1 KB |
| Tracked objects (typical) | ~50 | ~10 KB |
| Tracked object indexes | 2 | ~5 KB |
| **Total database** | -- | **~200 KB** |

VSOP87 coefficients (~2 MB) stored separately and not included in this budget. Total fits well within the 150 MB app size constraint ([SRS Section 5.1](../02-requirements/srs.md)).

---

## 9. Related Documents

- **[Database Schema](./schema.md)** -- Full SQL schema definition and validation rules
- **[Indexing Strategy](./indexing-strategy.md)** -- Query optimization and EXPLAIN analysis
- **[Schema Migrations](./migrations.md)** -- Version management and upgrade paths
- **[SRS Section 1.2](../02-requirements/srs.md)** -- Catalog scope definition and search requirements
- **[Algorithms](../04-domain-engine/algorithms.md)** -- Runtime position computation for solar system objects
- **[Architecture Overview](../03-architecture/architecture-overview.md)** -- Data layer in the system

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: February 2026
