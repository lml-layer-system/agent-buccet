export const CODING_SKELETON_LAWS = [
  "ABILITY.CODING.13: Coding intent must be compiled into a finite skeleton contract before generation or repair proceeds.",
  "ABILITY.CODING.14: A coding skeleton contract must identify language, task family, requested witnesses, and expected output shape.",
  "ABILITY.CODING.15: User intention defines the target skeleton result; generation fills admissible structure under that skeleton rather than inventing a new task.",
  "ABILITY.CODING.16: Quantum and EFUE coding collapse must prune candidate code paths against the active skeleton contract and witnesses, not against sequential freestyle continuation.",
  "ABILITY.CODING.17: Coding witnesses such as fenced-code shape, tests, api surface, orm shape, or parser/compiler structure must be explicit before output release.",
  "ABILITY.CODING.18: If the coding skeleton contract is underspecified, runtime must clarify the missing skeleton fields instead of projecting unstable code.",
  "ABILITY.CODING.50: Application and refactor families require explicit project-graph and dependency-surface witnesses before output release.",
  "ABILITY.CODING.51: Refactor and debugging families must preserve declared behavior and dependency intent unless the user explicitly requests behavioral change.",
  "ABILITY.CODING.52: Large open-ended coding families must collapse through family-specific witnesses and project legality rather than generic substrate validity alone.",
  "ABILITY.CODING.53: Repo-scale refactor, application, compiler, and game families must fail closed when project graph or dependency surface is structurally illegal.",
] as const;

export type CodingTaskFamily =
  | "utility"
  | "api"
  | "app"
  | "orm"
  | "auth"
  | "parser"
  | "compiler"
  | "game"
  | "refactor"
  | "unknown";

export type CodingSkeletonContract = {
  language: string;
  family: CodingTaskFamily;
  wantsTests: boolean;
  wantsApi: boolean;
  witnessSet: string[];
  expectedOutputShape: string;
};

export type CodingWitnessValidation = {
  ok: boolean;
  reason: string;
  passed: string[];
  failed: string[];
};

export function deriveCodingSkeletonContract(args: {
  question: string;
  userLaws: string[];
  insights: string[];
}): CodingSkeletonContract {
  const lowerQuestion = args.question.toLowerCase();
  const lowerLaws = args.userLaws.join("\n").toLowerCase();
  const lowerInsights = args.insights.join("\n").toLowerCase();
  const searchSpace = `${lowerQuestion}\n${lowerLaws}\n${lowerInsights}`;

  const language =
    /\bpython\b/.test(searchSpace) ? "python"
      : /\btypescript|ts\b/.test(searchSpace) ? "typescript"
        : /\bjavascript|js\b/.test(searchSpace) ? "javascript"
          : /\brust\b/.test(searchSpace) ? "rust"
            : /\bgo|golang\b/.test(searchSpace) ? "go"
              : /\bjava\b/.test(searchSpace) ? "java"
                : "typescript";

  const wantsTests = /\btest|tests|pytest|unittest|jest|vitest\b/.test(searchSpace);
  const wantsApi = /\b(api|endpoint|fastapi|flask|express|route|http)\b/.test(searchSpace);

  const family: CodingTaskFamily =
    /\b(refactor|rewrite|restructure)\b|fix this repo|fix this project|debug this repo|debug this project/.test(searchSpace) ? "refactor"
      : /\bcompiler\b/.test(searchSpace) ? "compiler"
      : /\b(doom|game|engine|sprite|loop)\b/.test(searchSpace) ? "game"
        : /\b(app|application|project|multi-file|multifile|package|workspace|repo|repository|cli)\b/.test(searchSpace) ? "app"
        : /\b(parser|parse|tokenizer|tokenize|lexer|ast)\b/.test(searchSpace) ? "parser"
          : /\b(auth|jwt|token|middleware|rbac|session)\b/.test(searchSpace) ? "auth"
            : /\b(sqlalchemy|orm|model|migration|database|sqlite|postgres)\b/.test(searchSpace) ? "orm"
              : wantsApi ? "api"
                : /\b(function|utility|helper|validator|palindrome|fizzbuzz|dedupe)\b|reverse string|word count/.test(searchSpace) ? "utility"
                  : "unknown";

  const witnessSet = [
    "fenced_code",
    wantsTests ? "tests" : "",
    wantsApi ? "api_surface" : "",
    family === "orm" ? "orm_shape" : "",
    family === "auth" ? "auth_guard" : "",
    family === "parser" ? "parse_shape" : "",
    family === "compiler" ? "compiler_structure" : "",
    family === "game" ? "game_loop_shape" : "",
    family === "app" ? "project_graph" : "",
    family === "refactor" ? "project_graph" : "",
    family === "app" || family === "refactor" || family === "game" ? "dependency_surface" : "",
    family === "utility" ? "minimal_function_shape" : "",
  ].filter(Boolean);

  const expectedOutputShape =
    wantsTests ? `${language} implementation block + ${language} test block`
      : `${language} implementation block`;

  return {
    language,
    family,
    wantsTests,
    wantsApi,
    witnessSet,
    expectedOutputShape,
  };
}

