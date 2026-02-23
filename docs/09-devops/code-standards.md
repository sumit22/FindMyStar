# Code Standards & Style Guide

This document defines the coding conventions, formatting rules, and review practices enforced across the FindMyStar project. All standards are validated automatically by the CI pipeline (see [CI/CD](./ci-cd.md)).

---

## 1. Rust Code Style

### 1.1 Formatting

All Rust code must conform to `rustfmt` defaults. The formatter is configured in `core/.rustfmt.toml`:

```toml
edition = "2021"
max_width = 100
tab_spaces = 4
use_field_init_shorthand = true
```

Run the formatter before committing:

```bash
cd core
cargo fmt          # Apply formatting
cargo fmt -- --check  # Check without modifying (used in CI)
```

### 1.2 Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Functions | `snake_case` | `compute_altitude()` |
| Variables | `snake_case` | `local_sidereal_time` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_MAGNITUDE` |
| Types / Structs | `PascalCase` | `CelestialObject` |
| Enums | `PascalCase` (variants too) | `ObjectType::Star` |
| Modules | `snake_case` | `coordinate_transform` |
| Traits | `PascalCase` | `EphemerisProvider` |

### 1.3 Documentation Requirements

All public APIs must have `///` doc comments. Include a description, argument list, return value, and example where appropriate:

```rust
/// Computes the altitude and azimuth for a celestial object at a given
/// observer location and time.
///
/// This function performs the full RA/Dec to Alt/Az coordinate
/// transformation, including sidereal time calculation.
///
/// # Arguments
///
/// * `ra` - Right Ascension in hours (0.0 to 24.0)
/// * `dec` - Declination in degrees (-90.0 to +90.0)
/// * `lat` - Observer latitude in degrees (-90.0 to +90.0)
/// * `lon` - Observer longitude in degrees (-180.0 to +180.0)
/// * `time_ms` - Unix timestamp in milliseconds
///
/// # Returns
///
/// An `AltAz` struct containing altitude and azimuth in degrees.
/// Altitude ranges from -90 (nadir) to +90 (zenith).
/// Azimuth ranges from 0 (north) clockwise to 360.
///
/// # Errors
///
/// Returns `EngineError::InvalidCoordinate` if RA or Dec are out of range.
pub fn ra_dec_to_altaz(
    ra: f64,
    dec: f64,
    lat: f64,
    lon: f64,
    time_ms: i64,
) -> Result<AltAz, EngineError> {
    // ...
}
```

### 1.4 Error Handling

- Use `Result<T, E>` for all fallible operations.
- Define domain-specific error types using `thiserror` or manual `enum` implementations.
- **Never** use `.unwrap()` or `.expect()` in production code. These are acceptable only in tests and examples.
- Propagate errors with `?` where possible.
- Log errors at the boundary (FFI layer), not deep in domain logic.

```rust
// Good: propagate with ?
pub fn compute_rise_time(object: &CelestialObject, lat: f64, lon: f64) -> Result<DateTime, EngineError> {
    let ra = object.ra_at(time)?;
    let dec = object.dec_at(time)?;
    let hour_angle = solve_hour_angle(dec, lat)?;
    // ...
}

// Bad: panic in production
pub fn compute_rise_time_bad(object: &CelestialObject) -> DateTime {
    let ra = object.ra_at(time).unwrap();  // DO NOT DO THIS
    // ...
}
```

### 1.5 Numeric Precision

- Use `f64` for **all** astronomical computations. The `f64` type provides sufficient precision for sub-arcsecond accuracy.
- Never use `f32` for celestial coordinates, angles, or time values.
- Use named constants for mathematical values:

```rust
const DEG_TO_RAD: f64 = std::f64::consts::PI / 180.0;
const RAD_TO_DEG: f64 = 180.0 / std::f64::consts::PI;
const HOURS_TO_DEG: f64 = 15.0;
```

### 1.6 Unsafe Code Policy

- `unsafe` blocks are **only** permitted in the FFI boundary module (`core/src/ffi/exports.rs`).
- Every `unsafe` block must include a `// SAFETY:` comment explaining why it is sound.
- All other modules must be 100% safe Rust.
- PRs introducing `unsafe` outside the FFI layer require explicit approval from two reviewers.

