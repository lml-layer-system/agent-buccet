"""
Buccet proof ledger — SHA-256 hash chain.

Each entry's hash covers the entire entry JSON (sorted keys, no whitespace)
with META.hash absent. META.prev_hash chains to the previous entry's hash.
"""

import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _zeros() -> str:
    return "0" * 64


def read_prev_hash(ledger_path: Path) -> str:
    if not ledger_path.exists():
        return _zeros()
    lines = [ln for ln in ledger_path.read_text().splitlines() if ln.strip()]
    if not lines:
        return _zeros()
    last = json.loads(lines[-1])
    return last["META"].get("hash", _zeros())


def entry_index(ledger_path: Path) -> int:
    if not ledger_path.exists():
        return 0
    lines = [ln for ln in ledger_path.read_text().splitlines() if ln.strip()]
    return len(lines)


def append_entry(
    ledger_path: Path,
    case_id: int,
    case_name: str,
    mode: str,
    packet: dict,
    verdict: dict,
    tool_result: dict | None,
) -> tuple[dict, str]:
    """Append one ledger entry. Returns (entry, hash)."""
    prev_hash = read_prev_hash(ledger_path)
    index = entry_index(ledger_path)

    outcome = "EXECUTED" if tool_result is not None else "BLOCKED"

    entry: dict = {
        "META": {
            "index": index,
            "id": str(uuid.uuid4()),
            "timestamp": _now_iso(),
            "session_id": packet.get("session_id", "gauntlet-session"),
            "case_id": case_id,
            "case_name": case_name,
            "mode": mode,
            "prev_hash": prev_hash,
        },
        "INPUT": {
            "source": packet.get("provenance"),
            "action": packet.get("action_kind"),
            "target": packet.get("target"),
            "payload_summary": packet.get("payload_summary", ""),
            "request_id": packet.get("request_id"),
        },
        "DECISION": {
            "verdict": verdict["decision"].upper(),
            "reason": verdict["reason"],
            "law_triggered": (
                verdict["triggered_law_ids"][0]
                if verdict.get("triggered_law_ids")
                else None
            ),
            "denial_class": verdict.get("denial_class"),
        },
        "NEXT": {
            "outcome": outcome,
            "tool_reached": tool_result is not None,
            "tool_result": tool_result,
        },
    }

    canonical = json.dumps(entry, sort_keys=True, separators=(",", ":"))
    record_hash = hashlib.sha256(canonical.encode()).hexdigest()
    entry["META"]["hash"] = record_hash

    ledger_path.parent.mkdir(parents=True, exist_ok=True)
    with open(ledger_path, "a") as f:
        f.write(json.dumps(entry) + "\n")

    return entry, record_hash
