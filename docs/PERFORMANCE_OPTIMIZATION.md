# Performance Optimization Guide

## 1. Performance Budget

All performance targets derive from [Non-Functional Requirements](./02-requirements/non-functional-requirements.md) NFR-1 through NFR-4. "Actual" values are measured on reference devices (iPhone 14, Samsung Galaxy S24).

| Resource | Budget | Actual | Headroom | Measurement Tool |
|----------|--------|--------|----------|-----------------|
| AR Frame Rate | 30 FPS | 60+ FPS | 2x | Frame timing overlay |
| Position Compute (per frame) | <10ms | <2ms | 5x | `cargo bench` |
| Rise/Set Calculation (single) | <500ms | <100ms | 5x | `cargo bench` |
| Search Query | <100ms | <5ms | 20x | In-app timing log |
| Memory (peak, AR active) | <100MB | ~65MB | 35% | OS profiler |
| Battery (AR mode) | <10%/hr | ~8%/hr | 20% | Controlled test session |
| App Size (installed) | <100MB | ~50MB | 50% | App Store metadata |

**Enforcement**: CI benchmarks via `cargo bench` run on every PR; regressions beyond threshold fail the build.

---

## 2. Caching Strategies

### 2.1 Ephemeris Cache

Computed RA/Dec positions change slowly (stars are effectively fixed; planets move over hours). Caching avoids recomputing ephemeris every frame.

```
Type:       LRU (Least Recently Used)
Key:        (object_id, time_bucket_1min)
Max Size:   100 entries
Eviction:   LRU when full; 1-minute time buckets
Rationale:  A planet's RA/Dec changes <0.001 deg/min; negligible error for 1-min cache
```

### 2.2 Alt/Az Cache

Horizontal coordinates depend on observer location and time.

```
Type:           Time-based expiry
Key:            (object_id, location_hash, time_bucket_1min)
Max Size:       50 entries
Invalidation:   When location changes >100m OR time >1 minute
Location Hash:  lat/lon rounded to 3 decimal places (~100m grid)
```

A 100m position change affects Alt/Az by <0.01 degrees -- well below device orientation accuracy of ~1 degree.

### 2.3 Search Cache

```
Type:       Simple map
Key:        Normalized query string (lowercase, trimmed)
Max Size:   20 entries
Eviction:   Clear on catalog update or app restart
```

---

## 3. Database Optimization

### 3.1 SQLite Configuration

```sql
PRAGMA journal_mode = WAL;       -- Concurrent reads during background writes
PRAGMA cache_size = -2000;       -- 2MB page cache
PRAGMA foreign_keys = ON;        -- Data integrity
PRAGMA synchronous = NORMAL;     -- Balance safety and speed
```

### 3.2 Index Strategy

```sql
CREATE INDEX idx_objects_name ON objects(name COLLATE NOCASE);
CREATE INDEX idx_objects_type ON objects(type);
CREATE INDEX idx_objects_magnitude ON objects(magnitude);
CREATE INDEX idx_tracked_object_id ON tracked_objects(object_id);
```

See [indexing-strategy.md](./05-data-model/indexing-strategy.md) for query plan analysis.

### 3.3 Query Patterns

Batch-load all tracked objects with catalog data in a single JOIN to avoid N+1 queries:

```sql
SELECT t.*, o.ra, o.dec, o.type, o.magnitude
FROM tracked_objects t
JOIN objects o ON t.object_id = o.id
WHERE t.alarm_enabled = 1;
```

---

## 4. Real-Time Loop Optimization (AR)

### 4.1 Frame Budget Breakdown

At 30 FPS, each frame has a total budget of 33ms:

```
Sensor read (IMU):           ~1ms
Quaternion computation:      ~0.5ms
Ephemeris lookup (cached):   ~0.1ms (hit) or ~2ms (miss)
Alt/Az transformation:       ~0.3ms
Vector math (angular error): ~0.2ms
JS bridge overhead:          ~1-2ms
React Native render:         ~5-10ms
Camera frame processing:     ~10-15ms (OS-managed)
─────────────────────────────
Total computation:           ~3-5ms
Available headroom:          ~28ms at 30 FPS
```

