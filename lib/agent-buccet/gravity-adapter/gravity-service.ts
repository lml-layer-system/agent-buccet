import {
  getDefaultLawSkills,
  mapEnforcementResultToOutcome,
  type EnforcementResult,
  type BodyguardOutcome,
  type GravityEvent,
  type GravityState,
  type LawSkill,
} from "../gravity-core/index.ts";
import { mapBoundaryRequestToGravityProposal } from "./boundary-to-gravity.ts";
import { mapBoundaryLedgerToGravityView } from "./ledger-to-gravity.ts";
import {
  applyOpenAsLawGrant,
  buildGravityNslMoves,
  buildOpenAsLawNslStep,
  ledgerGrantOffer,
  ledgerUserConfirmedDeny,
} from "./nsl-open-as-law.ts";
import type {
  BoundaryActionRequest,
  BoundaryApprovalRequest,
  BoundaryRuntimeConfig,
  NslMove,
} from "../types.ts";

export type BoundaryGravityEnforcement =
  | {
      outcome: "allow" | "transform" | "deny";
      result: EnforcementResult;
      reason: string;
      lawIds: string[];
      nslMoves: NslMove[];
      request: BoundaryActionRequest;
      config: BoundaryRuntimeConfig;
    }
  | {
      outcome: "nsl_grant_offer";
      result: EnforcementResult;
      reason: string;
      lawIds: string[];
      nslMoves: NslMove[];
      request: BoundaryActionRequest;
      config: BoundaryRuntimeConfig;
      applyGrant: (approval?: BoundaryApprovalRequest) => Promise<{ config: BoundaryRuntimeConfig; request: BoundaryActionRequest }>;
      denyGrant: () => Promise<void>;
    };

function mapConfigToGravityState(config: BoundaryRuntimeConfig, ledger: { sessionTraceComplete: boolean; requestTraceComplete: boolean }): GravityState {
  const gravityEligibleGrants = config.grants.filter(
    (grant): grant is typeof grant & { resourceKind: Exclude<typeof grant.resourceKind, "chat"> } =>
      grant.resourceKind !== "chat",
  );

  return {
    identity: {
      id: config.session.sessionId,
      label: config.session.actorId,
    },
    staticLaws: {
      laws: (config.userLawIds ?? config.laws.map((law) => law.lawId)).map((id) => ({ id })),
    },
    dynamicLaws: {
      grants: gravityEligibleGrants.map((grant) => ({
        id: grant.grantId,
        kind: grant.resourceKind,
        scope: grant.resourceValue,
        issuedAt: Date.parse(grant.issuedAt),
        expiresAt: grant.expiresAt ? Date.parse(grant.expiresAt) : undefined,
        revokedAt: grant.revokedAt ? Date.parse(grant.revokedAt) : undefined,
      })),
    },
    memory: {
      handle: `boundary-session:${config.session.sessionId}`,
    },
    context: {
      ledger,
    },
  };
}

function normalizeState(skills: readonly LawSkill[], state: GravityState, event: GravityEvent) {
  let violations: EnforcementResult["violations"] = [];
  for (const skill of skills) {
    const next = skill.validate(state, event);
    if (next.length > 0) {
      violations = violations.concat(next);
    }
  }

  if (violations.length === 0) {
    return {
      decision: "allow" as const,
      state,
      violations,
    } satisfies EnforcementResult;
  }

  let nextState = state;
  for (const skill of skills) {
    const relevant = violations.filter((violation) => violation.lawId === skill.id);
    if (relevant.length === 0) continue;
    nextState = skill.normalize(nextState, relevant);
  }

  const allGrantable = violations.length > 0 && violations.every((violation) => {
    return [
      "PATH_OUT_OF_SCOPE",
      "RECIPIENT_OUT_OF_SCOPE",
      "DOMAIN_OUT_OF_SCOPE",
      "TOOL_OUT_OF_SCOPE",
      "DATABASE_OUT_OF_SCOPE",
      "SYSTEM_OUT_OF_SCOPE",
    ].includes(violation.code ?? "");
  });

  return {
    decision: allGrantable ? "null" : "deny",
    state: nextState,
    violations,
  } satisfies EnforcementResult;
}

export type BoundaryGravityService = {
  enforceRequest: (args: {
    config: BoundaryRuntimeConfig;
    request: BoundaryActionRequest;
  }) => Promise<BoundaryGravityEnforcement>;
};

export function createBoundaryGravityService(skills: readonly LawSkill[] = getDefaultLawSkills()): BoundaryGravityService {
  return {
    async enforceRequest({ config, request }) {
      const proposal = mapBoundaryRequestToGravityProposal(request);
      const ledger = await mapBoundaryLedgerToGravityView({
        sessionId: config.session.sessionId,
        requestId: request.requestId,
      });
      const state = mapConfigToGravityState(config, ledger);
      const result = normalizeState(state ? skills : skills, state, {
        kind: "ProposalReceived",
        ts: Date.now(),
        proposal,
      });
      const outcome: BodyguardOutcome = mapEnforcementResultToOutcome(result, proposal);
      const lawIds = [...new Set(result.violations.map((violation) => violation.lawId))];

      if (outcome.outcome === "nsl_grant_offer") {
        await ledgerGrantOffer({ config, request, offer: outcome.grantOffer });
        const step = buildOpenAsLawNslStep({ offer: outcome.grantOffer, request });
        return {
          outcome: "nsl_grant_offer",
          result,
          reason: step.message,
          lawIds,
          nslMoves: buildGravityNslMoves(step),
          request,
          config,
          applyGrant: async (approval) => {
            const nextConfig = await applyOpenAsLawGrant({
              config,
              request,
              offer: outcome.grantOffer,
              issuedBy: approval?.session.actorId ?? config.session.actorId,
            });
            return {
              config: nextConfig,
              request,
            };
          },
          denyGrant: async () => {
            await ledgerUserConfirmedDeny({ config, request, offer: outcome.grantOffer });
          },
        };
      }

      const reason =
        outcome.outcome === "deny"
          ? result.violations[0]?.message ?? "gravity denied proposal"
          : result.violations[0]?.message ?? "gravity admitted proposal";

      return {
        outcome: outcome.outcome,
        result,
        reason,
        lawIds,
        nslMoves: [],
        request,
        config,
      };
    },
  };
}
