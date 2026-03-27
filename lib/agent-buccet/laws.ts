import {
  grantsForAction,
  isTargetReachable,
} from "./orchestrator.ts";
import { DEFENSIVE_TIME_LAWS } from "./time.ts";
import type {
  BoundaryActionKind,
  BoundaryActionRequest,
  BoundaryDecision,
  BoundaryGrant,
  BoundaryLaw,
  BoundaryLawResult,
  BoundarySession,
} from "./types.ts";

export function evaluateBoundaryLaws(args: {
  session: BoundarySession;
  request: BoundaryActionRequest;
  laws: BoundaryLaw[];
  grants: BoundaryGrant[];
  approvalRequiredFor: BoundaryActionKind[];
}): BoundaryLawResult {
  const actionGrants = grantsForAction(args.session, args.request.actionKind, args.grants);

  if (!isTargetReachable(args.request, actionGrants)) {
    return {
      decision: "deny",
      reason: "target is outside user-opened reachable scope",
      triggeredLawIds: ["BOUNDARY.DEFAULT_SCOPE.01"],
      requiresApproval: false,
    };
  }

  const triggeredLawIds: string[] = [];
  let decision: BoundaryDecision = "allow";
  let reason = "action admitted by boundary runtime";

  for (const law of args.laws) {
    const appliesToAll = law.appliesTo[0] === "*";
    const appliesToAction = appliesToAll
      ? true
      : (law.appliesTo as BoundaryActionKind[]).includes(args.request.actionKind);
    if (!appliesToAction) {
      continue;
    }
    const result = law.evaluate({
      session: args.session,
      request: args.request,
      activeGrants: actionGrants,
    });
    if (!result) {
      continue;
    }
    triggeredLawIds.push(...result.triggeredLawIds);
    if (result.decision === "deny") {
      return {
        decision: "deny",
        reason: result.reason,
        triggeredLawIds,
        requiresApproval: false,
      };
    }
    if (result.decision === "require_approval") {
      decision = "require_approval";
      reason = result.reason;
    }
  }

  if (decision === "allow" && args.approvalRequiredFor.includes(args.request.actionKind)) {
    return {
      decision: "require_approval",
      reason: "action class requires explicit approval",
      triggeredLawIds: [...triggeredLawIds, "BOUNDARY.APPROVAL.01"],
      requiresApproval: true,
    };
  }

  return {
    decision,
    reason,
    triggeredLawIds,
    requiresApproval: decision === "require_approval",
  };
}

