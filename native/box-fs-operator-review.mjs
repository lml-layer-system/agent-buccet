/**
 * Independent privileged operator review for unprivileged Buccet FS requests.
 * Run from a trusted root-owned console. This is NOT an agent-facing command.
 *
 * It displays the root broker's exact committed operator queue, including
 * payload digest, and requires an interactive TTY confirmation of that digest.
 * A normal MCP agent can submit but cannot invoke this root-only capability.
 */
import net from "node:net";
import { createHash } from "node:crypto";
import path from "node:path";
import { lstatSync } from "node:fs";
import { createInterface } from "node:readline/promises";

function denied(message) { throw Error("BUCCET_OPERATOR_DENIED: " + message); }
function verifyControlSocket(socketPath) {
  if (process.platform !== "linux" || process.geteuid?.() !== 0 ||
      !path.isAbsolute(socketPath) || path.normalize(socketPath) !== socketPath ||
      path.basename(socketPath) !== "operator.sock") {
    denied("trusted Linux operator identity and root-owned socket required");
  }
  let current = "/";
  for (const segment of path.dirname(socketPath).slice(1).split("/")) {
    if (!segment || segment === "." || segment === "..") denied("invalid operator directory");
    current = path.join(current, segment);
    const st = lstatSync(current);
    if (!st.isDirectory() || st.isSymbolicLink() || st.uid !== 0 ||
        (st.mode & 0o022)) denied("operator directory is attacker-writable");
  }
  const socket = lstatSync(socketPath);
  if (!socket.isSocket() || socket.uid !== 0 || (socket.mode & 0o077)) {
    denied("operator socket is not exclusive to privileged owner");
  }
}
async function submit(socketPath, message) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(socketPath);
    let result = "", done = false;
    const timer = setTimeout(() => finish(Error("operator service timed out")), 5_000);
    function finish(error, value) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      client.destroy();
      if (error) reject(error); else resolve(value);
    }
    client.on("connect", () => client.write(JSON.stringify(message) + "\n"));
    client.on("data", chunk => {
      result += chunk.toString("utf8");
      if (Buffer.byteLength(result) > 8 * 1024 * 1024 + 8192) {
        finish(Error("operator response too large"));
      }
    });
    client.once("end", () => {
      try {
        const parsed = JSON.parse(result.split("\n",1)[0]);
        if (!parsed || parsed.ok !== true) denied("operator service refused request");
        finish(undefined, parsed);
      } catch (error) { finish(error); }
    });
    client.once("error", finish);
    client.once("close", () => {
      if (!done) finish(Error("operator service disconnected"));
    });
  });
}
async function main() {
  if (process.argv.length !== 3) denied("usage: node box-fs-operator-review.mjs ROOT_OPERATOR_SOCKET");
  const socketPath = process.argv[2];
  verifyControlSocket(socketPath);
  const listed = await submit(socketPath, { command: "list" });
  if (!Array.isArray(listed.pending) || listed.pending.length > 16) denied("invalid operator queue");
  if (!listed.pending.length) {
    console.log("No pending privileged filesystem operations.");
    return;
  }
  // A registered 256-bit launcher key authenticates proof possession.
  // It is not enough when hostile agents run under the same OS principal and
  // can inspect the registered host's memory or inherited file descriptors.
  console.log("CAUTION: Verify this host is OS-isolated from untrusted agents.");
  console.log("A copied session label without a registered HMAC proof is denied.");
  for (const item of listed.pending) {
    if (typeof item.requestId !== "string" || !/^[a-f0-9-]{36}$/.test(item.requestId) ||
        typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(item.sha256)) {
      denied("unverified operator queue item");
    }
    console.log("\nRequest: " + item.requestId);
    // JSON escaping prevents adversarial terminal content from being printed
    // raw (ANSI escape sequences, newlines, or bidirectional display controls).
    console.log("Exact action: " + JSON.stringify({
      operation: item.op, path: item.path, to: item.to,
      bytes: item.bytes, preview: item.preview,
    }));
    console.log("Root-registered host identity: " + JSON.stringify(item.host ?? null));
    console.log("SHA-256 of exact operation and payload: " + item.sha256);
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    denied("interactive operator TTY is mandatory for approving effects");
  }
  const io = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const selectedId = (await io.question("\nSelect the exact request ID (or ENTER to decline): ")).trim();
    const selected = listed.pending.find(item => item.requestId === selectedId);
    if (!selected) denied("no matching queued request selected");
    if (selected.host?.verified !== true ||
        typeof selected.host?.sessionId !== "string" ||
        typeof selected.host?.actorId !== "string") {
      denied("unregistered requester cannot receive privileged human approval");
    }
    const inspected = await submit(socketPath, {
      command: "inspect", requestId: selected.requestId,
    });
    const exact = inspected.proposal;
    if (!exact || inspected.sha256 !== selected.sha256 ||
        inspected.host?.verified !== true ||
        inspected.host.sessionId !== selected.host.sessionId ||
        inspected.host.actorId !== selected.host.actorId ||
        createHash("sha256").update(JSON.stringify(exact)).digest("hex") !== selected.sha256) {
      denied("operator inspected a changed or unverifiable request");
    }
    // Full payload is shown with JSON escaping rather than trusted text.
    // A preview-only approval cannot guarantee the operator reviewed bytes
    // after a truncated prefix.
    console.log("EXACT OPERATOR REVIEW - full action and full payload:");
    console.log(JSON.stringify(exact));
    const challenge = "APPROVE " + selected.sha256;
    console.log("To approve this exact action, enter: " + challenge);
    const reply = (await io.question("Type the full confirmation (anything else denies): ")).trim();
    const decision = reply === challenge ? "approve" : "deny";
    const result = await submit(socketPath, {
      command: decision, requestId: selected.requestId, sha256: selected.sha256,
    });
    console.log(decision === "approve" && result.approved
      ? "Privileged operator approval accepted. Execution remains subject to root path policy."
      : "Privileged operation denied.");
  } finally {
    io.close();
  }
}
main().catch(error => {
  console.error("BUCCET_OPERATOR_DENIED:", error?.message ?? "review failed");
  process.exitCode = 73;
});
