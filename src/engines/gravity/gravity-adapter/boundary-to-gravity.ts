import type { GravityProposal, ScopePayload } from "../gravity-core/index.ts";
import type { BoundaryActionRequest, BoundaryRequestProvenance } from "../types.ts";

function mapKind(actionKind: BoundaryActionRequest["actionKind"]): GravityProposal["kind"] {
  switch (actionKind) {
    case "fs.read":
    case "fs.write":
    case "fs.append":
    case "fs.delete":
    case "fs.mkdir":
    case "fs.move":
      return "filesystem";
    case "agent.spend": return "recipient_send";
    case "comm.send": return "recipient_send";
    case "network.send": return "network_send";
    case "tool.exec": return "tool_exec";
    case "db.query":
    case "db.insert":
    case "db.update":
    case "db.delete":
      return "database";
    case "sys.env.read":
    case "sys.env.write":
    case "sys.config.read":
    case "sys.config.write":
    case "sys.credential.read":
    case "sys.credential.use":
      return "system";
    case "chat.emit":
      // chat grants are filtered out in gravity-service; "other" is intentional
      return "other";
  }
}

function mapScopeKind(actionKind: BoundaryActionRequest["actionKind"]): ScopePayload["scopeKind"] {
  switch (actionKind) {
    case "fs.read":
    case "fs.write":
    case "fs.append":
    case "fs.delete":
    case "fs.mkdir":
    case "fs.move":
      return "path";
    case "agent.spend": return "recipient";
    case "comm.send": return "recipient";
    case "network.send": return "domain";
    case "tool.exec": return "tool";
    case "db.query":
    case "db.insert":
    case "db.update":
    case "db.delete":
      return "database";
    case "sys.env.read":
    case "sys.env.write":
    case "sys.config.read":
    case "sys.config.write":
    case "sys.credential.read":
    case "sys.credential.use":
      return "system";
    case "chat.emit": return "other";
  }
}

function actionLabel(actionKind: BoundaryActionRequest["actionKind"]): string {
  switch (actionKind) {
    case "fs.read": return "read";
    case "fs.write": return "write";
    case "fs.append": return "append to";
    case "fs.delete": return "delete";
    case "fs.mkdir": return "create";
    case "fs.move": return "move";
    case "agent.spend": return "pay";
    case "chat.emit": return "emit";
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
      claimsCompleteCoverage: request.flags?.claimsCompleteCoverage,
      requestsScopeExpansion: request.flags?.requestsScopeExpansion,
      requestsLawMutation: request.flags?.requestsLawMutation,
      requestsSessionRevival: request.flags?.requestsSessionRevival,
      requestsLedgerBypass: request.flags?.requestsLedgerBypass,
    },
  };
}
