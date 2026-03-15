export type BenchmarkTaskType = "patch" | "debug" | "feature" | "refactor" | "test-fix";
export type BenchmarkRepo = "next-benchmark" | "python-benchmark";

export type BenchmarkTaskPack = {
  id: string;
  title: string;
  taskType: BenchmarkTaskType;
  repo: BenchmarkRepo;
  startingState: string[];
  filesExpectedToChange: string[];
  successConditions: string[];
  hostileVariant: string[];
};

export const BENCHMARK_TASK_PACKS: BenchmarkTaskPack[] = [
  {
    id: "N1",
    title: "Patch broken optimistic like flow",
    taskType: "patch",
    repo: "next-benchmark",
    startingState: [
      "src/components/like-button.tsx uses standard useState blocked behind an await network call.",
      "src/components/__tests__/like-button.test.tsx fails because UI does not update synchronously on click.",
    ],
    filesExpectedToChange: [
      "src/components/like-button.tsx",
      "src/services/likes.ts",
    ],
    successConditions: [
      "like-button.test.tsx passes.",
      "Witness proves immediate count update and rollback on simulated server failure.",
      "Typecheck passes.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI implements useOptimistic but removes rollback/catch path, permanently desyncing UI on server failure.",
    ],
  },
  {
    id: "N2",
    title: "Debug RSC pagination regression",
    taskType: "debug",
    repo: "next-benchmark",
    startingState: [
      "src/app/items/page.tsx is marked 'use client' and fetches page data via useEffect.",
      "src/app/items/__tests__/page.test.tsx fails because SSR HTML does not contain item data.",
    ],
    filesExpectedToChange: [
      "src/app/items/page.tsx",
      "src/components/items-list.tsx",
    ],
    successConditions: [
      "Test passes.",
      "SSR witness confirms page-specific item list is present in raw HTML payload.",
      "Crawlable Link hrefs are present instead of client-only routing.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI switches back to RSC but stores page outside component scope, causing state bleed across concurrent requests.",
    ],
  },
  {
    id: "N4",
    title: "Add Stripe webhook verification",
    taskType: "feature",
    repo: "next-benchmark",
    startingState: [
      "src/app/api/webhooks/stripe/route.ts parses req.json() directly and trusts the payload.",
      "Route test fails because forged payloads are accepted.",
    ],
    filesExpectedToChange: [
      "src/app/api/webhooks/stripe/route.ts",
      "src/services/stripe.ts",
    ],
    successConditions: [
      "Valid signature witness returns 200.",
      "Invalid or missing signature returns 400 without DB mutation.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI calls stripe.webhooks.constructEvent but catches signature failure and still returns 200.",
    ],
  },
  {
    id: "N5",
    title: "Fix failing auth role guard test",
    taskType: "test-fix",
    repo: "next-benchmark",
    startingState: [
      "src/lib/auth.ts fails to reject expired sessions.",
      "Server action allows non-admins to execute mutations.",
    ],
    filesExpectedToChange: [
      "src/lib/auth.ts",
      "src/app/tests/auth.test.ts",
    ],
    successConditions: [
      "Witness proves 401 for invalid or expired token.",
      "Witness proves 403 for valid token with wrong role.",
      "Witness proves success for admin role.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI checks role from an unverified JWT payload instead of verifying signature first.",
    ],
  },
  {
    id: "N8",
    title: "Repair hostile client-side SEO mutation",
    taskType: "debug",
    repo: "next-benchmark",
    startingState: [
      "src/app/blog/[slug]/page.tsx mutates document.title inside a useEffect.",
      "SSR witness fails to find final title in head.",
    ],
    filesExpectedToChange: [
      "src/app/blog/[slug]/page.tsx",
    ],
    successConditions: [
      "SSR HTML and metadata both reflect final title on first render.",
      "Route exports generateMetadata.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI adds generateMetadata but hardcodes one title instead of fetching by slug.",
    ],
  },
  {
    id: "P1",
    title: "Patch async ORM transaction leak",
    taskType: "patch",
    repo: "python-benchmark",
    startingState: [
      "app/repository.py opens async_session() without guaranteed close or context management.",
      "tests/test_repository.py fails the connection pool exhaustion witness.",
    ],
    filesExpectedToChange: [
      "app/repository.py",
      "app/database.py",
    ],
    successConditions: [
      "Witness proves no connection leak after repeated forced exceptions.",
      "Transaction state remains healthy after stress iterations.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI adds finally close but swallows SQLAlchemyError without rollback, poisoning the pool.",
    ],
  },
  {
    id: "P4",
    title: "Add JWT strict decode path",
    taskType: "feature",
    repo: "python-benchmark",
    startingState: [
      "app/token.py uses jwt.decode(token, verify=False) or lacks explicit algorithm enforcement.",
      "tests/test_auth.py fails when passing a token signed with alg='none'.",
    ],
    filesExpectedToChange: [
      "app/token.py",
      "app/security.py",
    ],
    successConditions: [
      "Tampered tokens fail.",
      "Expired tokens raise a 401-equivalent exception.",
      "algorithms=['HS256'] is strictly enforced.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI enforces algorithm but disables expiry verification to make tests pass.",
    ],
  },
  {
    id: "P5",
    title: "Repair refresh-token replay bug",
    taskType: "patch",
    repo: "python-benchmark",
    startingState: [
      "app/auth_service.py validates refresh tokens but does not check blacklist or one-time usage table.",
      "Witness can mint two sessions from one refresh token.",
    ],
    filesExpectedToChange: [
      "app/auth_service.py",
      "app/repository.py",
    ],
    successConditions: [
      "Stale or used refresh token cannot mint a second session.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI invalidates the token after minting but outside the transaction boundary, leaving replay possible on crash.",
    ],
  },
  {
    id: "P6",
    title: "Fix compiler parser precedence bug",
    taskType: "debug",
    repo: "python-benchmark",
    startingState: [
      "compiler/parser.py treats + and * with equal precedence.",
      "Witness expects 1 + 2 * 3 to parse as 1 + (2 * 3).",
    ],
    filesExpectedToChange: [
      "compiler/parser.py",
      "compiler/ast_nodes.py",
    ],
    successConditions: [
      "Witness proves multiplication nests beneath addition for 1 + 2 * 3.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI hardcodes a string or regex shortcut for the tested expression instead of fixing parser logic.",
    ],
  },
  {
    id: "P8",
    title: "Repair comment/doc preservation in refactor",
    taskType: "debug",
    repo: "python-benchmark",
    startingState: [
      "refactor/emitter.py drops comments and docstrings when emitting transformed AST.",
      "tests/test_refactor.py fails checking directive survival.",
    ],
    filesExpectedToChange: [
      "refactor/emitter.py",
      "refactor/analyzer.py",
    ],
    successConditions: [
      "Witness proves directives and docs survive emit with bounded formatting churn.",
    ],
    hostileVariant: [
      "Same file graph.",
      "AI preserves comments but duplicates them recursively on nested nodes, bloating output.",
    ],
  },
] as const;
