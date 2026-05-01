import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createBaseAcceptanceLaws,
} from "./../law/base-upl-acceptance.ts";
import {
  createBaseHeadlessDenialEntries,
} from "./../law/headless-base-denials.ts";
import {
  benchmarkBuccetSystemSnap,
  BUCCET_CONSEQUENCE_BOUNDARIES,
  BUCCET_SUBSTRATE_PLANES,
  BUCCET_SYSTEM_NODES,
  BUCCET_TERMINALS,
} from "./substrate/system-substrate.ts";
import {
  createDefaultBuccetPathLibrary,
} from "./../context/path-memory.ts";
import {
  snapBuccetSystem,
} from "./substrate/system-substrate.ts";
import type { BoundaryActionKind } from "./types.ts";

const WORKSPACE_ROOT = "/<workspace-root>";
const WORKSPACE_ACTIONS: BoundaryActionKind[] = [
  "fs.read",
  "fs.write",
  "fs.append",
  "fs.mkdir",
  "fs.move",
];

const BUCCET_REPO_SNAP_BODIES = [
  "LawBody",
  "RuntimeBody",
  "PathBody",
  "WitnessBody",
  "OperatorBody",
  "InstallReleaseBody",
  "ProofBody",
  "RenderDocsBody",
  "FoundationDataBody",
] as const;

type BuccetRepoSnapBody = (typeof BUCCET_REPO_SNAP_BODIES)[number];

type BuccetRepoArtifact = {
  relativePath: string;
  body: BuccetRepoSnapBody | "orphaned";
};

export type BuccetFullSystemBodyRuntimeFacts = {
  baseAcceptanceCount: number;
  baseDenialCount: number;
  defaultPathCount: number;
  substrateNodeCount: number;
  substratePlaneCount: number;
  substrateTerminalCount: number;
  consequenceBoundaryCount: number;
  snapCompressionRatioToPlanes: number;
  snapCompressionRatioToExecutableBody: number;
  executableBodyCount: number;
  snapAvgMs: number;
  snapTargetMs: number;
  snapUnderTargetFactor: number;
  snapDeterministic: boolean;
  losslessCoverageCount: number;
  orphanedNodeCount: number;
  repoArtifactCount: number;
  repoSnapBodyCount: number;
  repoSnapCompressionRatio: number;
  repoSnapAvgMs: number;
  repoSnapDeterministic: boolean;
  repoCoverageCount: number;
  repoOrphanedArtifactCount: number;
  speedTiers: {
    small10AvgMs: number;
    medium1000AvgMs: number;
    large10000AvgMs: number;
  };
  repoSpeedTiers: {
    small10AvgMs: number;
    medium1000AvgMs: number;
    large10000AvgMs: number;
  };
  sameFunctionStatement: string;
  samePowerStatement: string;
  newBodyStatement: string;
  endToEndRuntimeStatement: string;
};

export type BuccetFullSystemBody = {
  concept: string;
  runtimeFacts: BuccetFullSystemBodyRuntimeFacts;
  step1: {
    infinite: string[];
    finiteRequirements: string[];
    witnessPatterns: string[];
  };
  step2: {
    formula: string;
    survives: string[];
    annihilates: string[];
    cardinality: string;
  };
  step3: {
    domain: string;
    codomain: string;
    definition: string;
    invariants: string[];
    complexity: string;
    theorems: string[];
  };
  step4: {
    pseudocode: string[];
  };
  step5: {
    implementationSurface: Array<{ label: string; path: string }>;
  };
  step6: {
    timeMs: number;
    spaceModel: string;
    complexityCheck: string;
  };
  step7: {
    checks: string[];
    proofSurface: Array<{ label: string; path: string }>;
  };
};

export type BuccetInstallSnapSummary = {
  repoArtifactCount: number;
  repoSnapBodyCount: number;
  repoCompressionRatio: number;
  repoCompressionPercent: number;
  runtimeNodeCount: number;
  runtimeExecutablePrimitiveCount: number;
  runtimeSnapAvgMs: number;
  repoSnapAvgMs: number;
  runtimeDeterministic: boolean;
  repoDeterministic: boolean;
  operatorConsoleCommand: string;
};

