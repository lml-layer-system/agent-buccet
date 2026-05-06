"""
MCP door adapter — Agent Buccet MCP/JSON-RPC server.

Spawns the MCP server with --dry-run (prevents real FS side-effects if any
action is accidentally allowed).  Sends one tools/call request and parses
the isError boundary response.  No policy logic here.

Spawn command:
  node scripts/agent-buccet-mcp-server.ts \
    --session-id <id> --actor-id agent-gauntlet \
    --sessions-dir <tmpdir> --home <tmpdir> --dry-run

Protocol:
  → initialize (JSON-RPC)
  ← initialize result (with capabilities)
  → notifications/initialized
  → tools/call  {"name": <mcp_tool>, "arguments": {...}}
  ← result.isError=true  → denied / require_approval
  ← result.isError=false → allowed

Deny response text prefix:  "Boundary denied:"
Approval response text prefix: "Boundary requires approval:"
"""

from __future__ import annotations

import json
import subprocess
import tempfile
import threading
import time
import uuid
from pathlib import Path
from typing import Optional

from adapters.base import AdapterResult, LiveVerdict
from adapters.runtime_adapter import _call_fake_tool

REPO_ROOT   = Path(__file__).parent.parent.parent.parent
MCP_SCRIPT  = REPO_ROOT / "scripts" / "agent-buccet-mcp-server.ts"

READY_TIMEOUT   = 15.0
VERDICT_TIMEOUT = 10.0

# ── action_kind → (mcp_tool_name, args_builder) ──────────────────────────────

def _build_mcp_call(packet: dict) -> tuple[Optional[str], Optional[dict]]:
    action_kind = packet.get("action_kind", "")
    target      = packet.get("target", "unknown")
    summary     = packet.get("payload_summary", "")

    if action_kind == "fs.delete":
        return "delete_file", {"path": target}
    if action_kind in ("fs.write", "fs.read"):
        return "write_file", {"path": target, "content": summary}
    if action_kind in ("comm.send", "chat.emit"):
        return "emit_chat", {"message": summary}
    if action_kind == "tool.exec":
        return "run_command", {"command": target}
    if action_kind == "network.send":
        return "send_http_request", {
            "url":    target,
            "method": "POST",
            "body":   summary,
        }
    if action_kind == "agent.spend":
        return None, None   # SKIPPED — no MCP tool maps to spend

    return None, None


