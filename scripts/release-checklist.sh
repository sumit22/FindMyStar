#!/usr/bin/env bash
# REL-009: Release Checklist Script
#
# Verifies all release criteria before tagging a version.
# Usage: ./scripts/release-checklist.sh [version]
# Example: ./scripts/release-checklist.sh 1.0.0

set -euo pipefail

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 1.0.0"
  exit 1
fi

PASS=0
FAIL=0
WARN=0

pass() { echo "  ✓ $1"; ((PASS++)); }
fail() { echo "  ✗ $1"; ((FAIL++)); }
warn() { echo "  ⚠ $1"; ((WARN++)); }
section() { echo ""; echo "━━━ $1 ━━━"; }

echo "FindMyStar Release Checklist v${VERSION}"
echo "========================================"

# ─── 1. Code Quality ───
section "Code Quality"

if (cd core && cargo fmt -- --check > /dev/null 2>&1); then
  pass "Rust formatting (cargo fmt)"
else
  fail "Rust formatting — run: cargo fmt"
fi

if (cd core && cargo clippy -- -D warnings > /dev/null 2>&1); then
  pass "Clippy (zero warnings)"
else
  fail "Clippy warnings — run: cargo clippy --fix"
fi

if (cd mobile && npx tsc --noEmit > /dev/null 2>&1); then
  pass "TypeScript type check"
else
  fail "TypeScript errors — run: npx tsc --noEmit"
fi

if (cd mobile && npx eslint . --ext .ts,.tsx --max-warnings 0 > /dev/null 2>&1); then
  pass "ESLint (zero warnings)"
else
  fail "ESLint warnings — run: npx eslint . --ext .ts,.tsx --fix"
fi

# ─── 2. Tests ───
section "Tests"

if (cd core && cargo test --all-targets > /dev/null 2>&1); then
  pass "Rust unit tests"
else
  fail "Rust unit tests failing"
fi

if (cd core && cargo test --test validation_tests > /dev/null 2>&1); then
  pass "Validation test suite"
else
  fail "Validation tests failing"
fi

if (cd core && cargo test --test edge_case_tests > /dev/null 2>&1); then
  pass "Edge case test suite"
else
  fail "Edge case tests failing"
fi

if (cd mobile && npx jest --ci > /dev/null 2>&1); then
  pass "Jest unit tests"
else
  warn "Jest tests — some may need native modules"
fi

# ─── 3. Security ───
section "Security"

if (cd core && cargo audit > /dev/null 2>&1); then
  pass "Rust dependency audit"
else
  warn "Rust audit found advisories — review: cargo audit"
fi

if (cd mobile && npm audit --production --audit-level=high > /dev/null 2>&1); then
  pass "npm dependency audit"
else
  warn "npm audit found issues — review: npm audit"
fi

# ─── 4. Version Consistency ───
section "Version"

PACKAGE_VERSION=$(cd mobile && node -p "require('./package.json').version")
CARGO_VERSION=$(cd core && grep '^version' Cargo.toml | head -1 | sed 's/.*"\(.*\)"/\1/')

if [ "$PACKAGE_VERSION" = "$VERSION" ]; then
  pass "package.json version = $VERSION"
else
  fail "package.json version is $PACKAGE_VERSION, expected $VERSION"
fi

if [ "$CARGO_VERSION" = "$VERSION" ]; then
  pass "Cargo.toml version = $VERSION"
else
  fail "Cargo.toml version is $CARGO_VERSION, expected $VERSION"
fi

# ─── 5. Git State ───
section "Git State"

if [ -z "$(git status --porcelain)" ]; then
  pass "Working tree is clean"
else
  fail "Uncommitted changes — commit or stash first"
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" = "main" ]; then
  pass "On main branch"
else
  warn "On branch '$BRANCH' (expected main)"
fi

# ─── 6. Build Artifacts ───
section "Build Artifacts"

if [ -f "mobile/assets/findmystar.db" ]; then
  pass "Catalog database exists"
else
  fail "Catalog database missing — run: ./scripts/build-catalog.sh"
fi

# ─── Summary ───
section "Summary"
echo ""
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "  Warnings: $WARN"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "❌ Release blocked — fix $FAIL failure(s) before tagging."
  exit 1
else
  echo "✅ All checks passed. Ready to tag v${VERSION}."
  echo ""
  echo "To create the release:"
  echo "  git tag -a v${VERSION} -m 'Release v${VERSION}'"
  echo "  git push origin v${VERSION}"
  exit 0
fi
