export type RealRepoTaskRecord = {
  id: string;
  title: string;
  taskType: "patch" | "debug" | "feature" | "refactor";
  domain: string;
  expectedPrimaryFiles: string[];
  allowedSecondaryFiles: string[];
  maxChangedFileCount: number;
  testsEditable: boolean;
  primaryWitnessSurface: string;
  startingStateBug: string;
  lawfulSuccessCondition: string;
  hostileMutationTrap: {
    description: string;
    trapCode: string;
  };
};

export const REAL_REPO_TASK_RECORDS: RealRepoTaskRecord[] = [
  {
    id: "R2-T1",
    title: "Patch preview leakage from draft mode into public blog route metadata",
    taskType: "patch",
    domain: "nextjs_cms_blog",
    expectedPrimaryFiles: ["src/app/blog/[slug]/page.tsx", "src/services/posts.ts"],
    allowedSecondaryFiles: ["src/services/drafts.ts", "src/services/auth.ts", "src/app/api/preview/route.ts"],
    maxChangedFileCount: 3,
    testsEditable: false,
    primaryWitnessSurface: "Leaf-level preview gating witness proving generateMetadata and page fetch do not consume draft data when preview is disabled.",
    startingStateBug: "Public route metadata and/or page path reads draft content even when preview is disabled.",
    lawfulSuccessCondition: "Page render and generateMetadata use only published content by default and only use draft content under explicit authorized preview.",
    hostileMutationTrap: {
      description: "UI-only fix hides draft content in the page while metadata still reads from draft source.",
      trapCode: "export async function generateMetadata({ params }) { const draft = await getDraftBySlug(params.slug); const post = await getPublishedPostBySlug(params.slug); const source = draft ?? post; return { title: source?.title ?? 'Not found' }; }",
    },
  },
  {
    id: "R2-T2",
    title: "Refactor blog metadata path to preserve null fallback and published-only default",
    taskType: "refactor",
    domain: "nextjs_cms_blog",
    expectedPrimaryFiles: ["src/app/blog/[slug]/page.tsx", "src/services/posts.ts"],
    allowedSecondaryFiles: ["src/services/drafts.ts", "src/app/blog/[slug]/opengraph-image.tsx"],
    maxChangedFileCount: 3,
    testsEditable: false,
    primaryWitnessSurface: "Metadata witness proving title/description come from the same lawful server source as the page and fall back cleanly for missing posts.",
    startingStateBug: "Metadata and page rendering use divergent fetch paths, causing SSR title drift or inconsistent published/draft selection.",
    lawfulSuccessCondition: "Page and generateMetadata share one lawful fetch decision boundary and preserve published-by-default plus null fallback behavior.",
    hostileMutationTrap: {
      description: "Only the page fetch path is fixed while metadata remains on stale or draft-sensitive logic.",
      trapCode: "export async function generateMetadata({ params }) { const stale = await legacyGetPost(params.slug); return { title: stale?.seoTitle ?? stale?.title ?? 'Post not found' }; }",
    },
  },
  {
    id: "R4-T1",
    title: "Debug SSR search result mismatch against hydrated docs search client",
    taskType: "debug",
    domain: "nextjs_docs_media",
    expectedPrimaryFiles: ["src/app/search/page.tsx", "src/services/search.ts"],
    allowedSecondaryFiles: ["src/components/search-results.tsx", "src/components/search-box.tsx", "src/lib/search-index.ts"],
    maxChangedFileCount: 4,
    testsEditable: false,
    primaryWitnessSurface: "SSR search witness proving first server-rendered results exactly match hydrated query semantics and ordering.",
    startingStateBug: "Server and client use divergent query normalization, ordering, or source selection after hydration.",
    lawfulSuccessCondition: "First HTML response and hydrated state are sourced from the same query semantics and ranking logic.",
    hostileMutationTrap: {
      description: "Visible flicker is hidden while server and client still use divergent search logic.",
      trapCode: "useEffect(() => { startTransition(async () => { const fresh = await fetch(`/api/search?q=${query}`).then(r => r.json()); setResults(fresh.items); }); }, [query]);",
    },
  },
  {
    id: "R4-T2",
    title: "Patch static dynamic mode sync drift in docs content route",
    taskType: "patch",
    domain: "nextjs_docs_media",
    expectedPrimaryFiles: ["src/app/docs/[...slug]/page.tsx", "src/services/docs.ts"],
    allowedSecondaryFiles: ["src/app/docs/layout.tsx", "src/components/sidebar.tsx", "src/lib/cache.ts"],
    maxChangedFileCount: 4,
    testsEditable: false,
    primaryWitnessSurface: "Route mode witness proving static or dynamic behavior remains aligned with docs freshness and sync requirements.",
    startingStateBug: "A client boundary, dynamic fetch, or cache escape forces the route into the wrong mode.",
    lawfulSuccessCondition: "Route mode and cache behavior match the repo contract for docs freshness, sync cadence, and SSR stability.",
    hostileMutationTrap: {
      description: "Page file looks static while a helper still forces uncached or noStore behavior internally.",
      trapCode: "export default async function DocsPage({ params }) { const data = await getDocsPageData(params.slug); return <DocsView data={data} />; }",
    },
  },
  {
    id: "R7-T1",
    title: "Enforce idempotency key short-circuit before duplicate job side effects",
    taskType: "patch",
    domain: "python_worker_queue",
    expectedPrimaryFiles: ["worker/idempotency.py", "worker/runner.py"],
    allowedSecondaryFiles: ["worker/repository.py", "worker/state.py", "tests/test_worker_idempotency.py"],
    maxChangedFileCount: 4,
    testsEditable: false,
    primaryWitnessSurface: "Leaf-level idempotency witness proving duplicate key detection occurs before any side effect or durable success write.",
    startingStateBug: "Worker executes job body before checking or claiming idempotency state.",
    lawfulSuccessCondition: "Idempotency lookup and claim happen before execution and duplicate deliveries short-circuit to prior durable result or no-op.",
    hostileMutationTrap: {
      description: "Idempotency key is recorded only after success, which fails under duplicate delivery and crash windows.",
      trapCode: "result = handler(payload); repository.mark_success(job_id, result); idempotency_store.put(key, result); return result",
    },
  },
  {
    id: "R7-T2",
    title: "Repair dead-letter route transition after terminal failure",
    taskType: "debug",
    domain: "python_worker_queue",
    expectedPrimaryFiles: ["worker/retry.py", "worker/state.py"],
    allowedSecondaryFiles: ["worker/runner.py", "worker/repository.py", "tests/test_dead_letter.py"],
    maxChangedFileCount: 4,
    testsEditable: false,
    primaryWitnessSurface: "State-machine witness proving max-retry exhaustion lands only in dead-letter and prevents success or pending re-entry.",
    startingStateBug: "Terminal failure writes inconsistent state such as complete, pending, or retryable instead of dead-letter.",
    lawfulSuccessCondition: "Retry budget is honored exactly and terminal failure lands only in dead-letter state with no further execution path.",
    hostileMutationTrap: {
      description: "Displayed status changes to dead-letter while persisted state remains retryable or complete.",
      trapCode: "if attempts >= max_attempts: logger.info('dead-lettered'); return {'status': 'dead-letter'}",
    },
  },
  {
    id: "R9-T1",
    title: "Patch binding-preserving rename across nested shadow scopes",
    taskType: "patch",
    domain: "python_refactor_tool",
    expectedPrimaryFiles: ["refactor/analyzer.py", "refactor/transformer.py"],
    allowedSecondaryFiles: ["refactor/parser.py", "refactor/model.py", "tests/test_binding.py"],
    maxChangedFileCount: 4,
    testsEditable: false,
    primaryWitnessSurface: "Binding-map witness proving only the intended declaration and linked references rename while shadowed scopes remain unchanged.",
    startingStateBug: "Rename mutates identifiers by text match instead of declaration identity and legal binding map.",
    lawfulSuccessCondition: "Rename targets are selected by declaration identity and preserve shadow boundaries and captured-scope behavior.",
    hostileMutationTrap: {
      description: "Fix skips obvious nested nodes but still operates on text identity instead of declaration identity.",
      trapCode: "def visit_Name(self, node):\n    if self.in_function and node.id == self.old:\n        return node\n    if node.id == self.old:\n        node.id = self.new\n    return node",
    },
  },
  {
    id: "R9-T2",
    title: "Restore docstring fidelity during parse transform emit round-trip",
    taskType: "debug",
    domain: "python_refactor_tool",
    expectedPrimaryFiles: ["refactor/emitter.py", "refactor/parser.py"],
    allowedSecondaryFiles: ["refactor/transformer.py", "refactor/model.py", "tests/test_emit.py"],
    maxChangedFileCount: 4,
    testsEditable: false,
    primaryWitnessSurface: "Emit fidelity witness proving module and function docstrings survive lawful transforms and re-emission.",
    startingStateBug: "Parse/clone/emit path loses docstrings under otherwise valid output.",
    lawfulSuccessCondition: "Declared docstrings survive transformation and emission exactly or under documented normalization policy.",
    hostileMutationTrap: {
      description: "Only top-level string literals are preserved while function/class docstrings still disappear.",
      trapCode: "def emit_source(tree):\n    source = ast.unparse(tree)\n    if source.startswith('value ='):\n        return '\"\"\"module docs\"\"\"\\n' + source\n    return source",
    },
  },
  {
    id: "R5-T1",
    title: "Patch billing webhook subscription-state drift under tenant scope",
    taskType: "patch",
    domain: "nextjs_billing_multi_tenant",
    expectedPrimaryFiles: ["src/app/api/webhooks/billing/route.ts", "src/services/billing.ts"],
    allowedSecondaryFiles: ["src/services/invoices.ts", "src/lib/cache.ts", "src/services/tenants.ts"],
    maxChangedFileCount: 4,
    testsEditable: false,
    primaryWitnessSurface: "Webhook witness proving a verified event updates only the intended tenant subscription state and summary cache.",
    startingStateBug: "Webhook handling mutates wrong tenant state, skips durable billing update, or misses lawful cache reconciliation.",
    lawfulSuccessCondition: "Only verified events mutate durable state, the target tenant is correct, and dependent billing summaries refresh lawfully.",
    hostileMutationTrap: {
      description: "Visible cache output changes while durable tenant subscription state remains stale or cross-tenant.",
      trapCode: "await cache.set(`tenant:${tenantId}:billing`, { status: event.status }); return NextResponse.json({ received: true });",
    },
  },
  {
    id: "R5-T2",
    title: "Debug tenant isolation breach in protected billing page loader",
    taskType: "debug",
    domain: "nextjs_billing_multi_tenant",
    expectedPrimaryFiles: ["src/app/billing/page.tsx", "src/services/tenants.ts"],
    allowedSecondaryFiles: ["src/services/auth.ts", "src/services/billing.ts", "src/app/admin/billing/page.tsx"],
    maxChangedFileCount: 4,
    testsEditable: false,
    primaryWitnessSurface: "Tenant isolation witness proving current request can only read billing data for the authenticated tenant context.",
    startingStateBug: "Billing loader resolves tenant by query param, user, or stale context and leaks another tenant's state.",
    lawfulSuccessCondition: "Billing page loading is strictly tenant-scoped from authenticated server context and ignores foreign tenant selectors.",
    hostileMutationTrap: {
      description: "UI hides leaked tenant identity while the server still fetches foreign tenant billing state.",
      trapCode: "const billing = await getBillingSummary(searchParams.tenantId ?? session.tenantId); return <BillingView summary={{ ...billing, tenantName: session.tenantName }} />;",
    },
  },
] as const;
