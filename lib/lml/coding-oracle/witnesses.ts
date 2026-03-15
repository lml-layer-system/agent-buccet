import type { CodingSkeletonContract } from "../coding-skeleton-laws.ts";
import { getCodingOracleFamily, hasCodingOracleFamily } from "./index.ts";
import type { OracleFamilyDefinition, OracleGraphVariant } from "./types.ts";

export type OracleWitnessValidation = {
  ok: boolean;
  family: string | null;
  variantId: string | null;
  files: Array<{ path: string; body: string }>;
  passed: string[];
  failed: string[];
  reason: string;
};

export function validateOracleWitnesses(args: {
  contract: CodingSkeletonContract;
  text: string;
}): OracleWitnessValidation {
  const family = args.contract.family;
  if (!hasCodingOracleFamily(family)) {
    return {
      ok: true,
      family: null,
      variantId: null,
      files: [],
      passed: [],
      failed: [],
      reason: "oracle_not_applicable",
    };
  }

  const oracle = getCodingOracleFamily(family);
  const files = parseOracleFiles(args.text);
  if (files.length === 0) {
    return {
      ok: false,
      family,
      variantId: null,
      files,
      passed: [],
      failed: ["ORACLE.FILESET:missing_fenced_files"],
      reason: "oracle_failed:missing_fenced_files",
    };
  }

  const variant = chooseBestVariant(oracle, files);
  const passed: string[] = [];
  const failed: string[] = [];

  for (const node of variant.files.filter((candidate) => candidate.required)) {
    const matched = files.some((file) => pathMatchesPattern(file.path, node.path));
    if (!matched) {
      failed.push(`ORACLE.FILESET:missing_required:${node.path}`);
    } else {
      passed.push(`ORACLE.FILESET:present:${node.path}`);
    }
  }

  for (const contract of oracle.exportContracts) {
    const contractRelevant = variant.files.some((node) => pathMatchesPattern(node.path, contract.file) || pathMatchesPattern(contract.file, node.path));
    if (!contractRelevant) {
      continue;
    }
    const matchedFiles = files.filter((file) => pathMatchesPattern(file.path, contract.file));
    if (matchedFiles.length === 0) {
      failed.push(`ORACLE.EXPORT:missing_file:${contract.file}`);
      continue;
    }
    for (const symbol of contract.mustExport) {
      const symbolMatched = matchedFiles.some((file) => matchesOracleExportSymbol(file.body, symbol));
      if (!symbolMatched) {
        failed.push(`ORACLE.EXPORT:missing_symbol:${contract.file}:${symbol}`);
      } else {
        passed.push(`ORACLE.EXPORT:present_symbol:${contract.file}:${symbol}`);
      }
    }
  }

  const roleMap = buildRoleMap(variant, files);
  for (const contract of oracle.importContracts) {
    const sourceFiles = roleMap.get(contract.from) ?? [];
    const targetFiles = roleMap.get(contract.to) ?? [];
    if (sourceFiles.length === 0 || targetFiles.length === 0) {
      continue;
    }
    const targetTokens = targetFiles.flatMap((file) => moduleTokensForPath(file.path));
    const matched = sourceFiles.some((file) =>
      targetTokens.some((token) =>
        new RegExp(`\\b(from|import)\\s+${escapeRegex(token)}\\b`).test(file.body)
        || file.body.includes(token),
      ),
    );
    if (/forbidden/i.test(contract.rule)) {
      if (matched) {
        failed.push(`ORACLE.IMPORT:forbidden:${contract.from}->${contract.to}`);
      } else {
        passed.push(`ORACLE.IMPORT:forbidden_clear:${contract.from}->${contract.to}`);
      }
    } else if (!matched) {
      failed.push(`ORACLE.IMPORT:missing:${contract.from}->${contract.to}`);
    } else {
      passed.push(`ORACLE.IMPORT:present:${contract.from}->${contract.to}`);
    }
  }

  applyFamilyOracleChecks(args.contract.family, variant, files, passed, failed);

  return {
    ok: failed.length === 0,
    family,
    variantId: variant.id,
    files,
    passed,
    failed,
    reason: failed.length === 0 ? "ok" : `oracle_failed:${failed[0]}`,
  };
}