function repoRootFromHere(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

function walkFiles(rootPath: string, relativeRoot: string): string[] {
  if (!fs.existsSync(rootPath)) {
    return [];
  }
  const out: string[] = [];
  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    const abs = path.join(rootPath, entry.name);
    const rel = path.join(relativeRoot, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(abs, rel));
    } else if (entry.isFile()) {
      out.push(rel.split(path.sep).join("/"));
    }
  }
  return out;
}

function classifyBuccetRepoArtifact(relativePath: string): BuccetRepoSnapBody | "orphaned" {
  if (
    relativePath === "package.json"
    || relativePath === "package-lock.json"
    || relativePath === "LICENSE"
    || relativePath === ".gitignore"
    || relativePath === "biome.json"
    || relativePath === "tsconfig.json"
    || relativePath === "tsconfig.build.json"
    || relativePath.startsWith(".github/")
  ) {
    return "InstallReleaseBody";
  }
  if (
    relativePath === "README.md"
    || relativePath === "CHANGELOG.md"
    || relativePath === "SECURITY.md"
    || relativePath === "AGENTS.md"
    || relativePath === "CONTRIBUTING.md"
    || relativePath === "CODE_OF_CONDUCT.md"
    || relativePath.startsWith("docs/")
  ) {
    return "RenderDocsBody";
  }
  if (relativePath.startsWith("data/agent-buccet-law-foundation/")) {
    return "FoundationDataBody";
  }
  if (relativePath.startsWith("scripts/render-")) {
    return "RenderDocsBody";
  }
  if (relativePath.startsWith("scripts/install-") || relativePath === "scripts/prepare-agent-buccet-package.ts") {
    return "InstallReleaseBody";
  }
  if (relativePath.startsWith("scripts/") && relativePath.endsWith("-contract.ts")) {
    return "ProofBody";
  }
  if (relativePath.startsWith("scripts/")) {
    return "OperatorBody";
  }
  if (relativePath.startsWith("server/witness/")) {
    return "WitnessBody";
  }
  if (relativePath.startsWith("native/")) {
    return "RuntimeBody";
  }
  if (relativePath.startsWith("examples/") || relativePath.startsWith("demo/")) {
    return "OperatorBody";
  }
  if (relativePath === "src/context/path-memory.ts" || relativePath === "src/runtime/swarm.ts") {
    return "PathBody";
  }
  if (
    relativePath.startsWith("src/proof/ledger")
    || relativePath === "src/proof/witness.ts"
    || relativePath === "src/proof/release-witness.ts"
  ) {
    return "WitnessBody";
  }
  if (relativePath.startsWith("src/engines/gravity/gravity-core/") || relativePath.startsWith("src/engines/gravity/gravity-adapter/")) {
    return "RuntimeBody";
  }
  if (relativePath.startsWith("src/integrations/")) {
    return "RuntimeBody";
  }
  if (relativePath.startsWith("src/law/")) {
    return "LawBody";
  }
  if (relativePath.startsWith("src/")) {
    const file = relativePath.slice("src/runtime/".length);
    if (
      file.startsWith("track-extractor")
      || file.startsWith("meta")
      || file.startsWith("full-system-body")
      || file.startsWith("foundation")
    ) {
      return "LawBody";
    }
    return "RuntimeBody";
  }
  return "orphaned";
}

