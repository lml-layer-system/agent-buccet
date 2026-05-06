"""
Shared data types for live Buccet door adapters.

All adapters return AdapterResult. No policy logic lives here — only shapes.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class LiveVerdict:
    decision: str           # allow | deny | require_approval | skipped | error
    reason: str
    law_ids: list
    action_kind: str
    door: str               # runtime | mcp | cli | skipped
    raw_response: dict = field(default_factory=dict)


@dataclass
class AdapterResult:
    verdict: LiveVerdict
    tool_result: Optional[dict] = None   # None unless decision == "allow"
    skipped: bool = False
    skip_reason: str = ""