### 4.2 Hot Loop Rules

1. **No heap allocations**: pre-allocate all Vector3 and Quaternion objects; reuse across frames
2. **No GC pressure**: object pooling on the TypeScript side
3. **No database queries**: all tracking data pre-loaded into memory
4. **No string operations**: avoid formatting, concatenation, or logging in the hot path
5. **Cache ephemeris**: recompute RA/Dec only when time bucket changes (once per minute)
6. **Pre-compute target**: update only device orientation quaternion per frame

### 4.3 Object Pooling (TypeScript)

```typescript
// Pre-allocated reusable objects -- avoid GC pauses
const _tempVec3 = new Vector3(0, 0, 0);
const _tempQuat = new Quaternion(0, 0, 0, 1);

function updateFrame(deviceOrientation: Quaternion): TrackingResult {
  _tempVec3.set(targetAlt, targetAz, 0);
  _tempQuat.copy(deviceOrientation);
  // ... compute angular error using pre-allocated objects
}
```

---

## 5. Memory Optimization

### 5.1 Memory Budget

| Component | Target | Notes |
|-----------|--------|-------|
| Base app (idle) | <40MB | React Native runtime + app code |
| Catalog in memory | <25MB | Lazy-loaded by category |
| AR camera preview | ~20MB | Managed by OS camera framework |
| Ephemeris cache | <1MB | 100 entries |
| **Total peak** | **<80MB** | All features active |

### 5.2 Lazy Loading

The catalog is loaded in sections to minimize startup memory:

1. **Immediate**: planets + Sun + Moon (10 objects, ~1KB)
2. **On search**: stars loaded when search screen opens (~80KB)
3. **On demand**: Messier objects loaded when browsing deep-sky category (~15KB)

### 5.3 Resource Lifecycle

- **AR camera**: acquired on AR screen open; released on exit or background
- **GPS**: polling started on foreground; stopped on background
- **IMU sensors**: started on AR screen; stopped on AR screen close
- **SQLite**: opened at app start; kept alive for app lifetime

### 5.4 Memory Leak Prevention

- Profile with Xcode Instruments (Allocations) and Android Studio Profiler during 15-minute AR sessions
- Verify no monotonic memory growth during tracking loop
- Ensure all sensor listeners are unregistered on screen unmount

---

## 6. Battery Optimization

### 6.1 Sensor Polling Rates

| Sensor | Active (AR) | Active (Info) | Background | Rationale |
|--------|------------|--------------|------------|-----------|
| GPS | 1-min interval | 1-min interval | Off | Sky changes slowly with position |
| IMU | 30Hz | Off | Off | Match AR frame rate |
| Camera | Continuous (30 FPS) | Off | Off | AR overlay only |

### 6.2 Background Power Budget

When backgrounded, all sensors are suspended. Only activity: daily alarm recalculation at midnight via WorkManager (Android) or BGTaskScheduler (iOS). Duration <3 seconds, battery impact <0.1% per day.

### 6.3 CPU Throttling Awareness

```typescript
// If frames consistently exceed budget, reduce computation
if (averageFrameTime > 25) {
  // Reduce ephemeris update frequency
  // Skip non-essential UI animations
}
```

### 6.4 Night Mode Recommendations

- Reduce screen brightness (or enable red filter for night vision)
- Disable other background apps
- Use manual location entry if stationary (avoids continuous GPS)

---

## 7. Startup Optimization

**Target**: <2 seconds cold start.

```
0ms     App process created
200ms   JS bundle loaded and parsed
400ms   First render (splash screen)
700ms   PRAGMA integrity_check completed
800ms   Planet catalog loaded (10 objects)
1200ms  First interactive screen rendered
        ──── USER CAN INTERACT ────
2000ms  Full catalog available for search (background load)
```

