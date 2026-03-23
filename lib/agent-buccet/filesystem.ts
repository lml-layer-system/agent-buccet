import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createBoundaryActionRequest,
  executeBoundaryControlledAction,
  type BoundaryExecutionResult,
} from "./bodyguard.ts";
import type { BoundaryRuntimeConfig } from "./types.ts";

export type BoundaryFsResult<T = void> = BoundaryExecutionResult<T>;

function normalizeBoundaryPath(targetPath: string): string {
  return path.resolve(targetPath);
}

export async function boundaryReadFile(
  config: BoundaryRuntimeConfig,
  targetPath: string,
  encoding: BufferEncoding = "utf8",
): Promise<BoundaryFsResult<string>> {
  const target = normalizeBoundaryPath(targetPath);
  return executeBoundaryControlledAction({
    config,
    request: createBoundaryActionRequest({
      config,
      actionKind: "fs.read",
      target,
      payloadSummary: `read:${encoding}`,
    }),
    execute: async () => fs.readFile(target, encoding),
    successReason: "filesystem read executed inside boundary runtime",
  });
}

export async function boundaryWriteFile(
  config: BoundaryRuntimeConfig,
  targetPath: string,
  contents: string,
): Promise<BoundaryFsResult<void>> {
  const target = normalizeBoundaryPath(targetPath);
  return executeBoundaryControlledAction({
    config,
    request: createBoundaryActionRequest({
      config,
      actionKind: "fs.write",
      target,
      payloadSummary: `write:${contents.length}bytes`,
    }),
    execute: async () => {
      await fs.writeFile(target, contents, "utf8");
    },
    successReason: "filesystem write executed inside boundary runtime",
    dryRunPreviewReason: "session is in dry-run mode; filesystem write previewed but not executed",
  });
}

export async function boundaryAppendFile(
  config: BoundaryRuntimeConfig,
  targetPath: string,
  contents: string,
): Promise<BoundaryFsResult<void>> {
  const target = normalizeBoundaryPath(targetPath);
  return executeBoundaryControlledAction({
    config,
    request: createBoundaryActionRequest({
      config,
      actionKind: "fs.append",
      target,
      payloadSummary: `append:${contents.length}bytes`,
    }),
    execute: async () => {
      await fs.appendFile(target, contents, "utf8");
    },
    successReason: "filesystem append executed inside boundary runtime",
    dryRunPreviewReason: "session is in dry-run mode; filesystem append previewed but not executed",
  });
}

export async function boundaryDeletePath(
  config: BoundaryRuntimeConfig,
  targetPath: string,
): Promise<BoundaryFsResult<void>> {
  const target = normalizeBoundaryPath(targetPath);
  return executeBoundaryControlledAction({
    config,
    request: createBoundaryActionRequest({
      config,
      actionKind: "fs.delete",
      target,
    }),
    execute: async () => {
      await fs.rm(target, { recursive: true, force: false });
    },
    successReason: "filesystem delete executed inside boundary runtime",
    dryRunPreviewReason: "session is in dry-run mode; filesystem delete previewed but not executed",
  });
}

export async function boundaryMkdir(
  config: BoundaryRuntimeConfig,
  targetPath: string,
): Promise<BoundaryFsResult<void>> {
  const target = normalizeBoundaryPath(targetPath);
  return executeBoundaryControlledAction({
    config,
    request: createBoundaryActionRequest({
      config,
      actionKind: "fs.mkdir",
      target,
    }),
    execute: async () => {
      await fs.mkdir(target, { recursive: true });
    },
    successReason: "filesystem mkdir executed inside boundary runtime",
    dryRunPreviewReason: "session is in dry-run mode; filesystem mkdir previewed but not executed",
  });
}

export async function boundaryMovePath(
  config: BoundaryRuntimeConfig,
  sourcePath: string,
  destinationPath: string,
): Promise<BoundaryFsResult<void>> {
  const source = normalizeBoundaryPath(sourcePath);
  const destination = normalizeBoundaryPath(destinationPath);

  const sourceAdmission = await executeBoundaryControlledAction<void>({
    config,
    request: createBoundaryActionRequest({
      config,
      actionKind: "fs.move",
      target: source,
      payloadSummary: `move-source:${destination}`,
    }),
    successReason: "source path admitted for move",
  });
  if (!sourceAdmission.allowed) {
    return sourceAdmission;
  }

  return executeBoundaryControlledAction({
    config,
    request: createBoundaryActionRequest({
      config,
      actionKind: "fs.move",
      target: destination,
      payloadSummary: `move-destination:${source}`,
    }),
    execute: async () => {
      await fs.rename(source, destination);
    },
    successReason: "filesystem move executed inside boundary runtime",
    dryRunPreviewReason: "session is in dry-run mode; filesystem move previewed but not executed",
  });
}
