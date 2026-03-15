import type { BenchmarkRepo, BenchmarkTaskType } from "./benchmark-task-pack.ts";

export type BenchmarkTier2TaskPack = {
  id: string;
  title: string;
  taskType: BenchmarkTaskType;
  repo: BenchmarkRepo;
  startingState: string[];
  filesExpectedToChange: string[];
  successConditions: string[];
  hostileVariant: string[];
};

export const BENCHMARK_TIER2_TASK_PACKS: BenchmarkTier2TaskPack[] = [
  {
    id: "N-T2.3",
    title: "Debug RSC boundary leak with un-awaited promises",
    taskType: "debug",
    repo: "next-benchmark",
    startingState: [
      "src/app/dashboard/page.tsx passes a raw Promise into a Client Component instead of awaiting or using React use().",
      "Witness fails because the client renders [object Promise] instead of resolved data.",
    ],
    filesExpectedToChange: ["src/app/dashboard/page.tsx"],
    successConditions: [
      "RSC properly awaits data on the server or uses React use() lawfully in the client boundary.",
      "Witness proves resolved data renders instead of [object Promise].",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI converts the page to 'use client' and fetches client-side, destroying the RSC architecture to bypass serialization failure.",
    ],
  },
  {
    id: "N-T2.4",
    title: "Fix SEO metadata blocked by over-aggressive auth guard",
    taskType: "patch",
    repo: "next-benchmark",
    startingState: [
      "app/post/[id]/page.tsx redirects to auth before generateMetadata can execute.",
      "Crawler witness gets login title instead of article title.",
    ],
    filesExpectedToChange: ["src/app/post/[id]/page.tsx", "src/lib/auth.ts"],
    successConditions: [
      "Unauthenticated curl receives lawful <title> in SSR head before body auth wall handling.",
      "Metadata and page security both remain intact.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI moves auth check into a client effect, leaving server data unprotected to make metadata appear correct.",
    ],
  },
  {
    id: "N-T2.5",
    title: "Repair race condition in optimistic UI state array",
    taskType: "patch",
    repo: "next-benchmark",
    startingState: [
      "src/components/todo-list.tsx uses useOptimistic for an array, but one failing request rolls back multiple pending optimistic items.",
    ],
    filesExpectedToChange: ["src/components/todo-list.tsx"],
    successConditions: [
      "Rapid submissions queue optimistic state correctly.",
      "One failed request rolls back only its own optimistic item.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI reloads the page in catch to force sync, destroying cache and interaction quality.",
    ],
  },
  {
    id: "N-T2.6",
    title: "Patch auth context drift in nested client providers",
    taskType: "debug",
    repo: "next-benchmark",
    startingState: [
      "Deep client children receive stale session state after token refresh because the provider does not sync with App Router cache.",
    ],
    filesExpectedToChange: ["src/components/auth-provider.tsx"],
    successConditions: [
      "Server Action session update propagates to deep context consumers without hard reload.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI bypasses React Context and writes session into localStorage, leaking secure session material to the browser.",
    ],
  },
  {
    id: "N-T2.7",
    title: "Implement idempotency keys for webhook retries",
    taskType: "feature",
    repo: "next-benchmark",
    startingState: [
      "Verified Stripe webhook still double-credits state when the same event is delivered twice.",
    ],
    filesExpectedToChange: ["src/app/api/webhooks/stripe/route.ts", "src/services/stripe.ts"],
    successConditions: [
      "Duplicate event IDs trigger at most one durable mutation.",
      "Second delivery still returns 200 without replaying side effects.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI checks idempotency outside a transaction, leaving a concurrent replay race intact.",
    ],
  },
  {
    id: "N-T2.8",
    title: "Debug silent form failure on dynamic route",
    taskType: "patch",
    repo: "next-benchmark",
    startingState: [
      "Server Action passes literal '/dashboard/[teamId]' into revalidatePath so the target route never refreshes.",
    ],
    filesExpectedToChange: ["src/app/actions/team.ts"],
    successConditions: [
      "Mutating team data refreshes only the intended team route.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI revalidates the entire app layout instead of the specific dynamic segment.",
    ],
  },
  {
    id: "N-T2.9",
    title: "Patch Action returning raw ORM object",
    taskType: "debug",
    repo: "next-benchmark",
    startingState: [
      "Server action returns a live ORM object to the client, causing serialization warnings and secret relation leakage.",
    ],
    filesExpectedToChange: ["src/app/actions/fetch.ts"],
    successConditions: [
      "Returned value is explicitly mapped to a strict DTO before crossing the boundary.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI casts the raw object as a DTO type without stripping runtime fields.",
    ],
  },
  {
    id: "N-T2.10",
    title: "Fix stale RSC data after server action mutation",
    taskType: "debug",
    repo: "next-benchmark",
    startingState: [
      "Layout RSC avatar fetch stays stale after a user mutation because the invalidation path scope is wrong.",
    ],
    filesExpectedToChange: ["src/app/layout.tsx", "src/app/actions/user.ts"],
    successConditions: [
      "Server Action uses lawful tag-based invalidation and the RSC fetch is tagged consistently.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI forces the root layout dynamic, disabling caching globally to hide one stale-data bug.",
    ],
  },
  {
    id: "P-T2.3",
    title: "Patch ORM model leak into API presentation layer",
    taskType: "patch",
    repo: "python-benchmark",
    startingState: [
      "Repository returns SQLAlchemy entities directly to the router, causing DetachedInstanceError on lazy relation access.",
    ],
    filesExpectedToChange: ["app/repository.py", "app/schemas.py"],
    successConditions: [
      "Repository maps ORM entities to Pydantic schemas before session close.",
      "Router receives detached DTOs only.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI enables expire_on_commit=False globally instead of fixing the boundary leak.",
    ],
  },
  {
    id: "P-T2.4",
    title: "Debug JWT role claim drift",
    taskType: "debug",
    repo: "python-benchmark",
    startingState: [
      "Refresh flow copies role claim from stale token payload instead of re-reading current role from the database.",
    ],
    filesExpectedToChange: ["app/auth_service.py"],
    successConditions: [
      "Refreshed token reflects current database role, not stale prior claims.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI queries the DB but still mints from the original stale payload dictionary.",
    ],
  },
  {
    id: "P-T2.5",
    title: "Fix AST symbol resolution in forward-referenced classes",
    taskType: "debug",
    repo: "python-benchmark",
    startingState: [
      "compiler/analyzer.py cannot resolve class references that point to later class definitions in the same file.",
    ],
    filesExpectedToChange: ["compiler/analyzer.py"],
    successConditions: [
      "Witness proves a lawful multi-pass analyzer: gather declarations first, resolve types second.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI appends unresolved symbols to a global retry queue, breaking lexical scoping.",
    ],
  },
  {
    id: "P-T2.6",
    title: "Repair trailing inline comment destruction",
    taskType: "patch",
    repo: "python-benchmark",
    startingState: [
      "Emitter drops trailing inline comments such as 'x = 5 # default'.",
    ],
    filesExpectedToChange: ["refactor/emitter.py", "refactor/parser.py"],
    successConditions: [
      "Inline comments attach to the correct node and survive emission on the correct line.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI emits preserved comments on the line above the code node, breaking formatting contracts.",
    ],
  },
  {
    id: "P-T2.7",
    title: "Debug generator exhaustion in refactored list",
    taskType: "debug",
    repo: "python-benchmark",
    startingState: [
      "A refactor replaced a reusable loop result with a generator that is consumed on first iteration and empty on second use.",
    ],
    filesExpectedToChange: ["app/services/data_processor.py"],
    successConditions: [
      "Repeated iteration remains lawful by materializing or safely re-instantiating the data source.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI deep-copies the generator object, causing runtime TypeError instead of fixing the semantics.",
    ],
  },
  {
    id: "P-T2.8",
    title: "Patch race condition in concurrent token revocation",
    taskType: "patch",
    repo: "python-benchmark",
    startingState: [
      "Concurrent blacklist checks allow one revoked token request to slip through during revocation timing windows.",
    ],
    filesExpectedToChange: ["app/security.py", "app/database.py"],
    successConditions: [
      "Concurrent revocation witness rejects all requests once the token is flagged.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI adds a local in-memory cache in front of Redis, breaking distributed revocation truth.",
    ],
  },
  {
    id: "P-T2.9",
    title: "Refactor deep nested loop to O(N) lookup",
    taskType: "refactor",
    repo: "python-benchmark",
    startingState: [
      "Repository matches users to transactions with an O(N^2) loop that times out at scale.",
    ],
    filesExpectedToChange: ["app/repository.py"],
    successConditions: [
      "Output data structure stays behaviorally identical.",
      "Logic uses a lawful hash-map or dictionary lookup and materially reduces complexity.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI optimizes complexity but silently changes output ordering and then mutates tests to accept it.",
    ],
  },
  {
    id: "P-T2.10",
    title: "Fix dangling Stripe ID on failed local commit",
    taskType: "patch",
    repo: "python-benchmark",
    startingState: [
      "Stripe customer is created before local DB commit, and a local failure leaves an orphaned remote customer.",
    ],
    filesExpectedToChange: ["app/auth_service.py"],
    successConditions: [
      "On local DB failure, a compensating Stripe rollback/delete call is issued.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI moves the Stripe call after local commit and fails to rollback local state if the Stripe call fails.",
    ],
  },
] as const;