export function validateCodingWitnessSet(args: {
  contract: CodingSkeletonContract;
  text: string;
  blocks: Array<{ language: string; code: string }>;
}): CodingWitnessValidation {
  const lower = args.text.toLowerCase();
  const passed: string[] = [];
  const failed: string[] = [];

  for (const witness of args.contract.witnessSet) {
    if (witness === "fenced_code") {
      if (args.blocks.length > 0) passed.push(witness);
      else failed.push(witness);
      continue;
    }
    if (witness === "tests") {
      const hasSecondBlock = args.blocks.length >= 2;
      const hasTestFunction = /\bdef test_|pytest|unittest|describe\(|it\(/.test(lower);
      const hasTsTestFunction = /\btest\(|\bexpect\(/.test(lower);
      const hasSubjectImport =
        /\bfrom\s+[a-z0-9_.]+\s+import\b|\bimport\s+[a-z0-9_.]+/.test(lower)
        || /import\s+\{?[\s\w,]*\}?\s+from\s+['"][^'"]+['"]/.test(args.text);
      const hasBehaviorAssertion =
        /\bassert\s+/.test(lower)
        || /response\.status_code\s*==/.test(lower)
        || /response\.json\(\)\[/.test(lower)
        || /\bexpect\(/.test(lower);
      const trivialOnly = /\bassert\s+true\b/.test(lower) && !/assert\s+[a-z0-9_]/.test(lower);
      if (!hasSecondBlock) failed.push("logic_failed:L8.1_MISSING_TEST_BLOCK:no_test_block");
      else if (!hasTestFunction && !hasTsTestFunction) failed.push("logic_failed:L8.1_MISSING_TEST_BLOCK:no_test_function");
      else if (!hasSubjectImport) failed.push("logic_failed:L8.1_MISSING_TEST_BLOCK:no_subject_import");
      else if (trivialOnly) failed.push("logic_failed:L8.2_TRIVIAL_TEST_ASSERTION");
      else if (!hasBehaviorAssertion) failed.push("logic_failed:L8.3_MISSING_BEHAVIOR_ASSERTION:no_behavior_assert");
      else passed.push(witness);
      continue;
    }
    if (witness === "api_surface") {
      const hasFrameworkImport = args.contract.language === "python"
        ? /\bfrom\s+fastapi\s+import\b|\bimport\s+fastapi\b|\bfrom\s+flask\s+import\b|\bimport\s+flask\b/.test(lower)
        : /\bexpress\b|\bfrom\s+express\b|\brequire\(['"]express['"]\)/.test(lower);
      const hasAppConstructor = /\bapp\s*=\s*fastapi\(|\bapp\s*=\s*flask\(|\brouter\s*=|\bexpress\(\)/.test(lower);
      const hasRouteDecorator = /@app\.(get|post|put|delete|patch)\b|\brouter\.(get|post|put|delete|patch)\b/.test(lower);
      if (!hasFrameworkImport) failed.push("integration_failed:I2.1_API_FRAMEWORK_SURFACE:no_framework_import");
      else if (!hasAppConstructor) failed.push("integration_failed:I2.1_API_FRAMEWORK_SURFACE:no_app_constructor");
      else if (!hasRouteDecorator) failed.push("integration_failed:I2.2_API_ROUTE_SURFACE:no_route_decorator");
      else passed.push(witness);
      continue;
    }
    if (witness === "orm_shape") {
      const ok = /\bsqlalchemy\b|declarativebase|mapped_column|__tablename__|model\b/.test(lower);
      if (ok) passed.push(witness);
      else failed.push(witness);
      continue;
    }
    if (witness === "auth_guard") {
      const ok = /\bjwt\b|bearer|authorize|auth|middleware|depends\(/.test(lower);
      if (ok) passed.push(witness);
      else failed.push(witness);
      continue;
    }
    if (witness === "parse_shape") {
      const ok = /\bparse|parser|token|tokenize|lexer|ast\b/.test(lower);
      if (ok) passed.push(witness);
      else failed.push(witness);
      continue;
    }
    if (witness === "compiler_structure") {
      const ok = /\bcompile|compiler|emit|token|parser|ast|bytecode|ir\b/.test(lower);
      if (ok) passed.push(witness);
      else failed.push(witness);
      continue;
    }
    if (witness === "game_loop_shape") {
      const ok = /\bloop\b|update\(|render\(|tick\b|pygame|godot|doom|sprite\b/.test(lower);
      if (ok) passed.push(witness);
      else failed.push(witness);
      continue;
    }
    if (witness === "minimal_function_shape") {
      const ok = /\bdef\s+\w+\(|function\s+\w+\(|const\s+\w+\s*=\s*\(/.test(lower);
      if (ok) passed.push(witness);
      else failed.push(witness);
      continue;
    }
    if (witness === "project_graph") {
      const ok = /\bfrom\s+[a-z0-9_.]+\s+import\b|\bimport\s+[a-z0-9_.]+\b|#\s*[a-z0-9_./-]+\.(py|ts|tsx|js|jsx)\b/i.test(lower);
      if (ok) passed.push(witness);
      else failed.push(witness);
      continue;
    }
    if (witness === "dependency_surface") {
      const refactorOk =
        args.contract.family === "refactor"
        && (
          /\bfrom\s+src\.(parser|analyzer|transformer|emitter|witness)\s+import\b/.test(lower)
          || /\bdef\s+(parse_source|analyze_scopes|analyze_references|build_transform_plan|apply_transform_plan|emit_source|run_behavior_preservation_truth)\(/.test(lower)
        );
      const appOk =
        args.contract.family === "app"
        && (
          /['"]use client['"]|['"]use server['"]/.test(lower)
          || /\bfrom\s+['"]next\//.test(lower)
          || /\bexport\s+default\s+async\s+function\s+page\b/.test(lower)
          || /\bgeneratemetadata\s*\(/.test(lower)
        );
      const ok =
        refactorOk
        || appOk
        || /\bfastapi\b|\bflask\b|\bsqlalchemy\b|\bpytest\b|\btyper\b|\bclick\b|\bpygame\b|\bgodot\b|\bjinja2\b|\bpydantic\b/i.test(lower);
      if (ok) passed.push(witness);
      else if (args.contract.family === "app") failed.push("integration_failed:I2.4_APP_FRAMEWORK_SURFACE");
      else if (args.contract.family === "game") failed.push("integration_failed:I2.8_GAME_RUNTIME_DEPENDENCY_SURFACE");
      else if (args.contract.family === "refactor") failed.push("integration_failed:I2.9_REFACTOR_IMPORT_CONTINUITY");
      else failed.push("witness_failed:dependency_surface");
      continue;
    }
  }

  return {
    ok: failed.length === 0,
    reason: failed.length === 0
      ? "ok"
      : failed[0].includes(":")
        ? failed[0]
        : `witness_failed:${failed[0]}`,
    passed,
    failed,
  };
}
