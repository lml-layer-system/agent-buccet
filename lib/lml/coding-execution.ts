import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { CodingIntentSpec } from "./coding-intent-spec.ts";
import type { CodingSkeletonContract } from "./coding-skeleton-laws.ts";
import { validateOracleWitnesses } from "./coding-oracle/witnesses.ts";


export const CODING_EXECUTION_LAWS = [
  "ABILITY.CODING.119: Coding families must satisfy family execution-surface witnesses before emission, not only static legality.",
  "ABILITY.CODING.120: Application and API families require an executable import/test surface that can be traced from entrypoint to handler.",
  "ABILITY.CODING.121: Compiler, parser, and game families require a lawful runnable pipeline surface before emission.",
  "ABILITY.CODING.125: Execution witnesses must compile candidate files in a bounded temp project before emission.",
  "ABILITY.CODING.126: External framework families must survive lawful local import smoke through dependency stubs or hit NULL.",
  "ABILITY.CODING.127: Execution witness failure outranks static surface legality and collapses the candidate.",
  "ABILITY.CODING.134: Auth families require an executable authorization surface and a lawful token or credential path before emission.",
  "ABILITY.CODING.135: Utility families require an executable behavior surface, not only a compile-valid function shell.",
  "ABILITY.CODING.136: Discovered coding tests must execute inside the bounded temp project before emission when the family declares tests.",
] as const;

export type CodingExecutionValidation = {
  ok: boolean;
  reason: string;
  passed: string[];
  failed: string[];
};

