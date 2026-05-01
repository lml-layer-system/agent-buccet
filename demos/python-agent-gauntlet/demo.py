#!/usr/bin/env python3
"""
Agent Buccet Python Proof Harness
==================================
Demonstrates that the same raw agent action packet produces two outcomes:

  python demo.py                    # Buccet mode  → DENY, tool never called
  python demo.py --unsafe-no-buccet # Unsafe mode  → BYPASSED, tool executes

No external dependencies — pure Python stdlib.
"""

import argparse
import hashlib
import json
import sys
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

ROOT = Path(__file__).parent
OUTPUT_DIR = ROOT / "output"
UPL_RULES_PATH = ROOT / "upl_rules.json"
LEDGER_PATH = OUTPUT_DIR / "ledger.jsonl"

OUTPUT_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Tools (imported here so the import itself is visible in both modes)
# ---------------------------------------------------------------------------

sys.path.insert(0, str(ROOT))
from tools.fake_github import FakeGitHubTool  # noqa: E402
from tools.fake_spend import FakeSpendTool    # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2))


def _separator(title: str = "") -> None:
    width = 60
    if title:
        pad = max(0, width - len(title) - 4)
        print(f"\n{'=' * 2} {title} {'=' * pad}")
    else:
        print("=" * width)


# ---------------------------------------------------------------------------
# Step 1: Build the raw agent action packet (identical in both modes)
# ---------------------------------------------------------------------------

def build_agent_packet() -> dict:
    return {
        "request_id": str(uuid.uuid4()),
        "session_id": "demo-session-001",
        "action_kind": "tool.exec",
        "target": "github.pr.create",
        "payload_summary": (
            "Create PR 'Add demo feature' from branch feature/demo → main. "
            "Merges 3 commits. Auto-assigns review to @team-lead."
        ),
        "provenance": "agent_inference",
        "requested_at": _now_iso(),
        "flags": {
            "authority_claimed": False,
            "requests_scope_expansion": False,
            "claims_complete_coverage": False,
        },
    }


# ---------------------------------------------------------------------------
# Step 2: Load active UPL snapshot
# ---------------------------------------------------------------------------

def load_upl_snapshot() -> dict:
    with open(UPL_RULES_PATH) as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Step 3: Buccet evaluation engine (the law)
# ---------------------------------------------------------------------------

def _target_matches(rule_target: str, packet_target: str) -> bool:
    """Exact match or wildcard (*) match."""
    if rule_target == "*":
        return True
    return rule_target == packet_target


def evaluate_buccet(packet: dict, upl_rules: dict) -> dict:
    """
    Scan active DENIED tracks. First matching denial wins.
    Returns a verdict packet.
    """
    for rule in upl_rules.get("tracks", []):
        if rule.get("status") != "ACTIVE":
            continue
        if rule.get("type") != "DENIED":
            continue
        if rule.get("action_kind") != packet["action_kind"]:
            continue
        if not _target_matches(rule["target"], packet["target"]):
            continue

        # Match found — deny immediately.
        return {
            "verdict_id": str(uuid.uuid4()),
            "request_id": packet["request_id"],
            "session_id": packet["session_id"],
            "evaluated_at": _now_iso(),
            "decision": "deny",
            "reason": f"Denied by UPL rule {rule['id']}: {rule['reason']}",
            "triggered_law_ids": [rule["id"]],
            "requires_approval": False,
            "denial_class": rule.get("denial_class"),
            "tool_reached": False,
        }

    # No denial matched → allow.
    return {
        "verdict_id": str(uuid.uuid4()),
        "request_id": packet["request_id"],
        "session_id": packet["session_id"],
        "evaluated_at": _now_iso(),
        "decision": "allow",
        "reason": "No active denial rules matched this action.",
        "triggered_law_ids": [],
        "requires_approval": False,
        "denial_class": None,
        "tool_reached": None,  # will be set after execution
    }


# ---------------------------------------------------------------------------
# Step 4: Ledger — SHA-256 hash chain
# ---------------------------------------------------------------------------

def _read_prev_hash() -> str:
    """Return the hash of the last ledger entry, or 64 zeros if ledger is empty."""
    zeros = "0" * 64
    if not LEDGER_PATH.exists():
        return zeros
    lines = [l for l in LEDGER_PATH.read_text().splitlines() if l.strip()]
    if not lines:
        return zeros
    last = json.loads(lines[-1])
    return last["META"].get("hash", zeros)


def _entry_index() -> int:
    if not LEDGER_PATH.exists():
        return 0
    lines = [l for l in LEDGER_PATH.read_text().splitlines() if l.strip()]
    return len(lines)


