from datetime import datetime, timezone


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


class FakeFsTool:
    def delete(self, packet: dict) -> dict:
        result = {
            "called": True,
            "tool": "fs.delete",
            "target": packet.get("target"),
            "status": "DELETED",
            "executed_at": _now_iso(),
            "packet_request_id": packet["request_id"],
        }
        print(f"[FAKE FS] *** FILE DELETED *** {result['target']}")
        return result

    def write(self, packet: dict, content: str = "(fake content)") -> dict:
        result = {
            "called": True,
            "tool": "fs.write",
            "target": packet.get("target"),
            "bytes_written": len(content),
            "status": "WRITTEN",
            "executed_at": _now_iso(),
            "packet_request_id": packet["request_id"],
        }
        print(f"[FAKE FS] *** FILE WRITTEN *** {result['target']} ({result['bytes_written']} bytes)")
        return result
