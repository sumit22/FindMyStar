//! Performance Benchmark Tests (VIS-006)
//!
//! Since criterion is not available (requires MSVC build tools), these benchmarks
//! use std::time::Instant with multiple iterations to establish baselines.
//! Run with: cargo test --test bench_tests --release -- --nocapture
//!
//! NFR targets:
//! - Single-object computations: < 10ms
//! - Batch 100 objects: < 100ms

use findmystar_core::coordinates::transforms::{altaz_to_vector3, ra_dec_to_altaz};
use findmystar_core::ephemeris::moon::compute_moon_position;
use findmystar_core::ephemeris::planets::{compute_planet_position, Planet};
use findmystar_core::ephemeris::stars::compute_star_position;
use findmystar_core::ephemeris::sun::compute_sun_position;
use findmystar_core::math::utils::angular_distance;
use findmystar_core::visibility::rise_set::compute_rise_iterative;
use std::time::Instant;

const JD_J2000: f64 = 2_451_545.0;
const ITERATIONS: u32 = 10_000;
const UNIX_MS: f64 = 1_704_067_200_000.0;
const LAT: f64 = 40.7128;
const LON: f64 = -74.006;

fn bench<F: Fn()>(name: &str, iterations: u32, f: F) -> f64 {
    // Warmup
    for _ in 0..100 {
        f();
    }

    let start = Instant::now();
    for _ in 0..iterations {
        f();
    }
    let elapsed = start.elapsed();
    let per_call_ns = elapsed.as_nanos() as f64 / iterations as f64;
    let per_call_us = per_call_ns / 1000.0;
    eprintln!(
        "  {name}: {per_call_us:.2} µs/call ({iterations} iterations, {:.1}ms total)",
        elapsed.as_secs_f64() * 1000.0
    );
    per_call_us
}

// ============================================================================
// Individual computation benchmarks
// ============================================================================

#[test]
fn bench_ra_dec_to_altaz() {
    eprintln!("\n=== Coordinate Transform Benchmark ===");
    let us = bench("ra_dec_to_altaz", ITERATIONS, || {
        let _ = ra_dec_to_altaz(6.7525, -16.7161, LAT, LON, UNIX_MS);
    });
    // NFR: single computation < 10ms (10,000 µs)
    assert!(
        us < 10_000.0,
        "ra_dec_to_altaz too slow: {us:.0}µs (limit: 10,000µs)"
    );
}

#[test]
fn bench_sun_position() {
    eprintln!("\n=== Sun Position Benchmark ===");
    let us = bench("compute_sun_position", ITERATIONS, || {
        let _ = compute_sun_position(JD_J2000 + 9000.0);
    });
    assert!(us < 10_000.0, "Sun position too slow: {us:.0}µs");
}

#[test]
fn bench_moon_position() {
    eprintln!("\n=== Moon Position Benchmark ===");
    let us = bench("compute_moon_position", ITERATIONS, || {
        let _ = compute_moon_position(JD_J2000 + 9000.0);
    });
    assert!(us < 10_000.0, "Moon position too slow: {us:.0}µs");
}

#[test]
fn bench_planet_position() {
    eprintln!("\n=== Planet Position Benchmark ===");
    let us = bench("compute_planet_position (Mars)", ITERATIONS, || {
        let _ = compute_planet_position(Planet::Mars, JD_J2000 + 9000.0);
    });
    assert!(us < 10_000.0, "Planet position too slow: {us:.0}µs");
}

#[test]
fn bench_star_position() {
    eprintln!("\n=== Star Position Benchmark ===");
    let us = bench("compute_star_position (Sirius)", ITERATIONS, || {
        let _ = compute_star_position(32349, JD_J2000 + 9000.0);
    });
    assert!(us < 10_000.0, "Star position too slow: {us:.0}µs");
}

#[test]
fn bench_planet_rise_set() {
    eprintln!("\n=== Planet Rise/Set Benchmark (Iterative) ===");
    let us = bench("compute_rise_iterative (Mars)", 100, || {
        let _ = compute_rise_iterative(
            |t| {
                let jd = findmystar_core::coordinates::time::unix_to_jd(t);
                compute_planet_position(Planet::Mars, jd)
            },
            LAT,
            LON,
            UNIX_MS,
            0.0,
        );
    });
    // Rise/set iterative is more expensive (scans 48h in 5-min steps)
    assert!(
        us < 10_000_000.0,
        "Planet rise/set too slow: {us:.0}µs (limit: 10s)"
    );
}

#[test]
fn bench_tracking_direction() {
    eprintln!("\n=== Full Tracking Pipeline Benchmark ===");
    // Full pipeline: position → altaz → vector3 → angular distance
    let us = bench("tracking_pipeline", ITERATIONS, || {
        let (ra, dec) = compute_sun_position(JD_J2000 + 9000.0);
        let (alt, az) = ra_dec_to_altaz(ra, dec, LAT, LON, UNIX_MS);
        let target = altaz_to_vector3(alt, az);
        let device = altaz_to_vector3(45.0, 180.0);
        let _ = angular_distance(&target, &device);
    });
    assert!(us < 10_000.0, "Tracking pipeline too slow: {us:.0}µs");
}

// ============================================================================
// Batch benchmark
// ============================================================================

#[test]
fn bench_batch_100_objects() {
    eprintln!("\n=== Batch 100 Objects Benchmark ===");

    // Build a list of 100 objects: Sun + Moon + 7 planets + 39 stars + 52 repeated stars
    let star_hips: Vec<u32> = vec![
        677, 1067, 2081, 3179, 3419, 5447, 7588, 9884, 11767, 13847, 14576, 15863, 21421, 24436,
        24608, 25336, 25930, 26311, 27989, 30438, 32349, 33579, 36850, 37279, 49669, 54061, 57632,
        65474, 67301, 69673, 71683, 80763, 86032, 91262, 97649, 102098, 107315, 109268, 113368,
    ];
    let jd = JD_J2000 + 9000.0;

    let iterations = 100;
    let start = Instant::now();
    for _ in 0..iterations {
        // Sun
        let (ra, dec) = compute_sun_position(jd);
        let _ = ra_dec_to_altaz(ra, dec, LAT, LON, UNIX_MS);

        // Moon
        let (ra, dec) = compute_moon_position(jd);
        let _ = ra_dec_to_altaz(ra, dec, LAT, LON, UNIX_MS);

        // 7 planets
        for pid in 1..=7u32 {
            if let Some(planet) = Planet::from_id(pid) {
                let (ra, dec) = compute_planet_position(planet, jd);
                let _ = ra_dec_to_altaz(ra, dec, LAT, LON, UNIX_MS);
            }
        }

        // Fill to 100 with stars (39 unique + cycle to reach 91)
        for i in 0..91 {
            let hip = star_hips[i % star_hips.len()];
            if let Some((ra, dec)) = compute_star_position(hip, jd) {
                let _ = ra_dec_to_altaz(ra, dec, LAT, LON, UNIX_MS);
            }
        }
    }
    let elapsed = start.elapsed();
    let per_batch_us = elapsed.as_micros() as f64 / iterations as f64;
    let per_batch_ms = per_batch_us / 1000.0;

    eprintln!(
        "  batch_100_objects: {per_batch_ms:.2} ms/batch ({iterations} iterations, {:.1}ms total)",
        elapsed.as_secs_f64() * 1000.0
    );

    // NFR: batch 100 objects < 100ms
    assert!(
        per_batch_ms < 100.0,
        "Batch 100 objects too slow: {per_batch_ms:.1}ms (limit: 100ms)"
    );
}
