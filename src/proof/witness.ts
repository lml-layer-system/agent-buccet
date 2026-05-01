import { promises as fs } from "node:fs";
import path from "node:path";
import {
  buildBoundaryLedgerCheckpoint,
} from "./ledger.ts";
import type { BoundaryLedgerCheckpoint } from "./../runtime/types.ts";

export type BoundaryLedgerWitnessReceipt = {
  witness_id: string;
  published_at: string;
  target: string;
  checkpoint_id: string;
  signer_id: string;
};

export type BoundaryLedgerWitnessAdapter = (checkpoint: BoundaryLedgerCheckpoint) =>
  Promise<BoundaryLedgerWitnessReceipt>;

export type BoundaryHttpLedgerWitnessOptions = {
  targetUrl: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

export function createFileBoundaryLedgerWitness(targetPath: string): BoundaryLedgerWitnessAdapter {
  return async (checkpoint) => {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.appendFile(targetPath, `${JSON.stringify(checkpoint)}\n`, "utf8");
    return {
      witness_id: `file:${targetPath}`,
      published_at: new Date().toISOString(),
      target: targetPath,
      checkpoint_id: checkpoint.checkpoint_id,
      signer_id: checkpoint.signer_id,
    };
  };
}

export function createHttpBoundaryLedgerWitness(
  options: BoundaryHttpLedgerWitnessOptions,
): BoundaryLedgerWitnessAdapter {
  return async (checkpoint) => {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? 5000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(options.targetUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(options.headers ?? {}),
        },
        body: JSON.stringify(checkpoint),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`witness endpoint returned ${response.status}`);
      }
      return {
        witness_id: `http:${options.targetUrl}`,
        published_at: new Date().toISOString(),
        target: options.targetUrl,
        checkpoint_id: checkpoint.checkpoint_id,
        signer_id: checkpoint.signer_id,
      };
    } finally {
      clearTimeout(timer);
    }
  };
}

export async function publishBoundaryLedgerCheckpoint(args: {
  adapter: BoundaryLedgerWitnessAdapter;
  checkpoint?: BoundaryLedgerCheckpoint;
}): Promise<{
  checkpoint: BoundaryLedgerCheckpoint;
  receipt: BoundaryLedgerWitnessReceipt;
}> {
  const checkpoint = args.checkpoint ?? await buildBoundaryLedgerCheckpoint();
  const receipt = await args.adapter(checkpoint);
  return {
    checkpoint,
    receipt,
  };
}