```rust
// Acceptable: FFI export with safety comment
#[no_mangle]
pub extern "C" fn ffi_ra_dec_to_altaz(ra: f64, dec: f64, lat: f64, lon: f64, time_ms: i64) -> FfiResult {
    // SAFETY: This function is called from JNI/Objective-C. All parameters are
    // primitive types passed by value, so no pointer safety concerns apply.
    // The FfiResult struct is repr(C) and safe to return across the boundary.
    match ra_dec_to_altaz(ra, dec, lat, lon, time_ms) {
        Ok(result) => FfiResult::success(result),
        Err(e) => FfiResult::error(e),
    }
}
```

### 1.7 Linting

Clippy is enforced with a zero-warnings policy:

```bash
cargo clippy -- -D warnings
```

Do not use `#[allow(clippy::...)]` without a justifying comment. If a Clippy lint produces a false positive, document why and use `#[allow(...)]` at the narrowest possible scope.

---

## 2. TypeScript Code Style

### 2.1 Formatting and Linting

TypeScript code is formatted by **Prettier** and linted by **ESLint**. Configuration files:

- `mobile/.eslintrc.js` -- ESLint rules
- `mobile/.prettierrc` -- Prettier formatting options

```bash
cd mobile
npm run lint                           # Run ESLint
npx prettier --check "src/**/*.{ts,tsx}"  # Check formatting
npx prettier --write "src/**/*.{ts,tsx}"  # Apply formatting
```

### 2.2 Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Variables | `camelCase` | `angularDistance` |
| Functions | `camelCase` | `computeDirection()` |
| Classes | `PascalCase` | `AlarmScheduler` |
| Interfaces | `PascalCase` with `I` prefix for services | `IObjectTrackingService` |
| Type aliases | `PascalCase` | `CelestialObjectType` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_SEARCH_RESULTS` |
| Enum values | `PascalCase` | `ObjectType.Star` |
| React components | `PascalCase` | `SearchScreen` |
| Hooks | `camelCase` with `use` prefix | `useTracking()` |
| File names (components) | `PascalCase.tsx` | `SearchScreen.tsx` |
| File names (utilities) | `camelCase.ts` | `coordinateUtils.ts` |

### 2.3 Type Safety

- **No implicit `any`**: The TypeScript compiler option `noImplicitAny` is enabled. All variables and parameters must have explicit types or be inferable.
- Prefer `interface` for object shapes and `type` for unions or computed types.
- Always type function return values explicitly for public functions.

```typescript
// Good: explicit types
interface CelestialObject {
  id: number;
  name: string;
  ra: number;     // Right Ascension in hours
  dec: number;    // Declination in degrees
  magnitude: number;
  objectType: ObjectType;
}

export async function searchObjects(query: string): Promise<CelestialObject[]> {
  // ...
}

// Bad: implicit any
export async function searchObjects(query) {  // DO NOT DO THIS
  // ...
}
```

### 2.4 Async Patterns

- Use `async/await` instead of raw Promise chains.
- Always handle errors with `try/catch` in async functions.
- Avoid nested `.then()` callbacks.

```typescript
// Good: async/await
async function loadCatalog(): Promise<CelestialObject[]> {
  try {
    const db = await openDatabase();
    const results = await db.query('SELECT * FROM objects');
    return results.map(mapToCelestialObject);
  } catch (error) {
    logger.error('Failed to load catalog', error);
    throw new CatalogLoadError(error);
  }
}
```

### 2.5 React Native Components

- One component per file.
- Use functional components with hooks (no class components).
- Co-locate component-specific styles using `StyleSheet.create()`.
- Props interfaces defined at the top of the file.

```typescript
interface TrackingArrowProps {
  direction: number;   // degrees from current heading
  distance: number;    // angular distance in degrees
  locked: boolean;
}

export function TrackingArrow({ direction, distance, locked }: TrackingArrowProps): JSX.Element {
  // Component implementation
}