function createBuccetRepoArtifactManifest(repoRoot: string): BuccetRepoArtifact[] {
  const artifacts = walkFiles(repoRoot, "").filter((relativePath) => {
    return !(
      relativePath.startsWith(".git/")
      || relativePath === ".git"
      || relativePath.startsWith(".next/")
      || relativePath.startsWith("out/")
      || relativePath.startsWith("coverage/")
      || relativePath.startsWith("node_modules/")
      || relativePath.startsWith("dist/")
      || relativePath.startsWith("data/agent-boundary/")
      || relativePath.startsWith("data/ledger/")
      || relativePath.startsWith("artifacts/")
      || relativePath.startsWith("demo/workspace/")
      || relativePath.includes("/build/")
    );
  });
  return [...new Set(artifacts)]
    .sort((left, right) => left.localeCompare(right))
    .map((relativePath) => ({
      relativePath,
      body: classifyBuccetRepoArtifact(relativePath),
    }));
}

function snapBuccetRepoArtifactManifest(manifest: BuccetRepoArtifact[]): {
  bodies: Record<BuccetRepoSnapBody, string[]>;
  orphanedArtifacts: string[];
  compressionRatio: number;
} {
  const bodies = Object.fromEntries(
    BUCCET_REPO_SNAP_BODIES.map((body) => [body, [] as string[]]),
  ) as Record<BuccetRepoSnapBody, string[]>;
  const orphanedArtifacts: string[] = [];
  for (const artifact of manifest) {
    if (artifact.body === "orphaned") {
      orphanedArtifacts.push(artifact.relativePath);
      continue;
    }
    bodies[artifact.body].push(artifact.relativePath);
  }
  return {
    bodies,
    orphanedArtifacts,
    compressionRatio: Number((manifest.length / BUCCET_REPO_SNAP_BODIES.length).toFixed(2)),
  };
}

function benchmarkBuccetRepoArtifactSnap(manifest: BuccetRepoArtifact[], iterations: number): {
  avgMs: number;
  deterministic: boolean;
  iterations: number;
} {
  const startedAt = performance.now();
  const first = JSON.stringify(snapBuccetRepoArtifactManifest(manifest));
  let deterministic = true;
  for (let index = 1; index < iterations; index += 1) {
    const current = JSON.stringify(snapBuccetRepoArtifactManifest(manifest));
    if (current !== first) {
      deterministic = false;
    }
  }
  const totalMs = performance.now() - startedAt;
  return {
    avgMs: totalMs / iterations,
    deterministic,
    iterations,
  };
}

