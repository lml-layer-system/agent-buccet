import { promises as fs } from "node:fs";
import path from "node:path";
import { validateCodingArchitecture } from "../lib/lml/coding-architecture.ts";
import {
  classifyCodingFailureDimension,
  classifyCodingFailureMetaRoot,
  classifyCodingFailureRoot,
  classifyCodingFailureTrunk,
} from "../lib/lml/coding-failure-laws.ts";
import { validateCodingDependencies } from "../lib/lml/coding-dependencies.ts";
import { validateCodingDesign } from "../lib/lml/coding-design.ts";
import { validateCodingExecution } from "../lib/lml/coding-execution.ts";
import { validateCodingFloor } from "../lib/lml/coding-physics.ts";
import { validateCodingGrounding } from "../lib/lml/coding-grounding.ts";
import { deriveCodingIntentSpec } from "../lib/lml/coding-intent-spec.ts";
import { validateCodingIntegration } from "../lib/lml/coding-integration.ts";
import { validateCodingLogic } from "../lib/lml/coding-logic.ts";
import { getCodingOracleHostilePacks, hasCodingOracleFamily } from "../lib/lml/coding-oracle/index.ts";
import { buildOracleScaffold } from "../lib/lml/coding-oracle/scaffolds.ts";
import { buildCodingProjectGraphs, summarizeCodingProjectGraph } from "../lib/lml/coding-project-graph.ts";
import { validateCodingScale } from "../lib/lml/coding-scale.ts";
import { validateCodingSecurity } from "../lib/lml/coding-security.ts";
import { validateCodingSemantics } from "../lib/lml/coding-semantics.ts";
import { deriveCodingSkeletonContract, validateCodingWitnessSet, type CodingSkeletonContract } from "../lib/lml/coding-skeleton-laws.ts";
import { validateCodingState } from "../lib/lml/coding-state.ts";
import { validateCodingSurface } from "../lib/lml/coding-surface.ts";
import type { OracleHostileFamily, OracleHostilePack } from "../lib/lml/coding-oracle/types.ts";
import { appendCodingCoverageLedger } from "../lib/lml/coding-coverage-ledger.ts";

type CoverageRow = {
  family: OracleHostileFamily;
  variant: string;
  expected: string;
  actual: string;
  status: "caught" | "missed" | "staged";
  expectedDimension: string;
  actualDimension: string;
  expectedTrunk: string;
  actualTrunk: string;
  expectedRoot: string;
  actualRoot: string;
  expectedMetaRoot: string;
  actualMetaRoot: string;
};

const FAMILY_QUESTIONS: Record<OracleHostileFamily, string> = {
  api: "build a python fastapi status api endpoint with pytest tests",
  app: "build a next.js app router page",
  auth: "build a python fastapi auth endpoint with pytest tests",
  compiler: "build a python compiler skeleton with lexer parser ast emit passes and tests",
  game: "build a python pygame game loop skeleton with update render tick and quit handling",
  orm: "build a python sqlalchemy user model with basic crud helpers and pytest tests",
  parser: "build a python parser that tokenizes arithmetic expressions with tests",
  refactor: "refactor this python app to extract auth into its own service and keep pytest coverage",
  utility: "write me a python utility to sanitize config without mutating input and include pytest tests",
};