class McpAdapter:
    """
    One-shot adapter: spawn MCP server → initialize → tools/call → parse.
    Uses temp dirs for --sessions-dir and --home so nothing persists.
    """

    def evaluate(self, packet: dict, tools: dict) -> AdapterResult:
        action_kind = packet.get("action_kind", "")
        mcp_tool, mcp_args = _build_mcp_call(packet)

        if mcp_tool is None:
            verdict = LiveVerdict(
                decision="skipped",
                reason=f"action_kind '{action_kind}' has no MCP tool equivalent",
                law_ids=[],
                action_kind=action_kind,
                door="mcp",
            )
            return AdapterResult(verdict=verdict, skipped=True,
                                 skip_reason=verdict.reason)

        session_id = f"live-mcp-{uuid.uuid4().hex[:12]}"
        tmp = tempfile.mkdtemp(prefix="ab-mcp-")

        proc = self._spawn_server(session_id, tmp)
        if proc is None:
            verdict = LiveVerdict(
                decision="skipped",
                reason="MCP server failed to start",
                law_ids=[],
                action_kind=action_kind,
                door="mcp",
            )
            return AdapterResult(verdict=verdict, skipped=True,
                                 skip_reason=verdict.reason)

        try:
            raw = self._run_session(proc, mcp_tool, mcp_args)
        finally:
            try:
                proc.kill()
                proc.wait(timeout=2)
            except Exception:
                pass
            try:
                import shutil
                shutil.rmtree(tmp, ignore_errors=True)
            except Exception:
                pass

        if raw is None:
            verdict = LiveVerdict(
                decision="error",
                reason="no response received from MCP server (timeout)",
                law_ids=[],
                action_kind=action_kind,
                door="mcp",
            )
            return AdapterResult(verdict=verdict, skipped=True,
                                 skip_reason=verdict.reason)

        decision, reason, law_ids = _parse_mcp_response(raw)

        verdict = LiveVerdict(
            decision=decision,
            reason=reason,
            law_ids=law_ids,
            action_kind=action_kind,
            door="mcp",
            raw_response=raw,
        )

        tool_result = None
        if decision == "allow":
            tool_result = _call_fake_tool(packet, tools)

        return AdapterResult(verdict=verdict, tool_result=tool_result)

    # ── internals ────────────────────────────────────────────────────────────

    def _spawn_server(self, session_id: str, tmp_dir: str) -> Optional[subprocess.Popen]:
        if not MCP_SCRIPT.exists():
            return None
        cmd = [
            "node", str(MCP_SCRIPT),
            "--session-id",   session_id,
            "--actor-id",     "agent-gauntlet",
            "--sessions-dir", tmp_dir,
            "--home",         tmp_dir,
            "--dry-run",
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

        # The MCP server emits nothing to stderr at startup — it begins reading
        # stdin immediately after module load (~1s on a warm Node.js cache).
        # Poll until alive or timeout.
        deadline = time.monotonic() + READY_TIMEOUT
        while time.monotonic() < deadline:
            if proc.poll() is not None:
                return None   # exited unexpectedly
            time.sleep(0.1)
            # Once the process has been alive for 2s it's ready to accept JSON-RPC.
            if time.monotonic() - (deadline - READY_TIMEOUT) >= 2.0:
                return proc

        proc.kill()
        return None

    def _run_session(self, proc: subprocess.Popen, tool_name: str,
                     tool_args: dict) -> Optional[dict]:
        def _send(obj: dict) -> None:
            proc.stdin.write(json.dumps(obj) + "\n")
            proc.stdin.flush()

        # 1. initialize
        _send({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "gauntlet", "version": "1.0"},
            },
        })

        init_resp = self._read_jsonrpc_response(proc, expected_id=1)
        if init_resp is None:
            return None

        # 2. notifications/initialized
        _send({"jsonrpc": "2.0", "id": 2, "method": "notifications/initialized", "params": {}})

        # 3. tools/call
        _send({
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": tool_args},
        })

        return self._read_jsonrpc_response(proc, expected_id=3)

    def _read_jsonrpc_response(self, proc: subprocess.Popen,
                                expected_id: int) -> Optional[dict]:
        result: list = [None]
        done = threading.Event()

        def _reader():
            for raw_line in proc.stdout:
                line = raw_line.strip()
                if not line:
                    continue
                try:
                    parsed = json.loads(line)
                    if parsed.get("id") == expected_id:
                        result[0] = parsed
                        done.set()
                        return
                except json.JSONDecodeError:
                    pass

        t = threading.Thread(target=_reader, daemon=True)
        t.start()
        done.wait(timeout=VERDICT_TIMEOUT)
        return result[0]


# ── response parsing ──────────────────────────────────────────────────────────

def _parse_mcp_response(raw: dict) -> tuple[str, str, list]:
    """Return (decision, reason, law_ids) from a tools/call JSON-RPC response."""
    result = raw.get("result", {})
    is_error = result.get("isError", False)

    if not is_error:
        return "allow", "MCP server allowed action (no boundary error)", []

    content = result.get("content", [])
    text = ""
    for item in content:
        if isinstance(item, dict) and item.get("type") == "text":
            text = item.get("text", "")
            break

    if text.startswith("Boundary requires approval:"):
        reason = text[len("Boundary requires approval:"):].strip()
        law_ids = _extract_law_ids(text)
        return "require_approval", reason, law_ids

    if text.startswith("Boundary denied:"):
        reason = text[len("Boundary denied:"):].strip()
        law_ids = _extract_law_ids(text)
        return "deny", reason, law_ids

    # Generic boundary error
    return "deny", text or "boundary denied (unknown reason)", []


def _extract_law_ids(text: str) -> list:
    """Extract law IDs from 'lawIds: [...]' or 'lawIds: id1,id2' in text."""
    for line in text.splitlines():
        if "lawIds:" in line:
            raw = line.split("lawIds:", 1)[1].strip()
            raw = raw.strip("[]").replace('"', "").replace("'", "")
            ids = [x.strip() for x in raw.split(",") if x.strip()]
            return ids
    return []
