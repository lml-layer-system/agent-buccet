import type { CodingSkeletonContract } from "@/lib/lml/coding-skeleton-laws";

export const CODING_ARCHITECTURE_LAWS = [
  "ABILITY.CODING.25: Multi-file coding outputs must satisfy architecture-level legality before emission.",
  "ABILITY.CODING.26: Multi-file coding legality includes import/export consistency, no circular dependency, and valid module boundary shape.",
  "ABILITY.CODING.27: Architecture collapse must fail closed when file relationships are structurally invalid rather than emitting broken project graphs.",
] as const;

export type CodingArchitectureValidation = {
  ok: boolean;
  reason: string;
  moduleCount: number;
  violations: string[];
};

type PythonModuleInfo = {
  moduleName: string;
  exports: Set<string>;
  importModules: Set<string>;
  imports: Array<{ module: string; name: string }>;
};

export function validateCodingArchitecture(args: {
  contract: CodingSkeletonContract;
  blocks: Array<{ language: string; code: string }>;
}): CodingArchitectureValidation {
  const pythonBlocks = args.blocks
    .filter((block) => block.language === "python")
    .map((block) => parsePythonFileBlock(block.code))
    .filter((block): block is { moduleName: string; source: string } => Boolean(block));

  if (pythonBlocks.length <= 1) {
    return { ok: true, reason: "ok", moduleCount: pythonBlocks.length, violations: [] };
  }

  const modules = new Map<string, PythonModuleInfo>();
  const violations: string[] = [];

  for (const block of pythonBlocks) {
    const parsed = extractPythonModuleInfo(block.moduleName, block.source);
    if (!parsed.ok) {
      violations.push(`architecture_parse_error:${block.moduleName}`);
      continue;
    }
    modules.set(block.moduleName, parsed.info);
  }

  if (violations.length > 0) {
    return {
      ok: false,
      reason: violations[0],
      moduleCount: pythonBlocks.length,
      violations,
    };
  }

  for (const [moduleName, info] of modules.entries()) {
    for (const entry of info.imports) {
      if (!modules.has(entry.module)) {
        continue;
      }
      const target = modules.get(entry.module)!;
      if (!target.exports.has(entry.name)) {
        violations.push(`missing_export:${moduleName}->${entry.module}.${entry.name}`);
      }
    }
  }

  const cycle = findCycle(modules);
  if (cycle.length > 0) {
    violations.push(`circular_dependency:${cycle.join("->")}`);
  }

  return {
    ok: violations.length === 0,
    reason: violations.length === 0 ? "ok" : violations[0],
    moduleCount: pythonBlocks.length,
    violations,
  };
}

function parsePythonFileBlock(code: string): { moduleName: string; source: string } | null {
  const lines = code.split("\n");
  const first = lines[0]?.trim() ?? "";
  const match = first.match(/^#\s*([A-Za-z0-9_./-]+\.py)\s*$/);
  if (!match) {
    return null;
  }
  const path = match[1];
  const moduleName = path.replace(/\.py$/, "").replace(/\//g, ".");
  return {
    moduleName,
    source: lines.slice(1).join("\n"),
  };
}

function extractPythonModuleInfo(moduleName: string, source: string): { ok: true; info: PythonModuleInfo } | { ok: false } {
  const exports = new Set<string>();
  const importModules = new Set<string>();
  const imports: Array<{ module: string; name: string }> = [];

  const lines = source.split("\n");
  for (const line of lines) {
    const fn = line.match(/^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
    if (fn) {
      exports.add(fn[1]);
    }
    const cls = line.match(/^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:(]/);
    if (cls) {
      exports.add(cls[1]);
    }
    const assign = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*.+$/);
    if (assign && !line.includes("==")) {
      exports.add(assign[1]);
    }
    const fromImport = line.match(/^\s*from\s+([A-Za-z0-9_.]+)\s+import\s+([A-Za-z0-9_,\s]+)/);
    if (fromImport) {
      const mod = fromImport[1];
      importModules.add(mod);
      for (const name of fromImport[2].split(",").map((v) => v.trim()).filter(Boolean)) {
        imports.push({ module: mod, name });
      }
      continue;
    }
    const plainImport = line.match(/^\s*import\s+([A-Za-z0-9_.,\s]+)/);
    if (plainImport) {
      for (const mod of plainImport[1].split(",").map((v) => v.trim()).filter(Boolean)) {
        importModules.add(mod);
      }
    }
  }

  return {
    ok: true,
    info: {
      moduleName,
      exports,
      importModules,
      imports,
    },
  };
}

function findCycle(modules: Map<string, PythonModuleInfo>): string[] {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];

  function dfs(moduleName: string): string[] {
    if (visiting.has(moduleName)) {
      const start = path.indexOf(moduleName);
      return start >= 0 ? [...path.slice(start), moduleName] : [moduleName];
    }
    if (visited.has(moduleName)) {
      return [];
    }

    visiting.add(moduleName);
    path.push(moduleName);
    const moduleInfo = modules.get(moduleName);
    for (const dep of moduleInfo?.importModules ?? []) {
      if (!modules.has(dep)) {
        continue;
      }
      const cycle = dfs(dep);
      if (cycle.length > 0) {
        return cycle;
      }
    }
    path.pop();
    visiting.delete(moduleName);
    visited.add(moduleName);
    return [];
  }

  for (const moduleName of modules.keys()) {
    const cycle = dfs(moduleName);
    if (cycle.length > 0) {
      return cycle;
    }
  }
  return [];
}
