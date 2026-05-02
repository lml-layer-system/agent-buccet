from datetime import datetime, timezone


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


class FakeCommTool:
    def send(self, packet: dict) -> dict:
        result = {
            "called": True,
            "tool": "comm.send",
            "target": packet.get("target"),
            "payload_summary": packet.get("payload_summary"),
            "message_id": "msg_fake_001",
            "status": "SENT",
            "executed_at": _now_iso(),
            "packet_request_id": packet["request_id"],
        }
        print(f"[FAKE COMM] *** MESSAGE SENT *** target={result['target']!r}")
        return result
