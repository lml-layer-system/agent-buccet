import type {
  BoundarySpendCommitIntent,
  BoundarySpendDestinationKind,
  BoundarySpendPeriodWindow,
  BoundarySpendRiskClass,
  BoundarySpendSourceAuthorityKind,
  BoundaryUplScope,
} from "./types.ts";
import type {
  BoundaryStructuredUplLaw,
  BoundaryUplDomain,
  BoundaryUplDraftActorKind,
  BoundaryUplHumanConfirmationRule,
  BoundaryUplMutation,
  BoundaryUplProofRequirement,
  BoundaryUplRecurringPolicy,
  BoundaryUplSubstitutionPolicy,
  BoundaryUplSyncTarget,
} from "./upl-process.ts";

export type BoundarySpendLawPackId =
  | "merchant.purchase"
  | "subscription.provider"
  | "exchange.trade"
  | "api.credit"
  | "platform.signup"
  | "account.transfer"
  | "contract.signature";

export type BoundarySpendLawPack = {
  id: BoundarySpendLawPackId;
  title: string;
  category: "shopping" | "recurring" | "trading" | "signup" | "transfer" | "contract";
  description: string;
  lockedByDefault: string;
  requires: string[];
  opensCorridor: string[];
  keepsDenied: string[];
  defaultScope: BoundaryUplScope;
  defaultSyncTargets: BoundaryUplSyncTarget[];
  capability: string;
  domain: BoundaryUplDomain;
  destinationKind: BoundarySpendDestinationKind;
  commitIntent: BoundarySpendCommitIntent;
  riskClass: BoundarySpendRiskClass;
  recurring: boolean;
  defaultSourceAuthorityKind: BoundarySpendSourceAuthorityKind;
  defaultPeriodWindow?: BoundarySpendPeriodWindow;
  recurringPolicy: BoundaryUplRecurringPolicy;
  substitutionPolicy: BoundaryUplSubstitutionPolicy;
  humanConfirmationRule: BoundaryUplHumanConfirmationRule;
  proofRequirement: BoundaryUplProofRequirement;
  defaultTermsSummary: string;
};

export type BoundarySpendProposalCandidate = {
  pack: BoundarySpendLawPack;
  score: number;
  matchedSignals: string[];
  reasons: string[];
};

export type BoundarySpendProposalAnalysis = {
  requestText: string;
  normalizedRequest: string;
  requiresHumanPick: true;
  singlePackOnlyByDefault: true;
  blendRequested: boolean;
  multipleBoundaryClassesDetected: boolean;
  suggestedSyncTargets: BoundaryUplSyncTarget[];
  candidates: BoundarySpendProposalCandidate[];
  notes: string[];
};

export type BoundarySpendLawPackDraftArgs = {
  packId: BoundarySpendLawPackId;
  handle: string;
  principal: string;
  bucketId: string;
  amountLimitNormalized: number;
  periodLimitNormalized?: number;
  periodWindow?: BoundarySpendPeriodWindow;
  scope?: BoundaryUplScope;
  sourceAuthorityKind?: BoundarySpendSourceAuthorityKind;
  syncTargets?: BoundaryUplSyncTarget[];
  lawKey?: string;
  notes?: string;
  draftedByKind?: BoundaryUplDraftActorKind;
  draftedBy?: string;
};

