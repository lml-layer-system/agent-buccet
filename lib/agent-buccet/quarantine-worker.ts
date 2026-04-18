import { parentPort, workerData } from "node:worker_threads";
import { materializeBoundaryActionRequestFromUplEntry } from "./user-path-ledger.ts";
import type {
  BoundaryActionRequest,
  BoundarySession,
  BoundaryUplEntry,
} from "./types.ts";

type BoundaryQuarantineSnapshotItem = {
  itemId: string;
  entryId: string;
  side: "approved" | "denied";
  hash: string;
  entry: BoundaryUplEntry;
};

type BoundaryQuarantineReportItem = {
  itemId: string;
  entryId: string;
  side: "approved" | "denied";
  hash: string;
  path: string;
  pathHash: string;
  actionKind?: string;
  target?: string;
  verdict: "survivor" | "pit";
  reason: string;
  lawIds: string[];
  resolution: "pending" | "denied_as_law" | "survivor";
};

type BoundaryQuarantinePreparedItem = {
  itemId: string;
  entryId: string;
  side: "approved" | "denied";
  hash: string;
  path: string;
  pathHash: string;
  request?: BoundaryActionRequest;
  preparationPit?: BoundaryQuarantineReportItem;
};

type BoundaryQuarantinePreparedShard = {
  shardId: string;
  items: BoundaryQuarantinePreparedItem[];
};

type WorkerInput = {
  session: BoundarySession;
  items: BoundaryQuarantineSnapshotItem[];
  shardId: string;
};

function buildMissingBasisPitItem(item: BoundaryQuarantineSnapshotItem): BoundaryQuarantineReportItem {
  return {
    itemId: item.itemId,
    entryId: item.entryId,
    side: item.side,
    hash: item.hash,
    path: item.entry.path,
    pathHash: item.entry.pathHash,
    verdict: "pit",
    reason: "entry has no request basis and cannot survive quarantine replay",
    lawIds: ["BOUNDARY.QUARANTINE.REQUEST_BASIS.01"],
    resolution: "pending",
  };
}

function prepareShard(input: WorkerInput): BoundaryQuarantinePreparedShard {
  return {
    shardId: input.shardId,
    items: input.items.map((item) => {
      const request = materializeBoundaryActionRequestFromUplEntry({
        entry: item.entry,
        session: input.session,
        provenance: "external_content",
        requestId: `quarantine-${item.entry.id}`,
      });
      return {
        itemId: item.itemId,
        entryId: item.entryId,
        side: item.side,
        hash: item.hash,
        path: item.entry.path,
        pathHash: item.entry.pathHash,
        ...(request
          ? { request }
          : { preparationPit: buildMissingBasisPitItem(item) }),
      };
    }),
  };
}

parentPort?.postMessage(prepareShard(workerData as WorkerInput));
