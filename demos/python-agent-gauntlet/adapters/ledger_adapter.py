"""
Ledger adapter — reads the live Agent Buccet enforcement ledger.

The live ledger lives at:
  <repo_root>/data/ledger/agent-boundary-ledger.jsonl

Each line is a JSON object with a SHA-256 hash chain (same structure as the
simulation ledger but written by the live boundary runtime).

This adapter is read-only — it never writes to the live ledger.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

REPO_ROOT    = Path(__file__).parent.parent.parent.parent
LIVE_LEDGER  = REPO_ROOT / "data" / "ledger" / "agent-boundary-ledger.jsonl"


def read_live_ledger() -> list[dict]:
    """Return all parsed entries from the live boundary ledger, newest first."""
    if not LIVE_LEDGER.exists():
        return []
    entries = []
    for line in LIVE_LEDGER.read_text().splitlines():
        line = line.strip()
        if line:
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return entries


def find_entry_by_request_id(request_id: str) -> Optional[dict]:
    """Scan the live ledger for an entry matching request_id."""
    for entry in read_live_ledger():
        if entry.get("requestId") == request_id:
            return entry
        # Some entries nest it under INPUT
        inp = entry.get("INPUT", {})
        if inp.get("requestId") == request_id:
            return entry
    return None


def ledger_summary() -> dict:
    entries = read_live_ledger()
    return {
        "path":         str(LIVE_LEDGER),
        "exists":       LIVE_LEDGER.exists(),
        "entry_count":  len(entries),
    }
