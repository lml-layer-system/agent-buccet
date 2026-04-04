import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBaseAcceptanceLaws } from "../lib/agent-buccet/base-upl-acceptance.ts";
import {
  BASE_AWESOME_OPENCLAW_SKILL_ACCEPTANCE_LANES,
} from "../lib/agent-buccet/awesome-openclaw-skill-acceptance.ts";
import {
  BASE_LIST_V_ACCEPTANCE_LANES,
  createListVWorkflowAcceptanceLanes,
  type ListVAcceptanceLane,
} from "../lib/agent-buccet/list-v-acceptance.ts";
import {
  BASE_OPENCLAW_SKILL_ACCEPTANCE_LANES,
  type OpenClawSkillAcceptanceLane,
} from "../lib/agent-buccet/openclaw-skill-acceptance.ts";
import type { BoundaryActionKind, CompiledDocumentLaw } from "../lib/agent-buccet/types.ts";

type BaseEntry = {
  id: string;
  whatItIs: string;
  connectsTo: string;
  actionKinds: readonly BoundaryActionKind[];
  bounds: string;
};

type LaneLike = {
  id: string;
  summary: string;
  actionKinds: readonly BoundaryActionKind[];
  targetPattern?: string;
  targetPatterns?: readonly string[];
  targetMatchMode?: "prefix" | "exact" | "regex";
};

const WORKSPACE_ROOT = "/<workspace-root>";
const ALL_WORKSPACE_ACTIONS: readonly BoundaryActionKind[] = [
  "fs.read",
  "fs.write",
  "fs.append",
  "fs.mkdir",
  "fs.move",
];

const WORKSPACE_ENTRY_IDS = [
  "ACCEPT.WORKSPACE.READ.001",
  "ACCEPT.WORKSPACE.MUTATION.002",
  "ACCEPT.LOCAL.ORGANIZATION.003",
  "ACCEPT.INTERNAL.ARTIFACTS.004",
  "ACCEPT.NOTES.TASKS.007",
] as const;

const SAFE_EXEC_ENTRY_IDS = [
  "ACCEPT.SAFE.LOCAL.EXEC.005A",
  "ACCEPT.SAFE.LOCAL.EXEC.005B",
  "ACCEPT.SAFE.LOCAL.EXEC.005C",
  "ACCEPT.SAFE.LOCAL.EXEC.005D",
] as const;

const WEB_RESEARCH_ENTRY_IDS = [
  "ACCEPT.BOUNDED.WEB.RESEARCH.006A",
  "ACCEPT.BOUNDED.WEB.RESEARCH.006B",
  "ACCEPT.BOUNDED.WEB.RESEARCH.006C",
] as const;

function repoRootFromHere() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(scriptDir, "..");
}

function cleanSummary(summary: string): string {
  return summary
    .replace(/^(?:named|bounded)\s+rail\s+for\s+/i, "")
    .replace(/\.$/, "");
}

function normalizeDisplay(value: string): string {
  return value.replaceAll(WORKSPACE_ROOT, "<workspace-root>");
}

function extractReason(law: CompiledDocumentLaw): string {
  const description = law.trackConstraint?.description ?? law.notes ?? law.requestBasis.target;
  const [, reason = description] = description.split(" — ", 2);
  return reason.replace(/\.$/, "");
}

function codeList(values: readonly string[]): string {
  return values.map((value) => `\`${normalizeDisplay(value)}\``).join(", ");
}

function describeRegexPattern(pattern: string): string {
  const exactMatch = pattern.match(/^\/\^([A-Za-z0-9._-]+)\$\/i?$/);
  if (exactMatch) {
    return `exact target \`${exactMatch[1]}\``;
  }

  const extMatch = pattern.match(/\\\.\(\?:([^)]+)\)/);
  if (pattern.includes(WORKSPACE_ROOT) && extMatch) {
    const extensions = extMatch[1]
      .split("|")
      .map((part) => part.replaceAll("\\", ""))
      .map((part) => `.${part}`);
    return `workspace files ending in ${codeList(extensions)}`;
  }

  const domainMatches = [...pattern.matchAll(/([A-Za-z0-9-]+(?:\\\.[A-Za-z0-9-]+)+)/g)]
    .map((match) => match[1].replaceAll("\\.", "."))
    .filter((value) => value !== "https" && value !== "www")
    .map((value) => value.replace(/^\(\?:/, "").replace(/\)$/, ""));
  if (domainMatches.length > 0) {
    return `bounded host corridors ${codeList([...new Set(domainMatches)])}`;
  }

  return `bounded regex corridor \`${normalizeDisplay(pattern)}\``;
}

