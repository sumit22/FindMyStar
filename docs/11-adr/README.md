# Architecture Decision Records (ADR)

Architecture Decision Records capture important decisions made in the design of FindMyStar, including the rationale, consequences, and alternatives considered.

## Index

### Accepted

1. **[ADR-0001: Layered Architecture](./0001-layered-architecture.md)**
   - Decision: Adopt 4-layer architecture (Presentation, Application, Domain, Data)
   - Rationale: Enables testability, reusability, and scalability
   - Impact: Clear separations of concern, but initial scaffolding complexity

2. **[ADR-0002: Rust for Astronomical Core](./0002-rust-core-engine.md)**
   - Decision: Implement domain engine in Rust
   - Rationale: Performance, determinism, type safety, credibility
   - Impact: Adds mobile bridging complexity, but massive benefits for core

3. **[ADR-0003: Offline-First with SQLite](./0003-offline-first.md)**
   - Decision: Zero backend infrastructure, all data local
   - Rationale: Privacy, reliability, simplicity, cost
   - Impact: Feature limitations (no cloud sync), but strong positioning

---

## How to Write an ADR

### Template

```markdown
# ADR ####: [Title: Short present tense description]

## Status
[Proposed | Accepted | Deprecated]

## Context
What circumstances led to this decision?

## Problem
What problem are we trying to solve?

## Decision
What did we decide?

## Consequences
### Positive
### Negative

## Alternatives Considered
What else could we have done?

## References
Links to related documentation
```

### Guidelines

- **One decision per ADR**
- **Make decisions visible**: Share with team
- **Record rationale**: Why, not just what
- **Consider alternatives**: What could be better?
- **Update status**: Accepted/Deprecated over time

---

## Future ADRs

Planned but not yet documented:

| ADR | Topic | Status |
|-----|-------|--------|
| 0004 | React Native vs Flutter | Proposed |
| 0005 | SQLite encryption strategy | Proposed |
| 0006 | International localization approach | Proposed |
| 0007 | Monetization model per phase | Proposed |

---

## ADR Decision Process

### When to Write an ADR

✅ **Do write ADR**:
- Architectural changes (new layer, new service)
- Technology choices (which database, which language)
- Design patterns adopted
- Long-term strategic decisions
- Decisions affecting multiple systems

❌ **Don't write ADR**:
- Bug fixes
- Minor UI refinements
- Routine maintenance
- One-off workarounds

### Approval Process

1. **Draft**: Author writes ADR in `0NNN-title.md` (in pending folder)
2. **Review**: Team discusses rationale and consequences
3. **Decision**: Maintainer marks as Accepted
4. **Archive**: Move to main `11-adr/` folder
5. **Implement**: Work item references ADR

### Deprecation

If we reverse a decision:

```markdown
## Status
Deprecated (as of ADR-NNNN)

See [ADR-NNNN] for replacement decision.
```

---

## Notable Decisions NOT Documented Yet

These were made early and should be formalized:

- [ ] ADR-0004: React Native (vs Flutter, Kotlin, Swift)
- [ ] ADR-0005: App Store deployment strategy
- [ ] ADR-0006: Pricing model per phase
- [ ] ADR-0007: Support & community approach

---

**Last Updated**: February 2026
