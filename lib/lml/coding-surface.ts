import type { CodingIntentSpec } from "@/lib/lml/coding-intent-spec";
import type { CodingSkeletonContract } from "@/lib/lml/coding-skeleton-laws";

export const CODING_SURFACE_LAWS = [
  "ABILITY.CODING.64: Declared language and family must preserve one coherent implementation surface; cross-language or cross-framework contamination is inadmissible.",
  "ABILITY.CODING.65: When tests are requested, the emitted test surface must exercise the target behavior rather than merely import modules or assert trivial truth.",
  "ABILITY.CODING.66: API, app, auth, and ORM families must bind to one dependency universe at a time; mixed Python/Node or ORM/document-model surface contamination must hit NULL.",
  "ABILITY.CODING.67: Refactor and application families must preserve executable import paths, test harnesses, and framework entrypoints across the declared project graph.",
] as const;

export type CodingSurfaceValidation = {
  ok: boolean;
  reason: string;
  passed: string[];
  failed: string[];
};

export function validateCodingSurface(args: {
  contract: CodingSkeletonContract;
  intentSpec: CodingIntentSpec;
  text: string;
  blocks: Array<{ language: string; code: string }>;
}): CodingSurfaceValidation {
  const lower = args.text.toLowerCase();
  const passed: string[] = [];
  const failed: string[] = [];

  if (args.contract.language === "python") {
    const hasPythonSurface = /\bdef\s+\w+\(|\bclass\s+\w+[:(]|\bfrom\s+\w+(\.\w+)*\s+import\b|\bimport\s+\w+/.test(lower);
    if (hasPythonSurface) passed.push("python_surface");
    else failed.push("python_surface");

    if (/\bconst\s+\w+\s*=|\bfunction\s+\w+\(|=>\s*\{|\brequire\(|module\.exports\b/.test(lower)) {
      failed.push("cross_language_surface");
    } else {
      passed.push("cross_language_surface");
    }
  }

  if (args.contract.language === "typescript" || args.contract.language === "javascript") {
    const hasTsSurface =
      /\bexport\s+(default\s+)?(async\s+)?function\b|\bimport\s+.*\s+from\s+['"][^'"]+['"]|=>\s*</.test(args.text)
      || /['"]use client['"]|['"]use server['"]/.test(args.text);
    if (hasTsSurface) passed.push("typescript_surface");
    else failed.push("typescript_surface");

    if (/\bdef\s+\w+\(|\bclass\s+\w+\([^)]*BaseModel|\bfrom\s+fastapi\s+import\b/.test(lower)) {
      failed.push("cross_language_surface");
    } else {
      passed.push("cross_language_surface");
    }
  }

  if (args.contract.wantsTests) {
    const assertsBehavior =
      /\bassert\s+/.test(lower)
      || /response\.status_code\s*==/.test(lower)
      || /response\.json\(\)\[/.test(lower)
      || /\bexpect\(/.test(lower);
    const trivialOnly = /\bassert\s+true\b/.test(lower) && !/assert\s+[a-z0-9_]/.test(lower);
    if (assertsBehavior && !trivialOnly) passed.push("test_behavior_surface");
    else failed.push("test_behavior_surface");
  }

  if (["api", "app", "auth"].includes(args.contract.family)) {
    const pythonFramework = /\bfastapi\b|\bflask\b|\btestclient\b/.test(lower);
    const appRouterFramework = /['"]use client['"]|['"]use server['"]|\bnextresponse\b|\brevalidatepath\(|\bgeneratemetadata\(/.test(lower);
    const nodeFramework = /\bexpress\s*\(|\bfrom\s+['"]express['"]|\brequire\(['"]express['"]\)|\bnextapirequest\b|\bnextapiresponse\b/.test(lower);
    if (args.contract.family === "app") {
      if (appRouterFramework && !pythonFramework && !nodeFramework) passed.push("single_framework_surface");
      else failed.push("single_framework_surface");
    } else if (pythonFramework && !nodeFramework) {
      passed.push("single_framework_surface");
    } else {
      failed.push("single_framework_surface");
    }
  }

  if (args.contract.family === "orm") {
    const sqlalchemySurface = /\bsqlalchemy\b|declarativebase|mapped_column|session\.add\(/.test(lower);
    const docModelSurface = /\bmongoose\b|\bschema\b|\bmodel\(/.test(lower);
    if (sqlalchemySurface && !docModelSurface) passed.push("orm_dependency_surface");
    else failed.push("integration_failed:I2.7_ORM_SINGLE_DEPENDENCY_UNIVERSE");
  }

  if (args.contract.family === "refactor" || args.contract.family === "app") {
    const importPathPreserved = args.contract.family === "app"
      ? /\bimport\s+.*\s+from\s+['"][^'"]+['"]/.test(args.text)
      : /\bfrom\s+[a-z0-9_.]+\s+import\b/.test(lower);
    const entrypointPreserved = args.contract.family === "app"
      ? /\bexport\s+default\s+(async\s+)?function\s+Page\b/.test(args.text) || /\bgenerateMetadata\s*\(/.test(args.text)
      : /\b@app\.(get|post|put|delete|patch)\b|\bapp\s*=\s*fastapi\(/.test(lower);
    if (importPathPreserved) passed.push("import_path_surface");
    else failed.push("import_path_surface");
    if (entrypointPreserved || args.contract.family === "refactor") passed.push("entrypoint_surface");
    else failed.push("entrypoint_surface");
  }

  return {
    ok: failed.length === 0,
    reason: failed.length === 0 ? "ok" : `surface_failed:${failed[0]}`,
    passed,
    failed,
  };
}
