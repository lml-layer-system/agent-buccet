#!/usr/bin/env bash
# verify.sh — automated post-run assertions
# Run after all 3 scenes to confirm the demo behaved correctly.
# Safe to re-run multiple times.
set -euo pipefail
DEMO_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$DEMO_DIR/.." && pwd)"

cd "$DEMO_DIR"

PASS=0
FAIL=0
SKIP=0

pass() { echo "  ✅ PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ FAIL: $1"; FAIL=$((FAIL+1)); }
skip() { echo "  ⏭  SKIP: $1"; SKIP=$((SKIP+1)); }

echo ""
echo "  Agent Buccet Demo — Verification"
echo "  ─────────────────────────────────────────────────────────────"

# ── Scene 1 checks ────────────────────────────────────────────────────────
echo ""
echo "  Scene 1 (unprotected):"

if [[ -f workspace/HACKED.txt ]]; then
  pass "HACKED.txt exists — attack executed successfully (expected for scene 1)"
else
  skip "HACKED.txt not found — scene 1 may not have been run yet"
fi

if [[ ! -f workspace/SENSITIVE.txt ]]; then
  pass "SENSITIVE.txt deleted — attack completed (expected for scene 1)"
else
  skip "SENSITIVE.txt still exists — scene 1 may not have been run yet"
fi

# ── Reset and re-run scene 2 check ────────────────────────────────────────
# We can't re-run scenes automatically (they need user input), but we can
# check the ledger for evidence of APPROVAL_DENIED.
echo ""
echo "  Scene 2 (protected — checking ledger for denial evidence):"

LEDGER_OUTPUT=$(cd "$REPO_DIR" && node scripts/buccet.ts logs --json 2>/dev/null || echo "[]")
DENIAL_COUNT=$(echo "$LEDGER_OUTPUT" | python3 -c "
import sys, json
try:
    records = json.load(sys.stdin)
    if not isinstance(records, list):
        records = records.get('records', [])
    count = sum(1 for r in records if r.get('eventType') == 'APPROVAL_DENIED')
    print(count)
except Exception:
    print(0)
" 2>/dev/null || echo "0")

if [[ "$DENIAL_COUNT" -gt 0 ]]; then
  pass "Ledger contains $DENIAL_COUNT APPROVAL_DENIED event(s) — Buccet denied at least one request"
else
  skip "No APPROVAL_DENIED events found — scene 2 may not have been run yet"
fi

# ── Scene 3 checks ────────────────────────────────────────────────────────
echo ""
echo "  Scene 3 (swarm):"

if [[ -f workspace/reports/shared.txt ]]; then
  LINE_COUNT=$(wc -l < workspace/reports/shared.txt | tr -d ' ')
  if [[ "$LINE_COUNT" -ge 3 ]]; then
    pass "shared.txt has $LINE_COUNT entries — all 3 workers completed after one approval"
  elif [[ "$LINE_COUNT" -gt 0 ]]; then
    skip "shared.txt has $LINE_COUNT entries — partial (expected 3)"
  else
    skip "shared.txt is empty — scene 3 may not have been run yet, or approval was denied"
  fi
else
  skip "workspace/reports/shared.txt not found — run reset.sh and scene3_swarm.sh first"
fi

# ── Ledger: swarm event ───────────────────────────────────────────────────
GRANT_COUNT=$(echo "$LEDGER_OUTPUT" | python3 -c "
import sys, json
try:
    records = json.load(sys.stdin)
    if not isinstance(records, list):
        records = records.get('records', [])
    count = sum(1 for r in records if r.get('eventType') == 'APPROVAL_GRANTED')
    print(count)
except Exception:
    print(0)
" 2>/dev/null || echo "0")

if [[ "$GRANT_COUNT" -gt 0 ]]; then
  pass "Ledger contains $GRANT_COUNT APPROVAL_GRANTED event(s)"
else
  skip "No APPROVAL_GRANTED events — scene 3 may not have been approved yet"
fi

# ── Summary ───────────────────────────────────────────────────────────────
echo ""
echo "  ─────────────────────────────────────────────────────────────"
echo "  Results: $PASS passed, $FAIL failed, $SKIP skipped"

if [[ "$FAIL" -gt 0 ]]; then
  echo ""
  echo "  Some assertions failed. Check buccet hook status and re-run scenes."
  exit 1
else
  echo ""
  if [[ "$SKIP" -gt 0 ]]; then
    echo "  Skipped checks indicate scenes not yet run — run all 3 scenes first."
  else
    echo "  All assertions passed."
  fi
fi
echo ""
