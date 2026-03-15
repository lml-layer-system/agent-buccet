import fs from "node:fs";
import path from "node:path";
import type { CodingSkeletonContract } from "@/lib/lml/coding-skeleton-laws";

export type CodingRepoContext = {
  rootDir: string;
  scannedFiles: number;
  pythonFiles: string[];
  testFiles: string[];
  moduleGraph: {
    modules: string[];
    edges: Array<{ from: string; to: string }>;
    internalImports: string[];
    hotModules: string[];
    boundaryHints: {
      entryToRoutes: string[];
      entryToServices: string[];
      routesToModels: string[];
      servicesToModels: string[];
      serviceToAuth: string[];
      routeToAuth: string[];
      entryToRuntime: string[];
      parserToTokens: string[];
      compilerStageChain: string[];
    };
  };
  conventions: {
    entrypoints: string[];
    moduleStyle: "flat" | "package" | "mixed";
    usesPytest: boolean;
    usesFastApi: boolean;
    usesSqlAlchemy: boolean;
    usesPygame: boolean;
    hasServicesModule: boolean;
    hasRoutesModule: boolean;
    hasModelsModule: boolean;
  };
  summary: string[];
};

const MAX_FILES = 160;
const MAX_DEPTH = 4;
const IGNORED_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  ".turbo",
  ".cache",
  "coverage",
  "handoff",
  "data",
]);

export function shouldUseRepoContext(question: string, contract: CodingSkeletonContract): boolean {
  const lower = question.toLowerCase();
  if (contract.family === "refactor") return true;
  return /\b(repo|repository|project|workspace|existing|current code|current app|codebase|refactor|fix this app|in this app)\b/.test(lower);
}

export function buildCodingRepoContext(args: {
  rootDir: string;
  contract: CodingSkeletonContract;
}): CodingRepoContext | null {
  if (args.contract.language !== "python") return null;
  if (!fs.existsSync(args.rootDir)) return null;

  const files: string[] = [];
  walk(args.rootDir, args.rootDir, 0, files);
  const pythonFiles = files.filter((entry) => entry.endsWith(".py"));
  if (pythonFiles.length === 0) return null;

  const testFiles = pythonFiles.filter((entry) =>
    entry.startsWith("tests/") || path.basename(entry).startsWith("test_"),
  );

  const contents = pythonFiles.slice(0, 40).map((entry) => ({
    path: entry,
    text: safeRead(path.join(args.rootDir, entry)),
  }));

  const entrypoints = ["main.py", "app.py", "__main__.py"].filter((entry) => pythonFiles.includes(entry));
  const hasPackageDirs = pythonFiles.some((entry) => entry.includes("/") && entry.endsWith("__init__.py"));
  const hasFlatTopLevel = pythonFiles.some((entry) => !entry.includes("/"));
  const moduleStyle = hasPackageDirs && hasFlatTopLevel ? "mixed" : hasPackageDirs ? "package" : "flat";

  const usesPytest = testFiles.length > 0 || contents.some((entry) => /\bpytest\b|\bdef test_/.test(entry.text));
  const usesFastApi = contents.some((entry) => /\bfrom fastapi import\b|\bfastapi\b/.test(entry.text));
  const usesSqlAlchemy = contents.some((entry) => /\bsqlalchemy\b/.test(entry.text));
  const usesPygame = contents.some((entry) => /\bpygame\b/.test(entry.text));
  const hasServicesModule = pythonFiles.some((entry) => /(^|\/)services?\.py$/.test(entry));
  const hasRoutesModule = pythonFiles.some((entry) => /(^|\/)routes?\.py$/.test(entry));
  const hasModelsModule = pythonFiles.some((entry) => /(^|\/)models?\.py$/.test(entry));

  const summary = [
    `python_files=${pythonFiles.length}`,
    `tests=${testFiles.length}`,
    `entrypoints=${entrypoints.join(",") || "none"}`,
    `module_style=${moduleStyle}`,
    `pytest=${usesPytest ? "yes" : "no"}`,
    `fastapi=${usesFastApi ? "yes" : "no"}`,
    `sqlalchemy=${usesSqlAlchemy ? "yes" : "no"}`,
    `pygame=${usesPygame ? "yes" : "no"}`,
    `services_module=${hasServicesModule ? "yes" : "no"}`,
    `routes_module=${hasRoutesModule ? "yes" : "no"}`,
    `models_module=${hasModelsModule ? "yes" : "no"}`,
  ];

  const moduleGraph = buildModuleGraph(pythonFiles, contents);
  summary.push(
    `graph_modules=${moduleGraph.modules.length}`,
    `graph_edges=${moduleGraph.edges.length}`,
    `hot_modules=${moduleGraph.hotModules.join(",") || "none"}`,
    `entry_to_routes=${moduleGraph.boundaryHints.entryToRoutes.length}`,
    `entry_to_services=${moduleGraph.boundaryHints.entryToServices.length}`,
    `routes_to_models=${moduleGraph.boundaryHints.routesToModels.length}`,
    `services_to_models=${moduleGraph.boundaryHints.servicesToModels.length}`,
    `service_to_auth=${moduleGraph.boundaryHints.serviceToAuth.length}`,
    `route_to_auth=${moduleGraph.boundaryHints.routeToAuth.length}`,
    `entry_to_runtime=${moduleGraph.boundaryHints.entryToRuntime.length}`,
    `parser_to_tokens=${moduleGraph.boundaryHints.parserToTokens.length}`,
    `compiler_stage_chain=${moduleGraph.boundaryHints.compilerStageChain.length}`,
  );

  return {
    rootDir: args.rootDir,
    scannedFiles: files.length,
    pythonFiles: pythonFiles.slice(0, 60),
    testFiles: testFiles.slice(0, 20),
    moduleGraph,
    conventions: {
      entrypoints,
      moduleStyle,
      usesPytest,
      usesFastApi,
      usesSqlAlchemy,
      usesPygame,
      hasServicesModule,
      hasRoutesModule,
      hasModelsModule,
    },
    summary,
  };
}

