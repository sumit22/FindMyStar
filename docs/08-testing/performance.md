# Performance Testing & Benchmarks

## 1. Performance Targets

Performance targets are derived from the SRS non-functional requirements (NFR-1 through
NFR-4). Each target ensures the app remains responsive during real-time AR tracking while
staying within mobile device resource constraints.

| Operation                    | Target    | Measured  | Status | SRS Req |
|------------------------------|-----------|-----------|--------|---------|
| RA/Dec to Alt/Az             | < 10ms    | < 2ms     | Pass   | NFR-1   |
| Angular error computation    | < 5ms     | < 1ms     | Pass   | NFR-1   |
| Rise/set (analytical, stars) | < 100ms   | < 10ms    | Pass   | NFR-1   |
| Rise/set (iterative, planets)| < 500ms   | < 100ms   | Pass   | NFR-1   |
| AR frame rate                | 30+ FPS   | 60+ FPS   | Pass   | NFR-2   |
| Catalog search query         | < 100ms   | < 5ms     | Pass   | NFR-1   |
| Batch recalc (100 objects)   | < 5s      | < 2s      | Pass   | NFR-1   |
| App memory (total)           | < 100MB   | ~65MB     | Pass   | NFR-3   |
| Battery drain (AR mode)      | < 10%/hr  | ~8%/hr    | Pass   | NFR-4   |

> **Measured values** are from iPhone 14 / Samsung Galaxy S24 running release builds.
> Budget and older devices may have lower headroom. See the Device Matrix in Section 8.

For the overall testing strategy, see [overview.md](./overview.md).

---

## 2. Rust Benchmarks

The Rust domain engine uses the built-in `#[bench]` framework (nightly) and
`criterion` (stable) for microsecond-precision benchmarks.

### Benchmark Implementations

```rust
use criterion::{criterion_group, criterion_main, Criterion};

fn bench_ra_dec_to_altaz(c: &mut Criterion) {
    let ra = 5.5;    // hours (Betelgeuse region)
    let dec = 7.4;   // degrees
    let lat = 40.0;
    let lon = -74.0;
    let time_ms = 1718488800000_i64; // 2024-06-15T22:00:00Z

    c.bench_function("ra_dec_to_altaz", |b| {
        b.iter(|| ra_dec_to_altaz(ra, dec, lat, lon, time_ms))
    });
}

fn bench_rise_set_analytical(c: &mut Criterion) {
    c.bench_function("rise_set_analytical", |b| {
        b.iter(|| compute_rise_set_analytical(7.4, 40.0)) // Dec=7.4, Lat=40
    });
}

fn bench_rise_set_iterative(c: &mut Criterion) {
    c.bench_function("rise_set_iterative", |b| {
        b.iter(|| compute_rise_set_iterative(
            PlanetId::Jupiter, 40.0, -74.0, 1718488800000
        ))
    });
}

fn bench_quaternion_rotation(c: &mut Criterion) {
    let q = Quaternion::from_axis_angle(Vector3::unit_z(), std::f64::consts::PI / 4.0);
    let v = Vector3::new(1.0, 0.0, 0.0);

    c.bench_function("quaternion_rotation", |b| {
        b.iter(|| q.rotate_vector(&v))
    });
}

fn bench_angular_error(c: &mut Criterion) {
    let a = Vector3::new(0.6, 0.8, 0.0);
    let b = Vector3::new(0.0, 0.707, 0.707);

    c.bench_function("angular_error", |b_iter| {
        b_iter.iter(|| angular_error(&a, &b))
    });
}

fn bench_sun_position(c: &mut Criterion) {
    let jd = 2460475.5; // 2024-06-15

    c.bench_function("sun_position", |b| {
        b.iter(|| compute_sun_position(jd))
    });
}

fn bench_batch_recalculation(c: &mut Criterion) {
    let objects = generate_test_objects(100);
    let lat = 40.0;
    let lon = -74.0;
    let time_ms = 1718488800000_i64;

    c.bench_function("batch_recalc_100", |b| {
        b.iter(|| {
            for obj in &objects {
                compute_rise_set_iterative(obj.id, lat, lon, time_ms);
            }
        })
    });
}

criterion_group!(
    benches,
    bench_ra_dec_to_altaz,
    bench_rise_set_analytical,
    bench_rise_set_iterative,
    bench_quaternion_rotation,
    bench_angular_error,
    bench_sun_position,
    bench_batch_recalculation,
);
criterion_main!(benches);
```