def append_ledger_entry(
    packet: dict,
    verdict: dict,
    mode: str,
    tool_result: dict | None,
) -> tuple[dict, str]:
    """
    Build and append a ledger entry. Returns (entry, hash).
    The hash covers the entire entry except META.hash itself.
    """
    prev_hash = _read_prev_hash()
    index = _entry_index()

    outcome = "EXECUTED" if (tool_result is not None) else "BLOCKED"
    decision_verdict = verdict["decision"].upper()  # DENY / ALLOW / BYPASSED

    entry: dict = {
        "META": {
            "index": index,
            "id": str(uuid.uuid4()),
            "timestamp": _now_iso(),
            "session_id": packet["session_id"],
            "mode": mode,
            "prev_hash": prev_hash,
            # hash added below
        },
        "INPUT": {
            "source": packet["provenance"],
            "action": packet["action_kind"],
            "target": packet["target"],
            "payload_summary": packet["payload_summary"],
            "request_id": packet["request_id"],
        },
        "DECISION": {
            "verdict": decision_verdict,
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

    # Compute hash over the entry WITHOUT the hash field present.
    canonical = json.dumps(entry, sort_keys=True, separators=(",", ":"))
    record_hash = hashlib.sha256(canonical.encode()).hexdigest()
    entry["META"]["hash"] = record_hash

    with open(LEDGER_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")

    return entry, record_hash


# ---------------------------------------------------------------------------
# Main demo runner
# ---------------------------------------------------------------------------

def run(unsafe: bool) -> None:
    mode = "unsafe" if unsafe else "buccet"
    github_tool = FakeGitHubTool()
    spend_tool = FakeSpendTool()  # loaded but not used in this packet

    # ── Step 1: Build packet ────────────────────────────────────────────────
    packet = build_agent_packet()
    _separator("RAW AGENT ACTION PACKET")
    print(json.dumps(packet, indent=2))

    # ── Step 2: UPL snapshot ────────────────────────────────────────────────
    upl_rules = load_upl_snapshot()
    _separator("ACTIVE UPL SNAPSHOT")
    print(json.dumps(upl_rules, indent=2))

    # ── Step 3: Mode branch ─────────────────────────────────────────────────
    tool_result: dict | None = None

    if unsafe:
        _separator("MODE: UNSAFE  (--unsafe-no-buccet)")
        print("Buccet evaluation SKIPPED. Sending packet directly to tool.")
        print()
        tool_result = github_tool.execute(packet)

        verdict: dict = {
            "verdict_id": str(uuid.uuid4()),
            "request_id": packet["request_id"],
            "session_id": packet["session_id"],
            "evaluated_at": _now_iso(),
            "decision": "bypassed",
            "reason": "Buccet bypassed — --unsafe-no-buccet flag set. No law evaluated.",
            "triggered_law_ids": [],
            "requires_approval": False,
            "denial_class": None,
            "tool_reached": True,
        }

    else:
        _separator("MODE: BUCCET  (protected)")
        print("Evaluating packet against active UPL rules...")
        print()
        verdict = evaluate_buccet(packet, upl_rules)

        _separator("BUCCET VERDICT PACKET")
        print(json.dumps(verdict, indent=2))

        if verdict["decision"] == "deny":
            print()
            print("[BUCCET] Action DENIED.")
            print("[BUCCET] Tool was NOT called. Execution stopped at law boundary.")
            tool_result = None
            verdict["tool_reached"] = False
        else:
            print()
            print("[BUCCET] Action ALLOWED. Executing tool.")
            tool_result = github_tool.execute(packet)
            verdict["tool_reached"] = True

    # ── Step 4: Write output artifacts ─────────────────────────────────────
    _write_json(OUTPUT_DIR / "agent_packet.json", packet)
    _write_json(OUTPUT_DIR / "upl_snapshot.json", upl_rules)
    _write_json(OUTPUT_DIR / "verdict_packet.json", verdict)
    _write_json(
        OUTPUT_DIR / "tool_execution_log.json",
        {
            "mode": mode,
            "tool_called": tool_result is not None,
            "tool": "github.pr.create",
            "result": tool_result,
        },
    )

    # ── Step 5: Append ledger entry ─────────────────────────────────────────
    ledger_entry, record_hash = append_ledger_entry(packet, verdict, mode, tool_result)

    # ── Step 6: Proof summary ───────────────────────────────────────────────
    _separator("PROOF SUMMARY")

    if unsafe:
        print(f"  Mode:          unsafe (--unsafe-no-buccet)")
        print(f"  Action:        {packet['target']}")
        print(f"  Verdict:       BYPASSED")
        print(f"  Law triggered: none (Buccet not evaluated)")
        print(f"  Tool reached:  TRUE  ← github tool WAS called")
        if tool_result:
            print(f"  PR URL:        {tool_result['pr_url']}")
    else:
        law_id = verdict["triggered_law_ids"][0] if verdict["triggered_law_ids"] else "none"
        print(f"  Mode:          buccet")
        print(f"  Action:        {packet['target']}")
        print(f"  Verdict:       {verdict['decision'].upper()}")
        print(f"  Law triggered: {law_id}")
        print(f"  Denial class:  {verdict.get('denial_class', 'n/a')}")
        print(f"  Tool reached:  {'TRUE' if verdict['tool_reached'] else 'FALSE'}  "
              f"{'← github tool was NEVER called' if not verdict['tool_reached'] else ''}")

    print(f"  Ledger entry:  output/ledger.jsonl (entry #{ledger_entry['META']['index']})")
    print(f"  Record hash:   {record_hash[:16]}...")
    _separator()

    if not unsafe:
        print()
        print("Run with --unsafe-no-buccet to see the same packet execute without Buccet.")
    else:
        print()
        print("Run without --unsafe-no-buccet to see Buccet block the same packet.")

    print()
    print("Verify ledger integrity:")
    print("  python verify_ledger.py")
    print()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Agent Buccet Python Proof Harness",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python demo.py                     # Buccet mode (default) — action denied
  python demo.py --unsafe-no-buccet  # Unsafe mode — action executes
  python verify_ledger.py            # Verify the hash chain
""",
    )
    parser.add_argument(
        "--unsafe-no-buccet",
        action="store_true",
        default=False,
        help="Skip Buccet law evaluation and execute the tool directly.",
    )
    args = parser.parse_args()
    run(unsafe=args.unsafe_no_buccet)
