"""
CLI door adapter.

The Buccet CLI (`buccet` / `node cli/buccet.ts`) is a management interface —
it reads status, inspects ledgers, and configures sessions.  It is NOT a
packet enforcement boundary; it does not evaluate action proposals at runtime.

Therefore every case through this door is marked SKIPPED with the reason
"cli_door_is_not_enforcement_boundary".  Evidence entries are still written
so the audit ledger is complete.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

from adapters.base import AdapterResult, LiveVerdict

REPO_ROOT  = Path(__file__).parent.parent.parent.parent
CLI_SCRIPT = REPO_ROOT / "cli" / "buccet.ts"


class CliAdapter:

    def probe(self) -> dict:
        """Try to get CLI status; returns a probe result dict (informational only)."""
        if not CLI_SCRIPT.exists():
            return {"available": False, "reason": "cli/buccet.ts not found"}
        try:
            result = subprocess.run(
                ["node", str(CLI_SCRIPT), "status", "--json"],
                capture_output=True, text=True, timeout=5,
                cwd=str(REPO_ROOT),
            )
            return {"available": True, "stdout": result.stdout, "returncode": result.returncode}
        except Exception as exc:
            return {"available": False, "reason": str(exc)}

    def evaluate(self, packet: dict, tools: dict) -> AdapterResult:
        action_kind = packet.get("action_kind", "")
        reason = "cli_door_is_not_enforcement_boundary"
        verdict = LiveVerdict(
            decision="skipped",
            reason="The CLI door is a management interface, not a packet enforcement boundary.",
            law_ids=[],
            action_kind=action_kind,
            door="cli",
        )
        return AdapterResult(verdict=verdict, skipped=True, skip_reason=reason)
