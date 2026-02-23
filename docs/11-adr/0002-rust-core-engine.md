# ADR 0002: Rust for Astronomical Core Engine

## Status

**Accepted**

## Context

The domain layer (astronomical computation engine) requires:
1. **Performance**: Real-time AR updates at 30+ FPS
2. **Determinism**: Identical inputs → identical outputs
3. **Accuracy**: Sub-degree precision for celestial calculations
4. **Correctness**: Complex math without subtle bugs
5. **Portability**: Reuse across iOS, Android, Web
6. **Testability**: Unit tests without runtime overhead

## Problem

### TypeScript Drawbacks
- Garbage collection causes jank in real-time loops
- Floating-point edge cases not caught at compile time
- No way to guarantee determinism (GC pauses, timing)
- Harder to achieve professional credibility
- Slower iterative computation loops

### Python Drawbacks
- Too slow for real-time AR (30ms budget)
- GIL prevents optimization
- Hard to bundle efficiently
- Mobile deployment awkward

## Decision

Implement astronomical domain engine in **Rust** and expose to mobile via:
- Native library (Android JNI, iOS bridging)
- Or WebAssembly (hybrid apps)

### Technology Choice Rationale

```
Rust Pros:
✅ Zero runtime overhead (no GC)
✅ Type system enforces correctness
✅ Memory safety without GC
✅ Deterministic execution
✅ Cross-platform compilation
✅ Professional credibility
✅ Small bundle size

Rust Cons:
❌ Learning curve (but one-time cost)
❌ Longer compilation (cached after first build)
❌ Strict borrowing rules (prevents some patterns)
```

## Consequences

### Positive

✅ **Performance**: 60+ FPS real-time possible
```
Position computation time: <10ms (Rust)
vs. 50-100ms (TypeScript)
```

✅ **Type Safety**: Impossible states prevented at compile time
```rust
// Compile error: degrees != radians
fn altitude(degrees: Degrees) -> Result<bool> {
    Ok(degrees.value() > 10.0)  // Type-safe
}
```

✅ **Testing Independence**: Test without mobile emulator
```bash
cargo test --lib  # <1 second turnaround
```

✅ **Determinism**: No GC pauses or timing surprises
```
Same inputs → always same outputs
Reproducible test failures
```

✅ **Credibility**: Professional astronomical tools use similar stacks
```
JPL Horizons, ESO tools, OpenAstronomy
All use C/C++/Rust for core engines
```

### Negative

❌ **Integration Complexity**: Mobile bridging adds overhead
```
Android: JNI boilerplate
iOS: Objective-C bridging
Adds ~1KB to binary per binding
```

❌ **Larger Toolchain**: Requires Rust compiler alongside mobile SDKs
```
One-time setup: 10-20 minutes
Storage: +1GB for Rust toolchain
```

❌ **Team Learning**: Rust has steep initial learning curve
```
Onboarding new Rust developer: 2-4 weeks
But: one-time cost, reusable knowledge
```

❌ **Debugging**: Stack traces less intuitive than TypeScript
```
Rust panics require careful unwinding
But: fewer panics due to strict type system
```

## Architectural Pattern

### Hexagonal Exposure

```rust
// /core/lib.rs - Public API only
pub mod public_api {
    pub fn compute_ra_dec(object_id: u32, time_ms: i64) -> (f64, f64);
    pub fn ra_dec_to_altaz(ra: f64, dec: f64, lat: f64, lon: f64) -> (f64, f64);
    pub fn compute_angular_error(target: [f64; 3], device_quat: [f64; 4]) -> f64;
}

// Internal organization (opaque to callers)
mod ephemeris { ... }
mod coordinates { ... }
mod math { ... }
```

### Mobile Integration (Android Example)

```kotlin
// Android (Kotlin)
external fun computeRaDec(objectId: Int, timeMs: Long): DoubleArray
external fun ra_dec_to_altaz(ra: Double, dec: Double, ...): DoubleArray

// Loaded from compiled Rust library
init {
    System.loadLibrary("astronomy_engine")
}
```

## Validation & Error Handling

### Type-Safe Error Handling

```rust
use std::result::Result;

pub fn altitude_to_vector(altitude: Result<f64>) -> Result<Vector3> {
    let alt = altitude?;  // Early return on error
    Ok(Vector3::from_polar(alt, ...))
}
```

**Benefit**: Every error path explicit, no silent failures

## Testing Strategy

### Unit Tests (Rust)

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_polaris_altitude() {
        let alt = compute_altitude(polaris_ra, polaris_dec, 40.0, 0.0, now);
        assert!((alt - 40.0).abs() < 1.0);
    }
}
```

**Run**: `cargo test --lib` (milliseconds)

### Integration Tests (Mobile)

```typescript
// Mobile integration test calls Rust
const { alt, az } = await astronomyEngine.raDecToAltAz(ra, dec, lat, lon);
expect(alt).toBeCloseTo(expectedAlt, 1);  // 1 degree tolerance
```

## Binary Size Impact

```
Uncompressed Rust library: ~3-5MB
Compressed + stripping: ~500KB
Relative to app size: <0.5% of 100MB target
Negligible impact
```

## Future Options

### Maintain Compatibility

If Rust causes team problems, can:
1. Keep Rust library as-is
2. Reimplement core in TypeScript
3. Validate output against Rust version
4. Gradual migration possible

But: Not recommended, loses all benefits

## Alternatives Considered

### Alternative 1: Pure TypeScript

```
❌ Rejected
Performance: 60ms per frame → jank
No determinism guarantee
More floating-point edge cases
```

### Alternative 2: C++ with WebAssembly

```
⚠️ Lower priority
C++ + emscripten possible alternative
More verbose than Rust
Fewer safety guarantees
```

### Alternative 3: Python with PyO3

```
❌ Rejected
Still slower than pure Rust
Bundle size larger
Mobile deployment awkward
Simpler learning curve (only positive)
```

## Implementation Plan

### Phase 1: Core Engine (Weeks 0-4)
```
✅ Vector math
✅ Quaternion operations  
✅ Sidereal time
✅ Coordinate transforms
✅ Basic ephemeris
```

### Phase 2: Advanced Astronomy (Weeks 4-8)
```
✅ Rise/set calculations
✅ Circumpolar detection
✅ Planetary ephemeris
✅ Error handling
```

### Phase 3: Mobile Integration (Weeks 8-10)
```
✅ Android JNI bridges
✅ iOS Objective-C bridges
✅ Performance tuning
```

### Phase 4: Validation (Weeks 10-12)
```
✅ Unit test suite
✅ Ephemeris testing against USNO
✅ Real device benchmarking
```

## References

- [Rust for Systems Programming](https://www.rust-lang.org)
- [Building FFI Bindings](https://www.rust-lang.org/what/wasm)
- [Astronomical Algorithm Safety](https://en.wikipedia.org/wiki/Floating-point_arithmetic)

---

**Status**: Accepted  
**Decision Date**: February 2026  
**Supersedes**: None
