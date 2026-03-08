import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const ARTIFACT_ROOT = path.join(process.cwd(), "data", "product", "artifacts");

export type StoredArtifact = {
  artifactId: string;
  storageRef: string;
  digest: string;
  sizeBytes: number;
  contentType: string;
};

export async function storeArtifact(input: {
  caseId: string;
  fileName: string;
  contentType: string;
  contentBase64: string;
}): Promise<StoredArtifact> {
  const buffer = Buffer.from(input.contentBase64, "base64");
  const digest = createHash("sha256").update(buffer).digest("hex");
  const artifactId = randomUUID();

  const caseDir = path.join(ARTIFACT_ROOT, input.caseId);
  await fs.mkdir(caseDir, { recursive: true });

  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${artifactId}-${safeName}`;
  const absolutePath = path.join(caseDir, fileName);

  await fs.writeFile(absolutePath, buffer);

  return {
    artifactId,
    storageRef: path.relative(process.cwd(), absolutePath),
    digest,
    sizeBytes: buffer.byteLength,
    contentType: input.contentType,
  };
}
