import type { CodingIntentSpec } from "./coding-intent-spec.ts";
import type { CodingSkeletonContract } from "./coding-skeleton-laws.ts";
import { getCodingOracleFamily, hasCodingOracleFamily } from "./coding-oracle/index.ts";
import type { OracleGraphVariant } from "./coding-oracle/types.ts";

export type CodingProjectGraphFile = {
  path: string;
  role: string;
  imports: string[];
  exports: string[];
  summary: string;
};

export type CodingProjectGraph = {
  id: string;
  variant: string;
  family: CodingSkeletonContract["family"];
  language: string;
  files: CodingProjectGraphFile[];
};

export function buildCodingProjectGraphs(args: {
  contract: CodingSkeletonContract;
  intentSpec: CodingIntentSpec;
}): CodingProjectGraph[] {
  const { contract, intentSpec } = args;
  if (contract.language !== "python" && contract.family !== "app") {
    return [];
  }

  if (hasCodingOracleFamily(contract.family)) {
    return buildOracleProjectGraphs(contract.family, intentSpec).filter(isLawfulProjectGraph);
  }

  const graphs: CodingProjectGraph[] = (() => {
    switch (contract.family) {
    case "parser":
      return [
        {
          id: "graph.parser.simple",
          variant: "token_parse_split",
          family: "parser",
          language: "python",
          files: [
            { path: "tokens.py", role: "tokens", imports: [], exports: ["Token"], summary: "Token model." },
            { path: "parser.py", role: "parser", imports: ["tokens"], exports: ["tokenize", "parse"], summary: `Parser surface for ${intentSpec.outcome.summary}` },
            { path: "tests/test_parser.py", role: "tests", imports: ["parser"], exports: ["test_parse_sequence"], summary: "Parser smoke behavior test." },
          ],
        },
        {
          id: "graph.parser.frontend",
          variant: "lexer_ast_split",
          family: "parser",
          language: "python",
          files: [
            { path: "tokens.py", role: "tokens", imports: [], exports: ["Token"], summary: "Token model." },
            { path: "lexer.py", role: "lexer", imports: ["tokens"], exports: ["tokenize"], summary: "Tokenizer surface." },
            { path: "ast_nodes.py", role: "ast", imports: [], exports: ["ValueNode"], summary: "Parser AST node surface." },
            { path: "parser.py", role: "parser", imports: ["lexer", "ast_nodes"], exports: ["parse"], summary: `Parser frontend surface for ${intentSpec.outcome.summary}` },
            { path: "tests/test_parser.py", role: "tests", imports: ["parser"], exports: ["test_parse_sequence"], summary: "Parser smoke behavior test." },
          ],
        },
      ];
    default:
      return [];
    }
  })();

  return graphs.filter(isLawfulProjectGraph);
}

export function buildCodingProjectGraph(args: {
  contract: CodingSkeletonContract;
  intentSpec: CodingIntentSpec;
}): CodingProjectGraph | null {
  return buildCodingProjectGraphs(args)[0] ?? null;
}

export function summarizeCodingProjectGraph(graph: CodingProjectGraph): string {
  return graph.files
    .map((file) => `${file.path}:${file.role}:${file.imports.join(",") || "none"}:${file.exports.join(",") || "none"}`)
    .join(" | ");
}

function buildOracleProjectGraphs(
  family: Extract<CodingSkeletonContract["family"], "api" | "app" | "auth" | "compiler" | "game" | "orm" | "refactor">,
  intentSpec: CodingIntentSpec,
): CodingProjectGraph[] {
  const oracle = getCodingOracleFamily(family);
  return oracle.variants.map((variant) => mapOracleVariantToProjectGraph(oracle.family, variant, intentSpec));
}

function mapOracleVariantToProjectGraph(
  family: Extract<CodingSkeletonContract["family"], "api" | "app" | "auth" | "compiler" | "game" | "orm" | "refactor">,
  variant: OracleGraphVariant,
  intentSpec: CodingIntentSpec,
): CodingProjectGraph {
  const files = variant.files.map((file) => ({
    path: normalizeOraclePath(family, file.path),
    role: file.role,
    imports: inferOracleImports(family, file.path, file.role, variant.files),
    exports: inferOracleExports(family, file.path, file.role),
    summary: `${file.summary} Outcome: ${intentSpec.outcome.summary}`,
  }));

  return {
    id: `graph.${family}.${variant.id}`,
    variant: variant.id,
    family,
    language: family === "app" ? "typescript" : "python",
    files,
  };
}

