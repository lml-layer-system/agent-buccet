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
import { appendBoundaryLedger } from "../ledger.ts";
import { compileLiveUplField } from "../user-path-ledger.ts";
import type {
  BoundaryActionRequest,
  BoundaryApprovalRequest,
  BoundaryRuntimeConfig,
  BoundaryUplEntry,
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

function buildUplPathGrantScopes(entry: BoundaryUplEntry): Array<{ scope: string; exactOnly: boolean }> {
  const requestActionKind = entry.requestBasis?.actionKind ?? "";
  if (!requestActionKind.startsWith("fs.")) {
    return [];
  }

  const constraint = entry.trackConstraint;
  if (constraint && constraint.targetMatchMode !== "regex") {
    if (constraint.targetPatterns?.length) {
      return constraint.targetPatterns.map((scope) => ({
        scope,
        exactOnly: constraint.targetMatchMode === "exact",
      }));
    }
    if (constraint.targetPattern) {
      return [{
        scope: constraint.targetPattern,
        exactOnly: constraint.targetMatchMode === "exact",
      }];
    }
  }

  return entry.requestBasis?.target
    ? [{ scope: entry.requestBasis.target, exactOnly: true }]
    : [];
}

function mapConfigToGravityState(config: BoundaryRuntimeConfig, ledger: { sessionTraceComplete: boolean; requestTraceComplete: boolean }): GravityState {
  const gravityEligibleGrants = config.grants.filter(
    (grant): grant is typeof grant & { resourceKind: Exclude<typeof grant.resourceKind, "chat"> } =>
      grant.resourceKind !== "chat",
  );
  const uplPathGrants = config.upl
    ? compileLiveUplField({
      ledger: config.upl,
      session: config.session,
    }).flatMap((segment, index) => {
      if (segment.polarity !== "allow") {
        return [];
      }
      return buildUplPathGrantScopes(segment.entry).map((grantScope, scopeIndex) => ({
        id: `upl:${segment.entry.id}:${scopeIndex + 1}`,
        kind: "path" as const,
        scope: grantScope.scope,
        exactOnly: grantScope.exactOnly,
        issuedAt: Date.parse(segment.entry.createdAt) || Date.now() + index,
      }));
    })
    : [];
  const dynamicGrants = [
    ...gravityEligibleGrants.map((grant) => ({
      id: grant.grantId,
      kind: grant.resourceKind,
      scope: grant.resourceValue,
      exactOnly: grant.metadata?.exact_only === true,
      issuedAt: Date.parse(grant.issuedAt),
      expiresAt: grant.expiresAt ? Date.parse(grant.expiresAt) : undefined,
      revokedAt: grant.revokedAt ? Date.parse(grant.revokedAt) : undefined,
    })),
    ...uplPathGrants,
  ];
  const uniqueDynamicGrants = [...new Map(dynamicGrants.map((grant) => [`${grant.kind}:${grant.scope}:${grant.exactOnly === true}`, grant])).values()];

  return {
    identity: {
      id: config.session.sessionId,
      label: config.session.actorId,
    },
    staticLaws: {
      laws: (config.userLawIds ?? config.laws.map((law) => law.lawId)).map((id) => ({ id })),
    },
    dynamicLaws: {
      grants: uniqueDynamicGrants,
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
  key: string;
  serviceId: number;
  sessionId: string;
  skills: readonly LawSkill[];
  currentState?: GravityState;
  queue: GravityKernelJob[];
  waiters: Array<() => void>;
  running: boolean;
  stopped: boolean;
  lastUsedAt: number;
};

const gravityKernelRuntimes = new Map<string, GravityKernelRuntime>();
let nextGravityServiceId = 1;

function stopRuntime(runtime: GravityKernelRuntime) {
  if (runtime.stopped) {
    return;
  }
  runtime.stopped = true;
  gravityKernelRuntimes.delete(runtime.key);
  while (runtime.waiters.length > 0) {
    const waiter = runtime.waiters.shift();
    waiter?.();
  }
}

function getOrCreateRuntime(serviceId: number, sessionId: string, skills: readonly LawSkill[]) {
  const key = `${serviceId}::${sessionId}`;
  const existing = gravityKernelRuntimes.get(key);
  if (existing) {
    return existing;
  }
  const runtime: GravityKernelRuntime = {
    key,
    serviceId,
    sessionId,
    skills,
    queue: [],
    waiters: [],
    running: false,
    stopped: false,
    lastUsedAt: Date.now(),
  };
  gravityKernelRuntimes.set(key, runtime);
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
  runtime.lastUsedAt = Date.now();
  wakeRuntime(runtime);
}

async function nextRuntimeJob(runtime: GravityKernelRuntime): Promise<GravityKernelJob | null> {
  const existing = runtime.queue.shift();
  if (existing) {
    return existing;
  }
  if (runtime.stopped) {
    return null;
  }
  await new Promise<void>((resolve) => {
    runtime.waiters.push(resolve);
  });
  if (runtime.stopped) {
    return null;
  }
  return nextRuntimeJob(runtime);
}

async function runRuntimeLoop(runtime: GravityKernelRuntime): Promise<void> {
  if (runtime.running) {
    return;
  }
  runtime.running = true;

  while (true) {
    const job = await nextRuntimeJob(runtime);
    if (!job) {
      runtime.running = false;
      return;
    }
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
        onSkillError: ({ phase, lawId, error }) => {
          void appendBoundaryLedger("GRAVITY_SKILL_ERROR", {
            sessionId: job.config.session.sessionId,
            actorId: job.config.session.actorId,
            requestId: job.request.requestId,
            actionKind: job.request.actionKind,
            target: job.request.target,
            reason: error instanceof Error ? error.message : String(error),
            lawIds: [lawId],
            metadata: {
              phase,
              service_id: runtime.serviceId,
            },
            createdAt: new Date().toISOString(),
          }).catch(() => undefined);
        },
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
    } finally {
      runtime.lastUsedAt = Date.now();
      if (job.config.session.status !== "active" && runtime.queue.length === 0) {
        stopRuntime(runtime);
      }
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
  const serviceId = nextGravityServiceId++;
  return {
    async enforceRequest({ config, request }) {
      const runtime = getOrCreateRuntime(serviceId, config.session.sessionId, skills);
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