const SPEND_LAW_PACKS: BoundarySpendLawPack[] = [
  {
    id: "merchant.purchase",
    title: "One-Time Merchant Purchase",
    category: "shopping",
    description: "Open a narrow one-time shopping corridor to one exact merchant/provider handle.",
    lockedByDefault: "One-time merchant purchases stay denied until the exact merchant corridor is opened.",
    requires: ["handle", "principal", "bucket", "max amount"],
    opensCorridor: [
      "agent.spend only",
      "exact merchant/provider handle only",
      "one-time purchase only",
      "exact principal and bucket only",
    ],
    keepsDenied: [
      "raw payment-link side doors",
      "other merchants and other buckets",
      "subscriptions and recurring obligations",
    ],
    defaultScope: "GLOBAL",
    defaultSyncTargets: ["buccet"],
    capability: "merchant.purchase",
    domain: "spend",
    destinationKind: "merchant",
    commitIntent: "purchase",
    riskClass: "low",
    recurring: false,
    defaultSourceAuthorityKind: "card",
    defaultPeriodWindow: "30d",
    recurringPolicy: "deny",
    substitutionPolicy: "deny",
    humanConfirmationRule: "notify_before_commit",
    proofRequirement: "receipt_required",
    defaultTermsSummary: "one-time merchant purchase inside exact corridor",
  },
  {
    id: "subscription.provider",
    title: "Provider Subscription",
    category: "recurring",
    description: "Open a recurring subscription corridor to one named provider handle.",
    lockedByDefault: "Recurring provider subscriptions stay denied until the exact recurring corridor is opened.",
    requires: ["handle", "principal", "bucket", "max monthly amount"],
    opensCorridor: [
      "agent.spend only",
      "exact provider handle only",
      "subscribe intent only",
      "recurring spend inside exact bucket cap",
    ],
    keepsDenied: [
      "other providers and plan substitutions",
      "one-time purchases outside the recurring rail",
      "raw checkout and payment-link side doors",
    ],
    defaultScope: "GLOBAL",
    defaultSyncTargets: ["buccet"],
    capability: "subscription.start",
    domain: "spend",
    destinationKind: "merchant",
    commitIntent: "subscribe",
    riskClass: "recurring",
    recurring: true,
    defaultSourceAuthorityKind: "card",
    defaultPeriodWindow: "30d",
    recurringPolicy: "allow",
    substitutionPolicy: "deny",
    humanConfirmationRule: "notify_before_commit",
    proofRequirement: "receipt_required",
    defaultTermsSummary: "recurring provider subscription inside exact monthly cap",
  },
  {
    id: "exchange.trade",
    title: "Exchange Trade",
    category: "trading",
    description: "Open a trade corridor to one exact exchange handle under a bounded cap.",
    lockedByDefault: "Exchange trading stays denied until one exact exchange rail is opened.",
    requires: ["handle", "principal", "bucket", "max trade amount"],
    opensCorridor: [
      "agent.spend only",
      "exact exchange handle only",
      "swap intent only",
      "volatile bucket bound to one principal",
    ],
    keepsDenied: [
      "wallet and contract side doors",
      "other exchanges and other buckets",
      "transfers, withdrawals, and raw API side doors",
    ],
    defaultScope: "GLOBAL",
    defaultSyncTargets: ["buccet"],
    capability: "exchange.trade",
    domain: "spend",
    destinationKind: "exchange",
    commitIntent: "swap",
    riskClass: "volatile",
    recurring: false,
    defaultSourceAuthorityKind: "api_credential",
    defaultPeriodWindow: "24h",
    recurringPolicy: "deny",
    substitutionPolicy: "deny",
    humanConfirmationRule: "require_human_execution",
    proofRequirement: "artifact_required",
    defaultTermsSummary: "bounded exchange order inside exact handle and bucket",
  },
  {
    id: "api.credit",
    title: "API / Cloud Credit Purchase",
    category: "signup",
    description: "Open a bounded paid API or cloud credit purchase corridor to one provider.",
    lockedByDefault: "Paid API and cloud-credit top-ups stay denied until the exact provider rail is opened.",
    requires: ["handle", "principal", "bucket", "max amount"],
    opensCorridor: [
      "agent.spend only",
      "exact provider handle only",
      "purchase intent only",
      "exact principal and budget bucket only",
    ],
    keepsDenied: [
      "new providers",
      "platform signups that create broader billing authority",
      "subscriptions and raw checkout side doors",
    ],
    defaultScope: "GLOBAL",
    defaultSyncTargets: ["buccet"],
    capability: "api.credit.purchase",
    domain: "spend",
    destinationKind: "merchant",
    commitIntent: "purchase",
    riskClass: "medium",
    recurring: false,
    defaultSourceAuthorityKind: "card",
    defaultPeriodWindow: "30d",
    recurringPolicy: "deny",
    substitutionPolicy: "deny",
    humanConfirmationRule: "notify_before_commit",
    proofRequirement: "receipt_required",
    defaultTermsSummary: "bounded paid API or cloud-credit purchase",
  },
  {
    id: "platform.signup",
    title: "Platform Signup With Billing",
    category: "signup",
    description: "Open a signup corridor for a provider that can create billing authority, API credentials, or future charges.",
    lockedByDefault: "Billing-capable platform signups stay denied until the exact provider corridor is opened.",
    requires: ["handle", "principal", "bucket", "max amount"],
    opensCorridor: [
      "agent.spend only",
      "exact provider handle only",
      "subscribe intent only",
      "future-charge / free-trial obligation treated as recurring from the start",
    ],
    keepsDenied: [
      "other providers and raw signup pages",
      "credential creation at other platforms",
      "implicit free-trial to paid-plan drift",
    ],
    defaultScope: "GLOBAL",
    defaultSyncTargets: ["buccet"],
    capability: "platform.signup",
    domain: "identity",
    destinationKind: "merchant",
    commitIntent: "subscribe",
    riskClass: "identity_sensitive",
    recurring: true,
    defaultSourceAuthorityKind: "api_credential",
    defaultPeriodWindow: "30d",
    recurringPolicy: "allow",
    substitutionPolicy: "deny",
    humanConfirmationRule: "require_human_execution",
    proofRequirement: "artifact_required",
    defaultTermsSummary: "billing-capable platform signup treated as future obligation from the start",
  },
  {
    id: "account.transfer",
    title: "Account Transfer",
    category: "transfer",
    description: "Open a transfer corridor to one exact account or treasury handle.",
    lockedByDefault: "Transfers stay denied until one exact account rail is opened.",
    requires: ["handle", "principal", "bucket", "max amount"],
    opensCorridor: [
      "agent.spend only",
      "exact account handle only",
      "transfer intent only",
      "one principal and one transfer bucket only",
    ],
    keepsDenied: [
      "other accounts and other principals",
      "exchange, wallet, and contract side doors",
      "withdraw and swap outside the exact transfer rail",
    ],
    defaultScope: "GLOBAL",
    defaultSyncTargets: ["buccet"],
    capability: "account.transfer",
    domain: "spend",
    destinationKind: "account",
    commitIntent: "transfer",
    riskClass: "high",
    recurring: false,
    defaultSourceAuthorityKind: "linked_account",
    defaultPeriodWindow: "24h",
    recurringPolicy: "deny",
    substitutionPolicy: "deny",
    humanConfirmationRule: "require_human_execution",
    proofRequirement: "receipt_required",
    defaultTermsSummary: "bounded account transfer to one exact handle",
  },
  {
    id: "contract.signature",
    title: "Contract / Binding Signature",
    category: "contract",
    description: "Open a narrow contract-signature corridor for one exact counterparty handle and bounded obligation.",
    lockedByDefault: "Binding signatures and legal obligations stay denied until one exact signature corridor is opened.",
    requires: ["handle", "principal", "bucket", "max amount"],
    opensCorridor: [
      "agent.spend only",
      "exact contract counterparty handle only",
      "sign intent only",
      "one bounded obligation bucket only",
    ],
    keepsDenied: [
      "other counterparties and other obligation buckets",
      "hidden plan substitutions and raw clickwrap side doors",
      "debt, transfer, and subscription motion outside the exact corridor",
    ],
    defaultScope: "GLOBAL",
    defaultSyncTargets: ["buccet"],
    capability: "contract.sign",
    domain: "contract",
    destinationKind: "contract",
    commitIntent: "sign",
    riskClass: "legal_obligation",
    recurring: false,
    defaultSourceAuthorityKind: "api_credential",
    defaultPeriodWindow: "30d",
    recurringPolicy: "deny",
    substitutionPolicy: "deny",
    humanConfirmationRule: "require_human_execution",
    proofRequirement: "artifact_required",
    defaultTermsSummary: "bounded binding signature to one exact counterparty",
  },
];

