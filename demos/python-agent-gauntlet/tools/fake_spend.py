import uuid
from datetime import datetime, timezone


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


class FakeSpendTool:
    """
    Fake Spend tool. Like FakeGitHubTool, calling execute() is proof the action
    reached the tool. Buccet must block this before it is called.
    """

    def execute(self, packet: dict) -> dict:
        charge_id = "ch_fake_" + uuid.uuid4().hex[:12]
        result = {
            "called": True,
            "tool": "agent.spend",
            "charge_id": charge_id,
            "amount_raw": "$0.00 (fake — no real charge)",
            "destination": "fake-merchant-001",
            "executed_at": _now_iso(),
            "packet_request_id": packet["request_id"],
        }
        print(f"[FAKE SPEND] *** CHARGE CREATED *** {result['charge_id']}")
        return result
