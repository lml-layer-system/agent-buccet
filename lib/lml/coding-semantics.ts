import type { CodingIntentSpec } from "@/lib/lml/coding-intent-spec";
import type { CodingSkeletonContract } from "@/lib/lml/coding-skeleton-laws";

export const CODING_SEMANTIC_LAWS = [
  "ABILITY.CODING.59: Coding families require semantic legality in addition to substrate, witness, floor, and architecture legality.",
  "ABILITY.CODING.60: API and app families must preserve route contract, response shape, and declared dependency surface before emission.",
  "ABILITY.CODING.61: Refactor families must preserve declared behavior, import binding, and covered surface unless explicit change is requested.",
  "ABILITY.CODING.62: ORM families must preserve explicit model identity, table/model shape, and CRUD binding semantics before emission.",
  "ABILITY.CODING.63: Compiler and game families must preserve pipeline/runtime semantics, not just superficial tokens, before emission.",
  "ABILITY.CODING.171: Public app metadata must not touch draft or stale content paths when preview is disabled; page and metadata must share the lawful server truth source.",
  "ABILITY.CODING.172: App search and docs routes must preserve server-hydration semantic alignment and must not hide dynamic-mode escape hatches inside helpers.",
  "ABILITY.CODING.173: Multi-tenant app billing reads must derive tenant identity from authenticated server context and must not trust foreign selectors over session scope.",
] as const;

export type CodingSemanticValidation = {
  ok: boolean;
  reason: string;
  passed: string[];
  failed: string[];
};

