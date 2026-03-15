export type CodingCompetenceDimensionId =
  | "CC1"
  | "CC2"
  | "CC3"
  | "CC4"
  | "CC5"
  | "CC6"
  | "CC7"
  | "CC8"
  | "CC9";

export type CodingCompetenceDimension = {
  id: CodingCompetenceDimensionId;
  name: string;
  level: number;
  target: number;
  rationale: string;
};

export function assessCodingCompetence(): CodingCompetenceDimension[] {
  return [
    {
      id: "CC1",
      name: "Syntax Mastery",
      level: 5,
      target: 8,
      rationale:
        "Strong syntax/fence/witness rejection and slot-bounded emission exist, but there is not yet grammar-constrained projection per language.",
    },
    {
      id: "CC2",
      name: "Semantic Understanding",
      level: 5,
      target: 7,
      rationale:
        "Family semantic validators now check route/test alignment, service delegation, parser/compiler pipeline linkage, game loop linkage, refactor delegation, and ORM action coherence, but collapse is still heuristic rather than symbolic or proof-carrying.",
    },
    {
      id: "CC3",
      name: "API / Library Knowledge",
      level: 5,
      target: 7,
      rationale:
        "Framework/dependency validators, verified library-surface grounding, and version-coherent surface checks now exist, but there is still no documentation retrieval or dynamic discovery path yet.",
    },
    {
      id: "CC4",
      name: "Pattern Knowledge",
      level: 6,
      target: 7,
      rationale:
        "Family emitters and project graphs encode reusable patterns across app/api/game/compiler/orm/parser families.",
    },
    {
      id: "CC5",
      name: "Constraint Adherence",
      level: 7,
      target: 8,
      rationale:
        "Coding runs through witness, floor, architecture, security, dependency, state, surface, integration, and execution constraints before emission.",
    },
    {
      id: "CC6",
      name: "Error Detection & Recovery",
      level: 6,
      target: 7,
      rationale:
        "Hostile sim, structured failure classes, NSL deterministic repair ladder, fail-closed collapse, and bounded temp-project compile/import/runtime smoke now exist across core families; deeper real-environment execution still remains.",
    },
    {
      id: "CC7",
      name: "Problem Decomposition",
      level: 6,
      target: 7,
      rationale:
        "Intent spec, skeleton contracts, family emitters, and multi-variant project graphs provide lawful decomposition, but graph search is still narrow.",
    },
    {
      id: "CC8",
      name: "Context Integration",
      level: 6,
      target: 7,
      rationale:
        "Refactor/app integration laws now include bounded local codebase indexing, actual local import-graph extraction, hot-module awareness, and repo boundary hints, but convention learning and deeper repo-native reasoning are still early.",
    },
    {
      id: "CC9",
      name: "Instruction Understanding",
      level: 6,
      target: 7,
      rationale:
        "Coding intent spec and clarification scoring exist, and ambiguous asks can be clarified rather than projected blindly.",
    },
  ];
}
