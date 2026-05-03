"""
Approval boundary adapter.

Wraps RuntimeAdapter but keeps the daemon process alive long enough to
exercise swarm_status + swarm_deny on the SAME session that issued the
require_approval verdict.  (A new session cannot see pending groups from
a different session — that's why the original implementation was a no-op.)

Proof:  require_approval → swarm_deny on same session → tool NOT reached.
"""

from __future__ import annotations

import json
import threading
import uuid
from typing import Optional

from adapters.base import AdapterResult, LiveVerdict
from adapters.runtime_adapter import (
    ACTION_KIND_MAP,
    RuntimeAdapter,
    _call_fake_tool,
)


class ApprovalAdapter:
    """
    Demonstrates the approval boundary:
    - require_approval verdict → swarm_deny exercised on the same daemon session.
    - Tool is never called.
    - For other decisions delegates straight to RuntimeAdapter.
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
            return AdapterResult(verdict=verdict, skipped=True, skip_reason=verdict.reason)

        action_class, operation = mapping
        session_id = f"live-approval-{uuid.uuid4().hex[:12]}"
        runtime = RuntimeAdapter()

        proc = runtime._spawn_daemon(session_id)
        if proc is None:
            verdict = LiveVerdict(
                decision="skipped",
                reason="intercept daemon failed to start",
                law_ids=[],
                action_kind=action_kind,
                door="runtime",
            )
            return AdapterResult(verdict=verdict, skipped=True, skip_reason=verdict.reason)

        try:
            request_id = packet.get("request_id", str(uuid.uuid4()))
            req = {
                "requestId":      request_id,
                "actionClass":    action_class,
                "operation":      operation,
                "target":         packet.get("target", ""),
                "payloadSummary": packet.get("payload_summary", ""),
                "provenance":     packet.get("provenance", "agent_inference"),
            }
            raw = runtime._send_and_receive(proc, req)

            swarm_note = ""
            if raw and raw.get("decision") == "require_approval":
                swarm_note = self._swarm_deny_on_same_proc(proc)

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
            return AdapterResult(verdict=verdict, skipped=True, skip_reason=verdict.reason)

        decision = raw.get("decision", "deny")
        reason   = raw.get("reason", "")
        if swarm_note:
            reason = reason + f"  [{swarm_note}]"

        verdict = LiveVerdict(
            decision=decision,
            reason=reason,
            law_ids=raw.get("lawIds") or [],
            action_kind=raw.get("actionKind", action_kind),
            door="runtime",
            raw_response=raw,
        )

        tool_result = None
        if decision == "allow":
            tool_result = _call_fake_tool(packet, tools)

        return AdapterResult(verdict=verdict, tool_result=tool_result)

    def _swarm_deny_on_same_proc(self, proc) -> str:
        """
        On the same live daemon session: query pending groups and deny the first.
        Returns a short note string for the verdict reason.
        """
        try:
            proc.stdin.write(json.dumps({"command": "swarm_status"}) + "\n")
            proc.stdin.flush()
        except BrokenPipeError:
            return "swarm_status: broken pipe"

        status = _readline_json(proc.stdout, timeout=4.0)
        if status is None:
            return "swarm_status: no response"

        groups = status.get("pendingGroups") or []
        if not groups:
            return "swarm_status: no pending groups in session"

        gid = groups[0].get("groupId") or groups[0].get("id")
        if not gid:
            return "swarm_status: group has no id"

        try:
            proc.stdin.write(json.dumps({"command": "swarm_deny", "groupId": gid}) + "\n")
            proc.stdin.flush()
        except BrokenPipeError:
            return f"swarm_deny({gid}): broken pipe"

        ack = _readline_json(proc.stdout, timeout=4.0)
        if ack:
            return f"swarm_deny({gid}): ack={ack.get('type', '?')} — approval gate exercised"
        return f"swarm_deny({gid}): sent (no ack)"


def _readline_json(stdout, timeout: float = 4.0) -> Optional[dict]:
    result: list = [None]
    done = threading.Event()

    def _reader():
        for raw_line in stdout:
            line = raw_line.strip()
            if not line:
                continue
            try:
                result[0] = json.loads(line)
                done.set()
                return
            except json.JSONDecodeError:
                pass

    t = threading.Thread(target=_reader, daemon=True)
    t.start()
    done.wait(timeout=timeout)
    return result[0]