const styles = StyleSheet.create({
  container: { /* ... */ },
});
```

---

## 3. SQL Style

### 3.1 Formatting

- Use UPPERCASE for SQL keywords (`SELECT`, `FROM`, `WHERE`, `INSERT`, `UPDATE`).
- Use `snake_case` for table and column names.
- One clause per line for readability.

```sql
-- Good
SELECT
    o.id,
    o.name,
    o.ra,
    o.dec,
    o.magnitude
FROM objects o
WHERE o.magnitude < 6.0
    AND o.object_type = 'star'
ORDER BY o.magnitude ASC
LIMIT 50;
```

### 3.2 Parameterized Queries

**Always** use parameterized queries. Never build SQL strings through concatenation or template literals.

```typescript
// Good: parameterized
const results = await db.executeSql(
  'SELECT * FROM objects WHERE name LIKE ? AND magnitude < ?',
  [`%${query}%`, maxMagnitude]
);

// Bad: string interpolation -- SQL injection risk
const results = await db.executeSql(
  `SELECT * FROM objects WHERE name LIKE '%${query}%'`  // DO NOT DO THIS
);
```

### 3.3 Schema Comments

Complex queries and all migration scripts must include comments explaining the purpose:

```sql
-- Retrieve all tracked objects with their next visibility window.
-- Joins tracked_objects with objects to get RA/Dec for recomputation.
SELECT
    t.id AS alarm_id,
    o.name,
    o.ra,
    o.dec,
    t.next_visible_time,
    t.notify_before_minutes
FROM tracked_objects t
INNER JOIN objects o ON t.object_id = o.id
WHERE t.is_active = 1
ORDER BY t.next_visible_time ASC;
```

---

## 4. Commit Message Format

FindMyStar follows the **Conventional Commits** specification:

```
type(scope): short description

Longer description if needed. Explain the motivation for the change
and contrast with previous behavior.

Refs: #issue-number
```

### 4.1 Commit Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature or capability | `feat(tracking): add Jupiter tracking support` |
| `fix` | Bug fix | `fix(ephemeris): correct lunar declination offset` |
| `docs` | Documentation only | `docs(devops): add CI/CD pipeline documentation` |
| `refactor` | Code change without feature/fix | `refactor(coordinates): extract transform module` |
| `test` | Adding or updating tests | `test(validation): add USNO sunrise test cases` |
| `perf` | Performance improvement | `perf(engine): cache sidereal time computation` |
| `chore` | Build, CI, tooling changes | `chore(ci): upgrade actions/checkout to v4` |
| `style` | Formatting only (no logic change) | `style(core): apply rustfmt to all modules` |

### 4.2 Scope Values

Common scopes used in the project:

| Scope | Description |
|-------|-------------|
| `engine` | Rust core domain engine |
| `ephemeris` | Ephemeris computation module |
| `coordinates` | Coordinate transformation |
| `tracking` | Object tracking feature |
| `search` | Search functionality |
| `alarms` | Alarm/notification system |
| `ui` | React Native UI components |
| `db` | SQLite schema or queries |
| `ci` | CI/CD pipeline |
| `ffi` | Rust-to-mobile FFI layer |

### 4.3 Rules

- Subject line must be 72 characters or fewer.
- Use imperative mood: "add feature", not "added feature" or "adds feature".
- Do not end the subject line with a period.
- Separate subject from body with a blank line.
- Reference related issues in the footer.

---

## 5. Pull Request Description Template

```markdown
## What Changed

Brief description of what this PR does.

## Why

Explain the motivation. Reference the issue or user story.

## How to Test

1. Step-by-step instructions to verify the change.
2. Include specific inputs and expected outputs where applicable.

## Screenshots (if UI change)

Before | After

## Checklist

- [ ] Tests added or updated
- [ ] `cargo test` passes
- [ ] `npm test` passes
- [ ] `cargo clippy -- -D warnings` clean
- [ ] `npm run lint` clean
- [ ] Documentation updated (if public API changed)
- [ ] No new `unwrap()` in production code
- [ ] Commit messages follow conventional format