function describeConnectsToFromLane(lane: LaneLike): string {
  if (lane.targetPatterns?.length) {
    const described = lane.targetPatterns.map((pattern) => {
      if (lane.targetMatchMode === "exact") {
        return `exact Buccet target \`${normalizeDisplay(pattern)}\``;
      }
      if (lane.targetMatchMode === "prefix") {
        return `prefix corridor \`${normalizeDisplay(pattern)}\``;
      }
      return describeRegexPattern(pattern);
    });
    return [...new Set(described)].join("; ");
  }
  if (lane.targetPattern) {
    if (lane.targetMatchMode === "prefix") {
      return `prefix corridor \`${normalizeDisplay(lane.targetPattern)}\``;
    }
    if (lane.targetMatchMode === "exact") {
      return `exact Buccet target \`${normalizeDisplay(lane.targetPattern)}\``;
    }
    return `bounded regex corridor \`${normalizeDisplay(lane.targetPattern)}\``;
  }
  return "request-basis target only";
}

function describeBoundsFromLane(lane: LaneLike): string {
  if (lane.targetMatchMode === "prefix") {
    return "listed prefix corridor only; deny still wins on overlap";
  }
  if (lane.targetMatchMode === "regex") {
    return "listed bounded corridors only; deny still wins on overlap";
  }
  if (lane.targetMatchMode === "exact") {
    return "exact named target only; deny still wins on overlap";
  }
  return "request-basis scope only; deny still wins on overlap";
}

function compiledLawToEntry(law: CompiledDocumentLaw): BaseEntry {
  return {
    id: law.trackConstraint?.description?.split(" — ", 1)[0] ?? law.requestBasis.target,
    whatItIs: extractReason(law),
    connectsTo: describeConnectsToFromLane({
      id: law.trackConstraint?.description ?? law.requestBasis.target,
      summary: law.notes,
      actionKinds: law.trackConstraint?.allowedActionKinds ?? [law.requestBasis.actionKind],
      targetPattern: law.trackConstraint?.targetPattern,
      targetPatterns: law.trackConstraint?.targetPatterns,
      targetMatchMode: law.trackConstraint?.targetMatchMode,
    }),
    actionKinds: law.trackConstraint?.allowedActionKinds ?? [law.requestBasis.actionKind],
    bounds: describeBoundsFromLane({
      id: law.trackConstraint?.description ?? law.requestBasis.target,
      summary: law.notes,
      actionKinds: law.trackConstraint?.allowedActionKinds ?? [law.requestBasis.actionKind],
      targetPattern: law.trackConstraint?.targetPattern,
      targetPatterns: law.trackConstraint?.targetPatterns,
      targetMatchMode: law.trackConstraint?.targetMatchMode,
    }),
  };
}

function laneToEntry(label: string, lane: LaneLike): BaseEntry {
  return {
    id: lane.id,
    whatItIs: cleanSummary(lane.summary),
    connectsTo: describeConnectsToFromLane(lane),
    actionKinds: lane.actionKinds,
    bounds: describeBoundsFromLane(lane),
  };
}

function renderEntry(entry: BaseEntry, label?: string): string {
  const heading = label ? `${entry.id} — ${label}` : entry.id;
  return [
    `### ${heading}`,
    `What it is: ${entry.whatItIs}.`,
    `Connects to: ${entry.connectsTo}.`,
    `Action kinds: ${codeList(entry.actionKinds)}.`,
    `Bounds: ${entry.bounds}.`,
    "",
  ].join("\n");
}

function entryMap(laws: readonly CompiledDocumentLaw[]) {
  return new Map(laws.map((law) => [law.trackConstraint?.description?.split(" — ", 1)[0] ?? law.requestBasis.target, law]));
}