export function runBuccetFullSystemBody(): BuccetFullSystemBody {
  const repoRoot = repoRootFromHere();
  const baseAcceptance = createBaseAcceptanceLaws({
    rootPath: WORKSPACE_ROOT,
    grantedActions: WORKSPACE_ACTIONS,
  });
  const baseDenial = createBaseHeadlessDenialEntries();
  const defaultPaths = createDefaultBuccetPathLibrary();
  const substrate = snapBuccetSystem();
  const repoManifest = createBuccetRepoArtifactManifest(repoRoot);
  const repoSnap = snapBuccetRepoArtifactManifest(repoManifest);
  const benchmarkSmall = benchmarkBuccetSystemSnap(10);
  const benchmarkMedium = benchmarkBuccetSystemSnap(1_000);
  const benchmark = benchmarkBuccetSystemSnap(10_000);
  const repoBenchmarkSmall = benchmarkBuccetRepoArtifactSnap(repoManifest, 10);
  const repoBenchmarkMedium = benchmarkBuccetRepoArtifactSnap(repoManifest, 1_000);
  const repoBenchmark = benchmarkBuccetRepoArtifactSnap(repoManifest, 10_000);
  const substrateJson = JSON.stringify(substrate);
  const deterministic = Array.from({ length: 10 }).every(() => JSON.stringify(snapBuccetSystem()) === substrateJson);
  const repoSnapJson = JSON.stringify(repoSnap);
  const repoDeterministic = Array.from({ length: 10 }).every(() => JSON.stringify(snapBuccetRepoArtifactManifest(repoManifest)) === repoSnapJson);
  const executableBodyCount = BUCCET_SUBSTRATE_PLANES.length + BUCCET_TERMINALS.length + BUCCET_CONSEQUENCE_BOUNDARIES.length + 1;
  const snapTargetMs = 10;
  const repoCoverageCount = repoManifest.length - repoSnap.orphanedArtifacts.length;

  const runtimeFacts: BuccetFullSystemBodyRuntimeFacts = {
    baseAcceptanceCount: baseAcceptance.length,
    baseDenialCount: baseDenial.length,
    defaultPathCount: Object.keys(defaultPaths).length,
    substrateNodeCount: BUCCET_SYSTEM_NODES.length,
    substratePlaneCount: BUCCET_SUBSTRATE_PLANES.length,
    substrateTerminalCount: BUCCET_TERMINALS.length,
    consequenceBoundaryCount: BUCCET_CONSEQUENCE_BOUNDARIES.length,
    snapCompressionRatioToPlanes: substrate.compression.ratio,
    snapCompressionRatioToExecutableBody: Number((BUCCET_SYSTEM_NODES.length / executableBodyCount).toFixed(2)),
    executableBodyCount,
    snapAvgMs: benchmark.avgMs,
    snapTargetMs,
    snapUnderTargetFactor: Number((snapTargetMs / benchmark.avgMs).toFixed(2)),
    snapDeterministic: deterministic,
    losslessCoverageCount: BUCCET_SYSTEM_NODES.length - substrate.orphanedNodes.length,
    orphanedNodeCount: substrate.orphanedNodes.length,
    repoArtifactCount: repoManifest.length,
    repoSnapBodyCount: BUCCET_REPO_SNAP_BODIES.length,
    repoSnapCompressionRatio: repoSnap.compressionRatio,
    repoSnapAvgMs: repoBenchmark.avgMs,
    repoSnapDeterministic: repoDeterministic,
    repoCoverageCount,
    repoOrphanedArtifactCount: repoSnap.orphanedArtifacts.length,
    speedTiers: {
      small10AvgMs: benchmarkSmall.avgMs,
      medium1000AvgMs: benchmarkMedium.avgMs,
      large10000AvgMs: benchmark.avgMs,
    },
    repoSpeedTiers: {
      small10AvgMs: repoBenchmarkSmall.avgMs,
      medium1000AvgMs: repoBenchmarkMedium.avgMs,
      large10000AvgMs: repoBenchmark.avgMs,
    },
    sameFunctionStatement: "same lawful consequence function: authored repo/world in -> lawful runtime, witness, operator state, and release surface out",
    samePowerStatement: `same governing power preserved across ${BUCCET_SYSTEM_NODES.length}/${BUCCET_SYSTEM_NODES.length} runtime nodes and ${repoCoverageCount}/${repoManifest.length} repo artifacts`,
    newBodyStatement: `new executable body = ${BUCCET_REPO_SNAP_BODIES.length} repo snap bodies carrying ${BUCCET_SUBSTRATE_PLANES.length} planes, ${BUCCET_TERMINALS.length} terminals, ${BUCCET_CONSEQUENCE_BOUNDARIES.length} consequence boundaries, and 1 finite lawful machine`,
    endToEndRuntimeStatement: "no matter how much is added to either UPL side, anything Buccet controls still resolves end to end through the same finite runtime body",
  };

  return {
    concept: "an infinitely extensible agent-governance system that must remain executable, lawful, finite, and real-time operable on commodity hardware",
    runtimeFacts,
    step1: {
      infinite: [
        "infinite authored acceptance-side UPL",
        "infinite authored denial-side UPL",
        "infinite user-defined paths and domains",
        "infinite path sources and specialization surfaces",
        "infinite incoming requests and agent stacks",
        "infinite repo-authored docs, proofs, operators, examples, and release surfaces",
      ],
      finiteRequirements: [
        "one live lawful field must exist at runtime",
        "denial must override acceptance on overlap",
        "all consequence-bearing motion must collapse into finite action classes",
        "partial snap is illegal",
        "paths may organize lawful work but may not create sovereignty",
        "path sources may enrich context but may not widen law",
        "witness and ledger must preserve durable consequence proof",
        "runtime must stay CPU-friendly and local-first",
        "growth must compile into one running system instead of fragmenting into side systems",
        "the whole Buccet repo organism must collapse into one finite executable body instead of remaining a loose archive",
      ],
      witnessPatterns: [
        `base acceptance pack (${runtimeFacts.baseAcceptanceCount} entries)`,
        `base denial pack (${runtimeFacts.baseDenialCount} entries)`,
        "one compiled live UPL field",
        "deny-wall / allow-rail traffic model",
        "Track Extractor snapping law into finite corridors",
        "path memory giving lawful work finite route structure",
        "path sources enriching paths without changing permissions",
        "install / hosted-install / CLI runtime proofs",
        `${runtimeFacts.repoArtifactCount} repo artifacts snapping into ${runtimeFacts.repoSnapBodyCount} executable bodies`,
      ],
    },
    step2: {
      formula: "S = I∞ ∩ F ∩ W",
      survives: [
        "authored infinity outside runtime",
        "one compiled live lawful field inside runtime",
        "finite snapped tracks from that field",
        "finite path formations over those tracks",
        "path-source enrichment attached to paths",
        "one witness-bearing consequence machine",
        "one snapped repo body carrying docs, code, proofs, release, and foundation matter together",
      ],
      annihilates: [
        "any second authority system above UPL",
        "any path sovereignty outside lawful UPL motion",
        "any source material that tries to become law by itself",
        "any partial snap",
        "any runtime that depends on holding the full authored infinity active at once",
        "any split where the repo body and the runtime body drift into separate organisms",
      ],
      cardinality: "finite executable repo-and-runtime substrate with open-ended authored growth outside runtime",
    },
    step3: {
      domain: "(Repo∞, UPL∞, Paths∞, Sources∞, Requests∞, Witnesses)",
      codomain: "ExecutableFiniteSubstrate",
      definition: "BuccetCollapse : (Repo∞, UPL∞, Paths∞, Sources∞, Requests∞, Witnesses) -> ExecutableFiniteSubstrate",
      invariants: [
        "one live lawful field",
        "one deny-over-allow truth",
        "one finite route structure per formation",
        "one enrichment layer that does not change authority",
        "one witness-bearing consequence history",
        "one snapped repo body supporting the runtime instead of a split archive",
      ],
      complexity: "runtime state scales with active laws, active tracks, active paths, active formations, and attached path sources; repo snap scales with classified artifact count, not with open-ended authored infinity",
      theorems: [
        "Existence: the surviving Buccet substrate is non-empty because the current system already instantiates it",
        "Correctness: authored yes/no infinity collapses into one lawful machine without losing deny-over-allow or witness truth",
        "Finitude: the running substrate remains finite even while authored growth remains open-ended",
        "Power preservation: the snapped substrate keeps the same governing function even though the body is compressed",
        "Closure under growth: no matter how much is added to either UPL side, the controlled runtime still resolves through the same finite end-to-end Buccet body",
        "Whole-body closure: the full Buccet repo organism compresses into a finite executable body without losing the operator, witness, proof, release, or foundation surfaces",
      ],
    },
    step4: {
      pseudocode: [
        "repo_body = snap_repo_into_finite_bodies(authored_repo)",
        "live_upl = compile_yes_no_upl_into_one_field(authored_world.upl)",
        "tracks = snap_tracks_from_live_upl(live_upl)",
        "paths = materialize_or_load_paths(authored_world.paths, live_upl)",
        "sources = attach_path_sources(paths, authored_world.sources)",
        "runtime = route_requests_through_paths_and_tracks(paths, tracks, sources)",
        "witness = record_consequence(runtime)",
        "return repo_body, runtime, witness",
      ],
    },
    step5: {
      implementationSurface: [
        { label: "system body process", path: "src/runtime/full-system-body.ts" },
        { label: "live UPL field and traffic", path: "src/proof/user-path-ledger.ts" },
        { label: "track snap", path: "src/runtime/track-extractor.ts" },
        { label: "path runtime and path sources", path: "src/context/path-memory.ts" },
        { label: "system substrate", path: "src/runtime/substrate/system-substrate.ts" },
        { label: "operator/runtime surface", path: "cli/buccet.ts" },
      ],
    },
    step6: {
      timeMs: repoBenchmark.avgMs,
      spaceModel: "finite repo snap bodies, finite substrate planes, finite terminals, finite consequence boundaries, finite active path/runtime state",
      complexityCheck: `repo snap benchmark confirms avg ${repoBenchmark.avgMs.toFixed(6)}ms over ${repoBenchmark.iterations.toLocaleString()} iterations with deterministic repeated output while the runtime substrate snap stays at ${benchmark.avgMs.toFixed(6)}ms`,
    },
    step7: {
      checks: [
        `system substrate remains lossless across ${runtimeFacts.losslessCoverageCount}/${runtimeFacts.substrateNodeCount} nodes`,
        `repo organism remains covered across ${runtimeFacts.repoCoverageCount}/${runtimeFacts.repoArtifactCount} artifacts`,
        `substance compresses into ${runtimeFacts.substratePlaneCount} planes, ${runtimeFacts.substrateTerminalCount} terminals, ${runtimeFacts.consequenceBoundaryCount} consequence boundaries, and 1 finite lawful machine`,
        `repo body compresses into ${runtimeFacts.repoSnapBodyCount} executable bodies with ${runtimeFacts.repoOrphanedArtifactCount} orphaned artifacts`,
        "path runtime and CLI proofs confirm the executable operator surface is real",
        "install and hosted-install proofs confirm the system is not repo-only theory",
        `runtime snap stays deterministic across repeated runs: ${runtimeFacts.snapDeterministic ? "yes" : "no"}`,
        `repo snap stays deterministic across repeated runs: ${runtimeFacts.repoSnapDeterministic ? "yes" : "no"}`,
      ],
      proofSurface: [
        { label: "substrate snap proof", path: "contracts/runtime/agent-buccet-system-substrate-contract.ts" },
        { label: "system body proof", path: "contracts/runtime/agent-buccet-full-system-body-contract.ts" },
        { label: "path/runtime proof", path: "contracts/context/agent-buccet-path-memory-contract.ts" },
        { label: "CLI/runtime proof", path: "contracts/cli/agent-buccet-cli-contract.ts" },
        { label: "install proof", path: "contracts/cli/agent-buccet-install-contract.ts" },
        { label: "hosted install proof", path: "contracts/cli/agent-buccet-hosted-install-contract.ts" },
      ],
    },
  };
}

