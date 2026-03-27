import { performance } from "node:perf_hooks";

export const BUCCET_SYSTEM_NODES = [
  "bootstrap",
  "install",
  "runtime_store",
  "intercept",
  "hook",
  "adapter_bridge",
  "action_class_mapper",
  "input_admission",
  "scope",
  "grants",
  "path_law",
  "base_laws",
  "upl",
  "document_import",
  "track_extractor",
  "expression_corridor",
  "output_corridor",
  "completion_corridor",
  "action_corridor",
  "governor",
  "gravity",
  "bodyguard",
  "approvals",
  "swarm",
  "payload_physics",
  "ledger",
  "witness",
  "release_witness",
  "restart_fail_closed",
] as const;

export type BuccetSystemNode = (typeof BUCCET_SYSTEM_NODES)[number];

export const BUCCET_SUBSTRATE_PLANES = [
  "LifecyclePlane",
  "AuthorityPlane",
  "TranslationPlane",
  "BoundaryPlane",
  "ControlPlane",
  "WitnessPlane",
] as const;

export type BuccetSubstratePlane = (typeof BUCCET_SUBSTRATE_PLANES)[number];

export const BUCCET_TERMINALS = [
  "Terminal1",
  "Terminal2",
  "Terminal3",
] as const;

export type BuccetTerminal = (typeof BUCCET_TERMINALS)[number];

export const BUCCET_CONSEQUENCE_BOUNDARIES = [
  "InputAdmissionBoundary",
  "ActionBoundary",
  "OutputBoundary",
  "PayloadPhysicsBoundary",
] as const;

export type BuccetConsequenceBoundary = (typeof BUCCET_CONSEQUENCE_BOUNDARIES)[number];

export type BuccetSystemGraph = {
  nodes: BuccetSystemNode[];
};

export type BuccetSubstrate = {
  systemGraph: BuccetSystemGraph;
  planes: Record<BuccetSubstratePlane, BuccetSystemNode[]>;
  terminals: Record<BuccetTerminal, {
    planes: BuccetSubstratePlane[];
    role: string;
  }>;
  consequenceBoundaries: BuccetConsequenceBoundary[];
  firingOrder: string[];
  orphanedNodes: BuccetSystemNode[];
  isLossless: boolean;
  compression: {
    nodeCount: number;
    planeCount: number;
    ratio: number;
  };
};

const DEFAULT_PLANE_MAP: Record<BuccetSubstratePlane, BuccetSystemNode[]> = {
  LifecyclePlane: [
    "bootstrap",
    "install",
    "runtime_store",
    "restart_fail_closed",
  ],
  AuthorityPlane: [
    "scope",
    "grants",
    "path_law",
    "base_laws",
    "upl",
    "document_import",
    "approvals",
  ],
  TranslationPlane: [
    "intercept",
    "hook",
    "adapter_bridge",
    "action_class_mapper",
  ],
  BoundaryPlane: [
    "input_admission",
    "payload_physics",
  ],
  ControlPlane: [
    "track_extractor",
    "expression_corridor",
    "output_corridor",
    "completion_corridor",
    "action_corridor",
    "governor",
    "gravity",
    "bodyguard",
    "swarm",
  ],
  WitnessPlane: [
    "ledger",
    "witness",
    "release_witness",
  ],
};

const DEFAULT_TERMINALS: BuccetSubstrate["terminals"] = {
  Terminal1: {
    planes: ["TranslationPlane", "BoundaryPlane"],
    role: "catch, freeze, tarpit, hold, apply verdict",
  },
  Terminal2: {
    planes: ["AuthorityPlane", "ControlPlane"],
    role: "decide lawfully",
  },
  Terminal3: {
    planes: ["WitnessPlane"],
    role: "prove the full path",
  },
};

const DEFAULT_FIRING_ORDER = [
  "LifecyclePlane boots the organism",
  "TranslationPlane maps raw stack and OS events into finite Buccet actions",
  "BoundaryPlane catches the event before consequence",
  "Input Admission fires first when the event is inbound",
  "ControlPlane consults AuthorityPlane",
  "Track Extractor products constrain motion",
  "Governor, gravity, and bodyguard resolve pressure and legality",
  "Approval, scope, and law updates may mutate AuthorityPlane",
  "BoundaryPlane applies ALLOW, DENY, REQUIRE_APPROVAL, or TARPIT",
  "WitnessPlane records the full path",
];

export function createBuccetSystemGraph(nodes: readonly BuccetSystemNode[] = BUCCET_SYSTEM_NODES): BuccetSystemGraph {
  return { nodes: [...nodes] };
}

export function snapBuccetSystem(systemGraph: BuccetSystemGraph = createBuccetSystemGraph()): BuccetSubstrate {
  const covered = new Set<BuccetSystemNode>(Object.values(DEFAULT_PLANE_MAP).flat());
  const orphanedNodes = systemGraph.nodes.filter((node) => !covered.has(node));

  return {
    systemGraph,
    planes: DEFAULT_PLANE_MAP,
    terminals: DEFAULT_TERMINALS,
    consequenceBoundaries: [...BUCCET_CONSEQUENCE_BOUNDARIES],
    firingOrder: [...DEFAULT_FIRING_ORDER],
    orphanedNodes,
    isLossless: orphanedNodes.length === 0,
    compression: {
      nodeCount: systemGraph.nodes.length,
      planeCount: BUCCET_SUBSTRATE_PLANES.length,
      ratio: Number((systemGraph.nodes.length / BUCCET_SUBSTRATE_PLANES.length).toFixed(2)),
    },
  };
}

export function benchmarkBuccetSystemSnap(iterations = 10_000): {
  iterations: number;
  totalMs: number;
  avgMs: number;
  last: BuccetSubstrate;
} {
  const graph = createBuccetSystemGraph();
  const startedAt = performance.now();
  let last = snapBuccetSystem(graph);
  for (let index = 1; index < iterations; index += 1) {
    last = snapBuccetSystem(graph);
  }
  const totalMs = performance.now() - startedAt;
  return {
    iterations,
    totalMs,
    avgMs: totalMs / iterations,
    last,
  };
}