function slugifyFragment(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "unnamed";
}

type SpendProposalSignalRule = {
  terms: string[];
  score: number;
  reason: string;
};

const SPEND_PROPOSAL_SIGNAL_RULES: Record<BoundarySpendLawPackId, SpendProposalSignalRule[]> = {
  "merchant.purchase": [
    { terms: ["buy", "purchase", "order"], score: 5, reason: "request uses direct purchase language" },
    { terms: ["checkout", "cart", "shopping"], score: 4, reason: "request describes a shopping / checkout flow" },
    { terms: ["merchant", "product", "item"], score: 2, reason: "request names a merchant-style purchase target" },
  ],
  "subscription.provider": [
    { terms: ["subscription", "subscribe", "subscribed"], score: 6, reason: "request explicitly asks for a subscription" },
    { terms: ["monthly", "annual", "yearly", "renew", "renewal"], score: 4, reason: "request names recurring billing terms" },
    { terms: ["recurring", "plan"], score: 3, reason: "request describes an ongoing provider plan" },
  ],
  "exchange.trade": [
    { terms: ["trade", "trading", "exchange", "swap"], score: 6, reason: "request explicitly asks for trading or exchange motion" },
    { terms: ["rebalance", "market order", "limit order", "portfolio"], score: 4, reason: "request names exchange order mechanics" },
    { terms: ["coinbase", "binance", "kraken"], score: 5, reason: "request names an exchange handle directly" },
  ],
  "api.credit": [
    { terms: ["api credit", "api credits", "cloud credit", "cloud credits"], score: 6, reason: "request explicitly asks for credit top-ups" },
    { terms: ["top up", "top-up", "recharge", "prepay"], score: 4, reason: "request describes prepaid credit purchase" },
    { terms: ["usage credits", "buy credits", "openai credits"], score: 5, reason: "request targets paid API / cloud usage credits" },
  ],
  "platform.signup": [
    { terms: ["sign up", "signup", "create account"], score: 6, reason: "request explicitly asks for account creation" },
    { terms: ["free trial", "trial", "billing setup"], score: 5, reason: "request describes a signup with future billing risk" },
    { terms: ["api key", "paid account", "paid plan"], score: 4, reason: "request combines provider signup with billing authority" },
  ],
  "account.transfer": [
    { terms: ["transfer", "send money", "wire", "ach"], score: 6, reason: "request explicitly asks for account transfer motion" },
    { terms: ["withdraw", "payout", "bank transfer", "treasury"], score: 5, reason: "request describes fund movement to an account rail" },
    { terms: ["bank", "account"], score: 2, reason: "request names an account-style destination" },
  ],
  "contract.signature": [
    { terms: ["sign contract", "sign agreement", "contract"], score: 6, reason: "request explicitly asks for contract execution" },
    { terms: ["agreement", "legal obligation", "terms"], score: 4, reason: "request names a binding legal commitment" },
    { terms: ["loan", "debt", "borrow"], score: 5, reason: "request describes debt or obligation creation" },
  ],
};