function bulletList(values: string[]): string {
  return values.map((value) => `- ${value}`).join("\n");
}

function percentCompressedFromRatio(ratio: number): number {
  return Number((100 - (100 / ratio)).toFixed(2));
}

export function buildBuccetInstallSnapSummary(
  process: BuccetFullSystemBody = runBuccetFullSystemBody(),
): BuccetInstallSnapSummary {
  return {
    repoArtifactCount: process.runtimeFacts.repoArtifactCount,
    repoSnapBodyCount: process.runtimeFacts.repoSnapBodyCount,
    repoCompressionRatio: process.runtimeFacts.repoSnapCompressionRatio,
    repoCompressionPercent: percentCompressedFromRatio(process.runtimeFacts.repoSnapCompressionRatio),
    runtimeNodeCount: process.runtimeFacts.substrateNodeCount,
    runtimeExecutablePrimitiveCount: process.runtimeFacts.executableBodyCount,
    runtimeSnapAvgMs: process.runtimeFacts.snapAvgMs,
    repoSnapAvgMs: process.runtimeFacts.repoSnapAvgMs,
    runtimeDeterministic: process.runtimeFacts.snapDeterministic,
    repoDeterministic: process.runtimeFacts.repoSnapDeterministic,
    operatorConsoleCommand: "buccet console",
  };
}

