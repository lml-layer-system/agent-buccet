#!/usr/bin/env python3
"""
Agent Buccet Ledger Verifier
=============================
Reads output/ledger.jsonl and verifies the full SHA-256 hash chain.

For each entry:
  1. Extracts META.hash (stored)
  2. Removes META.hash, recomputes SHA-256 of canonical JSON
  3. Confirms recomputed == stored
  4. Confirms META.prev_hash == previous entry's hash (first: 64 zeros)

Exit 0 = chain verified. Exit 1 = broken.
"""

import hashlib
import json
import sys
from pathlib import Path

LEDGER_PATH = Path(__file__).parent / "output" / "ledger.jsonl"
ZEROS = "0" * 64


def _recompute(entry: dict) -> str:
    canonical = json.dumps(entry, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def verify() -> bool:
    if not LEDGER_PATH.exists():
        print(f"ERROR: Ledger not found at {LEDGER_PATH}")
        print("Run:  python demo.py")
        return False

    lines = [ln for ln in LEDGER_PATH.read_text().splitlines() if ln.strip()]
    if not lines:
        print("ERROR: Ledger is empty. Run:  python demo.py")
        return False

    total = len(lines)
    print(f"Verifying {total} ledger entr{'y' if total == 1 else 'ies'} ...")
    print()

    all_passed = True
    prev_hash = ZEROS

    for i, line in enumerate(lines):
        raw = json.loads(line)
        meta = raw.get("META", {})

        stored_hash = meta.get("hash", "")
        stored_prev = meta.get("prev_hash", "")
        case_id     = meta.get("case_id", "?")
        case_name   = meta.get("case_name", "?")
        mode        = meta.get("mode", "?")
        verdict     = raw.get("DECISION", {}).get("verdict", "?")
        tool_reached = raw.get("NEXT", {}).get("tool_reached", "?")

        without_hash = json.loads(line)
        del without_hash["META"]["hash"]
        recomputed = _recompute(without_hash)

        hash_ok = (recomputed == stored_hash)
        prev_ok = (stored_prev == prev_hash)
        entry_ok = hash_ok and prev_ok

        if not entry_ok:
            all_passed = False

        status = "PASS" if entry_ok else "FAIL"
        print(f"  Entry {i:02d}  case={case_id:02d}  [{status}]")
        print(f"    case_name:    {case_name}")
        print(f"    mode:         {mode}")
        print(f"    verdict:      {verdict}")
        print(f"    tool_reached: {tool_reached}")
        print(f"    hash:         {stored_hash[:16]}...  {'✓' if hash_ok else '✗ MISMATCH'}")
        print(f"    prev_hash:    {stored_prev[:16]}...  {'✓' if prev_ok else '✗ MISMATCH'}")
        if not hash_ok:
            print(f"    expected:     {recomputed[:16]}...")
        print()

        prev_hash = stored_hash

    width = 68
    print("=" * width)
    if all_passed:
        print(f"  Chain: VERIFIED  ({total} entr{'y' if total == 1 else 'ies'}, all hashes valid)")
        print(f"  RESULT: PASS")
    else:
        print(f"  Chain: BROKEN  — one or more entries failed verification")
        print(f"  RESULT: FAIL")
    print("=" * width)

    return all_passed


if __name__ == "__main__":
    ok = verify()
    sys.exit(0 if ok else 1)
