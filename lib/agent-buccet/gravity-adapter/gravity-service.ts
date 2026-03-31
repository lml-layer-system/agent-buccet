import {
  getDefaultLawSkills,
  mapEnforcementResultToOutcome,
  evaluateGravityEvent,
  type EnforcementResult,
  type BodyguardOutcome,
  type GravityEvent,
  type GravityState,
  type LawSkill,
} from "../gravity-core/index.ts";
import { mapBoundaryRequestToGravityProposal } from "./boundary-to-gravity.ts";
import { mapBoundaryLedgerToGravityView } from "./ledger-to-gravity.ts";
import {
  applyOpenAsLawBodyguardGrant,
  buildGravityBodyguardMoves,
  buildOpenAsLawBodyguardStep,
  ledgerBodyguardConfirmedDeny,
  ledgerBodyguardGrantOffer,
} from "./bodyguard-open-as-law.ts";
import type {
  BoundaryActionRequest,
  BoundaryApprovalRequest,
  BoundaryRuntimeConfig,
  BodyguardMove,
} from "../types.ts";

export type BoundaryGravityEnforcement =
  | {
      outcome: "allow" | "transform" | "deny";
      result: EnforcementResult;
      reason: string;
      lawIds: string[];
      bodyguardMoves: BodyguardMove[];
      request: BoundaryActionRequest;
      config: BoundaryRuntimeConfig;
    }
  | {
      outcome: "bodyguard_grant_offer";
      result: EnforcementResult;
      reason: string;
      lawIds: string[];
      bodyguardMoves: BodyguardMove[];
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

type GravityKernelJob = {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
  resolve: (value: BoundaryGravityEnforcement) => void;
  reject: (error: unknown) => void;
};

type GravityKernelRuntime = {
  sessionId: string;
  skills: readonly LawSkill[];
  currentState?: GravityState;
  queue: GravityKernelJob[];
  waiters: Array<() => void>;
  running: boolean;
};

const gravityKernelRuntimes = new Map<string, GravityKernelRuntime>();

function getOrCreateRuntime(sessionId: string, skills: readonly LawSkill[]) {
  const existing = gravityKernelRuntimes.get(sessionId);
  if (existing) {
    return existing;
  }
  const runtime: GravityKernelRuntime = {
    sessionId,
    skills,
    queue: [],
    waiters: [],
    running: false,
  };
  gravityKernelRuntimes.set(sessionId, runtime);
  return runtime;
}

function wakeRuntime(runtime: GravityKernelRuntime) {
  const waiter = runtime.waiters.shift();
  if (waiter) {
    waiter();
  }
}

function enqueueRuntimeJob(runtime: GravityKernelRuntime, job: GravityKernelJob) {
  runtime.queue.push(job);
  wakeRuntime(runtime);
}

async function nextRuntimeJob(runtime: GravityKernelRuntime): Promise<GravityKernelJob> {
  const existing = runtime.queue.shift();
  if (existing) {
    return existing;
  }
  await new Promise<void>((resolve) => {
    runtime.waiters.push(resolve);
  });
  return nextRuntimeJob(runtime);
}

async function runRuntimeLoop(runtime: GravityKernelRuntime): Promise<void> {
  if (runtime.running) {
    return;
  }
  runtime.running = true;

  while (true) {
    const job = await nextRuntimeJob(runtime);
    try {
      const proposal = mapBoundaryRequestToGravityProposal(job.request);
      const ledger = await mapBoundaryLedgerToGravityView({
        sessionId: job.config.session.sessionId,
        requestId: job.request.requestId,
      });
      const baseState = mapConfigToGravityState(job.config, ledger);
      const currentState = runtime.currentState
        ? {
            ...runtime.currentState,
            identity: baseState.identity,
            staticLaws: baseState.staticLaws,
            dynamicLaws: baseState.dynamicLaws,
            memory: baseState.memory,
            context: baseState.context,
          }
        : baseState;
      const event: GravityEvent = {
        kind: "ProposalReceived",
        ts: Date.now(),
        proposal,
      };
      const evaluated = evaluateGravityEvent({
        state: currentState,
        event,
        skills: runtime.skills,
      });
      runtime.currentState = evaluated.state;
      const result = evaluated.result;
      const outcome: BodyguardOutcome = mapEnforcementResultToOutcome(result, proposal);
      const lawIds = [...new Set(result.violations.map((violation) => violation.lawId))];

      if (outcome.outcome === "bodyguard_grant_offer") {
        await ledgerBodyguardGrantOffer({ config: job.config, request: job.request, offer: outcome.grantOffer });
        const step = buildOpenAsLawBodyguardStep({ offer: outcome.grantOffer, request: job.request });
        job.resolve({
          outcome: "bodyguard_grant_offer",
          result,
          reason: step.message,
          lawIds,
          bodyguardMoves: buildGravityBodyguardMoves(step),
          request: job.request,
          config: job.config,
          applyGrant: async (approval) => {
            const nextConfig = await applyOpenAsLawBodyguardGrant({
              config: job.config,
              request: job.request,
              offer: outcome.grantOffer,
              issuedBy: approval?.session.actorId ?? job.config.session.actorId,
            });
            return {
              config: nextConfig,
              request: job.request,
            };
          },
          denyGrant: async () => {
            await ledgerBodyguardConfirmedDeny({ config: job.config, request: job.request, offer: outcome.grantOffer });
          },
        });
        continue;
      }

      const reason =
        outcome.outcome === "deny"
          ? result.violations[0]?.message ?? "gravity denied proposal"
          : result.violations[0]?.message ?? "gravity admitted proposal";

      job.resolve({
        outcome: outcome.outcome,
        result,
        reason,
        lawIds,
        bodyguardMoves: [],
        request: job.request,
        config: job.config,
      });
    } catch (error) {
      job.reject(error);
    }
  }
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
      const runtime = getOrCreateRuntime(config.session.sessionId, skills);
      void runRuntimeLoop(runtime);
      return await new Promise<BoundaryGravityEnforcement>((resolve, reject) => {
        enqueueRuntimeJob(runtime, {
          config,
          request,
          resolve,
          reject,
        });
      });
    },
  };
}