**Techniques**: lazy service initialization, pre-warm SQLite connection, defer non-critical work past first render, minimize JS bundle via tree-shaking.

---

## 8. Profiling Tools

### 8.1 Rust Domain Engine

| Tool | Purpose | Command |
|------|---------|---------|
| `cargo bench` | Benchmark critical functions | `cd core && cargo bench` |
| `criterion.rs` | Statistical benchmarking with regression detection | Integrated into `cargo bench` |
| `cargo flamegraph` | CPU flame graph for hot path identification | `cargo flamegraph --bench ephemeris_bench` |

### 8.2 React Native / Mobile

| Tool | Purpose | Platform |
|------|---------|----------|
| React DevTools Profiler | Component render timing | Both |
| Flipper | Network, layout, database inspection | Both |
| React Native Performance Monitor | FPS, JS thread, UI thread | Both |

### 8.3 Platform-Specific

| Tool | Purpose | Platform |
|------|---------|----------|
| Xcode Instruments - Time Profiler | CPU usage by function | iOS |
| Xcode Instruments - Allocations | Memory tracking and leak detection | iOS |
| Xcode Instruments - Energy Log | Battery usage breakdown | iOS |
| Android Studio CPU Profiler | Method-level CPU tracing | Android |
| Android Studio Memory Profiler | Heap dump and allocation tracking | Android |
| Android Studio Energy Profiler | Battery consumption by component | Android |

---

## 9. Optimization Decision Framework

### 9.1 When to Optimize

Optimization is justified only when:

1. **Measured** performance is below the defined budget (Section 1)
2. The bottleneck has been **identified** through profiling (not guessed)
3. The optimization does not **compromise code clarity** disproportionately

### 9.2 Priority Order (highest impact first)

1. **Algorithm complexity**: O(n^2) to O(n log n) or O(1) via caching
2. **I/O reduction**: fewer database queries, batch operations
3. **Memory allocation**: reduce GC pressure in hot loops
4. **Data structure**: appropriate structures (HashMap vs Vec, etc.)
5. **Low-level**: SIMD, memory layout (rarely needed)

### 9.3 Anti-Patterns

| Anti-Pattern | Alternative |
|-------------|-------------|
| Database query per frame | Pre-load data before loop |
| String formatting in hot loop | Numeric comparisons; log outside loop |
| Creating objects every frame | Object pooling (Section 4.3) |
| Synchronous FFI on UI thread | Async bridge calls; background thread |
| Loading full catalog at startup | Lazy loading by category (Section 5.2) |

---

## 10. Performance Testing

### 10.1 Benchmark Suite

```bash
cd core && cargo bench             # All benchmarks
cargo bench -- ephemeris           # Specific benchmark
cargo bench -- coordinate_transform
cargo bench -- rise_set
```

### 10.2 Regression Thresholds

CI fails when benchmarks regress beyond: ephemeris >5ms, coordinate transform >2ms, rise/set >250ms.

### 10.3 Device Testing Matrix

| Device | OS | Purpose |
|--------|----|---------|
| iPhone 14 | iOS 16 | Primary iOS benchmark |
| iPhone SE (3rd gen) | iOS 15 | Worst-case iOS |
| Samsung Galaxy S24 | Android 14 | Primary Android benchmark |
| Samsung Galaxy A14 | Android 13 | Worst-case Android |

---

## 11. Cross-References

| Document | Relationship |
|----------|-------------|
| [Non-Functional Requirements](./02-requirements/non-functional-requirements.md) | NFR-1 through NFR-4 (performance budgets) |
| [Testing - Performance](./08-testing/performance.md) | Benchmark suite and regression testing |
| [Architecture Overview](./03-architecture/architecture-overview.md) | Performance targets (Section 10) |
| [Domain Engine Overview](./04-domain-engine/overview.md) | Rust computation architecture |
| [Indexing Strategy](./05-data-model/indexing-strategy.md) | Database query optimization |
| [OPERATIONS.md](./OPERATIONS.md) | Battery drain troubleshooting |

---

**Last Updated**: February 2026