async function main(): Promise<void> {
  const rows: CoverageRow[] = [];

  for (const pack of getCodingOracleHostilePacks()) {
    const question = FAMILY_QUESTIONS[pack.family];
    const contract = deriveCodingSkeletonContract({
      question,
      userLaws: [],
      insights: [],
    });
    const intentSpec = deriveCodingIntentSpec({ question, contract });
    const baseline = buildLiveLawfulBaseline(contract, intentSpec, pack);
    const hostileText = materializeHostileCandidate(baseline, pack);
    const actual = evaluateText(hostileText, contract, intentSpec);

    const expectedClassified = classifyReason(pack.targetFailure);
    const actualClassified = classifyReason(actual);
    rows.push({
      family: pack.family,
      variant: pack.variantName,
      expected: pack.targetFailure,
      actual,
      status: actual === pack.targetFailure || actualClassified.root === expectedClassified.root ? "caught" : "missed",
      expectedDimension: expectedClassified.dimension,
      actualDimension: actualClassified.dimension,
      expectedTrunk: expectedClassified.trunk,
      actualTrunk: actualClassified.trunk,
      expectedRoot: expectedClassified.root,
      actualRoot: actualClassified.root,
      expectedMetaRoot: expectedClassified.metaRoot,
      actualMetaRoot: actualClassified.metaRoot,
    });
  }

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const reportPath = path.join(process.cwd(), "docs", `CODING_HOSTILE_PACK_COVERAGE_${stamp}.md`);
  await fs.writeFile(reportPath, renderReport(rows), "utf8");
  await appendCodingCoverageLedger("HOSTILE_PACK_COVERAGE_COMPLETED", {
    createdAt: new Date().toISOString(),
    reportPath,
    planet: "ability",
    ontologyStatus: "aligned",
    slice: "hostile_family",
    lawIds: [
      "ABILITY.CODING.31",
      "ABILITY.CODING.32",
      "ABILITY.CODING.39",
      "ABILITY.CODING.59",
      "ABILITY.CODING.60",
      "ABILITY.CODING.61",
      "ABILITY.CODING.62",
      "ABILITY.CODING.63",
      "ABILITY.CODING.64",
      "ABILITY.CODING.65",
      "ABILITY.CODING.66",
      "ABILITY.CODING.67",
      "ABILITY.CODING.85",
      "ABILITY.CODING.86",
      "ABILITY.CODING.87",
      "ABILITY.CODING.88",
      "ABILITY.CODING.90",
      "ABILITY.CODING.91",
      "ABILITY.CODING.95",
      "ABILITY.CODING.96",
      "ABILITY.CODING.97",
      "ABILITY.CODING.98",
      "ABILITY.CODING.99",
      "ABILITY.CODING.100",
      "ABILITY.CODING.101",
      "ABILITY.CODING.104",
      "ABILITY.CODING.105",
      "ABILITY.CODING.106",
      "ABILITY.CODING.107",
      "ABILITY.CODING.108",
      "ABILITY.CODING.109",
      "ABILITY.CODING.110",
      "ABILITY.CODING.111",
      "ABILITY.CODING.112",
      "ABILITY.CODING.113",
      "ABILITY.CODING.114",
      "ABILITY.CODING.115",
      "ABILITY.CODING.116",
      "ABILITY.CODING.117",
      "ABILITY.CODING.118",
      "ABILITY.CODING.119",
      "ABILITY.CODING.120",
      "ABILITY.CODING.121",
      "ABILITY.CODING.122",
      "ABILITY.CODING.123",
      "ABILITY.CODING.124",
      "ABILITY.CODING.125",
      "ABILITY.CODING.126",
      "ABILITY.CODING.127",
      "ABILITY.CODING.137",
      "ABILITY.CODING.138",
      "ABILITY.CODING.139",
      "ABILITY.CODING.140",
      "ABILITY.CODING.141",
      "ABILITY.CODING.142",
      "ABILITY.CODING.143",
      "ABILITY.CODING.144",
      "ABILITY.CODING.145",
      "ABILITY.CODING.146",
      "ABILITY.CODING.171",
      "ABILITY.CODING.172",
      "ABILITY.CODING.173",
    ],
    metrics: {
      totalPacks: rows.length,
      caught: rows.filter((row) => row.status === "caught").length,
      missed: rows.filter((row) => row.status === "missed").length,
      staged: rows.filter((row) => row.status === "staged").length,
    },
  });
  console.log(reportPath);
}