async function main() {
  const repoRoot = repoRootFromHere();
  const outputPath = path.join(repoRoot, "docs/agent-boundary/BASE_ACCEPTANCE_PACK.md");
  const compiledLaws = createBaseAcceptanceLaws({
    rootPath: WORKSPACE_ROOT,
    grantedActions: ALL_WORKSPACE_ACTIONS,
  });
  const byId = entryMap(compiledLaws);

  const workspaceEntries = WORKSPACE_ENTRY_IDS.map((id) => compiledLawToEntry(byId.get(id)!));
  const safeExecEntries = SAFE_EXEC_ENTRY_IDS.map((id) => compiledLawToEntry(byId.get(id)!));
  const webResearchEntries = WEB_RESEARCH_ENTRY_IDS.map((id) => compiledLawToEntry(byId.get(id)!));
  const bundledOpenClawEntries = BASE_OPENCLAW_SKILL_ACCEPTANCE_LANES.map((lane) =>
    laneToEntry((lane as OpenClawSkillAcceptanceLane).skill, lane),
  );
  const awesomeOpenClawEntries = BASE_AWESOME_OPENCLAW_SKILL_ACCEPTANCE_LANES.map((lane) =>
    laneToEntry((lane as OpenClawSkillAcceptanceLane).skill, lane),
  );
  const curatedCapabilityEntries = BASE_LIST_V_ACCEPTANCE_LANES.map((lane) =>
    laneToEntry((lane as ListVAcceptanceLane).capability, lane),
  );
  const curatedWorkflowEntries = createListVWorkflowAcceptanceLanes(WORKSPACE_ROOT).map((lane) =>
    laneToEntry((lane as ListVAcceptanceLane).capability, lane),
  );

  const totalCount =
    workspaceEntries.length +
    safeExecEntries.length +
    webResearchEntries.length +
    bundledOpenClawEntries.length +
    awesomeOpenClawEntries.length +
    curatedCapabilityEntries.length +
    curatedWorkflowEntries.length;

  const doc = [
    "# Base Acceptance Pack Inventory",
    "",
    "> Generated from Buccet acceptance sources. Regenerate with `node scripts/render-agent-buccet-base-acceptance-pack.ts`.",
    "",
    "This document enumerates the live shipped base Buccet acceptance UPL pack.",
    "",
    "It is one acceptance-side UPL system. Runtime still compiles it into the same live field as denial, and deny overrides acceptance on overlap.",
    "",
    "## Summary",
    "",
    `- Total acceptance-side UPL entries seeded per opened workspace session: ${totalCount}`,
    `- Workspace entries: ${workspaceEntries.length}`,
    `- Safe local exec entries: ${safeExecEntries.length}`,
    `- Bounded web research entries: ${webResearchEntries.length}`,
    `- OpenClaw skill entries: ${bundledOpenClawEntries.length + awesomeOpenClawEntries.length}`,
    `  Bundled OpenClaw entries: ${bundledOpenClawEntries.length}`,
    `  Awesome OpenClaw entries: ${awesomeOpenClawEntries.length}`,
    `- Curated capability entries: ${curatedCapabilityEntries.length}`,
    `- Curated workflow entries: ${curatedWorkflowEntries.length}`,
    "",
    "## Buccet Labels",
    "",
    "- `ACCEPT.WORKSPACE.*`: built-in Buccet workspace yes-side entries.",
    "- `ACCEPT.SAFE.LOCAL.EXEC.*`: built-in Buccet bounded local command entries.",
    "- `ACCEPT.BOUNDED.WEB.RESEARCH.*`: built-in Buccet bounded retrieval and research entries.",
    "- `ACCEPT.OPENCLAW.SKILL.*`: OpenClaw-derived yes-side entries carried inside the same Buccet acceptance pack.",
    "- `ACCEPT.CURATED.CAPABILITY.*`: curated named yes-side entries from the broader public capability scan.",
    "- `ACCEPT.CURATED.WORKFLOW.*`: workflow-shaped yes-side entries that make the pack read like real work instead of tool names.",
    "",
    "## Read This",
    "",
    "Every entry below uses the same fields:",
    "",
    "- `What it is`: the plain-language job this acceptance entry opens.",
    "- `Connects to`: the exact named target, provider/app corridor, or workspace path shape it connects to.",
    "- `Action kinds`: the allowed motion kinds on that entry.",
    "- `Bounds`: the shape limit of the entry. Deny still wins on overlap everywhere.",
    "",
    "Throughout this document, `<workspace-root>` means the workspace path the user explicitly opened into lawful scope.",
    "",
    `## Workspace Entries (${workspaceEntries.length})`,
    "",
    ...workspaceEntries.map((entry) => renderEntry(entry)),
    `## Safe Local Exec Entries (${safeExecEntries.length})`,
    "",
    ...safeExecEntries.map((entry) => renderEntry(entry)),
    `## Bounded Web Research Entries (${webResearchEntries.length})`,
    "",
    ...webResearchEntries.map((entry) => renderEntry(entry)),
    `## Bundled OpenClaw Skill Entries (${bundledOpenClawEntries.length})`,
    "",
    ...bundledOpenClawEntries.map((entry, index) =>
      renderEntry(entry, BASE_OPENCLAW_SKILL_ACCEPTANCE_LANES[index]!.skill),
    ),
    `## Awesome OpenClaw Skill Entries (${awesomeOpenClawEntries.length})`,
    "",
    ...awesomeOpenClawEntries.map((entry, index) =>
      renderEntry(entry, BASE_AWESOME_OPENCLAW_SKILL_ACCEPTANCE_LANES[index]!.skill),
    ),
    `## Curated Capability Entries (${curatedCapabilityEntries.length})`,
    "",
    ...curatedCapabilityEntries.map((entry, index) =>
      renderEntry(entry, BASE_LIST_V_ACCEPTANCE_LANES[index]!.capability),
    ),
    `## Curated Workflow Entries (${curatedWorkflowEntries.length})`,
    "",
    ...curatedWorkflowEntries.map((entry, index) =>
      renderEntry(entry, createListVWorkflowAcceptanceLanes(WORKSPACE_ROOT)[index]!.capability),
    ),
    "## Important Limits",
    "",
    "- The base acceptance pack does not create a broad shell entry.",
    "- The base acceptance pack does not create a broad outbound network entry.",
    "- The base acceptance pack does not open delete.",
    "- The base acceptance pack does not open secret roots.",
    "- The base acceptance pack does not override the denial constitution.",
    "",
    "At runtime, these entries enter the same live UPL field as denial walls. If an acceptance entry overlaps a denial wall, deny wins.",
    "",
  ].join("\n");

  await fs.writeFile(outputPath, doc, "utf8");
  console.log(`rendered ${path.relative(repoRoot, outputPath)} (${totalCount} acceptance entries)`);
}

await main();
