import path from "node:path";
import { appendBoundaryLedger } from "./ledger.ts";
import { enableBodyguardControl, enforceBoundaryProposal } from "./bodyguard.ts";
import { DEFAULT_BOUNDARY_LAWS } from "./laws.ts";
import { loadBoundaryPolicyConfig, applyBoundaryPolicyConfig } from "./policy.ts";
import { prepareBoundaryProcess, runBoundaryProcess } from "./process.ts";
import { sendBoundaryInterceptServerInput } from "./system-intercept.ts";
import { createPersistentBoundaryRuntimeStore, restoreBoundaryRuntimeStore } from "./store.ts";
import type { BoundaryRuntimeStore } from "./store.ts";
import type {
  BoundaryActionRequest,
  BoundaryLaw,
  BoundaryRequestProvenance,
  BoundaryReviewContext,
} from "./types.ts";

function commandTarget(command: string): string {
  return path.basename(command);
}

function buildCommandAttemptLines(command: string, commandArgs: string[]): string[] {
  if (commandArgs.length === 0) {
    return [`$ ${command}`];
  }
  return [
    `$ ${command} ${commandArgs[0]}`,
    ...commandArgs.slice(1).map((arg) => `  ${arg}`),
  ];
}

function createWrapperExecLaws(allowedCommandTarget: string): BoundaryLaw[] {
  const laws = DEFAULT_BOUNDARY_LAWS.filter((law) => law.lawId !== "BOUNDARY.EXEC.01");
  return [
    ...laws,
    {
      lawId: "BOUNDARY.EXEC.WRAPPER.01",
      description: "The wrapper may launch only the explicitly granted command target.",
      appliesTo: ["tool.exec"],
      evaluate: ({ request }) => {
        if (request.target !== allowedCommandTarget) {
          return {
            decision: "deny",
            reason: "wrapper can launch only the explicitly granted command target",
            triggeredLawIds: ["BOUNDARY.EXEC.WRAPPER.01"],
            requiresApproval: false,
          };
        }
        return {
          decision: "allow",
          reason: "wrapper authorized explicitly granted command target",
          triggeredLawIds: ["BOUNDARY.EXEC.WRAPPER.01"],
          requiresApproval: false,
        };
      },
    },
  ];
}

async function getOrCreateStore(args: {
  sessionId: string;
  actorId: string;
  sessionsDir?: string;
  dryRun?: boolean;
  wrapperLaws: BoundaryLaw[];
}): Promise<BoundaryRuntimeStore> {
  const restored = await restoreBoundaryRuntimeStore({
    sessionId: args.sessionId,
    sessionsDir: args.sessionsDir,
    laws: args.wrapperLaws,
  });
  if (restored) {
    return restored;
  }
  return createPersistentBoundaryRuntimeStore({
    sessionId: args.sessionId,
    actorId: args.actorId,
    sessionsDir: args.sessionsDir,
    dryRun: args.dryRun,
    laws: args.wrapperLaws,
  });
}

async function assertDirectInterceptPathActive(socketPath = process.env.BUCCET_SOCKET_PATH) {
  if (!socketPath) {
    throw new Error("direct intercept path is not active: BUCCET_SOCKET_PATH is missing");
  }

  const status = await sendBoundaryInterceptServerInput({
    target: { socketPath },
    input: { command: "status", requestId: "wrapper-strict-path-status" },
  }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`direct intercept path is not active: ${message}`);
  });

  if (status.type !== "status" || status.running !== true) {
    throw new Error("direct intercept path is not active: intercept server did not report ready");
  }
}

