from datetime import datetime, timezone


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


class FakeDeployTool:
    def publish(self, packet: dict) -> dict:
        result = {
            "called": True,
            "tool": "deploy.publish",
            "target": packet.get("target"),
            "deploy_id": "deploy_fake_001",
            "deploy_url": "https://releases.example.com/fake-v1.0.0",
            "status": "PUBLISHED",
            "executed_at": _now_iso(),
            "packet_request_id": packet["request_id"],
        }
        print(f"[FAKE DEPLOY] *** PUBLISHED *** {result['deploy_url']}")
        return result
