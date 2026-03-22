import path from "node:path";
import { appendBoundaryLedger } from "./ledger.ts";
import { enableBodyguardControl, enforceBoundaryProposal } from "./bodyguard.ts";
import { createStaticApprovalHandler } from "./approval.ts";
import { DEFAULT_BOUNDARY_LAWS } from "./laws.ts";
import { loadBoundaryPolicyConfig, applyBoundaryPolicyConfig } from "./policy.ts";
import { prepareBoundaryProcess, runBoundaryProcess } from "./process.ts";
import { createPersistentBoundaryRuntimeStore, restoreBoundaryRuntimeStore } from "./store.ts";
import type { BoundaryRuntimeStore } from "./store.ts";
import type {
  BoundaryLaw,
  BoundaryRequestProvenance,
} from "./types.ts";

function commandTarget(command: string): string {
  return path.basename(command);
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

  const config = {
    ...enableBodyguardControl(store.getConfig()),
    approvalHandler: createStaticApprovalHandler(true),
  };

  try {
    await prepareBoundaryProcess({
      config,
      command: args.command,
      scopePaths: args.scopePaths ?? [],
      envOverrides: args.env,
      policyPath: args.policyPath,
      requestedCwd: args.cwd,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "wrapped process blocked by process policy";
    if (
      message.includes("process command is blocked by wrapper process policy") ||
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
      payloadSummary: `spawn:${[args.command, ...args.commandArgs].join(" ")}`,
      provenance: args.provenance ?? "trusted_user",
      successReason: "wrapper launched explicitly granted command",
      successMetadata: {
        wrapper: true,
      },
      execute: async () => {
        const launched = await runBoundaryProcess({
          config,
          command: args.command,
          commandArgs: args.commandArgs,
          scopePaths: args.scopePaths ?? [],
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
