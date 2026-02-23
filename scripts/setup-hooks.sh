#!/usr/bin/env bash
# Sets up Git hooks for FindMyStar development
#
# Usage: ./scripts/setup-hooks.sh

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"

echo "Setting up FindMyStar development environment..."

# Point Git to the shared hooks directory
git config core.hooksPath .githooks

# Make hooks executable
chmod +x "$REPO_ROOT/.githooks/pre-commit"

echo "✓ Git hooks configured (core.hooksPath = .githooks)"

# Install mobile dependencies if needed
if [ ! -d "$REPO_ROOT/mobile/node_modules" ]; then
  echo "→ Installing mobile dependencies..."
  (cd "$REPO_ROOT/mobile" && npm install --legacy-peer-deps)
  echo "✓ Mobile dependencies installed"
else
  echo "✓ Mobile dependencies already installed"
fi

# Verify Rust toolchain
if command -v cargo &> /dev/null; then
  echo "✓ Rust toolchain found ($(rustc --version))"

  # Ensure rustfmt and clippy are installed
  if ! rustup component list --installed | grep -q rustfmt; then
    rustup component add rustfmt
    echo "✓ rustfmt installed"
  fi
  if ! rustup component list --installed | grep -q clippy; then
    rustup component add clippy
    echo "✓ clippy installed"
  fi
else
  echo "⚠ Rust toolchain not found — install from https://rustup.rs"
fi

echo ""
echo "Done! Pre-commit hooks will now run automatically."
echo "Checks: cargo fmt, cargo clippy, ESLint, Prettier, tsc"
