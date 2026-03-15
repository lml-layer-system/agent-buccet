import type { FormationId } from "@/lib/lml/path-orchestrator";

export type NocrRootDomain = "sun" | "ability" | "meta" | "human" | "quantum";
export type PlanetId = NocrRootDomain | "nocr" | "branch_tree";

export type RootProvenance = {
  classification: "static" | "artifact" | "user_law" | "nocr_ledger";
  extractionStage: "static_seed" | "uic_uuis_snap" | "nocr_planet_mirror";
  sourceLabel: string;
  sourceDigest: string;
};

export type RootSourceUnitKind =
  | "claim"
  | "identity_kernel"
  | "legality_region"
  | "meta_loop"
  | "directive"
  | "code_unit"
  | "math_unit"
  | "sentence";

export type RootParent = {
  id: string;
  domain: NocrRootDomain;
  planet: PlanetId;
  label: string;
  lawId: string;
  provenance: RootProvenance;
};

export type NocrRoot = RootParent;

export type SeedChild = {
  id: string;
  source: "chat" | "coding" | "web_search" | "refusal";
  text: string;
  abilityRoute: string;
  origin:
    | "chat_uic.sentence"
    | "chat_uic.directive"
    | "chat_uic.code_line"
    | "chat_uic.math_clause"
    | "quantum_spark.chat_register"
    | "quantum_spark.chat_rhythm"
    | "quantum_spark.chat_affect"
    | "quantum_spark.chat_distance"
    | "quantum_spark.chat_guidance"
    | "quantum_spark.chat_distress"
    | "quantum_spark.per_x"
    | "quantum_spark.delta"
    | "quantum_spark.claim"
    | "efue.sentence"
    | "efue.directive"
    | "efue.code_line"
    | "efue.math_clause";
  rank: number;
};

export type NocrSeed = SeedChild;

export type Branch = {
  id: string;
  seedTag: string;
  rootTag: string;
  rootId: string;
};

export type Tree = {
  id: string;
  rootTag: string;
  planet: PlanetId;
};

export type StateChange = {
  id: string;
  type: "funnel_tagged" | "collapse_resolved" | "branch_extended" | "tree_extended" | "tree_started" | "branch_forked" | "branch_sibling_created" | "branch_merged" | "branch_closed" | "branch_archived" | "tree_archived" | "branch_deleted" | "tree_deleted";
  branchId: string | null;
  treeId: string | null;
};

export type QuantumSnapMatch = {
  seedTag: string;
  seedId: string;
  rootTag: string;
  rootId: string;
  domain: NocrRootDomain;
  reasonClass: "exact_label" | "token_overlap" | "route_domain_alignment" | "no_extracted_root_match";
  score: number;
};

export type NocrTaggedSeed = {
  seed: NocrSeed;
  seedTag: string;
  funnelReason: string;
};

export type NocrTaggedRoot = {
  root: NocrRoot;
  rootTag: string;
  source: RootProvenance["extractionStage"];
};

export type NocrFunnelState = {
  taggedSeed: NocrTaggedSeed;
  taggedRoots: NocrTaggedRoot[];
  exactChatSeeds: NocrTaggedSeed[];
  qeChatSeeds: NocrTaggedSeed[];
  ledgerState: "tagged";
};

export type QuantumCollapseResult = {
  taggedSeed: NocrTaggedSeed;
  matchedRoot: NocrTaggedRoot | null;
  snapMatches: QuantumSnapMatch[];
  branch: Branch | null;
  tree: Tree | null;
  stateChange: StateChange | null;
  reason: string;
  lockReasonClass: "exact_label" | "token_overlap" | "route_domain_alignment" | "no_extracted_root_match";
  matchScore: number;
  qeGeneratedRootCount?: number;
  qeCheckedRootCount?: number;
  formationId: FormationId;
  collapseMoment: "post_nocr_funnel";
  lockState: "locked" | "clipped";
};

export type NocrLedgerEventType =
  | "FUNNEL_TAGGED"
  | "COLLAPSE_RESOLVED"
  | "COLLAPSE_MATCH_RESOLVED"
  | "COLLAPSE_CLIPPED"
  | "BRANCH_EXTENDED"
  | "TREE_EXTENDED"
  | "TREE_STARTED"
  | "BRANCH_FORKED"
  | "BRANCH_SIBLING_CREATED"
  | "BRANCH_MERGED"
  | "BRANCH_CLOSED"
  | "BRANCH_ARCHIVED"
  | "TREE_ARCHIVED"
  | "BRANCH_DELETED"
  | "TREE_DELETED";

export type NocrFunnelLedgerPayload = {
  runId: string;
  seed: SeedChild;
  seedTag: string;
  exactSeedTags: string[];
  qeSeedTags: string[];
  rootTags: string[];
  rootIds: string[];
  ledgerState: NocrFunnelState["ledgerState"];
  reason: string;
  createdAt: string;
};

export type NocrCollapseLedgerPayload = {
  runId: string;
  seedTag: string;
  rootTag: string;
  rootId: string;
  branchId: string;
  treeId: string;
  stateChangeId: string;
  domain: NocrRootDomain;
  reason: string;
  snapMatches: QuantumSnapMatch[];
  collapseMoment: QuantumCollapseResult["collapseMoment"];
  createdAt: string;
};

export type NocrCollapseMatchLedgerPayload = {
  runId: string;
  branchId: string;
  treeId: string;
  seedTag: string;
  seedId: string;
  rootTag: string;
  rootId: string;
  domain: NocrRootDomain;
  reasonClass: QuantumSnapMatch["reasonClass"];
  score: number;
  createdAt: string;
};

export type NocrClippedLedgerPayload = {
  runId: string;
  seedTag: string;
  requestedDomain: NocrRootDomain;
  reason: string;
  rootSpaceSize: number;
  collapseMoment: QuantumCollapseResult["collapseMoment"];
  createdAt: string;
};

export type NocrLifecycleLedgerPayload = {
  runId: string;
  branchId: string;
  treeId: string;
  stateChangeId: string;
  entity: "branch" | "tree";
  lifecycle: "extended" | "forked" | "closed" | "archived" | "deleted";
  reason: string;
  createdAt: string;
};

export type NocrLedgerRecord = {
  index: number;
  eventType: NocrLedgerEventType;
  payload:
    | NocrFunnelLedgerPayload
    | NocrCollapseLedgerPayload
    | NocrCollapseMatchLedgerPayload
    | NocrClippedLedgerPayload
    | NocrLifecycleLedgerPayload;
};

export type NocrPlanetRootLaw = {
  id: string;
  parentTag: string;
  planet: "nocr";
  sourceLedgerIndex: number;
  sourceEventType: NocrLedgerEventType;
  text: string;
  createdAt: string;
};

export type BranchTreePlanetRootLaw = {
  id: string;
  parentTag: string;
  planet: "branch_tree";
  sourceLedgerIndex: number;
  sourceEventType:
    | "COLLAPSE_RESOLVED"
    | "COLLAPSE_MATCH_RESOLVED"
    | "BRANCH_EXTENDED"
    | "TREE_EXTENDED"
    | "TREE_STARTED"
    | "BRANCH_FORKED"
    | "BRANCH_SIBLING_CREATED"
    | "BRANCH_MERGED"
    | "BRANCH_CLOSED"
    | "BRANCH_ARCHIVED"
    | "TREE_ARCHIVED"
    | "BRANCH_DELETED"
    | "TREE_DELETED";
  text: string;
  createdAt: string;
};