export const DEFAULT_BOUNDARY_LAWS: BoundaryLaw[] = [
  ...DEFENSIVE_TIME_LAWS,
  {
    lawId: "BOUNDARY.COMM.01",
    description: "Recipient sends require explicit approval.",
    appliesTo: ["comm.send"],
    evaluate: () => ({
      decision: "require_approval",
      reason: "recipient sends require approval",
      triggeredLawIds: ["BOUNDARY.COMM.01"],
      requiresApproval: true,
    }),
  },
  {
    lawId: "BOUNDARY.DELETE.01",
    description: "Destructive delete actions require explicit approval.",
    appliesTo: ["fs.delete"],
    evaluate: () => ({
      decision: "require_approval",
      reason: "delete is destructive and requires approval",
      triggeredLawIds: ["BOUNDARY.DELETE.01"],
      requiresApproval: true,
    }),
  },
  {
    lawId: "BOUNDARY.FS.WRITE.01",
    description: "Filesystem mutation actions require explicit approval.",
    appliesTo: ["fs.write", "fs.append", "fs.mkdir", "fs.move"],
    evaluate: () => ({
      decision: "require_approval",
      reason: "filesystem mutation requires approval",
      triggeredLawIds: ["BOUNDARY.FS.WRITE.01"],
      requiresApproval: true,
    }),
  },
  {
    lawId: "BOUNDARY.EXEC.01",
    description: "Shell execution is denied by default.",
    appliesTo: ["tool.exec"],
    evaluate: () => ({
      decision: "deny",
      reason: "tool execution is denied by default",
      triggeredLawIds: ["BOUNDARY.EXEC.01"],
      requiresApproval: false,
    }),
  },
  {
    lawId: "BOUNDARY.NETWORK.01",
    description: "Network sends require explicit approval.",
    appliesTo: ["network.send"],
    evaluate: () => ({
      decision: "require_approval",
      reason: "network sends require approval",
      triggeredLawIds: ["BOUNDARY.NETWORK.01"],
      requiresApproval: true,
    }),
  },
  {
    lawId: "BOUNDARY.DB.READ.01",
    description: "Database queries require explicit approval.",
    appliesTo: ["db.query"],
    evaluate: () => ({
      decision: "require_approval",
      reason: "database queries require approval",
      triggeredLawIds: ["BOUNDARY.DB.READ.01"],
      requiresApproval: true,
    }),
  },
  {
    lawId: "BOUNDARY.DB.WRITE.01",
    description: "Database mutations require explicit approval.",
    appliesTo: ["db.insert", "db.update", "db.delete"],
    evaluate: () => ({
      decision: "require_approval",
      reason: "database mutations require approval",
      triggeredLawIds: ["BOUNDARY.DB.WRITE.01"],
      requiresApproval: true,
    }),
  },
  {
    lawId: "BOUNDARY.SYS.ENV.READ.01",
    description: "Environment reads require explicit approval.",
    appliesTo: ["sys.env.read"],
    evaluate: () => ({
      decision: "require_approval",
      reason: "environment reads require approval",
      triggeredLawIds: ["BOUNDARY.SYS.ENV.READ.01"],
      requiresApproval: true,
    }),
  },
  {
    lawId: "BOUNDARY.SYS.ENV.WRITE.01",
    description: "Environment writes are denied by default.",
    appliesTo: ["sys.env.write"],
    evaluate: () => ({
      decision: "deny",
      reason: "environment writes are denied by default",
      triggeredLawIds: ["BOUNDARY.SYS.ENV.WRITE.01"],
      requiresApproval: false,
    }),
  },
  {
    lawId: "BOUNDARY.SYS.CONFIG.READ.01",
    description: "System config reads require explicit approval.",
    appliesTo: ["sys.config.read"],
    evaluate: () => ({
      decision: "require_approval",
      reason: "system config reads require approval",
      triggeredLawIds: ["BOUNDARY.SYS.CONFIG.READ.01"],
      requiresApproval: true,
    }),
  },
  {
    lawId: "BOUNDARY.SYS.CONFIG.WRITE.01",
    description: "System config writes are denied by default.",
    appliesTo: ["sys.config.write"],
    evaluate: () => ({
      decision: "deny",
      reason: "system config writes are denied by default",
      triggeredLawIds: ["BOUNDARY.SYS.CONFIG.WRITE.01"],
      requiresApproval: false,
    }),
  },
  {
    lawId: "BOUNDARY.SYS.CREDENTIAL.READ.01",
    description: "Credential reads are denied by default.",
    appliesTo: ["sys.credential.read"],
    evaluate: () => ({
      decision: "deny",
      reason: "credential reads are denied by default",
      triggeredLawIds: ["BOUNDARY.SYS.CREDENTIAL.READ.01"],
      requiresApproval: false,
    }),
  },
  {
    lawId: "BOUNDARY.SYS.CREDENTIAL.USE.01",
    description: "Credential use requires explicit approval.",
    appliesTo: ["sys.credential.use"],
    evaluate: () => ({
      decision: "require_approval",
      reason: "credential use requires approval",
      triggeredLawIds: ["BOUNDARY.SYS.CREDENTIAL.USE.01"],
      requiresApproval: true,
    }),
  },
  {
    lawId: "BOUNDARY.EGRESS.PII.01",
    description: "Outbound payloads containing PII are denied by default.",
    appliesTo: ["network.send", "comm.send"],
    evaluate: ({ request }) => {
      if (!request.flags?.payloadContainsPii) {
        return null;
      }
      return {
        decision: "deny",
        reason: "payload contains personally identifiable information (PII)",
        triggeredLawIds: ["BOUNDARY.EGRESS.PII.01"],
        requiresApproval: false,
      };
    },
  },
  {
    lawId: "BOUNDARY.EGRESS.CREDENTIAL.01",
    description: "Outbound payloads containing credentials are denied by default.",
    appliesTo: ["network.send", "comm.send"],
    evaluate: ({ request }) => {
      if (!request.flags?.payloadContainsCredential) {
        return null;
      }
      return {
        decision: "deny",
        reason: "payload contains credentials or secrets",
        triggeredLawIds: ["BOUNDARY.EGRESS.CREDENTIAL.01"],
        requiresApproval: false,
      };
    },
  },
  {
    lawId: "BOUNDARY.EGRESS.FINANCIAL.01",
    description: "Outbound payloads containing financial data are denied by default.",
    appliesTo: ["network.send", "comm.send"],
    evaluate: ({ request }) => {
      if (!request.flags?.payloadContainsFinancialData) {
        return null;
      }
      return {
        decision: "deny",
        reason: "payload contains financial data (card number or similar)",
        triggeredLawIds: ["BOUNDARY.EGRESS.FINANCIAL.01"],
        requiresApproval: false,
      };
    },
  },
];