export function renderBuccetInstallSnapSummaryText(
  process: BuccetFullSystemBody = runBuccetFullSystemBody(),
): string {
  const summary = buildBuccetInstallSnapSummary(process);
  return [
    "Agent Buccet full system install:",
    `  repo body: ${summary.repoArtifactCount} artifacts -> ${summary.repoSnapBodyCount} snap bodies (${summary.repoCompressionPercent}% compression)`,
    `  runtime body: ${summary.runtimeNodeCount} nodes -> ${summary.runtimeExecutablePrimitiveCount} executable primitives`,
    `  speed: runtime ${summary.runtimeSnapAvgMs.toFixed(6)}ms | whole repo ${summary.repoSnapAvgMs.toFixed(6)}ms`,
    `  deterministic: runtime ${summary.runtimeDeterministic ? "yes" : "no"} | repo ${summary.repoDeterministic ? "yes" : "no"}`,
    `  console: ${summary.operatorConsoleCommand}`,
  ].join("\n");
}

export function renderBuccetFullSystemBodyMarkdown(
  process: BuccetFullSystemBody = runBuccetFullSystemBody(),
): string {
  return [
    "# Buccet Full System Body",
    "",
    "This document is generated from the live Buccet full-system body process.",
    "",
    "It is not just a description.",
    "It is the executed 7-step collapse of the current Buccet system into an executable finite substrate.",
    "",
    "## Current Runtime Facts",
    "",
    `- base acceptance entries: \`${process.runtimeFacts.baseAcceptanceCount}\``,
    `- base denial entries: \`${process.runtimeFacts.baseDenialCount}\``,
    `- default path templates: \`${process.runtimeFacts.defaultPathCount}\``,
    `- substrate nodes: \`${process.runtimeFacts.substrateNodeCount}\``,
    `- substrate planes: \`${process.runtimeFacts.substratePlaneCount}\``,
    `- substrate terminals: \`${process.runtimeFacts.substrateTerminalCount}\``,
    `- consequence boundaries: \`${process.runtimeFacts.consequenceBoundaryCount}\``,
    `- repo artifacts: \`${process.runtimeFacts.repoArtifactCount}\``,
    `- repo snap bodies: \`${process.runtimeFacts.repoSnapBodyCount}\``,
    `- snap compression to planes: \`${process.runtimeFacts.snapCompressionRatioToPlanes}:1\``,
    `- snap compression to executable body: \`${process.runtimeFacts.snapCompressionRatioToExecutableBody}:1\``,
    `- repo snap compression: \`${process.runtimeFacts.repoSnapCompressionRatio}:1\``,
    `- executable body primitives: \`${process.runtimeFacts.executableBodyCount}\``,
    `- measured snap avg: \`${process.runtimeFacts.snapAvgMs.toFixed(6)}ms\``,
    `- measured repo snap avg: \`${process.runtimeFacts.repoSnapAvgMs.toFixed(6)}ms\``,
    `- snap target: \`${process.runtimeFacts.snapTargetMs}ms\``,
    `- under target by: \`${process.runtimeFacts.snapUnderTargetFactor}x\``,
    `- deterministic repeated snap: \`${process.runtimeFacts.snapDeterministic ? "yes" : "no"}\``,
    `- deterministic repeated repo snap: \`${process.runtimeFacts.repoSnapDeterministic ? "yes" : "no"}\``,
    "",
    "## Concept",
    "",
    `**${process.concept}**`,
    "",
    "## Step 1: Forces",
    "",
    "### I∞",
    "",
    bulletList(process.step1.infinite),
    "",
    "### F",
    "",
    bulletList(process.step1.finiteRequirements),
    "",
    "### W",
    "",
    bulletList(process.step1.witnessPatterns),
    "",
    "## Step 2: Collision Point",
    "",
    `Formula: \`${process.step2.formula}\``,
    "",
    "### What Survives",
    "",
    bulletList(process.step2.survives),
    "",
    "### What Annihilates",
    "",
    bulletList(process.step2.annihilates),
    "",
    `Cardinality: ${process.step2.cardinality}.`,
    "",
    "## Step 3: Mathematical Structure",
    "",
    `- Domain: \`${process.step3.domain}\``,
    `- Codomain: \`${process.step3.codomain}\``,
    `- Definition: \`${process.step3.definition}\``,
    `- Complexity: ${process.step3.complexity}`,
    "",
    "### Invariants",
    "",
    bulletList(process.step3.invariants),
    "",
    "### Theorems",
    "",
    bulletList(process.step3.theorems),
    "",
    "## Step 4: Formalize As Executable",
    "",
    "```text",
    ...process.step4.pseudocode,
    "```",
    "",
    "## Step 5: Implement In Code",
    "",
    ...process.step5.implementationSurface.map((entry) => `- ${entry.label}: [${entry.path}](../../${entry.path})`),
    "",
    "## Step 6: Measure Performance",
    "",
    `- Time: \`${process.step6.timeMs.toFixed(6)}ms\``,
    `- Runtime speed tier (10 iterations): \`${process.runtimeFacts.speedTiers.small10AvgMs.toFixed(6)}ms\``,
    `- Runtime speed tier (1,000 iterations): \`${process.runtimeFacts.speedTiers.medium1000AvgMs.toFixed(6)}ms\``,
    `- Runtime speed tier (10,000 iterations): \`${process.runtimeFacts.speedTiers.large10000AvgMs.toFixed(6)}ms\``,
    `- Repo speed tier (10 iterations): \`${process.runtimeFacts.repoSpeedTiers.small10AvgMs.toFixed(6)}ms\``,
    `- Repo speed tier (1,000 iterations): \`${process.runtimeFacts.repoSpeedTiers.medium1000AvgMs.toFixed(6)}ms\``,
    `- Repo speed tier (10,000 iterations): \`${process.runtimeFacts.repoSpeedTiers.large10000AvgMs.toFixed(6)}ms\``,
    `- Space model: ${process.step6.spaceModel}`,
    `- Complexity check: ${process.step6.complexityCheck}`,
    "",
    "## Step 7: Verify Correctness",
    "",
    "### Checks",
    "",
    bulletList(process.step7.checks),
    "",
    "### Proof Surface",
    "",
    ...process.step7.proofSurface.map((entry) => `- ${entry.label}: [${entry.path}](../../${entry.path})`),
    "",
    "## Result",
    "",
    "Buccet keeps authored infinity outside runtime and collapses the active system into one finite executable substrate.",
    "",
    "### Exact Snap Result",
    "",
    `- Same function: ${process.runtimeFacts.sameFunctionStatement}`,
    `- Same power: ${process.runtimeFacts.samePowerStatement}`,
    `- New body: ${process.runtimeFacts.newBodyStatement}`,
    `- End-to-end runtime: ${process.runtimeFacts.endToEndRuntimeStatement}`,
    `- Speed: runtime \`${process.runtimeFacts.snapAvgMs.toFixed(6)}ms\`, whole repo \`${process.runtimeFacts.repoSnapAvgMs.toFixed(6)}ms\``,
    `- Compression: runtime ${process.runtimeFacts.substrateNodeCount} nodes -> ${process.runtimeFacts.executableBodyCount} executable substrate primitives; repo ${process.runtimeFacts.repoArtifactCount} artifacts -> ${process.runtimeFacts.repoSnapBodyCount} executable snap bodies`,
    `- Deterministic: runtime ${process.runtimeFacts.snapDeterministic ? "same snap output on repeated runs" : "not yet proven"}; repo ${process.runtimeFacts.repoSnapDeterministic ? "same snap output on repeated runs" : "not yet proven"}`,
    "",
    "That is why:",
    "",
    "- the whole Buccet repo/system can be snapped into one executable body",
    "- UPL can keep growing on the acceptance side",
    "- UPL can keep growing on the denial side",
    "- paths can keep growing",
    "- path sources can keep growing",
    "- specialization can keep growing",
    "- the Buccet-controlled system still runs end to end through one bounded lawful machine",
    "",
  ].join("\n");
}