const SPEND_BLEND_REQUEST_TERMS = [
  "blend",
  "combined",
  "combine",
  "together",
  "single draft",
  "one draft",
  "multi-pack",
  "multipack",
];

function countMatchedTerms(normalizedRequest: string, terms: readonly string[]): string[] {
  return terms.filter((term) => normalizedRequest.includes(term));
}

export function listBoundarySpendLawPacks(): BoundarySpendLawPack[] {
  return SPEND_LAW_PACKS.map((pack) => ({ ...pack, requires: [...pack.requires], opensCorridor: [...pack.opensCorridor], keepsDenied: [...pack.keepsDenied], defaultSyncTargets: [...pack.defaultSyncTargets] }));
}

export function findBoundarySpendLawPack(packId: string): BoundarySpendLawPack | null {
  return SPEND_LAW_PACKS.find((pack) => pack.id === packId) ?? null;
}

export function proposeBoundarySpendLawPacks(args: {
  requestText: string;
  limit?: number;
}): BoundarySpendProposalAnalysis {
  const requestText = args.requestText.trim();
  const normalizedRequest = requestText.toLowerCase();
  const limit = Math.max(1, args.limit ?? 3);
  const blendRequested = SPEND_BLEND_REQUEST_TERMS.some((term) => normalizedRequest.includes(term));

  const candidates = SPEND_LAW_PACKS.map((pack) => {
    const rules = SPEND_PROPOSAL_SIGNAL_RULES[pack.id];
    const matchedSignals: string[] = [];
    const reasons: string[] = [];
    let score = 0;
    for (const rule of rules) {
      const matchedTerms = countMatchedTerms(normalizedRequest, rule.terms);
      if (matchedTerms.length === 0) {
        continue;
      }
      matchedSignals.push(...matchedTerms);
      reasons.push(rule.reason);
      score += rule.score + Math.max(0, matchedTerms.length - 1);
    }
    return {
      pack,
      score,
      matchedSignals: [...new Set(matchedSignals)],
      reasons: [...new Set(reasons)],
    };
  })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) =>
      right.score - left.score || left.pack.id.localeCompare(right.pack.id))
    .slice(0, limit);

  const multipleBoundaryClassesDetected = candidates.length > 1;
  const notes = [
    "Pi is suggestion-only here. No spend pack is auto-selected.",
    "Drafts stay single-pack by default. If you want a blended draft, ask for it explicitly.",
    "Suggested drafts default to `buccet` sync only. Future Buccets stay locked unless you widen the sync targets yourself.",
  ];
  if (multipleBoundaryClassesDetected) {
    notes.push("Multiple financial boundary classes were detected. Pick one pack first, then stage separate drafts if you need more than one corridor.");
  }
  if (blendRequested) {
    notes.push("A blended-draft request was detected, but no blended draft was created automatically.");
  }
  if (candidates.length === 0) {
    notes.push("No safe pack match was found from this text. Inspect the spend pack catalog directly and choose the corridor by hand.");
  }

  return {
    requestText,
    normalizedRequest,
    requiresHumanPick: true,
    singlePackOnlyByDefault: true,
    blendRequested,
    multipleBoundaryClassesDetected,
    suggestedSyncTargets: ["buccet"],
    candidates,
    notes,
  };
}

