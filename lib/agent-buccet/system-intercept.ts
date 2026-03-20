import net from "node:net";
import { once } from "node:events";
import type {
  BoundaryInterceptDaemonInput,
  BoundaryInterceptDaemonOutput,
  BoundaryInterceptRequest,
} from "./intercept.ts";

export type BoundarySystemInterceptEventKind =
  | "file.read"
  | "file.write"
  | "file.append"
  | "file.delete"
  | "file.mkdir"
  | "file.move"
  | "process.exec"
  | "network.connect"
  | "recipient.send"
  | "database.query"
  | "database.insert"
  | "database.update"
  | "database.delete"
  | "system.env.read"
  | "system.env.write"
  | "system.config.read"
  | "system.config.write"
  | "system.credential.read"
  | "system.credential.use";

export type BoundarySystemInterceptEvent = {
  requestId?: string;
  kind: BoundarySystemInterceptEventKind;
  target: string;
  payloadSummary?: string;
  pid?: number;
  executablePath?: string;
  cwd?: string;
  provenance?: BoundaryInterceptRequest["provenance"];
  flags?: BoundaryInterceptRequest["flags"];
};

export type BoundaryInterceptServerTarget =
  | { socketPath: string }
  | { host: string; port: number };

function fileOperationForKind(kind: BoundarySystemInterceptEventKind): string {
  switch (kind) {
    case "file.read":
      return "read";
    case "file.write":
      return "write";
    case "file.append":
      return "append";
    case "file.delete":
      return "delete";
    case "file.mkdir":
      return "mkdir";
    case "file.move":
      return "move";
    default:
      throw new Error(`not a file event kind: ${kind}`);
  }
}

function databaseOperationForKind(kind: BoundarySystemInterceptEventKind): string {
  switch (kind) {
    case "database.query":
      return "query";
    case "database.insert":
      return "insert";
    case "database.update":
      return "update";
    case "database.delete":
      return "delete";
    default:
      throw new Error(`not a database event kind: ${kind}`);
  }
}

function systemOperationForKind(kind: BoundarySystemInterceptEventKind): string {
  switch (kind) {
    case "system.env.read":
      return "env.read";
    case "system.env.write":
      return "env.write";
    case "system.config.read":
      return "config.read";
    case "system.config.write":
      return "config.write";
    case "system.credential.read":
      return "credential.read";
    case "system.credential.use":
      return "credential.use";
    default:
      throw new Error(`not a system event kind: ${kind}`);
  }
}

export function mapSystemInterceptEventToRequest(
  event: BoundarySystemInterceptEvent,
): BoundaryInterceptRequest & { requestId?: string } {
  const payloadParts = [
    event.payloadSummary,
    event.pid ? `pid=${event.pid}` : "",
    event.executablePath ? `exe=${event.executablePath}` : "",
    event.cwd ? `cwd=${event.cwd}` : "",
  ].filter(Boolean);

  if (event.kind.startsWith("file.")) {
    return {
      requestId: event.requestId,
      actionClass: "file",
      operation: fileOperationForKind(event.kind),
      target: event.target,
      payloadSummary: payloadParts.join(" "),
      provenance: event.provenance,
      flags: event.flags,
    };
  }

  if (event.kind === "process.exec") {
    return {
      requestId: event.requestId,
      actionClass: "shell",
      operation: "exec",
      target: event.target,
      payloadSummary: payloadParts.join(" "),
      provenance: event.provenance,
      flags: event.flags,
    };
  }

  if (event.kind === "network.connect") {
    return {
      requestId: event.requestId,
      actionClass: "network",
      operation: "send",
      target: event.target,
      payloadSummary: payloadParts.join(" "),
      provenance: event.provenance,
      flags: event.flags,
    };
  }

  if (event.kind === "recipient.send") {
    return {
      requestId: event.requestId,
      actionClass: "communication",
      operation: "send",
      target: event.target,
      payloadSummary: payloadParts.join(" "),
      provenance: event.provenance,
      flags: event.flags,
    };
  }

  if (event.kind.startsWith("database.")) {
    return {
      requestId: event.requestId,
      actionClass: "database",
      operation: databaseOperationForKind(event.kind),
      target: event.target,
      payloadSummary: payloadParts.join(" "),
      provenance: event.provenance,
      flags: event.flags,
    };
  }

  return {
    requestId: event.requestId,
    actionClass: "system",
    operation: systemOperationForKind(event.kind),
    target: event.target,
    payloadSummary: payloadParts.join(" "),
    provenance: event.provenance,
    flags: event.flags,
  };
}

async function connectToInterceptServer(
  target: BoundaryInterceptServerTarget,
): Promise<net.Socket> {
  const socket = "socketPath" in target
    ? net.createConnection(target.socketPath)
    : net.createConnection({ host: target.host, port: target.port });
  await once(socket, "connect");
  return socket;
}

export async function sendBoundaryInterceptServerInput(args: {
  target: BoundaryInterceptServerTarget;
  input: BoundaryInterceptDaemonInput;
}): Promise<BoundaryInterceptDaemonOutput> {
  const socket = await connectToInterceptServer(args.target);
  socket.write(`${JSON.stringify(args.input)}\n`);

  let buffer = "";
  for await (const chunk of socket) {
    buffer += chunk.toString();
    const newlineIndex = buffer.indexOf("\n");
    if (newlineIndex === -1) {
      continue;
    }
    const line = buffer.slice(0, newlineIndex).trim();
    if (!line) {
      buffer = buffer.slice(newlineIndex + 1);
      continue;
    }
    socket.end();
    return JSON.parse(line) as BoundaryInterceptDaemonOutput;
  }

  throw new Error("intercept server closed before sending a response");
}

export async function evaluateSystemInterceptEvent(args: {
  target: BoundaryInterceptServerTarget;
  event: BoundarySystemInterceptEvent;
}): Promise<BoundaryInterceptDaemonOutput> {
  return sendBoundaryInterceptServerInput({
    target: args.target,
    input: mapSystemInterceptEventToRequest(args.event),
  });
}
