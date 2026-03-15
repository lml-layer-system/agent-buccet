import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

type Manifest = {
  generatedAt: string;
  releaseId: string;
  signedBy: string;
  profiles: Array<{ profileId: string; version: string; immutableHash: string }>;
  gateResults: {
    blockerCriticalHigh: number;
    determinismPass: boolean;
    ledgerChainVerified: boolean;
  };
  testMatrix: {
    verifySnap: "pass" | "fail";
    deterministicReplay: "pass" | "fail";
  };
  digest: string;
};

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function digestOf(value: Omit<Manifest, "digest">): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function resolveManifestPath(): Promise<string> {
  const dir = path.join(process.cwd(), "docs", "releases");
  const releaseId = process.env.RELEASE_ID;

  if (releaseId) {
    return path.join(dir, `${releaseId}.json`);
  }

  const files = (await fs.readdir(dir))
    .filter((entry) => entry.endsWith(".json"))
    .sort();

  assert(files.length > 0, "No release manifests found in docs/releases.");
  return path.join(dir, files[files.length - 1]);
}

async function main() {
  const manifestPath = await resolveManifestPath();
  const raw = await fs.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw) as Manifest;

  assert(Boolean(manifest.signedBy) && manifest.signedBy !== "UNSIGNED", "Manifest signoff is missing or UNSIGNED.");
  assert(manifest.gateResults.blockerCriticalHigh === 0, "Manifest gate failed: blockerCriticalHigh must be 0.");
  assert(manifest.gateResults.determinismPass, "Manifest gate failed: determinismPass must be true.");
  assert(manifest.gateResults.ledgerChainVerified, "Manifest gate failed: ledgerChainVerified must be true.");

  const tests = manifest.testMatrix;
  assert(tests.verifySnap === "pass", "Manifest gate failed: verifySnap must be pass.");
  assert(tests.deterministicReplay === "pass", "Manifest gate failed: deterministicReplay must be pass.");

  const expectedDigest = digestOf({
    generatedAt: manifest.generatedAt,
    releaseId: manifest.releaseId,
    signedBy: manifest.signedBy,
    profiles: manifest.profiles,
    gateResults: manifest.gateResults,
    testMatrix: manifest.testMatrix,
  });

  assert(manifest.digest === expectedDigest, "Manifest digest mismatch.");

  console.log(`Release manifest verified: ${path.relative(process.cwd(), manifestPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
