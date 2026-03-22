import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createFileBoundaryLedgerWitness,
  createHttpBoundaryLedgerWitness,
  publishBoundaryLedgerCheckpoint,
} from "./witness.ts";

export type BoundaryReleaseWitnessStatus = {
  required: boolean;
  status: "published" | "skipped";
  mode: "file" | "http";
  target: string;
  fallback?: boolean;
  checkpoint_id?: string;
  signer_id?: string;
  receipt?: {
    witness_id: string;
    published_at: string;
    target: string;
    checkpoint_id: string;
    signer_id: string;
  };
  opt_out_reason: string | null;
  generated_at: string;
};

function resolveRequired(env: NodeJS.ProcessEnv): boolean {
  const witness = env.AGENT_BUCCET_WITNESS_REQUIRED;
  if (witness === "false") return false;
  if (witness === "true") return true;
  const legacyRelease = env.AGENT_BUCCET_RELEASE_WITNESS_REQUIRED;
  if (legacyRelease === "false") return false;
  if (legacyRelease === "true") return true;
  return true;
}

function resolveOptOutReason(env: NodeJS.ProcessEnv): string | null {
  const primary = env.AGENT_BUCCET_WITNESS_OPT_OUT_REASON?.trim();
  if (primary) return primary;
  const legacy = env.AGENT_BUCCET_RELEASE_WITNESS_OPTOUT_REASON?.trim();
  return legacy || null;
}

function resolveTarget(releaseDir: string, env: NodeJS.ProcessEnv): { mode: "file" | "http"; target: string } {
  // BUCCET_WITNESS_URL is the short-form env var for pointing to your own witness server.
  // AGENT_BUCCET_WITNESS_HTTP_URL is the legacy alias — both are supported.
  const httpUrl = env.BUCCET_WITNESS_URL ?? env.AGENT_BUCCET_WITNESS_HTTP_URL;
  if (httpUrl) {
    return { mode: "http", target: httpUrl };
  }
  if (env.AGENT_BUCCET_WITNESS_FILE) {
    return { mode: "file", target: env.AGENT_BUCCET_WITNESS_FILE };
  }
  // Default: local file. 100% offline. No network call.
  // Set BUCCET_WITNESS_URL to point to your own witness server for off-machine anchoring.
  return {
    mode: "file",
    target: path.join(releaseDir, "witness", "latest.checkpoints.jsonl"),
  };
}

async function writeStatusFile(releaseDir: string, status: BoundaryReleaseWitnessStatus) {
  const witnessDir = path.join(releaseDir, "witness");
  await fs.mkdir(witnessDir, { recursive: true });
  await fs.writeFile(path.join(witnessDir, "status.json"), `${JSON.stringify(status, null, 2)}\n`, "utf8");
}

export async function publishBoundaryReleaseWitness(args: {
  releaseDir: string;
  env?: NodeJS.ProcessEnv;
}): Promise<BoundaryReleaseWitnessStatus> {
  const env = args.env ?? process.env;
  const required = resolveRequired(env);
  const { mode, target } = resolveTarget(args.releaseDir, env);
  const optOutReason = resolveOptOutReason(env);

  if (!required) {
    if (!optOutReason) {
      throw new Error(
        "AGENT_BUCCET_WITNESS_OPT_OUT_REASON is required when witness publication is disabled " +
          "(AGENT_BUCCET_WITNESS_REQUIRED=false or legacy AGENT_BUCCET_RELEASE_WITNESS_REQUIRED=false)",
      );
    }
    const skipped: BoundaryReleaseWitnessStatus = {
      required,
      status: "skipped",
      mode,
      target,
      opt_out_reason: optOutReason,
      generated_at: new Date().toISOString(),
    };
    await writeStatusFile(args.releaseDir, skipped);
    return skipped;
  }

  let published: Awaited<ReturnType<typeof publishBoundaryLedgerCheckpoint>>;
  let resolvedMode = mode;
  let resolvedTarget = target;
  let usedFallback = false;

  if (mode === "http") {
    try {
      published = await publishBoundaryLedgerCheckpoint({
        adapter: createHttpBoundaryLedgerWitness({ targetUrl: target }),
      });
    } catch {
      // User's witness server is unreachable — fall back to local file so the
      // release is not blocked. The fallback flag in the status file makes this
      // visible so the user knows to check their server.
      const localTarget = path.join(args.releaseDir, "witness", "latest.checkpoints.jsonl");
      process.stderr.write(
        `[agent-buccet] witness HTTP publish failed (${target}); falling back to local file: ${localTarget}\n`,
      );
      published = await publishBoundaryLedgerCheckpoint({
        adapter: createFileBoundaryLedgerWitness(localTarget),
      });
      resolvedMode = "file";
      resolvedTarget = localTarget;
      usedFallback = true;
    }
  } else {
    published = await publishBoundaryLedgerCheckpoint({
      adapter: createFileBoundaryLedgerWitness(target),
    });
  }

  const status: BoundaryReleaseWitnessStatus = {
    required,
    status: "published",
    mode: resolvedMode,
    target: resolvedTarget,
    ...(usedFallback ? { fallback: true } : {}),
    checkpoint_id: published.checkpoint.checkpoint_id,
    signer_id: published.checkpoint.signer_id,
    receipt: published.receipt,
    opt_out_reason: null,
    generated_at: new Date().toISOString(),
  };
  await writeStatusFile(args.releaseDir, status);
  return status;
}
