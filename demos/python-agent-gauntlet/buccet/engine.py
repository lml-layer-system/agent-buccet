"""
Buccet law evaluation engine.

evaluate_buccet(packet, upl_rules, context) -> verdict dict

Supports 10 decision types needed across the 14 proof cases:
  deny                - standard UPL denial
  quarantine          - hostile/untrusted source
  ask_for_clarification - missing required packet fields
  require_approval    - action needs explicit human sign-off
  allow               - UPL explicitly permits (overrides overbroad safety)
  block_output        - output format violates corridor
  deny_completion     - completion claim lacks verified tool witness
  deny_constraint     - numeric/structural constraint violated
  deny_stale          - action invoked a revoked/superseded rule
  deny_scope          - action is outside the declared task scope
"""

import uuid
from datetime import datetime, timezone


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _active(rule: dict) -> bool:
    return rule.get("status") == "ACTIVE"


def _target_matches(rule_target: str, packet_target: str) -> bool:
    if rule_target == "*":
        return True
    if rule_target.endswith("/*"):
        prefix = rule_target[:-2]
        return packet_target == prefix or packet_target.startswith(prefix + "/")
    return rule_target == packet_target


def _kind_matches(rule: dict, packet: dict) -> bool:
    rk = rule.get("action_kind", "*")
    if rk == "*":
        return True
    return rk == packet.get("action_kind")


def _make_verdict(decision: str, reason: str, law_ids: list, denial_class: str | None = None, **extra) -> dict:
    v = {
        "verdict_id": str(uuid.uuid4()),
        "decision": decision,
        "reason": reason,
        "triggered_law_ids": law_ids,
        "requires_approval": decision == "require_approval",
        "denial_class": denial_class,
        "tool_reached": False,
    }
    v.update(extra)
    return v


