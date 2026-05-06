"""
Agent Buccet — Swarm Demo Worker

A minimal Python worker that writes to a shared file.
This script has ZERO Buccet-specific code.

Three of these run concurrently. When wrapped with `buccet hook run`,
all three shell executions hit the same intercept server. They share
the same target path → same swarm key → one approval prompt appears
in buccet console (not three separate prompts).

Usage:
  buccet hook run -- python worker.py worker-1 0.0
  buccet hook run -- python worker.py worker-2 0.1
  buccet hook run -- python worker.py worker-3 0.2
"""
import os
import subprocess
import sys
import time

worker_id = sys.argv[1] if len(sys.argv) > 1 else "worker"
delay = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
target = "workspace/reports/shared.txt"

buccet_active = bool(os.environ.get("BUCCET_SOCKET_PATH") or os.environ.get("DYLD_INSERT_LIBRARIES"))

if buccet_active:
    print(f"  [{worker_id}] 🛡  Running under Buccet — write will be intercepted")
else:
    print(f"  [{worker_id}] ⚡  Running unprotected")

print(f"  [{worker_id}] Requesting write to {target}...")

# Stagger arrival slightly so all 3 hit the server within the same decision window
if delay > 0:
    time.sleep(delay)

result = subprocess.run(
    f"echo '[{worker_id}] accessed at $(date)' >> {target}",
    shell=True,
    capture_output=True,
    text=True,
)

if result.returncode == 0:
    print(f"  [{worker_id}] ✅ Write succeeded")
else:
    err = result.stderr.strip() or "permission denied or action blocked"
    print(f"  [{worker_id}] ❌ Blocked: {err}")