function walk(baseRoot: string, rootDir: string, depth: number, out: string[]): void {
  if (depth > MAX_DEPTH || out.length >= MAX_FILES) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (out.length >= MAX_FILES) return;
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      walk(baseRoot, path.join(rootDir, entry.name), depth + 1, out);
      continue;
    }
    out.push(path.relative(baseRoot, path.join(rootDir, entry.name)));
  }
}

function safeRead(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8").slice(0, 4000);
  } catch {
    return "";
  }
}

function buildModuleGraph(
  pythonFiles: string[],
  contents: Array<{ path: string; text: string }>,
): CodingRepoContext["moduleGraph"] {
  const modules = pythonFiles
    .map(toModuleName)
    .filter((value): value is string => Boolean(value));
  const moduleSet = new Set(modules);
  const edges: Array<{ from: string; to: string }> = [];
  const edgeCount = new Map<string, number>();

  for (const entry of contents) {
    const from = toModuleName(entry.path);
    if (!from) continue;
    for (const imported of extractPythonImports(entry.text)) {
      const to = normalizeImport(imported);
      if (!to || !moduleSet.has(to)) continue;
      edges.push({ from, to });
      edgeCount.set(to, (edgeCount.get(to) ?? 0) + 1);
    }
  }

  const internalImports = unique(edges.map((edge) => edge.to));
  const hotModules = [...edgeCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name]) => name);
  const boundaryHints = {
    entryToRoutes: edges.filter((edge) => isEntrypoint(edge.from) && /(^|\.)(routes?)$/.test(edge.to)).map((edge) => `${edge.from}->${edge.to}`),
    entryToServices: edges.filter((edge) => isEntrypoint(edge.from) && /(^|\.)(services?)$/.test(edge.to)).map((edge) => `${edge.from}->${edge.to}`),
    routesToModels: edges.filter((edge) => /(^|\.)(routes?)$/.test(edge.from) && /(^|\.)(models?)$/.test(edge.to)).map((edge) => `${edge.from}->${edge.to}`),
    servicesToModels: edges.filter((edge) => /(^|\.)(services?)$/.test(edge.from) && /(^|\.)(models?)$/.test(edge.to)).map((edge) => `${edge.from}->${edge.to}`),
    serviceToAuth: edges.filter((edge) => /(^|\.)(services?)$/.test(edge.from) && /(^|\.)(auth|auth_service|security)$/.test(edge.to)).map((edge) => `${edge.from}->${edge.to}`),
    routeToAuth: edges.filter((edge) => /(^|\.)(routes?)$/.test(edge.from) && /(^|\.)(auth|auth_service|security)$/.test(edge.to)).map((edge) => `${edge.from}->${edge.to}`),
    entryToRuntime: edges.filter((edge) => isEntrypoint(edge.from) && /(^|\.)(loop|runtime|state|entities)$/.test(edge.to)).map((edge) => `${edge.from}->${edge.to}`),
    parserToTokens: edges.filter((edge) => /(^|\.)(parser|lexer)$/.test(edge.from) && /(^|\.)(tokens?|ast_nodes?)$/.test(edge.to)).map((edge) => `${edge.from}->${edge.to}`),
    compilerStageChain: edges.filter((edge) => /(^|\.)(frontend|lexer|parser)$/.test(edge.from) && /(^|\.)(backend|emit|emitter|ast_nodes?|tokens?)$/.test(edge.to)).map((edge) => `${edge.from}->${edge.to}`),
  };

  return {
    modules,
    edges,
    internalImports,
    hotModules,
    boundaryHints,
  };
}

function toModuleName(relPath: string): string | null {
  if (!relPath.endsWith(".py")) return null;
  if (path.basename(relPath) === "__init__.py") {
    const dir = path.dirname(relPath);
    return dir === "." ? null : dir.replace(/\//g, ".");
  }
  return relPath.replace(/\.py$/, "").replace(/\//g, ".");
}

function extractPythonImports(text: string): string[] {
  const imports: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    const importMatch = trimmed.match(/^import\s+([A-Za-z0-9_.,\s]+)/);
    if (importMatch) {
      for (const part of importMatch[1].split(",")) {
        const cleaned = part.trim().split(/\s+as\s+/i)[0];
        if (cleaned) imports.push(cleaned);
      }
      continue;
    }
    const fromMatch = trimmed.match(/^from\s+([A-Za-z0-9_.]+)\s+import\s+/);
    if (fromMatch) {
      imports.push(fromMatch[1]);
    }
  }
  return imports;
}

function normalizeImport(value: string): string | null {
  const cleaned = value.replace(/^\.+/, "");
  return cleaned || null;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isEntrypoint(moduleName: string): boolean {
  return /(^|\.)(main|app|__main__)$/.test(moduleName);
}
