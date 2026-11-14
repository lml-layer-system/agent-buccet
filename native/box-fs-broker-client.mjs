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
let content = "";
socket.setTimeout(16000, () => socket.destroy(new Error("broker request timeout")));
socket.on("connect", () => socket.write(JSON.stringify(request) + "\n"));
socket.on("data", chunk => {
  content += chunk.toString("utf8");
  if (Buffer.byteLength(content) > 8 * 1024 * 1024 + 1024) {
    socket.destroy(new Error("broker response too large"));
  }
});
socket.on("end", () => {
  try {
    const line = content.split("\n", 1)[0];
    const result = JSON.parse(line);
    if (!result.ok) throw new Error(result.error);
    process.stdout.write(result.output ?? "");
  } catch (error) {
    console.error("BUCCET_BROKER_CLIENT_DENIED:", error.message);
    process.exitCode = 73;
  }
});
socket.on("error", error => {
  console.error("BUCCET_BROKER_CLIENT_DENIED:", error.message);
  process.exitCode = 73;
});
