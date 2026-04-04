import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createBaseHeadlessDenialEntries,
} from "../lib/agent-buccet/headless-base-denials.ts";
import type {
  BoundaryActionFlagName,
  BoundaryActionKind,
  BoundaryUplEntry,
} from "../lib/agent-buccet/types.ts";

type DenialEntryDoc = {
  id: string;
  whatItIs: string;
  connectsTo: string;
  actionKinds: readonly BoundaryActionKind[];
  bounds: string;
};

function repoRootFromHere() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(scriptDir, "..");
}

function normalizeDisplay(value: string): string {
  return value.replaceAll("\\/", "/").replaceAll("\\.", ".");
}

function codeList(values: readonly string[]): string {
  return values.map((value) => `\`${normalizeDisplay(value)}\``).join(", ");
}

function extractReason(entry: BoundaryUplEntry): string {
  const notes = entry.notes ?? entry.trackConstraint?.description ?? entry.id;
  const match = notes.match(/^\[[^\]]+\]\s*(.+)$/);
  return (match?.[1] ?? notes).replace(/\.$/, "");
}

function regexLiteralToGlob(pattern: string): string {
  return pattern
    .replace(/^\/\^?/, "")
    .replace(/\$?\/i$/, "")
    .replaceAll("\\/", "/")
    .replaceAll("\\.", ".")
    .replaceAll(".*", "*")
    .replaceAll("\\-", "-")
    .replaceAll("\\(", "(")
    .replaceAll("\\)", ")")
    .replaceAll("\\+", "+")
    .replaceAll("\\?", "?")
    .replaceAll("\\[", "[")
    .replaceAll("\\]", "]")
    .replaceAll("\\s", " ")
    .replaceAll("\\", "");
}

