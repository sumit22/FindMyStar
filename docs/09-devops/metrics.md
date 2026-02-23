# Code Quality Metrics

This document defines the quantitative quality standards for the FindMyStar project. These metrics are measured automatically in the CI pipeline and reported on every merge to `develop` or `main`. Regressions against these thresholds block pull request merges.

---

## 1. Code Coverage Targets

### 1.1 Coverage by Module

| Module | Target Coverage | Tool | Measurement |
|--------|----------------|------|-------------|
| Rust domain engine (`core/`) | > 90% | `cargo tarpaulin` | Line coverage |
| TypeScript services (`mobile/src/services/`) | > 80% | Jest `--coverage` | Branch coverage |
| TypeScript UI components (`mobile/src/screens/`) | > 70% | Jest `--coverage` | Line coverage |
| Integration tests (critical paths) | > 70% | Detox / Jest | Flow coverage |
| **Overall project** | **> 85%** | **Combined** | **Weighted average** |

### 1.2 Coverage Rules

- **No decrease allowed**: A PR must not lower coverage below the current baseline. The CI pipeline compares coverage against the target branch and fails if any module drops.
- **New code must be covered**: Any new function or module must include corresponding tests. PRs adding untested code will be flagged during review.
- **Exclusions**: The FFI boundary module (`core/src/ffi/exports.rs`) is excluded from Rust coverage metrics because it contains `extern "C"` functions that are tested indirectly through integration tests.

### 1.3 Generating Coverage Reports

```bash
# Rust coverage
cd core
cargo tarpaulin --out html --output-dir coverage
# Open coverage/tarpaulin-report.html in a browser

# TypeScript coverage
cd mobile
npm test -- --coverage
# Open mobile/coverage/lcov-report/index.html in a browser
```

### 1.4 Coverage Enforcement in CI

The CI pipeline runs coverage checks on every PR:

```yaml
- name: Check Rust coverage threshold
  run: |
    cd core
    COVERAGE=$(cargo tarpaulin --out json | jq '.coverage')
    if (( $(echo "$COVERAGE < 90.0" | bc -l) )); then
      echo "Coverage $COVERAGE% is below 90% threshold"
      exit 1
    fi
```

---

## 2. Static Analysis

### 2.1 Rust Analysis

| Tool | Command | Policy |
|------|---------|--------|
| **Clippy** | `cargo clippy -- -D warnings` | Zero warnings (CI gate) |
| **rustfmt** | `cargo fmt -- --check` | Must pass (CI gate) |
| **cargo audit** | `cargo audit` | No high/critical vulnerabilities |

Clippy is configured to deny all warnings. Any new warning introduced by a PR will cause the CI pipeline to fail. If a specific lint is a false positive, it may be suppressed with `#[allow(...)]` accompanied by a justifying comment.

### 2.2 TypeScript Analysis

| Tool | Command | Policy |
|------|---------|--------|
| **ESLint** | `npm run lint` | Zero warnings (`--max-warnings 0`) |
| **Prettier** | `npx prettier --check "src/**/*.{ts,tsx}"` | Must pass (CI gate) |
| **TypeScript compiler** | `npx tsc --noEmit` | No type errors |
| **npm audit** | `npm audit --audit-level=high` | No high/critical vulnerabilities |

### 2.3 Dependency Auditing

Dependency vulnerabilities are checked on two schedules:

| Frequency | Scope | Action on Finding |
|-----------|-------|-------------------|
| Every PR | `cargo audit`, `npm audit` | Block merge if high/critical |
| Weekly (scheduled) | Full audit with advisory database refresh | Create GitHub Issue |

When a vulnerability is discovered:

1. Evaluate severity and exploitability in the context of FindMyStar (offline, no network).
2. If applicable, update the dependency to a patched version.
3. If no patch is available, document a risk acceptance in the PR description with a timeline for remediation.

---

## 3. Performance Baselines

### 3.1 Computation Benchmarks

The Rust domain engine maintains performance baselines measured via `cargo bench` (using the Criterion framework):

| Benchmark | Baseline | Alert Threshold |
|-----------|----------|----------------|
| `ra_dec_to_altaz` (single computation) | < 10 us | Regression > 20% |
| `compute_rise_time` (single object) | < 100 ms | Regression > 20% |
| `batch_rise_set` (100 objects) | < 5 s | Regression > 20% |
| `ephemeris_sun` (position at epoch) | < 50 us | Regression > 20% |
| `ephemeris_moon` (position at epoch) | < 200 us | Regression > 20% |
| `vector_normalize` (1000 iterations) | < 5 us | Regression > 20% |
| `quaternion_rotation` (1000 iterations) | < 10 us | Regression > 20% |

