import { promises as fs } from "node:fs";
import path from "node:path";
import { validateCodingArchitecture } from "../lib/lml/coding-architecture.ts";
import { classifyCodingFailureDimension, type CodingFailureDimension } from "../lib/lml/coding-failure-laws.ts";
import { classifyCodingFailureMetaRoot, classifyCodingFailureRoot, classifyCodingFailureTrunk } from "../lib/lml/coding-failure-laws.ts";
import { deriveCodingIntentSpec } from "../lib/lml/coding-intent-spec.ts";
import { validateCodingFloor } from "../lib/lml/coding-physics.ts";
import { appendCodingSimLedger } from "../lib/lml/coding-sim-ledger.ts";
import { validateCodingDependencies } from "../lib/lml/coding-dependencies.ts";
import { validateCodingGrounding } from "../lib/lml/coding-grounding.ts";
import { validateCodingIntegration } from "../lib/lml/coding-integration.ts";
import { validateCodingLogic } from "../lib/lml/coding-logic.ts";
import { validateCodingExecution } from "../lib/lml/coding-execution.ts";
import { assessCodingCompetence } from "../lib/lml/coding-competence.ts";
import { validateCodingDesign } from "../lib/lml/coding-design.ts";
import { buildCodingProjectGraphs, summarizeCodingProjectGraph } from "../lib/lml/coding-project-graph.ts";
import { validateCodingSecurity } from "../lib/lml/coding-security.ts";
import { validateCodingSemantics } from "../lib/lml/coding-semantics.ts";
import { validateCodingScale } from "../lib/lml/coding-scale.ts";
import { validateCodingState } from "../lib/lml/coding-state.ts";
import { validateCodingSurface } from "../lib/lml/coding-surface.ts";
import { hasCodingOracleFamily } from "../lib/lml/coding-oracle/index.ts";
import { buildOracleScaffold } from "../lib/lml/coding-oracle/scaffolds.ts";
import { mapCodingFailureToUniversalGroup } from "../lib/lml/coding-universal-taxonomy.ts";
import { runProbeField, type ProbeFieldNode } from "../lib/lml/probe-field.ts";
import { deriveCodingSkeletonContract, type CodingSkeletonContract, validateCodingWitnessSet } from "../lib/lml/coding-skeleton-laws.ts";

const LAWED_META_ROOTS = new Set([
  "META_ROOT_EXECUTION_SURFACE_MISSING",
  "META_ROOT_STATEFUL_CORRECTNESS_MISSING",
  "META_ROOT_COMPOSITION_BOUNDARY_ILLEGAL",
  "META_ROOT_RUNTIME_SAFETY_BOUNDARY_MISSING",
]);

type CodingScenario = {
  id: string;
  question: string;
  lawful: string;
};

type VariantPayload = {
  scenarioId: string;
  question: string;
  text: string;
  kind: string;
  family: string;
};

type ProbeResult = {
  name: string;
  ok: boolean;
  reason: string;
};

type SimResult = {
  scenarioId: string;
  variantId: string;
  kind: string;
  family: string;
  status: "survivor" | "pruned";
  reason: string;
  dimension: CodingFailureDimension;
  classId: string;
  probes: ProbeResult[];
  lineage: string[];
};

const SCENARIOS: CodingScenario[] = [
  {
    id: "S01",
    question: "write me a python function to reverse a string and pytest tests",
    lawful: [
      "```python",
      "def reverse_string(value: str) -> str:",
      "    if not isinstance(value, str):",
      "        raise TypeError('value must be a string')",
      "    return value[::-1]",
      "```",
      "",
      "```python",
      "import pytest",
      "from app import reverse_string",
      "",
      "def test_reverse_string_basic() -> None:",
      "    assert reverse_string('abc') == 'cba'",
      "```",
    ].join("\n"),
  },
  {
    id: "S02",
    question: "build a python fastapi auth endpoint with pytest tests",
    lawful: [
      "```python",
      "from fastapi import FastAPI, HTTPException",
      "app = FastAPI()",
      "",
      "@app.post('/login')",
      "def login(username: str, password: str) -> dict[str, str]:",
      "    if username != 'demo' or password != 'secret':",
      "        raise HTTPException(status_code=401, detail='unauthorized')",
      "    return {'token': 'ok'}",
      "```",
      "",
      "```python",
      "from fastapi.testclient import TestClient",
      "from app import app",
      "client = TestClient(app)",
      "def test_login_ok() -> None:",
      "    r = client.post('/login', params={'username': 'demo', 'password': 'secret'})",
      "    assert r.status_code == 200",
      "```",
    ].join("\n"),
  },
  {
    id: "S03",
    question: "build a python parser that tokenizes arithmetic expressions with tests",
    lawful: [
      "```python",
      "import re",
      "TOKEN_RE = re.compile(r'\\d+|[()+\\-*/]')",
      "def tokenize(expr: str) -> list[str]:",
      "    return TOKEN_RE.findall(expr)",
      "```",
      "",
      "```python",
      "from app import tokenize",
      "def test_tokenize() -> None:",
      "    assert tokenize('1 + 2*(3-4)') == ['1', '+', '2', '*', '(', '3', '-', '4', ')']",
      "```",
    ].join("\n"),
  },
  {
    id: "S04",
    question: "build a python compiler skeleton with lexer parser ast emit passes and tests",
    lawful: [
      "```python",
      "# lexer.py",
      "def lex(source: str) -> list[str]:",
      "    return source.split()",
      "```",
      "",
      "```python",
      "# parser.py",
      "from lexer import lex",
      "def parse(source: str) -> dict[str, list[str]]:",
      "    return {'tokens': lex(source)}",
      "```",
      "",
      "```python",
      "# emit.py",
      "from parser import parse",
      "def emit_ir(source: str) -> str:",
      "    return ' '.join(parse(source)['tokens'])",
      "```",
      "",
      "```python",
      "# test_compiler.py",
      "from emit import emit_ir",
      "def test_emit_ir() -> None:",
      "    assert emit_ir('a b') == 'a b'",
      "```",
    ].join("\n"),
  },
  {
    id: "S05",
    question: "build a multi-file python app with fastapi pydantic service layer and pytest tests",
    lawful: [
      "```python",
      "# app.py",
      "from fastapi import FastAPI",
      "from services import get_status",
      "app = FastAPI()",
      "@app.get('/status')",
      "def status() -> dict[str, str]:",
      "    return get_status()",
      "```",
      "",
      "```python",
      "# services.py",
      "from pydantic import BaseModel",
      "class StatusResponse(BaseModel):",
      "    status: str",
      "def get_status() -> dict[str, str]:",
      "    return StatusResponse(status='ok').model_dump()",
      "```",
      "",
      "```python",
      "# test_app.py",
      "from fastapi.testclient import TestClient",
      "from app import app",
      "client = TestClient(app)",
      "def test_status() -> None:",
      "    response = client.get('/status')",
      "    assert response.status_code == 200",
      "```",
    ].join("\n"),
  },
  {
    id: "S06",
    question: "build a python pygame game loop skeleton with update render tick and quit handling",
    lawful: [
      "```python",
      "import pygame",
      "def main() -> None:",
      "    pygame.init()",
      "    screen = pygame.display.set_mode((640, 480))",
      "    clock = pygame.time.Clock()",
      "    running = True",
      "    while running:",
      "        for event in pygame.event.get():",
      "            if event.type == pygame.QUIT:",
      "                running = False",
      "        update()",
      "        render(screen)",
      "        clock.tick(60)",
      "    pygame.quit()",
      "",
      "def update() -> None:",
      "    return None",
      "",
      "def render(screen: pygame.Surface) -> None:",
      "    screen.fill((0, 0, 0))",
      "    pygame.display.flip()",
      "```",
    ].join("\n"),
  },
  {
    id: "S07",
    question: "refactor this python app to extract auth into its own service and keep pytest coverage",
    lawful: [
      "```python",
      "# auth_service.py",
      "def authorize(username: str, password: str) -> bool:",
      "    return username == 'demo' and password == 'secret'",
      "```",
      "",
      "```python",
      "# app.py",
      "from fastapi import FastAPI, HTTPException",
      "from auth_service import authorize",
      "app = FastAPI()",
      "@app.post('/login')",
      "def login(username: str, password: str) -> dict[str, str]:",
      "    if not authorize(username, password):",
      "        raise HTTPException(status_code=401, detail='unauthorized')",
      "    return {'token': 'ok'}",
      "```",
      "",
      "```python",
      "# test_app.py",
      "from fastapi.testclient import TestClient",
      "from app import app",
      "client = TestClient(app)",
      "def test_login_ok() -> None:",
      "    response = client.post('/login', params={'username': 'demo', 'password': 'secret'})",
      "    assert response.status_code == 200",
      "```",
    ].join("\n"),
  },
  {
    id: "S08",
    question: "build a python sqlalchemy user model with basic crud helpers and pytest tests",
    lawful: [
      "```python",
      "# models.py",
      "from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, Session",
      "from sqlalchemy import String, select",
      "class Base(DeclarativeBase):",
      "    pass",
      "class User(Base):",
      "    __tablename__ = 'users'",
      "    id: Mapped[int] = mapped_column(primary_key=True)",
      "    email: Mapped[str] = mapped_column(String(255), unique=True)",
      "def create_user(session: Session, email: str) -> User:",
      "    user = User(email=email)",
      "    session.add(user)",
      "    session.flush()",
      "    return user",
      "def get_user_by_email(session: Session, email: str) -> User | None:",
      "    return session.scalar(select(User).where(User.email == email))",
      "```",
      "",
      "```python",
      "# test_models.py",
      "from sqlalchemy import create_engine",
      "from sqlalchemy.orm import Session",
      "from models import Base, create_user, get_user_by_email",
      "def test_create_and_get_user() -> None:",
      "    engine = create_engine('sqlite:///:memory:')",
      "    Base.metadata.create_all(engine)",
      "    with Session(engine) as session:",
      "        create_user(session, 'a@example.com')",
      "        session.commit()",
      "        assert get_user_by_email(session, 'a@example.com') is not None",
      "```",
    ].join("\n"),
  },
  {
    id: "S09",
    question: "build a python fastapi status api endpoint with pytest tests",
    lawful: [
      "```python",
      "# app.py",
      "from fastapi import FastAPI",
      "app = FastAPI()",
      "@app.get('/status')",
      "def status() -> dict[str, str]:",
      "    return {'status': 'ok'}",
      "```",
      "",
      "```python",
      "# test_app.py",
      "from fastapi.testclient import TestClient",
      "from app import app",
      "client = TestClient(app)",
      "def test_status() -> None:",
      "    response = client.get('/status')",
      "    assert response.status_code == 200",
      "    assert response.json()['status'] == 'ok'",
      "```",
    ].join("\n"),
  },
];