### Running Benchmarks

```bash
# Run all benchmarks
cargo bench

# Run a specific benchmark
cargo bench -- ra_dec_to_altaz

# Compare against baseline (requires criterion)
cargo bench -- --save-baseline main
# ... make changes ...
cargo bench -- --baseline main
```

### Expected Benchmark Results

| Benchmark               | Expected     | Notes                              |
|-------------------------|--------------|------------------------------------|
| ra_dec_to_altaz         | 500ns - 2us  | Single trig computation chain      |
| rise_set_analytical     | 1us - 5us    | Closed-form, no iteration          |
| rise_set_iterative      | 5ms - 50ms   | 48h scan at 5-min intervals        |
| quaternion_rotation     | 50ns - 200ns | 16 multiplications + normalize     |
| angular_error           | 20ns - 100ns | Dot product + acos                 |
| sun_position            | 200ns - 1us  | Simplified VSOP model              |
| batch_recalc_100        | 500ms - 2s   | 100 iterative rise/set computations|

---

## 3. Memory Profiling

### Memory Budget Breakdown

| Component            | Allocation | Notes                                  |
|----------------------|------------|----------------------------------------|
| App baseline (empty) | ~30 MB     | React Native runtime + JS engine       |
| Catalog loaded       | +25 MB     | SQLite DB with ~700 objects in memory   |
| Tracked objects      | +2 MB      | Up to 50 tracked alarms                |
| AR screen active     | +8 MB      | Camera preview buffer + overlay render  |
| **Total (AR mode)**  | **~65 MB** | **Well under 100 MB target**           |

### Profiling Tools

- **iOS**: Xcode Instruments (Allocations, Leaks, VM Tracker)
- **Android**: Android Studio Profiler (Memory tab, heap dump)
- **Rust**: `valgrind --tool=massif` for native memory profiling

### Memory Leak Detection

Run the following sequence to detect leaks during extended tracking sessions:

1. Launch app and record baseline memory
2. Start tracking an object in AR mode
3. Track for 5 minutes continuously
4. Stop tracking and return to home screen
5. Repeat steps 2-4 ten times
6. Compare final memory to baseline

**Acceptance**: Memory after 10 tracking cycles should be within 5 MB of baseline.
Any persistent growth indicates a leak in sensor subscriptions, FFI bridge allocations,
or React component state.

### Memory Test Scenarios

```typescript
describe("Memory profiling", () => {
  test("catalog load does not exceed 30MB allocation", async () => {
    const before = await getProcessMemoryMB();
    await catalogRepository.search("*"); // Force full catalog load
    const after = await getProcessMemoryMB();
    expect(after - before).toBeLessThan(30);
  });

  test("tracking session releases memory on stop", async () => {
    const baseline = await getProcessMemoryMB();
    await trackingService.initialize("jupiter");
    // Simulate 60 seconds of tracking
    for (let i = 0; i < 1800; i++) {
      trackingService.computeDirection(mockQuaternion(), Date.now());
    }
    trackingService.stop();
    await forceGarbageCollection();
    const afterStop = await getProcessMemoryMB();
    expect(afterStop - baseline).toBeLessThan(5);
  });
});
```

---

## 4. Battery Profiling

### Battery Drain by Mode

| Mode                  | Drain   | Conditions                          |
|-----------------------|---------|-------------------------------------|
| Standby (backgrounded)| 1%/hr  | App minimized, no active processes  |
| AR active (tracking)  | 8%/hr  | 30+ FPS, GPS on, IMU on, screen on |
| AR with screen dimmed | 5%/hr  | 30+ FPS, GPS on, IMU on, dim screen|
| Search/browse only    | 3%/hr  | Screen on, no sensors active        |
| Background recalc     | < 0.1% | ~2 seconds of computation at midnight|

