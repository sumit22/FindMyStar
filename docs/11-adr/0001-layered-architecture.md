# ADR 0001: Adopt Layered Architecture

## Status

**Accepted**

## Context

The FindMyStar application combines:
1. Complex astronomical calculations (deterministic, math-heavy)
2. Real-time AR visualization (latency-critical UI)
3. Device sensor integration (GPS, IMU, time)
4. Local data persistence (SQLite)
5. Future extensibility needs (telescope control, plate solving)

These concerns are fundamentally different and require separation of concerns.

### Problem

Without strict layering, the codebase risks:
- UI logic polluting astronomy algorithms
- Difficulty testing mathematical correctness without mobile emulator
- Tight coupling making future extensions hard
- Code reuse across platforms impossible

## Decision

Adopt a **4-layer layered architecture**:

```
┌─────────────────────────┐
│ Presentation Layer      │  UI Components, State Management
├─────────────────────────┤
│ Application Layer       │  Services, Orchestration
├─────────────────────────┤
│ Domain Layer (Rust)     │  Pure Math, Astronomy Algorithms
├─────────────────────────┤
│ Data Layer              │  Persistence, File I/O
└─────────────────────────┘
```

### Key Principles

1. **Strict Dependency Direction**: Layers depend only on layers below them
   - Presentation ← Application ← Domain ← Data
   - No circular dependencies

2. **Domain Layer Autonomy**: Rust core is completely independent
   - Zero knowledge of UI, platform, or persistence
   - Deterministic (no randomness)
   - Fully testable in isolation

3. **Interface Segregation**: Each layer exposes minimal public interface
   - Services accept concrete types
   - Return immutable/copyable data structures

4. **Separation of Concerns**:
   - **Presentation**: How to show data
   - **Application**: When to compute and what to do
   - **Domain**: Why the math works and what results mean
   - **Data**: Where information lives

## Consequences

### Positive

✅ **Testability**: Domain engine tested without mobile emulator
- Run unit tests in seconds
- Validate against known ephemeris data
- Catch corner cases early

✅ **Reusability**: Rust core usable across platforms
- Same astronomical engine: iOS, Android, Web
- Potential publication as scientific library
- Enable future desktop tools

✅ **Scalability**: Easy to add new features
- Telescope integration: new layer on top
- Plate solving: new service in application layer
- No impact on proven domain logic

✅ **Maintainability**: Clear boundaries and responsibilities
- Easier to onboard new developers
- Reduced cognitive load per module
- Better code review discussions

✅ **Scientific Credibility**: Deterministic, provable core
- Can be validated against professional software
- Enables academic publications
- Builds user trust in accuracy

### Negative

❌ **Slight Initial Complexity**: More layers than minimal MVC
- Requires discipline during development
- More files/modules to navigate
- Learning curve for team members

❌ **Potential Performance**: Layer crossing overhead
- Function call boundaries between layers
- Data copying at layer boundaries
- Mitigated by: Rust is fast, layers are thin

❌ **Initial Development Speed**: Scaffolding takes time
- Cannot prototype in single-file monolith
- Requires up-front architectural thinking
- Pays off after 20% of project time

## Rationale

### Why 4 Layers (not 3 or 5)?

**3 Layers (MVC)** would conflate application logic with domain logic:
- Bad: TrackingService mixed with telescope concepts

**5+ Layers** adds unnecessary complexity:
- Domain layer is sufficient for all math
- No need for separate "business logic" layer

**4 Layers** is Goldilocks zone:
- Domain: Pure math (Rust)
- Application: Orchestration (TypeScript services)
- Presentation: UI (React Native/Flutter)
- Data: Persistence (SQLite)

### Why Rust in Domain Layer?

1. **Type Safety**: Astronomically correct types (Degrees, Hours, etc.)
2. **Performance**: Real-time calculations must be fast
3. **Determinism**: No garbage collection side effects
4. **Testability**: No I/O, purely functional
5. **Credibility**: Professional tools use similar stacks

## Alternatives Considered

### Alternative 1: Monolithic Single Layer
```
❌ Abandoned
UI mixed with math mixed with database
Untestable, hard to debug, unmaintainable
```

### Alternative 2: Microservices
```
❌ Abandoned
Overkill for offline app
No network, no IPC needed
Extra complexity without benefit
```

### Alternative 3: Hexagonal (Ports & Adapters)
```
⚠️ Considered
More flexible than layered
But more complex for this use case
Layered is sufficient
```

## Implementation Guidelines

### Domain Layer (Rust)
```rust
// NO external dependencies except math libraries
// NO I/O, NO platform calls, NO side effects
pub fn ra_dec_to_altaz(ra: f64, dec: f64, lat: f64, lon: f64, time: f64) -> (f64, f64) {
    // Pure math
}
```

### Application Layer (TypeScript)
```typescript
// Orchestrates domain + data
// NO UI code here
export class VisibilityService {
  computeNextVisible(object: CelestialObject, location: Location) {
    const (alt, az) = this.ephemeris.computeAltAz(...);
    if (alt > threshold) { /* visible */ }
  }
}
```

### Presentation Layer (React Native)
```typescript
// Dependencies: Application layer only
// NO domain logic, NO persistence directly
export function ARScreen() {
  const { direction, angle } = useTracking();
  return <ArrowOverlay direction={direction} />;
}
```

### Data Layer (SQLite)
```typescript
// Pure persistence
// Dependencies: None
export class CatalogRepository {
  async getObject(name: string): Promise<CelestialObject> {
    const row = await db.query(`SELECT * FROM objects WHERE name = ?`);
    return mapRowToObject(row);
  }
}
```

## Related ADRs

- **ADR-0002**: Why Rust for core engine
- **ADR-0003**: Why offline-first (SQLite only)
- **ADR-0004**: Why React Native/Flutter for mobile

## References

- [Layered Architecture Pattern (Microsoft)](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/architectural-principles)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Dependency Inversion Principle](https://en.wikipedia.org/wiki/Dependency_inversion_principle)

---

**Status**: Accepted  
**Decision Date**: February 2026  
**Decided By**: Architecture Review Board