export function validateCodingSemantics(args: {
  contract: CodingSkeletonContract;
  intentSpec: CodingIntentSpec;
  text: string;
}): CodingSemanticValidation {
  const lower = args.text.toLowerCase();
  const passed: string[] = [];
  const failed: string[] = [];
  const intentAnchors = buildIntentAnchors(args.intentSpec);

  if (args.contract.family === "api") {
    if (/@(app|router)\.(get|post|put|delete|patch)\b/.test(lower)) passed.push("api_route_contract");
    else failed.push("integration_failed:I2.2_API_ROUTE_SURFACE");

    if (/return\s+\{[^}]*status[^}]*\}/.test(lower) || /response\.json\(\)\[['"]status['"]\]/.test(lower)) passed.push("api_response_contract");
    else failed.push("api_response_contract");

    const includePrefix = lower.match(/include_router\([^)]*prefix=['"]([^'"]+)['"]/)?.[1] ?? "";
    const testedPath = lower.match(/client\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]\)/)?.[2];
    const routePaths = [...lower.matchAll(/@(app|router)\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g)].map((match) => match[3]);
    const candidatePaths = new Set<string>();
    for (const routePath of routePaths) {
      if (!routePath) continue;
      candidatePaths.add(routePath);
      const normalized = normalizeRoutePath(includePrefix, routePath);
      if (normalized) candidatePaths.add(normalized);
    }
    if (testedPath && candidatePaths.has(testedPath)) passed.push("api_route_alignment");
    else failed.push("semantic_failed:api_route_alignment");

    const testedKey = lower.match(/response\.json\(\)\[['"]([^'"]+)['"]\]/)?.[1];
    if (!testedKey || new RegExp(`return\\s+\\{[^}]*${escapeRegex(testedKey)}[^}]*\\}`).test(lower)) passed.push("api_response_alignment");
    else failed.push("semantic_failed:api_response_alignment");

    const apiSchemaBypass =
      /@(app|router)\.(get|post|put|delete|patch)[\s\S]{0,240}response_model\s*=\s*\w+[\s\S]{0,240}return\s+\{/.test(lower)
      || /@(app|router)\.(get|post|put|delete|patch)[\s\S]{0,240}response_model\s*=\s*\w+[\s\S]{0,240}return\s+(user|item|entity|model)\b/.test(lower);
    if (apiSchemaBypass) failed.push("semantic_failed:api_contract_breach");
    else passed.push("api_contract_breach");
  }

  if (args.contract.family === "app") {
    const boundaryLeak =
      /return <[A-Z][A-Za-z0-9_]*\s+\w+=\{\w+\}\s*\/>/.test(args.text)
      && /(password_hash|stripechargeid|secret_key|secret)/i.test(args.text)
      && !/process\.env\./i.test(args.text)
      && !/\.map\(\s*\(\w+\)\s*=>\s*\(\{[\s\S]*toISOString\(\)/.test(args.text);
    if (boundaryLeak) failed.push("semantic_failed:app_boundary_leak");
    else passed.push("app_boundary_leak");

    const serializationBlock =
      /return <[A-Z][A-Za-z0-9_]*\s+\w+=\{[^}]*new Date\(/.test(args.text)
      || /return <[A-Z][A-Za-z0-9_]*\s+\w+=\{[^}]*(new Map|new Set|\(\)\s*=>)/.test(args.text);
    if (serializationBlock) failed.push("semantic_failed:app_serialization_block");
    else passed.push("app_serialization_block");

    const optimisticBlocking =
      /\buseState\(/.test(args.text)
      && /const\s+\w+\s*=\s*async\s*\(\)\s*=>[\s\S]{0,220}await\s+[A-Za-z0-9_]+/.test(args.text)
      && /setLikes\(|set[A-Z][A-Za-z0-9_]+\(/.test(args.text)
      && !/\buseOptimistic\(/.test(args.text);
    if (optimisticBlocking) failed.push("semantic_failed:app_optimistic_blocking");
    else passed.push("app_optimistic_blocking");

    const rscStateLeak =
      /['"]use client['"]/.test(args.text)
      && /\buseState(?:<[^>]+>)?\(/.test(args.text)
      && /\buseEffect\(/.test(args.text)
      && (/fetch\([^)]*page=/.test(args.text) || /\bclientSearch\(/.test(args.text));
    if (rscStateLeak) failed.push("semantic_failed:app_rsc_state_leak");
    else passed.push("app_rsc_state_leak");

    const seoSsrMiss =
      /['"]use client['"]/.test(args.text)
      && /\buseEffect\(/.test(args.text)
      && /document\.title\s*=/.test(args.text)
      && !/\bexport\s+async\s+function\s+generateMetadata\b/.test(args.text);
    if (seoSsrMiss) failed.push("semantic_failed:app_seo_ssr_miss");
    else passed.push("app_seo_ssr_miss");

    const previewMetadataDrift =
      /\bexport\s+async\s+function\s+generateMetadata\b/.test(args.text)
      && /\bgetDraftBySlug\(/.test(args.text)
      && /\blegacyGetPostForMetadata\(/.test(args.text)
      && /\bdraft\s*\?\?\s*stale\s*\?\?\s*published/.test(lower);
    if (previewMetadataDrift) failed.push("semantic_failed:app_preview_metadata_drift");
    else passed.push("app_preview_metadata_drift");

    const tenantIsolationBreach =
      /\bgetBillingSummary\(\s*params\.tenantId\s*\?\?\s*session\.tenantId\s*\)/.test(args.text)
      || /\bgetBillingSummary\(\s*searchParams\.tenantId\s*\?\?\s*session\.tenantId\s*\)/.test(args.text);
    if (tenantIsolationBreach) failed.push("semantic_failed:app_tenant_isolation_breach");
    else passed.push("app_tenant_isolation_breach");

    const actionAuthBypass =
      /['"]use server['"][\s\S]{0,260}export\s+async\s+function\s+\w+\([^)]*(userid|role|accountid)[^)]*\)/i.test(args.text)
      && !/getsession\(|auth\(|cookies\(/i.test(args.text);
    const webhookSigBypass =
      /export\s+async\s+function\s+post\s*\(\s*req:\s*request\s*\)/i.test(lower)
      && /await\s+req\.json\(\)/.test(lower)
      && !/constructevent\(/.test(lower);

    if (/['"]use server['"]|getsession\(|revalidatepath\(|fetchorders\(|useoptimistic\(|searchparams|generateMetadata|export\s+async\s+function\s+post\s*\(|getitemspage\(|parsepageparam\(|getpostbyslug\(|handlestripeevent\(/i.test(args.text) || actionAuthBypass || webhookSigBypass) passed.push("app_service_binding");
    else failed.push("app_service_binding");

    if (/@testing-library\/react|\btest\(|\bit\(|\bexpect\(screen\.getbyrole\b|\brendertostaticmarkup\b|\bres\.status\b|\bnpm run build\b|\bgeneratemetadata\s*\(/.test(lower)) passed.push("app_test_surface");
    else failed.push("integration_failed:I2.5_APP_TEST_SURFACE");

    if (/safe\w+\s*=\s*\w+\.map\(/.test(lower) && /return <[a-z][a-z0-9_]*\s+data=\{safe/i.test(lower)) passed.push("app_route_service_alignment");
    else if (/useformstate|useformstatus|revalidatepath\(|useoptimistic\(|searchparams|generateMetadata|export\s+async\s+function\s+post\s*\(|getitemspage\(|parsepageparam\(|getpostbyslug\(|handlestripeevent\(/i.test(args.text) || actionAuthBypass || webhookSigBypass) passed.push("app_route_service_alignment");
    else failed.push("semantic_failed:app_route_service_alignment");

    if (
      /toisostring\(\)/.test(lower)
      || /success:\s*true/.test(lower)
      || /message:\s*['"`]/.test(lower)
      || /metadata>/.test(lower)
      || /title:\s*['"`]/.test(lower)
      || /new response\(/.test(lower)
      || /response\.json\(/.test(lower)
      || /\bhref=\{`?\?page=\$\{/.test(args.text)
      || /\bparsepageparam\(|\bgetitemspage\(/.test(lower)
      || /['"]use server['"][\s\S]{0,260}\bdb\.[a-z0-9_]+\.(update|delete|create)\(/.test(args.text)
      || /unauthorized|forbidden/.test(lower)
    ) {
      passed.push("app_model_payload_alignment");
    } else {
      failed.push("semantic_failed:app_model_payload_alignment");
    }
  }

  if (args.contract.family === "refactor") {
    if (/\bdef parse_source\(|\bdef analyze_scopes\(|\bdef build_transform_plan\(/.test(lower)) passed.push("refactor_import_binding");
    else failed.push("semantic_failed:refactor_import_binding");

    if (/\bdef run_behavior_preservation_truth\(|\bdef test_behavior_equivalence\(/.test(lower)) passed.push("refactor_behavior_preserved");
    else failed.push("semantic_failed:refactor_behavior_preserved");

    if (/def apply_transform_plan\([^)]*\)[\s\S]*clone_tree_immutable\(/.test(lower) && /\bdef emit_source\(/.test(lower)) passed.push("refactor_delegate_alignment");
    else failed.push("semantic_failed:refactor_delegate_alignment");

    if (/\.replace\(|re\.sub\(/.test(lower)) failed.push("semantic_failed:refactor_inline_logic_leak");
    else passed.push("refactor_inline_logic_removed");
  }

  if (args.contract.family === "orm") {
    if (/__tablename__|mapped_column|declarativebase/.test(lower)) passed.push("orm_model_identity");
    else failed.push("orm_model_identity");

    if (/\bsession\.add\(|session\.commit\(|session\.get\(|\bselect\(/.test(lower)) passed.push("orm_crud_binding");
    else failed.push("semantic_failed:orm_crud_binding");

    if (
      (/class item\(/.test(lower) && /create_item\([^)]*\)[\s\S]*session\.add\(item\)/.test(lower) && /list_items\([^)]*\)/.test(lower))
      || (/class user/.test(lower) && /create_user\([^)]*\)[\s\S]*session\.add\(user\)/.test(lower) && /list_users\([^)]*\)/.test(lower))
      || (/session\.get\(/.test(lower) && /session\.commit\(/.test(lower))
    ) {
      passed.push("orm_model_action_alignment");
    } else {
      failed.push("semantic_failed:orm_model_action_alignment");
    }

    const ormSessionLeak =
      /with\s+db_session\(\)\s+as\s+session:[\s\S]{0,320}(user|item|entity)\s*=\s*session\.(query|get)\([\s\S]{0,200}\n\s*return\s+\1\b/.test(lower)
      || /session\.close\(\)[\s\S]{0,120}return\s+(user|item|entity)\b/.test(lower);
    if (ormSessionLeak) failed.push("semantic_failed:orm_session_leak");
    else passed.push("orm_session_leak");
  }

  if (args.contract.family === "compiler") {
    if (/\blex|lexer|parse|parser|emit|ir|ast\b/.test(lower)) passed.push("compiler_pipeline_surface");
    else failed.push("compiler_pipeline_surface");

    if (
      (/def parse\(tokens:/.test(lower) && /tokens\s*=\s*lex\(/.test(lower) && /nodes\s*=\s*parse\(tokens\)/.test(lower))
      || (/def parse\(source:/.test(lower) && /for token in lex\(source\)/.test(lower) && /nodes\s*=\s*parse\(/.test(lower))
      || (/def lex\(source:/.test(lower) && /def parse\(source:/.test(lower) && /return \{'tokens': lex\(source\)\}/.test(lower) && /def emit_ir\(source:/.test(lower))
      || (/def parse\(source:/.test(lower) && /return \[valuenode\(value=token\.value\) for token in tokenize\(source\)\]/.test(lower))
    ) {
      passed.push("compiler_stage_linkage");
    } else {
      failed.push("semantic_failed:compiler_stage_linkage");
    }

    const astFidelityLoss =
      /except\s+(parseerror|unknowntokenerror)\s*:\s*pass/.test(lower)
      || /except\s+(parseerror|unknowntokenerror)\s*:\s*self\.advance\(\)/.test(lower);
    if (astFidelityLoss) failed.push("semantic_failed:ast_fidelity_loss");
    else passed.push("ast_fidelity_loss");
  }

  if (args.contract.family === "game") {
    if (/\bpygame\.quit\(\)|event\.type\s*==\s*pygame\.quit|clock\.tick\(/.test(lower)) passed.push("game_runtime_surface");
    else failed.push("integration_failed:I2.8_GAME_RUNTIME_DEPENDENCY_SURFACE");

    if (
      (/while state\.running:[\s\S]*update\(state\)[\s\S]*render\(state\)[\s\S]*clock\.tick\(/.test(lower)
        && (/state\s*=\s*reset_state\(\)/.test(lower) || /def reset_state\(\)/.test(lower)))
      || (/while state\.running:[\s\S]*update_simulation\(state\)[\s\S]*render_frame\(state\)[\s\S]*clock\.tick\(/.test(lower)
        && /def handle_input\(state: gamestate, action: str = 'move_right'\)/.test(lower)
        && /player_x/.test(lower))
      || (/while running:[\s\S]*update\(\)[\s\S]*render\(screen\)[\s\S]*clock\.tick\(/.test(lower) && /pygame\.quit\(\)/.test(lower))
    ) {
      passed.push("game_loop_alignment");
    } else {
      failed.push("semantic_failed:game_loop_alignment");
    }

    const gameLoopDrift =
      /def\s+\w+\([^)]*dt[^)]*\):[\s\S]{0,240}(position|player)\.x\s*\+=\s*[^*\n]+$/.test(lower)
      || /def\s+\w+\([^)]*dt[^)]*\):[\s\S]{0,240}\.position\.x\s*\+=\s*entity\.speed(?!\s*\*\s*dt)/.test(lower)
      || /def\s+update_player\([^)]*\):\s*player\.x\s*\+=\s*\d+/.test(lower);
    if (gameLoopDrift) failed.push("semantic_failed:game_loop_drift");
    else passed.push("game_loop_drift");
  }

  if (args.contract.family === "parser") {
    const parserAligned =
      (/def parse\(source:/.test(lower) && /for token in tokenize\(source\)/.test(lower) && /assert values == \['a', 'b', 'c'\]/.test(lower))
      || (/def parse\(source:/.test(lower) && /for token in tokenize\(source\)/.test(lower) && /\[node\.value for node in values\] == \['a', 'b', 'c'\]/.test(lower))
      || (/def tokenize\(expr:/.test(lower) && /assert tokenize\('1 \+ 2\*\(3-4\)'\) == \['1', '\+', '2', '\*', '\(', '3', '-', '4', '\)'\]/.test(lower))
      || (/def tokenize\(source:/.test(lower) && /def parse\(source:/.test(lower) && /assert values == \['a', 'b', 'c'\]/.test(lower));
    if (parserAligned) passed.push("parser_pipeline_alignment");
    else failed.push("semantic_failed:parser_pipeline_alignment");
  }

  if (intentAnchors.length > 0) {
    const anchorHits = intentAnchors.filter((anchor) => lower.includes(anchor)).length;
    if (anchorHits > 0) passed.push("intent_anchor_alignment");
    else if (requiresIntentAnchors(args.contract.family, args.intentSpec.identity.domain)) failed.push("semantic_failed:intent_anchor_alignment");
  }

  return {
    ok: failed.length === 0,
    reason: failed.length === 0
      ? "ok"
      : failed[0].includes(":")
        ? failed[0]
        : `semantic_failed:${failed[0]}`,
    passed,
    failed,
  };
}

function normalizeRoutePath(prefix: string, route: string | undefined): string | null {
  if (!route) return null;
  const left = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  const right = route.startsWith("/") ? route : `/${route}`;
  if (!left) return right;
  return `${left}${right}`;
}

function buildIntentAnchors(intentSpec: CodingIntentSpec): string[] {
  const raw = [
    intentSpec.identity.domain,
    ...intentSpec.constraints,
    ...intentSpec.examples,
    ...intentSpec.outcome.summary.split(/[^a-zA-Z0-9_]+/),
  ]
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  const stop = new Set([
    "the", "and", "for", "with", "from", "that", "this", "into", "your", "want", "write", "make", "build",
    "create", "implement", "debug", "refactor", "small", "python", "fastapi", "flask", "sqlalchemy", "pygame",
    "application", "service", "general", "utility", "component", "plan", "readability_first", "minimal_surface",
  ]);

  return [...new Set(raw.filter((part) => part.length >= 4 && !stop.has(part)))].slice(0, 8);
}

function requiresIntentAnchors(
  family: CodingSkeletonContract["family"],
  domain: string,
): boolean {
  return family === "utility"
    || family === "refactor"
    || family === "app"
    || family === "api"
    || domain === "auth"
    || domain === "game"
    || domain === "compiler";
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
