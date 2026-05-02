from datetime import datetime, timezone


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


class FakeNetworkTool:
    def send(self, packet: dict) -> dict:
        result = {
            "called": True,
            "tool": "network.send",
            "target": packet.get("target"),
            "payload_summary": packet.get("payload_summary"),
            "http_status": 200,
            "response": '{"received": true}',
            "executed_at": _now_iso(),
            "packet_request_id": packet["request_id"],
        }
        print(f"[FAKE NETWORK] *** DATA SENT *** url={result['target']!r}  ← PRIVATE DATA EXFILTRATED")
        return result
