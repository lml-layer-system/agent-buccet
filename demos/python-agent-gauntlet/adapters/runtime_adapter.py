"""
Runtime door adapter — Agent Buccet intercept daemon.

Spawns the intercept daemon as a subprocess, sends one action proposal via
stdin (JSON line), reads the verdict from stdout (JSON line), and returns
an AdapterResult.  No policy logic here — we only relay and parse.

Spawn command:
  node scripts/agent-buccet-intercept-daemon.ts \
    --session-id <id> \
    --heartbeat-ms 250 \
    --heartbeat-timeout-ms 3000

Ready signal: stderr line containing "daemon running" or "server running".

Request  → stdin:  {"requestId":..., "actionClass":..., "operation":...,
                    "target":..., "payloadSummary":..., "provenance":...}
Response ← stdout: {"type":"decision", "decision":"allow|deny|require_approval",
                    "reason":..., "lawIds":[...], "actionKind":...}
"""

from __future__ import annotations

import json
import subprocess
import threading
import time
import uuid
from pathlib import Path
from typing import Optional

from adapters.base import AdapterResult, LiveVerdict, now_iso

# ── action_kind → intercept (actionClass, operation) ─────────────────────────

ACTION_KIND_MAP: dict[str, Optional[tuple[str, str]]] = {
    "fs.delete":    ("file",          "delete"),
    "fs.write":     ("file",          "write"),
    "fs.read":      ("file",          "read"),
    "comm.send":    ("communication", "emit"),
    "chat.emit":    ("communication", "emit"),
    "tool.exec":    ("shell",         "exec"),
    "network.send": ("network",       "send"),
    "agent.spend":  None,  # no intercept equivalent — always SKIPPED
}

REPO_ROOT = Path(__file__).parent.parent.parent.parent  # demos/.. → repo root
DAEMON_SCRIPT = REPO_ROOT / "scripts" / "agent-buccet-intercept-daemon.ts"

READY_TIMEOUT  = 10.0   # seconds to wait for daemon ready
VERDICT_TIMEOUT = 8.0   # seconds to wait for a verdict line


class RuntimeAdapter:
    """
    One-shot adapter: spawn daemon → send request → read verdict → kill daemon.
    A fresh session ID is used per call so there is no session state leakage.
    """

    def evaluate(self, packet: dict, tools: dict) -> AdapterResult:
        action_kind = packet.get("action_kind", "")
        mapping = ACTION_KIND_MAP.get(action_kind)

        if mapping is None:
            verdict = LiveVerdict(
                decision="skipped",
                reason=f"action_kind '{action_kind}' has no intercept daemon equivalent",
                law_ids=[],
                action_kind=action_kind,
                door="runtime",
            )
            return AdapterResult(verdict=verdict, skipped=True,
                                 skip_reason=verdict.reason)

        action_class, operation = mapping
        session_id = f"live-gauntlet-{uuid.uuid4().hex[:12]}"

        proc = self._spawn_daemon(session_id)
        if proc is None:
            verdict = LiveVerdict(
                decision="skipped",
                reason="intercept daemon failed to start",
                law_ids=[],
                action_kind=action_kind,
                door="runtime",
            )
            return AdapterResult(verdict=verdict, skipped=True,
                                 skip_reason=verdict.reason)

        try:
            request_id = packet.get("request_id", str(uuid.uuid4()))
            req = {
                "requestId":     request_id,
                "actionClass":   action_class,
                "operation":     operation,
                "target":        packet.get("target", ""),
                "payloadSummary": packet.get("payload_summary", ""),
                "provenance":    packet.get("provenance", "agent_inference"),
            }
            raw = self._send_and_receive(proc, req)
        finally:
            try:
                proc.kill()
                proc.wait(timeout=2)
            except Exception:
                pass

        if raw is None:
            verdict = LiveVerdict(
                decision="error",
                reason="no verdict received from intercept daemon (timeout)",
                law_ids=[],
                action_kind=action_kind,
                door="runtime",
            )
            return AdapterResult(verdict=verdict, skipped=True,
                                 skip_reason=verdict.reason)

        decision    = raw.get("decision", "deny")
        reason      = raw.get("reason", "")
        law_ids     = raw.get("lawIds") or []
        action_kind_out = raw.get("actionKind", action_kind)

        verdict = LiveVerdict(
            decision=decision,
            reason=reason,
            law_ids=law_ids,
            action_kind=action_kind_out,
            door="runtime",
            raw_response=raw,
        )

        tool_result = None
        if decision == "allow":
            tool_result = _call_fake_tool(packet, tools)

        return AdapterResult(verdict=verdict, tool_result=tool_result)

    # ── internals ────────────────────────────────────────────────────────────

    def _spawn_daemon(self, session_id: str) -> Optional[subprocess.Popen]:
        if not DAEMON_SCRIPT.exists():
            return None
        cmd = [
            "node", str(DAEMON_SCRIPT),
            "--session-id", session_id,
            "--heartbeat-ms", "250",
            "--heartbeat-timeout-ms", "3000",
        ]
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            cwd=str(REPO_ROOT),
        )

        ready = threading.Event()
        stderr_lines: list[str] = []

        def _read_stderr():
            for line in proc.stderr:
                stderr_lines.append(line)
                if "daemon running" in line.lower() or "server running" in line.lower():
                    ready.set()

        t = threading.Thread(target=_read_stderr, daemon=True)
        t.start()

        if not ready.wait(timeout=READY_TIMEOUT):
            proc.kill()
            return None

        return proc

    def _send_and_receive(self, proc: subprocess.Popen, req: dict) -> Optional[dict]:
        try:
            proc.stdin.write(json.dumps(req) + "\n")
            proc.stdin.flush()
        except BrokenPipeError:
            return None

        result: list[Optional[dict]] = [None]
        done = threading.Event()

        def _reader():
            for raw_line in proc.stdout:
                line = raw_line.strip()
                if not line:
                    continue
                try:
                    parsed = json.loads(line)
                    if parsed.get("type") == "decision":
                        result[0] = parsed
                        done.set()
                        return
                except json.JSONDecodeError:
                    pass

        t = threading.Thread(target=_reader, daemon=True)
        t.start()
        done.wait(timeout=VERDICT_TIMEOUT)
        return result[0]


# ── fake tool dispatch ────────────────────────────────────────────────────────

def _call_fake_tool(packet: dict, tools: dict) -> Optional[dict]:
    action_kind = packet.get("action_kind", "")
    try:
        if action_kind == "fs.delete":
            return tools["fs"].delete(packet)
        elif action_kind == "fs.write":
            return tools["fs"].write(packet)
        elif action_kind == "fs.read":
            return tools["fs"].read(packet)
        elif action_kind in ("comm.send", "chat.emit"):
            return tools["comm"].send(packet)
        elif action_kind == "tool.exec":
            return tools["github"].execute(packet)
        elif action_kind == "network.send":
            return tools["network"].send(packet)
        elif action_kind == "agent.spend":
            return tools["spend"].execute(packet)
    except Exception as exc:
        return {"error": str(exc), "called": True}
    return None