def evaluate_buccet(packet: dict, upl_rules: dict, context: dict | None = None) -> dict:
    """
    Evaluate packet against upl_rules.

    context may carry:
      stale_rule_id         str   – id of the rule the agent is trying to use
      missing_fields        list  – required fields absent from packet
      output_content        str   – proposed chat.emit body (for corridor check)
      claims_completion     bool  – agent is claiming a task is done
      tool_witness_verified bool  – a real tool execution result exists
      files_changed         int   – for constraint checks
      target_branch         str   – for branch protection checks
      spend_amount          float – for spend cap checks
      self_refused          bool  – agent tried to refuse an APPROVED action
    """
    ctx = context or {}
    tracks = upl_rules.get("tracks", [])

    # ── 1. Quarantine: hostile / untrusted provenance ────────────────────
    hostile_provenances = {"tool_output", "external_content"}
    if packet.get("provenance") in hostile_provenances:
        for rule in tracks:
            if not _active(rule):
                continue
            if rule.get("type") != "QUARANTINE":
                continue
            if _kind_matches(rule, packet):
                return _make_verdict(
                    "quarantine",
                    f"Source quarantined by rule {rule['id']}: {rule['reason']}",
                    [rule["id"]],
                    denial_class=rule.get("denial_class", "authority_spoofing"),
                    quarantine_reason="untrusted_provenance",
                    source_provenance=packet.get("provenance"),
                )

    # ── 2. Stale rule invocation ─────────────────────────────────────────
    stale_rule_id = ctx.get("stale_rule_id")
    if stale_rule_id:
        for rule in tracks:
            if rule.get("id") != stale_rule_id:
                continue
            if rule.get("status") in ("MUTED", "DELETED", "REVOKED"):
                return _make_verdict(
                    "deny_stale",
                    f"Rule {stale_rule_id} is {rule['status']} and cannot authorize this action. "
                    f"A current rule must be consulted.",
                    [stale_rule_id],
                    denial_class="stale_instruction",
                    superseded_by=rule.get("superseded_by"),
                )

    # ── 3. Clarification required: missing fields ────────────────────────
    missing = ctx.get("missing_fields", [])
    if missing:
        for rule in tracks:
            if not _active(rule):
                continue
            if rule.get("type") != "CLARIFICATION_REQUIRED":
                continue
            if _kind_matches(rule, packet):
                return _make_verdict(
                    "ask_for_clarification",
                    f"Rule {rule['id']} requires clarification before proceeding. "
                    f"Missing: {', '.join(missing)}",
                    [rule["id"]],
                    denial_class="incomplete_packet",
                    missing_fields=missing,
                )

    # ── 4. Constraint violations ─────────────────────────────────────────
    for rule in tracks:
        if not _active(rule):
            continue
        if rule.get("type") != "CONSTRAINT":
            continue
        constraint_kind = rule.get("constraint_kind")
        violated = False
        violation_detail = ""

        if constraint_kind == "max_files_changed":
            limit = rule.get("limit", 0)
            actual = ctx.get("files_changed", 0)
            if actual > limit:
                violated = True
                violation_detail = f"files_changed={actual} exceeds limit={limit}"

        elif constraint_kind == "branch_protection":
            forbidden = set(rule.get("forbidden_branches", []))
            branch = ctx.get("target_branch", "")
            if branch in forbidden:
                violated = True
                violation_detail = f"target_branch={branch!r} is protected"

        elif constraint_kind == "spend_cap":
            cap = rule.get("cap_normalized", 0)
            amount = ctx.get("spend_amount", 0)
            if amount > cap:
                violated = True
                violation_detail = f"spend_amount={amount} exceeds cap={cap}"

        if violated:
            return _make_verdict(
                "deny_constraint",
                f"Constraint {rule['id']} violated: {violation_detail}. {rule['reason']}",
                [rule["id"]],
                denial_class=rule.get("denial_class", "constraint_violation"),
                violation_detail=violation_detail,
            )

    # ── 5. Output corridor: format violation ─────────────────────────────
    if packet.get("action_kind") == "chat.emit":
        output_content = ctx.get("output_content", "")
        for rule in tracks:
            if not _active(rule):
                continue
            if rule.get("type") != "OUTPUT_CORRIDOR":
                continue
            if not output_content.strip():
                continue
            violations = []
            if rule.get("no_emoji") and _contains_emoji(output_content):
                violations.append("contains emoji (forbidden)")
            if rule.get("format") == "markdown_bullets" and not _is_bullets_only(output_content):
                violations.append("output must be markdown bullet list only")
            if rule.get("max_words") and len(output_content.split()) > rule["max_words"]:
                violations.append(f"exceeds max_words={rule['max_words']}")
            if violations:
                return _make_verdict(
                    "block_output",
                    f"Output corridor rule {rule['id']} violated: {'; '.join(violations)}. Rewrite required.",
                    [rule["id"]],
                    denial_class="output_corridor_violation",
                    output_violations=violations,
                )

    # ── 6. Completion witness required ───────────────────────────────────
    if ctx.get("claims_completion"):
        for rule in tracks:
            if not _active(rule):
                continue
            if rule.get("type") != "COMPLETION_WITNESS":
                continue
            if not ctx.get("tool_witness_verified"):
                return _make_verdict(
                    "deny_completion",
                    f"Rule {rule['id']}: completion claim requires a verified tool execution witness. "
                    f"No witness found — claim denied.",
                    [rule["id"]],
                    denial_class="hallucinated_completion",
                    witness_missing=True,
                )

    # ── 7. Task scope: off-task / objective-drift denial ─────────────────
    for rule in tracks:
        if not _active(rule):
            continue
        if rule.get("type") not in ("TASK_SCOPE", "OBJECTIVE_SCOPE"):
            continue
        if not _kind_matches(rule, packet):
            continue
        allowed_prefix = rule.get("allowed_target_prefix")
        if allowed_prefix and not packet.get("target", "").startswith(allowed_prefix):
            return _make_verdict(
                "deny_scope",
                f"Rule {rule['id']}: action target {packet['target']!r} is outside the declared task scope "
                f"(allowed prefix: {allowed_prefix!r}). {rule['reason']}",
                [rule["id"]],
                denial_class=rule.get("denial_class", "off_task"),
            )
        required_task = rule.get("required_task_tag")
        if required_task:
            task_tag = ctx.get("task_tag")
            if task_tag is not None and task_tag != required_task:
                return _make_verdict(
                    "deny_scope",
                    f"Rule {rule['id']}: current task tag {task_tag!r} does not match "
                    f"required tag {required_task!r}. {rule['reason']}",
                    [rule["id"]],
                    denial_class=rule.get("denial_class", "objective_drift"),
                )

    # ── 8. Standard DENIED rules ─────────────────────────────────────────
    for rule in tracks:
        if not _active(rule):
            continue
        if rule.get("type") != "DENIED":
            continue
        if not _kind_matches(rule, packet):
            continue
        if not _target_matches(rule.get("target", "*"), packet.get("target", "")):
            continue
        return _make_verdict(
            "deny",
            f"Denied by UPL rule {rule['id']}: {rule['reason']}",
            [rule["id"]],
            denial_class=rule.get("denial_class"),
        )

    # ── 9. REQUIRES_APPROVAL rules ───────────────────────────────────────
    for rule in tracks:
        if not _active(rule):
            continue
        if rule.get("type") != "REQUIRES_APPROVAL":
            continue
        if not _kind_matches(rule, packet):
            continue
        if not _target_matches(rule.get("target", "*"), packet.get("target", "")):
            continue
        return _make_verdict(
            "require_approval",
            f"Rule {rule['id']} requires explicit human approval before execution: {rule['reason']}",
            [rule["id"]],
            denial_class=rule.get("denial_class"),
            tool_reached=False,
        )

    # ── 10. APPROVED override (case 6: unnecessary refusal) ──────────────
    for rule in tracks:
        if not _active(rule):
            continue
        if rule.get("type") != "APPROVED":
            continue
        if not _kind_matches(rule, packet):
            continue
        if not _target_matches(rule.get("target", "*"), packet.get("target", "")):
            continue
        result = _make_verdict(
            "allow",
            f"Action explicitly approved by UPL rule {rule['id']}: {rule['reason']}",
            [rule["id"]],
            tool_reached=True,
        )
        if ctx.get("self_refused"):
            result["policy_override"] = "overbroad_safety_refusal_invalid"
            result["override_detail"] = (
                "Agent attempted to self-refuse an action that is explicitly permitted "
                "by active UPL. Refusal is not valid here."
            )
        return result

    # ── Default: allow (no matching rule) ────────────────────────────────
    return _make_verdict(
        "allow",
        "No active rules matched this action.",
        [],
        tool_reached=True,
    )


# ── Output corridor helpers ──────────────────────────────────────────────────

_EMOJI_RANGES = [
    (0x1F600, 0x1F64F), (0x1F300, 0x1F5FF), (0x1F680, 0x1F6FF),
    (0x1F1E0, 0x1F1FF), (0x2600, 0x26FF),   (0x2700, 0x27BF),
    (0xFE00, 0xFE0F),   (0x1F900, 0x1F9FF), (0x1FA00, 0x1FA6F),
]


def _contains_emoji(text: str) -> bool:
    for ch in text:
        cp = ord(ch)
        if any(lo <= cp <= hi for lo, hi in _EMOJI_RANGES):
            return True
    return False


def _is_bullets_only(text: str) -> bool:
    lines = [l for l in text.strip().splitlines() if l.strip()]
    if not lines:
        return False
    return all(l.lstrip().startswith("- ") or l.lstrip().startswith("* ") for l in lines)