export function buildBoundarySpendLawPackDraft(args: BoundarySpendLawPackDraftArgs): {
  sourceLabel: string;
  syncTargets: BoundaryUplSyncTarget[];
  observation: {
    title: string;
    summary: string;
    detectedAt: string;
    detectedBy: string;
    sourceText: string;
  };
  boundary: {
    title: string;
    crossing: string;
    consequence: string;
  };
  invariant: {
    statement: string;
    allowed: string[];
    denied: string[];
    humanRequired: string[];
    headlessAllowed: string[];
  };
  draftedByKind: BoundaryUplDraftActorKind;
  draftedBy: string;
  mutations: Array<Omit<BoundaryUplMutation, "mutationId"> & { mutationId?: string }>;
} {
  const pack = findBoundarySpendLawPack(args.packId);
  if (!pack) {
    throw new Error(`unknown spend law pack: ${args.packId}`);
  }
  if (!args.handle.trim()) {
    throw new Error(`spend law pack ${pack.id} requires handle`);
  }
  if (!args.principal.trim()) {
    throw new Error(`spend law pack ${pack.id} requires principal`);
  }
  if (!args.bucketId.trim()) {
    throw new Error(`spend law pack ${pack.id} requires bucketId`);
  }
  if (!Number.isFinite(args.amountLimitNormalized) || args.amountLimitNormalized <= 0) {
    throw new Error(`spend law pack ${pack.id} requires amountLimitNormalized > 0`);
  }
  const periodWindow = args.periodWindow ?? pack.defaultPeriodWindow;
  const periodLimitNormalized = args.periodLimitNormalized ?? args.amountLimitNormalized;
  if (periodLimitNormalized <= 0) {
    throw new Error(`spend law pack ${pack.id} requires periodLimitNormalized > 0`);
  }
  const sourceAuthorityKind = args.sourceAuthorityKind ?? pack.defaultSourceAuthorityKind;
  const lawKey = args.lawKey?.trim() || [
    "spend",
    pack.id.replace(/\./g, "-"),
    slugifyFragment(args.handle),
    slugifyFragment(args.bucketId),
  ].join(".");
  const law: BoundaryStructuredUplLaw = {
    lawKey,
    domain: pack.domain,
    capability: pack.capability,
    state: "allow",
    scope: args.scope ?? pack.defaultScope,
    runtime: {
      actionKinds: ["agent.spend"],
      primaryTarget: args.handle.trim(),
      targetPatterns: [args.handle.trim()],
      targetMatchMode: "exact",
      provenance: "trusted_user",
      reviewSurface: "action",
      reviewInvariantLawId: "BOUNDARY.SPEND.PACKET.01",
    },
    bucketId: args.bucketId.trim(),
    principal: args.principal.trim(),
    approvedHandles: [args.handle.trim()],
    approvedDestinationKinds: [pack.destinationKind],
    approvedSourceAuthorityKinds: [sourceAuthorityKind],
    approvedCommitIntents: [pack.commitIntent],
    riskClasses: [pack.riskClass],
    amountLimitNormalized: args.amountLimitNormalized,
    periodLimitNormalized,
    periodWindow,
    recurringPolicy: pack.recurringPolicy,
    substitutionPolicy: pack.substitutionPolicy,
    humanConfirmationRule: pack.humanConfirmationRule,
    reminderOffsets: pack.recurring ? ["14d", "7d", "3d", "1d"] : [],
    proofRequirement: pack.proofRequirement,
    notes: args.notes?.trim() || pack.defaultTermsSummary,
  };
  return {
    sourceLabel: `spend-pack:${pack.id}`,
    syncTargets: args.syncTargets?.length ? [...args.syncTargets] : [...pack.defaultSyncTargets],
    observation: {
      title: `${pack.title} corridor`,
      summary: pack.description,
      detectedAt: new Date().toISOString(),
      detectedBy: args.draftedBy ?? "pi",
      sourceText: `open ${pack.id} for ${args.handle.trim()} principal=${args.principal.trim()} bucket=${args.bucketId.trim()} max=${args.amountLimitNormalized}`,
    },
    boundary: {
      title: "value boundary",
      crossing: `internal spend intent becomes external ${pack.capability}`,
      consequence: pack.lockedByDefault,
    },
    invariant: {
      statement: `only the exact ${pack.id} corridor may open; everything else remains denied until separately authorized`,
      allowed: [...pack.opensCorridor],
      denied: [...pack.keepsDenied],
      humanRequired: ["active law activation"],
      headlessAllowed: [
        `${pack.id} inside exact handle, principal, bucket, and cap`,
      ],
    },
    draftedByKind: args.draftedByKind ?? "pi",
    draftedBy: args.draftedBy ?? "pi",
    mutations: [
      {
        kind: "add",
        lawKey,
        reason: `open spend corridor for ${pack.id}`,
        nextLaw: law,
      },
    ],
  };
}
