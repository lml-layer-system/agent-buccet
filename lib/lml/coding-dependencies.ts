import type { CodingIntentSpec } from "@/lib/lml/coding-intent-spec";
import type { CodingSkeletonContract } from "@/lib/lml/coding-skeleton-laws";

export const CODING_DEPENDENCY_LAWS = [
  "ABILITY.CODING.79: Dependency graph legality is a direct integration constraint, not a secondary cleanup step.",
  "ABILITY.CODING.80: Version mismatch, missing dependency declaration, and transitive conflict must collapse to NULL before emission.",
] as const;

export type CodingDependencyValidation = {
  ok: boolean;
  reason: string;
  passed: string[];
  failed: string[];
};

export function validateCodingDependencies(args: {
  contract: CodingSkeletonContract;
  intentSpec: CodingIntentSpec;
  text: string;
}): CodingDependencyValidation {
  const lower = args.text.toLowerCase();
  const passed: string[] = [];
  const failed: string[] = [];

  const reqLines = extractRequirementLines(lower);
  const versionMap = new Map<string, Set<string>>();
  for (const line of reqLines) {
    const match = line.match(/^([a-z0-9_.-]+)(==|>=|<=|~=)?([a-z0-9_.-]+)?$/);
    if (!match) continue;
    const name = match[1];
    const version = match[3] ?? "unspecified";
    const bucket = versionMap.get(name) ?? new Set<string>();
    bucket.add(version);
    versionMap.set(name, bucket);
  }
  if ([...versionMap.values()].some((versions) => versions.size > 1)) failed.push("I1.1_VERSION_MISMATCH");
  else passed.push("I1.1_VERSION_MISMATCH");

  const importedDeps = new Set<string>();
  const externalModules = ["fastapi", "flask", "sqlalchemy", "pygame", "pydantic", "jwt", "pyjwt"];
  for (const mod of externalModules) {
    if (new RegExp(`\\b(import|from)\\s+${mod}\\b`).test(lower)) importedDeps.add(mod);
  }
  const declared = new Set(reqLines.map((line) => line.split(/[<>=~]/)[0]).map((line) => line.trim()).filter(Boolean));
  const missing = [...importedDeps].find((dep) => reqLines.length > 0 && !declared.has(dep));
  if (missing) failed.push("I1.2_MISSING_DEPENDENCY");
  else passed.push("I1.2_MISSING_DEPENDENCY");

  const hasFastapi = declared.has("fastapi") || /\bfastapi\b/.test(lower);
  const hasPydantic1 = reqLines.some((line) => /^pydantic==1\./.test(line));
  const hasPydantic2Usage = /\.model_dump\(/.test(lower);
  if (hasFastapi && hasPydantic1 && hasPydantic2Usage) failed.push("I1.3_TRANSITIVE_DEPENDENCY_CONFLICT");
  else passed.push("I1.3_TRANSITIVE_DEPENDENCY_CONFLICT");

  return {
    ok: failed.length === 0,
    reason: failed.length === 0 ? "ok" : `dependency_failed:${failed[0]}`,
    passed,
    failed,
  };
}

function extractRequirementLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[a-z0-9_.-]+(==|>=|<=|~=)[a-z0-9_.-]+$/.test(line));
}