function buildLiveLawfulBaseline(
  contract: CodingSkeletonContract,
  intentSpec: ReturnType<typeof deriveCodingIntentSpec>,
  pack?: OracleHostilePack,
): string {
  if (contract.family === "parser") {
    const graph = buildCodingProjectGraphs({ contract, intentSpec })[0];
    if (!graph) {
      throw new Error("No live parser baseline path");
    }
    if (graph.variant === "lexer_ast_split") {
      return [
        `# graph ${summarizeCodingProjectGraph(graph)}`,
        "```python",
        "# tokens.py",
        "from dataclasses import dataclass",
        "",
        "@dataclass(frozen=True)",
        "class Token:",
        "    value: str",
        "```",
        "```python",
        "# ast_nodes.py",
        "from dataclasses import dataclass",
        "",
        "@dataclass(frozen=True)",
        "class ValueNode:",
        "    value: str",
        "```",
        "```python",
        "# lexer.py",
        "from tokens import Token",
        "",
        "def tokenize(source: str) -> list[Token]:",
        "    return [Token(value=chunk) for chunk in source.split()]",
        "```",
        "```python",
        "# parser.py",
        "from ast_nodes import ValueNode",
        "from lexer import tokenize",
        "",
        "def parse(source: str) -> list[ValueNode]:",
        "    return [ValueNode(value=token.value) for token in tokenize(source)]",
        "```",
        "```python",
        "# tests/test_parser.py",
        "from parser import parse",
        "",
        "def test_parse_sequence() -> None:",
        "    values = parse('a b c')",
        "    assert [node.value for node in values] == ['a', 'b', 'c']",
        "```",
      ].join("\n");
    }
    return [
      `# graph ${summarizeCodingProjectGraph(graph)}`,
      "```python",
      "# tokens.py",
      "from dataclasses import dataclass",
      "",
      "@dataclass(frozen=True)",
      "class Token:",
      "    value: str",
      "```",
      "```python",
      "# parser.py",
      "from tokens import Token",
      "",
      "def tokenize(source: str) -> list[Token]:",
      "    return [Token(value=chunk) for chunk in source.split()]",
      "",
      "def parse(source: str) -> list[str]:",
      "    return [token.value for token in tokenize(source)]",
      "```",
      "```python",
      "# tests/test_parser.py",
      "from parser import parse, tokenize",
      "",
      "def test_parse_sequence() -> None:",
      "    values = parse('a b c')",
      "    assert values == ['a', 'b', 'c']",
      "```",
    ].join("\n");
  }

  if (contract.family === "utility") {
    return [
      "```python",
      "# sanitize config utility",
      "def sanitize_config(config: dict[str, str]) -> dict[str, str]:",
      "    sanitized = dict(config)",
      "    if 'password' in sanitized:",
      "        sanitized['password'] = '***'",
      "    return sanitized",
      "```",
      "",
      "```python",
      "from app import sanitize_config",
      "",
      "def test_sanitize_config_output() -> None:",
      "    payload = {'password': 'secret'}",
      "    result = sanitize_config(payload)",
      "    assert result['password'] == '***'",
      "```",
    ].join("\n");
  }

  const graphs = buildCodingProjectGraphs({ contract, intentSpec });
  const graph = graphs[0];
  const chosenGraph = contract.family === "app"
    ? selectAppBaselineGraph(graphs, pack?.variantName)
    : graph;
  if (!chosenGraph || !hasCodingOracleFamily(contract.family)) {
    throw new Error(`No live oracle baseline path for ${contract.family}`);
  }
  const scaffold = buildOracleScaffold({
    family: contract.family,
    variant: chosenGraph.variant,
    graphSummary: summarizeCodingProjectGraph(chosenGraph),
    intentSpec,
  });
  return materializeFallbackSlots(scaffold.text, scaffold.slots);
}