### 3.2 Mobile App Performance

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| AR frame rate | >= 30 FPS | React Native Profiler |
| Touch response latency | < 200 ms | Interaction tracing |
| App cold start time | < 3 s | Stopwatch / instrumentation |
| Memory usage (steady state) | < 100 MB | Android Profiler / Instruments |
| Battery drain (AR mode) | < 10%/hour | Device battery stats |
| Battery drain (background) | < 1%/hour | Device battery stats |

### 3.3 Benchmark Tracking

Benchmarks are run nightly by the CI pipeline. Results are stored as artifacts and compared against the previous baseline:

- If any benchmark regresses by more than 20%, the nightly build is marked as failed and a GitHub Issue is created.
- Benchmark history is archived in `core/target/criterion/` and can be visualized using Criterion's built-in HTML reports.
- When a performance improvement is intentional, the baseline is updated by merging the new benchmark results.

```bash
# Run benchmarks locally
cd core
cargo bench

# Compare against saved baseline
cargo bench -- --baseline main

# Save a new baseline
cargo bench -- --save-baseline main
```

---

## 4. Code Complexity

### 4.1 Complexity Limits

| Metric | Threshold | Scope | Enforcement |
|--------|-----------|-------|-------------|
| Cyclomatic complexity | <= 15 per function | Rust + TypeScript | Code review |
| Function length | <= 50 lines | Rust + TypeScript | Code review |
| File length | <= 500 lines | Rust source files | Code review |
| File length | <= 300 lines | TypeScript source files | Code review |
| Module fan-out | <= 10 imports | Both | Code review |
| Nesting depth | <= 4 levels | Both | Code review |

### 4.2 Handling Violations

When a function exceeds complexity limits:

1. **Refactor first**: Extract helper functions, reduce nesting with early returns, or split into smaller modules.
2. **Document if unavoidable**: Some astronomical algorithms (e.g., VSOP87 series evaluation) are inherently complex. In these cases, add a comment explaining why the complexity is necessary and reference the mathematical source.
3. **Flag for review**: Any function exceeding limits must be explicitly approved during code review.

### 4.3 Complexity Measurement

```bash
# Rust: use cargo-complexity or manual review
# Cyclomatic complexity can be estimated by counting branches (if, match arms, loops)

# TypeScript: ESLint complexity rule
# Configured in .eslintrc.js:
# "complexity": ["warn", 15]
```

---

## 5. Documentation Coverage

### 5.1 Requirements

| Scope | Requirement | Verification |
|-------|------------|--------------|
| Rust public functions | Must have `///` doc comment | `cargo doc --no-deps` (warnings = failure) |
| Rust public types | Must have `///` doc comment | `cargo doc --no-deps` |
| TypeScript interfaces | Must have JSDoc comment | ESLint `jsdoc/require-jsdoc` rule |
| TypeScript exported functions | Must have JSDoc comment | ESLint `jsdoc/require-jsdoc` rule |
| Major directories | Must have README.md | Manual review |
| Database migrations | Must have header comment | Manual review |

### 5.2 Documentation Linting

```bash
# Rust: check for missing docs on public items
cd core
cargo doc --no-deps 2>&1 | grep "warning: missing documentation"

# Enable deny(missing_docs) in lib.rs for strict enforcement:
#![deny(missing_docs)]
```

### 5.3 API Documentation Generation

```bash
# Generate and open Rust API docs
cd core
cargo doc --no-deps --open

# Generate TypeScript API docs (if using TypeDoc)
cd mobile
npx typedoc src/services/ --out docs/api
```

---

## 6. Technical Debt Tracking

### 6.1 Debt Markers

Technical debt is tracked through code comments using standardized markers:

| Marker | Meaning | Example |
|--------|---------|---------|
| `TODO` | Feature or improvement to implement | `// TODO: Add caching for repeated queries` |
| `FIXME` | Known bug or incorrect behavior | `// FIXME: Lunar parallax not accounted for` |
| `HACK` | Temporary workaround that should be replaced | `// HACK: Hardcoded timezone offset` |
| `PERF` | Known performance improvement opportunity | `// PERF: Precompute trigonometric values` |

Every marker must include a brief description. If a GitHub Issue exists, include the issue number:

```rust
// TODO(#42): Implement iterative refinement for planetary rise/set times.
// The current single-pass approach can be off by up to 5 minutes for
// fast-moving objects like the Moon.
```

### 6.2 Debt Budget

| Metric | Maximum | Current | Action |
|--------|---------|---------|--------|
| Total `TODO` comments | 20 | Tracked in CI | Address oldest items first |
| Total `FIXME` comments | 10 | Tracked in CI | Prioritize in sprint planning |
| Total `HACK` comments | 5 | Tracked in CI | Replace within 2 sprints |
| **Combined debt items** | **30** | **Tracked in CI** | **20% sprint capacity for debt** |