export async function runBoundaryWrappedCommand(args: {
  sessionId: string;
  actorId: string;
  command: string;
  commandArgs: string[];
  scopePaths?: string[];
  policyPath?: string;
  sessionsDir?: string;
  env?: Record<string, string>;
  cwd?: string;
  dryRun?: boolean;
  keepSession?: boolean;
  provenance?: BoundaryRequestProvenance;
  payloadSummary?: string;
  flags?: BoundaryActionRequest["flags"];
  reviewContext?: BoundaryReviewContext;
  successReason?: string;
  dryRunPreviewReason?: string;
  successMetadata?: Record<string, string | number | boolean>;
}): Promise<{ exitCode: number; sessionId: string }> {
  const target = commandTarget(args.command);
  const wrapperLaws = createWrapperExecLaws(target);
  const store = await getOrCreateStore({
    sessionId: args.sessionId,
    actorId: args.actorId,
    sessionsDir: args.sessionsDir,
    dryRun: args.dryRun,
    wrapperLaws,
  });

  if (args.policyPath) {
    const policy = await loadBoundaryPolicyConfig(args.policyPath);
    store.replaceConfig(
      applyBoundaryPolicyConfig({
        config: store.getConfig(),
        policy,
        availableLaws: wrapperLaws,
        issuedBy: args.actorId,
      }),
    );
    await store.persist();
  }

  for (const scopePath of args.scopePaths ?? []) {
    await store.openPath({
      rootPath: scopePath,
      grantedActions: ["fs.read", "fs.write", "fs.append", "fs.delete", "fs.mkdir", "fs.move"],
      issuedBy: args.actorId,
    });
  }

  await store.issueGrant({
    resourceKind: "tool",
    resourceValue: target,
    grantedActions: ["tool.exec"],
    issuedBy: args.actorId,
    metadata: {
      wrapper_command: args.command,
    },
  });

  const config = enableBodyguardControl(store.getConfig());
  await assertDirectInterceptPathActive(
    args.env?.AGENT_BUCCET_INTERCEPT_SOCKET ?? args.env?.BUCCET_SOCKET_PATH,
  );

  try {
    await prepareBoundaryProcess({
      config,
      command: args.command,
      scopePaths: args.scopePaths ?? [],
      allowedCommandTargets: [target],
      envOverrides: args.env,
      policyPath: args.policyPath,
      requestedCwd: args.cwd,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "wrapped process blocked by process policy";
    if (
      message.includes("process command requires explicit standing law, allowlist, or current approval") ||
      message.includes("requested working directory is outside user-opened scope")
    ) {
      await appendBoundaryLedger("PROCESS_BLOCKED", {
        sessionId: config.session.sessionId,
        actorId: config.session.actorId,
        actionKind: "tool.exec",
        target: target,
        decision: "deny",
        reason: message,
        metadata: {
          command: args.command,
          argv: JSON.stringify(args.commandArgs),
          cwd: args.cwd ?? (args.scopePaths?.[0] ?? process.cwd()),
        },
        createdAt: new Date().toISOString(),
      });
      throw error;
    }
  }

  const result = await enforceBoundaryProposal({
    config,
    proposal: {
      actionKind: "tool.exec",
      target,
      payloadSummary: args.payloadSummary ?? `spawn:${[args.command, ...args.commandArgs].join(" ")}`,
      provenance: args.provenance ?? "trusted_user",
      flags: args.flags,
      reviewContext: args.reviewContext ?? {
        surface: "action",
        title: "Would you like to run the following command?",
        question: "Does this command match your intent?",
        attemptLines: buildCommandAttemptLines(args.command, args.commandArgs),
      },
      successReason: args.successReason ?? "wrapper launched explicitly granted command",
      dryRunPreviewReason: args.dryRunPreviewReason,
      successMetadata: args.successMetadata ?? {
        wrapper: true,
      },
      execute: async () => {
        const launched = await runBoundaryProcess({
          config,
          command: args.command,
          commandArgs: args.commandArgs,
          scopePaths: args.scopePaths ?? [],
          allowedCommandTargets: [target],
          envOverrides: args.env,
          policyPath: args.policyPath,
          requestedCwd: args.cwd,
        });
        return launched.exitCode;
      },
    },
  });

  if (!args.keepSession) {
    await store.endSession({
      endedBy: args.actorId,
      reason: "wrapped command completed",
    });
  } else {
    await store.persist();
  }

  if (!result.allowed) {
    throw new Error(result.reason);
  }

  return {
    exitCode: result.value ?? 0,
    sessionId: args.sessionId,
  };
}
