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
  | "license.seat"
  | "exchange.trade"
  | "bill.payment"
  | "travel.booking"
  | "ad.spend"
  | "donation.gift"
  | "procurement.order"
  | "api.credit"
  | "platform.signup"
  | "account.transfer"
  | "contract.signature";

export type BoundarySpendLawPack = {
  id: BoundarySpendLawPackId;
  title: string;
  category:
    | "shopping"
    | "recurring"
    | "license"
    | "trading"
    | "billing"
    | "travel"
    | "advertising"
    | "donation"
    | "procurement"
    | "signup"
    | "transfer"
    | "contract";
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

export type BoundarySpendLawBlendComponentArgs = Omit<
  BoundarySpendLawPackDraftArgs,
  "syncTargets" | "draftedByKind" | "draftedBy"
>;

export type BoundarySpendLawBlendDraftArgs = {
  title?: string;
  summary?: string;
  requestText?: string;
  syncTargets?: BoundaryUplSyncTarget[];
  draftedByKind?: BoundaryUplDraftActorKind;
  draftedBy?: string;
  components: BoundarySpendLawBlendComponentArgs[];
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
    id: "license.seat",
    title: "SaaS Seat / License Management",
    category: "license",
    description: "Open a bounded seat, workspace, or license corridor to one named SaaS provider handle.",
    lockedByDefault: "Seat, workspace, and license changes stay denied until the exact provider corridor is opened.",
    requires: ["handle", "principal", "bucket", "max monthly amount"],
    opensCorridor: [
      "agent.spend only",
      "exact provider handle only",
      "subscribe intent only",
      "seat / license / workspace spend inside exact recurring cap",
    ],
    keepsDenied: [
      "other providers and other workspaces",
      "broad signup drift outside the exact provider corridor",
      "raw checkout and payment-link side doors",
    ],
    defaultScope: "GLOBAL",
    defaultSyncTargets: ["buccet"],
    capability: "license.seat.manage",
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
    proofRequirement: "artifact_required",
    defaultTermsSummary: "bounded SaaS seat or license changes inside exact provider corridor",
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
    id: "bill.payment",
    title: "Bill / Invoice Payment",
    category: "billing",
    description: "Open a bounded bill-payment corridor to one exact biller or invoice payee handle.",
    lockedByDefault: "Bill and invoice payments stay denied until the exact payee corridor is opened.",
    requires: ["handle", "principal", "bucket", "max amount"],
    opensCorridor: [
      "agent.spend only",
      "exact biller or invoice payee handle only",
      "transfer intent only",
      "exact principal and billing bucket only",
    ],
    keepsDenied: [
      "other payees and other billing buckets",
      "raw account and payment-link side doors",
      "subscription or shopping drift outside the exact payee corridor",
    ],
    defaultScope: "GLOBAL",
    defaultSyncTargets: ["buccet"],
    capability: "bill.payment",
    domain: "spend",
    destinationKind: "account",
    commitIntent: "transfer",
    riskClass: "high",
    recurring: false,
    defaultSourceAuthorityKind: "linked_account",
    defaultPeriodWindow: "30d",
    recurringPolicy: "deny",
    substitutionPolicy: "deny",
    humanConfirmationRule: "require_human_execution",
    proofRequirement: "receipt_required",
    defaultTermsSummary: "bounded bill or invoice payment to one exact payee",
  },
  {
    id: "travel.booking",
    title: "Travel Booking",
    category: "travel",
    description: "Open a bounded travel booking corridor to one exact airline, hotel, or travel provider handle.",
    lockedByDefault: "Travel bookings stay denied until the exact provider corridor is opened.",
    requires: ["handle", "principal", "bucket", "max amount"],
    opensCorridor: [
      "agent.spend only",
      "exact travel provider handle only",
      "purchase intent only",
      "travel bucket bound to one principal",
    ],
    keepsDenied: [
      "other providers and date/route substitutions outside the exact corridor",
      "non-travel purchases and payment-link side doors",
      "implicit obligation drift outside the exact booking rail",
    ],
    defaultScope: "GLOBAL",
    defaultSyncTargets: ["buccet"],
    capability: "travel.booking",
    domain: "spend",
    destinationKind: "merchant",
    commitIntent: "purchase",
    riskClass: "irreversible",
    recurring: false,
    defaultSourceAuthorityKind: "card",
    defaultPeriodWindow: "30d",
    recurringPolicy: "deny",
    substitutionPolicy: "deny",
    humanConfirmationRule: "require_human_execution",
    proofRequirement: "artifact_required",
    defaultTermsSummary: "bounded travel booking on one exact provider rail",
  },
  {
    id: "ad.spend",
    title: "Advertising Spend",
    category: "advertising",
    description: "Open a bounded ad-spend corridor to one exact ad platform handle.",
    lockedByDefault: "Advertising spend stays denied until the exact platform corridor is opened.",
    requires: ["handle", "principal", "bucket", "max amount"],
    opensCorridor: [
      "agent.spend only",
      "exact ad platform handle only",
      "purchase intent only",
      "campaign spend inside exact budget bucket and cap",
    ],
    keepsDenied: [
      "other ad platforms and audience drift outside the exact corridor",
      "shopping, subscription, and payment-link side doors",
      "uncapped campaign scaling outside the exact spend rail",
    ],
    defaultScope: "GLOBAL",
    defaultSyncTargets: ["buccet"],
    capability: "ad.spend",
    domain: "spend",
    destinationKind: "merchant",
    commitIntent: "purchase",
    riskClass: "high",
    recurring: false,
    defaultSourceAuthorityKind: "card",
    defaultPeriodWindow: "24h",
    recurringPolicy: "deny",
    substitutionPolicy: "deny",
    humanConfirmationRule: "notify_before_commit",
    proofRequirement: "artifact_required",
    defaultTermsSummary: "bounded advertising spend on one exact platform rail",
  },
  {
    id: "donation.gift",
    title: "Donation / Gift",
    category: "donation",
    description: "Open a bounded donation corridor to one exact charity or gift destination handle.",
    lockedByDefault: "Donations and gifts stay denied until the exact recipient corridor is opened.",
    requires: ["handle", "principal", "bucket", "max amount"],
    opensCorridor: [
      "agent.spend only",
      "exact charity or recipient handle only",
      "transfer intent only",
      "one donation bucket and one principal only",
    ],
    keepsDenied: [
      "other recipients and other buckets",
      "subscription drift and recurring gift obligations",
      "payment-link side doors outside the exact recipient rail",
    ],
    defaultScope: "GLOBAL",
    defaultSyncTargets: ["buccet"],
    capability: "donation.gift",
    domain: "spend",
    destinationKind: "account",
    commitIntent: "transfer",
    riskClass: "irreversible",
    recurring: false,
    defaultSourceAuthorityKind: "linked_account",
    defaultPeriodWindow: "30d",
    recurringPolicy: "deny",
    substitutionPolicy: "deny",
    humanConfirmationRule: "notify_before_commit",
    proofRequirement: "receipt_required",
    defaultTermsSummary: "bounded one-recipient donation or gift corridor",
  },
  {
    id: "procurement.order",
    title: "Procurement Order",
    category: "procurement",
    description: "Open a bounded procurement corridor to one exact vendor handle for organizational buying.",
    lockedByDefault: "Procurement orders stay denied until the exact vendor corridor is opened.",
    requires: ["handle", "principal", "bucket", "max amount"],
    opensCorridor: [
      "agent.spend only",
      "exact vendor handle only",
      "purchase intent only",
      "procurement bucket bound to one principal or budget center",
    ],
    keepsDenied: [
      "other vendors and other budget buckets",
      "contract, transfer, and signup drift outside the exact vendor rail",
      "raw payment-link and checkout side doors",
    ],
    defaultScope: "GLOBAL",
    defaultSyncTargets: ["buccet"],
    capability: "procurement.order",
    domain: "spend",
    destinationKind: "merchant",
    commitIntent: "purchase",
    riskClass: "high",
    recurring: false,
    defaultSourceAuthorityKind: "treasury",
    defaultPeriodWindow: "30d",
    recurringPolicy: "deny",
    substitutionPolicy: "deny",
    humanConfirmationRule: "require_human_execution",
    proofRequirement: "artifact_required",
    defaultTermsSummary: "bounded procurement order to one exact vendor corridor",
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
    { terms: ["slack", "notion", "github", "discord", "linear", "figma", "zoom"], score: 2, reason: "request names a common SaaS subscription provider" },
  ],
  "license.seat": [
    { terms: ["seat", "seats", "license", "licenses"], score: 6, reason: "request explicitly asks for seat or license changes" },
    { terms: ["workspace", "member", "users", "team seats"], score: 4, reason: "request describes workspace membership or seat expansion" },
    { terms: ["slack", "notion", "github", "linear", "figma", "zoom"], score: 5, reason: "request names a common seat-based SaaS provider" },
  ],
  "exchange.trade": [
    { terms: ["trade", "trading", "exchange", "swap"], score: 6, reason: "request explicitly asks for trading or exchange motion" },
    { terms: ["rebalance", "market order", "limit order", "portfolio", "brokerage", "broker"], score: 4, reason: "request names trading or brokerage order mechanics" },
    { terms: ["coinbase", "binance", "kraken", "robinhood", "fidelity", "schwab", "ibkr", "interactive brokers", "alpaca"], score: 5, reason: "request names an exchange or brokerage handle directly" },
    { terms: ["stocks", "equities", "etf", "shares"], score: 3, reason: "request targets market trading assets" },
  ],
  "bill.payment": [
    { terms: ["bill", "bills", "invoice", "invoices"], score: 6, reason: "request explicitly asks for bill or invoice payment" },
    { terms: ["pay bill", "pay invoice", "utility", "rent", "vendor bill"], score: 5, reason: "request describes a payment obligation" },
    { terms: ["due date", "biller", "statement"], score: 3, reason: "request names billing obligation details" },
  ],
  "travel.booking": [
    { terms: ["travel", "book flight", "flight", "hotel", "airbnb"], score: 6, reason: "request explicitly asks for travel booking" },
    { terms: ["airline", "reservation", "trip", "fare"], score: 4, reason: "request names travel-booking details" },
    { terms: ["booking", "non-refundable", "itinerary"], score: 4, reason: "request describes booking commitment terms" },
  ],
  "ad.spend": [
    { terms: ["ads", "ad spend", "campaign", "campaigns"], score: 6, reason: "request explicitly asks for advertising spend" },
    { terms: ["meta ads", "google ads", "linkedin ads", "tiktok ads"], score: 5, reason: "request names an ad platform directly" },
    { terms: ["bid", "audience", "budget", "pacing"], score: 4, reason: "request describes campaign-spend mechanics" },
  ],
  "donation.gift": [
    { terms: ["donate", "donation", "gift"], score: 6, reason: "request explicitly asks for a donation or gift" },
    { terms: ["charity", "nonprofit", "cause"], score: 5, reason: "request names a donation-style recipient" },
    { terms: ["tip", "microdonation", "support"], score: 3, reason: "request describes a small gift or support transfer" },
  ],
  "procurement.order": [
    { terms: ["procurement", "purchase order", "po"], score: 6, reason: "request explicitly asks for procurement motion" },
    { terms: ["vendor", "supplier", "quote", "quotes"], score: 5, reason: "request names procurement vendor workflow" },
    { terms: ["requisition", "budget center", "approve vendor"], score: 4, reason: "request describes organizational buying flow" },
  ],
  "api.credit": [
    { terms: ["api credit", "api credits", "cloud credit", "cloud credits"], score: 6, reason: "request explicitly asks for credit top-ups" },
    { terms: ["top up", "top-up", "recharge", "prepay"], score: 4, reason: "request describes prepaid credit purchase" },
    { terms: ["usage credits", "buy credits", "openai credits"], score: 5, reason: "request targets paid API / cloud usage credits" },
    { terms: ["openai", "anthropic", "aws", "gcp", "azure", "vercel"], score: 2, reason: "request names a common paid API or cloud provider" },
  ],
  "platform.signup": [
    { terms: ["sign up", "signup", "create account"], score: 6, reason: "request explicitly asks for account creation" },
    { terms: ["free trial", "trial", "billing setup"], score: 5, reason: "request describes a signup with future billing risk" },
    { terms: ["api key", "paid account", "paid plan"], score: 4, reason: "request combines provider signup with billing authority" },
    { terms: ["slack workspace", "notion workspace", "github organization", "openai account", "anthropic account"], score: 5, reason: "request names a provider signup with billing authority" },
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

export function buildBoundarySpendLawBlendDraft(args: BoundarySpendLawBlendDraftArgs): {
  sourceLabel: string;
  syncTargets: BoundaryUplSyncTarget[];
  componentPacks: BoundarySpendLawPack[];
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
  if (!Array.isArray(args.components) || args.components.length < 2) {
    throw new Error("spend blend requires at least 2 components; use spend draft for a single corridor");
  }
  const drafts = args.components.map((component) =>
    buildBoundarySpendLawPackDraft({
      ...component,
      draftedByKind: args.draftedByKind,
      draftedBy: args.draftedBy,
    }));
  const mutations = drafts.flatMap((draft) => draft.mutations);
  const lawKeys = mutations.map((mutation) => mutation.lawKey);
  if (new Set(lawKeys).size !== lawKeys.length) {
    throw new Error("spend blend produced duplicate law keys; each blended corridor must remain exact and distinct");
  }
  const componentPacks = args.components.map((component) => {
    const pack = findBoundarySpendLawPack(component.packId);
    if (!pack) {
      throw new Error(`unknown spend law pack: ${component.packId}`);
    }
    return pack;
  });
  const sourceLabel = `spend-blend:${componentPacks.map((pack) => pack.id).join("+")}`;
  const title = args.title?.trim() || `Blended spend corridors · ${componentPacks.map((pack) => pack.id).join(" + ")}`;
  const summary = args.summary?.trim() || `Open ${componentPacks.length} exact spend corridors in one reviewed draft without widening anything else.`;
  const requestText = args.requestText?.trim() || drafts.map((draft) => draft.observation.sourceText).join(" ; ");
  return {
    sourceLabel,
    syncTargets: args.syncTargets?.length ? [...args.syncTargets] : ["buccet"],
    componentPacks,
    observation: {
      title,
      summary,
      detectedAt: new Date().toISOString(),
      detectedBy: args.draftedBy ?? "pi",
      sourceText: requestText,
    },
    boundary: {
      title: "value boundary blend",
      crossing: `internal spend intent becomes external multi-corridor value movement across ${componentPacks.map((pack) => pack.capability).join(", ")}`,
      consequence: "multiple exact spend corridors open together only because the human explicitly requested a blended draft",
    },
    invariant: {
      statement: "only the explicit blended corridors may open together; no other spend authority widens automatically",
      allowed: drafts.flatMap((draft) => draft.invariant.allowed.map((entry) => `[${draft.sourceLabel.replace("spend-pack:", "")}] ${entry}`)),
      denied: [
        "implicit widening outside the listed corridors",
        "silent blending of unlisted packs",
        ...new Set(drafts.flatMap((draft) => draft.invariant.denied)),
      ],
      humanRequired: [
        "active law activation",
        "explicit human request for the blended draft itself",
      ],
      headlessAllowed: drafts.flatMap((draft) => draft.invariant.headlessAllowed),
    },
    draftedByKind: args.draftedByKind ?? "pi",
    draftedBy: args.draftedBy ?? "pi",
    mutations,
  };
}