Refs: #issue-number
```

---

## 6. Code Review Checklist

Reviewers should verify the following for every PR:

### 6.1 Correctness

- [ ] Tests pass and cover the new/changed code paths
- [ ] Test coverage has not decreased
- [ ] Edge cases are handled (e.g., circumpolar objects, objects below horizon)
- [ ] Error handling is complete -- no uncaught exceptions or bare `unwrap()`

### 6.2 Quality

- [ ] No new clippy or ESLint warnings
- [ ] No hardcoded values or magic numbers without explanatory constants/comments
- [ ] Functions are under 50 lines; files are under 500 lines (Rust) or 300 lines (TS)
- [ ] Cyclomatic complexity per function does not exceed 15

### 6.3 Style

- [ ] Naming follows project conventions (see sections 1.2 and 2.2)
- [ ] Documentation added for new public APIs
- [ ] Commit messages follow conventional format
- [ ] Code formatting is correct (`rustfmt`, Prettier)

### 6.4 Architecture

- [ ] No layer violations (UI code must not call domain engine directly)
- [ ] No circular dependencies between modules
- [ ] New dependencies are justified and documented
- [ ] `unsafe` code only in FFI boundary with safety comments

### 6.5 Security

- [ ] SQL queries use parameterized statements
- [ ] No sensitive data logged or displayed
- [ ] Input validation present for user-provided values
- [ ] No new permissions requested without justification

---

## 7. File Organization

### 7.1 Rust Module Structure

- One module per file. The module name matches the file name.
- Group related modules under a directory with a `mod.rs` file.
- Unit tests live inside the same file as the code they test, within a `#[cfg(test)]` block.
- Integration tests go in the `tests/` directory at the crate root.

```
core/src/
  lib.rs                     # Crate root, public API re-exports
  ephemeris/
    mod.rs                   # Module declarations
    sun.rs                   # Sun ephemeris + #[cfg(test)] unit tests
    moon.rs                  # Moon ephemeris + unit tests
    planets.rs               # Planetary ephemeris + unit tests
  coordinates/
    mod.rs
    altaz.rs                 # Alt/Az transforms + unit tests
    equatorial.rs            # Equatorial transforms + unit tests
  math/
    mod.rs
    vector3.rs               # 3D vector operations + unit tests
    quaternion.rs            # Quaternion operations + unit tests
  ffi/
    mod.rs
    exports.rs               # #[no_mangle] FFI exports (only unsafe allowed)
```

### 7.2 React Native Structure

- One component per file.
- Co-locate tests with source files using a `.test.ts` or `.test.tsx` suffix.
- Group by feature or layer, not by file type.

```
mobile/src/
  screens/
    SearchScreen.tsx
    SearchScreen.test.tsx
    ARScreen.tsx
    ARScreen.test.tsx
  components/
    TrackingArrow.tsx
    TrackingArrow.test.tsx
    ObjectCard.tsx
    ObjectCard.test.tsx
  services/
    ObjectTrackingService.ts
    ObjectTrackingService.test.ts
    VisibilityService.ts
    VisibilityService.test.ts
  state/
    trackingSlice.ts
    trackingSlice.test.ts
```

### 7.3 Test File Conventions

| Language | Test Location | Naming | Runner |
|----------|--------------|--------|--------|
| Rust (unit) | Same file, `#[cfg(test)]` module | `test_<function_name>` | `cargo test` |
| Rust (integration) | `core/tests/` | `<feature>_tests.rs` | `cargo test --test` |
| TypeScript (unit) | Co-located `.test.ts` | `describe('<Module>')` | `npm test` |
| TypeScript (integration) | `mobile/__tests__/` | `<flow>.integration.test.ts` | `npm test` |

---

## 8. Related Documentation

- **[Contributing Guide](../CONTRIBUTING.md)** -- Full development workflow and PR process
- **[CI/CD Pipeline](./ci-cd.md)** -- Automated enforcement of these standards
- **[Code Quality Metrics](./metrics.md)** -- Coverage targets and complexity thresholds
- **[Build Process](./build-process.md)** -- Local development setup and build commands
- **[Testing Strategy](../08-testing/overview.md)** -- Test categories and validation approach

---

**Last Updated**: February 2026