### 6.3 Debt Counting in CI

The CI pipeline counts debt markers and fails if limits are exceeded:

```bash
# Count all debt markers across the project
echo "TODO: $(grep -r 'TODO' core/src mobile/src --include='*.rs' --include='*.ts' --include='*.tsx' | wc -l)"
echo "FIXME: $(grep -r 'FIXME' core/src mobile/src --include='*.rs' --include='*.ts' --include='*.tsx' | wc -l)"
echo "HACK: $(grep -r 'HACK' core/src mobile/src --include='*.rs' --include='*.ts' --include='*.tsx' | wc -l)"
```

### 6.4 Debt Reduction Policy

- Allocate **20% of each sprint** to technical debt reduction.
- Prioritize `FIXME` items (bugs) over `TODO` items (features) over `HACK` items (workarounds).
- When adding a new debt marker, the PR author must justify why it cannot be resolved immediately.
- Quarterly debt review: audit all markers, close resolved items, re-prioritize remaining ones.

---

## 7. Quality Dashboard

### 7.1 Metrics Collected Per Merge

Every merge to `develop` or `main` generates a quality report containing:

| Metric | Source | Format |
|--------|--------|--------|
| Rust line coverage (%) | cargo tarpaulin | JSON + HTML |
| TypeScript branch coverage (%) | Jest --coverage | JSON + HTML |
| Clippy warnings count | cargo clippy | Text |
| ESLint warnings count | eslint | Text |
| Dependency vulnerabilities | cargo audit + npm audit | JSON |
| Benchmark results | cargo bench (Criterion) | JSON + HTML |
| Technical debt count | grep markers | Text |
| Binary size (APK/AAB) | Gradle output | Bytes |

### 7.2 Historical Trend Tracking

Quality metrics are tracked over time to identify trends:

- **Coverage trend**: Should remain stable or increase. A sustained downward trend triggers a team review.
- **Benchmark trend**: Should remain stable. Gradual regression indicates architectural issues.
- **Debt trend**: Should decrease over time. Increasing debt indicates insufficient maintenance effort.
- **Warning trend**: Should remain at zero. Any nonzero value is a CI failure.

### 7.3 Report Storage

Quality reports are stored as GitHub Actions artifacts with the following retention:

| Report Type | Retention | Access |
|-------------|-----------|--------|
| PR coverage reports | 14 days | GitHub Actions artifacts |
| Merge quality reports | 90 days | GitHub Actions artifacts |
| Nightly benchmark results | 90 days | GitHub Actions artifacts |
| Release quality snapshots | Indefinite | Tagged release assets |

### 7.4 Alerting

| Condition | Action |
|-----------|--------|
| Coverage drops below module threshold | PR blocked, reviewer notified |
| Benchmark regresses > 20% | Nightly build fails, Issue created |
| New high/critical vulnerability | PR blocked, security label applied |
| Debt markers exceed budget | PR blocked, team notified |
| Binary size increases > 10% | Warning in PR comment |

---

## 8. Accuracy Metrics (Domain-Specific)

FindMyStar is an astronomy application, so correctness of celestial computations is a first-class quality metric:

### 8.1 Positional Accuracy

| Metric | Target | Validation Source |
|--------|--------|-------------------|
| RA/Dec error (stars) | < 1 arcminute | Hipparcos catalog |
| RA/Dec error (planets) | < 1 arcminute | JPL Horizons |
| Alt/Az error | < 1 degree | USNO computed values |
| Rise/set time error | < 2 minutes | USNO sunrise/sunset tables |
| Moon position error | < 5 arcminutes | JPL Horizons |

### 8.2 Validation Frequency

- **Every PR**: Core validation suite runs against 50+ known-good test vectors.
- **Nightly**: Extended validation suite runs against 500+ test vectors across 100 dates.
- **Per release**: Full validation report generated and archived with release notes.

### 8.3 Accuracy Regression Policy

If a code change causes positional accuracy to degrade beyond the thresholds above, the PR is blocked. The author must either fix the regression or provide a documented justification for the accuracy trade-off (e.g., performance optimization with acceptable precision loss).

---

## 9. Related Documentation

- **[CI/CD Pipeline](./ci-cd.md)** -- Where and how these metrics are enforced
- **[Code Standards](./code-standards.md)** -- Style rules that complement these quantitative metrics
- **[Testing Strategy](../08-testing/overview.md)** -- Test categories, validation approach, and benchmark details
- **[Build Process](./build-process.md)** -- How to run coverage and benchmarks locally
- **[Contributing Guide](../CONTRIBUTING.md)** -- Development workflow and review expectations

---

**Last Updated**: February 2026