export function validateCodingExecution(args: {
  contract: CodingSkeletonContract;
  intentSpec: CodingIntentSpec;
  text: string;
}): CodingExecutionValidation {
  const oracle = validateOracleWitnesses({
    contract: args.contract,
    text: args.text,
  });
  if (!oracle.ok) {
    return {
      ok: false,
      reason: oracle.reason,
      passed: oracle.passed,
      failed: oracle.failed,
    };
  }

  const lower = args.text.toLowerCase();
  const passed: string[] = [];
  const failed: string[] = [];

  if (args.contract.family === "api") {
    const hasEntrypoint = /\bapp\s*=\s*fastapi\(|\bapp\s*=\s*flask\(/.test(lower);
    const hasCallableHandler = /def\s+[a-z0-9_]+\([^)]*\)\s*(->\s*[^:]+)?:/.test(lower);
    const hasHarness = /\btestclient\b|\bclient\s*=\s*testclient\(/.test(lower);
    if (!hasEntrypoint) failed.push("execution_failed:E1.1_ENTRYPOINT_SURFACE");
    else passed.push("E1.1_ENTRYPOINT_SURFACE");
    if (!hasCallableHandler) failed.push("execution_failed:E1.2_HANDLER_EXECUTION_SURFACE");
    else passed.push("E1.2_HANDLER_EXECUTION_SURFACE");
    if (!hasHarness) failed.push("execution_failed:E1.3_TEST_HARNESS_EXECUTION_SURFACE");
    else passed.push("E1.3_TEST_HARNESS_EXECUTION_SURFACE");
  }

  if (args.contract.family === "app") {
    const hasRouteEntry = /\bexport\s+default\s+(async\s+)?function\s+page\b/.test(lower);
    const hasBoundary =
      /['"]use client['"]|['"]use server['"]/.test(lower)
      || /\bexport\s+async\s+function\s+generatemetadata\b/.test(lower)
      || /\bexport\s+async\s+function\s+post\s*\(/.test(lower)
      || /\bsearchparams\b/.test(lower)
      || /\brevalidatepath\(/.test(lower);
    const hasWitnessSurface =
      /@testing-library\/react|\bexpect\(screen\.getbyrole\b|\bnpm run build\b|\bgeneratemetadata\s*\(|\brendertostaticmarkup\b|\bres\.status\b|\bresponse\.status\b/.test(lower);
    if (!hasRouteEntry) failed.push("execution_failed:E1.1_ENTRYPOINT_SURFACE");
    else passed.push("E1.1_ENTRYPOINT_SURFACE");
    if (!hasBoundary) failed.push("execution_failed:E1.2_HANDLER_EXECUTION_SURFACE");
    else passed.push("E1.2_HANDLER_EXECUTION_SURFACE");
    if (!hasWitnessSurface) failed.push("execution_failed:E1.3_TEST_HARNESS_EXECUTION_SURFACE");
    else passed.push("E1.3_TEST_HARNESS_EXECUTION_SURFACE");
  }

  if (args.contract.family === "orm") {
    const hasModel = /class\s+\w+\(.*base.*\)|__tablename__|mapped_column/.test(lower);
    const hasSessionUsage = /session\.add\(|session\.commit\(|select\(/.test(lower);
    const hasRepositoryOrCrud = /\bdef\s+(create_item|list_items|get_session|create_user|get_user_by_email)\(/.test(lower);
    if (!hasModel) failed.push("execution_failed:E2.1_MODEL_BOOTSTRAP_SURFACE");
    else passed.push("E2.1_MODEL_BOOTSTRAP_SURFACE");
    if (!hasSessionUsage) failed.push("execution_failed:E2.2_DATA_ACCESS_SURFACE");
    else passed.push("E2.2_DATA_ACCESS_SURFACE");
    if (!hasRepositoryOrCrud) failed.push("execution_failed:E2.3_REPOSITORY_EXECUTION_SURFACE");
    else passed.push("E2.3_REPOSITORY_EXECUTION_SURFACE");
  }

  if (args.contract.family === "auth") {
    const hasAuthSurface = /\bdef\s+(authorize|login|verify_token|issue_token|hash_password|authenticate)\(/.test(lower);
    const hasTokenOrCredentialPath = /\btoken\b|\bpassword\b|\bsecret\b|\bauthorization\b/.test(lower);
    const hasGuardOrRejection = /\braise\b|\breturn\s+false\b|\bif\s+not\b/.test(lower);
    if (!hasAuthSurface) failed.push("execution_failed:E6.1_AUTHORIZATION_SURFACE");
    else passed.push("E6.1_AUTHORIZATION_SURFACE");
    if (!hasTokenOrCredentialPath) failed.push("execution_failed:E6.2_TOKEN_OR_CREDENTIAL_SURFACE");
    else passed.push("E6.2_TOKEN_OR_CREDENTIAL_SURFACE");
    if (!hasGuardOrRejection) failed.push("execution_failed:E6.3_AUTH_GUARD_EXECUTION_SURFACE");
    else passed.push("E6.3_AUTH_GUARD_EXECUTION_SURFACE");

    const timingLeak =
      /\bdef\s+(verify_signature|check_password_hash|constant_time_compare)\([^)]*\)[^:]*:\s*[\s\S]{0,220}\b(if\s+[a-z_]\w*\s*(==|!=)\s*[a-z_]\w*|return\s+[a-z_]\w*\s*(==|!=)\s*[a-z_]\w*)/.test(lower)
      || /\bhmac\.compare_digest\(/.test(lower) === false
        && /\b(db_hash|provided_sig|input_hash|left|right)\s*==\s*(input_hash|expected_sig|db_token|left|right)\b/.test(lower);
    if (timingLeak) failed.push("execution_failed:EX_SEC_TIMING");
    else passed.push("EX_SEC_TIMING_GUARD");
  }

  if (args.contract.family === "utility") {
    const hasCallable = /\bdef\s+\w+\(/.test(lower);
    const hasReturnOrYield = /\breturn\b|\byield\b/.test(lower);
    const hasBehaviorWitness = /\bassert\b|\bdef test_/.test(lower);
    if (!hasCallable) failed.push("execution_failed:E7.1_UTILITY_CALLABLE_SURFACE");
    else passed.push("E7.1_UTILITY_CALLABLE_SURFACE");
    if (!hasReturnOrYield) failed.push("execution_failed:E7.2_UTILITY_BEHAVIOR_SURFACE");
    else passed.push("E7.2_UTILITY_BEHAVIOR_SURFACE");
    if (args.contract.wantsTests && !hasBehaviorWitness) failed.push("execution_failed:E7.3_UTILITY_TEST_WITNESS_SURFACE");
    else passed.push("E7.3_UTILITY_TEST_WITNESS_SURFACE");
  }

  if (args.contract.family === "parser") {
    const hasTokenizer = /\btokenize?\(|\blex\(/.test(lower);
    const hasParseFn = /\bdef\s+(parse|tokenize|lex)\(/.test(lower);
    const hasAstSurface = /\bclass\s+\w+node\b|\bvaluenode\b|\btokenize?\(/.test(lower);
    const infiniteLookahead =
      /\bdef\s+parse_group\([^)]*\):[\s\S]{0,260}\bif\s+self\.peek\(\)\.[a-z_]+\s*==\s*['"(][^:\n]*:[\s\S]{0,160}\breturn\s+self\.parse_(group|expression)\(/.test(lower)
      && !/\bconsume\(|\badvance\(|self\.index\s*\+=\s*1/.test(lower);
    if (!hasTokenizer) failed.push("execution_failed:E3.1_TOKEN_PIPELINE_SURFACE");
    else passed.push("E3.1_TOKEN_PIPELINE_SURFACE");
    if (!hasParseFn) failed.push("execution_failed:E3.2_PARSE_SURFACE");
    else passed.push("E3.2_PARSE_SURFACE");
    if (!hasAstSurface) failed.push("execution_failed:E3.3_AST_SURFACE");
    else passed.push("E3.3_AST_SURFACE");
    if (infiniteLookahead) failed.push("execution_failed:EX_TIMEOUT_RECURSION");
    else passed.push("EX_TIMEOUT_RECURSION_GUARD");
  }

  if (args.contract.family === "compiler") {
    const hasLexer = /\bdef\s+lex\(/.test(lower);
    const hasParser = /\bdef\s+parse\(/.test(lower);
    const hasEmitter = /\bdef\s+(emit|emit_ir)\(/.test(lower);
    if (!hasLexer) failed.push("execution_failed:E4.1_LEXER_SURFACE");
    else passed.push("E4.1_LEXER_SURFACE");
    if (!hasParser) failed.push("execution_failed:E4.2_PARSER_SURFACE");
    else passed.push("E4.2_PARSER_SURFACE");
    if (!hasEmitter) failed.push("execution_failed:E4.3_EMITTER_SURFACE");
    else passed.push("E4.3_EMITTER_SURFACE");
  }

  if (args.contract.family === "game") {
    const hasMain = /\bdef\s+main\(/.test(lower);
    const hasRunLoop = /\bdef\s+run_loop\(|while\s+[a-z0-9_.]+\s*:/.test(lower);
    const hasTick = /clock\.tick\(/.test(lower);
    if (!hasMain) failed.push("execution_failed:E5.1_GAME_ENTRYPOINT_SURFACE");
    else passed.push("E5.1_GAME_ENTRYPOINT_SURFACE");
    if (!hasRunLoop) failed.push("execution_failed:E5.2_GAME_LOOP_SURFACE");
    else passed.push("E5.2_GAME_LOOP_SURFACE");
    if (!hasTick) failed.push("execution_failed:E5.3_GAME_TICK_SURFACE");
    else passed.push("E5.3_GAME_TICK_SURFACE");
  }

  if (failed.length > 0) {
    return { ok: false, reason: failed[0], passed, failed };
  }

  if (args.contract.family === "app") {
    const appRuntime = runAppRuntimeWitness(args.text);
    return {
      ok: appRuntime.ok,
      reason: appRuntime.ok ? "ok" : appRuntime.reason,
      passed: [...passed, ...appRuntime.passed],
      failed: appRuntime.failed,
    };
  }

  const runtime = runRuntimeWitness(args.contract.family, args.text);
  return {
    ok: runtime.ok,
    reason: runtime.ok ? "ok" : runtime.reason,
    passed: [...passed, ...runtime.passed],
    failed: runtime.failed,
  };
}

function runAppRuntimeWitness(text: string): RuntimeWitnessResult {
  const lower = text.toLowerCase();
  if (/['"]use server['"][\s\S]{0,260}export\s+async\s+function\s+\w+\([^)]*(userid|role|accountid)[^)]*\)[\s\S]{0,260}(db\.[a-z0-9_]+\.(update|delete)|await\s+db\.[a-z0-9_]+\.(update|delete))/.test(text)
    && !/getsession\(|auth\(|cookies\(/i.test(text)) {
    return {
      ok: false,
      reason: "execution_failed:EX_SEC_ACTION_AUTH",
      passed: [],
      failed: ["execution_failed:EX_SEC_ACTION_AUTH"],
    };
  }

  if (/process\.env\.[A-Z0-9_]+[\s\S]{0,220}return\s+<[A-Z][A-Za-z0-9_]*\s+[A-Za-z0-9_]+=\{[A-Za-z0-9_.]+\}/.test(text)) {
    return {
      ok: false,
      reason: "execution_failed:EX_SEC_ENV_LEAK",
      passed: [],
      failed: ["execution_failed:EX_SEC_ENV_LEAK"],
    };
  }

  if (/['"]use client['"][\s\S]{0,240}(const|let)\s+\w+\s*=\s*window\./.test(text) || /['"]use client['"][\s\S]{0,240}window\.innerwidth/.test(lower) && !/useeffect\(/.test(lower)) {
    return {
      ok: false,
      reason: "execution_failed:EX_SSR_CRASH",
      passed: [],
      failed: ["execution_failed:EX_SSR_CRASH"],
    };
  }

  if (
    /export\s+async\s+function\s+POST\s*\(\s*req:\s*Request\s*\)/.test(text)
    && /await\s+req\.json\(\)/.test(text)
    && (
      /db\.[A-Za-z0-9_]+\.(update|create|delete)/.test(text)
      || /dangerousApplyWebhookPayload\(/.test(text)
      || /fulfill\(/.test(text)
      || /handleStripeEvent\(/.test(text)
    )
    && !/constructEvent\(/.test(text)
  ) {
    return {
      ok: false,
      reason: "execution_failed:EX_SEC_WEBHOOK_SIG",
      passed: [],
      failed: ["execution_failed:EX_SEC_WEBHOOK_SIG"],
    };
  }

  return {
    ok: true,
    reason: "ok",
    passed: ["EX_APP_BOUNDARY_SMOKE"],
    failed: [],
  };
}

type RuntimeWitnessResult = {
  ok: boolean;
  reason: string;
  passed: string[];
  failed: string[];
};

function runRuntimeWitness(
  family: CodingSkeletonContract["family"],
  text: string,
): RuntimeWitnessResult {
  const files = parsePythonFencedFiles(family, text);
  if (files.length === 0) {
    return {
      ok: false,
      reason: "execution_failed:EX0_NO_FILES",
      passed: [],
      failed: ["execution_failed:EX0_NO_FILES"],
    };
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lml-coding-exec-"));
  try {
    writeDependencyStubs(root);
    for (const file of files) {
      const full = path.join(root, file.path);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, file.body, "utf8");
    }

    const pyFiles = files.map((file) => file.path);
    const compileProbe = [
      "import pathlib, py_compile, sys",
      "root = pathlib.Path(sys.argv[1])",
      "paths = sys.argv[2:]",
      "for rel in paths:",
      "    py_compile.compile(str(root / rel), doraise=True)",
      "print('compile_ok')",
    ].join("\n");
    execFileSync("python3", ["-c", compileProbe, root, ...pyFiles], { timeout: 5000, stdio: "pipe" });

    const imports = importTargetsForFamily(family, files.map((file) => file.path));
    const importProbe = [
      "import importlib, pathlib, sys",
      "root = pathlib.Path(sys.argv[1])",
      "sys.path.insert(0, str(root))",
      "mods = sys.argv[2:]",
      "for mod in mods:",
      "    importlib.import_module(mod)",
      "print('import_ok')",
    ].join("\n");
    execFileSync("python3", ["-c", importProbe, root, ...imports], { timeout: 5000, stdio: "pipe" });

    const familyProbe = buildFamilyProbe(family);
    if (familyProbe) {
      execFileSync("python3", ["-c", familyProbe, root], { timeout: 5000, stdio: "pipe" });
    }

    const discoveredTests = testTargets(files.map((file) => file.path));
    if (discoveredTests.length > 0) {
      const testProbe = buildDiscoveredTestProbe(discoveredTests);
      execFileSync("python3", ["-c", testProbe, root, ...discoveredTests], { timeout: 5000, stdio: "pipe" });
    }

    return {
      ok: true,
      reason: "ok",
      passed: [
        "EX_COMPILE",
        "EX_IMPORT",
        `EX_${family.toUpperCase()}_SMOKE`,
        ...(discoveredTests.length > 0 ? ["EX_TEST_EXEC"] : []),
      ],
      failed: [],
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const normalized = normalizeRuntimeFailure(detail);
    return {
      ok: false,
      reason: normalized,
      passed: [],
      failed: [normalized],
    };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function parsePythonFencedFiles(
  family: CodingSkeletonContract["family"],
  text: string,
): Array<{ path: string; body: string }> {
  const lines = text.split(/\r?\n/);
  const files: Array<{ path: string; body: string }> = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```python\s*$/.test(line.trim())) {
      const prev = i > 0 ? lines[i - 1].trim() : "";
      const pathMatch = prev.match(/^#\s+(.+\.py)$/);
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) {
        body.push(lines[i]);
        i += 1;
      }
      let relPath = pathMatch?.[1];
      if (!relPath) {
        const firstNonEmpty = body.findIndex((entry) => entry.trim().length > 0);
        if (firstNonEmpty >= 0) {
          const innerMatch = body[firstNonEmpty].trim().match(/^#\s+(.+\.py)$/);
          if (innerMatch) {
            relPath = innerMatch[1];
            body.splice(firstNonEmpty, 1);
          }
        }
      }
      const bodyText = body.join("\n");
      relPath = relPath ?? inferUnnamedPath(family, bodyText, files.length);
      files.push({ path: relPath, body: bodyText + "\n" });
    }
    i += 1;
  }
  return files;
}

function inferUnnamedPath(
  family: CodingSkeletonContract["family"],
  body: string,
  index: number,
): string {
  const lower = body.toLowerCase();
  if (/def\s+test_|testclient|pytest/.test(lower)) {
    return `tests/test_${family}_${index + 1}.py`;
  }
  const canonicalByFamily: Record<string, string[]> = {
    utility: ["app.py"],
    auth: ["app.py", "auth_service.py"],
    api: ["app.py", "routes.py"],
    app: ["app.py", "services.py", "models.py", "routes.py"],
    orm: ["models.py", "crud.py", "repository.py", "db.py"],
    parser: ["app.py", "lexer.py", "parser.py", "tokens.py", "ast_nodes.py"],
    compiler: ["lexer.py", "parser.py", "emit.py", "frontend.py", "backend.py", "tokens.py", "ast_nodes.py"],
    game: ["main.py", "loop.py", "state.py", "runtime.py", "entities.py"],
    refactor: ["app.py", "auth_service.py", "services.py"],
    unknown: ["app.py"],
  };
  return canonicalByFamily[family]?.[index] ?? `${family}_${index + 1}.py`;
}

function writeDependencyStubs(root: string): void {
  writeFile(root, "fastapi/__init__.py", [
    "class FastAPI:",
    "    def __init__(self, *args, **kwargs): pass",
    "    def include_router(self, router, *args, **kwargs): return None",
    "    def get(self, path, *args, **kwargs):",
      "        def deco(fn): return fn",
      "        return deco",
    "    def post(self, path, *args, **kwargs):",
    "        def deco(fn): return fn",
    "        return deco",
    "    def put(self, path, *args, **kwargs):",
    "        def deco(fn): return fn",
    "        return deco",
    "    def delete(self, path, *args, **kwargs):",
    "        def deco(fn): return fn",
    "        return deco",
    "    def patch(self, path, *args, **kwargs):",
    "        def deco(fn): return fn",
    "        return deco",
    "class APIRouter:",
    "    def __init__(self, *args, **kwargs): pass",
    "    def get(self, path, *args, **kwargs):",
    "        def deco(fn): return fn",
      "        return deco",
    "    def post(self, path, *args, **kwargs):",
    "        def deco(fn): return fn",
    "        return deco",
    "class HTTPException(Exception):",
    "    def __init__(self, status_code: int, detail: str):",
    "        self.status_code = status_code",
    "        self.detail = detail",
  ].join("\n"));
  writeFile(root, "fastapi/testclient.py", [
    "class _Resp:",
    "    status_code = 200",
    "    def json(self): return {'status': 'ok', 'token': 'ok'}",
    "class TestClient:",
    "    def __init__(self, app): self.app = app",
    "    def get(self, path): return _Resp()",
    "    def post(self, path, **kwargs): return _Resp()",
  ].join("\n"));
  writeFile(root, "flask.py", [
    "class Flask:",
    "    def __init__(self, name): self.name = name",
    "    def route(self, path):",
    "        def deco(fn): return fn",
    "        return deco",
  ].join("\n"));
  writeFile(root, "pydantic/__init__.py", [
    "class BaseModel:",
    "    def __init__(self, **kwargs):",
    "        for k, v in kwargs.items(): setattr(self, k, v)",
    "    def model_dump(self): return self.__dict__",
  ].join("\n"));
  writeFile(root, "sqlalchemy/__init__.py", [
    "class String:",
    "    def __init__(self, size=None): self.size = size",
    "class _Select:",
    "    def __init__(self, obj): self.obj = obj",
    "    def where(self, *args, **kwargs): return self",
    "def create_engine(url): return ('engine', url)",
    "def select(obj): return _Select(obj)",
  ].join("\n"));
  writeFile(root, "sqlalchemy/orm/__init__.py", [
    "class _Meta:",
    "    def create_all(self, engine=None, bind=None): return None",
    "class DeclarativeBase:",
    "    metadata = _Meta()",
    "    def __init__(self, **kwargs):",
    "        for k, v in kwargs.items(): setattr(self, k, v)",
    "class Session:",
    "    def __init__(self, engine=None): self.engine = engine; self._items = []",
    "    def __enter__(self): return self",
    "    def __exit__(self, exc_type, exc, tb): return False",
    "    def add(self, obj): self._items.append(obj); return None",
    "    def flush(self): return None",
    "    def commit(self): return None",
    "    def get(self, model, ident):",
    "        for item in self._items:",
    "            if getattr(item, 'id', None) == ident:",
    "                return item",
    "        return None",
    "    def scalars(self, stmt): return list(self._items)",
    "    def scalar(self, stmt): return self._items[-1] if self._items else None",
    "class Mapped:",
    "    def __class_getitem__(cls, item): return cls",
    "def declarative_base():",
    "    class Base:",
    "        metadata = _Meta()",
    "    return Base",
    "def mapped_column(*args, **kwargs): return None",
  ].join("\n"));
  writeFile(root, "pygame.py", [
    "QUIT = 'QUIT'",
    "def init(): return None",
    "def quit(): return None",
    "class Surface:",
    "    def fill(self, color): return None",
    "class _Event:",
    "    def get(self): return []",
    "event = _Event()",
    "class _Display:",
    "    def set_mode(self, size): return Surface()",
    "    def flip(self): return None",
    "display = _Display()",
    "class _Clock:",
    "    def tick(self, hz): return None",
    "class _Time:",
    "    def Clock(self): return _Clock()",
    "time = _Time()",
  ].join("\n"));
}

function writeFile(root: string, rel: string, body: string): void {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body + "\n", "utf8");
}

function importTargetsForFamily(family: CodingSkeletonContract["family"], paths: string[]): string[] {
  const modules = paths
    .filter((entry) => entry.endsWith(".py"))
    .filter((entry) => !entry.startsWith("tests/"))
    .filter((entry) => !path.basename(entry).startsWith("test_"))
    .map((entry) => entry.replace(/\.py$/, "").replace(/\//g, "."));
  if (modules.length === 0) return ["main"];
  return modules;
}

function testTargets(paths: string[]): string[] {
  return paths
    .filter((entry) => entry.endsWith(".py"))
    .filter((entry) => entry.startsWith("tests/") || path.basename(entry).startsWith("test_"))
    .map((entry) => entry.replace(/\.py$/, "").replace(/\//g, "."));
}

function buildFamilyProbe(family: CodingSkeletonContract["family"]): string | null {
  switch (family) {
    case "api":
    case "app":
      return [
        "import pathlib, sys",
        "root = pathlib.Path(sys.argv[1])",
        "sys.path.insert(0, str(root))",
        "try:",
        "    import main as entry",
        "except Exception:",
        "    import app as entry",
        "assert hasattr(entry, 'app')",
      ].join("\n");
    case "orm":
      return [
        "import pathlib, sys",
        "root = pathlib.Path(sys.argv[1])",
        "sys.path.insert(0, str(root))",
        "try:",
        "    import app.repository as repo",
        "except Exception:",
        "    try:",
        "        import app.crud as repo",
        "    except Exception:",
        "        try:",
        "            import repository as repo",
        "        except Exception:",
        "            try:",
        "                import crud as repo",
        "            except Exception:",
        "                import app.models as repo",
        "assert any(hasattr(repo, name) for name in ('create_item', 'create_user'))",
        "assert any(hasattr(repo, name) for name in ('list_items', 'list_users', 'get_user_by_email'))",
      ].join("\n");
    case "auth":
      return [
        "import pathlib, sys",
        "root = pathlib.Path(sys.argv[1])",
        "sys.path.insert(0, str(root))",
        "try:",
        "    import app.auth_service as auth_mod",
        "except Exception:",
        "    try:",
        "        import auth_service as auth_mod",
        "    except Exception:",
        "        import app as auth_mod",
        "try:",
        "    from app.token import decode_strict_token",
        "except Exception:",
        "    from token import decode_strict_token",
        "auth_fn = getattr(auth_mod, 'authenticate_user', None) or getattr(auth_mod, 'authorize', None) or getattr(auth_mod, 'login', None)",
        "assert auth_fn is not None",
        "result = auth_fn('demo', 'secret')",
        "assert isinstance(result, dict)",
        "assert 'token' in result",
        "payload = decode_strict_token(result['token'])",
        "assert payload['sub'] == 'demo'",
        "assert 'exp' in payload",
        ].join("\n");
    case "utility":
      return [
        "import importlib, pathlib, sys",
        "root = pathlib.Path(sys.argv[1])",
        "sys.path.insert(0, str(root))",
        "mods = ['app', 'main']",
        "target = None",
        "for mod_name in mods:",
        "    try:",
        "        mod = importlib.import_module(mod_name)",
        "        callables = [getattr(mod, name) for name in dir(mod) if callable(getattr(mod, name)) and not name.startswith('_')]",
        "        if callables:",
        "            target = callables[0]",
        "            break",
        "    except Exception:",
        "        pass",
        "assert target is not None",
        "try:",
        "    out = target('demo')",
        "except TypeError:",
        "    try:",
        "        out = target(['demo', 'x'])",
        "    except TypeError:",
        "        out = target()",
        "assert out is not None",
      ].join("\n");
    case "parser":
      return [
        "import pathlib, sys",
        "root = pathlib.Path(sys.argv[1])",
        "sys.path.insert(0, str(root))",
        "try:",
        "    import parser as p",
        "except Exception:",
        "    import app as p",
        "if hasattr(p, 'parse'):",
        "    result = p.parse('1 2')",
        "else:",
        "    result = p.tokenize('1 2')",
        "assert result is not None",
      ].join("\n");
    case "compiler":
      return [
        "import pathlib, sys",
        "root = pathlib.Path(sys.argv[1])",
        "sys.path.insert(0, str(root))",
        "try:",
        "    import compiler.lexer as lexer",
        "    import compiler.parser as parser",
        "    try:",
        "        import compiler.emitter as emit_mod",
        "    except Exception:",
        "        import compiler.backend as emit_mod",
        "    emit_fn = getattr(emit_mod, 'emit', None) or getattr(emit_mod, 'emit_ir')",
        "    try:",
        "        parsed = parser.parse(lexer.lex('1 2'))",
        "    except Exception:",
        "        parsed = parser.parse('1 2')",
        "    try:",
        "        out = emit_fn(parsed)",
        "    except Exception:",
        "        out = emit_fn('1 2')",
        "except Exception:",
        "    import compiler.frontend as frontend, compiler.backend as backend",
        "    emit_fn = getattr(backend, 'emit', None) or getattr(backend, 'emit_ir')",
        "    out = emit_fn(frontend.parse('1 2'))",
        "assert isinstance(out, str)",
      ].join("\n");
    case "refactor":
      return [
        "import pathlib, sys",
        "root = pathlib.Path(sys.argv[1])",
        "sys.path.insert(0, str(root))",
        "import src.parser as parser_mod",
        "import src.analyzer as analyzer_mod",
        "import src.transformer as transformer_mod",
        "import src.emitter as emitter_mod",
        "import src.witness as witness_mod",
        "root_node = parser_mod.parse_source(type('Unit', (), {'text': 'before'})())",
        "facts = analyzer_mod.analyze_scopes(root_node)",
        "plan = analyzer_mod.build_transform_plan(root_node, facts)",
        "transformed = transformer_mod.apply_transform_plan(root_node, plan)",
        "out = emitter_mod.emit_source(transformed)",
        "assert isinstance(out, str)",
        "assert witness_mod.run_behavior_preservation_truth('before', out if out else 'before') is True",
      ].join("\n");
    case "game":
      return [
        "import pathlib, sys",
        "root = pathlib.Path(sys.argv[1])",
        "sys.path.insert(0, str(root))",
        "try:",
        "    import src.state as state, src.engine as engine",
        "    s = state.reset_state()",
        "    engine.step(s)",
        "except Exception:",
        "    try:",
        "        import src.entities as entities, src.runtime as runtime",
        "        s = entities.reset_state()",
        "        runtime.update(s)",
        "    except Exception:",
        "        import engine as main",
        "        assert hasattr(main, 'main')",
        "        assert hasattr(main, 'step') or hasattr(main, 'start')",
        "        s = type('State', (), {'running': True})()",
        "assert hasattr(s, 'running')",
      ].join("\n");
    default:
      return null;
  }
}

function buildDiscoveredTestProbe(testModules: string[]): string {
  return [
    "import importlib, inspect, pathlib, sys",
    "root = pathlib.Path(sys.argv[1])",
    "sys.path.insert(0, str(root))",
    "mods = sys.argv[2:]",
    "try:",
    "    from sqlalchemy.orm import Session",
    "except Exception:",
    "    Session = None",
    "for mod_name in mods:",
    "    mod = importlib.import_module(mod_name)",
    "    fixtures = {}",
    "    if hasattr(mod, 'client'):",
    "        fixtures['client'] = getattr(mod, 'client')",
    "    if hasattr(mod, 'app'):",
    "        fixtures['app'] = getattr(mod, 'app')",
    "    for attr in dir(mod):",
    "        if not attr.startswith('test_'):",
    "            continue",
    "        fn = getattr(mod, attr)",
    "        if not callable(fn):",
    "            continue",
    "        kwargs = {}",
    "        for name in inspect.signature(fn).parameters:",
    "            if name == 'session' and Session is not None:",
    "                kwargs[name] = Session(None)",
    "                continue",
    "            if name in fixtures:",
    "                kwargs[name] = fixtures[name]",
    "                continue",
    "            raise AssertionError(f'unsupported_test_fixture:{mod_name}:{attr}:{name}')",
    "        fn(**kwargs)",
    "print('tests_ok')",
  ].join("\n");
}

function normalizeRuntimeFailure(detail: string): string {
  const lower = detail.toLowerCase();
  if (lower.includes("syntaxerror") || lower.includes("indentationerror")) {
    return "execution_failed:EX_COMPILE";
  }
  if (lower.includes("modulenotfounderror") || lower.includes("importerror")) {
    return "execution_failed:EX_IMPORT";
  }
  if (lower.includes("assertionerror")) {
    return "execution_failed:EX_SMOKE_ASSERT";
  }
  if (lower.includes("unsupported_test_fixture")) {
    return "execution_failed:EX_TEST_FIXTURE";
  }
  if (lower.includes("timed out")) {
    return "execution_failed:EX_TIMEOUT";
  }
  return "execution_failed:EX_RUNTIME";
}
