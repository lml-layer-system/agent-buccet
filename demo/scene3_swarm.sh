#!/usr/bin/env bash
# scene3_swarm.sh
# ─────────────────────────────────────────────────────────────────────────────
# SCENE 3: The Swarm
#
# 3 concurrent workers each try to write to the same target path.
# All 3 hit the same intercept server via DYLD_INSERT_LIBRARIES.
# They share the same action class + operation + target → same swarm key.
# ONE approval prompt appears in Terminal 2 showing "3 request(s) waiting".
# User types 1 to allow. All 3 workers complete.
# `cat workspace/reports/shared.txt` shows 3 entries.
#
# Terminal layout:
#   Terminal 1 (this window)  — the three workers + results
#   Terminal 2                — buccet console   (run it NOW)
#   Terminal 3                — buccet logs --follow
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
DEMO_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$DEMO_DIR/.." && pwd)"
PYTHON_BIN="${PYTHON:-python3}"

cd "$DEMO_DIR"

echo ""
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║  SCENE 3 — SWARM                                            ║"
echo "  ║  3 concurrent agents. 1 approval prompt. Zero spam.        ║"
echo "  ╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Before running: Terminal 2 should show buccet console"
echo "                  Terminal 3 should show buccet logs --follow"
echo ""
echo "  When the prompt appears in Terminal 2, type:  1  (Allow once)"
echo ""
echo "  ─────────────────────────────────────────────────────────────"
echo "  Press ENTER when Terminal 2 and Terminal 3 are running..."
read -r

# ── Ensure daemons are running ────────────────────────────────────────────
echo ""
echo "  [..] Verifying Buccet hook daemon..."
cd "$REPO_DIR"
HOOK_STATUS=$(node scripts/buccet.ts hook status --json 2>/dev/null || echo '{"ready":false}')
IS_READY=$(echo "$HOOK_STATUS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(d.get('ready',False)).lower())" 2>/dev/null || echo "false")

if [[ "$IS_READY" != "true" ]]; then
  echo "  [..] Starting hook daemon..."
  node scripts/buccet.ts hook start
  sleep 2
  echo "  [OK]  Hook daemon started"
else
  echo "  [OK]  Hook daemon is running"
fi

cd "$DEMO_DIR"

# ── Reset workspace ───────────────────────────────────────────────────────
./reset.sh

echo "  BEFORE — workspace/reports/shared.txt:"
cat workspace/reports/shared.txt 2>/dev/null && echo "" || echo "  (empty)"
echo ""
echo "  ─────────────────────────────────────────────────────────────"
echo "  Launching 3 workers concurrently..."
echo "  Watch Terminal 2 — one prompt should appear with 3 requests."
echo ""

# Launch all 3 workers in background, wait for all to finish
cd "$REPO_DIR"
node scripts/buccet.ts hook run -- "$PYTHON_BIN" "$DEMO_DIR/worker.py" "worker-1" "0.0" &
PID1=$!
node scripts/buccet.ts hook run -- "$PYTHON_BIN" "$DEMO_DIR/worker.py" "worker-2" "0.15" &
PID2=$!
node scripts/buccet.ts hook run -- "$PYTHON_BIN" "$DEMO_DIR/worker.py" "worker-3" "0.30" &
PID3=$!

# Wait for all workers to finish (or be blocked)
wait $PID1 $PID2 $PID3 2>/dev/null || true

cd "$DEMO_DIR"

echo ""
echo "  ─────────────────────────────────────────────────────────────"
echo "  AFTER — workspace/reports/shared.txt:"
if [[ -f workspace/reports/shared.txt ]]; then
  LINE_COUNT=$(wc -l < workspace/reports/shared.txt | tr -d ' ')
  cat workspace/reports/shared.txt
  echo ""
  if [[ "$LINE_COUNT" -ge 3 ]]; then
    echo "  ✅ RESULT: All 3 workers wrote their entries after ONE approval."
    echo "             Swarm collapse confirmed."
  elif [[ "$LINE_COUNT" -eq 0 ]]; then
    echo "  ❌ RESULT: No entries written — did you approve in Terminal 2?"
    echo "             Type 1 in Terminal 2 to allow, then re-run."
  else
    echo "  ℹ️  $LINE_COUNT worker(s) completed — some may have been denied."
  fi
else
  echo "  (file not found)"
fi
echo ""
echo "  ─────────────────────────────────────────────────────────────"
echo "  Terminal 3 shows the full ledger for the swarm event."
echo "  Look for: SWARM_GROUP_SETTLED, UPL_ALLOW_RECORDED, ACTION_EXECUTED"
echo ""