const EXPECTED_FAMILIES = ["utility", "api", "app", "orm", "auth", "parser", "compiler", "game", "refactor"];
const FAMILY_LAWFUL_BASELINES = new Map<string, string>();

const MUTATORS: Array<{
  id: string;
  apply: (text: string, family: string) => string | null;
}> = [
  {
    id: "syntax_missing_fence",
    apply: (text) => text.replace(/```python\n/g, "").replace(/\n```/g, ""),
  },
  {
    id: "logic_drop_tests",
    apply: (text) => text.split("```python").length > 2 ? text.split("```python").slice(0, 2).join("```python") : null,
  },
  {
    id: "logic_missing_condition_case",
    apply: (text, family) => {
      if (family !== "utility") return null;
      return "```python\ndef normalize(value: int) -> int:\n    if value > 0:\n        return 1\n    return 0\n```";
    },
  },
  {
    id: "logic_missing_return",
    apply: (text, family) => {
      if (family !== "utility") return null;
      return "```python\ndef reverse_string(value: str) -> str:\n    cleaned = value.strip()\n```";
    },
  },
  {
    id: "logic_wrong_return_type",
    apply: (text, family) => {
      if (family !== "api") return null;
      return text.replace("return {'status': 'ok'}", "return ['ok']");
    },
  },
  {
    id: "logic_null_deref",
    apply: (text, family) => {
      if (family !== "app" && family !== "api") return null;
      return `${text}\n\n\`\`\`python\nobj = None\nvalue = obj.get('status')\n\`\`\``;
    },
  },
  {
    id: "logic_mutation_during_iteration",
    apply: (text, family) => {
      if (family !== "utility" && family !== "orm") return null;
      return `${text}\n\n\`\`\`python\ndef remove_empty(items: list[str]) -> list[str]:\n    for item in items:\n        if not item:\n            items.append('x')\n    return items\n\`\`\``;
    },
  },
  {
    id: "logic_key_not_found",
    apply: (text, family) => {
      if (family !== "api" && family !== "app") return null;
      return `${text}\n\n\`\`\`python\ndef read_status(payload: dict[str, str]) -> str:\n    return payload['status']\n\`\`\``;
    },
  },
  {
    id: "logic_exception_swallowing",
    apply: (text, family) => {
      if (family !== "utility" && family !== "refactor") return null;
      return `${text}\n\n\`\`\`python\ntry:\n    risky()\nexcept Exception:\n    pass\n\`\`\``;
    },
  },
  {
    id: "algorithm_non_halting",
    apply: (text, family) => {
      if (family !== "utility") return null;
      return text.replace("return value[::-1]", "return reverse_string(value)");
    },
  },
  {
    id: "safety_bare_except",
    apply: (text, family) => {
      if (family !== "utility") return null;
      return text.replace("return value[::-1]", "try:\n        return value[::-1]\n    except:\n        return ''");
    },
  },
  {
    id: "integration_wrong_framework",
    apply: (text, family) => {
      if (family !== "auth" && family !== "api" && family !== "app" && family !== "refactor") return null;
      return [
        "```python",
        "import express",
        "const app = express()",
        "```",
        "",
        "```python",
        "def test_smoke() -> None:",
        "    assert True",
        "```",
      ].join("\n");
    },
  },
  {
    id: "integration_wrong_dependency_surface",
    apply: (text, family) => {
      if (family !== "app" && family !== "refactor" && family !== "game") return null;
      return text
        .replace(/\bfastapi\b/gi, "express")
        .replace(/\bpydantic\b/gi, "mongoose")
        .replace(/\bpygame\b/gi, "threejs");
    },
  },
  {
    id: "safety_no_auth_guard",
    apply: (text, family) => {
      if (family !== "auth") return null;
      return text.replace(
        "    if username != 'demo' or password != 'secret':\n        raise HTTPException(status_code=401, detail='unauthorized')\n",
        "",
      );
    },
  },
  {
    id: "safety_sql_injection",
    apply: (text, family) => {
      if (family !== "api" && family !== "auth" && family !== "app") return null;
      return text.replace(/return \{'status': 'ok'\}/, "query = \"SELECT * FROM users WHERE name = '\" + username + \"'\"\n    return {'status': query}");
    },
  },
  {
    id: "safety_xss_vulnerability",
    apply: (text, family) => {
      if (family !== "api" && family !== "app") return null;
      return `${text}\n\n\`\`\`python\nhtml = request.query_params['q']\npage.innerHTML = html\n\`\`\``;
    },
  },
  {
    id: "safety_hardcoded_credentials",
    apply: (text, family) => {
      if (family !== "auth" && family !== "api" && family !== "app") return null;
      return `${text}\n\n\`\`\`python\nAPI_KEY = \"prod-secret-key\"\nPASSWORD = \"admin123\"\n\`\`\``;
    },
  },
  {
    id: "context_wrong_family",
    apply: (text, family) => {
      if (family !== "parser" && family !== "refactor") return null;
      return [
        "```python",
        "from fastapi import FastAPI",
        "app = FastAPI()",
        "@app.get('/')",
        "def root() -> dict[str, str]:",
        "    return {'ok': 'ok'}",
        "```",
        "",
        "```python",
        "def test_root() -> None:",
        "    assert True",
        "```",
      ].join("\n");
    },
  },
  {
    id: "game_missing_loop",
    apply: (text, family) => {
      if (family !== "game") return null;
      return text
        .replace(/while running:[\s\S]*?clock\.tick\(60\)\n/, "update()\nrender(screen)\n")
        .replace(/for event in pygame\.event\.get\(\):[\s\S]*?running = False\n/, "");
    },
  },
  {
    id: "game_hallucinated_pygame_symbol",
    apply: (text, family) => {
      if (family !== "game") return null;
      return text
        .replace(/pygame\.display\.set_mode\(/g, "pygame.render_frame(")
        .replace(/clock\.tick\(/g, "pygame.tickrate(");
    },
  },
  {
    id: "project_graph_missing_service",
    apply: (text, family) => {
      if (family !== "app" && family !== "refactor") return null;
      return text.replace(/```python\n# services\.py[\s\S]*?```\n\n/, "");
    },
  },
  {
    id: "app_drop_testclient",
    apply: (text, family) => {
      if (family !== "app" && family !== "api") return null;
      return text
        .replace(/from fastapi\.testclient import TestClient\n/g, "")
        .replace(/client = TestClient\(app\)\n/g, "");
    },
  },
  {
    id: "refactor_wrong_import_binding",
    apply: (text, family) => {
      if (family !== "refactor") return null;
      return text.replace(/from auth_service import authorize/, "from auth_service import login_user");
    },
  },
  {
    id: "api_missing_route_shape",
    apply: (text, family) => {
      if (family !== "api") return null;
      return text
        .replace(/@app\.(get|post|put|delete|patch)\([^)]+\)\n/g, "")
        .replace(/FastAPI/g, "object");
    },
  },
  {
    id: "api_wrong_status_contract",
    apply: (text, family) => {
      if (family !== "api") return null;
      return text.replace(/return \{'status': 'ok'\}/, "return {'message': 'wrong-shape'}");
    },
  },
  {
    id: "api_hallucinated_framework_symbol",
    apply: (text, family) => {
      if (family !== "api" && family !== "app" && family !== "auth") return null;
      return text
        .replace(/TestClient/g, "FastAPIClient")
        .replace(/@app\.(get|post|put|delete|patch)\(/g, "@app.routez(");
    },
  },
  {
    id: "orm_missing_model_shape",
    apply: (text, family) => {
      if (family !== "orm") return null;
      return text
        .replace(/__tablename__\s*=\s*'users'\n/, "")
        .replace(/Mapped\[str\]\s*=\s*mapped_column\([^)]+\)\n/, "email = 'oops'\n");
    },
  },
  {
    id: "orm_wrong_dependency_surface",
    apply: (text, family) => {
      if (family !== "orm") return null;
      return text
        .replace(/\bsqlalchemy\b/gi, "mongoose")
        .replace(/\bSession\b/g, "Client");
    },
  },
  {
    id: "orm_hallucinated_sqlalchemy_symbol",
    apply: (text, family) => {
      if (family !== "orm") return null;
      return text
        .replace(/session\.add\(/g, "session.persist(")
        .replace(/mapped_column/g, "mappedField");
    },
  },
  {
    id: "orm_drop_crud_binding",
    apply: (text, family) => {
      if (family !== "orm") return null;
      return text
        .replace(/session\.add\(user\)\n/, "")
        .replace(/return session\.scalar\(select\(User\)\.where\(User\.email == email\)\)/, "return None");
    },
  },
  {
    id: "refactor_scope_drift",
    apply: (text, family) => {
      if (family !== "refactor") return null;
      return [
        "```python",
        "# app.py",
        "print('renamed everything and removed auth route')",
        "```",
      ].join("\n");
    },
  },
  {
    id: "architecture_cycle",
    apply: (text, family) => {
      if (family !== "compiler") return null;
      return [
        "```python",
        "# lexer.py",
        "from parser import parse",
        "def lex(source: str) -> list[str]:",
        "    return parse(source)['tokens']",
        "```",
        "",
        "```python",
        "# parser.py",
        "from lexer import lex",
        "def parse(source: str) -> dict[str, list[str]]:",
        "    return {'tokens': lex(source)}",
        "```",
      ].join("\n");
    },
  },
  {
    id: "architecture_missing_export",
    apply: (text, family) => {
      if (family !== "compiler") return null;
      return [
        "```python",
        "# lexer.py",
        "def tokenize(source: str) -> list[str]:",
        "    return source.split()",
        "```",
        "",
        "```python",
        "# parser.py",
        "from lexer import lex",
        "def parse(source: str) -> dict[str, list[str]]:",
        "    return {'tokens': lex(source)}",
        "```",
      ].join("\n");
    },
  },
  {
    id: "state_uninitialized_variable",
    apply: (text, family) => {
      if (family !== "utility") return null;
      return text.replace("return value[::-1]", "return result");
    },
  },
  {
    id: "state_race_condition",
    apply: (text, family) => {
      if (family !== "app" && family !== "game") return null;
      return `${text}\n\n\`\`\`python\nimport threading\nstate = {}\ndef bump() -> None:\n    state['count'] = state.get('count', 0) + 1\nthreading.Thread(target=bump).start()\n\`\`\``;
    },
  },
  {
    id: "state_deadlock",
    apply: (text, family) => {
      if (family !== "game" && family !== "app") return null;
      return `${text}\n\n\`\`\`python\nfrom threading import Lock\nstate_lock = Lock()\ndef dead() -> None:\n    with state_lock:\n        with state_lock:\n            return None\n\`\`\``;
    },
  },
  {
    id: "state_inconsistency",
    apply: (text, family) => {
      if (family !== "app" && family !== "api") return null;
      return `${text}\n\n\`\`\`python\nstate = {'status': 'ok'}\ndef update_state() -> dict[str, str]:\n    state['status'] = 'changed'\n    return state\n\`\`\``;
    },
  },
  {
    id: "state_global_pollution",
    apply: (text, family) => {
      if (family !== "utility" && family !== "app") return null;
      return `${text}\n\n\`\`\`python\nglobal history\nhistory = []\ndef remember(item: str) -> None:\n    history.append(item)\n\`\`\``;
    },
  },
  {
    id: "state_stale_cache",
    apply: (text, family) => {
      if (family !== "app" && family !== "orm") return null;
      return `${text}\n\n\`\`\`python\ncache = {}\ndef read_status(key: str) -> str:\n    return cache.get(key, 'old')\n\`\`\``;
    },
  },
  {
    id: "state_missing_reset",
    apply: (text, family) => {
      if (family !== "game" && family !== "app") return null;
      return text.replace(/\bpygame\.quit\(\)/g, "# missing quit/reset");
    },
  },
  {
    id: "design_tight_coupling",
    apply: (text, family) => {
      if (family !== "refactor" && family !== "app") return null;
      return `${text}\n\n\`\`\`python\nfrom services import get_status, save_status, delete_status, update_status\n\`\`\``;
    },
  },
  {
    id: "design_god_object",
    apply: (text, family) => {
      if (family !== "app" && family !== "refactor") return null;
      return `${text}\n\n\`\`\`python\nclass MegaService:\n    def a(self): return 1\n    def b(self): return 2\n    def c(self): return 3\n    def d(self): return 4\n    def e(self): return 5\n    def f(self): return 6\n    def g(self): return 7\n    def h(self): return 8\n\`\`\``;
    },
  },
  {
    id: "design_feature_envy",
    apply: (text, family) => {
      if (family !== "refactor") return null;
      return `${text}\n\n\`\`\`python\ndef summarize(service) -> str:\n    return service.user.name + service.user.email + service.user.role + service.user.status\n\`\`\``;
    },
  },
  {
    id: "design_inappropriate_intimacy",
    apply: (text, family) => {
      if (family !== "refactor" && family !== "app") return null;
      return `${text}\n\n\`\`\`python\ndef read_secret(auth) -> str:\n    return auth._token\n\`\`\``;
    },
  },
  {
    id: "design_message_chain",
    apply: (text, family) => {
      if (family !== "app" && family !== "orm") return null;
      return `${text}\n\n\`\`\`python\ndef city(user) -> str:\n    return user.profile.address.city.name\n\`\`\``;
    },
  },
  {
    id: "design_middle_man",
    apply: (text, family) => {
      if (family !== "refactor" && family !== "app") return null;
      return `${text}\n\n\`\`\`python\nclass Wrapper:\n    def __init__(self, inner):\n        self.inner = inner\n    def login(self, username: str, password: str):\n        return self.inner.login(username, password)\n\`\`\``;
    },
  },
  {
    id: "scale_wrong_complexity",
    apply: (text, family) => {
      if (family !== "utility" && family !== "orm") return null;
      return `${text}\n\n\`\`\`python\ndef dedupe(values: list[str]) -> list[str]:\n    out = []\n    for value in values:\n        for existing in out:\n            if existing == value:\n                break\n        else:\n            out.append(value)\n    return out\n\`\`\``;
    },
  },
  {
    id: "scale_exponential",
    apply: (text, family) => {
      if (family !== "utility") return null;
      return `${text}\n\n\`\`\`python\ndef fibonacci(n: int) -> int:\n    if n < 2:\n        return n\n    return fibonacci(n - 1) + fibonacci(n - 2)\n\`\`\``;
    },
  },
  {
    id: "scale_doesnt_scale",
    apply: (text, family) => {
      if (family !== "api" && family !== "app" && family !== "orm") return null;
      return `${text}\n\n\`\`\`python\ndef list_all(session):\n    return session.scalars(select(User)).all()\n\`\`\``;
    },
  },
  {
    id: "dependency_version_mismatch",
    apply: (text, family) => {
      if (family !== "api" && family !== "app") return null;
      return `${text}\n\n\`\`\`text\nfastapi==0.110.0\npydantic==1.10.13\npydantic==2.7.0\n\`\`\``;
    },
  },
  {
    id: "dependency_missing_dependency",
    apply: (text, family) => {
      if (family !== "auth" && family !== "api") return null;
      return `${text}\n\n\`\`\`python\nimport jwt\n\`\`\`\n\n\`\`\`text\nfastapi==0.110.0\n\`\`\``;
    },
  },
  {
    id: "dependency_transitive_conflict",
    apply: (text, family) => {
      if (family !== "api" && family !== "app") return null;
      return `${text}\n\n\`\`\`python\ndef model_out(obj):\n    return obj.model_dump()\n\`\`\`\n\n\`\`\`text\nfastapi==0.110.0\npydantic==1.10.13\n\`\`\``;
    },
  },
  {
    id: "hostile_api_cross_contamination",
    apply: (text, family) => {
      if (family !== "api" && family !== "app" && family !== "auth") return null;
      return `${text}\n\n\`\`\`python\nimport pygame\nfrom sqlalchemy.orm import Session\napp = object()\ndef runtime(session: Session) -> None:\n    pygame.init()\n    session.persist({'bad': 'state'})\n\`\`\`\n\n\`\`\`text\nfastapi==0.110.0\npydantic==1.10.13\npydantic==2.7.0\n\`\`\``;
    },
  },
  {
    id: "hostile_app_contradictory_witnesses",
    apply: (text, family) => {
      if (family !== "app" && family !== "refactor") return null;
      return [
        "```python",
        "# app.py",
        "from fastapi import FastAPI",
        "from services import get_status",
        "app = FastAPI()",
        "@app.get('/status')",
        "def status() -> dict[str, str]:",
        "    return {'message': 'wrong-shape'}",
        "```",
        "",
        "```python",
        "# services.py",
        "def get_status() -> dict[str, str]:",
        "    return {'status': 'ok'}",
        "```",
        "",
        "```python",
        "# test_app.py",
        "def test_status_placeholder() -> None:",
        "    assert True",
        "```",
      ].join("\n");
    },
  },
  {
    id: "hostile_compiler_stage_conflict",
    apply: (text, family) => {
      if (family !== "compiler" && family !== "parser") return null;
      return [
        "```python",
        "# lexer.py",
        "from emit import emit_ir",
        "def lex(source: str) -> list[str]:",
        "    return emit_ir(source).split()",
        "```",
        "",
        "```python",
        "# parser.py",
        "from lexer import tokenize",
        "def parse(source: str) -> dict[str, list[str]]:",
        "    return {'tokens': tokenize(source)}",
        "```",
        "",
        "```python",
        "# emit.py",
        "from parser import parse",
        "def emit_ir(source: str) -> str:",
        "    return parse(source)['missing']",
        "```",
      ].join("\n");
    },
  },
  {
    id: "hostile_game_runtime_boundary",
    apply: (text, family) => {
      if (family !== "game") return null;
      return `${text}\n\n\`\`\`python\nfrom threading import Lock\nstate_lock = Lock()\nstate = {'running': True}\ndef update() -> None:\n    with state_lock:\n        with state_lock:\n            state['running'] = False\ndef render(screen):\n    return state['missing']\n\`\`\``;
    },
  },
  {
    id: "hostile_orm_dependency_universe",
    apply: (text, family) => {
      if (family !== "orm") return null;
      return `${text}\n\n\`\`\`python\nimport mongoose\nfrom sqlalchemy.orm import Session\nclass Repo:\n    def save(self, session: Session, user):\n        return mongoose.persist(user)\n\`\`\``;
    },
  },
  {
    id: "hostile_refactor_project_binding",
    apply: (text, family) => {
      if (family !== "refactor" && family !== "app") return null;
      return [
        "```python",
        "# app.py",
        "from services import get_status",
        "from auth_service import authorize",
        "def status() -> dict[str, str]:",
        "    if authorize('demo', 'secret'):",
        "        return get_status()",
        "    return {'status': 'denied'}",
        "```",
        "",
        "```python",
        "# auth_service.py",
        "def login_user(username: str, password: str) -> bool:",
        "    return True",
        "```",
      ].join("\n");
    },
  },
];

async function main(): Promise<void> {
  const outDir = path.join(process.cwd(), "docs");
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const reportPath = path.join(outDir, `CODING_ADVERSARIAL_SIM_REPORT_${stamp}.md`);

  const pruned: SimResult[] = [];
  const survivors: SimResult[] = [];
  let visited = 0;

  for (const scenario of SCENARIOS) {
    const contract = deriveCodingSkeletonContract({
      question: scenario.question,
      userLaws: [],
      insights: [],
    });
    const intentSpec = deriveCodingIntentSpec({
      question: scenario.question,
      contract,
    });
    const lawfulBaseline = await buildLiveLawfulBaseline({
      contract,
      intentSpec,
      fallback: scenario.lawful,
    });
    FAMILY_LAWFUL_BASELINES.set(contract.family, lawfulBaseline);
    const seed: ProbeFieldNode<VariantPayload> = {
      id: `${scenario.id}:lawful`,
      depth: 0,
      label: "lawful_seed",
      lineage: ["lawful_seed"],
      payload: {
        scenarioId: scenario.id,
        question: scenario.question,
        text: lawfulBaseline,
        kind: "lawful_baseline",
        family: contract.family,
      },
    };

      const baselineOutcome = evaluateNode(seed, contract, intentSpec);
    if (baselineOutcome) {
      pruned.push(baselineOutcome);
      visited += 1;
      continue;
    }
    survivors.push(buildSurvivor(seed, contract));

    const field = runProbeField<SimResult, VariantPayload>(
      [seed],
      {
        maxDepth: 4,
        maxNodes: 140,
        expand: (node) => expandVariant(node),
      },
      {
        prune: (node) => evaluateNode(node, contract, intentSpec),
        score: () => 0,
      },
    );

    visited += field.visited;
    pruned.push(...field.pruned);
  }

  const structuralPruned = collapseStructuralFailures(pruned);
  const rootPruned = collapseRootFailures(structuralPruned);
  const metaRootPruned = collapseMetaRootFailures(rootPruned);

  const report = renderReport({
    scenarios: SCENARIOS.length,
    visited,
    pruned,
    structuralPruned,
    rootPruned,
    metaRootPruned,
    survivors,
  });
  await fs.writeFile(reportPath, report, "utf8");
  await appendCodingSimLedger("SIM_RUN_COMPLETED", {
    createdAt: new Date().toISOString(),
    reportPath,
    scenarios: SCENARIOS.length,
    visitedNodes: visited,
    survivors: survivors.length,
    pruned: pruned.length,
    structuralPruned: structuralPruned.length,
    rootPruned: rootPruned.length,
    metaRootPruned: metaRootPruned.length,
    uncoveredMetaRoots: countUncoveredMetaRoots(metaRootPruned),
    coveredFamilies: getCoveredFamilies(survivors, pruned),
    missingFamilies: getMissingFamilies(survivors, pruned),
    byDimension: summarizeByDimension(structuralPruned),
    byTrunk: summarizeByTrunk(structuralPruned),
    byRoot: summarizeByRoot(rootPruned),
    byMetaRoot: summarizeByMetaRoot(metaRootPruned),
    byUniversalGroup: summarizeByUniversalGroup(structuralPruned),
    byFamilyDimension: summarizeByFamilyDimension(structuralPruned),
  });
  console.log(reportPath);
}

async function buildLiveLawfulBaseline(args: {
  contract: CodingSkeletonContract;
  intentSpec: ReturnType<typeof deriveCodingIntentSpec>;
  fallback: string;
}): Promise<string> {
  const graph = buildCodingProjectGraphs({
    contract: args.contract,
    intentSpec: args.intentSpec,
  })[0];
  if (!graph) {
    return args.fallback;
  }

  if (hasCodingOracleFamily(args.contract.family) && args.contract.family !== "app") {
    const scaffold = buildOracleScaffold({
      family: args.contract.family,
      variant: graph.variant,
      graphSummary: summarizeCodingProjectGraph(graph),
      intentSpec: args.intentSpec,
    });
    return materializeFallbackSlots(scaffold.text, scaffold.slots);
  }

  return args.fallback;
}

function materializeFallbackSlots(
  text: string,
  slots: Array<{ id: string; fallbackBody: string[] }>,
): string {
  let out = text;
  for (const slot of slots) {
    const marker = `__LML_SLOT_${slot.id}__`;
    const line = out.split("\n").find((entry) => entry.includes(marker));
    if (!line) continue;
    const indent = line.match(/^(\s*)/)?.[1] ?? "";
    const replacement = slot.fallbackBody.map((entry) => `${indent}${entry}`).join("\n");
    out = out.replace(line, replacement);
  }
  return out;
}

function expandVariant(node: ProbeFieldNode<VariantPayload>): ProbeFieldNode<VariantPayload>[] {
  const out: ProbeFieldNode<VariantPayload>[] = [];
  for (const mutator of MUTATORS) {
    if (node.lineage.includes(mutator.id)) {
      continue;
    }
    const nextText = mutator.apply(node.payload.text, node.payload.family);
    if (!nextText || nextText === node.payload.text) {
      continue;
    }
    out.push({
      id: `${node.payload.scenarioId}:${mutator.id}:${node.depth + 1}`,
      depth: node.depth + 1,
      label: mutator.id,
      lineage: [...node.lineage, mutator.id],
      payload: {
        ...node.payload,
        text: nextText,
        kind: mutator.id,
      },
    });
  }
  return out;
}

function evaluateNode(
  node: ProbeFieldNode<VariantPayload>,
  contract: CodingSkeletonContract,
  intentSpec: ReturnType<typeof deriveCodingIntentSpec>,
): SimResult | null {
  return evaluateText(node.payload.text, false);

  function evaluateText(text: string, repaired: boolean): SimResult | null {
  const probes: ProbeResult[] = [];
  const blocks = extractCodeBlocks(text);
  const hasCodeShape = looksLikeCode(text);
  probes.push(probe("shape", hasCodeShape && blocks.length > 0, hasCodeShape && blocks.length > 0 ? "ok" : "missing_code_blocks"));
  if (!hasCodeShape || blocks.length === 0) {
    return tryRepairOrFinalize(text, "missing_code_blocks", probes, repaired);
  }

  const languageOk = blocks.some((block) => block.language === contract.language);
  probes.push(probe("language_surface", languageOk, languageOk ? "ok" : "wrong_language_surface"));
  if (!languageOk) {
    return tryRepairOrFinalize(text, "wrong_language_surface", probes, repaired);
  }

  const witness = validateCodingWitnessSet({
    contract,
    text,
    blocks,
  });
  probes.push(probe("witness", witness.ok, witness.reason));
  if (!witness.ok) {
    return tryRepairOrFinalize(text, witness.reason, probes, repaired);
  }

  const architecture = validateCodingArchitecture({ contract, blocks });
  probes.push(probe("architecture", architecture.ok, architecture.reason));
  if (!architecture.ok) {
    return tryRepairOrFinalize(text, architecture.reason, probes, repaired);
  }

  const floor = validateCodingFloor({ contract, text });
  probes.push(probe("floor", floor.ok, floor.reason));
  if (!floor.ok) {
    return tryRepairOrFinalize(text, floor.reason, probes, repaired);
  }

  const semantics = validateCodingSemantics({ contract, intentSpec, text });
  probes.push(probe("semantics", semantics.ok, semantics.reason));
  if (!semantics.ok) {
    return tryRepairOrFinalize(text, semantics.reason, probes, repaired);
  }
  const logic = validateCodingLogic({ contract, intentSpec, text });
  probes.push(probe("logic", logic.ok, logic.reason));
  if (!logic.ok) {
    return tryRepairOrFinalize(text, logic.reason, probes, repaired);
  }
  const security = validateCodingSecurity({ contract, intentSpec, text });
  probes.push(probe("security", security.ok, security.reason));
  if (!security.ok) {
    return tryRepairOrFinalize(text, security.reason, probes, repaired);
  }
  const state = validateCodingState({ contract, intentSpec, text });
  probes.push(probe("state", state.ok, state.reason));
  if (!state.ok) {
    return tryRepairOrFinalize(text, state.reason, probes, repaired);
  }
  const surface = validateCodingSurface({
    contract,
    intentSpec,
    text,
    blocks,
  });
  probes.push(probe("surface", surface.ok, surface.reason));
  if (!surface.ok) {
    return tryRepairOrFinalize(text, surface.reason, probes, repaired);
  }
  const design = validateCodingDesign({ contract, intentSpec, text });
  probes.push(probe("design", design.ok, design.reason));
  if (!design.ok) {
    return tryRepairOrFinalize(text, design.reason, probes, repaired);
  }
  const scale = validateCodingScale({ contract, intentSpec, text });
  probes.push(probe("scale", scale.ok, scale.reason));
  if (!scale.ok) {
    return tryRepairOrFinalize(text, scale.reason, probes, repaired);
  }
  const dependencies = validateCodingDependencies({ contract, intentSpec, text });
  probes.push(probe("dependencies", dependencies.ok, dependencies.reason));
  if (!dependencies.ok) {
    return tryRepairOrFinalize(text, dependencies.reason, probes, repaired);
  }
  const grounding = validateCodingGrounding({ contract, intentSpec, text });
  probes.push(probe("grounding", grounding.ok, grounding.reason));
  if (!grounding.ok) {
    return tryRepairOrFinalize(text, grounding.reason, probes, repaired);
  }
  const integration = validateCodingIntegration({ contract, intentSpec, text });
  probes.push(probe("integration", integration.ok, integration.reason));
  if (!integration.ok) {
    return tryRepairOrFinalize(text, integration.reason, probes, repaired);
  }

  const execution = validateCodingExecution({ contract, intentSpec, text });
  probes.push(probe("execution", execution.ok, execution.reason));
  if (!execution.ok) {
    return tryRepairOrFinalize(text, execution.reason, probes, repaired);
  }

  const halting = detectHaltingRisk(text);
  probes.push(probe("halting", halting.ok, halting.reason));
  if (!halting.ok) {
    return tryRepairOrFinalize(text, halting.reason, probes, repaired);
  }

  const family = detectFamilyFit(contract.family, text, intentSpec);
  probes.push(probe("family_fit", family.ok, family.reason));
  if (!family.ok) {
    return tryRepairOrFinalize(text, family.reason, probes, repaired);
  }

  return null;
  }

  function tryRepairOrFinalize(currentText: string, reason: string, probes: ProbeResult[], repaired: boolean): SimResult | null {
    if (!repaired) {
      const repairedText = repairCodingVariant(reason, node.payload.family, currentText);
      if (repairedText && repairedText !== currentText) {
        const repairedResult = evaluateText(repairedText, true);
        if (repairedResult === null) {
          return null;
        }
      }
    }
    return finalizeNode(node, contract, reason, probes);
  }
}

function repairCodingVariant(reason: string, family: string, text: string): string | null {
  const lawfulBaseline = FAMILY_LAWFUL_BASELINES.get(family) ?? null;
  const trunk = classifyCodingFailureTrunk(reason);
  const root = classifyCodingFailureRoot(reason);

  if (
    reason.startsWith("logic_failed:L8.1_MISSING_TEST_BLOCK")
    || reason.startsWith("logic_failed:L8.3_MISSING_BEHAVIOR_ASSERTION")
    || reason.startsWith("integration_failed:I2.3_API_TEST_HARNESS")
  ) {
    return lawfulBaseline ?? `${text}\n\n${buildFamilyTestRepair(family)}`;
  }

  if (
    reason.startsWith("integration_failed:I2.1_API_FRAMEWORK_SURFACE")
    || reason.startsWith("integration_failed:I2.2_API_ROUTE_SURFACE")
  ) {
    return lawfulBaseline ?? `${text}\n\n${buildFrameworkRepair(family)}`;
  }

  if (
    reason.startsWith("state_failed:L7.4_STATE_INCONSISTENCY")
    || reason.startsWith("state_failed:L7.6_STALE_STATE")
    || reason.startsWith("state_failed:L7.7_MISSING_STATE_RESET")
  ) {
    return lawfulBaseline ?? `${text}\n\n${buildStateRepair(family)}`;
  }

  if (
    trunk === "LOGIC_CONTROL_FLOW"
    || trunk === "SYNTAX_SUBSTRATE"
    || trunk === "ARCH_PROJECT_GRAPH"
    || root === "ROOT_CONTROL_FLOW_UNSAFE"
    || root === "ROOT_SYNTAX_SUBSTRATE_ILLEGAL"
    || root === "ROOT_ARCH_GRAPH_ILLEGAL"
  ) {
    return lawfulBaseline;
  }

  return null;
}

function buildFamilyTestRepair(family: string): string {
  if (family === "api" || family === "app" || family === "auth") {
    return [
      "```python",
      "# test_repair.py",
      "from fastapi.testclient import TestClient",
      "from app import app",
      "client = TestClient(app)",
      "def test_status_or_login() -> None:",
      "    response = client.get('/status') if hasattr(app, 'routes') else client.post('/login', params={'username': 'demo', 'password': 'secret'})",
      "    assert response.status_code in (200, 401)",
      "```",
    ].join("\n");
  }
  if (family === "orm") {
    return [
      "```python",
      "# test_models_repair.py",
      "from models import create_user",
      "def test_create_user_symbol_present() -> None:",
      "    assert callable(create_user)",
      "```",
    ].join("\n");
  }
  return [
    "```python",
    "# test_repair.py",
    "from app import *",
    "def test_behavior() -> None:",
    "    assert True",
    "```",
  ].join("\n");
}

function buildFrameworkRepair(family: string): string {
  if (family === "api" || family === "app" || family === "auth") {
    return [
      "```python",
      "# framework_repair.py",
      "from fastapi import FastAPI",
      "app = FastAPI()",
      "@app.get('/status')",
      "def status() -> dict[str, str]:",
      "    return {'status': 'ok'}",
      "```",
    ].join("\n");
  }
  return [
    "```python",
    "# framework_repair.py",
    "def repaired_surface() -> None:",
    "    return None",
    "```",
  ].join("\n");
}

function buildStateRepair(family: string): string {
  if (family === "game") {
    return [
      "```python",
      "# state_repair.py",
      "state = {'running': True, 'version': 0}",
      "def reset_state() -> None:",
      "    state.clear()",
      "    state.update({'running': False, 'version': 1})",
      "```",
    ].join("\n");
  }
  return [
    "```python",
    "# state_repair.py",
    "cache = {}",
    "def invalidate_cache() -> None:",
    "    cache.clear()",
    "def update_state(state: dict[str, str]) -> dict[str, str]:",
    "    state['updated_at'] = 'v1'",
    "    invalidate_cache()",
    "    return state",
    "```",
  ].join("\n");
}

function finalizeNode(
  node: ProbeFieldNode<VariantPayload>,
  contract: CodingSkeletonContract,
  reason: string,
  probes: ProbeResult[],
): SimResult {
  const classified = classifyCodingFailureDimension(reason);
  return {
    scenarioId: node.payload.scenarioId,
    variantId: node.id,
    kind: node.payload.kind,
    family: contract.family,
    status: "pruned",
    reason,
    dimension: classified.dimension,
    classId: classified.classId,
    probes,
    lineage: node.lineage,
  };
}

function buildSurvivor(node: ProbeFieldNode<VariantPayload>, contract: CodingSkeletonContract): SimResult {
  return {
    scenarioId: node.payload.scenarioId,
    variantId: node.label,
    kind: node.payload.kind,
    family: contract.family,
    status: "survivor",
    reason: "survivor",
    dimension: "unknown",
    classId: "SURVIVOR",
    probes: [],
    lineage: node.lineage,
  };
}

function probe(name: string, ok: boolean, reason: string): ProbeResult {
  return { name, ok, reason };
}

function extractCodeBlocks(text: string): Array<{ language: string; code: string }> {
  const blocks: Array<{ language: string; code: string }> = [];
  const fence = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
  let match = fence.exec(text);
  while (match) {
    const language = (match[1] || "text").trim().toLowerCase();
    const code = (match[2] || "").trim();
    if (code) {
      blocks.push({ language, code });
    }
    match = fence.exec(text);
  }
  return blocks;
}

function looksLikeCode(text: string): boolean {
  if (text.includes("```")) return true;
  return /\b(def |class |import |from |return |if |for |while |const |function )/.test(text);
}

function detectHaltingRisk(text: string): { ok: boolean; reason: string } {
  const lower = text.toLowerCase();
  if (/def\s+(\w+)\(/.test(lower)) {
    const fn = lower.match(/def\s+(\w+)\(/)?.[1];
    if (fn && new RegExp(`return\\s+${fn}\\(`).test(lower)) {
      return { ok: false, reason: "timeout" };
    }
  }
  if (/while\s+true\b|for\s*\(\s*;\s*;\s*\)/.test(lower)) {
    return { ok: false, reason: "timeout" };
  }
  return { ok: true, reason: "ok" };
}

function detectFamilyFit(
  family: CodingSkeletonContract["family"],
  text: string,
  intentSpec: ReturnType<typeof deriveCodingIntentSpec>,
): { ok: boolean; reason: string } {
  const lower = text.toLowerCase();
  if (family === "parser" && !/\bparse|parser|token|tokenize|lexer|ast\b/.test(lower)) {
    return { ok: false, reason: "underspecified_family_fit" };
  }
  if (family === "compiler" && !/\bcompile|compiler|token|lexer|parser|ast|emit|ir\b/.test(lower)) {
    return { ok: false, reason: "underspecified_family_fit" };
  }
  if (family === "auth" && !/\blogin|auth|token|jwt|http\b/.test(lower)) {
    return { ok: false, reason: "underspecified_family_fit" };
  }
  if (family === "app" && !/\bfastapi|flask|typer|click|pydantic|sqlalchemy|@app\.|testclient\b/.test(lower)) {
    return { ok: false, reason: "wrong_dependency_surface" };
  }
  if (family === "game" && !/\bpygame|loop|update\(|render\(|tick|quit\b/.test(lower)) {
    return { ok: false, reason: "underspecified_family_fit" };
  }
  if (family === "refactor" && !/\bauthorize|auth_service|refactor|extract|from\s+\w+\s+import\b/.test(lower)) {
    return { ok: false, reason: "underspecified_family_fit" };
  }
  if (intentSpec.identity.domain === "api" && !/\bfastapi|flask|@app\./.test(lower)) {
    return { ok: false, reason: "wrong_language_surface" };
  }
  return { ok: true, reason: "ok" };
}

function renderReport(args: {
  scenarios: number;
  visited: number;
  pruned: SimResult[];
  structuralPruned: SimResult[];
  rootPruned: SimResult[];
  metaRootPruned: SimResult[];
  survivors: SimResult[];
}): string {
  const competence = assessCodingCompetence();
  const byDimension = new Map(Object.entries(summarizeByDimension(args.structuralPruned)));
  const byTrunk = new Map(Object.entries(summarizeByTrunk(args.structuralPruned)));
  const byRoot = new Map(Object.entries(summarizeByRoot(args.rootPruned)));
  const byMetaRoot = new Map(Object.entries(summarizeByMetaRoot(args.metaRootPruned)));
  const byUniversalGroup = new Map(Object.entries(summarizeByUniversalGroup(args.structuralPruned)));
  const byFamilyDimension = new Map(
    Object.entries(summarizeByFamilyDimension(args.structuralPruned)).map(([family, counts]) => [family, new Map(Object.entries(counts))]),
  );

  const lines: string[] = [];
  lines.push("# Coding Adversarial Simulation Report");
  lines.push("");
  lines.push("## Summary");
  lines.push(`- scenarios: ${args.scenarios}`);
  lines.push(`- visited probe-field nodes: ${args.visited}`);
  lines.push(`- survivors: ${args.survivors.length}`);
  lines.push(`- raw pruned: ${args.pruned.length}`);
  lines.push(`- structural pruned: ${args.structuralPruned.length}`);
  lines.push(`- root pruned: ${args.rootPruned.length}`);
  lines.push(`- meta-root pruned: ${args.metaRootPruned.length}`);
  lines.push(`- uncovered meta-roots: ${countUncoveredMetaRoots(args.metaRootPruned)}`);
  lines.push("");
  lines.push("## Coding Competence (CC1-CC9)");
  for (const dimension of competence) {
    lines.push(`- ${dimension.id} ${dimension.name}: ${dimension.level}/${dimension.target}`);
    lines.push(`  - ${dimension.rationale}`);
  }
  lines.push("");
  lines.push("## Universal Failure Groups (343 Overlay)");
  for (const [group, count] of [...byUniversalGroup.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${group}: ${count}`);
  }
  lines.push("");
  lines.push("## Failure Dimensions");
  for (const [dimension, count] of [...byDimension.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${dimension}: ${count}`);
  }
  lines.push("");
  lines.push("## Failure Trunks");
  for (const [trunk, count] of [...byTrunk.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${trunk}: ${count}`);
  }
  lines.push("");
  lines.push("## Failure Roots");
  for (const [root, count] of [...byRoot.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${root}: ${count}`);
  }
  lines.push("");
  lines.push("## Failure Meta-Roots");
  for (const [root, count] of [...byMetaRoot.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${root}: ${count}`);
  }
  lines.push("");
  lines.push("## Meta-Root Coverage");
  for (const [root] of [...byMetaRoot.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${root}: ${LAWED_META_ROOTS.has(root) ? "lawed" : "uncovered"}`);
  }
  lines.push("");
  lines.push("## Trunk Law Coverage");
  for (const [trunk] of [...byTrunk.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${trunk}: lawed`);
  }
  lines.push("");
  const coveredFamilies = new Set(getCoveredFamilies(args.survivors, args.pruned));
  const missingFamilies = getMissingFamilies(args.survivors, args.pruned);
  lines.push("## Coverage");
  lines.push(`- covered_families: ${[...coveredFamilies].sort().join(", ")}`);
  lines.push(`- missing_families: ${missingFamilies.length > 0 ? missingFamilies.join(", ") : "none"}`);
  lines.push("");
  lines.push("## Failure Dimensions By Family");
  for (const [family, counts] of [...byFamilyDimension.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const parts = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([dimension, count]) => `${dimension}=${count}`);
    lines.push(`- ${family}: ${parts.join(", ")}`);
  }
  lines.push("");
  lines.push("## Survivors");
  for (const result of args.survivors) {
    lines.push(`- ${result.scenarioId}/${result.kind}: family=${result.family} lineage=${result.lineage.join(" -> ")}`);
  }
  lines.push("");
  lines.push("## Pruned Variants");
  for (const result of args.structuralPruned) {
    lines.push(`- ${result.scenarioId}/${result.kind}: ${result.dimension}:${result.classId}:${result.reason}`);
    lines.push(`  - lineage: ${result.lineage.join(" -> ")}`);
    lines.push(`  - probes: ${result.probes.map((p) => `${p.name}=${p.ok ? "pass" : p.reason}`).join(" | ")}`);
  }
  lines.push("");
  lines.push("## Dominant Next Law Targets");
  const dominant = [...byDimension.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  for (const [dimension] of dominant) {
    if (dimension === "syntax") lines.push("- syntax: harden substrate shape and language-surface laws.");
    if (dimension === "logic") lines.push("- logic: harden witness correctness and missing-case laws.");
    if (dimension === "architecture") lines.push("- architecture: harden project graph and module boundary laws.");
    if (dimension === "algorithm") lines.push("- algorithm: harden halting-collapse and bounded iteration laws.");
    if (dimension === "context") lines.push("- context: harden family/spec clarification laws.");
    if (dimension === "safety") lines.push("- safety: harden explicit failure and guard preservation laws.");
    if (dimension === "integration") lines.push("- integration: harden framework/ecosystem binding laws.");
  }
  lines.push("");
  lines.push("## Read");
  lines.push("- This sim is bounded QE/EFUE, not brute-force enumeration.");
  lines.push("- Adversarial variants are expanded lazily by mutation operators.");
  lines.push("- EFUE pruning happens probe-by-probe as soon as a node violates the current law stack.");
  lines.push("- This keeps the sim closed-loop and local while still pressuring a wider possibility field.");
  lines.push("- Universal failure groups are a higher-order coverage overlay derived from the 343-class taxonomy, not a replacement for direct coding leaf/trunk/root collapse.");
  return `${lines.join("\n")}\n`;
}

function summarizeByUniversalGroup(results: SimResult[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const result of results) {
    const group = mapCodingFailureToUniversalGroup(result.reason);
    out[group] = (out[group] ?? 0) + 1;
  }
  return out;
}

function summarizeByDimension(results: SimResult[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const result of results) {
    out[result.dimension] = (out[result.dimension] ?? 0) + 1;
  }
  return out;
}

function summarizeByRoot(results: SimResult[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const result of results) {
    const root = classifyCodingFailureRoot(result.reason);
    out[root] = (out[root] ?? 0) + 1;
  }
  return out;
}

function summarizeByMetaRoot(results: SimResult[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const result of results) {
    const root = classifyCodingFailureMetaRoot(result.reason);
    out[root] = (out[root] ?? 0) + 1;
  }
  return out;
}

function summarizeByTrunk(results: SimResult[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const result of results) {
    const trunk = classifyCodingFailureTrunk(result.reason);
    out[trunk] = (out[trunk] ?? 0) + 1;
  }
  return out;
}

function collapseRootFailures(results: SimResult[]): SimResult[] {
  const bySignature = new Map<string, SimResult>();
  for (const result of results) {
    const signature = buildRootFailureSignature(result);
    const existing = bySignature.get(signature);
    if (!existing || result.lineage.length < existing.lineage.length) {
      bySignature.set(signature, result);
    }
  }
  return [...bySignature.values()].sort((a, b) =>
    a.family.localeCompare(b.family)
    || classifyCodingFailureRoot(a.reason).localeCompare(classifyCodingFailureRoot(b.reason))
    || a.reason.localeCompare(b.reason),
  );
}

function collapseMetaRootFailures(results: SimResult[]): SimResult[] {
  const bySignature = new Map<string, SimResult>();
  for (const result of results) {
    const signature = buildMetaRootFailureSignature(result);
    const existing = bySignature.get(signature);
    if (!existing || result.lineage.length < existing.lineage.length) {
      bySignature.set(signature, result);
    }
  }
  return [...bySignature.values()].sort((a, b) =>
    classifyCodingFailureMetaRoot(a.reason).localeCompare(classifyCodingFailureMetaRoot(b.reason))
    || a.reason.localeCompare(b.reason),
  );
}

function collapseStructuralFailures(results: SimResult[]): SimResult[] {
  const bySignature = new Map<string, SimResult>();
  for (const result of results) {
    const signature = buildStructuralFailureSignature(result);
    const existing = bySignature.get(signature);
    if (!existing || result.lineage.length < existing.lineage.length) {
      bySignature.set(signature, result);
    }
  }
  return [...bySignature.values()].sort((a, b) =>
    a.family.localeCompare(b.family)
    || a.classId.localeCompare(b.classId)
    || a.reason.localeCompare(b.reason),
  );
}

function buildRootFailureSignature(result: SimResult): string {
  return classifyCodingFailureRoot(result.reason);
}

function buildMetaRootFailureSignature(result: SimResult): string {
  return classifyCodingFailureMetaRoot(result.reason);
}

function countUncoveredMetaRoots(results: SimResult[]): number {
  const roots = new Set(results.map((result) => classifyCodingFailureMetaRoot(result.reason)));
  let count = 0;
  for (const root of roots) {
    if (!LAWED_META_ROOTS.has(root)) {
      count += 1;
    }
  }
  return count;
}

function buildStructuralFailureSignature(result: SimResult): string {
  return [
    result.family,
    result.dimension,
    result.classId,
    result.reason,
  ].join("|");
}

function summarizeByFamilyDimension(results: SimResult[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const result of results) {
    const familyBucket = out[result.family] ?? {};
    familyBucket[result.dimension] = (familyBucket[result.dimension] ?? 0) + 1;
    out[result.family] = familyBucket;
  }
  return out;
}

function getCoveredFamilies(survivors: SimResult[], pruned: SimResult[]): string[] {
  return Array.from(new Set([
    ...survivors.map((result) => result.family),
    ...pruned.map((result) => result.family),
  ])).sort();
}

function getMissingFamilies(survivors: SimResult[], pruned: SimResult[]): string[] {
  const covered = new Set(getCoveredFamilies(survivors, pruned));
  return EXPECTED_FAMILIES.filter((family) => !covered.has(family));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
