import { promises as fs } from "node:fs";
import path from "node:path";
import {
  buildBoundaryLedgerCheckpoint,
} from "./ledger.ts";
import type { BoundaryLedgerCheckpoint } from "./types.ts";

export type BoundaryLedgerWitnessReceipt = {
  witness_id: string;
  published_at: string;
  target: string;
  checkpoint_id: string;
  signer_id: string;
};

export type BoundaryLedgerWitnessAdapter = (checkpoint: BoundaryLedgerCheckpoint) =>
  Promise<BoundaryLedgerWitnessReceipt>;

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