function normalizeOraclePath(family: string, path: string): string {
  if (family === "app") {
    return path;
  }
  const trimmed = path.replace(/^src\//, "").replace(/^api\//, "").replace(/^compiler\//, "").replace(/^tests\//, "tests/");
  if (trimmed.endsWith("/")) {
    return trimmed;
  }
  if (trimmed.includes(".")) {
    return trimmed;
  }
  if (trimmed.startsWith("tests/")) {
    return `${trimmed}test_${family}.py`;
  }
  return `${trimmed}.py`;
}

function inferOracleImports(
  family: string,
  path: string,
  role: string,
  files: OracleGraphVariant["files"],
): string[] {
  const normalized = path.replace(/^src\//, "").replace(/^api\//, "").replace(/^compiler\//, "");
  switch (family) {
    case "api":
      if (role === "entrypoint") {
        return files.some((file) => file.role === "routing") ? ["routes"] : [];
      }
      if (role === "routing") {
        return files.some((file) => file.role === "business_logic") ? ["services"] : [];
      }
      if (role === "business_logic") {
        return files.some((file) => file.role === "orm_models") || files.some((file) => file.role === "data_models") ? ["models"] : [];
      }
      if (role === "testing") {
        return ["main"];
      }
      return [];
    case "auth":
      if (role === "transport_handlers" || role === "entrypoint") {
        return files.some((file) => file.role === "login_register_refresh_workflows") ? ["auth_service"] : [];
      }
      if (role === "login_register_refresh_workflows") {
        return ["security", "token"];
      }
      if (role === "fastapi_route_guards") {
        return ["token"];
      }
      if (role === "execution_witness") {
        return files.some((file) => file.path.includes("app.py")) ? ["app"] : ["app.auth_service"];
      }
      return [];
    case "app":
      if (role === "route_entry" || role === "public_route_group" || role === "authenticated_route_group") {
        return files.some((file) => file.role === "presentational_ui" || file.role === "feature_components") ? ["components"] : [];
      }
      if (role === "presentational_ui" || role === "feature_components") {
        return files.some((file) => file.role === "react_hooks") ? ["hooks"] : [];
      }
      if (role === "react_hooks") {
        return files.some((file) => file.role === "transport") ? ["services"] : [];
      }
      if (role === "testing") {
        return ["app/page"];
      }
      return [];
    case "compiler":
      if (role === "grammar_and_ast_construction") {
        return ["lexer", "ast_nodes"];
      }
      if (role === "ast_traversal") {
        return ["ast_nodes"];
      }
      if (role === "execution_witness") {
        return ["lexer", "parser"];
      }
      return [];
    case "game":
      if (role === "loop_and_scheduler") {
        return files.some((file) => file.role === "authoritative_game_data") ? ["state"] : ["runtime"];
      }
      if (role === "canvas_projection") {
        return ["state"];
      }
      if (role === "execution_witness") {
        return ["engine", "state"];
      }
      return [];
    case "orm":
      if (role === "data_access_layer") {
        return files.some((file) => file.role === "engine_and_session_management") ? ["app.database", "app.models", "app.schemas"] : ["app.models", "app.schemas"];
      }
      if (role === "migration_runtime") {
        return ["app.models", "app.database"];
      }
      if (role === "execution_witness") {
        return files.some((file) => file.path.includes("repository.py")) ? ["app.repository"] : ["app.crud"];
      }
      return [];
    case "refactor":
      if (normalized.endsWith("analyzer.ts")) {
        return ["parser", "model"];
      }
      if (normalized.endsWith("transformer.ts")) {
        return ["analyzer", "model"];
      }
      if (normalized.endsWith("emitter.ts")) {
        return ["transformer", "model"];
      }
      if (normalized.endsWith("witness.ts")) {
        return ["parser", "analyzer", "transformer", "emitter", "model"];
      }
      if (normalized.endsWith("parser.ts")) {
        return files.some((file) => file.role === "shared_types") ? ["model"] : [];
      }
      return [];
    default:
      return [];
  }
}

function inferOracleExports(family: string, path: string, role: string): string[] {
  const normalized = path.replace(/^src\//, "").replace(/^api\//, "").replace(/^compiler\//, "");
  switch (family) {
    case "api":
      if (role === "entrypoint") return ["app"];
      if (role === "routing") return ["router", "read_status"];
      if (role === "business_logic") return ["ServiceClass"];
      if (role === "orm_models" || role === "data_models") return ["BaseModel"];
      if (role === "request_response") return ["SchemaModel"];
      return [];
    case "auth":
      if (role === "hashing_and_crypto") return ["hash_password", "verify_password", "constant_time_compare"];
      if (role === "jwt_encode_decode") return ["create_access_token", "create_refresh_token", "decode_strict_token", "rotate_refresh_token"];
      if (role === "fastapi_route_guards") return ["get_current_subject", "require_role", "oauth2_scheme"];
      if (role === "login_register_refresh_workflows") return ["register_user", "authenticate_user", "refresh_session", "revoke_token"];
      if (role === "transport_handlers") return ["router", "login"];
      if (role === "entrypoint") return ["app"];
      return [];
    case "app":
      if (normalized.endsWith("page.tsx")) return ["default Page"];
      if (normalized.endsWith("layout.tsx")) return ["default RootLayout"];
      if (role === "react_hooks") return ["useFeatureViewModel"];
      if (role === "transport") return ["fetchFeatureData"];
      return [];
    case "compiler":
      if (role === "tokenization") return ["Lexer", "lex"];
      if (role === "grammar_and_ast_construction") return ["Parser", "parse"];
      if (role === "ast_structure") return ["ASTNode"];
      if (role === "ast_traversal") return ["NodeVisitor"];
      return [];
    case "game":
      if (role === "loop_and_scheduler") return ["createEngine", "start", "stop", "step"];
      if (role === "authoritative_game_data") return ["createInitialState", "updateSimulation", "applyQueuedInput"];
      if (role === "canvas_projection") return ["renderFrame"];
      if (role === "event_queue") return ["createInputQueue", "attachInputListeners", "drainInputQueue"];
      return [];
    case "orm":
      if (role === "engine_and_session_management") return ["engine", "SessionFactory", "session_scope"];
      if (role === "sqlalchemy_metadata") return ["Base", "UserModel", "Item"];
      if (role === "pydantic_validation") return ["CreateSchema", "ReadSchema", "UpdateSchema", "UserCreateSchema", "UserReadSchema", "ItemCreateSchema", "ItemReadSchema"];
      if (role === "data_access_layer") return ["create_user", "list_users", "create_item", "list_items"];
      return [];
    case "refactor":
      if (normalized.endsWith("parser.ts")) return ["parseSource"];
      if (normalized.endsWith("analyzer.ts")) return ["analyzeScopes", "analyzeReferences", "buildTransformPlan"];
      if (normalized.endsWith("transformer.ts")) return ["cloneTreeImmutable", "applyTransformPlan"];
      if (normalized.endsWith("emitter.ts")) return ["emitSource"];
      if (normalized.endsWith("witness.ts")) return ["runBehaviorPreservationTruth"];
      return [];
    default:
      return [];
  }
}

function isLawfulProjectGraph(graph: CodingProjectGraph): boolean {
  const roles = new Set(graph.files.map((file) => file.role));
  const paths = new Set(graph.files.map((file) => file.path));
  const hasTests = roles.has("tests")
    || roles.has("testing")
    || roles.has("execution_witness")
    || roles.has("behavior_preservation_harness")
    || graph.files.some((file) => file.path.startsWith("tests/"));
  const hasEntrypoint = roles.has("entrypoint");

  switch (graph.family) {
    case "api":
      return hasEntrypoint && hasTests && (roles.has("routes") || graph.files.some((file) => file.exports.includes("read_status")));
    case "app":
      return graph.files.some((file) => file.path.endsWith("src/app/page.tsx"))
        && graph.files.some((file) => file.path.endsWith("src/app/layout.tsx"))
        && (
          roles.has("route_entry")
          || roles.has("public_route_group")
          || roles.has("authenticated_route_group")
        )
        && (
          roles.has("transport")
          || roles.has("client_provider_assembly")
          || roles.has("feature_components")
          || roles.has("presentational_ui")
        );
    case "auth":
      return hasTests
        && roles.has("hashing_and_crypto")
        && roles.has("jwt_encode_decode")
        && roles.has("fastapi_route_guards")
        && roles.has("transport_handlers")
        && (hasEntrypoint || roles.has("login_register_refresh_workflows"));
    case "game":
      return hasTests
        && roles.has("authoritative_game_data")
        && roles.has("loop_and_scheduler")
        && roles.has("event_queue")
        && (roles.has("canvas_projection") || roles.has("runtime"));
    case "compiler":
      return hasTests
        && roles.has("tokenization")
        && roles.has("grammar_and_ast_construction")
        && (roles.has("ast_structure") || roles.has("ast_traversal"));
    case "orm":
      return hasTests
        && roles.has("sqlalchemy_metadata")
        && roles.has("data_access_layer")
        && (roles.has("engine_and_session_management") || roles.has("migration_runtime"));
    case "parser":
      return hasTests
        && graph.files.some((file) => file.exports.includes("tokenize"))
        && graph.files.some((file) => file.exports.includes("parse"));
    case "refactor":
      return hasTests
        && graph.files.some((file) => file.path.endsWith("parser.ts"))
        && graph.files.some((file) => file.path.endsWith("analyzer.ts"))
        && graph.files.some((file) => file.path.endsWith("transformer.ts"))
        && graph.files.some((file) => file.path.endsWith("emitter.ts"));
    default:
      return paths.size > 0;
  }
}
