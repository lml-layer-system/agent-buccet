/**
 * Experimental OS-trusted filesystem broker client.
 * Must run as the designated trusted controller principal, never as an agent.
 * This script is not wired to production MCP, which remains unisolated.
 */
import net from "node:net";
import { argv } from "node:process";
const [socketPath, operation, filePath, toOrContent, contentArg] = argv.slice(2);
if (typeof socketPath !== "string" || !socketPath.startsWith("/") ||
    !["read", "write", "append", "move", "mkdir", "delete"].includes(operation)) {
  throw new Error("BUCCET_BROKER_CLIENT_DENIED: invalid args");
}
const request = { op: operation, path: filePath };
if (operation === "move") request.to = toOrContent;
if (operation === "write" || operation === "append") request.content = toOrContent ?? "";
const socket = net.connect(socketPath);
let content = "", transmitted = false, finished = false;
function failure(error, confirmedDenial = false) {
  if (finished) return;
  finished = true;
  const uncertain = operation !== "read" && transmitted && !confirmedDenial;
  console.error(uncertain
    ? "BUCCET_BROKER_CLIENT_COMMIT_UNCERTAIN: inspect protected state before retry"
    : "BUCCET_BROKER_CLIENT_DENIED: " + (error?.message ?? String(error)));
  process.exitCode = uncertain ? 74 : 73;
}
socket.setTimeout(16000, () => socket.destroy(new Error("broker request timeout")));
socket.on("connect", () => {
  transmitted = true;
  socket.write(JSON.stringify(request) + "\n");
});
socket.on("data", chunk => {
  content += chunk.toString("utf8");
  if (Buffer.byteLength(content) > 8 * 1024 * 1024 + 1024) {
    socket.destroy(new Error("broker response too large"));
  }
});
socket.on("end", () => {
  if (finished) return;
  try {
    const line = content.split("\n", 1)[0];
    const result = JSON.parse(line);
    if (!result || result.ok !== true || typeof result.output !== "string") {
      const confirmedDenial = result?.ok === false && result.uncertain === false;
      failure(new Error(result?.error ?? "broker receipt unavailable"), confirmedDenial);
      return;
    }
    finished = true;
    process.stdout.write(result.output);
  } catch (error) {
    failure(error); // invalid or truncated receipt is not a confirmed denial
  }
});
socket.on("error", error => failure(error));
socket.on("close", () => {
  if (!finished) failure(new Error("broker closed without a verified receipt"));
});
