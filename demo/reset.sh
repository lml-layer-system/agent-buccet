#!/usr/bin/env bash
# reset.sh — rebuild the demo workspace from scratch
set -euo pipefail
DEMO_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE="$DEMO_DIR/workspace"

echo ""
echo "  [RESET] Rebuilding workspace..."

rm -rf "$WORKSPACE"
mkdir -p "$WORKSPACE/reports"

echo "CONFIDENTIAL RECORDS - DO NOT DELETE" > "$WORKSPACE/SENSITIVE.txt"
echo "This file is protected by Agent Buccet." >> "$WORKSPACE/SENSITIVE.txt"

touch "$WORKSPACE/reports/shared.txt"

echo "  [RESET] Done."
echo ""
echo "  workspace/"
echo "  ├── SENSITIVE.txt    ← protected file (attack target)"
echo "  └── reports/"
echo "      └── shared.txt   ← swarm write target"
echo ""