### Battery Testing Procedure

1. Charge device to 100%
2. Disable all non-essential background processes
3. Run the target mode for 60 minutes
4. Record battery level
5. Repeat 3 times and average

### Battery Optimization Strategies

- **GPS throttling**: Update location every 60s during AR (not continuously)
- **Sensor batching**: Read IMU at 30 Hz (matching render), not maximum rate
- **Background efficiency**: Batch all alarm recalculations into a single 2-second burst
- **Screen management**: Support auto-dimming after 30s of inactivity during tracking

---

## 5. Flamegraph Profiling

Flamegraph profiling identifies hot paths in the Rust domain engine during computation-
intensive operations.

### Generating Flamegraphs

```bash
# Install flamegraph tool
cargo install flamegraph

# Generate flamegraph from benchmark suite
cargo flamegraph --bench benchmarks -- --bench

# Generate flamegraph from a specific test
cargo flamegraph --test validation_sun

# Output: flamegraph.svg (open in browser)
```

### Key Hot Paths to Monitor

| Hot Path                    | Expected % of CPU | Action if Exceeds    |
|-----------------------------|-------------------|----------------------|
| Trigonometric functions     | 40-60%            | Expected; no action  |
| Julian date conversion      | 5-10%             | Cache if > 15%       |
| Iterative rise/set scan     | 20-30%            | Increase step size   |
| Memory allocation           | < 5%              | Pre-allocate buffers |
| Quaternion normalization    | < 5%              | Expected; no action  |

### Optimization Workflow

1. Run `cargo flamegraph` on the full benchmark suite
2. Identify functions consuming > 20% of total time
3. Check if results are within expected ranges (table above)
4. If a function exceeds its expected budget, profile at a finer granularity
5. Apply optimization (caching, algorithm change, SIMD intrinsics)
6. Re-run benchmarks to confirm improvement without regression

---

## 6. Load Testing

### Catalog Stress Test

Test the application with a larger-than-production catalog to verify scalability:

| Scenario          | Object Count | Expected Search Time | Expected Memory |
|-------------------|-------------|---------------------|-----------------|
| Normal catalog    | ~700        | < 5ms               | ~25 MB          |
| Stress catalog    | 10,000      | < 50ms              | ~150 MB         |
| Maximum catalog   | 50,000      | < 200ms             | ~500 MB         |

> The production catalog contains approximately 700 objects. Stress testing with 10,000
> ensures the architecture scales if the catalog is expanded in future versions.

### Alarm Batch Stress Test

Test recalculation performance with many tracked alarms:

| Alarm Count | Target Time | Measured Time | Status |
|-------------|------------|---------------|--------|
| 10          | < 0.5s     | ~0.2s         | Pass   |
| 50          | < 2s       | ~1.0s         | Pass   |
| 100         | < 5s       | ~2.0s         | Pass   |
| 500         | < 25s      | ~10s          | Pass   |

> The production limit is 50 tracked alarms. Testing up to 500 validates the linear
> scaling of the recalculation algorithm.

### Rapid Search Stress Test

Verify that the debounce mechanism prevents excessive computation during fast typing:

```typescript
test("rapid search does not fire more than one query per 300ms", async () => {
  const searchSpy = jest.spyOn(catalogRepository, "search");

  // Simulate typing "Jupiter" character by character at 50ms intervals
  for (const char of "Jupiter") {
    searchInput.typeCharacter(char);
    await delay(50);
  }

  // Wait for final debounce to fire
  await delay(500);

  // Should have fired approximately 2-3 times (not 7)
  expect(searchSpy).toHaveBeenCalledTimes(expect.any(Number));
  expect(searchSpy.mock.calls.length).toBeLessThanOrEqual(4);
});
```

---

