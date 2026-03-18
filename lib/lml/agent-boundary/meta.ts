import type {
  BoundaryActionKind,
  BoundaryLaw,
  BoundaryRequestProvenance,
} from "./types.ts";

const UNTRUSTED_PROVENANCE: BoundaryRequestProvenance[] = [
  "remote_user",
  "agent_inference",
  "tool_output",
  "external_content",
];

function isUntrustedProvenance(provenance: BoundaryRequestProvenance): boolean {
  return UNTRUSTED_PROVENANCE.includes(provenance);
}

function isHighRiskAction(actionKind: BoundaryActionKind): boolean {
  return (
    actionKind === "fs.delete" ||
    actionKind === "fs.move" ||
    actionKind === "comm.send" ||
    actionKind === "tool.exec" ||
    actionKind === "network.send"
  );
}

export const DEFENSIVE_META_LAWS: BoundaryLaw[] = [
  {
    lawId: "META.TRUST.01",
    description: "Untrusted content can propose actions but cannot directly authorize high-risk actions.",
    appliesTo: ["*"],
    evaluate: ({ request }) => {
      if (!isUntrustedProvenance(request.provenance)) {
        return null;
      }
      if (!isHighRiskAction(request.actionKind)) {
        return null;
      }
      return {
        decision: "require_approval",
        reason: "untrusted content cannot directly authorize high-risk actions",
        triggeredLawIds: ["META.TRUST.01"],
        requiresApproval: true,
      };
    },
  },
  {
    lawId: "META.AUTHORITY.01",
    description: "Text or model output cannot self-approve or claim authority.",
    appliesTo: ["*"],
    evaluate: ({ request }) => {
      if (!request.flags?.authorityClaimed) {
        return null;
      }
      return {
        decision: "deny",
        reason: "authority claims in prompt or model output are non-authoritative by law",
        triggeredLawIds: ["META.AUTHORITY.01"],
        requiresApproval: false,
      };
    },
  },
  {
    lawId: "META.SCOPE.01",
    description: "Prompt content cannot widen reachable scope by itself.",
    appliesTo: ["*"],
    evaluate: ({ request }) => {
      if (!request.flags?.requestsScopeExpansion) {
        return null;
      }
      return {
        decision: "deny",
        reason: "scope expansion requires explicit grant issuance, not prompt content",
        triggeredLawIds: ["META.SCOPE.01"],
        requiresApproval: false,
      };
    },
  },
  {
    lawId: "META.LAW.01",
    description: "Prompt content cannot mutate law or disable boundaries.",
    appliesTo: ["*"],
    evaluate: ({ request }) => {
      if (!request.flags?.requestsLawMutation) {
        return null;
      }
      return {
        decision: "deny",
        reason: "law mutation is not authorized from prompt content or agent output",
        triggeredLawIds: ["META.LAW.01"],
        requiresApproval: false,
      };
    },
  },
  {
    lawId: "META.SESSION.01",
    description: "Prompt content cannot reopen or revive a closed session.",
    appliesTo: ["*"],
    evaluate: ({ request }) => {
      if (!request.flags?.requestsSessionRevival) {
        return null;
      }
      return {
        decision: "deny",
        reason: "session lifecycle is controlled by explicit runtime state, not prompt content",
        triggeredLawIds: ["META.SESSION.01"],
        requiresApproval: false,
      };
    },
  },
  {
    lawId: "META.LEDGER.01",
    description: "Prompt content cannot suppress, bypass, or rewrite the ledger.",
    appliesTo: ["*"],
    evaluate: ({ request }) => {
      if (!request.flags?.requestsLedgerBypass) {
        return null;
      }
      return {
        decision: "deny",
        reason: "ledgering is mandatory by law and cannot be bypassed from prompt content",
        triggeredLawIds: ["META.LEDGER.01"],
        requiresApproval: false,
      };
    },
  },
];