function applyFamilyOracleChecks(
  family: CodingSkeletonContract["family"],
  variant: OracleGraphVariant,
  files: Array<{ path: string; body: string }>,
  passed: string[],
  failed: string[],
): void {
  const joined = files.map((file) => file.body).join("\n").toLowerCase();
  const tests = files.filter((file) => /(^tests\/|test_.*\.py$)/.test(file.path));
  const testJoined = tests.map((file) => file.body).join("\n").toLowerCase();

  if (family === "api") {
    if (/response_model\s*=/.test(joined)) passed.push("ORACLE.API:response_model");
    else failed.push("ORACLE.API:missing_response_model");
    if (/from .*service.* import|return .*service/.test(joined)) passed.push("ORACLE.API:service_delegate");
    else failed.push("ORACLE.API:missing_service_delegate");
    if (/status_code\s*==\s*200/.test(testJoined)) passed.push("ORACLE.API:test_status_assert");
    else failed.push("ORACLE.API:missing_status_assert");
    if (/response\.json\(\)\s*==|response\.json\(\)\[['"]/.test(testJoined)) passed.push("ORACLE.API:test_response_assert");
    else failed.push("ORACLE.API:missing_response_assert");
    if (/try:\s*[\s\S]*except\s*:\s*pass|global_db_session|json\.loads\(/.test(joined)) failed.push("ORACLE.API:forbidden_surface");
    else passed.push("ORACLE.API:forbidden_clear");
  }

  if (family === "app") {
    if (/(export\s+default\s+async\s+function\s+page|export\s+default\s+function\s+page)/i.test(joined)) passed.push("ORACLE.APP:page_surface");
    else failed.push("ORACLE.APP:missing_page_surface");
    const hasBoundarySurface =
      /['"]use client['"]|['"]use server['"]/.test(joined)
      || /\bexport\s+async\s+function\s+generatemetadata\b/.test(joined)
      || /\bexport\s+async\s+function\s+post\s*\(/.test(joined)
      || /\bsearchparams\b/.test(joined)
      || /\bfrom\s+['"]next\/link['"]/.test(joined)
      || /\brevalidatepath\(/.test(joined);
    if (variant.id === "minimal") {
      if (hasBoundarySurface) passed.push("ORACLE.APP:boundary_surface");
      else failed.push("ORACLE.APP:missing_boundary_surface");
    } else if ((/['"]use client['"]/.test(joined) && /['"]use server['"]/.test(joined)) || hasBoundarySurface) {
      passed.push("ORACLE.APP:boundary_surface");
    } else {
      failed.push("ORACLE.APP:missing_boundary_surface");
    }
    if (variant.id === "minimal") {
      passed.push("ORACLE.APP:dto_mapping_not_required");
    } else if (
      /toISOString\(\)|return <clienttable data=\{safeorders\}/i.test(joined)
      || /safe\w+\s*=\s*\w+\.map\(/.test(joined)
      || /useformstate\(|usetransition\(|revalidatepath\(/.test(joined)
      || /\bexport\s+async\s+function\s+generatemetadata\b/.test(joined)
      || /\bexport\s+async\s+function\s+post\s*\(/.test(joined)
      || /\bgetitemspage\(|\bparsepageparam\(/.test(joined)
    ) {
      passed.push("ORACLE.APP:dto_mapping");
    } else {
      failed.push("ORACLE.APP:missing_dto_mapping");
    }
    if (/process\.env\.[a-z0-9_]+[\s\S]{0,160}<\w+[a-z0-9_]*\s+[a-z0-9_]+=\{process\.env\./i.test(joined)) failed.push("ORACLE.APP:secret_boundary_leak");
    else passed.push("ORACLE.APP:secret_boundary_clear");
  }

  if (family === "auth") {
    if (/decode_strict_token|create_access_token|authenticate_user/.test(joined)) passed.push("ORACLE.AUTH:token_surface");
    else failed.push("ORACLE.AUTH:missing_token_surface");
    if (/(assert .*['"]sub['"]|assert .*['"]exp['"]|decode_strict_token\()/i.test(testJoined + joined)) passed.push("ORACLE.AUTH:sub_exp_witness");
    else failed.push("ORACLE.AUTH:missing_sub_exp_witness");
    if (/jwt\.decode\([^)]*verify\s*=\s*false|pickle|password.*print|localstorage/.test(joined)) failed.push("ORACLE.AUTH:forbidden_surface");
    else passed.push("ORACLE.AUTH:forbidden_clear");
  }

  if (family === "compiler") {
    if (/def\s+lex\(|def\s+parse\(|def\s+(emit|emit_ir)\(/.test(joined)) passed.push("ORACLE.COMPILER:pipeline_surface");
    else failed.push("ORACLE.COMPILER:missing_pipeline_surface");
    if (/exec\(|eval\(|__import__\(/.test(joined)) failed.push("ORACLE.COMPILER:forbidden_dynamic_execution");
    else passed.push("ORACLE.COMPILER:forbidden_clear");
  }

  if (family === "game") {
    if (/clock\.tick\(60\)|clock\.tick\(/.test(joined)) passed.push("ORACLE.GAME:tick_surface");
    else failed.push("ORACLE.GAME:missing_tick_surface");
    if (/test_.*move|assert .*>\s*old_/.test(testJoined)) passed.push("ORACLE.GAME:movement_witness");
    else failed.push("ORACLE.GAME:missing_movement_witness");
    if (/time\.sleep\(/.test(joined)) failed.push("ORACLE.GAME:forbidden_surface");
    else passed.push("ORACLE.GAME:forbidden_clear");
  }

  if (family === "orm") {
    if (/session\.add\(|session\.commit\(|session\.get\(/.test(joined)) passed.push("ORACLE.ORM:crud_surface");
    else failed.push("ORACLE.ORM:missing_crud_surface");
    if (/assert .*session\.get\(/.test(testJoined) || /stored\s*=\s*session\.get\(/.test(testJoined) || /assert .*same object/.test(testJoined)) passed.push("ORACLE.ORM:identity_witness");
    else failed.push("ORACLE.ORM:missing_identity_witness");
    if (/commit\(\)\s*\n\s*for\s|execute\(f['"]|select \* from /.test(joined)) failed.push("ORACLE.ORM:forbidden_surface");
    else passed.push("ORACLE.ORM:forbidden_clear");
  }

  if (family === "refactor") {
    if (/def\s+test_/.test(testJoined)) passed.push("ORACLE.REFACTOR:test_surface");
    else failed.push("ORACLE.REFACTOR:missing_test_surface");
    if (/assert .*==/.test(testJoined)) passed.push("ORACLE.REFACTOR:behavior_assert");
    else failed.push("ORACLE.REFACTOR:missing_behavior_assert");
    if (/print\(|def test_[\s\S]*print\(|delete.*test/.test(joined + testJoined)) failed.push("ORACLE.REFACTOR:forbidden_surface");
    else passed.push("ORACLE.REFACTOR:forbidden_clear");
  }
}

function parseOracleFiles(text: string): Array<{ path: string; body: string }> {
  const lines = text.split(/\r?\n/);
  const files: Array<{ path: string; body: string }> = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]?.trim() ?? "";
    if (!line.startsWith("```")) {
      i += 1;
      continue;
    }

    const body: string[] = [];
    i += 1;
    while (i < lines.length && !lines[i].trim().startsWith("```")) {
      body.push(lines[i]);
      i += 1;
    }
    const first = body.find((entry) => entry.trim().length > 0)?.trim() ?? "";
    const match = first.match(/^#\s+(.+\.(py|ts|tsx|js|jsx|css))$/);
    if (match) {
      const fileBody = body.slice(1).join("\n").trim();
      files.push({ path: match[1], body: fileBody });
    }
    i += 1;
  }
  return files;
}

function chooseBestVariant(
  oracle: OracleFamilyDefinition,
  files: Array<{ path: string; body: string }>,
): OracleGraphVariant {
  const scored = oracle.variants.map((variant) => {
    const required = variant.files.filter((node) => node.required);
    const requiredMatched = required.filter((node) =>
      files.some((file) => pathMatchesPattern(file.path, node.path))
    ).length;
    const requiredMissing = required.length - requiredMatched;
    const totalMatched = variant.files.filter((node) =>
      files.some((file) => pathMatchesPattern(file.path, node.path))
    ).length;
    return {
      variant,
      requiredMissing,
      requiredMatched,
      totalMatched,
    };
  });
  return scored.sort((a, b) =>
    a.requiredMissing - b.requiredMissing
    || b.requiredMatched - a.requiredMatched
    || b.totalMatched - a.totalMatched
  )[0]?.variant ?? oracle.variants[0];
}

function buildRoleMap(
  variant: OracleGraphVariant,
  files: Array<{ path: string; body: string }>,
): Map<string, Array<{ path: string; body: string }>> {
  const map = new Map<string, Array<{ path: string; body: string }>>();
  for (const node of variant.files) {
    const matched = files.filter((file) => pathMatchesPattern(file.path, node.path));
    if (matched.length > 0) {
      map.set(node.role, matched);
    }
  }
  return map;
}

function pathMatchesPattern(path: string, pattern: string): boolean {
  const normalizedPath = normalizeComparablePath(path);
  const normalizedPattern = normalizeComparablePath(pattern);
  if (normalizedPattern.endsWith("/")) {
    const directoryStem = normalizedPattern.slice(0, -1);
    return normalizedPath.startsWith(normalizedPattern) || normalizedPath.startsWith(directoryStem);
  }
  if (pattern.endsWith("/")) {
    return path.startsWith(pattern);
  }
  const regex = new RegExp(
    "^" + normalizedPattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]+") + "$",
  );
  return regex.test(normalizedPath);
}

function normalizeComparablePath(value: string): string {
  return value
    .replace(/^(api|compiler)\//, "");
}

function moduleTokensForPath(path: string): string[] {
  const noExt = path.replace(/\.(py|ts|tsx|js|jsx)$/, "");
  const parts = noExt.split("/").filter(Boolean);
  const tokens = new Set<string>();
  const last = parts[parts.length - 1];
  if (last) tokens.add(last);
  if (parts.length > 1) {
    tokens.add(parts.join("."));
    tokens.add(parts.slice(-2).join("."));
    tokens.add(parts.join("/"));
    tokens.add(parts.slice(-2).join("/"));
    if (parts[0] === "src") {
      tokens.add(parts.slice(1).join("/"));
      tokens.add(`@/${parts.slice(1).join("/")}`);
    }
  }
  return [...tokens].filter(Boolean);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


function matchesOracleExportSymbol(body: string, symbol: string): boolean {
  if (body.includes(symbol)) return true;
  const alternatives = symbol.split(/\s+or\s+/i).map((part) => part.trim()).filter(Boolean);
  if (alternatives.length > 1) {
    return alternatives.some((alt) => matchesOracleExportSymbol(body, alt));
  }
  const snake = symbol
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
  if (snake !== symbol.toLowerCase() && body.includes(snake)) {
    return true;
  }
  if (/AST node dataclasses/i.test(symbol)) {
    return /@dataclass|dataclass\(.*\)|class\s+[A-Z][A-Za-z0-9_]*Node/.test(body);
  }
  if (/Base-derived ORM models/i.test(symbol)) {
    return /class\s+[A-Z][A-Za-z0-9_]*\([^)]*Base[^)]*\)|__tablename__\s*=/.test(body);
  }
  if (/mapped model classes/i.test(symbol)) {
    return /class\s+[A-Z][A-Za-z0-9_]*\([^)]*Base[^)]*\)|__tablename__\s*=/.test(body);
  }
  if (/business service surface/i.test(symbol)) {
    return /def\s+[a-z0-9_]+\(|class\s+[A-Z][A-Za-z0-9_]*Service/.test(body);
  }
  if (/service functions/i.test(symbol)) {
    return /def\s+[a-z0-9_]+\(|class\s+[A-Z][A-Za-z0-9_]*Service/.test(body);
  }
  if (/repository class or functions returning schemas/i.test(symbol)) {
    return /def\s+(create_|list_|get_)[a-z0-9_]*\(|class\s+[A-Z][A-Za-z0-9_]*Repository/.test(body);
  }
  if (/Pydantic schema surface/i.test(symbol)) {
    return /class\s+[A-Z][A-Za-z0-9_]*\([^)]*BaseModel[^)]*\)|class\s+[A-Z][A-Za-z0-9_]*Schema/.test(body);
  }
  if (/BaseModel-derived schemas/i.test(symbol)) {
    return /class\s+[A-Z][A-Za-z0-9_]*\([^)]*BaseModel[^)]*\)|class\s+[A-Z][A-Za-z0-9_]*Schema/.test(body);
  }
  if (/UpdateSchema/.test(symbol)) {
    return /class\s+[A-Z][A-Za-z0-9_]*UpdateSchema/.test(body);
  }
  if (/repository/i.test(symbol)) {
    return /class\s+[A-Z][A-Za-z0-9_]*Repository|def\s+(create_|list_|get_)[a-z0-9_]*\(/.test(body);
  }
  if (/default Page/i.test(symbol)) {
    return /export\s+default\s+(async\s+)?function\s+Page/.test(body);
  }
  if (/default RootLayout/i.test(symbol)) {
    return /export\s+default\s+function\s+RootLayout/.test(body);
  }
  if (/hook functions/i.test(symbol)) {
    return /export\s+function\s+use[A-Z][A-Za-z0-9_]+/.test(body);
  }
  if (/transport functions/i.test(symbol)) {
    return /export\s+(async\s+)?function\s+[A-Za-z0-9_]+/.test(body);
  }
  return false;
}