function selectAppBaselineGraph(
  graphs: ReturnType<typeof buildCodingProjectGraphs>,
  variantName?: string,
) {
  if (variantName === "APP_ACTION_AUTH_BYPASS") {
    return graphs.find((candidate) => candidate.variant === "service-split") ?? graphs[0];
  }
  if (variantName === "APP_SSR_WINDOW_CRASH") {
    return graphs.find((candidate) => candidate.variant === "minimal") ?? graphs[0];
  }
  return graphs.find((candidate) => candidate.variant === "production")
    ?? graphs.find((candidate) => candidate.variant === "service-split")
    ?? graphs[0];
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

function materializeHostileCandidate(baseline: string, pack: OracleHostilePack): string {
  if (pack.variantName === "AUTH_TIMING_LEAK") {
    return baseline.replace(
      "return hmac.compare_digest(left.encode('utf-8'), right.encode('utf-8'))",
      "return left == right",
    );
  }

  if (pack.variantName === "ORM_LAZY_DETACH_BOMB") {
    return baseline
      .replace("return UserReadSchema(user.id, user.email, user.name)", "session.close()\n    return user")
      .replace("return ItemReadSchema(item.id, item.name)", "session.close()\n    return item");
  }

  if (pack.variantName === "REFACTOR_SILENT_SABOTAGE_ANCHORED") {
    return baseline.replace(
      [
        "def apply_transform_plan(root, plan):",
        "    return clone_tree_immutable(root)",
      ].join("\n"),
      [
        "def apply_transform_plan(root, plan):",
        "    return clone_tree_immutable(root)",
        "",
        "# auth service refactor coverage path",
        "class TransformAnchor:",
        "    pass",
        "",
        "class ASTTransformer:",
        "    def visit(self, node):",
        "        transformed = dict(node)",
        "        transformed['is_transformed'] = True",
        "        return transformed",
        "",
        "    def visit_BinOp(self, node):",
        "        return {",
        "            'left': self.visit(node['left']),",
        "            'op': node['op'],",
        "            'right': node['right'],",
        "        }",
      ].join("\n"),
    ).replace(
      "from src.witness import run_behavior_preservation_truth",
      [
        "from src.witness import run_behavior_preservation_truth",
        "from src.transformer import ASTTransformer",
      ].join("\n"),
    ).replace(
      "def test_behavior_equivalence() -> None:",
      [
        "def test_behavior_equivalence() -> None:",
        "    old_out = 'before'",
        "    new_out = 'before'",
        "    assert run_behavior_preservation_truth(old_out, new_out) is True",
        "    assert old_out == new_out",
        "",
        "def create_mock_binop():",
        "    return {",
        "        'left': {'is_transformed': False},",
        "        'op': '+',",
        "        'right': {'is_transformed': False},",
        "    }",
        "",
        "def test_visit_BinOp_transforms_children():",
        "    node = create_mock_binop()",
        "    result = ASTTransformer().visit_BinOp(node)",
        "    assert result['left']['is_transformed'] == True",
        "    assert result['right']['is_transformed'] == False",
      ].join("\n"),
    );
  }

  if (pack.variantName === "PARSER_INFINITE_LOOKAHEAD_BOMB") {
    let mutated = baseline.replace(
      "def parse(source: str) -> list[ValueNode]:",
      [
        "class Parser:",
        "    def __init__(self, tokens):",
        "        self.tokens = tokens",
        "        self.index = 0",
        "",
        "    def peek(self):",
        "        return self.tokens[self.index]",
        "",
        "    def parse_group(self):",
        "        if self.peek().value == '(':",
        "            return self.parse_group()",
        "        return self.peek()",
        "",
        "def parse(source: str) -> list[ValueNode]:",
      ].join("\n"),
    ).replace(
      "def parse(source: str) -> list[str]:",
      [
        "class Parser:",
        "    def __init__(self, tokens):",
        "        self.tokens = tokens",
        "        self.index = 0",
        "",
        "    def peek(self):",
        "        return self.tokens[self.index]",
        "",
        "    def parse_group(self):",
        "        if self.peek().value == '(':",
        "            return self.parse_group()",
        "        return self.peek()",
        "",
        "def parse(source: str) -> list[str]:",
      ].join("\n"),
    );
    mutated = mutated.replace(
      "from parser import parse",
      "from parser import parse, Parser, tokenize",
    ).replace(
      "from parser import parse, tokenize",
      "from parser import parse, Parser, tokenize",
    ).replace(
      "    assert [node.value for node in values] == ['a', 'b', 'c']",
      "    assert [node.value for node in values] == ['a', 'b', 'c']\n    parser = Parser(tokenize('( ( 1 ) )'))\n    parser.parse_group()",
    ).replace(
      "    assert values == ['a', 'b', 'c']",
      "    assert values == ['a', 'b', 'c']\n    parser = Parser(tokenize('( ( 1 ) )'))\n    parser.parse_group()",
    );
    return mutated;
  }

  if (pack.variantName === "UTILITY_REFERENCE_POISONING") {
    return [
      "```python",
      "def sanitize_config(config: dict[str, str]) -> dict[str, str]:",
      "    if 'password' in config:",
      "        config['password'] = '***'",
      "    return config",
      "```",
      "",
      "```python",
      "from app import sanitize_config",
      "",
      "def test_sanitize_config_output() -> None:",
      "    payload = {'password': 'secret'}",
      "    result = sanitize_config(payload)",
      "    assert result['password'] == '***'",
      "```",
    ].join("\n");
  }

  if (
    pack.variantName === "APP_PREVIEW_METADATA_DRIFT"
    || pack.variantName === "APP_SEARCH_ROUTE_MODE_DRIFT"
    || pack.variantName === "APP_TENANT_BILLING_WEBHOOK_DRIFT"
  ) {
    return `${baseline}\n\n${pack.minimalHostileExample}`;
  }

  const language = pack.family === "app" ? "tsx" : "python";
  return `${baseline}\n\n\`\`\`${language}\n${pack.minimalHostileExample}\n\`\`\``;
}

function evaluateText(
  text: string,
  contract: CodingSkeletonContract,
  intentSpec: ReturnType<typeof deriveCodingIntentSpec>,
): string {
  const blocks = extractCodeBlocks(text);
  const hasCodeShape = looksLikeCode(text);
  if (!hasCodeShape || blocks.length === 0) return "missing_code_blocks";

  const languageOk = blocks.some((block) => languageMatchesContract(block.language, contract.language));
  if (!languageOk) return "wrong_language_surface";

  const witness = validateCodingWitnessSet({ contract, text, blocks });
  if (!witness.ok) return witness.reason;

  const architecture = validateCodingArchitecture({ contract, blocks });
  if (!architecture.ok) return architecture.reason;

  const floor = validateCodingFloor({ contract, text });
  if (!floor.ok) return floor.reason;

  const semantics = validateCodingSemantics({ contract, intentSpec, text });
  if (!semantics.ok) return semantics.reason;

  const logic = validateCodingLogic({ contract, intentSpec, text });
  if (!logic.ok) return logic.reason;

  const security = validateCodingSecurity({ contract, intentSpec, text });
  if (!security.ok) return security.reason;

  const state = validateCodingState({ contract, intentSpec, text });
  if (!state.ok) return state.reason;

  const surface = validateCodingSurface({ contract, intentSpec, text, blocks });
  if (!surface.ok) return surface.reason;

  const design = validateCodingDesign({ contract, intentSpec, text });
  if (!design.ok) return design.reason;

  const scale = validateCodingScale({ contract, intentSpec, text });
  if (!scale.ok) return scale.reason;

  const dependencies = validateCodingDependencies({ contract, intentSpec, text });
  if (!dependencies.ok) return dependencies.reason;

  const grounding = validateCodingGrounding({ contract, intentSpec, text });
  if (!grounding.ok) return grounding.reason;

  const integration = validateCodingIntegration({ contract, intentSpec, text });
  if (!integration.ok) return integration.reason;

  const execution = validateCodingExecution({ contract, intentSpec, text });
  if (!execution.ok) return execution.reason;

  return "survivor";
}

function languageMatchesContract(blockLanguage: string, contractLanguage: string): boolean {
  if (blockLanguage === contractLanguage) return true;
  if (contractLanguage === "typescript" && (blockLanguage === "ts" || blockLanguage === "tsx" || blockLanguage === "javascript" || blockLanguage === "jsx")) {
    return true;
  }
  if (contractLanguage === "javascript" && (blockLanguage === "js" || blockLanguage === "jsx" || blockLanguage === "typescript" || blockLanguage === "ts" || blockLanguage === "tsx")) {
    return true;
  }
  return false;
}

function classifyReason(reason: string): {
  dimension: string;
  trunk: string;
  root: string;
  metaRoot: string;
} {
  return {
    dimension: classifyCodingFailureDimension(reason).dimension,
    trunk: classifyCodingFailureTrunk(reason),
    root: classifyCodingFailureRoot(reason),
    metaRoot: classifyCodingFailureMetaRoot(reason),
  };
}

function extractCodeBlocks(text: string): Array<{ language: string; code: string }> {
  const blocks: Array<{ language: string; code: string }> = [];
  const fence = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
  let match = fence.exec(text);
  while (match) {
    const language = (match[1] || "text").trim().toLowerCase();
    const code = (match[2] || "").trim();
    if (code) blocks.push({ language, code });
    match = fence.exec(text);
  }
  return blocks;
}

function looksLikeCode(text: string): boolean {
  if (text.includes("```")) return true;
  return /\b(def |class |import |from |return |if |for |while |const |function )/.test(text);
}

function renderReport(rows: CoverageRow[]): string {
  const caught = rows.filter((row) => row.status === "caught").length;
  const missed = rows.filter((row) => row.status === "missed").length;
  const staged = rows.filter((row) => row.status === "staged").length;
  return [
    "# Coding Hostile Pack Coverage",
    "",
    `- total hostile packs: \`${rows.length}\``,
    `- caught: \`${caught}\``,
    `- missed: \`${missed}\``,
    `- staged: \`${staged}\``,
    "",
    "| Family | Variant | Expected | Actual | Status |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.family} | ${row.variant} | ${row.expected} | ${row.actual} | ${row.status} |`),
    "",
    "## Classification",
    "",
    "| Family | Expected Root | Actual Root | Expected Meta-Root | Actual Meta-Root |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.family} | ${row.expectedRoot} | ${row.actualRoot} | ${row.expectedMetaRoot} | ${row.actualMetaRoot} |`),
    "",
  ].join("\n");
}

await main();
