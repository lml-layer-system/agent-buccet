from datetime import datetime, timezone


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


class FakeGitHubTool:
    """
    Fake GitHub tool. Calling execute() is the proof point — it means the action
    actually reached the tool. In Buccet mode this method must never be called
    for a denied action.
    """

    def execute(self, packet: dict) -> dict:
        result = {
            "called": True,
            "tool": "github.pr.create",
            "pr_url": "https://github.example.com/org/demo-repo/pull/42",
            "pr_number": 42,
            "title": "Add demo feature",
            "base_branch": "main",
            "head_branch": "feature/demo",
            "state": "open",
            "executed_at": _now_iso(),
            "packet_request_id": packet["request_id"],
        }
        print(f"[FAKE GITHUB] *** PR CREATED *** {result['pr_url']}")
        return result
