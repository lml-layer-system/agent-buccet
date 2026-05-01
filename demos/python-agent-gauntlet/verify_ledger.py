#!/usr/bin/env python3
"""
Agent Buccet Ledger Verifier
=============================
Reads output/ledger.jsonl and verifies the SHA-256 hash chain.

For each entry it:
  1. Extracts the stored hash from META.hash
  2. Removes META.hash from the entry
  3. Recomputes SHA-256 of the canonical JSON (sorted keys, no whitespace)
  4. Confirms the recomputed hash matches the stored hash
  5. Confirms META.prev_hash matches the previous entry's hash
     (first entry must have prev_hash of 64 zeros)

Exit code 0 = chain verified. Exit code 1 = chain broken.
"""

import hashlib
import json
import sys
from pathlib import Path

LEDGER_PATH = Path(__file__).parent / "output" / "ledger.jsonl"
ZEROS = "0" * 64


def _recompute_hash(entry: dict) -> str:
    """Recompute the hash of an entry (META.hash must already be removed)."""
    canonical = json.dumps(entry, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def verify() -> bool:
    if not LEDGER_PATH.exists():
        print(f"ERROR: Ledger not found at {LEDGER_PATH}")
        print("Run demo.py first to generate a ledger.")
        return False

    lines = [l for l in LEDGER_PATH.read_text().splitlines() if l.strip()]
    if not lines:
        print("ERROR: Ledger file is empty. Run demo.py first.")
        return False

    print(f"Verifying {len(lines)} ledger entr{'y' if len(lines) == 1 else 'ies'} ...")
    print()

    all_passed = True
    prev_hash = ZEROS

    for i, line in enumerate(lines):
        entry = json.loads(line)
        meta = entry.get("META", {})

        stored_hash = meta.get("hash", "")
        stored_prev = meta.get("prev_hash", "")
        mode = meta.get("mode", "?")
        action = entry.get("INPUT", {}).get("target", "?")
        verdict = entry.get("DECISION", {}).get("verdict", "?")
        tool_reached = entry.get("NEXT", {}).get("tool_reached", "?")

        # Remove hash field before recomputing.
        entry_for_hash = json.loads(line)
        del entry_for_hash["META"]["hash"]
        recomputed = _recompute_hash(entry_for_hash)

        hash_ok = recomputed == stored_hash
        prev_ok = stored_prev == prev_hash

        status = "PASS" if (hash_ok and prev_ok) else "FAIL"
        if not (hash_ok and prev_ok):
            all_passed = False

        print(f"  Entry {i}  [{status}]")
        print(f"    mode:         {mode}")
        print(f"    action:       {action}")
        print(f"    verdict:      {verdict}")
        print(f"    tool_reached: {tool_reached}")
        print(f"    hash:         {stored_hash[:16]}...  {'✓' if hash_ok else '✗ MISMATCH'}")
        print(f"    prev_hash:    {stored_prev[:16]}...  {'✓' if prev_ok else '✗ MISMATCH'}")
        if not hash_ok:
            print(f"    expected:     {recomputed[:16]}...")
        print()

        prev_hash = stored_hash

    width = 60
    if all_passed:
        print("=" * width)
        print(f"  Chain: VERIFIED  ({len(lines)} entr{'y' if len(lines) == 1 else 'ies'}, all hashes valid)")
        print("=" * width)
    else:
        print("=" * width)
        print("  Chain: BROKEN  — one or more entries failed verification")
        print("=" * width)

    return all_passed


if __name__ == "__main__":
    ok = verify()
    sys.exit(0 if ok else 1)
