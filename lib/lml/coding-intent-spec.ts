import type { CodingSkeletonContract } from "@/lib/lml/coding-skeleton-laws";

export const CODING_INTENT_SPEC_LAWS = [
  "ABILITY.CODING.28: Coding intent should be compiled into an explicit spec before projection when the user provides enough structure.",
  "ABILITY.CODING.29: A coding intent spec must bind identity, outcome, constraints, witnesses, and examples when available.",
  "ABILITY.CODING.30: Missing intent dimensions must trigger clarification instead of ambiguous code projection.",
] as const;

export type CodingIntentSpec = {
  identity: {
    artifactType: string;
    domain: string;
  };
  outcome: {
    summary: string;
  };
  constraints: string[];
  witnesses: string[];
  examples: string[];
  completeness: {
    hasIdentity: boolean;
    hasOutcome: boolean;
    hasWitnesses: boolean;
    score: number;
  };
};

export function deriveCodingIntentSpec(args: {
  question: string;
  contract: CodingSkeletonContract;
}): CodingIntentSpec {
  const lower = args.question.toLowerCase();

  const artifactType =
    args.contract.family === "api" ? "service"
      : args.contract.family === "app" ? "application"
      : args.contract.family === "orm" ? "data_layer"
        : args.contract.family === "auth" ? "auth_component"
          : args.contract.family === "parser" ? "parser"
            : args.contract.family === "compiler" ? "compiler"
              : args.contract.family === "game" ? "game_component"
                : args.contract.family === "refactor" ? "refactor_plan"
                : "utility";

  const domain =
    /\b(auth|jwt|token|login|middleware)\b/.test(lower) ? "auth"
      : /\b(email|validator|regex)\b/.test(lower) ? "validation"
        : /\b(sqlalchemy|orm|database|sqlite|postgres)\b/.test(lower) ? "data"
            : /\b(api|endpoint|route|fastapi|flask|express)\b/.test(lower) ? "api"
              : /\b(app|application|project|workspace|repo|repository|cli)\b/.test(lower) ? "application"
              : /\b(parser|tokenize|tokenizer|lexer|ast)\b/.test(lower) ? "parser"
                : /\b(compiler|emit|bytecode|ir)\b/.test(lower) ? "compiler"
                  : /\b(doom|game|engine|loop|sprite)\b/.test(lower) ? "game"
                    : /\b(refactor|rewrite|restructure|rename|extract)\b/.test(lower) ? "refactor"
                    : "general";

  const constraints = [
    /\bno recursion|avoid recursion\b/.test(lower) ? "no_recursion" : "",
    /\breadable|clarity|readability\b/.test(lower) ? "readability_first" : "",
    /\berror handling|safe|safety|guard\b/.test(lower) ? "defensive_error_handling" : "",
    /\bminimal|minimal\b/.test(lower) ? "minimal_surface" : "",
  ].filter(Boolean);

  const examples = extractExampleClauses(args.question);
  const witnesses = [...args.contract.witnessSet];

  const hasIdentity = args.contract.family !== "unknown";
  const hasOutcome = /\b(build|make|write|implement|create|debug|refactor)\b/.test(lower) && args.question.trim().length >= 24;
  const hasWitnesses = witnesses.length > 0;
  const score = Number(hasIdentity) + Number(hasOutcome) + Number(hasWitnesses);

  return {
    identity: {
      artifactType,
      domain,
    },
    outcome: {
      summary: summarizeOutcome(args.question),
    },
    constraints,
    witnesses,
    examples,
    completeness: {
      hasIdentity,
      hasOutcome,
      hasWitnesses,
      score,
    },
  };
}

function summarizeOutcome(question: string): string {
  const normalized = question.replace(/\s+/g, " ").trim();
  return normalized.length <= 180 ? normalized : `${normalized.slice(0, 177)}...`;
}

function extractExampleClauses(question: string): string[] {
  return question
    .split(/[?.!]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => /->|for example|example|e\.g\./i.test(part))
    .slice(0, 3);
}