function describeTargetPatterns(entry: BoundaryUplEntry): string[] {
  const patterns = entry.trackConstraint?.targetPatterns ?? [];
  return patterns.map((pattern) => {
    const pretty = regexLiteralToGlob(pattern);
    if (pretty.includes("://") || pretty.includes(".com") || pretty.includes(".org") || pretty.includes(".net")) {
      return `bounded target corridor ${`\`${pretty}\``}`;
    }
    return `bounded target corridor ${`\`${pretty}\``}`;
  });
}

function describeRequestPatterns(entry: BoundaryUplEntry): string[] {
  const patterns = entry.trackConstraint?.requestTextPatterns ?? [];
  return patterns.map((pattern) => {
    const pretty = regexLiteralToGlob(pattern);
    return `request text trigger ${`\`${pretty}\``}`;
  });
}

function describeFlags(flags: readonly BoundaryActionFlagName[] | undefined): string[] {
  return (flags ?? []).map((flag) => `required flag \`${flag}\``);
}

function describeConnectsTo(entry: BoundaryUplEntry): string {
  const parts = [
    ...describeTargetPatterns(entry),
    ...describeRequestPatterns(entry),
    ...describeFlags(entry.trackConstraint?.requiredFlags),
  ];

  if (parts.length > 0) {
    return parts.join("; ");
  }

  return `global Buccet denial target \`${entry.requestBasis?.target ?? entry.id}\``;
}

function describeBounds(entry: BoundaryUplEntry): string {
  const pieces: string[] = [];
  if (entry.trackConstraint?.targetPatterns?.length) {
    pieces.push("listed target corridors only");
  }
  if (entry.trackConstraint?.requestTextPatterns?.length) {
    pieces.push("listed request-text triggers only");
  }
  if (entry.trackConstraint?.requiredFlags?.length) {
    pieces.push("listed flags must be present");
  }
  if (pieces.length === 0) {
    pieces.push("global standing wall");
  }
  pieces.push("deny wins on overlap");
  return pieces.join("; ");
}

function entryToDoc(entry: BoundaryUplEntry): DenialEntryDoc {
  return {
    id: entry.id,
    whatItIs: extractReason(entry),
    connectsTo: describeConnectsTo(entry),
    actionKinds: entry.trackConstraint?.allowedActionKinds ?? [entry.requestBasis?.actionKind ?? "fs.read"],
    bounds: describeBounds(entry),
  };
}

function renderEntry(entry: DenialEntryDoc): string {
  return [
    `### ${entry.id}`,
    `What it is: ${entry.whatItIs}.`,
    `Connects to: ${entry.connectsTo}.`,
    `Action kinds: ${codeList(entry.actionKinds)}.`,
    `Bounds: ${entry.bounds}.`,
    "",
  ].join("\n");
}

function splitDenialEntries(entries: readonly BoundaryUplEntry[]) {
  const core = entries.filter((entry) =>
    !entry.id.startsWith("DENY.BOUNDARY.") &&
    !entry.id.startsWith("DENY.PERIODIC.") &&
    !entry.id.startsWith("DENY.BUCCET.") &&
    !entry.id.startsWith("DENY.BASE.CATALOG.") &&
    !entry.id.startsWith("DENY.BASE.ALIAS."),
  );
  const boundary = entries.filter((entry) => entry.id.startsWith("DENY.BOUNDARY."));
  const periodic = entries.filter((entry) => entry.id.startsWith("DENY.PERIODIC."));
  const buccetFailure = entries.filter((entry) => entry.id.startsWith("DENY.BUCCET."));
  const catalog = entries.filter((entry) => entry.id.startsWith("DENY.BASE.CATALOG."));
  const aliases = entries.filter((entry) => entry.id.startsWith("DENY.BASE.ALIAS."));
  return { core, boundary, periodic, buccetFailure, catalog, aliases };
}

async function main() {
  const repoRoot = repoRootFromHere();
  const outputPath = path.join(repoRoot, "docs/agent-boundary/BASE_DENIAL_PACK.md");
  const entries = createBaseHeadlessDenialEntries();
  const groups = splitDenialEntries(entries);

  const doc = [
    "# Base Denial Pack Inventory",
    "",
    "> Generated from Buccet denial sources. Regenerate with `node scripts/render-agent-buccet-base-denial-pack.ts`.",
    "",
    "This document enumerates the live shipped base Buccet denial UPL pack.",
    "",
    "It is one denial-side UPL system. Runtime still compiles it into the same live field as acceptance, and deny overrides acceptance on overlap.",
    "",
    "## Summary",
    "",
    `- Total denial-side UPL entries: ${entries.length}`,
    `- Core walls: ${groups.core.length}`,
    `- Boundary walls: ${groups.boundary.length}`,
    `- Periodic taxonomy walls: ${groups.periodic.length}`,
    `- Buccet failure walls: ${groups.buccetFailure.length}`,
    `- Base catalog walls: ${groups.catalog.length}`,
    `- Frontier/system-card alias walls: ${groups.aliases.length}`,
    "",
    "## Buccet Labels",
    "",
    "- `DENY.<CORE_CLASS>.*`: built-in Buccet standing walls for destructive, secret, exfiltration, spoofing, tamper, and related classes.",
    "- `DENY.BOUNDARY.*`: Buccet boundary walls for scope, law, session, and ledger/proof abuse.",
    "- `DENY.PERIODIC.*`: periodic failure taxonomy rows and dimensions carried into the same denial-side UPL field.",
    "- `DENY.BUCCET.*`: Buccet failure dimensions, containment laws, and failure rows carried into the same denial-side UPL field.",
    "- `DENY.BASE.CATALOG.*`: base Buccet denial catalog rows carried into the same denial-side UPL field.",
    "- `DENY.BASE.ALIAS.*`: frontier/system-card alias vocabulary carried into the same denial-side UPL field.",
    "",
    "## Read This",
    "",
    "Every entry below uses the same fields:",
    "",
    "- `What it is`: the plain-language job of the denial entry.",
    "- `Connects to`: the target corridors, request-text triggers, or required flags that activate it.",
    "- `Action kinds`: the motion kinds it applies to.",
    "- `Bounds`: the exact limit of the wall. Deny still wins on overlap everywhere.",
    "",
    `## Core Walls (${groups.core.length})`,
    "",
    ...groups.core.map((entry) => renderEntry(entryToDoc(entry))),
    `## Boundary Walls (${groups.boundary.length})`,
    "",
    ...groups.boundary.map((entry) => renderEntry(entryToDoc(entry))),
    `## Periodic Taxonomy Walls (${groups.periodic.length})`,
    "",
    ...groups.periodic.map((entry) => renderEntry(entryToDoc(entry))),
    `## Buccet Failure Walls (${groups.buccetFailure.length})`,
    "",
    ...groups.buccetFailure.map((entry) => renderEntry(entryToDoc(entry))),
    `## Base Catalog Walls (${groups.catalog.length})`,
    "",
    ...groups.catalog.map((entry) => renderEntry(entryToDoc(entry))),
    `## Frontier/System-Card Alias Walls (${groups.aliases.length})`,
    "",
    ...groups.aliases.map((entry) => renderEntry(entryToDoc(entry))),
    "## Important Limits",
    "",
    "- Alias entries do not create a second engine.",
    "- Periodic rows do not create a second engine.",
    "- Catalog rows do not create a second engine.",
    "- All of these stay inside the same Buccet denial-side UPL field.",
    "",
    "At runtime, these entries enter the same live UPL field as acceptance entries. If an acceptance entry overlaps a denial wall, deny wins.",
    "",
  ].join("\n");

  await fs.writeFile(outputPath, doc, "utf8");
  console.log(`rendered ${path.relative(repoRoot, outputPath)} (${entries.length} denial entries)`);
}

await main();
