# Contributing to FindMyStar

## Code of Conduct

Be respectful, inclusive, and constructive. We follow the [Contributor Covenant](https://www.contributor-covenant.org/).

---

## Getting Started

### Prerequisites

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add aarch64-apple-ios  # iOS
rustup target add armv7-linux-androideabi  # Android

# Node.js (for mobile development)
node --version  # v18+
npm --version  # v9+

# Mobile SDKs
# Android: Android Studio + NDK
# iOS: Xcode 14+
```

### Project Setup

```bash
git clone https://github.com/yourusername/FindMyStar.git
cd FindMyStar

# Core engine (Rust)
cd core
cargo test
cargo doc --open

# Mobile app
cd ../mobile
npm install
npm start
```

### Entitlement Signing Key (optional, for release builds)

The Rust core verifies HMAC-signed entitlement blobs (see [`core/src/entitlement.rs`](../core/src/entitlement.rs)). The 32-byte signing key is injected at build time by [`core/build.rs`](../core/build.rs) from one of:

1. **`FINDMYSTAR_ENTITLEMENT_KEY`** environment variable (64 hex chars). Used by CI — store as a GitHub Actions secret.
2. **`core/entitlement_key.local`** file (64 hex chars on the first line, gitignored). Used for local dev/release builds — write the key once and forget it.
3. **All-zero fallback** if neither is configured. Dev builds, tests, and unit verification all work; only blobs signed with a *different* key fail to verify.

To generate a new key:

```bash
# 32 random bytes as hex
openssl rand -hex 32 > core/entitlement_key.local
```

For CI release builds, add the same hex string as the `FINDMYSTAR_ENTITLEMENT_KEY` repository secret. Keys are rotated by replacing the file/secret and rebuilding; do not commit either anywhere.

---

## Architecture Overview

See [`/docs/03-architecture/`](./03-architecture) for detailed architecture.

**Key Principle**: Domain logic (Rust) → Application layer (TS) → UI (React Native)

---

## Development Workflow

### 1. Pick an Issue

- Comment `I'd like to work on this` to claim it
- Ensure it aligns with current Phase

### 2. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 3. Make Changes

- **Rust changes**: Add tests in same module
- **TypeScript**: Add `.test.ts` files
- **Documentation**: Update relevant `/docs/` files

### 4. Run Tests

```bash
# Rust tests
cd core && cargo test

# TypeScript tests
cd ../mobile && npm test

# All tests
npm run test:all
```

### 5. Code Review Checklist

Before pushing, verify:
- ✅ Tests pass
- ✅ Linting passes: `npm run lint`
- ✅ No circular dependencies
- ✅ Documentation updated
- ✅ Follows code style guide (see below)

### 6. Submit Pull Request

Include:
- Description of changes
- Reference related issue(s)
- Screenshots for UI changes
- Test results

---

## Code Style Guide

### Rust

```rust
// Follow Rust conventions
// - snake_case for functions/variables
// - PascalCase for types
// - Always document public APIs

/// Computes altitude for celestial object.
///
/// # Arguments
/// * `ra` - Right Ascension in hours (0-24)
/// * `dec` - Declination in degrees (-90 to +90)
///
/// # Returns
/// Altitude in degrees
pub fn ra_dec_to_altaz(ra: f64, dec: f64) -> Result<f64> {
    // Implementation
}
```

Config: `core/.rustfmt.toml`

### TypeScript

```typescript
// ESLint + Prettier enforced
// - camelCase for variables/functions
// - PascalCase for classes/types
// - Explicit type annotations

interface CelestialObject {
  id: number;
  name: string;
  ra: number;     // Right Ascension in hours
  dec: number;    // Declination in degrees
}

export async function searchObjects(query: string): Promise<CelestialObject[]> {
  // Implementation
}
```

Config: `mobile/.eslintrc.js`, `mobile/.prettierrc`

---

## Testing Requirements

### Rust: Domain Engine

```rust
#[test]
fn test_altitude_accuracy() {
    // Always test mathematical correctness
    // Include real-world test cases
    // Compare against known ephemeris data
}
```

**Rule**: Core engine tests must reference:
- USNO (U.S. Naval Observatory)
- JPL Horizons
- Known star positions (Hipparcos catalog)

### TypeScript: Integration

```typescript
test('user can search and track object', async () => {
  // Integration tests cover user workflows
  // UI tests cover screen rendering
  // Service tests cover orchestration
});
```

**Rule**: >80% coverage for critical paths

---

## Documentation

### For New Features

1. **Update SRS** if functional requirement added
   - File: `/docs/02-requirements/srs.md`
   - Add to appropriate FR section

2. **Update Architecture** if design changes
   - File: `/docs/03-architecture/architecture-overview.md`
   - Update diagrams if needed

3. **Add to Changelog**
   - File: `/CHANGELOG.md`
   - Format: 

```markdown
## [1.1.0] - 2026-03-01
### Added
- New satellite tracking feature
### Changed
- Improved rise/set calculation accuracy
```

4. **Document Algorithms** if math changes
   - File: `/docs/04-domain-engine/algorithms.md`
   - Include pseudocode and references

---

## Common Tasks

### Add a New Celestial Object

1. Add to precomputed catalog (if star):
   ```rust
   // core/src/catalog.rs
   pub const SIRIUS: Star = Star {
       name: "Sirius",
       ra: 6.7525,     // hours
       dec: -16.7161,  // degrees
       magnitude: -1.46,
   };
   ```

2. Insert into catalog SQL:
   ```sql
   INSERT INTO objects VALUES (
       NULL, 'Sirius', 'star', 6.7525, -16.7161, -1.46, NULL, '', datetime('now')
   );
   ```

3. Test visibility:
   ```rust
   #[test]
   fn test_sirius_visibility() {
       let alt = compute_altitude(SIRIUS.ra, SIRIUS.dec, 40.0, 0.0, now);
       assert!(alt > 0.0);  // Should be above horizon
   }
   ```

### Add a New UI Screen

1. Create React Native component:
   ```typescript
   // mobile/src/screens/NewScreen.tsx
   export function NewScreen() {
       const { data } = useTracking();
       return <View>{/* UI */}</View>;
   }
   ```

2. Add navigation:
   ```typescript
   // mobile/src/navigation.tsx
   <Stack.Screen name="NewScreen" component={NewScreen} />
   ```

3. Add state management if needed:
   ```typescript
   // mobile/src/state/newScreenSlice.ts
   ```

### Update Astronomical Algorithm

1. Update Rust implementation:
   ```rust
   // core/src/ephemeris.rs
   pub fn compute_ra_dec_improved(...) { ... }
   ```

2. Add validation tests:
   ```rust
   #[test]
   fn test_ephemeris_against_usno() { ... }
   ```

3. Update documentation:
   - `/docs/04-domain-engine/algorithms.md`
   - Include mathematical basis and sources

4. Benchmark:
   ```bash
   cargo bench
   ```

---

## Performance Considerations

### Real-Time AR Loop

**Target**: <33ms per frame (30 FPS)

Profiling:
```bash
# Rust
cargo flamegraph

# Mobile
React Native Debugger → Profiler
```

### Rise/Set Calculation

**Target**: <500ms

Avoid:
- ❌ O(n²) algorithms for catalog searches
- ❌ Multiple database queries in loops
- ❌ Unnecessary floating-point precision

Optimize:
- ✅ Batch calculations
- ✅ Cache ephemeris values
- ✅ Index database queries

---

## Security Considerations

### Device Orientation Trust

- Magnetometer can be spoofed by metal/electromagnetic interference
- Add calibration prompt if deviation > 10°
- Never assume orientation is correct

### Location Privacy

- Location stays on device (never transmitted)
- Display warning: "Location used only for local calculations"
- Allow user to override with manual location entry

### Data Integrity

- Validate all external data (catalogs, TLEs in Phase 2)
- Checksum catalog file on load
- Detect and recover from database corruption

---

## Release Process

### Version Numbering

Semantic versioning: `MAJOR.MINOR.PATCH`

- `MAJOR`: Breaking architectural changes
- `MINOR`: New features (rise/set calculation, satellite tracking)
- `PATCH`: Bug fixes, refinements

### Release Checklist

- [ ] Tests pass: `npm run test:all`
- [ ] Lint passes: `npm run lint`
- [ ] Changelog updated
- [ ] Documentation updated
- [ ] Performance benchmarked
- [ ] Security reviewed
- [ ] Version bumped in `package.json`
- [ ] Apple/Google store guidelines followed
- [ ] Screenshots updated for App Store

### Build Commands

```bash
# Android
cd mobile && npm run build:android

# iOS
cd mobile && npm run build:ios

# Core + mobile
npm run build:all
```

---

## Getting Help

- **Questions?** Open a Discussion
- **Bug found?** File an Issue with details
- **Design feedback?** Comment on existing Issues/PRs
- **Want to contribute?** Email for mentorship

---

## Recognition

Contributors are recognized in:
- `CONTRIBUTORS.md` file
- App Store description (Version history)
- GitHub contributors graph

---

**Last Updated**: February 2026