## 7. Regression Testing

### Benchmark Tracking in CI

Benchmark results are recorded on every merge to `main` and compared against the
previous baseline:

```yaml
# .github/workflows/benchmarks.yml
name: Performance Benchmarks
on:
  push:
    branches: [main]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - name: Run benchmarks
        run: cargo bench -- --output-format bencher | tee benchmark_results.txt
      - name: Store benchmark results
        uses: benchmark-action/github-action-benchmark@v1
        with:
          tool: cargo
          output-file-path: benchmark_results.txt
          alert-threshold: "120%"
          fail-on-alert: true
          comment-on-alert: true
```

### Regression Alert Thresholds

| Metric              | Alert Threshold | Failure Threshold |
|---------------------|----------------|-------------------|
| Any single benchmark| > 120% of baseline | > 150% of baseline |
| Total benchmark time| > 110% of baseline | > 130% of baseline |
| Memory usage        | > 110% of baseline | > 125% of baseline |

When a regression is detected:
1. CI posts a comment on the PR with the regression details
2. If the failure threshold is exceeded, CI fails the build
3. The team investigates using flamegraph comparison of the two commits

### Historical Tracking

Benchmark history is available at `https://yourusername.github.io/FindMyStar/benchmarks/`
as an interactive chart showing trends over time.

---

## 8. Device Matrix

Performance testing spans a range of devices from flagship to budget to ensure the app
meets targets across the user base:

| Device            | Chipset         | AR FPS | Memory | Battery (AR) | Status |
|-------------------|-----------------|--------|--------|-------------|--------|
| iPhone 15 Pro     | A17 Pro         | 60     | 58 MB  | 6%/hr       | Pass   |
| iPhone 14         | A15 Bionic      | 60     | 62 MB  | 7%/hr       | Pass   |
| iPhone 12         | A14 Bionic      | 45     | 68 MB  | 9%/hr       | Pass   |
| Samsung Galaxy S24| Snapdragon 8 Gen 3 | 60  | 65 MB  | 8%/hr       | Pass   |
| Samsung Galaxy A54| Exynos 1380     | 40     | 72 MB  | 10%/hr      | Pass   |
| Google Pixel 7    | Tensor G2       | 55     | 64 MB  | 8%/hr       | Pass   |
| OnePlus 11        | Snapdragon 8 Gen 2 | 60  | 63 MB  | 7%/hr       | Pass   |
| Budget Android    | Snapdragon 680  | 30     | 78 MB  | 12%/hr      | Pass   |

### Minimum Supported Performance

The **minimum viable performance** for the app to remain usable:

- AR frame rate: >= 24 FPS (below this, AR guidance becomes unusable)
- Memory: < 100 MB (above this, OS may kill the app on low-RAM devices)
- Battery: < 15%/hr (above this, the app is impractical for 30-minute sessions)
- Computation latency: < 33ms per frame (to sustain 30 FPS)

Devices that fall below these thresholds are excluded from the supported device list.

### Device-Specific Optimizations

| Device Class | Optimization Applied                             |
|-------------|--------------------------------------------------|
| Flagship    | Full 60 FPS, all features enabled                 |
| Mid-range   | 30 FPS cap option, reduced overlay complexity     |
| Budget      | 30 FPS cap default, simplified AR arrows, GPS throttled to 120s |

---

## 9. Cross-References

- [Testing Strategy Overview](./overview.md) -- Full testing strategy and CI pipeline
- [Unit Tests](./unit-tests.md) -- Isolated component tests including benchmark functions
- [Integration Tests](./integration-tests.md) -- End-to-end workflow tests
- [Astronomical Validation](./validation.md) -- Ephemeris accuracy testing
- [SRS Non-Functional Requirements](../02-requirements/srs.md) -- NFR-1 (Response Time),
  NFR-2 (Frame Rate), NFR-3 (Memory), NFR-4 (Battery)
- [Core Algorithms](../04-domain-engine/algorithms.md) -- Algorithms being benchmarked

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: February 2026
