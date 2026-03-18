import type { GravityProposal, ScopePayload } from "../gravity-core/index.ts";
import type { BoundaryActionRequest, BoundaryRequestProvenance } from "../types.ts";

function mapKind(actionKind: BoundaryActionRequest["actionKind"]): GravityProposal["kind"] {
  if (actionKind.startsWith("fs.")) return "filesystem";
  if (actionKind === "comm.send") return "recipient_send";
  if (actionKind === "network.send") return "network_send";
  if (actionKind === "tool.exec") return "tool_exec";
  if (actionKind.startsWith("db.")) return "database";
  if (actionKind.startsWith("sys.")) return "system";
  return "other";
}

function mapScopeKind(actionKind: BoundaryActionRequest["actionKind"]): ScopePayload["scopeKind"] {
  if (actionKind.startsWith("fs.")) return "path";
  if (actionKind === "comm.send") return "recipient";
  if (actionKind === "network.send") return "domain";
  if (actionKind === "tool.exec") return "tool";
  if (actionKind.startsWith("db.")) return "database";
  if (actionKind.startsWith("sys.")) return "system";
  return "other";
}

function actionLabel(actionKind: BoundaryActionRequest["actionKind"]): string {
  switch (actionKind) {
    case "fs.read": return "read";
    case "fs.write": return "write";
    case "fs.append": return "append to";
    case "fs.delete": return "delete";
    case "fs.mkdir": return "create";
    case "fs.move": return "move";
    case "comm.send": return "send to";
    case "network.send": return "call";
    case "tool.exec": return "run";
    case "db.query": return "query";
    case "db.insert": return "insert into";
    case "db.update": return "update";
    case "db.delete": return "delete from";
    case "sys.env.read": return "read env";
    case "sys.env.write": return "write env";
    case "sys.config.read": return "read config";
    case "sys.config.write": return "write config";
    case "sys.credential.read": return "read credential";
    case "sys.credential.use": return "use credential";
  }
}

function mapProvenance(source: BoundaryRequestProvenance): GravityProposal["provenance"]["source"] {
  return source;
}

export function mapBoundaryRequestToGravityProposal(request: BoundaryActionRequest): GravityProposal {
  const payload: ScopePayload & { requestId: string; payloadSummary?: string } = {
    scopeIdentifier: request.target,
    scopeKind: mapScopeKind(request.actionKind),
    actionLabel: actionLabel(request.actionKind),
    requestId: request.requestId,
    payloadSummary: request.payloadSummary,
  };

  return {
    kind: mapKind(request.actionKind),
    payload,
    provenance: {
      source: mapProvenance(request.provenance),
      sessionId: request.sessionId,
      originId: request.requestId,
      authorityClaimed: request.flags?.authorityClaimed,
      requestsScopeExpansion: request.flags?.requestsScopeExpansion,
      requestsLawMutation: request.flags?.requestsLawMutation,
      requestsSessionRevival: request.flags?.requestsSessionRevival,
      requestsLedgerBypass: request.flags?.requestsLedgerBypass,
    },
  };
}
