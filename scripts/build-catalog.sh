#!/usr/bin/env bash
# build-catalog.sh - Assemble the FindMyStar SQLite catalog database
# Usage: ./scripts/build-catalog.sh [output_path]
#
# Applies schema.sql then all seed files to produce a ready-to-bundle
# catalog database for the mobile app.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DB_DIR="$PROJECT_ROOT/db"
SCHEMA="$DB_DIR/schema.sql"
SEEDS_DIR="$DB_DIR/seeds"
OUTPUT="${1:-$DB_DIR/findmystar.db}"

# Ensure sqlite3 is available
if ! command -v sqlite3 &>/dev/null; then
  echo "ERROR: sqlite3 is required but not found in PATH" >&2
  exit 1
fi

# Validate source files exist
if [ ! -f "$SCHEMA" ]; then
  echo "ERROR: Schema file not found: $SCHEMA" >&2
  exit 1
fi

if [ ! -d "$SEEDS_DIR" ]; then
  echo "ERROR: Seeds directory not found: $SEEDS_DIR" >&2
  exit 1
fi

# Remove existing database to build fresh
if [ -f "$OUTPUT" ]; then
  echo "Removing existing database: $OUTPUT"
  rm "$OUTPUT"
fi

echo "Building catalog database..."
echo "  Schema: $SCHEMA"
echo "  Seeds:  $SEEDS_DIR/"
echo "  Output: $OUTPUT"

# Apply schema
sqlite3 "$OUTPUT" < "$SCHEMA"
echo "  [OK] Schema applied"

# Apply seed files in deterministic order
for seed in "$SEEDS_DIR"/solar-system.sql "$SEEDS_DIR"/stars.sql "$SEEDS_DIR"/messier.sql; do
  if [ -f "$seed" ]; then
    sqlite3 "$OUTPUT" < "$seed"
    echo "  [OK] Loaded $(basename "$seed")"
  else
    echo "  [SKIP] Not found: $(basename "$seed")"
  fi
done

# Verify counts
TOTAL=$(sqlite3 "$OUTPUT" "SELECT COUNT(*) FROM objects;")
STARS=$(sqlite3 "$OUTPUT" "SELECT COUNT(*) FROM objects WHERE type='star';")
PLANETS=$(sqlite3 "$OUTPUT" "SELECT COUNT(*) FROM objects WHERE type='planet';")
NEBULAE=$(sqlite3 "$OUTPUT" "SELECT COUNT(*) FROM objects WHERE type IN ('nebula','planetary_nebula');")
GALAXIES=$(sqlite3 "$OUTPUT" "SELECT COUNT(*) FROM objects WHERE type='galaxy';")
CLUSTERS=$(sqlite3 "$OUTPUT" "SELECT COUNT(*) FROM objects WHERE type='cluster';")

echo ""
echo "Catalog built successfully!"
echo "  Total objects: $TOTAL"
echo "  Stars:         $STARS"
echo "  Planets:       $PLANETS"
echo "  Nebulae:       $NEBULAE"
echo "  Galaxies:      $GALAXIES"
echo "  Clusters:      $CLUSTERS"
echo ""
echo "Database size: $(du -h "$OUTPUT" | cut -f1)"
